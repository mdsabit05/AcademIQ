/**
 * Tool: generate-test
 *
 * Generates exam questions from the user's books using the same RAG →
 * rerank → context → LLM pipeline that the /tests route uses.
 *
 * Ownership:
 *  - verifyBookAccess ensures every bookId belongs to ctx.dbUserId.
 *  - If saveToDb is true, tests and questions are inserted with
 *    owner_id / user_id = ctx.dbUserId.
 *
 * Security note: correct answers are returned in the tool result so the
 * LLM can call evaluate-answer later. The agent system prompt explicitly
 * forbids revealing correct answers in the final user-facing response.
 *
 * Allowed roles: student, teacher, admin
 */

import { retrieve } from '../../services/retrieval.service.js'
import { rerank } from '../../services/reranker.service.js'
import { buildContext } from '../../services/context-builder.service.js'
import { completeJson } from '../../services/ai.service.js'
import { MODELS } from '../../config/models.js'
import { testGenerationPrompt } from '../../prompts/test.prompt.js'
import { verifyBookAccess } from '../../middleware/rbac.js'
import sql from '../../db/client.js'
import { registry } from '../tool-registry.js'
import type { AgentTool, ToolContext } from '../tool-registry.js'

interface Params {
  bookIds: string[]
  topic?: string
  questionCount: number
  type: 'mcq' | 'one_mark' | 'two_mark' | 'five_mark' | 'mixed'
  difficulty: 'easy' | 'medium' | 'hard'
  marksPerQuestion?: number
  saveToDb?: boolean
}

interface GeneratedQuestion {
  question: string
  question_type: string
  options: Record<string, string> | null
  correct_answer: string
  marks: number
  topic: string
  difficulty: string
}

const tool: AgentTool<Params> = {
  name: 'generate-test',

  description:
    'Generate practice test questions from the user\'s books. Uses semantic search to find ' +
    'relevant content, then generates targeted questions. Set saveToDb to true if the user ' +
    'wants to take the test later via the Tests page.',

  parameters: {
    type: 'object',
    properties: {
      bookIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Book IDs to draw questions from. Must be books the user owns.',
      },
      topic: {
        type: 'string',
        description: 'Topic or subject area to focus the questions on.',
      },
      questionCount: {
        type: 'integer',
        minimum: 1,
        maximum: 20,
        description: 'Number of questions to generate (1–20).',
      },
      type: {
        type: 'string',
        enum: ['mcq', 'one_mark', 'two_mark', 'five_mark', 'mixed'],
        description: 'Question format type.',
      },
      difficulty: {
        type: 'string',
        enum: ['easy', 'medium', 'hard'],
        description: 'Difficulty level of the generated questions.',
      },
      marksPerQuestion: {
        type: 'integer',
        minimum: 1,
        maximum: 10,
        description: 'Marks per question (uses type defaults if omitted).',
      },
      saveToDb: {
        type: 'boolean',
        description:
          'If true, persist the test to the database so the user can take it later. ' +
          'Only set true when the user explicitly asks to save or take the test.',
      },
    },
    required: ['bookIds', 'questionCount', 'type', 'difficulty'],
  },

  allowedRoles: ['student', 'teacher', 'admin'],

  async execute(params: Params, ctx: ToolContext): Promise<unknown> {
    const {
      bookIds,
      topic,
      questionCount,
      type,
      difficulty,
      marksPerQuestion,
      saveToDb = false,
    } = params

    const count = Math.max(1, Math.min(questionCount, 20))

    // Ownership check — throws 403 if any book is not owned by this user
    await verifyBookAccess(bookIds, ctx.dbUserId)

    // RAG pipeline to build context for question generation
    const query = topic || 'general overview'
    const candidates = await retrieve(query, bookIds, 20)
    const reranked = await rerank(query, candidates, 8)
    const { contextText } = buildContext(reranked)

    // Generate questions using the shared prompt + strong model
    const prompt = testGenerationPrompt(contextText, {
      questionCount: count,
      type,
      difficulty,
      topic,
      marksPerQuestion,
    })

    const generated = await completeJson<GeneratedQuestion[]>(
      [{ role: 'user', content: prompt }],
      MODELS.strong,
    )

    if (!Array.isArray(generated) || generated.length === 0) {
      throw new Error('Question generation failed — AI returned no questions')
    }

    const totalMarks = generated.reduce((sum, q) => sum + (q.marks ?? 1), 0)

    // Optionally persist to DB with correct ownership
    let testId: string | null = null
    if (saveToDb) {
      const config = JSON.stringify({ bookIds, generatedByAgent: true })
      const [testRow] = await sql<[{ id: string }]>`
        INSERT INTO tests
          (owner_id, topic, total_marks, question_count, type, difficulty, config)
        VALUES (
          ${ctx.dbUserId}, ${topic ?? null}, ${totalMarks},
          ${generated.length}, ${type}, ${difficulty},
          ${config}::jsonb
        )
        RETURNING id
      `
      testId = testRow.id

      for (let i = 0; i < generated.length; i++) {
        const q = generated[i]
        await sql`
          INSERT INTO test_questions
            (test_id, question, question_type, options, correct_answer,
             marks, topic, difficulty, order_index)
          VALUES (
            ${testId}, ${q.question}, ${q.question_type},
            ${q.options ? JSON.stringify(q.options) : null}::jsonb,
            ${q.correct_answer}, ${q.marks ?? 1},
            ${q.topic ?? null}, ${q.difficulty ?? difficulty}, ${i}
          )
        `
      }

      for (const bid of bookIds) {
        await sql`
          INSERT INTO test_books (test_id, book_id)
          VALUES (${testId}, ${bid})
          ON CONFLICT DO NOTHING
        `
      }
    }

    return {
      testId,
      topic: topic ?? null,
      questionCount: generated.length,
      totalMarks,
      difficulty,
      type,
      savedAsTest: saveToDb && testId != null,
      // Correct answers are included for the agent's internal use (evaluate-answer).
      // The system prompt FORBIDS the agent from revealing them to the user.
      questions: generated.map((q, i) => ({
        index: i + 1,
        question: q.question,
        questionType: q.question_type,
        options: q.options ?? null,
        marks: q.marks ?? 1,
        topic: q.topic ?? null,
        correctAnswer: q.correct_answer,
      })),
    }
  },
}

registry.register(tool)
export default tool

/**
 * Tool: evaluate-answer
 *
 * Evaluates a student answer against a correct answer using the existing
 * scoring infrastructure (exact-match for MCQ/one-mark, AI scoring for
 * longer answers).
 *
 * This tool is a pure computation — it does not read or write the database
 * and therefore has no ownership concern. All inputs come from the LLM's
 * context (question text + correctAnswer gathered via generate-test or
 * retrieve-context in the same agent turn).
 *
 * Allowed roles: student, teacher, admin
 */

import { complete } from '../../services/ai.service.js'
import { MODELS } from '../../config/models.js'
import { registry } from '../tool-registry.js'
import type { AgentTool, ToolContext } from '../tool-registry.js'

interface Params {
  question: string
  correctAnswer: string
  userAnswer: string
  questionType: 'mcq' | 'one_mark' | 'two_mark' | 'five_mark'
  marks: number
}

const tool: AgentTool<Params> = {
  name: 'evaluate-answer',

  description:
    'Evaluate a student\'s answer to a question. Returns the marks awarded, whether the ' +
    'answer is correct, and brief feedback. Use this to assess practice answers during a ' +
    'tutoring session.',

  parameters: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: 'The full question text.',
      },
      correctAnswer: {
        type: 'string',
        description: 'The correct or model answer (obtained from generate-test output or context).',
      },
      userAnswer: {
        type: 'string',
        description: "The student's answer to evaluate.",
      },
      questionType: {
        type: 'string',
        enum: ['mcq', 'one_mark', 'two_mark', 'five_mark'],
        description: 'Determines the scoring method used.',
      },
      marks: {
        type: 'integer',
        minimum: 1,
        maximum: 10,
        description: 'Maximum marks available for this question.',
      },
    },
    required: ['question', 'correctAnswer', 'userAnswer', 'questionType', 'marks'],
  },

  allowedRoles: ['student', 'teacher', 'admin'],

  // _ctx is intentionally unused — pure computation, no DB access
  async execute(params: Params, _ctx: ToolContext): Promise<unknown> {
    const { question, correctAnswer, userAnswer, questionType, marks } = params

    // Exact-match scoring for MCQ and one-mark questions
    if (questionType === 'mcq' || questionType === 'one_mark') {
      const isCorrect =
        userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase()
      return {
        marksAwarded: isCorrect ? marks : 0,
        maxMarks: marks,
        isCorrect,
        feedback: isCorrect
          ? 'Correct!'
          : `Incorrect. The correct answer is: ${correctAnswer}`,
      }
    }

    // AI scoring for two_mark and five_mark
    const prompt = `You are a fair academic examiner. Score this student answer.

Question: ${question}
Model answer: ${correctAnswer}
Student answer: ${userAnswer}
Maximum marks: ${marks}

Award marks based on accuracy, completeness, and relevance to the model answer.
Reply with JSON only:
{"marks": <integer 0–${marks}>, "isCorrect": <boolean>, "feedback": "<2–3 sentences>"}`

    try {
      const raw = await complete([{ role: 'user', content: prompt }], MODELS.light)
      const cleaned = raw
        .replace(/^```(?:json)?\s*/m, '')
        .replace(/\s*```\s*$/m, '')
        .trim()
      const result = JSON.parse(cleaned) as {
        marks: number
        isCorrect: boolean
        feedback: string
      }
      const marksAwarded = Math.max(0, Math.min(marks, Math.round(result.marks)))
      return {
        marksAwarded,
        maxMarks: marks,
        isCorrect: result.isCorrect ?? marksAwarded >= Math.ceil(marks / 2),
        feedback: result.feedback ?? '',
      }
    } catch {
      return {
        marksAwarded: 0,
        maxMarks: marks,
        isCorrect: false,
        feedback: 'Evaluation could not be completed. Please try again.',
      }
    }
  },
}

registry.register(tool)
export default tool

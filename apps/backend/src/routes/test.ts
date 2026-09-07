import { Hono } from 'hono'
import { retrieveChunks, retrieveChunksMulti, buildContext } from '../services/rag.service.js'
import { completeJson } from '../services/openrouter.service.js'
import { testPrompt } from '../prompts/test.prompt.js'
import { authMiddleware, type AuthEnv } from '../middleware/auth.js'
import sql from '../db/client.js'
import type {
  GenerateTestRequest,
  GenerateTestResponse,
  SubmitTestRequest,
  SubmitTestResponse,
  TestQuestion,
  Difficulty,
  TestType,
} from 'shared'

const app = new Hono<AuthEnv>()
app.use('*', authMiddleware)

export function scoreAttempt(
  questions: Array<{ id: string; correct_answer: string; marks: number }>,
  answers: Record<string, string>,
): { score: number; totalMarks: number } {
  let score = 0
  let totalMarks = 0
  for (const q of questions) {
    totalMarks += q.marks
    if (answers[q.id]?.trim().toLowerCase() === q.correct_answer.trim().toLowerCase()) {
      score += q.marks
    }
  }
  return { score, totalMarks }
}

// GET /api/test/attempts — MUST be before /:testId to avoid param capture
app.get('/attempts', async (c) => {
  const userId = c.get('dbUserId')
  const attempts = await sql`
    SELECT
      ta.*,
      t.topic,
      t.type,
      t.difficulty,
      t.document_id,
      d.title AS document_title
    FROM test_attempts ta
    JOIN tests t ON ta.test_id = t.id
    JOIN documents d ON t.document_id = d.id
    WHERE ta.user_id = ${userId}
    ORDER BY ta.submitted_at DESC
  `
  return c.json({ attempts })
})

// POST /api/test/generate
app.post('/generate', async (c) => {
  const body = await c.req.json<GenerateTestRequest>()
  const { documentId, topic, count, type, difficulty } = body
  const userId = c.get('dbUserId')
  const settings = c.get('userSettings')

  const apiKey = settings.openrouterKey ?? process.env.OPENROUTER_API_KEY!
  const ollamaUrl = settings.ollamaUrl ?? process.env.OLLAMA_URL ?? 'http://localhost:11434'
  const model = settings.defaultModel ?? 'google/gemini-3.5-flash'

  if (!apiKey) return c.json({ error: 'OpenRouter API key not configured' }, 400)

  const docIds = body.documentIds && body.documentIds.length > 1 ? body.documentIds : null
  const chunks = docIds
    ? await retrieveChunksMulti(topic, docIds, 8, ollamaUrl)
    : await retrieveChunks(topic, documentId, 8, ollamaUrl)
  const context = buildContext(chunks)
  const messages = testPrompt(topic, context, count, type, difficulty)

  const result = await completeJson<{ questions: Array<Omit<TestQuestion, 'id' | 'test_id' | 'order_index'>> }>(
    messages,
    apiKey,
    model,
  )

  // Persist test
  const [test] = await sql`
    INSERT INTO tests (user_id, document_id, topic, question_count, type, difficulty, document_ids)
    VALUES (${userId}, ${documentId}, ${topic}, ${count}, ${type}, ${difficulty},
            ${body.documentIds ?? []})
    RETURNING *
  `

  // Persist questions
  const questionRows: TestQuestion[] = []
  for (let i = 0; i < result.questions.length; i++) {
    const q = result.questions[i]
    const [row] = await sql`
      INSERT INTO test_questions (test_id, question, options, correct_answer, marks, order_index)
      VALUES (
        ${test.id},
        ${q.question},
        ${q.options ? JSON.stringify(q.options) : null},
        ${q.correct_answer},
        ${q.marks ?? 1},
        ${i}
      )
      RETURNING *
    `
    questionRows.push(row as TestQuestion)
  }

  return c.json({ test, questions: questionRows } satisfies GenerateTestResponse, 201)
})

// POST /api/test/paper — generate question paper (no DB save)
app.post('/paper', async (c) => {
  const body = await c.req.json<{
    documentId: string
    topic: string
    difficulty: Difficulty
    sections: Array<{ type: TestType; count: number; marksPerQ: number }>
  }>()

  const settings = c.get('userSettings')
  const apiKey = settings.openrouterKey ?? process.env.OPENROUTER_API_KEY!
  const ollamaUrl = settings.ollamaUrl ?? process.env.OLLAMA_URL ?? 'http://localhost:11434'
  const model = settings.defaultModel ?? 'google/gemini-3.5-flash'

  if (!apiKey) return c.json({ error: 'OpenRouter API key not configured' }, 400)

  const chunks = await retrieveChunks(body.topic, body.documentId, 10, ollamaUrl)
  const context = buildContext(chunks)

  const resultSections = []
  for (const section of body.sections) {
    const messages = testPrompt(body.topic, context, section.count, section.type, body.difficulty)
    const result = await completeJson<{
      questions: Array<{ question: string; options: string[] | null; correct_answer: string; marks: number }>
    }>(messages, apiKey, model)
    resultSections.push({ type: section.type, marksPerQ: section.marksPerQ, questions: result.questions })
  }

  return c.json({ sections: resultSections })
})

// GET /api/test/:testId
app.get('/:testId', async (c) => {
  const userId = c.get('dbUserId')
  const testId = c.req.param('testId')

  const [test] = await sql`SELECT * FROM tests WHERE id = ${testId} AND user_id = ${userId}`
  if (!test) return c.json({ error: 'Test not found' }, 404)

  const questions = await sql`
    SELECT * FROM test_questions WHERE test_id = ${testId} ORDER BY order_index
  `

  return c.json({ test, questions })
})

// POST /api/test/:testId/submit
app.post('/:testId/submit', async (c) => {
  const userId = c.get('dbUserId')
  const testId = c.req.param('testId')
  const { answers, timeElapsed, tabSwitches } = await c.req.json<SubmitTestRequest>()

  const questions = await sql<Array<{ id: string; correct_answer: string; marks: number }>>`
    SELECT id, correct_answer, marks FROM test_questions WHERE test_id = ${testId}
  `

  if (questions.length === 0) return c.json({ error: 'Test not found' }, 404)

  const { score, totalMarks } = scoreAttempt(questions, answers)

  const [attempt] = await sql`
    INSERT INTO test_attempts
      (test_id, user_id, answers, score, total_marks, time_elapsed_seconds, tab_switches, started_at)
    VALUES
      (${testId}, ${userId}, ${JSON.stringify(answers)}, ${score}, ${totalMarks},
       ${timeElapsed}, ${tabSwitches}, now() - (${timeElapsed} || ' seconds')::interval)
    RETURNING *
  `

  const allQuestions = await sql`
    SELECT * FROM test_questions WHERE test_id = ${testId} ORDER BY order_index
  `

  return c.json({ attempt, questions: allQuestions } satisfies SubmitTestResponse)
})

export default app

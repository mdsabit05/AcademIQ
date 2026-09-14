/**
 * Tests routes
 *
 * POST   /tests                       — generate a test (AI question generation)
 * GET    /tests                       — list user's tests
 * GET    /tests/:id                   — get test + questions
 * POST   /tests/:id/attempt           — submit attempt (score + save)
 * GET    /tests/:id/attempts          — list attempts for this test
 * GET    /tests/:id/attempts/:attemptId — get full attempt with per-question results
 */

import { Hono } from 'hono'
import sql from '../db/client.js'
import { requireOwnership } from '../middleware/rbac.js'
import { verifyBookAccess } from '../middleware/rbac.js'
import { retrieve } from '../services/retrieval.service.js'
import { rerank } from '../services/reranker.service.js'
import { buildContext } from '../services/context-builder.service.js'
import { completeJson } from '../services/ai.service.js'
import { MODELS } from '../config/models.js'
import { testGenerationPrompt } from '../prompts/test.prompt.js'
import { scoreAttempt } from '../lib/scorer.js'
import { extractAndSave } from '../services/memory.service.js'
import type { AuthEnv } from '../middleware/auth.js'

const tests = new Hono<AuthEnv>()

// ── Generate test ───────────────────────────────────────────────────────────

tests.post('/', async (c) => {
  const dbUserId = c.get('dbUserId')
  const body = await c.req.json<{
    bookIds: string[]
    subjectId?: string
    topic?: string
    questionCount: number
    type: 'mcq' | 'one_mark' | 'two_mark' | 'five_mark' | 'mixed'
    difficulty: 'easy' | 'medium' | 'hard'
    durationMinutes?: number
    marksPerQuestion?: number
  }>()

  try {
    await verifyBookAccess(body.bookIds ?? [], dbUserId)
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 400
    return c.json({ error: (err as Error).message }, status as 400 | 403)
  }

  // Retrieve relevant chunks for context
  const topic = body.topic ?? ''
  const candidates = await retrieve(topic || 'general overview', body.bookIds, 20)
  const reranked = await rerank(topic || 'general overview', candidates, 8)
  const { contextText } = buildContext(reranked)

  // Generate questions
  const prompt = testGenerationPrompt(contextText, {
    questionCount: body.questionCount,
    type: body.type,
    difficulty: body.difficulty,
    topic: body.topic,
    marksPerQuestion: body.marksPerQuestion,
  })

  const generated = await completeJson<Array<{
    question: string
    question_type: string
    options: Record<string, string> | null
    correct_answer: string
    marks: number
    topic: string
    difficulty: string
  }>>([{ role: 'user', content: prompt }], MODELS.strong)

  if (!Array.isArray(generated) || generated.length === 0) {
    return c.json({ error: 'AI failed to generate questions' }, 500)
  }

  // Calculate totals
  const totalMarks = generated.reduce((sum, q) => sum + (q.marks ?? 1), 0)
  const config: Record<string, unknown> = {
    marksPerQuestion: body.marksPerQuestion,
    bookIds: body.bookIds,
  }

  // Insert test
  const [test] = await sql<[{ id: string }]>`
    INSERT INTO tests
      (owner_id, subject_id, topic, duration_minutes, total_marks,
       question_count, type, difficulty, config)
    VALUES (
      ${dbUserId}, ${body.subjectId ?? null}, ${body.topic ?? null},
      ${body.durationMinutes ?? null}, ${totalMarks},
      ${generated.length}, ${body.type}, ${body.difficulty},
      ${JSON.stringify(config)}::jsonb
    )
    RETURNING id
  `

  // Insert books junction
  for (const bookId of body.bookIds) {
    await sql`
      INSERT INTO test_books (test_id, book_id) VALUES (${test.id}, ${bookId})
      ON CONFLICT DO NOTHING
    `
  }

  // Insert questions
  for (let i = 0; i < generated.length; i++) {
    const q = generated[i]
    await sql`
      INSERT INTO test_questions
        (test_id, question, question_type, options, correct_answer, marks,
         topic, difficulty, order_index)
      VALUES (
        ${test.id}, ${q.question}, ${q.question_type},
        ${q.options ? sql.json(q.options) : null},
        ${q.correct_answer}, ${q.marks ?? 1},
        ${q.topic ?? null}, ${q.difficulty ?? body.difficulty}, ${i}
      )
    `
  }

  const [fullTest] = await sql`SELECT * FROM tests WHERE id = ${test.id}`
  const questions = await sql`
    SELECT id, question, question_type, options, marks, topic, difficulty, order_index
    FROM test_questions WHERE test_id = ${test.id} ORDER BY order_index
  `

  return c.json({ test: fullTest, questions }, 201)
})

// ── List tests ──────────────────────────────────────────────────────────────

tests.get('/', async (c) => {
  const dbUserId = c.get('dbUserId')
  const rows = await sql`
    SELECT id, topic, type, difficulty, question_count, total_marks,
           duration_minutes, created_at
    FROM tests
    WHERE owner_id = ${dbUserId}
    ORDER BY created_at DESC
    LIMIT 50
  `
  return c.json({ tests: rows })
})

// ── Get test + questions ────────────────────────────────────────────────────

tests.get('/:id', requireOwnership('tests', 'id'), async (c) => {
  const id = c.req.param('id')
  const [test] = await sql`SELECT * FROM tests WHERE id = ${id}`
  if (!test) return c.json({ error: 'Not found' }, 404)

  // Return questions without correct_answer (student view)
  const questions = await sql`
    SELECT id, question, question_type, options, marks, topic, difficulty, order_index
    FROM test_questions WHERE test_id = ${id} ORDER BY order_index
  `
  return c.json({ test, questions })
})

// ── Submit attempt ──────────────────────────────────────────────────────────

tests.post('/:id/attempt', requireOwnership('tests', 'id'), async (c) => {
  const testId = c.req.param('id')
  const dbUserId = c.get('dbUserId')
  const body = await c.req.json<{
    answers: Record<string, string>  // questionId → answer
    timeElapsedSeconds?: number
    tabSwitches?: number
    startedAt?: string
  }>()

  // Load all questions (with correct answers) for scoring
  const questions = await sql<Array<{
    id: string
    question_type: string
    correct_answer: string
    marks: number
  }>>`
    SELECT id, question_type, correct_answer, marks
    FROM test_questions WHERE test_id = ${testId}
  `

  const { totalScore, totalMarks, results } = await scoreAttempt(questions, body.answers)

  // Insert attempt
  const [attempt] = await sql<[{ id: string }]>`
    INSERT INTO test_attempts
      (test_id, user_id, answers, score, total_marks,
       time_elapsed_seconds, tab_switches, started_at)
    VALUES (
      ${testId}, ${dbUserId}, ${JSON.stringify(body.answers)}::jsonb,
      ${totalScore}, ${totalMarks},
      ${body.timeElapsedSeconds ?? null}, ${body.tabSwitches ?? 0},
      ${body.startedAt ?? null}
    )
    RETURNING id
  `

  // Insert per-question results
  for (const r of results) {
    await sql`
      INSERT INTO test_attempt_answers
        (attempt_id, question_id, answer, is_correct, marks_awarded)
      VALUES (${attempt.id}, ${r.questionId}, ${r.answer}, ${r.isCorrect}, ${r.marksAwarded})
      ON CONFLICT (attempt_id, question_id) DO NOTHING
    `
  }

  // Async memory update from test results
  const memoryMessages = results.map((r) => ({
    role: 'assistant' as const,
    content: `Question ${r.questionId}: student answered "${r.answer}", correct: ${r.isCorrect}, marks: ${r.marksAwarded}/${r.maxMarks}`,
  }))
  extractAndSave(dbUserId, memoryMessages, 'test').catch(() => {})

  return c.json({
    attemptId: attempt.id,
    score: totalScore,
    totalMarks,
    results,
  }, 201)
})

// ── List attempts ───────────────────────────────────────────────────────────

tests.get('/:id/attempts', requireOwnership('tests', 'id'), async (c) => {
  const testId = c.req.param('id')
  const dbUserId = c.get('dbUserId')
  const rows = await sql`
    SELECT id, score, total_marks, time_elapsed_seconds, tab_switches, submitted_at
    FROM test_attempts
    WHERE test_id = ${testId} AND user_id = ${dbUserId}
    ORDER BY submitted_at DESC
  `
  return c.json({ attempts: rows })
})

// ── Get single attempt ──────────────────────────────────────────────────────

tests.get('/:id/attempts/:attemptId', requireOwnership('tests', 'id'), async (c) => {
  const { id: testId, attemptId } = c.req.param()

  const [attempt] = await sql`
    SELECT * FROM test_attempts WHERE id = ${attemptId} AND test_id = ${testId}
  `
  if (!attempt) return c.json({ error: 'Not found' }, 404)

  const answerRows = await sql`
    SELECT taa.question_id, taa.answer, taa.is_correct, taa.marks_awarded,
           tq.question, tq.question_type, tq.correct_answer, tq.marks
    FROM test_attempt_answers taa
    JOIN test_questions tq ON tq.id = taa.question_id
    WHERE taa.attempt_id = ${attemptId}
    ORDER BY tq.order_index
  `

  return c.json({ attempt, answers: answerRows })
})

export default tests

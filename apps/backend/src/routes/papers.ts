/**
 * Paper Blueprint & Question Paper routes (teacher only)
 *
 * Blueprints:
 *   POST   /papers/blueprints              — create blueprint
 *   GET    /papers/blueprints              — list teacher's blueprints
 *   GET    /papers/blueprints/:id          — get blueprint
 *   PATCH  /papers/blueprints/:id          — update blueprint
 *   DELETE /papers/blueprints/:id          — delete blueprint
 *
 * Papers (generated from blueprint):
 *   POST   /papers/blueprints/:id/generate — generate question paper from blueprint
 *   GET    /papers                         — list teacher's papers
 *   GET    /papers/:id                     — get paper + questions
 *   PATCH  /papers/:id/finalize            — finalize paper (status → finalized)
 *   DELETE /papers/:id                     — delete paper
 */

import { Hono } from 'hono'
import sql from '../db/client.js'
import { requireOwnership, requireRole, verifyBookAccess } from '../middleware/rbac.js'
import { rateLimit, userKey } from '../middleware/rate-limit.js'
import { botGuard } from '../middleware/abuse-protection.js'
import { retrieve } from '../services/retrieval.service.js'
import { rerank } from '../services/reranker.service.js'
import { buildContext } from '../services/context-builder.service.js'
import { completeJson } from '../services/ai.service.js'
import { MODELS } from '../config/models.js'
import { validateBlueprint, type BlueprintConfig, type BlueprintSection } from '../lib/blueprint-validator.js'
import { detectDuplicates } from '../lib/duplicate-detector.js'
import { testGenerationPrompt } from '../prompts/test.prompt.js'
import { limitStr } from '../lib/validate.js'
import type { AuthEnv } from '../middleware/auth.js'

const papers = new Hono<AuthEnv>()

// All paper routes are teacher/admin only
papers.use('*', requireRole('teacher', 'admin'))

// ── Blueprints ──────────────────────────────────────────────────────────────

papers.post('/blueprints', async (c) => {
  const dbUserId = c.get('dbUserId')
  const body = await c.req.json<{
    title: string
    subjectId?: string
    config: BlueprintConfig
  }>()

  const title = limitStr(body.title, 300)
  if (!title) return c.json({ error: 'title is required' }, 400)

  const validation = validateBlueprint(body.config)
  if (!validation.valid) {
    return c.json({ error: 'Invalid blueprint config', details: validation.errors }, 400)
  }

  const [blueprint] = await sql`
    INSERT INTO paper_blueprints (teacher_id, subject_id, title, config)
    VALUES (${dbUserId}, ${body.subjectId ?? null}, ${title}, ${JSON.stringify(body.config)}::jsonb)
    RETURNING *
  `
  return c.json({ blueprint }, 201)
})

papers.get('/blueprints', async (c) => {
  const dbUserId = c.get('dbUserId')
  const rows = await sql`
    SELECT id, title, subject_id, created_at, updated_at
    FROM paper_blueprints WHERE teacher_id = ${dbUserId}
    ORDER BY created_at DESC
  `
  return c.json({ blueprints: rows })
})

papers.get('/blueprints/:id', requireOwnership('paper_blueprints', 'id'), async (c) => {
  const [bp] = await sql`SELECT * FROM paper_blueprints WHERE id = ${c.req.param('id')}`
  if (!bp) return c.json({ error: 'Not found' }, 404)
  return c.json({ blueprint: bp })
})

papers.patch('/blueprints/:id', requireOwnership('paper_blueprints', 'id'), async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<{ title?: string; config?: BlueprintConfig }>()

  if (body.config) {
    const validation = validateBlueprint(body.config)
    if (!validation.valid) {
      return c.json({ error: 'Invalid blueprint config', details: validation.errors }, 400)
    }
  }

  await sql`
    UPDATE paper_blueprints
    SET
      title      = COALESCE(${body.title ? limitStr(body.title, 300) : null}, title),
      config     = COALESCE(${body.config ? JSON.stringify(body.config) : null}::jsonb, config),
      updated_at = now()
    WHERE id = ${id}
  `
  const [bp] = await sql`SELECT * FROM paper_blueprints WHERE id = ${id}`
  return c.json({ blueprint: bp })
})

papers.delete('/blueprints/:id', requireOwnership('paper_blueprints', 'id'), async (c) => {
  await sql`DELETE FROM paper_blueprints WHERE id = ${c.req.param('id')}`
  return c.json({ success: true })
})

// ── Generate paper ──────────────────────────────────────────────────────────

papers.post(
  '/blueprints/:id/generate',
  botGuard,
  // 3 paper generations per user per 10 minutes — each generation runs one
  // RAG + LLM call *per section*, making this the most expensive batch operation.
  rateLimit({ windowMs: 10 * 60_000, max: 3, keyFn: userKey, label: 'paper-generation' }),
  requireOwnership('paper_blueprints', 'id'),
  async (c) => {
  const blueprintId = c.req.param('id')
  const dbUserId = c.get('dbUserId')
  const body = await c.req.json<{ title?: string }>()

  const [bp] = await sql<[{ title: string; config: BlueprintConfig }]>`
    SELECT title, config FROM paper_blueprints WHERE id = ${blueprintId}
  `
  if (!bp) return c.json({ error: 'Blueprint not found' }, 404)

  // postgres.js auto-parses JSONB, but guard against string in case of driver quirk
  const config: BlueprintConfig = typeof bp.config === 'string'
    ? JSON.parse(bp.config)
    : bp.config
  const sections: BlueprintSection[] = config.sections ?? []
  const paperTitle = limitStr(body.title || `${bp.title} — ${new Date().toLocaleDateString()}`, 300)

  // Verify book access only when books are actually specified
  const allBookIds = [...new Set(sections.flatMap((s) => s.bookIds ?? []))]
  if (allBookIds.length > 0) {
    try {
      await verifyBookAccess(allBookIds, dbUserId, 'teacher')
    } catch (err: unknown) {
      const status = (err as { status?: number }).status ?? 400
      return c.json({ error: (err as Error).message }, status as 400 | 403)
    }
  }

  // Generate questions per section
  const allQuestions: Array<{
    sectionName: string
    question_text: string
    question_type: string
    options: Record<string, string> | null
    marks: number
    topic: string | null
    difficulty: string | null
    order_index: number
  }> = []

  let globalIndex = 0

  for (const section of sections) {
    const candidates = await retrieve(
      section.topics?.join(' ') ?? 'general',
      section.bookIds,
      20,
    )
    const reranked = await rerank(
      section.topics?.join(' ') ?? 'general',
      candidates,
      8,
    )
    const { contextText } = buildContext(reranked)

    const prompt = testGenerationPrompt(contextText, {
      questionCount: section.count,
      type: section.type,
      difficulty: section.difficulty ?? 'medium',
      topic: section.topics?.join(', '),
      marksPerQuestion: section.marksEach,
    })

    const generated = await completeJson<Array<{
      question: string
      question_type: string
      options: Record<string, string> | null
      marks: number
      topic: string
      difficulty: string
    }>>([{ role: 'user', content: prompt }], MODELS.strong)

    for (const q of generated) {
      allQuestions.push({
        sectionName: section.name,
        question_text: q.question,
        question_type: q.question_type,
        options: q.options ?? null,
        marks: q.marks ?? section.marksEach,
        topic: q.topic ?? null,
        difficulty: q.difficulty ?? section.difficulty ?? null,
        order_index: globalIndex++,
      })
    }
  }

  // Detect duplicates
  const duplicates = detectDuplicates(allQuestions.map((q) => q.question_text))
  const validation = {
    duplicates,
    duplicateCount: duplicates.length,
    questionCount: allQuestions.length,
  }

  // Create paper
  const [paper] = await sql<[{ id: string }]>`
    INSERT INTO question_papers (teacher_id, blueprint_id, title, status, validation)
    VALUES (
      ${dbUserId}, ${blueprintId}, ${paperTitle},
      'draft', ${JSON.stringify(validation)}::jsonb
    )
    RETURNING id
  `

  // Insert questions
  for (const q of allQuestions) {
    await sql`
      INSERT INTO paper_questions
        (paper_id, question_text, section, topic, difficulty, question_type,
         options, marks, order_index)
      VALUES (
        ${paper.id}, ${q.question_text}, ${q.sectionName},
        ${q.topic}, ${q.difficulty}, ${q.question_type},
        ${q.options ? JSON.stringify(q.options) : null}::jsonb,
        ${q.marks}, ${q.order_index}
      )
    `
  }

  const [fullPaper] = await sql`SELECT * FROM question_papers WHERE id = ${paper.id}`
  const rawQuestions = await sql`
    SELECT * FROM paper_questions WHERE paper_id = ${paper.id} ORDER BY order_index
  `
  const questions = rawQuestions.map((q) => ({
    ...q,
    options: typeof q.options === 'string'
      ? (() => { try { return JSON.parse(q.options) } catch { return null } })()
      : q.options,
  }))

  return c.json({ paper: fullPaper, questions, validation }, 201)
})

// ── Papers ──────────────────────────────────────────────────────────────────

papers.get('/', async (c) => {
  const dbUserId = c.get('dbUserId')
  const rows = await sql`
    SELECT id, title, status, blueprint_id, created_at, updated_at
    FROM question_papers WHERE teacher_id = ${dbUserId}
    ORDER BY created_at DESC
  `
  return c.json({ papers: rows })
})

papers.get('/:id', requireOwnership('question_papers', 'id'), async (c) => {
  const id = c.req.param('id')
  const [paper] = await sql`SELECT * FROM question_papers WHERE id = ${id}`
  if (!paper) return c.json({ error: 'Not found' }, 404)

  const rawQs = await sql`
    SELECT * FROM paper_questions WHERE paper_id = ${id} ORDER BY order_index
  `
  const questions = rawQs.map((q) => ({
    ...q,
    options: typeof q.options === 'string'
      ? (() => { try { return JSON.parse(q.options) } catch { return null } })()
      : q.options,
  }))
  return c.json({ paper, questions })
})

papers.patch('/:id/finalize', requireOwnership('question_papers', 'id'), async (c) => {
  const id = c.req.param('id')
  await sql`
    UPDATE question_papers SET status = 'finalized', updated_at = now()
    WHERE id = ${id}
  `
  const [paper] = await sql`SELECT * FROM question_papers WHERE id = ${id}`
  return c.json({ paper })
})

papers.delete('/:id', requireOwnership('question_papers', 'id'), async (c) => {
  await sql`DELETE FROM question_papers WHERE id = ${c.req.param('id')}`
  return c.json({ success: true })
})

export default papers

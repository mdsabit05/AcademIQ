/**
 * Study Plan routes
 *
 * GET/POST/DELETE /studyplan/exams
 * GET/POST/PATCH/DELETE /studyplan/tasks
 * GET/POST/PATCH/DELETE /studyplan/goals
 */

import { Hono } from 'hono'
import sql from '../db/client.js'
import type { AuthEnv } from '../middleware/auth.js'

const studyplan = new Hono<AuthEnv>()

// ── Exams ──────────────────────────────────────────────────────────────────────

studyplan.get('/exams', async (c) => {
  const userId = c.get('dbUserId')
  const rows = await sql`
    SELECT id, name, subject, exam_date, created_at
    FROM plan_exams WHERE user_id = ${userId}
    ORDER BY exam_date ASC
  `
  return c.json({ exams: rows })
})

studyplan.post('/exams', async (c) => {
  const userId = c.get('dbUserId')
  const body = await c.req.json<{ name: string; subject?: string; exam_date: string }>()
  if (!body.name?.trim() || !body.exam_date) return c.json({ error: 'name and exam_date required' }, 400)
  const [row] = await sql`
    INSERT INTO plan_exams (user_id, name, subject, exam_date)
    VALUES (${userId}, ${body.name.trim()}, ${body.subject?.trim() || null}, ${body.exam_date})
    RETURNING id, name, subject, exam_date, created_at
  `
  return c.json({ exam: row }, 201)
})

studyplan.delete('/exams/:id', async (c) => {
  const userId = c.get('dbUserId')
  const id = c.req.param('id')
  await sql`DELETE FROM plan_exams WHERE id = ${id} AND user_id = ${userId}`
  return c.json({ success: true })
})

// ── Tasks ──────────────────────────────────────────────────────────────────────

studyplan.get('/tasks', async (c) => {
  const userId = c.get('dbUserId')
  const rows = await sql`
    SELECT id, text, subject, completed, created_at
    FROM plan_tasks WHERE user_id = ${userId}
    ORDER BY completed ASC, created_at DESC
  `
  return c.json({ tasks: rows })
})

studyplan.post('/tasks', async (c) => {
  const userId = c.get('dbUserId')
  const body = await c.req.json<{ text: string; subject?: string }>()
  if (!body.text?.trim()) return c.json({ error: 'text required' }, 400)
  const [row] = await sql`
    INSERT INTO plan_tasks (user_id, text, subject)
    VALUES (${userId}, ${body.text.trim()}, ${body.subject?.trim() || null})
    RETURNING id, text, subject, completed, created_at
  `
  return c.json({ task: row }, 201)
})

studyplan.patch('/tasks/:id', async (c) => {
  const userId = c.get('dbUserId')
  const id = c.req.param('id')
  const body = await c.req.json<{ completed: boolean }>()
  if (typeof body.completed !== 'boolean') return c.json({ error: 'completed must be boolean' }, 400)
  const [row] = await sql`
    UPDATE plan_tasks SET completed = ${body.completed}
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING id, text, subject, completed, created_at
  `
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json({ task: row })
})

studyplan.delete('/tasks/:id', async (c) => {
  const userId = c.get('dbUserId')
  const id = c.req.param('id')
  await sql`DELETE FROM plan_tasks WHERE id = ${id} AND user_id = ${userId}`
  return c.json({ success: true })
})

// ── Goals ──────────────────────────────────────────────────────────────────────

studyplan.get('/goals', async (c) => {
  const userId = c.get('dbUserId')
  const rows = await sql`
    SELECT id, subject, description, due_date, progress, created_at
    FROM plan_goals WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `
  return c.json({ goals: rows })
})

studyplan.post('/goals', async (c) => {
  const userId = c.get('dbUserId')
  const body = await c.req.json<{ subject: string; description: string; due_date?: string; progress?: number }>()
  if (!body.subject?.trim() || !body.description?.trim()) return c.json({ error: 'subject and description required' }, 400)
  const [row] = await sql`
    INSERT INTO plan_goals (user_id, subject, description, due_date, progress)
    VALUES (${userId}, ${body.subject.trim()}, ${body.description.trim()}, ${body.due_date || null}, ${body.progress ?? 0})
    RETURNING id, subject, description, due_date, progress, created_at
  `
  return c.json({ goal: row }, 201)
})

studyplan.patch('/goals/:id', async (c) => {
  const userId = c.get('dbUserId')
  const id = c.req.param('id')
  const body = await c.req.json<{ progress: number }>()
  if (typeof body.progress !== 'number') return c.json({ error: 'progress must be number' }, 400)
  const [row] = await sql`
    UPDATE plan_goals SET progress = ${Math.max(0, Math.min(100, body.progress))}
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING id, subject, description, due_date, progress, created_at
  `
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json({ goal: row })
})

studyplan.delete('/goals/:id', async (c) => {
  const userId = c.get('dbUserId')
  const id = c.req.param('id')
  await sql`DELETE FROM plan_goals WHERE id = ${id} AND user_id = ${userId}`
  return c.json({ success: true })
})

export default studyplan

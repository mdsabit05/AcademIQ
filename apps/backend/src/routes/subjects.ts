/**
 * Subjects routes (teacher + admin)
 *
 * POST   /subjects          — create subject (teacher/admin only)
 * GET    /subjects          — list subjects owned by user
 * GET    /subjects/:id      — get subject details
 * PATCH  /subjects/:id      — update subject
 * DELETE /subjects/:id      — delete subject
 */

import { Hono } from 'hono'
import sql from '../db/client.js'
import { requireOwnership } from '../middleware/rbac.js'
import { limitStr } from '../lib/validate.js'
import type { AuthEnv } from '../middleware/auth.js'

const subjects = new Hono<AuthEnv>()

subjects.post('/', async (c) => {
  const dbUserId = c.get('dbUserId')
  const body = await c.req.json<{
    name: string
    semester?: string
    description?: string
    metadata?: Record<string, unknown>
  }>()

  const name = limitStr(body.name, 200)
  if (!name) return c.json({ error: 'name is required' }, 400)

  const [subject] = await sql`
    INSERT INTO subjects (owner_id, name, semester, description, metadata)
    VALUES (
      ${dbUserId}, ${name},
      ${limitStr(body.semester, 100) || null}, ${limitStr(body.description, 1000) || null},
      ${JSON.stringify(body.metadata ?? {})}::jsonb
    )
    RETURNING *
  `
  return c.json({ subject }, 201)
})

subjects.get('/', async (c) => {
  const dbUserId = c.get('dbUserId')
  const rows = await sql`
    SELECT id, name, semester, description, created_at
    FROM subjects WHERE owner_id = ${dbUserId}
    ORDER BY created_at DESC
  `
  return c.json({ subjects: rows })
})

subjects.get('/:id', requireOwnership('subjects', 'id'), async (c) => {
  const [subject] = await sql`SELECT * FROM subjects WHERE id = ${c.req.param('id')}`
  if (!subject) return c.json({ error: 'Not found' }, 404)
  return c.json({ subject })
})

subjects.patch('/:id', requireOwnership('subjects', 'id'), async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<{
    name?: string
    semester?: string
    description?: string
  }>()

  await sql`
    UPDATE subjects
    SET
      name        = COALESCE(${body.name ? limitStr(body.name, 200) : null}, name),
      semester    = COALESCE(${body.semester ? limitStr(body.semester, 100) : null}, semester),
      description = COALESCE(${body.description ? limitStr(body.description, 1000) : null}, description)
    WHERE id = ${id}
  `
  const [subject] = await sql`SELECT * FROM subjects WHERE id = ${id}`
  return c.json({ subject })
})

subjects.delete('/:id', requireOwnership('subjects', 'id'), async (c) => {
  await sql`DELETE FROM subjects WHERE id = ${c.req.param('id')}`
  return c.json({ success: true })
})

export default subjects

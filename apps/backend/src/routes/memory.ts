/**
 * Memory routes — MAG student memory management.
 *
 * GET    /memory        — list user's memory entries
 * DELETE /memory/:id   — delete a specific memory entry
 * DELETE /memory       — clear all memory (with ?confirm=true)
 */

import { Hono } from 'hono'
import sql from '../db/client.js'
import type { AuthEnv } from '../middleware/auth.js'

const memory = new Hono<AuthEnv>()

memory.get('/', async (c) => {
  const dbUserId = c.get('dbUserId')
  const memoryType = c.req.query('type')

  const rows = memoryType
    ? await sql`
        SELECT id, memory_type, context_key, value, confidence, source, updated_at
        FROM student_memory
        WHERE user_id = ${dbUserId} AND memory_type = ${memoryType}
        ORDER BY updated_at DESC
      `
    : await sql`
        SELECT id, memory_type, context_key, value, confidence, source, updated_at
        FROM student_memory
        WHERE user_id = ${dbUserId}
        ORDER BY updated_at DESC
      `

  return c.json({ memory: rows })
})

memory.delete('/', async (c) => {
  const dbUserId = c.get('dbUserId')
  if (c.req.query('confirm') !== 'true') {
    return c.json({ error: 'Pass ?confirm=true to clear all memory' }, 400)
  }
  await sql`DELETE FROM student_memory WHERE user_id = ${dbUserId}`
  return c.json({ success: true })
})

memory.delete('/:id', async (c) => {
  const dbUserId = c.get('dbUserId')
  const id = c.req.param('id')

  const [row] = await sql`
    SELECT id FROM student_memory WHERE id = ${id} AND user_id = ${dbUserId}
  `
  if (!row) return c.json({ error: 'Not found' }, 404)

  await sql`DELETE FROM student_memory WHERE id = ${id}`
  return c.json({ success: true })
})

export default memory

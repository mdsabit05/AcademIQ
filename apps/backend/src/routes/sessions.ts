/**
 * Chat Sessions routes
 *
 * POST   /sessions           — create session (multi-book, mode)
 * GET    /sessions           — list user's sessions
 * GET    /sessions/:id       — get session + messages
 * DELETE /sessions/:id       — delete session
 */

import { Hono } from 'hono'
import sql from '../db/client.js'
import { requireOwnership } from '../middleware/rbac.js'
import { verifyBookAccess } from '../middleware/rbac.js'
import type { AuthEnv } from '../middleware/auth.js'

const sessions = new Hono<AuthEnv>()

// ── Create session ──────────────────────────────────────────────────────────

sessions.post('/', async (c) => {
  const dbUserId = c.get('dbUserId')
  const body = await c.req.json<{
    mode: 'learn' | 'ask' | 'general'
    bookIds: string[]
    topic?: string
  }>()

  if (!body.mode || !['learn', 'ask', 'general'].includes(body.mode)) {
    return c.json({ error: 'Invalid mode. Must be learn | ask | general' }, 400)
  }

  // Verify book access (ownership + READY status) — throws with status code on failure
  try {
    await verifyBookAccess(body.bookIds ?? [], dbUserId)
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 400
    return c.json({ error: (err as Error).message }, status as 400 | 403)
  }

  const [session] = await sql<[{ id: string }]>`
    INSERT INTO chat_sessions (owner_id, mode, topic)
    VALUES (${dbUserId}, ${body.mode}, ${body.topic ?? null})
    RETURNING id
  `

  // Link books to session
  if (body.bookIds.length > 0) {
    const rows = body.bookIds.map((bid) => ({ session_id: session.id, book_id: bid }))
    for (const row of rows) {
      await sql`
        INSERT INTO chat_session_books (session_id, book_id)
        VALUES (${row.session_id}, ${row.book_id})
        ON CONFLICT DO NOTHING
      `
    }
  }

  const [full] = await sql`SELECT * FROM chat_sessions WHERE id = ${session.id}`
  return c.json({ session: full }, 201)
})

// ── List sessions ───────────────────────────────────────────────────────────

sessions.get('/', async (c) => {
  const dbUserId = c.get('dbUserId')
  const mode = c.req.query('mode')

  const rows = mode
    ? await sql`
        SELECT id, mode, topic, created_at, updated_at
        FROM chat_sessions
        WHERE owner_id = ${dbUserId} AND mode = ${mode}
        ORDER BY updated_at DESC
        LIMIT 50
      `
    : await sql`
        SELECT id, mode, topic, created_at, updated_at
        FROM chat_sessions
        WHERE owner_id = ${dbUserId}
        ORDER BY updated_at DESC
        LIMIT 50
      `

  return c.json({ sessions: rows })
})

// ── Get session + messages ──────────────────────────────────────────────────

sessions.get('/:id', requireOwnership('chat_sessions', 'id'), async (c) => {
  const id = c.req.param('id')

  const [session] = await sql`
    SELECT s.*, array_agg(csb.book_id) FILTER (WHERE csb.book_id IS NOT NULL) AS book_ids
    FROM chat_sessions s
    LEFT JOIN chat_session_books csb ON csb.session_id = s.id
    WHERE s.id = ${id}
    GROUP BY s.id
  `
  if (!session) return c.json({ error: 'Not Found' }, 404)

  const messages = await sql`
    SELECT id, role, content, metadata, created_at
    FROM chat_messages
    WHERE session_id = ${id}
    ORDER BY created_at ASC
  `

  return c.json({ session, messages })
})

// ── Delete session ──────────────────────────────────────────────────────────

sessions.delete('/:id', requireOwnership('chat_sessions', 'id'), async (c) => {
  await sql`DELETE FROM chat_sessions WHERE id = ${c.req.param('id')}`
  return c.json({ success: true })
})

export default sessions

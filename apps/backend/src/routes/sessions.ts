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
import { limitStr, isEnum } from '../lib/validate.js'
import { generateSessionTitle } from '../services/ai.service.js'
import type { AuthEnv } from '../middleware/auth.js'

const VALID_MODES = ['learn', 'ask', 'general'] as const

const sessions = new Hono<AuthEnv>()

// ── Create session ──────────────────────────────────────────────────────────

sessions.post('/', async (c) => {
  const dbUserId = c.get('dbUserId')
  const body = await c.req.json<{
    mode: 'learn' | 'ask' | 'general'
    bookIds: string[]
    topic?: string
    title?: string
  }>()

  if (!isEnum(body.mode, VALID_MODES)) {
    return c.json({ error: 'Invalid mode. Must be learn | ask | general' }, 400)
  }

  // 'general' mode doesn't require books — skip verification
  if (body.mode !== 'general') {
    try {
      await verifyBookAccess(body.bookIds ?? [], dbUserId, 'student')
    } catch (err: unknown) {
      const status = (err as { status?: number }).status ?? 400
      return c.json({ error: (err as Error).message }, status as 400 | 403)
    }
  }

  const topic = body.topic ? limitStr(body.topic, 500) : null
  const title = body.title ? limitStr(body.title.trim(), 100) : null

  const [session] = await sql<[{ id: string }]>`
    INSERT INTO chat_sessions (owner_id, mode, topic, title)
    VALUES (${dbUserId}, ${body.mode}, ${topic}, ${title})
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
  const rawMode = c.req.query('mode')
  const mode = isEnum(rawMode, VALID_MODES) ? rawMode : undefined

  const rows = await sql`
    SELECT
      s.id, s.mode, s.topic, s.title, s.created_at, s.updated_at,
      COALESCE(
        array_agg(csb.book_id) FILTER (WHERE csb.book_id IS NOT NULL),
        '{}'
      ) AS book_ids,
      COALESCE(
        array_agg(b.title) FILTER (WHERE b.title IS NOT NULL),
        '{}'
      ) AS book_titles
    FROM chat_sessions s
    LEFT JOIN chat_session_books csb ON csb.session_id = s.id
    LEFT JOIN books b ON b.id = csb.book_id
    WHERE s.owner_id = ${dbUserId}
      ${mode ? sql`AND s.mode = ${mode}` : sql``}
    GROUP BY s.id
    ORDER BY s.updated_at DESC
    LIMIT 100
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

// ── Update session (rename title) ───────────────────────────────────────────

sessions.patch('/:id', requireOwnership('chat_sessions', 'id'), async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<{ title?: string }>()
  const title = body.title ? limitStr(body.title.trim(), 100) : null
  if (!title) return c.json({ error: 'Title is required' }, 400)

  const [session] = await sql`
    UPDATE chat_sessions
    SET title = ${title}, updated_at = now()
    WHERE id = ${id}
    RETURNING id, mode, topic, title, created_at, updated_at
  `
  if (!session) return c.json({ error: 'Not Found' }, 404)
  return c.json({ session })
})

// ── Auto-generate session title from messages ──────────────────────────────

sessions.post('/:id/autotitle', requireOwnership('chat_sessions', 'id'), async (c) => {
  const id = c.req.param('id')

  const messages = await sql<Array<{ content: string }>>`
    SELECT content FROM chat_messages
    WHERE session_id = ${id} AND role = 'user' AND NOT content LIKE '[CONTEXT%'
    ORDER BY created_at ASC
    LIMIT 1
  `
  const firstUserMsg = messages[0]?.content
  if (!firstUserMsg) {
    return c.json({ error: 'No user messages to generate title from' }, 400)
  }

  const generatedTitle = await generateSessionTitle(firstUserMsg)
  const [session] = await sql`
    UPDATE chat_sessions
    SET title = ${generatedTitle}, updated_at = now()
    WHERE id = ${id}
    RETURNING id, mode, topic, title, created_at, updated_at
  `
  return c.json({ session })
})

// ── Delete session ──────────────────────────────────────────────────────────

sessions.delete('/:id', requireOwnership('chat_sessions', 'id'), async (c) => {
  await sql`DELETE FROM chat_sessions WHERE id = ${c.req.param('id')}`
  return c.json({ success: true })
})

export default sessions

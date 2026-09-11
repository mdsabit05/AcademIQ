/**
 * Settings routes — user profile and learning preferences.
 * No API key management (OpenRouter key is server-side only via env vars).
 *
 * GET   /settings        — get current user's profile + prefs
 * PATCH /settings        — update profile fields + learning_prefs
 */

import { Hono } from 'hono'
import sql from '../db/client.js'
import type { AuthEnv } from '../middleware/auth.js'
import type { LearningPrefs } from 'shared'

const settings = new Hono<AuthEnv>()

settings.get('/', async (c) => {
  const dbUserId = c.get('dbUserId')

  const [user] = await sql`
    SELECT id, email, name, role, institution, course, semester,
           status, learning_prefs, created_at, updated_at
    FROM users WHERE id = ${dbUserId}
  `
  if (!user) return c.json({ error: 'User not found' }, 404)

  return c.json({ user })
})

settings.patch('/', async (c) => {
  const dbUserId = c.get('dbUserId')
  const body = await c.req.json<{
    name?: string
    institution?: string
    course?: string
    semester?: string
    learning_prefs?: Partial<LearningPrefs>
  }>()

  // Merge learning_prefs — don't overwrite the whole object
  if (body.learning_prefs) {
    await sql`
      UPDATE users
      SET
        name           = COALESCE(${body.name ?? null}, name),
        institution    = COALESCE(${body.institution ?? null}, institution),
        course         = COALESCE(${body.course ?? null}, course),
        semester       = COALESCE(${body.semester ?? null}, semester),
        learning_prefs = learning_prefs || ${JSON.stringify(body.learning_prefs)}::jsonb,
        updated_at     = now()
      WHERE id = ${dbUserId}
    `
  } else {
    await sql`
      UPDATE users
      SET
        name        = COALESCE(${body.name ?? null}, name),
        institution = COALESCE(${body.institution ?? null}, institution),
        course      = COALESCE(${body.course ?? null}, course),
        semester    = COALESCE(${body.semester ?? null}, semester),
        updated_at  = now()
      WHERE id = ${dbUserId}
    `
  }

  const [user] = await sql`
    SELECT id, email, name, role, institution, course, semester,
           status, learning_prefs, updated_at
    FROM users WHERE id = ${dbUserId}
  `
  return c.json({ user })
})

export default settings

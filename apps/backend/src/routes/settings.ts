/**
 * Settings routes — user profile and learning preferences.
 * No API key management (OpenRouter key is server-side only via env vars).
 *
 * GET   /settings        — get current user's profile + prefs
 * PATCH /settings        — update profile fields + learning_prefs
 */

import { Hono } from 'hono'
import sql from '../db/client.js'
import { limitStr, filterKeys } from '../lib/validate.js'
import type { AuthEnv } from '../middleware/auth.js'
import type { LearningPrefs } from 'shared'

// Only allow known keys — reject arbitrary JSON blobs that could contain injected data.
const LEARNING_PREFS_KEYS = [
  'preferredDifficulty',
  'studyGoalMinutesPerDay',
  'notificationsEnabled',
  'theme',
  'language',
] as const

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

  const name        = body.name        ? limitStr(body.name, 200)        : null
  const institution = body.institution ? limitStr(body.institution, 200)  : null
  const course      = body.course      ? limitStr(body.course, 200)       : null
  const semester    = body.semester    ? limitStr(body.semester, 50)      : null

  // Merge learning_prefs — strip unknown keys before writing to the DB.
  if (body.learning_prefs && typeof body.learning_prefs === 'object') {
    const safePrefs = filterKeys(
      body.learning_prefs as Record<string, unknown>,
      LEARNING_PREFS_KEYS,
    )
    await sql`
      UPDATE users
      SET
        name           = COALESCE(${name}, name),
        institution    = COALESCE(${institution}, institution),
        course         = COALESCE(${course}, course),
        semester       = COALESCE(${semester}, semester),
        learning_prefs = learning_prefs || ${JSON.stringify(safePrefs)}::jsonb,
        updated_at     = now()
      WHERE id = ${dbUserId}
    `
  } else {
    await sql`
      UPDATE users
      SET
        name        = COALESCE(${name}, name),
        institution = COALESCE(${institution}, institution),
        course      = COALESCE(${course}, course),
        semester    = COALESCE(${semester}, semester),
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

/**
 * Authentication middleware — Clerk JWT verification.
 * Adds clerkUserId, dbUserId, userRole, and userPrefs to Hono context.
 * No password authentication — Clerk handles all auth.
 */

import { createMiddleware } from 'hono/factory'
import { verifyToken } from '@clerk/backend'
import sql from '../db/client.js'

export type Role = 'student' | 'teacher' | 'admin'

export type AuthEnv = {
  Variables: {
    clerkUserId: string
    dbUserId: string
    userRole: Role
    userPrefs: Record<string, unknown>
  }
}

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = authHeader.replace('Bearer ', '')

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    })
    const clerkUserId = payload.sub

    // Upsert user on first request; return role and prefs on subsequent requests.
    // ON CONFLICT only updates clerk_id (no-op) to trigger RETURNING.
    const [user] = await sql<
      Array<{ id: string; role: Role; learning_prefs: Record<string, unknown> }>
    >`
      INSERT INTO users (clerk_id, email, name, role)
      VALUES (${clerkUserId}, '', '', 'student')
      ON CONFLICT (clerk_id) DO UPDATE
        SET clerk_id = EXCLUDED.clerk_id
      RETURNING id, role, learning_prefs
    `

    c.set('clerkUserId', clerkUserId)
    c.set('dbUserId', user.id)
    c.set('userRole', user.role)
    c.set('userPrefs', user.learning_prefs ?? {})

    await next()
  } catch (err) {
    console.error('[auth] token verification failed:', err)
    return c.json({ error: 'Unauthorized' }, 401)
  }
})

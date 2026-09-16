/**
 * Authentication middleware — Clerk JWT verification.
 * Adds clerkUserId, dbUserId, userRole, and userPrefs to Hono context.
 * No password authentication — Clerk handles all auth.
 */

import { createMiddleware } from 'hono/factory'
import { verifyToken, createClerkClient } from '@clerk/backend'
import sql from '../db/client.js'

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! })

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

    // Fetch email + name from Clerk (needed for admin detection and display)
    let email = ''
    let name = ''
    try {
      const clerkUser = await clerkClient.users.getUser(clerkUserId)
      email = clerkUser.emailAddresses[0]?.emailAddress ?? ''
      name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ')
    } catch {
      // Non-fatal — continue with empty email
    }

    // Auto-promote to admin if email matches ADMIN_EMAIL env var
    const adminEmails = (process.env.ADMIN_EMAIL ?? '').toLowerCase().split(',').map((e) => e.trim()).filter(Boolean)
    const isAdminEmail = email && adminEmails.includes(email.toLowerCase())

    // Upsert user; always sync email/name from Clerk.
    // If user qualifies for admin and isn't already, promote them.
    const [user] = await sql<
      Array<{ id: string; role: Role; learning_prefs: Record<string, unknown> }>
    >`
      INSERT INTO users (clerk_id, email, name, role)
      VALUES (
        ${clerkUserId},
        ${email},
        ${name},
        ${isAdminEmail ? 'admin' : 'student'}
      )
      ON CONFLICT (clerk_id) DO UPDATE
        SET
          email = EXCLUDED.email,
          name  = CASE WHEN users.name = '' OR users.name IS NULL THEN EXCLUDED.name ELSE users.name END,
          role  = CASE WHEN ${isAdminEmail}::boolean AND users.role != 'admin' THEN 'admin' ELSE users.role END
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

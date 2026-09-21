/**
 * Authentication middleware — Clerk JWT verification.
 * Adds clerkUserId, dbUserId, userRole, and userPrefs to Hono context.
 * No password authentication — Clerk handles all auth.
 *
 * Security invariants:
 *  - Token verification errors are logged WITHOUT the token or raw error
 *    body to avoid leaking JWT fragments into log aggregators.
 *  - Admin promotion is audit-logged so role escalations are traceable.
 *  - CLERK_SECRET_KEY absence is caught at import time, not per-request.
 */

import { createMiddleware } from 'hono/factory'
import { verifyToken, createClerkClient } from '@clerk/backend'
import sql from '../db/client.js'

if (!process.env.CLERK_SECRET_KEY) {
  console.error('[auth] FATAL: CLERK_SECRET_KEY is not set — all requests will be rejected')
}

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

    // Admin detection: match against comma-separated ADMIN_EMAIL env var.
    // Uses Clerk's verified email — users cannot self-assign admin.
    const adminEmails = (process.env.ADMIN_EMAIL ?? '')
      .toLowerCase().split(',').map((e) => e.trim()).filter(Boolean)
    const isAdminEmail = Boolean(email && adminEmails.includes(email.toLowerCase()))

    // Upsert user; always sync email/name from Clerk.
    // Role escalation to admin is only applied when the email matches — never downgraded here.
    const [user] = await sql<
      Array<{ id: string; role: Role; learning_prefs: Record<string, unknown>; was_promoted: boolean }>
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
      RETURNING
        id,
        role,
        learning_prefs,
        -- Flag promotion so we can audit-log it without a second query
        (xmax = 0 OR (${isAdminEmail}::boolean AND role = 'admin')) AS was_promoted
    `

    // Audit log: record whenever a user is auto-promoted to admin
    if (user.was_promoted && user.role === 'admin') {
      console.warn(`[auth] admin promotion: clerk_id=${clerkUserId} db_id=${user.id} email=${email}`)
    }

    c.set('clerkUserId', clerkUserId)
    c.set('dbUserId', user.id)
    c.set('userRole', user.role)
    c.set('userPrefs', user.learning_prefs ?? {})

    await next()
  } catch (err) {
    // Log only the error type/message — never the raw error object which may
    // contain JWT fragments or internal stack details.
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[auth] token rejected: ${message}`)
    return c.json({ error: 'Unauthorized' }, 401)
  }
})

/**
 * RBAC middleware — role-based access control and ownership enforcement.
 * All authorization is enforced server-side. Frontend role-hiding is secondary UX only.
 */

import { createMiddleware } from 'hono/factory'
import type { AuthEnv, Role } from './auth.js'
import sql from '../db/client.js'

/**
 * Require one of the specified roles.
 * Returns 403 if the authenticated user's role is not in the list.
 *
 * Example: requireRole('teacher', 'admin')
 */
export function requireRole(...roles: Role[]) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const userRole = c.get('userRole')
    if (!roles.includes(userRole)) {
      return c.json({ error: 'Forbidden' }, 403)
    }
    await next()
  })
}

// Maps table name → the column that identifies the owner.
// Allowlist prevents arbitrary table access.
const TABLE_OWNER_COLUMN: Record<string, string> = {
  books: 'owner_id',
  subjects: 'owner_id',
  syllabi: 'owner_id',
  chat_sessions: 'owner_id',
  tests: 'owner_id',
  test_attempts: 'user_id',
  student_memory: 'user_id',
  study_sessions: 'user_id',
  paper_blueprints: 'teacher_id',
  question_papers: 'teacher_id',
}

// Tables where admin bypasses the ownership check (admin manages any record)
const ADMIN_BYPASS_TABLES = new Set(['subjects', 'paper_blueprints', 'question_papers'])

/**
 * Require that the resource identified by req.param(paramName) belongs to the
 * authenticated user, checked against the appropriate owner column for that table.
 *
 * Admins bypass ownership for subjects and teacher paper resources.
 *
 * Returns 404 if the resource does not exist.
 * Returns 403 if it exists but belongs to a different user.
 *
 * Example: requireOwnership('books', 'id')
 */
export function requireOwnership(table: string, paramName: string) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const dbUserId = c.get('dbUserId')
    const userRole = c.get('userRole')
    const resourceId = c.req.param(paramName)

    if (!resourceId) {
      return c.json({ error: 'Bad Request: missing resource id' }, 400)
    }

    const ownerColumn = TABLE_OWNER_COLUMN[table]
    if (!ownerColumn) {
      console.error(`[rbac] requireOwnership: unregistered table "${table}"`)
      return c.json({ error: 'Internal Server Error' }, 500)
    }

    // Admin bypass for designated tables
    if (userRole === 'admin' && ADMIN_BYPASS_TABLES.has(table)) {
      await next()
      return
    }

    // Check existence + ownership in one query
    const rows = await sql`
      SELECT id FROM ${sql(table)}
      WHERE id = ${resourceId}
        AND ${sql(ownerColumn)} = ${dbUserId}
    `

    if (rows.length === 0) {
      // Distinguish 404 vs 403
      const exists = await sql`
        SELECT id FROM ${sql(table)} WHERE id = ${resourceId}
      `
      if (exists.length === 0) return c.json({ error: 'Not Found' }, 404)
      return c.json({ error: 'Forbidden' }, 403)
    }

    await next()
  })
}

/**
 * Verify that the authenticated user owns (or is authorized to use) every
 * book in the provided list. Throws a structured error if any book is
 * inaccessible — never trust UUIDs from the frontend.
 *
 * Usage: await verifyBookAccess(bookIds, dbUserId)
 */
export async function verifyBookAccess(
  bookIds: string[],
  dbUserId: string,
  context?: 'student' | 'teacher',
): Promise<void> {
  if (bookIds.length === 0) {
    throw Object.assign(new Error('No books selected'), { status: 400 })
  }

  const owned = context
    ? await sql<Array<{ id: string }>>`
        SELECT id FROM books
        WHERE id = ANY(${bookIds}::uuid[])
          AND owner_id = ${dbUserId}
          AND status = 'READY'
          AND (
            context = ${context}
            OR (${context} = 'student' AND context IS NULL)
          )
      `
    : await sql<Array<{ id: string }>>`
        SELECT id FROM books
        WHERE id = ANY(${bookIds}::uuid[])
          AND owner_id = ${dbUserId}
          AND status = 'READY'
      `

  if (owned.length !== bookIds.length) {
    throw Object.assign(
      new Error('One or more books are not accessible or not ready'),
      { status: 403 },
    )
  }
}

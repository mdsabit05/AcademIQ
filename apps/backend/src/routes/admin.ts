/**
 * Admin routes — user management and platform oversight.
 * All routes require 'admin' role.
 *
 * GET    /admin/users              — list all users (paginated)
 * GET    /admin/users/:id         — get user details
 * PATCH  /admin/users/:id/role    — update user role
 * PATCH  /admin/users/:id/status  — suspend / activate user
 * GET    /admin/stats             — platform statistics
 */

import { Hono } from 'hono'
import sql from '../db/client.js'
import { requireRole } from '../middleware/rbac.js'
import { safeOffset, limitStr } from '../lib/validate.js'
import type { AuthEnv } from '../middleware/auth.js'

const admin = new Hono<AuthEnv>()

admin.use('*', requireRole('admin'))

admin.get('/users', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 200)
  const offset = safeOffset(c.req.query('offset'))
  const rawSearch = c.req.query('search')
  const search = rawSearch ? limitStr(rawSearch, 200) : undefined

  const rows = search
    ? await sql`
        SELECT id, clerk_id, email, name, role, institution, status, created_at
        FROM users
        WHERE email ILIKE ${'%' + search + '%'} OR name ILIKE ${'%' + search + '%'}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    : await sql`
        SELECT id, clerk_id, email, name, role, institution, status, created_at
        FROM users
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `

  const [{ total }] = await sql<[{ total: number }]>`SELECT COUNT(*)::int AS total FROM users`
  return c.json({ users: rows, total })
})

admin.get('/users/:id', async (c) => {
  const [user] = await sql`
    SELECT id, clerk_id, email, name, role, institution, course, semester,
           status, learning_prefs, created_at, updated_at
    FROM users WHERE id = ${c.req.param('id')}
  `
  if (!user) return c.json({ error: 'Not found' }, 404)
  return c.json({ user })
})

admin.patch('/users/:id/role', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<{ role: string }>()

  if (!['student', 'teacher', 'admin'].includes(body.role)) {
    return c.json({ error: 'Invalid role. Must be student | teacher | admin' }, 400)
  }

  await sql`UPDATE users SET role = ${body.role}, updated_at = now() WHERE id = ${id}`
  const [user] = await sql`SELECT id, email, name, role, status FROM users WHERE id = ${id}`
  if (!user) return c.json({ error: 'Not found' }, 404)
  return c.json({ user })
})

admin.patch('/users/:id/status', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<{ status: string }>()

  if (!['active', 'suspended'].includes(body.status)) {
    return c.json({ error: 'Invalid status. Must be active | suspended' }, 400)
  }

  await sql`UPDATE users SET status = ${body.status}, updated_at = now() WHERE id = ${id}`
  const [user] = await sql`SELECT id, email, name, role, status FROM users WHERE id = ${id}`
  if (!user) return c.json({ error: 'Not found' }, 404)
  return c.json({ user })
})

admin.get('/stats', async (c) => {
  const [userStats] = await sql<[{
    total_users: number
    total_students: number
    total_teachers: number
    total_admins: number
  }]>`
    SELECT
      COUNT(*)::int                                        AS total_users,
      COUNT(*) FILTER (WHERE role = 'student')::int        AS total_students,
      COUNT(*) FILTER (WHERE role = 'teacher')::int        AS total_teachers,
      COUNT(*) FILTER (WHERE role = 'admin')::int          AS total_admins
    FROM users
  `

  const [contentStats] = await sql<[{
    total_books: number
    total_tests: number
    total_attempts: number
    total_papers: number
  }]>`
    SELECT
      (SELECT COUNT(*)::int FROM books)           AS total_books,
      (SELECT COUNT(*)::int FROM tests)           AS total_tests,
      (SELECT COUNT(*)::int FROM test_attempts)   AS total_attempts,
      (SELECT COUNT(*)::int FROM question_papers) AS total_papers
  `

  return c.json({ users: userStats, content: contentStats })
})

admin.delete('/users/:id', async (c) => {
  const id = c.req.param('id')
  const adminId = c.get('dbUserId')
  if (id === adminId) return c.json({ error: 'Cannot delete your own account' }, 400)
  await sql`DELETE FROM users WHERE id = ${id}`
  return c.json({ success: true })
})

export default admin

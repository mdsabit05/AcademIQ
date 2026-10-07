import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { logger as log } from './lib/logger.js'
import { securityHeaders } from './middleware/security-headers.js'
import { requestLogger } from './middleware/request-logger.js'
import { authMiddleware } from './middleware/auth.js'
import { rateLimit, userKey } from './middleware/rate-limit.js'
import { botGuard } from './middleware/abuse-protection.js'

// ── Startup secret validation ─────────────────────────────────────────────────
// CLERK_SECRET_KEY is required — without it every request will be rejected.
if (!process.env.CLERK_SECRET_KEY) {
  log.error('CLERK_SECRET_KEY is not set', { module: 'startup' })
  process.exit(1)
}
// CLERK_WEBHOOK_SECRET is optional — only needed if Clerk webhooks are configured.
if (!process.env.CLERK_WEBHOOK_SECRET) {
  log.warn('CLERK_WEBHOOK_SECRET is not set — webhook endpoint will return 503', { module: 'startup' })
}

// Unauthenticated
import webhooksRoute from './routes/webhooks.js'

// Authenticated
import booksRoute from './routes/books.js'
import sessionsRoute from './routes/sessions.js'
import chatRoute from './routes/chat.js'
import testsRoute from './routes/tests.js'
import progressRoute from './routes/progress.js'
import memoryRoute from './routes/memory.js'
import settingsRoute from './routes/settings.js'
import subjectsRoute from './routes/subjects.js'
import syllabusRoute from './routes/syllabus.js'
import papersRoute from './routes/papers.js'
import adminRoute from './routes/admin.js'
import agentRoute from './routes/agent.js'
import studyplanRoute from './routes/studyplan.js'
import { startWorker, stopWorker } from './jobs/worker.js'
import { terminateOcr } from './services/ocr.service.js'

const app = new Hono()

// ── Global middleware (applied to every request) ──────────────────────────────

// 1. Security headers on every response.
app.use('*', securityHeaders)

// 2. Structured request logging (replaces Hono's default text logger).
app.use('*', requestLogger)

// 3. CORS — restrict to configured frontend origin(s).
app.use(
  '*',
  cors({
    origin: (process.env.FRONTEND_URL ?? 'http://localhost:5173').split(','),
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  }),
)

// ── Health check (unauthenticated, no rate limit, excluded from request log) ──
app.get('/health', (c) => c.json({ status: 'ok' }))

// ── Unauthenticated routes ────────────────────────────────────────────────────
app.route('/api/webhooks', webhooksRoute)

// ── Authenticated routes ──────────────────────────────────────────────────────
const api = new Hono()

// Layer 1 — IP-based limit (pre-auth): 600 req / min.
// Stops scanners and floods before any crypto work is done.
api.use('*', rateLimit({ windowMs: 60_000, max: 600, label: 'api-ip' }))

// Layer 2 — Authentication.
api.use('*', authMiddleware)

// Layer 3 — Per-user limit (post-auth): 500 req / min.
// Prevents a single compromised account from abusing the platform
// even if they rotate IPs to get past layer 1.
api.use('*', rateLimit({ windowMs: 60_000, max: 500, keyFn: userKey, label: 'api-user' }))

api.route('/books',     booksRoute)
api.route('/sessions',  sessionsRoute)
api.route('/chat',      chatRoute)
api.route('/tests',     testsRoute)
api.route('/progress',  progressRoute)
api.route('/memory',    memoryRoute)
api.route('/settings',  settingsRoute)
api.route('/subjects',  subjectsRoute)
api.route('/syllabus',  syllabusRoute)
api.route('/papers',    papersRoute)
api.route('/admin',     adminRoute)
api.route('/agent',     agentRoute)
api.route('/studyplan', studyplanRoute)

app.route('/api', api)

// ── Global error handler ──────────────────────────────────────────────────────
app.onError((err, c) => {
  log.error('unhandled error', {
    error: err.message,
    path: c.req.path,
    method: c.req.method,
    ip: c.req.header('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown',
  })
  return c.json({ error: 'Internal server error' }, 500)
})

// ── Server startup ────────────────────────────────────────────────────────────
const port = Number(process.env.PORT ?? 2001)

async function main() {
  await startWorker()
  log.info('backend started', { port, env: process.env.NODE_ENV ?? 'development' })
  serve({ fetch: app.fetch, port, hostname: '0.0.0.0', overrideGlobalObjects: false })
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal: string) {
  log.info('shutting down', { signal })
  await stopWorker()
  await terminateOcr()
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))

// Catch any unhandled promise rejections so they appear in structured logs.
process.on('unhandledRejection', (reason) => {
  log.error('unhandled promise rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
  })
})

main().catch((err) => {
  log.error('startup failed', { error: (err as Error).message })
  process.exit(1)
})

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

import { authMiddleware } from './middleware/auth.js'
import { rateLimit } from './middleware/rate-limit.js'

// ── Startup secret validation ─────────────────────────────────────────────────
const REQUIRED_SECRETS = ['CLERK_SECRET_KEY', 'CLERK_WEBHOOK_SECRET'] as const
for (const key of REQUIRED_SECRETS) {
  if (!process.env[key]) {
    console.error(`[startup] FATAL: required secret "${key}" is not set`)
    process.exit(1)
  }
}
import { startWorker, stopWorker } from './jobs/worker.js'
import { terminateOcr } from './services/ocr.service.js'

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

const app = new Hono()

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: (process.env.FRONTEND_URL ?? 'http://localhost:5173').split(','),
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  }),
)

app.get('/health', (c) => c.json({ status: 'ok' }))

// ── Unauthenticated routes ──────────────────────────────────────────────────
app.route('/api/webhooks', webhooksRoute)

// ── Authenticated routes ────────────────────────────────────────────────────
const api = new Hono()

// General API rate limit: 300 req / 1 min per IP.
// Authenticated users doing normal work will never hit this.
// Protects against token stuffing and automated scraping.
api.use('*', rateLimit({ windowMs: 60 * 1000, max: 300 }))
api.use('*', authMiddleware)

api.route('/books', booksRoute)
api.route('/sessions', sessionsRoute)
api.route('/chat', chatRoute)
api.route('/tests', testsRoute)
api.route('/progress', progressRoute)
api.route('/memory', memoryRoute)
api.route('/settings', settingsRoute)
api.route('/subjects', subjectsRoute)
api.route('/syllabus', syllabusRoute)
api.route('/papers', papersRoute)
api.route('/admin', adminRoute)
api.route('/agent', agentRoute)
api.route('/studyplan', studyplanRoute)

app.route('/api', api)

// ── Server startup ──────────────────────────────────────────────────────────
const port = Number(process.env.PORT ?? 2001)

async function main() {
  await startWorker()
  console.log(`Backend running on http://localhost:${port}`)
  serve({ fetch: app.fetch, port, hostname: '0.0.0.0', overrideGlobalObjects: false })
}

// ── Graceful shutdown ───────────────────────────────────────────────────────
async function shutdown(signal: string) {
  console.log(`[shutdown] received ${signal}`)
  await stopWorker()
  await terminateOcr()
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

main().catch((err) => {
  console.error('[startup] fatal error:', err)
  process.exit(1)
})

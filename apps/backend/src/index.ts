import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

import { authMiddleware } from './middleware/auth.js'
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
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
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
  serve({ fetch: app.fetch, port, hostname: '0.0.0.0' })
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

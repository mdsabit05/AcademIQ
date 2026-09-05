import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

import webhooksRoute from './routes/webhooks.js'
import documentsRoute from './routes/documents.js'
import learnRoute from './routes/learn.js'
import askRoute from './routes/ask.js'
import testRoute from './routes/test.js'
import progressRoute from './routes/progress.js'
import settingsRoute from './routes/settings.js'

const app = new Hono()

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  }),
)

app.get('/health', (c) => c.json({ status: 'ok' }))

app.route('/api/webhooks', webhooksRoute)
app.route('/api/documents', documentsRoute)
app.route('/api/learn', learnRoute)
app.route('/api/ask', askRoute)
app.route('/api/test', testRoute)
app.route('/api/progress', progressRoute)
app.route('/api/settings', settingsRoute)

const port = Number(process.env.PORT ?? 3001)
console.log(`Backend running on http://localhost:${port}`)

serve({ fetch: app.fetch, port })

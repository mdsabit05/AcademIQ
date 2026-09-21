import { Hono } from 'hono'
import { Webhook } from 'svix'
import sql from '../db/client.js'
import { rateLimit } from '../middleware/rate-limit.js'

if (!process.env.CLERK_WEBHOOK_SECRET) {
  console.error('[webhooks] FATAL: CLERK_WEBHOOK_SECRET is not set — webhook verification will fail')
}

const app = new Hono()

// Rate limit: Clerk itself sends at most a handful of events per minute.
// 60 requests / 5 min window per IP is generous for legitimate traffic
// but stops any brute-force or DoS attempt cold.
app.use('*', rateLimit({ windowMs: 5 * 60 * 1000, max: 60, message: 'Webhook rate limit exceeded' }))

app.post('/clerk', async (c) => {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET
  if (!webhookSecret) {
    // Misconfigured server — refuse rather than silently accept unsigned payloads
    return c.json({ error: 'Webhook not configured' }, 503)
  }

  const svixId        = c.req.header('svix-id')
  const svixTimestamp = c.req.header('svix-timestamp')
  const svixSignature = c.req.header('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return c.json({ error: 'Missing svix headers' }, 400)
  }

  const body = await c.req.text()

  try {
    const wh = new Webhook(webhookSecret)
    const evt = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as {
      type: string
      data: {
        id: string
        email_addresses: Array<{ email_address: string }>
        first_name?: string
        last_name?: string
      }
    }

    const { type, data } = evt

    if (type === 'user.created' || type === 'user.updated') {
      const email = data.email_addresses[0]?.email_address ?? ''
      const name  = [data.first_name, data.last_name].filter(Boolean).join(' ') || null

      await sql`
        INSERT INTO users (clerk_id, email, name)
        VALUES (${data.id}, ${email}, ${name})
        ON CONFLICT (clerk_id) DO UPDATE
          SET email = EXCLUDED.email,
              name  = EXCLUDED.name
      `
    }

    return c.json({ received: true })
  } catch {
    // Do NOT log the raw body or error — it may contain user PII
    console.warn('[webhooks] signature verification failed')
    return c.json({ error: 'Webhook verification failed' }, 400)
  }
})

export default app

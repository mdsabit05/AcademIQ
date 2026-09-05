import { Hono } from 'hono'
import { Webhook } from 'svix'
import sql from '../db/client.js'

const app = new Hono()

app.post('/clerk', async (c) => {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET!
  const svixId = c.req.header('svix-id')
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
    }) as { type: string; data: { id: string; email_addresses: Array<{ email_address: string }>; first_name?: string; last_name?: string } }

    const { type, data } = evt

    if (type === 'user.created' || type === 'user.updated') {
      const email = data.email_addresses[0]?.email_address ?? ''
      const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || null

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
    return c.json({ error: 'Webhook verification failed' }, 400)
  }
})

export default app

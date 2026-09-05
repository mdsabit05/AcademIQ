import { createMiddleware } from 'hono/factory'
import { createClerkClient } from '@clerk/backend'
import sql from '../db/client.js'

export type AuthEnv = {
  Variables: {
    clerkUserId: string
    dbUserId: string
    userSettings: { openrouterKey?: string; ollamaUrl?: string; defaultModel?: string }
  }
}

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = authHeader.replace('Bearer ', '')

  try {
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! })
    const payload = await clerk.verifyToken(token)
    const clerkUserId = payload.sub

    // Look up DB user, auto-create if missing (race-safe via ON CONFLICT)
    const [user] = await sql<Array<{ id: string; settings: Record<string, string> }>>`
      INSERT INTO users (clerk_id, email, name)
      VALUES (${clerkUserId}, '', '')
      ON CONFLICT (clerk_id) DO UPDATE SET clerk_id = EXCLUDED.clerk_id
      RETURNING id, settings
    `

    c.set('clerkUserId', clerkUserId)
    c.set('dbUserId', user.id)
    c.set('userSettings', user.settings ?? {})
    await next()
  } catch {
    return c.json({ error: 'Unauthorized' }, 401)
  }
})

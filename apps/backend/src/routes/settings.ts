import { Hono } from 'hono'
import { authMiddleware, type AuthEnv } from '../middleware/auth.js'
import sql from '../db/client.js'
import type { UserSettings } from 'shared'

const app = new Hono<AuthEnv>()
app.use('*', authMiddleware)

// GET /api/settings — return settings with key masked
app.get('/', async (c) => {
  const userId = c.get('dbUserId')
  const [user] = await sql<Array<{ settings: UserSettings }>>`
    SELECT settings FROM users WHERE id = ${userId}
  `

  const settings = user?.settings ?? {}
  // Mask the API key for display
  const masked = {
    ...settings,
    openrouterKey: settings.openrouterKey
      ? `sk-or-...${settings.openrouterKey.slice(-4)}`
      : undefined,
  }

  return c.json({ settings: masked })
})

// PUT /api/settings — update one or more fields
app.put('/', async (c) => {
  const userId = c.get('dbUserId')
  const body = await c.req.json<Partial<UserSettings>>()

  // Merge with existing settings
  await sql`
    UPDATE users
    SET settings = settings || ${JSON.stringify(body)}::jsonb
    WHERE id = ${userId}
  `

  return c.json({ updated: true })
})

export default app

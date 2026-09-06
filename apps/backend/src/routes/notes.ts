import { Hono } from 'hono'
import { authMiddleware, type AuthEnv } from '../middleware/auth.js'
import sql from '../db/client.js'
import type { Note, NoteWithTitle } from 'shared'

const app = new Hono<AuthEnv>()
app.use('*', authMiddleware)

app.post('/', async (c) => {
  const userId = c.get('dbUserId')
  const { documentId, topic, content } = await c.req.json<{
    documentId: string
    topic: string
    content: string
  }>()
  const [note] = await sql<Note[]>`
    INSERT INTO notes (user_id, document_id, topic, content)
    VALUES (${userId}, ${documentId}, ${topic}, ${content})
    RETURNING *
  `
  return c.json({ note }, 201)
})

app.get('/', async (c) => {
  const userId = c.get('dbUserId')
  const notes = await sql<NoteWithTitle[]>`
    SELECT n.*, d.title AS document_title
    FROM notes n
    JOIN documents d ON n.document_id = d.id
    WHERE n.user_id = ${userId}
    ORDER BY n.created_at DESC
  `
  return c.json({ notes })
})

app.delete('/:id', async (c) => {
  const userId = c.get('dbUserId')
  const id = c.req.param('id')
  await sql`DELETE FROM notes WHERE id = ${id} AND user_id = ${userId}`
  return c.json({ deleted: true })
})

export default app

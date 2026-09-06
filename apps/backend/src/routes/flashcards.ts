import { Hono } from 'hono'
import { retrieveChunks, buildContext } from '../services/rag.service.js'
import { completeJson } from '../services/openrouter.service.js'
import { flashcardPrompt } from '../prompts/flashcard.prompt.js'
import { authMiddleware, type AuthEnv } from '../middleware/auth.js'
import sql from '../db/client.js'
import type { Flashcard, GenerateFlashcardsRequest } from 'shared'

const app = new Hono<AuthEnv>()
app.use('*', authMiddleware)

app.post('/generate', async (c) => {
  const { documentId, topic, count } = await c.req.json<GenerateFlashcardsRequest>()
  const userId = c.get('dbUserId')
  const settings = c.get('userSettings')

  const apiKey = settings.openrouterKey ?? process.env.OPENROUTER_API_KEY!
  const ollamaUrl = settings.ollamaUrl ?? process.env.OLLAMA_URL ?? 'http://localhost:11434'
  const model = settings.defaultModel ?? 'google/gemini-3.5-flash'

  if (!apiKey) return c.json({ error: 'OpenRouter API key not configured' }, 400)

  const chunks = await retrieveChunks(topic, documentId, 8, ollamaUrl)
  const context = buildContext(chunks)
  const messages = flashcardPrompt(topic, context, count)

  const result = await completeJson<{ cards: Array<{ question: string; answer: string }> }>(
    messages, apiKey, model,
  )

  const cards: Flashcard[] = []
  for (const card of result.cards) {
    const [row] = await sql<Flashcard[]>`
      INSERT INTO flashcards (user_id, document_id, topic, question, answer)
      VALUES (${userId}, ${documentId}, ${topic}, ${card.question}, ${card.answer})
      RETURNING *
    `
    cards.push(row)
  }

  return c.json({ flashcards: cards }, 201)
})

app.get('/', async (c) => {
  const userId = c.get('dbUserId')
  const flashcards = await sql<Flashcard[]>`
    SELECT * FROM flashcards WHERE user_id = ${userId} ORDER BY created_at DESC
  `
  return c.json({ flashcards })
})

app.post('/:cardId/attempt', async (c) => {
  const userId = c.get('dbUserId')
  const cardId = c.req.param('cardId')
  const { known } = await c.req.json<{ known: boolean }>()

  if (known) {
    await sql`UPDATE flashcards SET pass_count = pass_count + 1 WHERE id = ${cardId} AND user_id = ${userId}`
  } else {
    await sql`UPDATE flashcards SET fail_count = fail_count + 1 WHERE id = ${cardId} AND user_id = ${userId}`
  }

  return c.json({ updated: true })
})

app.delete('/:cardId', async (c) => {
  const userId = c.get('dbUserId')
  const cardId = c.req.param('cardId')
  await sql`DELETE FROM flashcards WHERE id = ${cardId} AND user_id = ${userId}`
  return c.json({ deleted: true })
})

export default app

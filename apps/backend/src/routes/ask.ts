import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { retrieveChunks, buildContext } from '../services/rag.service.js'
import { streamCompletion } from '../services/openrouter.service.js'
import { askPrompt } from '../prompts/ask.prompt.js'
import { authMiddleware, type AuthEnv } from '../middleware/auth.js'
import sql from '../db/client.js'
import type { AskRequest } from 'shared'

const app = new Hono<AuthEnv>()
app.use('*', authMiddleware)

// POST /api/ask — conversational QA with streaming
app.post('/', async (c) => {
  const { documentId, message, history } = await c.req.json<AskRequest>()
  const userId = c.get('dbUserId')
  const settings = c.get('userSettings')

  const apiKey = settings.openrouterKey ?? process.env.OPENROUTER_API_KEY!
  const ollamaUrl = settings.ollamaUrl ?? process.env.OLLAMA_URL ?? 'http://localhost:11434'
  const model = settings.defaultModel ?? 'google/gemini-3.5-flash'

  if (!apiKey) return c.json({ error: 'OpenRouter API key not configured' }, 400)

  const chunks = await retrieveChunks(message, documentId, 5, ollamaUrl)
  const context = buildContext(chunks)
  const messages = askPrompt(message, context, history)

  // Save user message
  await sql`
    INSERT INTO chat_messages (user_id, document_id, role, content, mode)
    VALUES (${userId}, ${documentId}, 'user', ${message}, 'ask')
  `

  const llmStream = await streamCompletion(messages, apiKey, model)

  return streamSSE(c, async (sse) => {
    let fullResponse = ''
    const reader = llmStream.getReader()
    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value, { stream: true })
        const lines = text.split('\n').filter((l) => l.startsWith('data: '))

        for (const line of lines) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const token: string = parsed.choices?.[0]?.delta?.content ?? ''
            if (token) {
              fullResponse += token
              await sse.writeSSE({ data: JSON.stringify({ token }) })
            }
          } catch {}
        }
      }
    } finally {
      reader.releaseLock()
    }

    await sql`
      INSERT INTO chat_messages (user_id, document_id, role, content, mode)
      VALUES (${userId}, ${documentId}, 'assistant', ${fullResponse}, 'ask')
    `
  })
})

// GET /api/ask/:documentId/history
app.get('/:documentId/history', async (c) => {
  const userId = c.get('dbUserId')
  const documentId = c.req.param('documentId')

  const messages = await sql`
    SELECT id, role, content, mode, created_at
    FROM chat_messages
    WHERE user_id = ${userId} AND document_id = ${documentId}
    ORDER BY created_at ASC
  `

  return c.json({ messages })
})

export default app

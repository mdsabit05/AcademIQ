import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { retrieveChunks, buildContext } from '../services/rag.service.js'
import { streamCompletion } from '../services/openrouter.service.js'
import { learnPrompt } from '../prompts/learn.prompt.js'
import { authMiddleware, type AuthEnv } from '../middleware/auth.js'
import sql from '../db/client.js'
import type { LearnRequest } from 'shared'

const app = new Hono<AuthEnv>()
app.use('*', authMiddleware)

app.post('/', async (c) => {
  const { documentId, topic } = await c.req.json<LearnRequest>()
  const userId = c.get('dbUserId')
  const settings = c.get('userSettings')

  const apiKey = settings.openrouterKey ?? process.env.OPENROUTER_API_KEY!
  const ollamaUrl = settings.ollamaUrl ?? process.env.OLLAMA_URL ?? 'http://localhost:11434'
  const model = settings.defaultModel ?? 'google/gemini-3.5-flash'

  if (!apiKey) return c.json({ error: 'OpenRouter API key not configured' }, 400)

  // Retrieve relevant chunks
  const chunks = await retrieveChunks(topic, documentId, 5, ollamaUrl)
  const context = buildContext(chunks)
  const messages = learnPrompt(topic, context)

  // Save user message
  await sql`
    INSERT INTO chat_messages (user_id, document_id, role, content, mode)
    VALUES (${userId}, ${documentId}, 'user', ${`Teach me: ${topic}`}, 'learn')
  `

  // Stream LLM response
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
          } catch {
            // skip malformed SSE lines
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    // Save complete assistant response
    await sql`
      INSERT INTO chat_messages (user_id, document_id, role, content, mode)
      VALUES (${userId}, ${documentId}, 'assistant', ${fullResponse}, 'learn')
    `
  })
})

export default app

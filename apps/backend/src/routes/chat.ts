/**
 * Chat route — handles all session-based AI interactions (learn, ask, general).
 *
 * POST /chat/:sessionId/message
 *   - RAG retrieval → reranking → context building → MAG → prompt → SSE stream
 *   - Saves user message + assistant response to chat_messages
 *   - Triggers async memory extraction after response completes
 *
 * GET /chat/:sessionId/stream
 *   - SSE stream endpoint (returns event-stream content-type)
 */

import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import sql from '../db/client.js'
import { requireOwnership } from '../middleware/rbac.js'
import { rateLimit, userKey } from '../middleware/rate-limit.js'
import { botGuard } from '../middleware/abuse-protection.js'
import { retrieve } from '../services/retrieval.service.js'
import { rerank } from '../services/reranker.service.js'
import { buildContext } from '../services/context-builder.service.js'
import { readMemory, extractAndSave } from '../services/memory.service.js'
import { checkResponse } from '../services/guardrails.service.js'
import { stream as aiStream, parseSSEStream } from '../services/ai.service.js'
import { MODELS } from '../config/models.js'
import { learnSystemPrompt } from '../prompts/learn.prompt.js'
import { askSystemPrompt } from '../prompts/ask.prompt.js'
import { generalSystemPrompt } from '../prompts/general.prompt.js'
import type { AuthEnv } from '../middleware/auth.js'
import type { Message } from '../services/ai.service.js'

const chat = new Hono<AuthEnv>()

// ── POST message ────────────────────────────────────────────────────────────

chat.post(
  '/:sessionId/message',
  botGuard,
  // 20 AI messages per user per minute — prevents chat flooding / LLM cost abuse.
  rateLimit({ windowMs: 60_000, max: 20, keyFn: userKey, label: 'chat-message' }),
  requireOwnership('chat_sessions', 'sessionId'),
  async (c) => {
  const sessionId = c.req.param('sessionId')
  const dbUserId = c.get('dbUserId')

  const body = await c.req.json<{ content: string; webSearch?: boolean; deepReason?: boolean }>()
  const userContent = body.content?.trim()
  if (!userContent) return c.json({ error: 'Message content is required' }, 400)
  const webSearch = body.webSearch === true
  const deepReason = body.deepReason === true

  // Load session + book IDs + user learning prefs (language, explanation style)
  const [[session], [userRow]] = await Promise.all([
    sql<[{ mode: string; topic: string | null }?]>`
      SELECT s.mode, s.topic FROM chat_sessions s WHERE s.id = ${sessionId}
    `,
    sql<[{ learning_prefs: Record<string, unknown> }?]>`
      SELECT learning_prefs FROM users WHERE id = ${dbUserId}
    `,
  ])
  if (!session) return c.json({ error: 'Session not found' }, 404)

  const lp = (userRow?.learning_prefs ?? {}) as Record<string, unknown>
  const userPrefs = {
    explanationStyle: ['simple', 'balanced', 'detailed'].includes(lp.explanationStyle as string)
      ? (lp.explanationStyle as 'simple' | 'balanced' | 'detailed')
      : undefined,
  }

  const bookRows = await sql<Array<{ book_id: string }>>`
    SELECT book_id FROM chat_session_books WHERE session_id = ${sessionId}
  `
  const bookIds = bookRows.map((r) => r.book_id)

  // Load recent conversation history (last 10 messages)
  const history = await sql<Array<{ role: string; content: string }>>`
    SELECT role, content FROM chat_messages
    WHERE session_id = ${sessionId}
    ORDER BY created_at DESC
    LIMIT 10
  `
  const conversationHistory: Message[] = history
    .reverse()
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  // ── RAG pipeline ──────────────────────────────────────────────────────────
  const candidates = bookIds.length > 0
    ? await retrieve(userContent, bookIds, 20)
    : []
  const reranked = candidates.length > 0
    ? await rerank(userContent, candidates, 5)
    : []

  // ── MAG memory ────────────────────────────────────────────────────────────
  const memory = await readMemory(dbUserId, session.topic ?? undefined, 8)

  // ── Build context ─────────────────────────────────────────────────────────
  const { contextText, citations } = buildContext(reranked, memory)

  // ── Build system prompt (with user language + style prefs) ───────────────
  let systemContent: string
  if (session.mode === 'learn') {
    systemContent = learnSystemPrompt(contextText, session.topic ?? undefined, userPrefs)
  } else if (session.mode === 'ask') {
    systemContent = askSystemPrompt(contextText, userPrefs)
  } else {
    systemContent = generalSystemPrompt(contextText, userPrefs)
  }

  const messages: Message[] = [
    { role: 'system', content: systemContent },
    ...conversationHistory,
    { role: 'user', content: userContent },
  ]

  // ── Save user message ─────────────────────────────────────────────────────
  await sql`
    INSERT INTO chat_messages (session_id, role, content, metadata)
    VALUES (${sessionId}, 'user', ${userContent}, '{}')
  `

  // ── Auto-title: set from first user message if not already titled ─────────
  // Skip context-priming messages (test review sessions)
  if (conversationHistory.length === 0 && !userContent.startsWith('[CONTEXT')) {
    const autoTitle = userContent.slice(0, 55).replace(/\s+/g, ' ').trim()
    await sql`UPDATE chat_sessions SET title = ${autoTitle} WHERE id = ${sessionId} AND title IS NULL`
  }

  // ── Stream AI response ────────────────────────────────────────────────────
  // webSearch uses Perplexity's online model (built-in real-time web search via OpenRouter)
  // deepReason + webSearch: use web search model (it's already strong enough)
  const model = webSearch ? MODELS.webSearch : deepReason ? MODELS.strong : MODELS.default
  const rawStream = await aiStream(messages, model)

  let fullResponse = ''

  return streamSSE(c, async (sseStream) => {
    for await (const token of parseSSEStream(rawStream)) {
      fullResponse += token
      await sseStream.writeSSE({ data: JSON.stringify(token) })
    }

    // ── Guardrails (post-generation) ────────────────────────────────────────
    const guardrail = await checkResponse(fullResponse, contextText, userContent)
    if (!guardrail.passed) {
      console.warn('[chat] guardrail flags:', guardrail.flags, '— session:', sessionId)
      // Log but don't block — educational content rarely needs hard blocks
    }

    // ── Save assistant message ──────────────────────────────────────────────
    const metadata = {
      citations,
      model,
      guardrailFlags: guardrail.flags,
    }
    await sql`
      INSERT INTO chat_messages (session_id, role, content, metadata)
      VALUES (${sessionId}, 'assistant', ${fullResponse}, ${JSON.stringify(metadata)}::jsonb)
    `

    // ── Update session timestamp ────────────────────────────────────────────
    await sql`
      UPDATE chat_sessions SET updated_at = now() WHERE id = ${sessionId}
    `

    // ── Record study session for progress analytics ─────────────────────────
    sql`
      INSERT INTO study_sessions (user_id, session_id, topic, mode)
      VALUES (${dbUserId}, ${sessionId}, ${session.topic ?? null}, ${session.mode})
      ON CONFLICT DO NOTHING
    `.catch((err) => console.warn('[chat] study_sessions insert error:', err))

    // ── Async memory extraction (fire-and-forget within SSE close) ──────────
    const allMessages = [
      ...conversationHistory,
      { role: 'user', content: userContent },
      { role: 'assistant', content: fullResponse },
    ]
    extractAndSave(
      dbUserId,
      allMessages,
      session.mode === 'learn' ? 'learn' : session.mode === 'ask' ? 'ask' : 'learn',
    ).catch((err) => console.warn('[chat] memory extraction error:', err))

    await sseStream.writeSSE({ data: '[DONE]', event: 'done' })
  })
})

export default chat

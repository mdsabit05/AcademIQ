/**
 * Agent route
 *
 * POST /agent/message
 *   — Runs the agentic AI loop and streams the final response via SSE.
 *
 * Request body:
 *   {
 *     content:    string       // user message (required)
 *     bookIds?:   string[]     // pre-selected books (ownership verified here)
 *   }
 *
 * SSE events emitted:
 *   data: <text token>         // streamed response tokens (word/phrase chunks)
 *   event: agent-done          // metadata event (toolsUsed, iterations)
 *   event: done                // terminal event  data: [DONE]
 *   event: error               // error event     data: <message>
 *
 * Authentication: Clerk JWT via authMiddleware (applied in index.ts).
 * RBAC: all users can call this endpoint; tool-level role filtering is
 * enforced inside runAgentLoop → registry.toOpenAITools(role).
 */

import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { runAgentLoop } from '../agent/agent.service.js'
import { verifyBookAccess } from '../middleware/rbac.js'
import type { AuthEnv } from '../middleware/auth.js'

const agent = new Hono<AuthEnv>()

agent.post('/message', async (c) => {
  const dbUserId = c.get('dbUserId')
  const userRole = c.get('userRole')

  let body: { content?: string; bookIds?: string[] }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const userMessage = body.content?.trim() ?? ''
  if (!userMessage) {
    return c.json({ error: '"content" is required and must be a non-empty string' }, 400)
  }

  // Verify book access before entering the agent loop
  if (body.bookIds?.length) {
    try {
      await verifyBookAccess(body.bookIds, dbUserId)
    } catch (err: unknown) {
      const status = (err as { status?: number }).status ?? 400
      return c.json({ error: (err as Error).message }, status as 400 | 403)
    }
  }

  return streamSSE(c, async (sseStream) => {
    try {
      const result = await runAgentLoop({
        userMessage,
        dbUserId,
        userRole,
        bookIds: body.bookIds,
      })

      // Stream the final response in natural token chunks for a real-time feel.
      // match(/\S+\s*/g) splits into "word + optional trailing whitespace" segments,
      // matching how OpenRouter natively streams tokens.
      const tokens = result.finalResponse.match(/\S+\s*/g) ?? [result.finalResponse]
      for (const token of tokens) {
        await sseStream.writeSSE({ data: JSON.stringify(token) })
      }

      // Metadata event (tools used, iterations) — clients can use this for UI decoration
      await sseStream.writeSSE({
        event: 'agent-done',
        data: JSON.stringify({
          toolsUsed: result.toolsUsed,
          iterations: result.iterations,
          guardrailFlags: result.guardrailFlags,
        }),
      })

      await sseStream.writeSSE({ event: 'done', data: '[DONE]' })
    } catch (err: unknown) {
      console.error('[agent route] error:', err)
      const msg = (err as Error).message ?? 'Agent execution failed'
      await sseStream.writeSSE({ event: 'error', data: msg })
    }
  })
})

export default agent

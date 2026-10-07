/**
 * AI Service
 *   Chat completions → OpenRouter   (OPENROUTER_API_KEY)
 *   Embeddings       → OpenRouter   (OPENROUTER_API_KEY) — text-embedding-3-small, 1536 dims
 */

import { MODELS } from '../config/models.js'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

function openrouterHeaders(): Record<string, string> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('OPENROUTER_API_KEY is not set')
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://academiq.app',
    'X-Title': 'AcademIQ',
  }
}

export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Stream a chat completion.
 * Returns the raw ReadableStream for SSE passthrough.
 */
export async function stream(
  messages: Message[],
  model: string = MODELS.default,
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: openrouterHeaders(),
    body: JSON.stringify({ model, messages, stream: true, max_tokens: 4096 }),
  })

  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`Chat stream error ${res.status}: ${err}`)
  }

  return res.body
}

/**
 * Non-streaming chat completion.
 * Returns the full assistant message content as a string.
 */
export async function complete(
  messages: Message[],
  model: string = MODELS.default,
): Promise<string> {
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: openrouterHeaders(),
    body: JSON.stringify({ model, messages, stream: false, max_tokens: 4096 }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`Chat complete error ${res.status}: ${err}`)
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>
  }

  return data.choices[0]?.message?.content ?? ''
}

/**
 * JSON-typed chat completion.
 * Strips markdown code fences if present before parsing.
 */
export async function completeJson<T>(
  messages: Message[],
  model: string = MODELS.default,
): Promise<T> {
  const text = await complete(messages, model)
  const cleaned = text
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim()
  try {
    return JSON.parse(cleaned) as T
  } catch {
    throw new Error(`AI returned invalid JSON: ${cleaned.slice(0, 200)}`)
  }
}

/**
 * Embed a single text string.
 * Returns a 1536-dimensional vector via OpenRouter (text-embedding-3-small).
 */
export async function embed(text: string): Promise<number[]> {
  const results = await embedBatch([text])
  return results[0]
}

/**
 * Batch embed multiple texts via OpenRouter (text-embedding-3-small, 1536 dims).
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  const BATCH_SIZE = 100
  const results: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)

    const res = await fetch(`${OPENROUTER_BASE}/embeddings`, {
      method: 'POST',
      headers: openrouterHeaders(),
      body: JSON.stringify({ model: MODELS.embed, input: batch }),
    })

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText)
      throw new Error(`Embeddings error ${res.status}: ${err}`)
    }

    const data = (await res.json()) as {
      data: Array<{ embedding: number[]; index: number }>
    }

    const sorted = [...data.data].sort((a, b) => a.index - b.index)
    results.push(...sorted.map((d) => d.embedding))
  }

  return results
}

// ── Agentic / tool-calling types ─────────────────────────────────────────────

/** OpenAI-format tool call stored in the assistant message (arguments is a JSON string). */
export interface ApiToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

/**
 * Extended message type used by the agent loop.
 * Superset of the basic Message type — supports tool_calls and tool results.
 */
export type AgentMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ApiToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }

/** A tool call with the arguments already parsed from JSON. */
export interface ParsedToolCall {
  id: string
  name: string
  arguments: unknown
}

export type AgentCompletion =
  | { type: 'text'; content: string; rawMessage: AgentMessage }
  | { type: 'tool_calls'; calls: ParsedToolCall[]; rawMessage: AgentMessage }

/** OpenAI-format tool definition sent to the LLM. */
export interface OpenAIToolDef {
  type: 'function'
  function: { name: string; description: string; parameters: object }
}

/**
 * Non-streaming chat completion with tool-calling support.
 * Returns either a final text response or a list of parsed tool calls.
 */
export async function completeWithTools(
  messages: AgentMessage[],
  tools: OpenAIToolDef[],
  model: string = MODELS.default,
): Promise<AgentCompletion> {
  const body: Record<string, unknown> = { model, messages, stream: false, max_tokens: 4096 }
  if (tools.length > 0) {
    body.tools = tools
    body.tool_choice = 'auto'
  }

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: openrouterHeaders(),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`Chat tool completion error ${res.status}: ${err}`)
  }

  const data = (await res.json()) as {
    choices: Array<{
      message: {
        role: string
        content: string | null
        tool_calls?: Array<{
          id: string
          type: string
          function: { name: string; arguments: string }
        }>
      }
      finish_reason: string
    }>
  }

  const choice = data.choices[0]
  if (!choice) throw new Error('No completion choice returned')

  const { message, finish_reason } = choice

  if (finish_reason === 'tool_calls' && message.tool_calls?.length) {
    const rawMessage: AgentMessage = {
      role: 'assistant',
      content: message.content ?? null,
      tool_calls: message.tool_calls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.function.name, arguments: tc.function.arguments },
      })),
    }

    const calls: ParsedToolCall[] = message.tool_calls.map((tc) => {
      let parsedArgs: unknown
      try { parsedArgs = JSON.parse(tc.function.arguments) } catch { parsedArgs = {} }
      return { id: tc.id, name: tc.function.name, arguments: parsedArgs }
    })

    return { type: 'tool_calls', calls, rawMessage }
  }

  const content = message.content ?? ''
  const rawMessage: AgentMessage = { role: 'assistant', content }
  return { type: 'text', content, rawMessage }
}

/**
 * Parse a raw SSE stream into text tokens.
 * Used by route handlers to forward to the client via Hono streamSSE.
 * Buffers chunks across read calls to prevent dropped tokens on packet boundaries.
 */
export async function* parseSSEStream(
  rawStream: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = rawStream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        buffer += decoder.decode()
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, '').trim()
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') return

        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>
          }
          const token = parsed.choices?.[0]?.delta?.content
          if (token) yield token
        } catch {
          // skip malformed lines
        }
      }
    }

    if (buffer.trim()) {
      const line = buffer.replace(/\r$/, '').trim()
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim()
        if (data !== '[DONE]') {
          try {
            const parsed = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string } }>
            }
            const token = parsed.choices?.[0]?.delta?.content
            if (token) yield token
          } catch {
            // skip malformed lines
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Generate a concise 3-5 word conversation title from the user's initial message.
 * Uses lightweight model. Strips quotes, prefixes, and markdown.
 */
export async function generateSessionTitle(userMessage: string): Promise<string> {
  const cleanMsg = userMessage.replace(/\s+/g, ' ').trim()
  if (!cleanMsg) return 'New Conversation'

  try {
    const raw = await complete([
      {
        role: 'system',
        content:
          'You generate concise, descriptive titles for chat sessions. Return ONLY a 3-5 word title summarizing the user message. Do NOT include quotes, prefixes like "Title:", markdown, or punctuation.',
      },
      {
        role: 'user',
        content: cleanMsg.slice(0, 500),
      },
    ], MODELS.light)

    const cleaned = raw.replace(/["'*_#`]/g, '').trim()
    if (cleaned && cleaned.length >= 2 && cleaned.length <= 60) {
      return cleaned
    }
  } catch (err) {
    console.warn('[title] failed to generate title:', err)
  }

  // Graceful fallback: first 4-5 words or slice
  const words = cleanMsg.split(' ').slice(0, 5).join(' ')
  return words.length > 40 ? words.slice(0, 40) + '…' : words
}

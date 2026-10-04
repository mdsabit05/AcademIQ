/**
 * AI Service — Hybrid mode:
 *   Chat completions → Groq free API    (GROQ_API_KEY)
 *   Embeddings       → OpenRouter       (OPENROUTER_API_KEY)
 *
 * ── To revert to NVIDIA ───────────────────────────────────────────────────────
 *   1. Change CHAT_BASE  → NVIDIA_BASE
 *   2. Change chatHeaders → nvidiaHeaders
 *   (Also revert config/models.ts model names)
 *
 * ── To revert to full OpenRouter ─────────────────────────────────────────────
 *   1. Change CHAT_BASE  → OPENROUTER_BASE
 *   2. Change chatHeaders → openrouterHeaders
 *   (Also revert config/models.ts model names)
 */

import { MODELS } from '../config/models.js'

// ── Base URLs ─────────────────────────────────────────────────────────────────

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'
const NVIDIA_BASE     = 'https://integrate.api.nvidia.com/v1'
const GROQ_BASE       = 'https://api.groq.com/openai/v1'

// ── Auth header factories ─────────────────────────────────────────────────────

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

function nvidiaHeaders(): Record<string, string> {
  const key = process.env.NVIDIA_API_KEY
  if (!key) throw new Error('NVIDIA_API_KEY is not set')
  return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
}

function groqHeaders(): Record<string, string> {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY is not set')
  return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
}

// ── Active routing ────────────────────────────────────────────────────────────
// Chat → Groq  |  to revert to NVIDIA: swap both lines to NVIDIA_BASE / nvidiaHeaders

const CHAT_BASE   = GROQ_BASE       // ← swap to NVIDIA_BASE to revert
const chatHeaders = groqHeaders     // ← swap to nvidiaHeaders to revert

export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Stream a chat completion.
 * Returns the raw ReadableStream from OpenRouter for SSE passthrough.
 */
export async function stream(
  messages: Message[],
  model: string = MODELS.default,
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${CHAT_BASE}/chat/completions`, {
    method: 'POST',
    headers: chatHeaders(),
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
  const res = await fetch(`${CHAT_BASE}/chat/completions`, {
    method: 'POST',
    headers: chatHeaders(),
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
 * Returns a 1536-dimensional vector via OpenRouter /api/v1/embeddings.
 */
export async function embed(text: string): Promise<number[]> {
  const results = await embedBatch([text])
  return results[0]
}

/**
 * Batch embed multiple texts.
 * Send in batches of up to 100 to stay within rate limits.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  const BATCH_SIZE = 100
  const results: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)

    const res = await fetch(`${OPENROUTER_BASE}/embeddings`, {
      method: 'POST',
      headers: openrouterHeaders(),  // embeddings stay on OpenRouter
      body: JSON.stringify({
        model: MODELS.embed,
        input: batch,
      }),
    })

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText)
      throw new Error(`Embeddings error ${res.status}: ${err}`)
    }

    const data = (await res.json()) as {
      data: Array<{ embedding: number[] }>
    }

    results.push(...data.data.map((d) => d.embedding))
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
 * Pass an empty tools array to force a text-only response.
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

  const res = await fetch(`${CHAT_BASE}/chat/completions`, {
    method: 'POST',
    headers: chatHeaders(),
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

  // Tool calls — append the raw API message to history for subsequent iterations
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

  // Text response
  const content = message.content ?? ''
  const rawMessage: AgentMessage = { role: 'assistant', content }
  return { type: 'text', content, rawMessage }
}

/**
 * Parse a raw SSE stream from OpenRouter into text tokens.
 * Used by route handlers to forward to the client via Hono streamSSE.
 */
export async function* parseSSEStream(
  rawStream: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = rawStream.getReader()
  const decoder = new TextDecoder()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const text = decoder.decode(value, { stream: true })
      const lines = text.split('\n')

      for (const line of lines) {
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
  } finally {
    reader.releaseLock()
  }
}

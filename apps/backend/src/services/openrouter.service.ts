export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

function headers(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://note2test.app',
    'X-Title': 'Note2Test',
  }
}

/**
 * Returns the raw SSE ReadableStream from OpenRouter.
 * Caller is responsible for streaming it to the client.
 */
export async function streamCompletion(
  messages: LLMMessage[],
  apiKey: string,
  model = 'google/gemini-3.5-flash',
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({ model, messages, stream: true }),
  })

  if (!res.ok) {
    throw new Error(`OpenRouter stream error: ${res.status} ${await res.text()}`)
  }

  return res.body!
}

/**
 * Non-streaming JSON completion — waits for full response.
 * Extracts JSON from text rather than using response_format (not supported by all models).
 */
export async function completeJson<T>(
  messages: LLMMessage[],
  apiKey: string,
  model = 'google/gemini-3.5-flash',
): Promise<T> {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({ model, messages, stream: false }),
  })

  if (!res.ok) {
    throw new Error(`OpenRouter completion error: ${res.status} ${await res.text()}`)
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>
  }

  const content = data.choices[0].message.content
  // Strip optional markdown code fences then parse
  const stripped = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error(`No JSON object found in model response`)
  return JSON.parse(stripped.slice(start, end + 1)) as T
}

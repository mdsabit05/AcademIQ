/**
 * Guardrails Service — post-generation safety and quality checks.
 *
 * Applied to every AI response before it's stored or streamed to the client.
 * Checks:
 *   1. Hallucination risk — flags if the response makes claims not grounded in context
 *   2. Off-topic — detects responses unrelated to the academic material
 *   3. Content safety — placeholder for future moderation integration
 *
 * Returns a GuardrailResult. Callers decide whether to block or annotate.
 */

import { complete } from './ai.service.js'
import { MODELS } from '../config/models.js'

export interface GuardrailResult {
  passed: boolean
  flags: string[]
  suggestion?: string
}

/**
 * Run guardrails on an AI response.
 *
 * @param response    The assistant's generated response
 * @param context     The RAG context that was injected (used for grounding check)
 * @param query       The original user query
 */
export async function checkResponse(
  response: string,
  context: string,
  query: string,
): Promise<GuardrailResult> {
  if (!response.trim()) {
    return { passed: false, flags: ['empty_response'] }
  }

  // For very short contexts (no RAG material), skip grounding check
  if (context.trim().length < 50) {
    return { passed: true, flags: [] }
  }

  const prompt = `You are a response quality checker for an educational AI assistant.

User query: "${query.slice(0, 300)}"

RAG context provided to the assistant:
${context.slice(0, 2000)}

Assistant response:
${response.slice(0, 1500)}

Check for these issues:
1. "hallucination" — the response makes specific factual claims not supported by the context
2. "off_topic" — the response is unrelated to the query or academic material
3. "context_ignored" — the response ignores available relevant context

Reply with JSON only:
{
  "passed": true|false,
  "flags": ["hallucination"|"off_topic"|"context_ignored"],
  "suggestion": "optional one-sentence fix suggestion if not passed"
}`

  try {
    const raw = await complete([{ role: 'user', content: prompt }], MODELS.light)
    const cleaned = raw
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim()
    const result = JSON.parse(cleaned) as GuardrailResult
    return {
      passed: result.passed ?? true,
      flags: Array.isArray(result.flags) ? result.flags : [],
      suggestion: result.suggestion,
    }
  } catch {
    // If guardrails fail, allow the response through (fail open for educational content)
    return { passed: true, flags: ['guardrail_error'] }
  }
}

/**
 * Agent Service — controlled Agentic AI loop.
 *
 * Execution model:
 *  1. Build tool definitions filtered by the caller's role.
 *  2. Call completeWithTools() iteratively until the model returns text.
 *  3. For each tool_call:
 *       a. Look up tool in registry.
 *       b. Re-check role authorisation (defence in depth).
 *       c. Validate parameters against the tool's JSON schema.
 *       d. Execute tool — catch all errors, return structured error to model.
 *       e. Append tool result message to history.
 *  4. Iteration cap (MAX_ITERATIONS) prevents infinite loops.
 *     At the cap, tools are removed so the model is forced to return text.
 *  5. Final response is returned to the caller for guardrail checks + SSE streaming.
 *
 * Security guarantees:
 *  - The agent never holds a DB connection — tools manage their own queries.
 *  - Role check is performed twice: registry.toOpenAITools() filters the
 *    tool list sent to the LLM, and execute() re-checks at call time.
 *  - ToolContext carries only (dbUserId, userRole) — no raw credentials.
 *  - Malformed / unknown tool calls are handled safely and reported back
 *    to the model rather than crashing the request.
 */

import {
  completeWithTools,
  type AgentMessage,
  type OpenAIToolDef,
} from '../services/ai.service.js'
import { registry, validateParams } from './tool-registry.js'
import type { ToolContext } from './tool-registry.js'
import { checkResponse } from '../services/guardrails.service.js'
import { MODELS } from '../config/models.js'
import type { Role } from '../middleware/auth.js'

// ── Tool imports — side-effect: each file calls registry.register() ──────────
import './tools/retrieve-context.tool.js'
import './tools/get-syllabus.tool.js'
import './tools/get-memory.tool.js'
import './tools/get-progress.tool.js'
import './tools/evaluate-answer.tool.js'
import './tools/generate-test.tool.js'

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum tool-call iterations before forcing a final text response. */
const MAX_ITERATIONS = 8

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are AcademIQ, an intelligent academic AI assistant. \
You help students learn effectively using their own uploaded study materials.

You have access to tools that let you:
- retrieve-context   — search the user's books for relevant information
- get-syllabus       — check the user's curriculum/syllabus topics
- get-memory         — retrieve the user's learning history and mastered topics
- get-progress       — get test performance statistics and weak areas
- evaluate-answer    — score and give feedback on a student's answer
- generate-test      — create a practice test from specific books and topics

Rules you must follow without exception:
1. Use retrieve-context when the question is about study material content — but for general knowledge questions (facts, concepts, recommendations, comparisons, etc.) you may answer directly from your own knowledge without calling any tool.
2. When retrieve-context returns no relevant content, answer from general knowledge rather than refusing.
3. When presenting generated test questions, NEVER include or hint at correct answers in your response.
4. Keep responses educationally clear, structured, and supportive.
5. You can discuss, compare, and recommend external resources, tools, websites, or services when asked — do not restrict yourself to AcademIQ only.
6. Do not expose internal tool results (e.g. raw JSON, correctAnswer fields) to the user.

Workflow for complex requests:
1. Understand the user's goal.
2. Gather real data with tools (progress → memory → context → syllabus as appropriate).
3. Synthesise findings into a clear, helpful response.`

// ── Public interface ──────────────────────────────────────────────────────────

export interface AgentRunOptions {
  userMessage: string
  dbUserId: string
  userRole: Role
  /** Pre-verified book IDs available for context (optional). */
  bookIds?: string[]
  /** Prior conversation turns to maintain continuity (optional). */
  history?: AgentMessage[]
}

export interface AgentRunResult {
  finalResponse: string
  toolsUsed: string[]
  iterations: number
  guardrailFlags: string[]
}

// ── Core loop ─────────────────────────────────────────────────────────────────

export async function runAgentLoop(opts: AgentRunOptions): Promise<AgentRunResult> {
  const { userMessage, dbUserId, userRole, history = [] } = opts

  const ctx: ToolContext = { dbUserId, userRole }

  // Build the initial message list
  const messages: AgentMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: userMessage },
  ]

  // Role-filtered tool definitions — the LLM never sees tools it can't use
  const allTools: OpenAIToolDef[] = registry.toOpenAITools(userRole)

  const toolsUsed: string[] = []
  let iterations = 0
  let finalResponse = ''

  while (true) {
    // At the iteration cap remove tools so the model MUST return plain text
    const activeTools = iterations >= MAX_ITERATIONS ? [] : allTools

    const completion = await completeWithTools(messages, activeTools, MODELS.default)

    // Always append the raw assistant message to maintain conversation fidelity
    messages.push(completion.rawMessage)

    if (completion.type === 'text') {
      finalResponse = completion.content
      break
    }

    // ── Process tool calls ────────────────────────────────────────────────────
    iterations++

    for (const call of completion.calls) {
      const { id: callId, name: toolName, arguments: rawArgs } = call

      // ── 1. Unknown tool ────────────────────────────────────────────────────
      const toolDef = registry.get(toolName)
      if (!toolDef) {
        messages.push({
          role: 'tool',
          tool_call_id: callId,
          content: JSON.stringify({ error: `Unknown tool: "${toolName}"` }),
        })
        continue
      }

      // ── 2. Role authorisation (defence in depth) ──────────────────────────
      if (!toolDef.allowedRoles.includes(userRole)) {
        messages.push({
          role: 'tool',
          tool_call_id: callId,
          content: JSON.stringify({
            error: `Tool "${toolName}" is not available for role "${userRole}"`,
          }),
        })
        continue
      }

      // ── 3. Parameter validation ───────────────────────────────────────────
      const validationError = validateParams(rawArgs, toolDef.parameters)
      if (validationError) {
        messages.push({
          role: 'tool',
          tool_call_id: callId,
          content: JSON.stringify({
            error: `Invalid parameters for "${toolName}": ${validationError}`,
          }),
        })
        continue
      }

      // ── 4. Execute — tool enforces ownership internally ───────────────────
      toolsUsed.push(toolName)
      try {
        const result = await toolDef.execute(rawArgs as never, ctx)
        messages.push({
          role: 'tool',
          tool_call_id: callId,
          content: JSON.stringify(result),
        })
      } catch (err: unknown) {
        const status = (err as { status?: number }).status
        const msg = (err as Error).message ?? 'Tool execution failed'
        // 403/404 are user-facing ownership errors; other errors are internal
        const errorContent =
          status === 403 || status === 404
            ? { error: msg }
            : { error: `Tool "${toolName}" encountered an error. Please try again.` }

        console.error(`[agent] tool "${toolName}" failed:`, err)
        messages.push({
          role: 'tool',
          tool_call_id: callId,
          content: JSON.stringify(errorContent),
        })
      }
    }
  }

  // ── Guardrails ────────────────────────────────────────────────────────────
  const guardrail = await checkResponse(finalResponse, '', userMessage)
  if (!guardrail.passed) {
    console.warn('[agent] guardrail flags:', guardrail.flags)
  }

  return {
    finalResponse,
    toolsUsed: [...new Set(toolsUsed)], // deduplicate
    iterations,
    guardrailFlags: guardrail.flags,
  }
}

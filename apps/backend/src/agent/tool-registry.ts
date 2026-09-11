/**
 * Tool Registry — central registry for all Agentic AI tools.
 *
 * Security model:
 *  - Every tool declares its allowedRoles. The registry filters by role before
 *    passing tool definitions to the LLM, so the model never even sees tools
 *    it is not authorised to call.
 *  - The agent service checks allowedRoles again at execution time (defence in depth).
 *  - ToolContext carries only (dbUserId, userRole) — no raw DB connection,
 *    no file-system access, no arbitrary SQL.
 *  - Every tool is responsible for its own ownership validation.
 */

import type { Role } from '../middleware/auth.js'
import type { OpenAIToolDef } from '../services/ai.service.js'

// ── Public types ─────────────────────────────────────────────────────────────

export interface ToolSchema {
  type: 'object'
  properties: Record<string, unknown>
  required?: string[]
  additionalProperties?: boolean
}

/** Execution context passed to every tool — no raw DB connection. */
export interface ToolContext {
  dbUserId: string
  userRole: Role
}

export interface AgentTool<TParams = unknown> {
  /** Unique snake-case identifier used in LLM tool_calls. */
  name: string
  /** Description shown to the LLM — be precise so the model calls it correctly. */
  description: string
  /** JSON Schema for the tool's parameters — validated before execution. */
  parameters: ToolSchema
  /** Roles allowed to invoke this tool. Checked by registry AND agent service. */
  allowedRoles: Role[]
  /** Actual business logic. Throws on unrecoverable failure. */
  execute(params: TParams, ctx: ToolContext): Promise<unknown>
}

// ── Parameter validator ──────────────────────────────────────────────────────

/**
 * Lightweight JSON-schema-style validator.
 * Returns a human-readable error string, or null if valid.
 */
export function validateParams(params: unknown, schema: ToolSchema): string | null {
  if (typeof params !== 'object' || params === null || Array.isArray(params)) {
    return 'Parameters must be a JSON object'
  }
  const p = params as Record<string, unknown>

  // Required fields
  for (const key of schema.required ?? []) {
    if (!(key in p) || p[key] === undefined || p[key] === null) {
      return `Missing required parameter: "${key}"`
    }
  }

  // Type checks on declared properties
  for (const [key, rawDef] of Object.entries(schema.properties)) {
    if (!(key in p)) continue
    const val = p[key]
    const def = rawDef as {
      type?: string
      enum?: string[]
      minimum?: number
      maximum?: number
      items?: { type?: string }
    }

    if (def.type === 'string' && typeof val !== 'string') return `"${key}" must be a string`
    if (def.type === 'integer') {
      if (typeof val !== 'number' || !Number.isInteger(val)) return `"${key}" must be an integer`
    }
    if (def.type === 'number' && typeof val !== 'number') return `"${key}" must be a number`
    if (def.type === 'boolean' && typeof val !== 'boolean') return `"${key}" must be a boolean`
    if (def.type === 'array' && !Array.isArray(val)) return `"${key}" must be an array`

    if (def.enum && !def.enum.includes(val as string)) {
      return `"${key}" must be one of: ${def.enum.join(', ')}`
    }
    if (typeof val === 'number') {
      if (def.minimum !== undefined && val < def.minimum) return `"${key}" must be >= ${def.minimum}`
      if (def.maximum !== undefined && val > def.maximum) return `"${key}" must be <= ${def.maximum}`
    }
    if (Array.isArray(val) && def.items?.type) {
      for (const item of val) {
        if (typeof item !== def.items.type) return `All items in "${key}" must be ${def.items.type}s`
      }
    }
  }

  return null
}

// ── Registry ─────────────────────────────────────────────────────────────────

class ToolRegistry {
  private readonly tools = new Map<string, AgentTool>()

  register<T>(tool: AgentTool<T>): this {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`)
    }
    this.tools.set(tool.name, tool as AgentTool)
    return this
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name)
  }

  getAll(): AgentTool[] {
    return [...this.tools.values()]
  }

  /** Returns only tools the given role is allowed to see and call. */
  getForRole(role: Role): AgentTool[] {
    return [...this.tools.values()].filter((t) => t.allowedRoles.includes(role))
  }

  /** Convert role-filtered tools to OpenAI tool definition format for the LLM. */
  toOpenAITools(role: Role): OpenAIToolDef[] {
    return this.getForRole(role).map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters as object,
      },
    }))
  }
}

/** Singleton registry — all tool files call registry.register() on import. */
export const registry = new ToolRegistry()

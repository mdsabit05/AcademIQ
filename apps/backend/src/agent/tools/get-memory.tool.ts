/**
 * Tool: get-memory
 *
 * Reads the calling user's student_memory records.
 * Ownership: readMemory() always filters by userId = ctx.dbUserId.
 * A student can NEVER read another student's memory through this tool.
 *
 * Allowed roles: student, teacher, admin
 */

import { readMemory } from '../../services/memory.service.js'
import { registry } from '../tool-registry.js'
import type { AgentTool, ToolContext } from '../tool-registry.js'

interface Params {
  topic?: string
  limit?: number
}

const tool: AgentTool<Params> = {
  name: 'get-memory',

  description:
    'Retrieve the user\'s learning memory: topics mastered, weak areas, common mistakes, ' +
    'and study history. Use this to personalise responses and identify areas that need ' +
    'more practice.',

  parameters: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        description: 'Filter memory records by topic keyword (case-insensitive partial match).',
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 50,
        description: 'Maximum number of records to return (default 10, max 50).',
      },
    },
    required: [],
  },

  allowedRoles: ['student', 'teacher', 'admin'],

  async execute(params: Params, ctx: ToolContext): Promise<unknown> {
    const limit = Math.min(params.limit ?? 10, 50)

    // readMemory always scopes to ctx.dbUserId — no cross-user leakage possible
    const facts = await readMemory(ctx.dbUserId, params.topic, limit)

    return {
      memoryCount: facts.length,
      facts: facts.map((f) => ({
        type: f.memoryType,
        topic: f.contextKey,
        detail: f.value,
        confidence: f.confidence,
      })),
    }
  },
}

registry.register(tool)
export default tool

/**
 * Tool: retrieve-context
 *
 * Embeds the query → pgvector cosine search (TOP-20) → LLM reranker (TOP-5)
 * → assembles contextText + citations.
 *
 * Ownership: verifyBookAccess enforces that every bookId belongs to the
 * authenticated user. If no bookIds are supplied the tool queries only
 * READY books owned by the caller.
 *
 * Allowed roles: student, teacher, admin
 */

import { retrieve } from '../../services/retrieval.service.js'
import { rerank } from '../../services/reranker.service.js'
import { buildContext } from '../../services/context-builder.service.js'
import { verifyBookAccess } from '../../middleware/rbac.js'
import sql from '../../db/client.js'
import { registry } from '../tool-registry.js'
import type { AgentTool, ToolContext } from '../tool-registry.js'

interface Params {
  query: string
  bookIds?: string[]
  topK?: number
}

const tool: AgentTool<Params> = {
  name: 'retrieve-context',

  description:
    'Search the user\'s uploaded books for relevant information using semantic similarity. ' +
    'Always call this tool before answering factual or subject-matter questions to ground ' +
    'your response in actual book content. Returns relevant text passages and citations.',

  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query — a question or topic to look up in the books.',
      },
      bookIds: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Specific book IDs to search (must be books the user owns). ' +
          'If omitted, all user books with status READY are searched.',
      },
      topK: {
        type: 'integer',
        minimum: 1,
        maximum: 10,
        description: 'Number of relevant passages to return (default 5, max 10).',
      },
    },
    required: ['query'],
  },

  allowedRoles: ['student', 'teacher', 'admin'],

  async execute(params: Params, ctx: ToolContext): Promise<unknown> {
    const { query, topK = 5 } = params
    let bookIds = params.bookIds

    if (!bookIds || bookIds.length === 0) {
      // Default: all READY books owned by this user
      const rows = await sql<Array<{ id: string }>>`
        SELECT id FROM books
        WHERE owner_id = ${ctx.dbUserId} AND status = 'READY'
        LIMIT 20
      `
      bookIds = rows.map((r) => r.id)
    } else {
      // Verify the caller owns every requested book (throws 403 if not)
      await verifyBookAccess(bookIds, ctx.dbUserId)
    }

    if (bookIds.length === 0) {
      return {
        contextText: '',
        citations: [],
        message: 'No ready books found. Upload and process a book first.',
      }
    }

    const candidates = await retrieve(query, bookIds, 20)
    const reranked = await rerank(query, candidates, Math.min(topK, 5))
    const { contextText, citations } = buildContext(reranked)

    return { contextText, citations, chunkCount: reranked.length }
  },
}

registry.register(tool)
export default tool

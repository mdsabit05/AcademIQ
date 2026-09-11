/**
 * Tool: get-syllabus
 *
 * Returns syllabus topics for the authenticated user.
 * Ownership: always filtered by owner_id = ctx.dbUserId.
 *
 * Allowed roles: student, teacher, admin
 */

import sql from '../../db/client.js'
import { registry } from '../tool-registry.js'
import type { AgentTool, ToolContext } from '../tool-registry.js'

interface Params {
  syllabusId?: string
  subjectId?: string
}

const tool: AgentTool<Params> = {
  name: 'get-syllabus',

  description:
    'Retrieve the user\'s syllabus topics and curriculum structure. ' +
    'Use this to understand what the user is expected to study, to align test generation ' +
    'with their curriculum, or to identify covered and uncovered areas.',

  parameters: {
    type: 'object',
    properties: {
      syllabusId: {
        type: 'string',
        description:
          'ID of a specific syllabus to fetch. If omitted, returns the most recent ready syllabus.',
      },
      subjectId: {
        type: 'string',
        description: 'Filter by subject ID when looking for the latest syllabus.',
      },
    },
    required: [],
  },

  allowedRoles: ['student', 'teacher', 'admin'],

  async execute(params: Params, ctx: ToolContext): Promise<unknown> {
    let syllabusId = params.syllabusId

    if (!syllabusId) {
      // Resolve the most recent ready syllabus owned by this user
      const rows = params.subjectId
        ? await sql<Array<{ id: string }>>`
            SELECT id FROM syllabi
            WHERE owner_id = ${ctx.dbUserId}
              AND subject_id = ${params.subjectId}
              AND status = 'ready'
            ORDER BY created_at DESC LIMIT 1
          `
        : await sql<Array<{ id: string }>>`
            SELECT id FROM syllabi
            WHERE owner_id = ${ctx.dbUserId} AND status = 'ready'
            ORDER BY created_at DESC LIMIT 1
          `

      if (!rows[0]) {
        return {
          topics: [],
          message: 'No syllabus found. Upload a syllabus PDF to get started.',
        }
      }
      syllabusId = rows[0].id
    } else {
      // Explicit syllabusId — verify ownership
      const owned = await sql<Array<{ id: string }>>`
        SELECT id FROM syllabi
        WHERE id = ${syllabusId} AND owner_id = ${ctx.dbUserId}
      `
      if (!owned[0]) {
        throw Object.assign(new Error('Syllabus not found'), { status: 404 })
      }
    }

    const topics = await sql<
      Array<{ unit: string | null; topic: string; subtopic: string | null; order_index: number }>
    >`
      SELECT unit, topic, subtopic, order_index
      FROM syllabus_topics
      WHERE syllabus_id = ${syllabusId}
      ORDER BY order_index
    `

    return { syllabusId, topicCount: topics.length, topics }
  },
}

registry.register(tool)
export default tool

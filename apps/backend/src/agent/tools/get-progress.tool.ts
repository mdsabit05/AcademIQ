/**
 * Tool: get-progress
 *
 * Returns the calling user's test performance statistics, mastered topics,
 * and weak topics from student_memory.
 *
 * Ownership: all queries are filtered by user_id = ctx.dbUserId.
 *
 * Allowed roles: student, teacher, admin
 */

import sql from '../../db/client.js'
import { registry } from '../tool-registry.js'
import type { AgentTool, ToolContext } from '../tool-registry.js'

interface Params {
  topic?: string
}

const tool: AgentTool<Params> = {
  name: 'get-progress',

  description:
    'Retrieve the user\'s learning progress: tests taken, average score, mastered topics, ' +
    'and weak areas. Use this before recommending study strategies or generating targeted tests.',

  parameters: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        description:
          'Optional topic filter (case-insensitive). When provided, mastery and weak-topic ' +
          'lists are filtered to rows whose topic contains this string.',
      },
    },
    required: [],
  },

  allowedRoles: ['student', 'teacher', 'admin'],

  async execute(params: Params, ctx: ToolContext): Promise<unknown> {
    // Overall test stats — scoped to this user only
    const [stats] = await sql<
      [{ tests_taken: number; avg_score_pct: number | null }]
    >`
      SELECT
        COUNT(DISTINCT ta.id)::int                                  AS tests_taken,
        AVG(ta.score::float / NULLIF(ta.total_marks, 0) * 100)      AS avg_score_pct
      FROM test_attempts ta
      WHERE ta.user_id = ${ctx.dbUserId}
    `

    // Topic mastery — optionally filtered by topic keyword
    const masteryRows = params.topic
      ? await sql`
          SELECT context_key, value, confidence
          FROM student_memory
          WHERE user_id      = ${ctx.dbUserId}
            AND memory_type  = 'topic_mastery'
            AND context_key ILIKE ${'%' + params.topic + '%'}
          ORDER BY confidence DESC
          LIMIT 15
        `
      : await sql`
          SELECT context_key, value, confidence
          FROM student_memory
          WHERE user_id     = ${ctx.dbUserId}
            AND memory_type = 'topic_mastery'
          ORDER BY confidence DESC
          LIMIT 15
        `

    // Weak topics — same optional filter
    const weakRows = params.topic
      ? await sql`
          SELECT context_key, value, confidence
          FROM student_memory
          WHERE user_id      = ${ctx.dbUserId}
            AND memory_type  = 'weak_topic'
            AND context_key ILIKE ${'%' + params.topic + '%'}
          ORDER BY confidence DESC
          LIMIT 10
        `
      : await sql`
          SELECT context_key, value, confidence
          FROM student_memory
          WHERE user_id     = ${ctx.dbUserId}
            AND memory_type = 'weak_topic'
          ORDER BY confidence DESC
          LIMIT 10
        `

    return {
      testsTaken: stats?.tests_taken ?? 0,
      avgScorePct: stats?.avg_score_pct != null ? Math.round(stats.avg_score_pct) : null,
      masteredTopics: masteryRows,
      weakTopics: weakRows,
    }
  },
}

registry.register(tool)
export default tool

/**
 * Progress routes — study history and performance analytics.
 *
 * GET /progress/summary    — overall stats (tests taken, avg score, topics)
 * GET /progress/history    — paginated study session + test attempt history
 */

import { Hono } from 'hono'
import sql from '../db/client.js'
import { safeOffset } from '../lib/validate.js'
import type { AuthEnv } from '../middleware/auth.js'

const progress = new Hono<AuthEnv>()

progress.get('/summary', async (c) => {
  const dbUserId = c.get('dbUserId')

  const [stats] = await sql<[{
    tests_taken: number
    avg_score_pct: number | null
    total_study_seconds: number | null
  }]>`
    SELECT
      COUNT(DISTINCT ta.id)::int          AS tests_taken,
      AVG(ta.score::float / NULLIF(ta.total_marks, 0) * 100) AS avg_score_pct,
      SUM(ss.duration_seconds)            AS total_study_seconds
    FROM users u
    LEFT JOIN test_attempts ta ON ta.user_id = u.id
    LEFT JOIN study_sessions ss ON ss.user_id = u.id
    WHERE u.id = ${dbUserId}
  `

  // Topic mastery breakdown
  const masteryRows = await sql`
    SELECT context_key, value, confidence
    FROM student_memory
    WHERE user_id = ${dbUserId}
      AND memory_type = 'topic_mastery'
    ORDER BY confidence DESC
    LIMIT 20
  `

  // Weak topics
  const weakRows = await sql`
    SELECT context_key, value, confidence
    FROM student_memory
    WHERE user_id = ${dbUserId}
      AND memory_type = 'weak_topic'
    ORDER BY confidence DESC
    LIMIT 10
  `

  return c.json({
    summary: {
      testsTaken: stats.tests_taken ?? 0,
      avgScorePct: stats.avg_score_pct ? Math.round(stats.avg_score_pct) : null,
      totalStudyMinutes: stats.total_study_seconds
        ? Math.round(stats.total_study_seconds / 60)
        : 0,
    },
    topicMastery: masteryRows,
    weakTopics: weakRows,
  })
})

progress.get('/history', async (c) => {
  const dbUserId = c.get('dbUserId')
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100)
  const offset = safeOffset(c.req.query('offset'))

  const attempts = await sql`
    SELECT ta.id, ta.score, ta.total_marks, ta.submitted_at,
           t.topic, t.type, t.difficulty
    FROM test_attempts ta
    JOIN tests t ON t.id = ta.test_id
    WHERE ta.user_id = ${dbUserId}
    ORDER BY ta.submitted_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `

  const sessions = await sql`
    SELECT ss.id, ss.mode, ss.topic, ss.duration_seconds, ss.created_at,
           cs.id AS session_id
    FROM study_sessions ss
    LEFT JOIN chat_sessions cs ON cs.id = ss.session_id
    WHERE ss.user_id = ${dbUserId}
    ORDER BY ss.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `

  return c.json({ attempts, sessions })
})

export default progress

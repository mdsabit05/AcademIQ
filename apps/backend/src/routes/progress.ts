import { Hono } from 'hono'
import { authMiddleware, type AuthEnv } from '../middleware/auth.js'
import sql from '../db/client.js'
import type { ProgressResponse } from 'shared'

const app = new Hono<AuthEnv>()
app.use('*', authMiddleware)

app.get('/', async (c) => {
  const userId = c.get('dbUserId')

  // Aggregate stats from test_attempts
  const [stats] = await sql<Array<{
    tests_completed: number
    avg_score_pct: number
    total_time_seconds: number
  }>>`
    SELECT
      COUNT(*)::int                                          AS tests_completed,
      COALESCE(AVG(score::float / NULLIF(total_marks, 0) * 100), 0) AS avg_score_pct,
      COALESCE(SUM(time_elapsed_seconds), 0)::int           AS total_time_seconds
    FROM test_attempts
    WHERE user_id = ${userId}
  `

  // Topics learned = distinct topics from test_attempts + learn chat messages
  const [topicsRow] = await sql<Array<{ count: number }>>`
    SELECT COUNT(DISTINCT topic)::int AS count
    FROM (
      SELECT t.topic
      FROM test_attempts ta
      JOIN tests t ON ta.test_id = t.id
      WHERE ta.user_id = ${userId}
      UNION
      SELECT content AS topic
      FROM chat_messages
      WHERE user_id = ${userId} AND mode = 'learn' AND role = 'user'
    ) combined
  `

  // Per-topic performance
  const topicRows = await sql<Array<{ topic: string; score: number; attempts: number }>>`
    SELECT
      t.topic,
      ROUND(AVG(ta.score::float / NULLIF(ta.total_marks, 0) * 100))::int AS score,
      COUNT(*)::int AS attempts
    FROM test_attempts ta
    JOIN tests t ON ta.test_id = t.id
    WHERE ta.user_id = ${userId}
    GROUP BY t.topic
    ORDER BY score DESC
  `

  const topicsToReview = topicRows
    .filter((t) => t.score < 70)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((t) => t.topic)

  const response: ProgressResponse = {
    testsCompleted: stats.tests_completed,
    topicsLearned: topicsRow.count,
    averageScore: Math.round(stats.avg_score_pct),
    studyTimeSeconds: stats.total_time_seconds,
    topicPerformance: topicRows,
    topicsToReview,
  }

  return c.json(response)
})

export default app

/**
 * Structured HTTP request logger.
 *
 * Replaces Hono's default text logger() with JSON output that log
 * aggregators can index and alert on. Every request produces one log
 * line AFTER the response is sent so the status code is available.
 *
 * Fields logged per request:
 *   method, path, status, ms (response time), ip, ua (user-agent)
 *
 * Unusual-traffic patterns that generate warn/error lines:
 *   - 4xx from authenticated routes (possible probing)
 *   - 5xx responses (server errors)
 *   - Requests with no User-Agent (typical of automated scanners)
 *   - Response time > 5 s (slow query / abuse)
 *
 * Excluded from logging:
 *   - GET /health (polling noise)
 *   - Query-string values (may contain sensitive data)
 */

import type { Context, Next } from 'hono'
import { logger } from '../lib/logger.js'

export async function requestLogger(c: Context, next: Next) {
  // Skip health-check polling noise.
  if (c.req.path === '/health') return next()

  const start = Date.now()
  await next()
  const ms = Date.now() - start

  const ip =
    c.req.header('x-forwarded-for')?.split(',')[0].trim() ??
    c.req.header('x-real-ip') ??
    'unknown'

  const ua      = c.req.header('user-agent') ?? ''
  const method  = c.req.method
  const path    = c.req.path          // path only — no query string
  const status  = c.res.status

  const fields = { method, path, status, ms, ip, ua: ua || '[none]' }

  if (status >= 500) {
    logger.error('server error', fields)
  } else if (status >= 400) {
    // 401/403 bursts can indicate credential stuffing or enumeration.
    logger.warn('client error', fields)
  } else if (ms > 5000) {
    logger.warn('slow response', fields)
  } else if (!ua) {
    // Legitimate browsers always send User-Agent.
    logger.warn('no user-agent', fields)
  } else {
    logger.info('request', fields)
  }
}

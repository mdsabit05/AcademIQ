/**
 * In-memory sliding-window rate limiter.
 *
 * Each call to rateLimit() creates its own independent store, so you can
 * apply different limits to different route groups without shared state.
 *
 * IP detection order: x-forwarded-for → x-real-ip → "unknown"
 * (suitable for deployments behind a reverse proxy / CDN)
 *
 * Rate-limit violations are logged as warnings so they appear in
 * structured logs and can trigger alerts in log aggregators.
 */

import type { Context, Next } from 'hono'
import { logger } from '../lib/logger.js'

interface Entry {
  count: number
  resetAt: number
}

export function rateLimit(opts: {
  /** Length of the counting window in milliseconds. */
  windowMs: number
  /** Maximum number of requests allowed per window per IP. */
  max: number
  /** Label used in log output to identify which limiter fired. */
  label?: string
  /** Response message when the limit is exceeded. */
  message?: string
}) {
  const { windowMs, max, label = 'api', message = 'Too many requests — please try again later.' } = opts
  const store = new Map<string, Entry>()

  // Purge stale entries once per window to prevent unbounded memory growth.
  const timer = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (entry.resetAt < now) store.delete(key)
    }
  }, windowMs)
  // Don't keep the process alive for cleanup alone.
  if (timer.unref) timer.unref()

  return async (c: Context, next: Next) => {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0].trim() ??
      c.req.header('x-real-ip') ??
      'unknown'

    const now = Date.now()
    let entry = store.get(ip)

    if (!entry || entry.resetAt < now) {
      entry = { count: 1, resetAt: now + windowMs }
      store.set(ip, entry)
      return next()
    }

    entry.count++
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000)

      // Log every violation so spikes appear in dashboards/alerts.
      logger.warn('rate limit exceeded', {
        limiter: label,
        ip,
        count: entry.count,
        max,
        path: c.req.path,
        method: c.req.method,
        retryAfterSeconds: retryAfter,
      })

      c.header('Retry-After', String(retryAfter))
      c.header('X-RateLimit-Limit', String(max))
      c.header('X-RateLimit-Remaining', '0')
      return c.json({ error: message }, 429)
    }

    c.header('X-RateLimit-Limit', String(max))
    c.header('X-RateLimit-Remaining', String(max - entry.count))
    return next()
  }
}

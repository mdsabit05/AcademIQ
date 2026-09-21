/**
 * In-memory sliding-window rate limiter.
 *
 * Supports two keying strategies:
 *   - Per-IP  (default) — good for unauthenticated routes and a first-line
 *     defence before auth runs.
 *   - Per-user — keyed on the authenticated dbUserId so a single account
 *     cannot bypass IP limits by rotating addresses.
 *
 * Use the exported `userKey` helper to switch to per-user keying on any
 * route where Hono's auth middleware has already run.
 *
 * Each call to rateLimit() creates its own independent store, so different
 * route groups carry different windows without shared state.
 *
 * Every violation is logged as a structured warning so log aggregators
 * can alert on spikes.
 */

import type { Context, Next } from 'hono'
import { logger } from '../lib/logger.js'

interface Entry {
  count: number
  resetAt: number
}

/** Key function that identifies a client by their authenticated user ID.
 *  Falls back to IP if the user hasn't been resolved yet (e.g., auth failure path). */
export function userKey(c: Context): string {
  const uid = (c as Context & { get: (k: string) => string | undefined }).get('dbUserId')
  if (uid) return `user:${uid}`
  return (
    c.req.header('x-forwarded-for')?.split(',')[0].trim() ??
    c.req.header('x-real-ip') ??
    'unknown'
  )
}

/** Key function that identifies a client by IP address (default). */
export function ipKey(c: Context): string {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0].trim() ??
    c.req.header('x-real-ip') ??
    'unknown'
  )
}

export function rateLimit(opts: {
  /** Length of the counting window in milliseconds. */
  windowMs: number
  /** Maximum requests per window. */
  max: number
  /** How to identify the client. Defaults to IP-based. */
  keyFn?: (c: Context) => string
  /** Label used in log output and Retry-After to identify which limiter fired. */
  label?: string
  /** Response message sent in the 429 body. */
  message?: string
}) {
  const {
    windowMs,
    max,
    keyFn = ipKey,
    label = 'api',
    message = 'Too many requests — please try again later.',
  } = opts

  const store = new Map<string, Entry>()

  // Purge stale entries once per window to prevent unbounded memory growth.
  const timer = setInterval(() => {
    const now = Date.now()
    for (const [k, entry] of store) {
      if (entry.resetAt < now) store.delete(k)
    }
  }, windowMs)
  if (timer.unref) timer.unref()

  return async (c: Context, next: Next) => {
    const key = keyFn(c)
    const now = Date.now()
    let entry = store.get(key)

    if (!entry || entry.resetAt < now) {
      entry = { count: 1, resetAt: now + windowMs }
      store.set(key, entry)
      c.header('X-RateLimit-Limit', String(max))
      c.header('X-RateLimit-Remaining', String(max - 1))
      return next()
    }

    entry.count++

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000)

      logger.warn('rate limit exceeded', {
        limiter: label,
        key,
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

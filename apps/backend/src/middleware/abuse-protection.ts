/**
 * Abuse protection middleware.
 *
 * Provides two independent defences:
 *
 * 1. Bot / scanner detection (botGuard)
 *    Blocks requests that match well-known automated-tool signatures:
 *    - Missing User-Agent header (all real browsers send one)
 *    - User-Agents matching known scanners, curl, python-requests, etc.
 *    Logs every block as a structured warning.
 *    Apply to any public-facing or expensive route.
 *
 * 2. Auth failure rate limiting (authFailureTracker / checkAuthFailureLimit)
 *    Tracks failed authentication attempts per IP in a sliding window.
 *    After AUTH_FAIL_MAX failures in AUTH_FAIL_WINDOW_MS the IP is locked
 *    out and every subsequent request (even with a valid token) returns 429
 *    until the window resets.
 *    This prevents:
 *      - Credential stuffing (trying many JWT tokens hoping one is valid)
 *      - Token enumeration
 *      - Brute-force against Clerk's public key
 *
 *    Usage in auth middleware:
 *      1. Call checkAuthFailureLimit(ip, c) BEFORE verifying the token.
 *         Returns true (and sends 429) if the IP is locked out.
 *      2. Call trackAuthFailure(ip) on each failed verification.
 *      3. Call clearAuthFailures(ip) on each successful verification so
 *         legitimate users who had transient token issues are not locked out.
 */

import type { Context, Next } from 'hono'
import { logger } from '../lib/logger.js'

// ── Configuration ─────────────────────────────────────────────────────────────

/** Failures per IP before lockout. */
const AUTH_FAIL_MAX = 10
/** Window in which AUTH_FAIL_MAX failures triggers lockout. */
const AUTH_FAIL_WINDOW_MS = 5 * 60 * 1000   // 5 minutes
/** How long a locked-out IP is blocked after exceeding the threshold. */
const AUTH_FAIL_LOCKOUT_MS = 15 * 60 * 1000  // 15 minutes

// ── Bot detection ─────────────────────────────────────────────────────────────

/**
 * User-Agent fragments that indicate automated tools, scrapers, or scanners.
 * Matched case-insensitively against the full UA string.
 * Browsers, mobile apps, and the Clerk SDK always supply a descriptive UA.
 */
const BOT_UA_PATTERNS = [
  /^$/,                          // empty string
  /^-$/,                         // dash placeholder
  /python-requests/i,
  /libcurl|curl\//i,
  /wget\//i,
  /go-http-client/i,
  /java\/\d/i,
  /apache-httpclient/i,
  /okhttp/i,
  /scrapy/i,
  /mechanize/i,
  /zgrab/i,
  /masscan/i,
  /nmap/i,
  /sqlmap/i,
  /nikto/i,
  /dirbuster/i,
  /nuclei/i,
  /httpx\//i,
  /httpclient/i,
  /axios\/\d/i,           // raw axios without a custom UA (programmatic clients)
  /node-fetch/i,
  /got\//i,
]

export async function botGuard(c: Context, next: Next) {
  const ua = c.req.header('user-agent') ?? ''

  const isBot = !ua || BOT_UA_PATTERNS.some((p) => p.test(ua))

  if (isBot) {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0].trim() ??
      c.req.header('x-real-ip') ??
      'unknown'

    logger.warn('bot/scanner blocked', {
      event: 'bot_blocked',
      ip,
      ua: ua || '[none]',
      path: c.req.path,
      method: c.req.method,
    })

    return c.json({ error: 'Forbidden' }, 403)
  }

  return next()
}

// ── Auth failure tracking ─────────────────────────────────────────────────────

interface FailEntry {
  count: number
  lockedUntil: number | null
  windowStart: number
}

const failStore = new Map<string, FailEntry>()

// Purge stale entries every 30 minutes.
const cleanupTimer = setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of failStore) {
    const expired =
      (entry.lockedUntil === null && entry.windowStart + AUTH_FAIL_WINDOW_MS < now) ||
      (entry.lockedUntil !== null && entry.lockedUntil < now)
    if (expired) failStore.delete(ip)
  }
}, 30 * 60 * 1000)
if (cleanupTimer.unref) cleanupTimer.unref()

/**
 * Record a failed auth attempt for the given IP.
 * Call this from auth middleware whenever token verification fails.
 */
export function trackAuthFailure(ip: string): void {
  const now = Date.now()
  let entry = failStore.get(ip)

  if (!entry || entry.windowStart + AUTH_FAIL_WINDOW_MS < now) {
    entry = { count: 1, lockedUntil: null, windowStart: now }
    failStore.set(ip, entry)
    return
  }

  entry.count++

  if (entry.count >= AUTH_FAIL_MAX && entry.lockedUntil === null) {
    entry.lockedUntil = now + AUTH_FAIL_LOCKOUT_MS
    logger.warn('auth failure lockout triggered', {
      event: 'auth_lockout',
      ip,
      failures: entry.count,
      lockedForMinutes: AUTH_FAIL_LOCKOUT_MS / 60_000,
    })
  }
}

/**
 * Clear the failure record for an IP after a successful authentication.
 * Prevents legitimate users with occasional token issues from staying locked.
 */
export function clearAuthFailures(ip: string): void {
  failStore.delete(ip)
}

/**
 * Check whether the IP is currently locked out.
 * Returns true and sends a 429 response if locked; false otherwise.
 * Call this BEFORE attempting token verification in auth middleware.
 */
export function isAuthLockedOut(ip: string): boolean {
  const entry = failStore.get(ip)
  if (!entry?.lockedUntil) return false
  if (Date.now() < entry.lockedUntil) return true
  // Lock expired — remove entry so the IP can retry
  failStore.delete(ip)
  return false
}

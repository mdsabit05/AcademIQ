/**
 * Structured JSON logger.
 *
 * All output is newline-delimited JSON so log aggregators (Datadog, Logtail,
 * Render Log Streams, etc.) can parse fields without regex heuristics.
 *
 * Fields emitted on every line:
 *   ts      – ISO-8601 timestamp
 *   level   – debug | info | warn | error
 *   msg     – human-readable message
 *   ...rest – any extra key/value pairs passed by the caller
 *
 * Security rules enforced here:
 *   - Never log values whose keys contain "token", "key", "secret",
 *     "password", or "authorization" — they are redacted automatically.
 *   - In development, output is pretty-printed for readability.
 */

type Level = 'debug' | 'info' | 'warn' | 'error'

const IS_PROD = process.env.NODE_ENV === 'production'

// Keys whose values must never appear in logs.
const SENSITIVE_KEYS = /token|secret|password|key|authorization|bearer/i

function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    out[k] = SENSITIVE_KEYS.test(k) ? '[REDACTED]' : v
  }
  return out
}

function write(level: Level, msg: string, extra: Record<string, unknown> = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...redact(extra),
  }

  const line = IS_PROD ? JSON.stringify(entry) : JSON.stringify(entry, null, 2)

  if (level === 'error') {
    process.stderr.write(line + '\n')
  } else {
    process.stdout.write(line + '\n')
  }
}

export const logger = {
  debug: (msg: string, extra?: Record<string, unknown>) => write('debug', msg, extra),
  info:  (msg: string, extra?: Record<string, unknown>) => write('info',  msg, extra),
  warn:  (msg: string, extra?: Record<string, unknown>) => write('warn',  msg, extra),
  error: (msg: string, extra?: Record<string, unknown>) => write('error', msg, extra),
}

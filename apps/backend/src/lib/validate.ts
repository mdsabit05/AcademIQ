/**
 * Lightweight input validation helpers.
 * No external dependencies — intentionally minimal so every caller is explicit.
 */

/** Clamp and validate a pagination offset — must be a non-negative integer. */
export function safeOffset(raw: string | undefined): number {
  const n = Number(raw ?? 0)
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
}

/** Truncate a string to maxLen and strip leading/trailing whitespace. */
export function limitStr(s: string | undefined | null, maxLen: number): string {
  if (!s) return ''
  return s.trim().slice(0, maxLen)
}

/** Return true only if value is one of the allowed enum members. */
export function isEnum<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
}

/** Validate an ISO-8601 date string (YYYY-MM-DD or full ISO timestamp). Returns null on invalid. */
export function isoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  return value
}

/** Sanitize a filename for safe storage — keep letters, digits, spaces, and ._-() */
export function sanitizeFilename(name: string): string {
  return name.replace(/[^\w\s.\-()]/g, '_').slice(0, 255)
}

/**
 * Strip any keys from an object that are not in the allowlist.
 * Returns a new object — does not mutate the original.
 */
export function filterKeys<T extends Record<string, unknown>>(
  obj: T,
  allowedKeys: readonly string[],
): Partial<T> {
  const result: Partial<T> = {}
  for (const key of allowedKeys) {
    if (Object.hasOwn(obj, key)) {
      result[key as keyof T] = obj[key as keyof T]
    }
  }
  return result
}

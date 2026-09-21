/**
 * HTTP security headers middleware.
 *
 * Applied globally before every response. Each header defends against a
 * specific class of attack:
 *
 *  Strict-Transport-Security  — tells browsers to only contact this host over
 *                               HTTPS for the next 2 years (HSTS).
 *  X-Frame-Options            — prevents this API from being embedded in an
 *                               iframe (clickjacking).
 *  X-Content-Type-Options     — stops browsers from MIME-sniffing a response
 *                               away from its declared content-type.
 *  X-XSS-Protection           — legacy header; belt-and-suspenders for older
 *                               browsers that don't honour CSP.
 *  Referrer-Policy            — limits what URL is sent as Referer so paths
 *                               with user IDs don't leak to third parties.
 *  Content-Security-Policy    — for a pure JSON API: allow nothing. The
 *                               frontend has its own CSP via the CDN/host.
 *  Permissions-Policy         — denies all browser feature APIs (geolocation,
 *                               mic, camera, etc.) from this origin.
 *  Cross-Origin-Opener-Policy — isolates the browsing context.
 *
 * HSTS is only emitted when NODE_ENV=production so local dev over HTTP
 * doesn't accidentally lock a browser into HTTPS-only on localhost.
 */

import type { Context, Next } from 'hono'

const IS_PROD = process.env.NODE_ENV === 'production'

export async function securityHeaders(c: Context, next: Next) {
  await next()

  // HSTS: 2-year max-age, cover subdomains, allow preload list submission.
  // Only over HTTPS in production — sending it over HTTP is harmless but
  // meaningful only when the browser first sees it over a secure connection.
  if (IS_PROD) {
    c.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }

  // Clickjacking: never render this API in a frame.
  c.header('X-Frame-Options', 'DENY')

  // MIME sniffing: honour the Content-Type we declare.
  c.header('X-Content-Type-Options', 'nosniff')

  // XSS (legacy browsers).
  c.header('X-XSS-Protection', '1; mode=block')

  // Referrer: only send origin (no path) on cross-origin requests.
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')

  // CSP: this is a JSON API — no scripts, images, fonts, or frames needed.
  c.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")

  // Permissions: deny access to all sensitive browser APIs from this origin.
  c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()')

  // COOP: prevent cross-origin documents from sharing a browsing context.
  c.header('Cross-Origin-Opener-Policy', 'same-origin')
}

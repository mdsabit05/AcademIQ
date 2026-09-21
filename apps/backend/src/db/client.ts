/**
 * PostgreSQL client.
 *
 * SSL policy:
 *   - In production (NODE_ENV=production) or when DATABASE_URL does not
 *     point to localhost, SSL is required and self-signed certificates are
 *     rejected (rejectUnauthorized: true).
 *   - In development against a local DB, SSL is disabled so the standard
 *     `postgresql://localhost/...` URL works without a local certificate.
 *
 * To connect to a remote DB in development, set DATABASE_SSL=true in .env.
 */

import postgres from 'postgres'

const url = process.env.DATABASE_URL!
const isLocal =
  url.includes('localhost') ||
  url.includes('127.0.0.1') ||
  url.includes('::1')

const forceSSL = process.env.DATABASE_SSL === 'true'
const requireSSL = forceSSL || process.env.NODE_ENV === 'production' || !isLocal

const sql = postgres(url, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: requireSSL
    ? { rejectUnauthorized: true }  // verify server certificate in production
    : false,
})

export default sql

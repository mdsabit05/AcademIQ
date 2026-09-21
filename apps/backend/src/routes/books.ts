/**
 * Books routes
 *
 * POST   /books           — upload a PDF (multipart/form-data)
 * GET    /books           — list user's books
 * GET    /books/:id       — get book details + status
 * DELETE /books/:id       — delete book + storage file
 * PATCH  /books/:id       — update title / subject_id
 */

import { Hono } from 'hono'
import { Readable } from 'stream'
import sql from '../db/client.js'
import { storage, bookStorageKey } from '../services/storage.service.js'
import { requireOwnership } from '../middleware/rbac.js'
import { enqueueProcessBook } from '../jobs/worker.js'
import { rateLimit, userKey } from '../middleware/rate-limit.js'
import { limitStr } from '../lib/validate.js'
import type { AuthEnv } from '../middleware/auth.js'

const MAX_FILE_BYTES = 200 * 1024 * 1024 // 200 MB

const books = new Hono<AuthEnv>()

// ── Upload ──────────────────────────────────────────────────────────────────

books.post(
  '/',
  // 10 uploads per user per hour — each upload enqueues an OCR/embedding job.
  rateLimit({ windowMs: 60 * 60_000, max: 10, keyFn: userKey, label: 'book-upload' }),
  async (c) => {
  const dbUserId = c.get('dbUserId')

  let body: Record<string, string | File>
  try {
    body = await c.req.parseBody()
  } catch {
    return c.json({ error: 'Failed to parse multipart body' }, 400)
  }

  const file = body['file']
  if (!file || typeof file === 'string') {
    return c.json({ error: 'No file field in request' }, 400)
  }

  if (file.size > MAX_FILE_BYTES) {
    return c.json({ error: 'File exceeds 200 MB limit' }, 413)
  }

  const originalFilename = file.name || 'upload.pdf'
  let title = (typeof body['title'] === 'string' ? body['title'] : '').trim().slice(0, 500)
  if (!title) title = originalFilename.replace(/\.pdf$/i, '').trim() || 'Untitled'
  const author = (typeof body['author'] === 'string' ? body['author'] : '').trim().slice(0, 200) || null
  const subjectId = (typeof body['subject_id'] === 'string' ? body['subject_id'] : '').trim() || null
  const context: 'student' | 'teacher' = body['context'] === 'teacher' ? 'teacher' : 'student'

  let bookId: string | null = null
  let storageKey: string | null = null

  try {
    const [row] = await sql<[{ id: string }]>`
      INSERT INTO books (owner_id, subject_id, title, author, filename, file_path, status, context)
      VALUES (${dbUserId}, ${subjectId}, ${title}, ${author}, ${originalFilename}, 'placeholder', 'UPLOADING', ${context})
      RETURNING id
    `
    bookId = row.id
    storageKey = bookStorageKey(dbUserId, bookId)
    await sql`UPDATE books SET file_path = ${storageKey} WHERE id = ${bookId}`

    // Convert File to Node.js Readable stream
    const arrayBuffer = await file.arrayBuffer()
    const fileStream = Readable.from(Buffer.from(arrayBuffer))
    const { sizeBytes } = await storage.saveStream(storageKey, fileStream)

    await sql`
      UPDATE books SET status = 'UPLOADED', file_size = ${sizeBytes}, updated_at = now()
      WHERE id = ${bookId}
    `

    await enqueueProcessBook(bookId)
    const [book] = await sql`SELECT * FROM books WHERE id = ${bookId}`
    return c.json({ book }, 201)
  } catch (err) {
    console.error('[books] upload error:', err)
    if (bookId) {
      await sql`UPDATE books SET status = 'FAILED', error_msg = ${String(err).slice(0, 500)} WHERE id = ${bookId}`.catch(() => {})
      if (storageKey) await storage.delete(storageKey).catch(() => {})
    }
    return c.json({ error: 'Upload failed' }, 500)
  }
})

// ── List ────────────────────────────────────────────────────────────────────

books.get('/', async (c) => {
  const dbUserId = c.get('dbUserId')
  const subjectId = c.req.query('subject_id')
  const ctx = c.req.query('context') // 'student' | 'teacher' | undefined

  // Build query conditionally to avoid 42P18 indeterminate-type error from
  // passing null into `IS NULL` — postgres can't infer the param type.
  let rows
  if (subjectId && ctx) {
    rows = await sql`
      SELECT id, title, author, filename, file_size, page_count,
             status, ocr_applied, subject_id, context, created_at, updated_at
      FROM books
      WHERE owner_id = ${dbUserId} AND subject_id = ${subjectId} AND context = ${ctx}
      ORDER BY created_at DESC`
  } else if (subjectId) {
    rows = await sql`
      SELECT id, title, author, filename, file_size, page_count,
             status, ocr_applied, subject_id, context, created_at, updated_at
      FROM books
      WHERE owner_id = ${dbUserId} AND subject_id = ${subjectId}
      ORDER BY created_at DESC`
  } else if (ctx) {
    rows = await sql`
      SELECT id, title, author, filename, file_size, page_count,
             status, ocr_applied, subject_id, context, created_at, updated_at
      FROM books
      WHERE owner_id = ${dbUserId} AND context = ${ctx}
      ORDER BY created_at DESC`
  } else {
    rows = await sql`
      SELECT id, title, author, filename, file_size, page_count,
             status, ocr_applied, subject_id, context, created_at, updated_at
      FROM books
      WHERE owner_id = ${dbUserId}
      ORDER BY created_at DESC`
  }

  return c.json({ books: rows })
})

// ── Get single ──────────────────────────────────────────────────────────────

books.get('/:id', requireOwnership('books', 'id'), async (c) => {
  const [book] = await sql`
    SELECT id, title, author, filename, file_size, page_count,
           status, ocr_applied, error_msg, subject_id, created_at, updated_at
    FROM books WHERE id = ${c.req.param('id')}
  `
  if (!book) return c.json({ error: 'Not found' }, 404)
  return c.json({ book })
})

// ── Update ──────────────────────────────────────────────────────────────────

books.patch('/:id', requireOwnership('books', 'id'), async (c) => {
  const body = await c.req.json<{ title?: string; subject_id?: string | null; author?: string }>()
  const id = c.req.param('id')

  await sql`
    UPDATE books
    SET
      title      = COALESCE(${body.title ? limitStr(body.title, 500) : null}, title),
      author     = COALESCE(${body.author ? limitStr(body.author, 200) : null}, author),
      subject_id = CASE WHEN ${Object.hasOwn(body, 'subject_id')} THEN ${body.subject_id ?? null}
                        ELSE subject_id END,
      updated_at = now()
    WHERE id = ${id}
  `

  const [book] = await sql`SELECT * FROM books WHERE id = ${id}`
  return c.json({ book })
})

// ── Stream file (PDF viewer) ────────────────────────────────────────────────

books.get('/:id/file', requireOwnership('books', 'id'), async (c) => {
  const id = c.req.param('id')

  const [book] = await sql<[{ file_path: string; filename: string; status: string }?]>`
    SELECT file_path, filename, status FROM books WHERE id = ${id}
  `
  if (!book) return c.json({ error: 'Not found' }, 404)
  if (book.status !== 'READY') return c.json({ error: 'File not ready' }, 400)

  const exists = await storage.exists(book.file_path)
  if (!exists) return c.json({ error: 'File not found in storage' }, 404)

  const stream = storage.createReadStream(book.file_path)

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${encodeURIComponent(book.filename)}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  })
})

// ── Delete ──────────────────────────────────────────────────────────────────

books.delete('/:id', requireOwnership('books', 'id'), async (c) => {
  const id = c.req.param('id')

  const [book] = await sql<[{ file_path: string }?]>`
    SELECT file_path FROM books WHERE id = ${id}
  `
  if (!book) return c.json({ error: 'Not found' }, 404)

  // Delete storage file first — if this fails, don't delete the DB row
  await storage.delete(book.file_path)

  await sql`DELETE FROM books WHERE id = ${id}`

  return c.json({ success: true })
})

export default books

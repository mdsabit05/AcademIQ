/**
 * Books routes
 *
 * POST   /books           — upload a PDF (busboy streaming, max 200 MB)
 * GET    /books           — list user's books
 * GET    /books/:id       — get book details + status
 * DELETE /books/:id       — delete book + storage file
 * PATCH  /books/:id       — update title / subject_id
 */

import { Hono } from 'hono'
import busboy from 'busboy'
import type { IncomingMessage, ServerResponse } from 'http'
import sql from '../db/client.js'
import { storage, bookStorageKey } from '../services/storage.service.js'
import { requireOwnership } from '../middleware/rbac.js'
import { enqueueProcessBook } from '../jobs/worker.js'
import type { AuthEnv } from '../middleware/auth.js'

const MAX_FILE_BYTES = 200 * 1024 * 1024 // 200 MB

type BooksEnv = AuthEnv & {
  Bindings: {
    incoming: IncomingMessage
    outgoing: ServerResponse
  }
}

const books = new Hono<BooksEnv>()

// ── Upload ──────────────────────────────────────────────────────────────────

books.post('/', async (c) => {
  const dbUserId = c.get('dbUserId')

  const contentType = c.req.header('content-type') ?? ''
  if (!contentType.includes('multipart/form-data')) {
    return c.json({ error: 'Expected multipart/form-data' }, 400)
  }

  // Access the raw Node.js IncomingMessage to stream via busboy.
  // @hono/node-server exposes this on c.env.incoming
  const rawReq = c.env.incoming
  if (!rawReq) {
    return c.json({ error: 'Streaming upload not supported in this environment' }, 500)
  }

  return new Promise<Response>((resolve) => {
    let title = ''
    let subjectId: string | null = null
    let author: string | null = null
    let context: 'student' | 'teacher' = 'student'
    let originalFilename = ''
    let fileReceived = false
    let fileSizeBytes = 0
    let sizeExceeded = false
    let bookId: string | null = null
    let storageKey: string | null = null

    // Track the async file handler so finish can await it
    let fileHandlerDone: Promise<void> = Promise.resolve()

    const bb = busboy({
      headers: rawReq.headers,
      limits: { files: 1, fileSize: MAX_FILE_BYTES },
    })

    // ── Field handler ───────────────────────────────────────────────────
    bb.on('field', (name, value) => {
      if (name === 'title') title = value.trim().slice(0, 500)
      if (name === 'author') author = value.trim().slice(0, 200) || null
      if (name === 'subject_id') subjectId = value.trim() || null
      if (name === 'context' && value === 'teacher') context = 'teacher'
    })

    // ── File handler ────────────────────────────────────────────────────
    bb.on('file', (fieldname, fileStream, info) => {
      if (fieldname !== 'file') {
        fileStream.resume() // discard
        return
      }

      fileReceived = true
      originalFilename = info.filename || 'upload.pdf'

      if (!title) {
        title = originalFilename.replace(/\.pdf$/i, '').trim() || 'Untitled'
      }

      // Capture the async work in a promise so finish() can await it
      fileHandlerDone = (async () => {
        try {
          const [row] = await sql<[{ id: string }]>`
            INSERT INTO books (owner_id, subject_id, title, author, filename, file_path, status, context)
            VALUES (
              ${dbUserId},
              ${subjectId},
              ${title},
              ${author},
              ${originalFilename},
              'placeholder',
              'UPLOADING',
              ${context}
            )
            RETURNING id
          `
          bookId = row.id
          storageKey = bookStorageKey(dbUserId, bookId)

          // Update file_path now that we have the bookId
          await sql`UPDATE books SET file_path = ${storageKey} WHERE id = ${bookId}`

          // Stream file to storage
          fileStream.on('limit', () => {
            sizeExceeded = true
          })

          const { sizeBytes } = await storage.saveStream(storageKey, fileStream)
          fileSizeBytes = sizeBytes
        } catch (err) {
          console.error('[books] upload error:', err)
          if (bookId) {
            await sql`
              UPDATE books SET status = 'FAILED', error_msg = ${String(err).slice(0, 500)}
              WHERE id = ${bookId}
            `.catch(() => {})
          }
          resolve(c.json({ error: 'Upload failed' }, 500) as unknown as Response)
        }
      })()
    })

    // ── Finish ──────────────────────────────────────────────────────────
    bb.on('finish', async () => {
      // Wait for the async file handler to complete before inspecting state
      await fileHandlerDone

      if (!fileReceived || !bookId) {
        resolve(c.json({ error: 'No file field in request' }, 400) as unknown as Response)
        return
      }

      if (sizeExceeded) {
        // Clean up storage file and DB row for partial upload
        if (storageKey) await storage.delete(storageKey).catch(() => {})
        await sql`DELETE FROM books WHERE id = ${bookId}`.catch(() => {})
        resolve(
          c.json({ error: `File exceeds 200 MB limit` }, 413) as unknown as Response,
        )
        return
      }

      // Update file size and transition to UPLOADED
      await sql`
        UPDATE books
        SET status = 'UPLOADED', file_size = ${fileSizeBytes}, updated_at = now()
        WHERE id = ${bookId}
      `

      // Enqueue background processing
      await enqueueProcessBook(bookId)

      const [book] = await sql`SELECT * FROM books WHERE id = ${bookId}`
      resolve(c.json({ book }, 201) as unknown as Response)
    })

    bb.on('error', async (err) => {
      console.error('[books] busboy error:', err)
      if (bookId) {
        await sql`
          UPDATE books SET status = 'FAILED', error_msg = ${String(err).slice(0, 500)}
          WHERE id = ${bookId}
        `.catch(() => {})
      }
      resolve(c.json({ error: 'Upload processing error' }, 500) as unknown as Response)
    })

    rawReq.pipe(bb)
  })
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
      title      = COALESCE(${body.title ?? null}, title),
      author     = COALESCE(${body.author ?? null}, author),
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

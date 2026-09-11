/**
 * Pipeline Service — orchestrates the full async book processing pipeline.
 *
 * Status transitions:
 *   UPLOADING → UPLOADED → EXTRACTING → OCR (if needed) → CHUNKING
 *   → EMBEDDING → INDEXING → READY
 *   Any step can transition to FAILED with an error message.
 */

import sql from '../db/client.js'
import { storage } from './storage.service.js'
import { extractAndChunk } from './chunker.service.js'
import { embedChunks } from './embedder.service.js'

type BookStatus =
  | 'UPLOADING'
  | 'UPLOADED'
  | 'EXTRACTING'
  | 'OCR'
  | 'CHUNKING'
  | 'EMBEDDING'
  | 'INDEXING'
  | 'READY'
  | 'FAILED'

async function setStatus(
  bookId: string,
  status: BookStatus,
  extra: { error_msg?: string; page_count?: number; ocr_applied?: boolean } = {},
): Promise<void> {
  await sql`
    UPDATE books
    SET
      status     = ${status},
      error_msg  = ${extra.error_msg ?? null},
      page_count = COALESCE(${extra.page_count ?? null}, page_count),
      ocr_applied= COALESCE(${extra.ocr_applied ?? null}, ocr_applied),
      updated_at = now()
    WHERE id = ${bookId}
  `
}

/**
 * Run the full processing pipeline for a book.
 * Called from the pg-boss job handler after upload completes.
 */
export async function processBook(bookId: string): Promise<void> {
  let filePath: string

  try {
    // ── 1. Resolve storage path ──────────────────────────────────────────
    const [book] = await sql<[{ file_path: string; owner_id: string }]>`
      SELECT file_path, owner_id FROM books WHERE id = ${bookId}
    `
    if (!book) throw new Error(`Book ${bookId} not found`)

    const localPath = storage.getLocalPath(book.file_path)
    if (!localPath) throw new Error('Storage provider does not support local paths')
    filePath = localPath
  } catch (err) {
    await setStatus(bookId, 'FAILED', {
      error_msg: `Setup failed: ${String(err)}`,
    })
    return
  }

  try {
    // ── 2. Extract pages (text + OCR detection) ──────────────────────────
    await setStatus(bookId, 'EXTRACTING')

    const { chunks, pageCount, ocrApplied } = await extractAndChunk(filePath)

    if (ocrApplied) {
      await setStatus(bookId, 'OCR', { page_count: pageCount, ocr_applied: true })
    }

    // ── 3. Chunking complete ─────────────────────────────────────────────
    await setStatus(bookId, 'CHUNKING', {
      page_count: pageCount,
      ocr_applied: ocrApplied,
    })

    if (chunks.length === 0) {
      // Empty book — nothing to embed
      await setStatus(bookId, 'READY', { page_count: pageCount, ocr_applied: ocrApplied })
      return
    }

    // ── 4. Embed chunks ──────────────────────────────────────────────────
    await setStatus(bookId, 'EMBEDDING')
    const embeddedChunks = await embedChunks(chunks)

    // ── 5. Index into database ───────────────────────────────────────────
    await setStatus(bookId, 'INDEXING')

    // Delete any stale chunks from a previous failed attempt
    await sql`DELETE FROM chunks WHERE book_id = ${bookId}`

    // Insert all chunks in one multi-row statement
    const rows = embeddedChunks.map((c) => ({
      book_id:     bookId,
      content:     c.content,
      embedding:   JSON.stringify(c.embedding),  // postgres driver serializes as vector literal
      chunk_index: c.chunkIndex,
      page_number: c.pageNumber ?? null,
      chapter:     c.chapter ?? null,
      topic_hint:  c.topicHint ?? null,
      has_ocr:     c.hasOcr,
      token_count: c.tokenCount,
    }))

    // Insert in batches of 500 to avoid parameter limits
    const BATCH = 500
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      await sql`
        INSERT INTO chunks
          (book_id, content, embedding, chunk_index, page_number,
           chapter, topic_hint, has_ocr, token_count)
        SELECT
          r.book_id, r.content,
          r.embedding::vector,
          r.chunk_index::int,
          r.page_number::int,
          r.chapter, r.topic_hint,
          r.has_ocr::boolean,
          r.token_count::int
        FROM json_to_recordset(${JSON.stringify(batch)}::json) AS r(
          book_id text, content text, embedding text,
          chunk_index int, page_number int,
          chapter text, topic_hint text,
          has_ocr boolean, token_count int
        )
      `
    }

    // ── 6. Mark ready ────────────────────────────────────────────────────
    await setStatus(bookId, 'READY', { page_count: pageCount, ocr_applied: ocrApplied })
  } catch (err) {
    console.error(`[pipeline] Book ${bookId} processing failed:`, err)
    await setStatus(bookId, 'FAILED', {
      error_msg: String(err).slice(0, 500),
    })
  }
}

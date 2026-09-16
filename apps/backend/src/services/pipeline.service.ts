/**
 * Pipeline Service — orchestrates the full async book processing pipeline.
 *
 * Status transitions:
 *   UPLOADING → UPLOADED → EXTRACTING → OCR (if needed) → CHUNKING
 *   → EMBEDDING → INDEXING → READY
 *   Any step can transition to FAILED with an error message.
 */

import { mkdirSync, createWriteStream } from 'fs'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { pipeline } from 'stream/promises'
import { tmpdir } from 'os'
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
  let tempFile: string | null = null

  try {
    // ── 1. Resolve storage path ──────────────────────────────────────────
    const [book] = await sql<[{ file_path: string; owner_id: string }]>`
      SELECT file_path, owner_id FROM books WHERE id = ${bookId}
    `
    if (!book) throw new Error(`Book ${bookId} not found`)

    const localPath = storage.getLocalPath(book.file_path)
    if (localPath) {
      filePath = localPath
    } else {
      // Remote storage (B2/S3) — download to a temp file for processing
      const tmpDir = join(tmpdir(), 'academiq-processing')
      mkdirSync(tmpDir, { recursive: true })
      tempFile = join(tmpDir, `${bookId}.pdf`)
      const readStream = storage.createReadStream(book.file_path)
      await pipeline(readStream as NodeJS.ReadableStream, createWriteStream(tempFile))
      filePath = tempFile
    }
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
    // Use sql.unsafe to avoid postgres.js sending uuid as text parameter
    await sql.unsafe(`DELETE FROM chunks WHERE book_id = '${bookId}'::uuid`)

    // Insert chunks using unsafe to avoid uuid/vector type inference issues
    for (const c of embeddedChunks) {
      const embeddingLiteral = `[${c.embedding.join(',')}]`
      await sql.unsafe(
        `INSERT INTO chunks
          (book_id, content, embedding, chunk_index, page_number,
           chapter, topic_hint, has_ocr, token_count)
         VALUES ('${bookId}'::uuid, $1, $2::vector, $3, $4, $5, $6, $7, $8)`,
        [
          c.content,
          embeddingLiteral,
          c.chunkIndex,
          c.pageNumber ?? null,
          c.chapter ?? null,
          c.topicHint ?? null,
          c.hasOcr,
          c.tokenCount,
        ],
      )
    }

    // ── 6. Mark ready ────────────────────────────────────────────────────
    await setStatus(bookId, 'READY', { page_count: pageCount, ocr_applied: ocrApplied })
  } catch (err) {
    console.error(`[pipeline] Book ${bookId} processing failed:`, err)
    await setStatus(bookId, 'FAILED', {
      error_msg: String(err).slice(0, 500),
    })
  } finally {
    // Clean up temp file if we downloaded from remote storage
    if (tempFile) await unlink(tempFile).catch(() => {})
  }
}

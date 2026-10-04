/**
 * Re-embedding Migration Script
 *
 * Run this script AFTER switching the embedding model (e.g. OpenRouter → NVIDIA).
 * It re-embeds all existing chunks using the currently configured model,
 * preserving all user data — nothing is deleted.
 *
 * Usage:
 *   npx tsx src/db/reembed.ts
 *
 * Steps it performs:
 *   1. Resize the embedding column to match the new model's dimensions
 *   2. Re-embed all chunks in batches
 *   3. Update each chunk's embedding in-place
 *
 * Safe to re-run — idempotent per chunk.
 * Chunks are processed in batches of 100 to avoid rate limits.
 */

import sql from './client.js'
import { embedBatch } from '../services/ai.service.js'
import { MODELS } from '../config/models.js'

const BATCH_SIZE = 100

// ── Detect target dimension from a test embedding ────────────────────────────
async function detectDimension(): Promise<number> {
  console.log(`[reembed] Detecting embedding dimension for model: ${MODELS.embed}`)
  const testVec = await embedBatch(['test'])
  const dim = testVec[0].length
  console.log(`[reembed] Detected dimension: ${dim}`)
  return dim
}

// ── Resize column if needed ──────────────────────────────────────────────────
async function resizeColumn(dim: number) {
  const rows = await sql<{ atttypmod: number }[]>`
    SELECT atttypmod FROM pg_attribute
    WHERE attrelid = 'chunks'::regclass AND attname = 'embedding'
  `
  const current = rows[0]?.atttypmod ?? -1
  // pg stores vector(N) as N+4 in atttypmod
  const currentDim = current > 0 ? current - 4 : null

  if (currentDim === dim) {
    console.log(`[reembed] Column already vector(${dim}) — no resize needed.`)
    return
  }

  console.log(`[reembed] Resizing embedding column: ${currentDim ?? '?'} → ${dim}`)
  await sql.unsafe(
    `ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(${dim}) USING NULL`,
  )
  // Drop and recreate index for new dimension
  await sql.unsafe(`DROP INDEX IF EXISTS chunks_embedding_idx`)
  await sql.unsafe(
    `CREATE INDEX chunks_embedding_idx ON chunks
       USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`,
  )
  console.log(`[reembed] Column resized and index recreated.`)
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('[reembed] Starting re-embedding migration...')

  const dim = await detectDimension()
  await resizeColumn(dim)

  // Count total chunks
  const countRows = await sql<{ count: string }[]>`SELECT COUNT(*) as count FROM chunks`
  const total = parseInt(countRows[0].count, 10)
  console.log(`[reembed] Total chunks to re-embed: ${total}`)

  if (total === 0) {
    console.log('[reembed] No chunks found. Done.')
    await sql.end()
    return
  }

  let processed = 0
  let offset = 0

  while (offset < total) {
    const rows = await sql<{ id: string; content: string }[]>`
      SELECT id, content FROM chunks
      ORDER BY created_at ASC
      LIMIT ${BATCH_SIZE} OFFSET ${offset}
    `

    if (rows.length === 0) break

    const texts = rows.map((r) => r.content)
    const vectors = await embedBatch(texts)

    for (let i = 0; i < rows.length; i++) {
      const embeddingLiteral = `[${vectors[i].join(',')}]`
      await sql.unsafe(
        `UPDATE chunks SET embedding = $1::vector WHERE id = $2::uuid`,
        [embeddingLiteral, rows[i].id],
      )
    }

    processed += rows.length
    offset += BATCH_SIZE
    console.log(`[reembed] ${processed}/${total} chunks re-embedded`)
  }

  console.log('[reembed] Migration complete. All chunks re-embedded.')
  await sql.end()
}

main().catch((err) => {
  console.error('[reembed] Migration failed:', err)
  process.exit(1)
})

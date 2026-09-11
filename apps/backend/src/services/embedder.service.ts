/**
 * Embedder Service — converts TextChunks into vector embeddings.
 * Delegates batching to ai.service.embedBatch().
 */

import { embedBatch } from './ai.service.js'
import type { TextChunk } from '../lib/chunker.js'

export interface EmbeddedChunk extends TextChunk {
  embedding: number[]
}

/**
 * Embed all chunks in a document.
 * Preserves all chunk metadata; attaches the vector embedding.
 */
export async function embedChunks(chunks: TextChunk[]): Promise<EmbeddedChunk[]> {
  if (chunks.length === 0) return []

  const texts = chunks.map((c) => c.content)
  const vectors = await embedBatch(texts)

  if (vectors.length !== chunks.length) {
    throw new Error(
      `Embedding count mismatch: expected ${chunks.length}, got ${vectors.length}`,
    )
  }

  return chunks.map((chunk, i) => ({
    ...chunk,
    embedding: vectors[i],
  }))
}

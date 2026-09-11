/**
 * Retrieval Service — vector similarity search via pgvector.
 * Embeds the query, then retrieves the top-N closest chunks.
 * Returns raw candidates for the reranker.
 */

import sql from '../db/client.js'
import { embed } from './ai.service.js'

export interface RetrievedChunk {
  id: string
  bookId: string
  bookTitle: string
  content: string
  pageNumber: number | null
  chapter: string | null
  topicHint: string | null
  hasOcr: boolean
  score: number  // cosine similarity (0–1)
}

/** Default candidate pool before reranking */
const DEFAULT_TOP_K = 20

/**
 * Retrieve the top-K semantically similar chunks for a query.
 * Scoped to the provided book IDs (ownership already verified by the caller).
 *
 * @param query      Natural language question or topic
 * @param bookIds    Books to search within (must already be READY and user-owned)
 * @param topK       Number of candidates to return (default 20)
 */
export async function retrieve(
  query: string,
  bookIds: string[],
  topK = DEFAULT_TOP_K,
): Promise<RetrievedChunk[]> {
  if (bookIds.length === 0) return []

  const queryVector = await embed(query)
  const vectorLiteral = `[${queryVector.join(',')}]`

  const rows = await sql<
    Array<{
      id: string
      book_id: string
      book_title: string
      content: string
      page_number: number | null
      chapter: string | null
      topic_hint: string | null
      has_ocr: boolean
      score: number
    }>
  >`
    SELECT
      c.id,
      c.book_id,
      b.title AS book_title,
      c.content,
      c.page_number,
      c.chapter,
      c.topic_hint,
      c.has_ocr,
      (2 - (c.embedding <=> ${vectorLiteral}::vector)) / 2 AS score
    FROM chunks c
    JOIN books b ON b.id = c.book_id
    WHERE c.book_id = ANY(${bookIds}::uuid[])
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> ${vectorLiteral}::vector
    LIMIT ${topK}
  `

  return rows.map((r) => ({
    id: r.id,
    bookId: r.book_id,
    bookTitle: r.book_title,
    content: r.content,
    pageNumber: r.page_number,
    chapter: r.chapter,
    topicHint: r.topic_hint,
    hasOcr: r.has_ocr,
    score: r.score,
  }))
}

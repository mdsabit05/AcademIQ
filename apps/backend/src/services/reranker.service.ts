/**
 * Reranker Service — LLM-based reranking of retrieved chunks.
 *
 * Takes the top-N candidates from vector search and asks the reranker model
 * to score each one for relevance to the original query.
 * Returns the top-K highest-scoring chunks.
 *
 * Interface is swappable — replace with a cross-encoder without changing
 * the retrieval or context-builder contracts.
 */

import { completeJson } from './ai.service.js'
import { MODELS } from '../config/models.js'
import type { RetrievedChunk } from './retrieval.service.js'

/** Default number of chunks to keep after reranking */
const DEFAULT_TOP_K = 5

interface RerankScore {
  index: number
  score: number  // 0–10, LLM-rated relevance
  reason?: string
}

/**
 * Rerank a list of candidate chunks against the original query.
 * Returns the top-K chunks, sorted by rerank score descending.
 */
export async function rerank(
  query: string,
  candidates: RetrievedChunk[],
  topK = DEFAULT_TOP_K,
): Promise<RetrievedChunk[]> {
  if (candidates.length === 0) return []

  const snippets = candidates.map((c, i) =>
    `[${i}] (${c.bookTitle}${c.pageNumber ? `, p.${c.pageNumber}` : ''})\n${c.content.slice(0, 400)}`,
  )

  const prompt = `You are a relevance reranker. Given a user query and a list of text passages, score each passage from 0 to 10 based on how relevant and useful it is for answering the query.

Query: "${query}"

Passages:
${snippets.join('\n\n')}

Return a JSON array of objects with this exact shape:
[{"index": 0, "score": 8}, {"index": 1, "score": 3}, ...]

Include every passage index. Do not add explanations outside the JSON.`

  let scores: RerankScore[]
  try {
    scores = await completeJson<RerankScore[]>(
      [{ role: 'user', content: prompt }],
      MODELS.reranker,
    )
  } catch (err) {
    console.warn('[reranker] LLM reranking failed, falling back to vector scores:', err)
    // Fallback: return top-K by original vector score if similarity is reasonable
    return [...candidates]
      .filter((c) => c.score >= 0.55)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  }

  // Map scores back to candidates and sort descending
  const scoreMap = new Map(scores.map((s) => [s.index, s.score]))

  const scoredCandidates = candidates
    .map((chunk, i) => ({ chunk, rerankScore: scoreMap.get(i) ?? 0 }))
    .sort((a, b) => b.rerankScore - a.rerankScore)

  // Filter out passages with negligible or zero relevance (score < 2 out of 10)
  const relevant = scoredCandidates.filter((item) => item.rerankScore >= 2)

  return relevant.slice(0, topK).map(({ chunk }) => chunk)
}

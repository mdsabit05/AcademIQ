/**
 * Context Builder Service — assembles RAG context + MAG memory into a
 * structured prompt context string.
 *
 * Called after reranking. Combines:
 *   1. Reranked chunks (citations with book/page metadata)
 *   2. Student memory entries relevant to the topic (MAG)
 */

import type { RetrievedChunk } from './retrieval.service.js'

export interface Citation {
  chunkId: string
  bookTitle: string
  pageNumber: number | null
  snippet: string
}

export interface BuiltContext {
  contextText: string
  citations: Citation[]
}

export interface MemoryEntry {
  memoryType: string
  contextKey: string
  value: unknown
  confidence: number
}

/**
 * Build a formatted context string from reranked chunks and optional memory.
 * The contextText is injected directly into the system prompt.
 */
export function buildContext(
  chunks: RetrievedChunk[],
  memory: MemoryEntry[] = [],
): BuiltContext {
  const citations: Citation[] = []

  const chunkLines = chunks.map((chunk, i) => {
    const ref = `[${i + 1}]`
    const source = [
      chunk.bookTitle,
      chunk.pageNumber ? `p.${chunk.pageNumber}` : null,
      chunk.chapter ?? null,
    ]
      .filter(Boolean)
      .join(', ')

    citations.push({
      chunkId: chunk.id,
      bookTitle: chunk.bookTitle,
      pageNumber: chunk.pageNumber,
      snippet: chunk.content.slice(0, 150),
    })

    return `${ref} [${source}]\n${chunk.content}`
  })

  const contextSection =
    chunkLines.length > 0
      ? `### Reference Material\n${chunkLines.join('\n\n')}`
      : ''

  let memorySection = ''
  if (memory.length > 0) {
    const memLines = memory.map(
      (m) =>
        `- [${m.memoryType}] ${m.contextKey}: ${JSON.stringify(m.value)} (confidence: ${(m.confidence * 100).toFixed(0)}%)`,
    )
    memorySection = `\n\n### Student Memory (Personalisation Context)\n${memLines.join('\n')}`
  }

  return {
    contextText: [contextSection, memorySection].filter(Boolean).join(''),
    citations,
  }
}

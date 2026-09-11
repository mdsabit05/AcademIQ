/**
 * Text chunking algorithm.
 * Splits text into overlapping chunks for RAG indexing.
 * All chunking logic lives here — not delegated to AI.
 */

export interface TextChunk {
  content: string
  chunkIndex: number
  tokenCount: number
  pageNumber?: number
  chapter?: string
  topicHint?: string
  hasOcr: boolean
}

export interface PageText {
  pageNumber: number
  text: string
  isOcr: boolean
  chapter?: string
}

const CHUNK_SIZE = 512    // tokens (approximated as words for simplicity)
const CHUNK_OVERLAP = 50  // tokens of overlap between consecutive chunks

/**
 * Approximate token count: 1 token ≈ 0.75 words (rough GPT tokenization).
 * Good enough for chunking — exact tokenization not required.
 */
function approximateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).length / 0.75)
}

/**
 * Split text into words, then group into chunks of ~CHUNK_SIZE tokens
 * with CHUNK_OVERLAP token overlap between adjacent chunks.
 */
function chunkWords(
  words: string[],
  chunkSizeWords: number,
  overlapWords: number,
): string[] {
  const chunks: string[] = []
  let start = 0

  while (start < words.length) {
    const end = Math.min(start + chunkSizeWords, words.length)
    const chunk = words.slice(start, end).join(' ').trim()
    if (chunk.length > 0) chunks.push(chunk)
    if (end === words.length) break
    start += chunkSizeWords - overlapWords
  }

  return chunks
}

/**
 * Chunk a single page's text into overlapping segments.
 * Preserves page metadata on each chunk.
 */
export function chunkPage(page: PageText, startIndex = 0): TextChunk[] {
  const text = page.text.trim()
  if (!text) return []

  // Approximate word counts from token targets
  const wordsPerChunk = Math.ceil(CHUNK_SIZE * 0.75)
  const overlapWords = Math.ceil(CHUNK_OVERLAP * 0.75)

  const words = text.split(/\s+/).filter(Boolean)
  const chunkTexts = chunkWords(words, wordsPerChunk, overlapWords)

  return chunkTexts.map((content, i) => ({
    content,
    chunkIndex: startIndex + i,
    tokenCount: approximateTokens(content),
    pageNumber: page.pageNumber,
    chapter: page.chapter,
    topicHint: undefined,
    hasOcr: page.isOcr,
  }))
}

/**
 * Chunk all pages from a document into a flat list of TextChunks.
 * Chunk indices are globally sequential across all pages.
 */
export function chunkPages(pages: PageText[]): TextChunk[] {
  const allChunks: TextChunk[] = []

  for (const page of pages) {
    const pageChunks = chunkPage(page, allChunks.length)
    allChunks.push(...pageChunks)
  }

  return allChunks
}

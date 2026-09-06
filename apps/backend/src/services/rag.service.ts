import { generateEmbedding } from './ollama.service.js'
import sql from '../db/client.js'

export interface RetrievedChunk {
  content: string
  similarity: number
}

export async function retrieveChunks(
  query: string,
  documentId: string,
  topK = 5,
  ollamaUrl?: string,
): Promise<RetrievedChunk[]> {
  const embedding = await generateEmbedding(query, ollamaUrl)
  const vectorLiteral = `[${embedding.join(',')}]`

  const rows = await sql<Array<{ content: string; similarity: number }>>`
    SELECT
      content,
      1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
    FROM chunks
    WHERE document_id = ${documentId}
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT ${topK}
  `

  return rows
}

export async function retrieveChunksMulti(
  query: string,
  documentIds: string[],
  topK = 8,
  ollamaUrl?: string,
): Promise<RetrievedChunk[]> {
  const embedding = await generateEmbedding(query, ollamaUrl)
  const vectorLiteral = `[${embedding.join(',')}]`

  const rows = await sql<Array<{ content: string; similarity: number }>>`
    SELECT
      content,
      1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
    FROM chunks
    WHERE document_id = ANY(${documentIds}::uuid[])
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT ${topK}
  `

  return rows
}

export function buildContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map((chunk, i) => `[Chunk ${i + 1}]\n${chunk.content}`)
    .join('\n\n')
}

const DEFAULT_OLLAMA_URL = 'http://localhost:11434'

interface OllamaEmbeddingResponse {
  embedding: number[]
}

export async function generateEmbedding(
  text: string,
  ollamaUrl = DEFAULT_OLLAMA_URL,
): Promise<number[]> {
  const res = await fetch(`${ollamaUrl}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'nomic-embed-text', prompt: text }),
  })

  if (!res.ok) {
    throw new Error(`Ollama embedding failed: ${res.status} ${await res.text()}`)
  }

  const data = (await res.json()) as OllamaEmbeddingResponse
  return data.embedding
}

export async function generateEmbeddings(
  texts: string[],
  ollamaUrl = DEFAULT_OLLAMA_URL,
): Promise<number[][]> {
  // Sequential to avoid overwhelming Ollama
  const results: number[][] = []
  for (const text of texts) {
    results.push(await generateEmbedding(text, ollamaUrl))
  }
  return results
}

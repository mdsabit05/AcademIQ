import pdfParse from 'pdf-parse'

export interface TextChunk {
  content: string
  index: number
}

export async function extractText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const data = await pdfParse(buffer)
  return { text: data.text, pageCount: data.numpages }
}

export function chunkText(text: string, chunkSize = 512, overlap = 50): TextChunk[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0)
  if (words.length === 0) return []

  const chunks: TextChunk[] = []
  let i = 0
  let index = 0

  while (i < words.length) {
    const slice = words.slice(i, i + chunkSize)
    chunks.push({ content: slice.join(' '), index: index++ })
    if (i + chunkSize >= words.length) break
    i += chunkSize - overlap
  }

  return chunks
}

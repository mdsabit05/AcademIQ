import { Hono } from 'hono'
import sql from '../db/client.js'
import { extractText, chunkText } from '../services/pdf.service.js'
import { generateEmbeddings } from '../services/ollama.service.js'
import { authMiddleware, type AuthEnv } from '../middleware/auth.js'

const app = new Hono<AuthEnv>()
app.use('*', authMiddleware)

// POST /api/documents/upload
app.post('/upload', async (c) => {
  const userId = c.get('dbUserId')
  const settings = c.get('userSettings')
  const ollamaUrl = settings.ollamaUrl ?? process.env.OLLAMA_URL ?? 'http://localhost:11434'

  const formData = await c.req.formData()
  const file = formData.get('file') as File | null

  if (!file) return c.json({ error: 'No file provided' }, 400)
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return c.json({ error: 'Only PDF files are supported' }, 400)
  }

  const title = (formData.get('title') as string) || file.name.replace('.pdf', '')

  // Insert document record with 'processing' status
  const [doc] = await sql`
    INSERT INTO documents (user_id, title, filename, status)
    VALUES (${userId}, ${title}, ${file.name}, 'processing')
    RETURNING *
  `

  // Process in background (don't await — return immediately)
  const buffer = Buffer.from(await file.arrayBuffer())
  processDocument(doc.id, buffer, ollamaUrl).catch(console.error)

  return c.json({ document: doc }, 201)
})

async function processDocument(docId: string, buffer: Buffer, ollamaUrl: string) {
  try {
    const { text, pageCount } = await extractText(buffer)
    const chunks = chunkText(text)

    await sql`UPDATE documents SET page_count = ${pageCount} WHERE id = ${docId}`

    if (chunks.length > 0) {
      const contents = chunks.map((c) => c.content)
      const embeddings = await generateEmbeddings(contents, ollamaUrl)

      // Batch insert chunks
      const chunkRows = chunks.map((chunk, i) => ({
        document_id: docId,
        content: chunk.content,
        embedding: `[${embeddings[i].join(',')}]`,
        chunk_index: chunk.index,
      }))

      for (const row of chunkRows) {
        await sql`
          INSERT INTO chunks (document_id, content, embedding, chunk_index)
          VALUES (${row.document_id}, ${row.content}, ${row.embedding}::vector, ${row.chunk_index})
        `
      }
    }

    await sql`UPDATE documents SET status = 'ready' WHERE id = ${docId}`
  } catch (err) {
    console.error('Document processing failed:', err)
    await sql`UPDATE documents SET status = 'failed' WHERE id = ${docId}`
  }
}

// GET /api/documents
app.get('/', async (c) => {
  const userId = c.get('dbUserId')
  const docs = await sql`
    SELECT * FROM documents WHERE user_id = ${userId} ORDER BY created_at DESC
  `
  return c.json({ documents: docs })
})

// DELETE /api/documents/:id
app.delete('/:id', async (c) => {
  const userId = c.get('dbUserId')
  const docId = c.req.param('id')

  const [doc] = await sql`
    DELETE FROM documents WHERE id = ${docId} AND user_id = ${userId} RETURNING id
  `

  if (!doc) return c.json({ error: 'Document not found' }, 404)
  return c.json({ deleted: true })
})

export default app

/**
 * Syllabus routes
 *
 * POST   /syllabus          — upload + AI-parse a syllabus PDF
 * GET    /syllabus          — list user's syllabi
 * GET    /syllabus/:id      — get syllabus + topics
 * DELETE /syllabus/:id      — delete
 */

import { Hono } from 'hono'
import busboy from 'busboy'
import type { IncomingMessage, ServerResponse } from 'http'
import sql from '../db/client.js'
import { storage } from '../services/storage.service.js'
import { requireOwnership } from '../middleware/rbac.js'
import { completeJson } from '../services/ai.service.js'
import { MODELS } from '../config/models.js'
import { extractPages } from '../services/chunker.service.js'
import { recognizePath } from '../services/ocr.service.js'
import type { AuthEnv } from '../middleware/auth.js'

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.tif'])
const IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff'])
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png',
  'image/webp': '.webp', 'image/bmp': '.bmp', 'image/tiff': '.tiff',
}

type SyllabusEnv = AuthEnv & {
  Bindings: {
    incoming: IncomingMessage
    outgoing: ServerResponse
  }
}

const syllabus = new Hono<SyllabusEnv>()

const MAX_SYLLABUS_BYTES = 20 * 1024 * 1024 // 20 MB

syllabus.post('/', async (c) => {
  const dbUserId = c.get('dbUserId')
  const rawReq = c.env.incoming
  if (!rawReq) return c.json({ error: 'Streaming upload not supported' }, 500)

  const contentType = c.req.header('content-type') ?? ''
  if (!contentType.includes('multipart/form-data')) {
    return c.json({ error: 'Expected multipart/form-data' }, 400)
  }

  return new Promise<Response>((resolve) => {
    let title = ''
    let subjectId: string | null = null
    let syllabusId: string | null = null
    let filePath = ''

    const bb = busboy({
      headers: rawReq.headers,
      limits: { files: 1, fileSize: MAX_SYLLABUS_BYTES },
    })

    bb.on('field', (name, value) => {
      if (name === 'title') title = value.trim()
      if (name === 'subject_id') subjectId = value.trim() || null
    })

    bb.on('file', async (fieldname, fileStream, info) => {
      if (fieldname !== 'file') { fileStream.resume(); return }

      const filename = info.filename || 'syllabus'
      const mime = (info.mimeType || '').toLowerCase().split(';')[0].trim()
      // Prefer MIME type for detection — filename extensions on phone uploads can be unreliable
      let ext: string
      if (IMAGE_MIMES.has(mime)) {
        ext = MIME_TO_EXT[mime] ?? '.jpg'
      } else {
        const rawExt = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')).toLowerCase() : ''
        ext = IMAGE_EXTS.has(rawExt) ? rawExt : '.pdf'
      }
      if (!title) title = filename.replace(/\.\w+$/i, '').trim() || 'Syllabus'

      try {
        const [row] = await sql<[{ id: string }]>`
          INSERT INTO syllabi (owner_id, subject_id, title, status)
          VALUES (${dbUserId}, ${subjectId}, ${title}, 'processing')
          RETURNING id
        `
        syllabusId = row.id
        const key = `${dbUserId}/syllabus/${syllabusId}/original${ext}`
        filePath = key

        await sql`UPDATE syllabi SET file_path = ${key} WHERE id = ${syllabusId}`
        await storage.saveStream(key, fileStream)
      } catch (err) {
        fileStream.resume()
        if (syllabusId) {
          await sql`UPDATE syllabi SET status = 'failed' WHERE id = ${syllabusId}`.catch(() => {})
        }
        resolve(c.json({ error: 'Upload failed' }, 500) as unknown as Response)
      }
    })

    bb.on('finish', async () => {
      if (!syllabusId) {
        resolve(c.json({ error: 'No file uploaded' }, 400) as unknown as Response)
        return
      }

      // Parse syllabus asynchronously (non-blocking)
      parseSyllabus(syllabusId, dbUserId, filePath).catch((err) => {
        console.error('[syllabus] parse failed:', err)
        sql`UPDATE syllabi SET status = 'failed' WHERE id = ${syllabusId}`.catch(() => {})
      })

      const [s] = await sql`SELECT * FROM syllabi WHERE id = ${syllabusId}`
      resolve(c.json({ syllabus: s }, 201) as unknown as Response)
    })

    bb.on('error', (err) => {
      console.error('[syllabus] busboy error:', err)
      resolve(c.json({ error: 'Upload error' }, 500) as unknown as Response)
    })

    rawReq.pipe(bb)
  })
})

async function parseSyllabus(syllabusId: string, _userId: string, fileKey: string) {
  const localPath = storage.getLocalPath(fileKey)
  if (!localPath) return

  const ext = localPath.slice(localPath.lastIndexOf('.')).toLowerCase()
  let text: string
  if (IMAGE_EXTS.has(ext)) {
    console.log(`[syllabus] OCR processing image: ${ext}`)
    text = (await recognizePath(localPath)).slice(0, 8000)
    console.log(`[syllabus] OCR extracted ${text.length} chars`)
  } else {
    const { pages } = await extractPages(localPath)
    text = pages.map((p) => p.text).join('\n').slice(0, 8000)
  }

  const prompt = `Extract the syllabus structure from this text as a flat JSON array of topics.

Text:
${text}

Return JSON array only:
[
  {"unit": "Unit 1", "topic": "Introduction to X", "subtopic": null, "order_index": 0},
  ...
]
unit can be null if not applicable. Include all topics and subtopics.`

  const topics = await completeJson<Array<{
    unit?: string | null
    topic: string
    subtopic?: string | null
    order_index: number
  }>>([{ role: 'user', content: prompt }], MODELS.light)

  if (!Array.isArray(topics)) throw new Error('AI returned invalid topics')

  for (const t of topics) {
    await sql`
      INSERT INTO syllabus_topics (syllabus_id, unit, topic, subtopic, order_index)
      VALUES (${syllabusId}, ${t.unit ?? null}, ${t.topic}, ${t.subtopic ?? null}, ${t.order_index ?? 0})
    `
  }

  await sql`UPDATE syllabi SET status = 'ready' WHERE id = ${syllabusId}`
}

syllabus.get('/', async (c) => {
  const dbUserId = c.get('dbUserId')
  const rows = await sql`
    SELECT id, title, status, subject_id, created_at
    FROM syllabi WHERE owner_id = ${dbUserId}
    ORDER BY created_at DESC
  `
  return c.json({ syllabi: rows })
})

syllabus.get('/:id', requireOwnership('syllabi', 'id'), async (c) => {
  const id = c.req.param('id')
  const [s] = await sql`SELECT * FROM syllabi WHERE id = ${id}`
  if (!s) return c.json({ error: 'Not found' }, 404)

  const topics = await sql`
    SELECT id, unit, topic, subtopic, order_index, completed
    FROM syllabus_topics WHERE syllabus_id = ${id}
    ORDER BY order_index
  `
  return c.json({ syllabus: s, topics })
})

syllabus.patch('/:id/topics/:topicId', requireOwnership('syllabi', 'id'), async (c) => {
  const id = c.req.param('id')
  const topicId = c.req.param('topicId')
  const body = await c.req.json<{ completed: boolean }>()
  if (typeof body.completed !== 'boolean') return c.json({ error: 'completed must be boolean' }, 400)

  const [topic] = await sql`
    UPDATE syllabus_topics SET completed = ${body.completed}
    WHERE id = ${topicId} AND syllabus_id = ${id}
    RETURNING id, completed
  `
  if (!topic) return c.json({ error: 'Not found' }, 404)
  return c.json({ topic })
})

syllabus.delete('/:id', requireOwnership('syllabi', 'id'), async (c) => {
  const id = c.req.param('id')
  const [s] = await sql<[{ file_path: string | null }?]>`
    SELECT file_path FROM syllabi WHERE id = ${id}
  `
  if (!s) return c.json({ error: 'Not found' }, 404)

  if (s.file_path) await storage.delete(s.file_path).catch(() => {})
  await sql`DELETE FROM syllabi WHERE id = ${id}`
  return c.json({ success: true })
})

export default syllabus

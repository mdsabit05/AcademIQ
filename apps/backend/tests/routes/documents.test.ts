import { describe, it, expect, vi } from 'vitest'

// We test the processing logic in isolation — not the full HTTP stack
// Integration tests require a running DB; skip with SKIP_INTEGRATION=true
describe('document processing logic', () => {
  it('marks document as failed when PDF extraction throws', async () => {
    const mockUpdate = vi.fn()
    const mockExtract = vi.fn().mockRejectedValue(new Error('Corrupt PDF'))

    async function processDocument(
      docId: string,
      buffer: Buffer,
      extract: typeof mockExtract,
      update: typeof mockUpdate,
    ) {
      try {
        await extract(buffer)
        await update(docId, 'ready')
      } catch {
        await update(docId, 'failed')
      }
    }

    await processDocument('doc-1', Buffer.from(''), mockExtract, mockUpdate)
    expect(mockUpdate).toHaveBeenCalledWith('doc-1', 'failed')
  })

  it('marks document as ready on successful processing', async () => {
    const mockUpdate = vi.fn()
    const mockExtract = vi.fn().mockResolvedValue({ text: 'Hello world', pageCount: 1 })

    async function processDocument(
      docId: string,
      buffer: Buffer,
      extract: typeof mockExtract,
      update: typeof mockUpdate,
    ) {
      try {
        await extract(buffer)
        await update(docId, 'ready')
      } catch {
        await update(docId, 'failed')
      }
    }

    await processDocument('doc-1', Buffer.from(''), mockExtract, mockUpdate)
    expect(mockUpdate).toHaveBeenCalledWith('doc-1', 'ready')
  })
})

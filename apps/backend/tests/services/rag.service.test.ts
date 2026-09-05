import { describe, it, expect } from 'vitest'
import { buildContext } from '../../src/services/rag.service.js'

// Note: retrieveChunks requires a live DB + Ollama — test buildContext only

describe('buildContext', () => {
  it('formats chunks into numbered sections', () => {
    const chunks = [
      { content: 'First chunk content.', similarity: 0.9 },
      { content: 'Second chunk content.', similarity: 0.8 },
    ]
    const result = buildContext(chunks)
    expect(result).toBe('[Chunk 1]\nFirst chunk content.\n\n[Chunk 2]\nSecond chunk content.')
  })

  it('returns empty string for empty chunks array', () => {
    expect(buildContext([])).toBe('')
  })

  it('handles a single chunk', () => {
    const chunks = [{ content: 'Only chunk.', similarity: 0.95 }]
    expect(buildContext(chunks)).toBe('[Chunk 1]\nOnly chunk.')
  })
})

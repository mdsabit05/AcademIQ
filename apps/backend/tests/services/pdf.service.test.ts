import { describe, it, expect } from 'vitest'
import { chunkText } from '../../src/services/pdf.service.js'

describe('chunkText', () => {
  it('returns empty array for empty string', () => {
    expect(chunkText('')).toEqual([])
  })

  it('returns empty array for whitespace-only string', () => {
    expect(chunkText('   \n\t  ')).toEqual([])
  })

  it('returns a single chunk when text is shorter than chunkSize', () => {
    const text = 'short text here'
    const chunks = chunkText(text, 512, 50)
    expect(chunks).toHaveLength(1)
    expect(chunks[0].content).toBe('short text here')
    expect(chunks[0].index).toBe(0)
  })

  it('splits long text into multiple chunks', () => {
    const words = Array.from({ length: 600 }, (_, i) => `word${i}`)
    const text = words.join(' ')
    const chunks = chunkText(text, 512, 50)
    expect(chunks.length).toBeGreaterThan(1)
  })

  it('each chunk has at most chunkSize words', () => {
    const text = Array.from({ length: 1200 }, (_, i) => `word${i}`).join(' ')
    const chunks = chunkText(text, 512, 50)
    for (const chunk of chunks) {
      expect(chunk.content.split(' ').length).toBeLessThanOrEqual(512)
    }
  })

  it('uses 50-word overlap between consecutive chunks', () => {
    const text = Array.from({ length: 600 }, (_, i) => `word${i}`).join(' ')
    const chunks = chunkText(text, 512, 50)
    const lastWordsOfFirst = chunks[0].content.split(' ').slice(-50)
    const firstWordsOfSecond = chunks[1].content.split(' ').slice(0, 50)
    expect(lastWordsOfFirst).toEqual(firstWordsOfSecond)
  })

  it('assigns sequential index values', () => {
    const text = Array.from({ length: 1200 }, (_, i) => `word${i}`).join(' ')
    const chunks = chunkText(text, 512, 50)
    chunks.forEach((chunk, i) => {
      expect(chunk.index).toBe(i)
    })
  })
})

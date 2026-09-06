import { describe, it, expect } from 'vitest'
import { groupByDocument } from './groupNotes.ts'
import type { NoteWithTitle } from 'shared'

const notes: NoteWithTitle[] = [
  { id: '1', user_id: 'u', document_id: 'd1', document_title: 'Physics', topic: 'Waves', content: 'A', created_at: '2026-01-01T00:00:00Z' },
  { id: '2', user_id: 'u', document_id: 'd1', document_title: 'Physics', topic: 'Waves', content: 'B', created_at: '2026-01-02T00:00:00Z' },
  { id: '3', user_id: 'u', document_id: 'd2', document_title: 'Maths', topic: 'Calculus', content: 'C', created_at: '2026-01-03T00:00:00Z' },
]

describe('groupByDocument', () => {
  it('groups notes by document_title then topic', () => {
    const grouped = groupByDocument(notes)
    expect(Object.keys(grouped)).toEqual(['Physics', 'Maths'])
    expect(Object.keys(grouped['Physics'])).toEqual(['Waves'])
    expect(grouped['Physics']['Waves']).toHaveLength(2)
    expect(grouped['Maths']['Calculus']).toHaveLength(1)
  })

  it('returns empty object for empty input', () => {
    expect(groupByDocument([])).toEqual({})
  })

  it('handles multiple topics within one document', () => {
    const mixed: NoteWithTitle[] = [
      { id: '1', user_id: 'u', document_id: 'd1', document_title: 'Bio', topic: 'Cells', content: 'X', created_at: '' },
      { id: '2', user_id: 'u', document_id: 'd1', document_title: 'Bio', topic: 'DNA', content: 'Y', created_at: '' },
    ]
    const grouped = groupByDocument(mixed)
    expect(Object.keys(grouped['Bio'])).toHaveLength(2)
  })
})

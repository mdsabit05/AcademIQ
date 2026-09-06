import { describe, it, expect } from 'vitest'
import { groupIntoSets, sendCardToEnd } from './groupFlashcards.ts'
import type { Flashcard } from 'shared'

function makeCard(overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id: 'c1', user_id: 'u', document_id: 'd1', topic: 'Waves',
    question: 'Q?', answer: 'A.', pass_count: 0, fail_count: 0,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('groupIntoSets', () => {
  it('groups cards by documentId + topic', () => {
    const cards = [
      makeCard({ id: '1', document_id: 'd1', topic: 'Waves' }),
      makeCard({ id: '2', document_id: 'd1', topic: 'Waves' }),
      makeCard({ id: '3', document_id: 'd1', topic: 'Light' }),
      makeCard({ id: '4', document_id: 'd2', topic: 'Waves' }),
    ]
    const sets = groupIntoSets(cards)
    expect(sets).toHaveLength(3)
    const wavesD1 = sets.find((s) => s.documentId === 'd1' && s.topic === 'Waves')
    expect(wavesD1?.cards).toHaveLength(2)
  })

  it('computes weakCount as cards where fail_count > pass_count', () => {
    const cards = [
      makeCard({ id: '1', pass_count: 0, fail_count: 2 }),
      makeCard({ id: '2', pass_count: 3, fail_count: 1 }),
    ]
    const sets = groupIntoSets(cards)
    expect(sets[0].weakCount).toBe(1)
  })

  it('returns empty array for empty input', () => {
    expect(groupIntoSets([])).toEqual([])
  })
})

describe('sendCardToEnd', () => {
  it('moves the card at index to the end of the deck', () => {
    const cards = [makeCard({ id: '1' }), makeCard({ id: '2' }), makeCard({ id: '3' })]
    const result = sendCardToEnd(cards, 0)
    expect(result.map((c) => c.id)).toEqual(['2', '3', '1'])
  })

  it('does not mutate the original array', () => {
    const cards = [makeCard({ id: '1' }), makeCard({ id: '2' })]
    sendCardToEnd(cards, 0)
    expect(cards[0].id).toBe('1')
  })

  it('handles last index (card already at end)', () => {
    const cards = [makeCard({ id: '1' }), makeCard({ id: '2' })]
    const result = sendCardToEnd(cards, 1)
    expect(result.map((c) => c.id)).toEqual(['1', '2'])
  })
})

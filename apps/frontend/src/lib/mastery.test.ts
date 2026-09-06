import { describe, it, expect } from 'vitest'
import { computeMastery } from './mastery.ts'
import type { Document, TestAttempt } from 'shared'

type AttemptRow = TestAttempt & { document_id: string; document_title: string; topic: string }

const makeDoc = (id: string, title: string): Document => ({
  id, user_id: 'u1', title, filename: 'f.pdf',
  page_count: 1, status: 'ready', created_at: '2026-01-01T00:00:00Z',
})

const makeAttempt = (docId: string, score: number, total: number, date = '2026-02-01T00:00:00Z'): AttemptRow => ({
  id: Math.random().toString(), test_id: 't1', user_id: 'u1',
  document_id: docId, document_title: 'x', topic: 'x',
  answers: {}, score, total_marks: total,
  time_elapsed_seconds: 60, tab_switches: 0,
  started_at: date, submitted_at: date,
})

describe('computeMastery', () => {
  it('returns pct -1 for document with no attempts', () => {
    const docs = [makeDoc('d1', 'Doc 1')]
    const result = computeMastery(docs, [])
    expect(result['d1'].pct).toBe(-1)
  })

  it('calculates correct average percentage', () => {
    const docs = [makeDoc('d1', 'Doc 1')]
    const attempts = [makeAttempt('d1', 8, 10), makeAttempt('d1', 6, 10)]
    const result = computeMastery(docs, attempts)
    expect(result['d1'].pct).toBe(70)
  })

  it('rounds to nearest integer', () => {
    const docs = [makeDoc('d1', 'Doc 1')]
    const attempts = [makeAttempt('d1', 1, 3), makeAttempt('d1', 2, 3)]
    const result = computeMastery(docs, attempts)
    expect(result['d1'].pct).toBe(50)
  })

  it('tracks lastActivity as most recent submitted_at', () => {
    const docs = [makeDoc('d1', 'Doc 1')]
    const attempts = [
      makeAttempt('d1', 8, 10, '2026-01-01T00:00:00Z'),
      makeAttempt('d1', 6, 10, '2026-03-01T00:00:00Z'),
    ]
    const result = computeMastery(docs, attempts)
    expect(result['d1'].lastActivity).toBe('2026-03-01T00:00:00Z')
  })

  it('handles multiple documents independently', () => {
    const docs = [makeDoc('d1', 'A'), makeDoc('d2', 'B')]
    const attempts = [makeAttempt('d1', 9, 10), makeAttempt('d2', 4, 10)]
    const result = computeMastery(docs, attempts)
    expect(result['d1'].pct).toBe(90)
    expect(result['d2'].pct).toBe(40)
  })
})

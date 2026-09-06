import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useExplanations } from './useExplanations.ts'
import type { TestQuestion, TestAttempt } from 'shared'

const mockFetch = vi.fn()
global.fetch = mockFetch

function makeReadableStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let i = 0
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i++]))
      } else {
        controller.close()
      }
    },
  })
}

const mockQuestions: TestQuestion[] = [
  {
    id: 'q1',
    test_id: 't1',
    question: 'What is 1NF?',
    options: ['Atomic values', 'No repeating'],
    correct_answer: 'Atomic values',
    marks: 1,
    order_index: 0,
  },
  {
    id: 'q2',
    test_id: 't1',
    question: 'Define a relation.',
    options: null,
    correct_answer: 'A set of tuples',
    marks: 2,
    order_index: 1,
  },
]

const mockAttempt: TestAttempt = {
  id: 'a1',
  test_id: 't1',
  user_id: 'u1',
  answers: { q1: 'Atomic values', q2: 'Wrong answer' }, // q1 correct, q2 wrong
  score: 1,
  total_marks: 3,
  time_elapsed_seconds: 60,
  tab_switches: 0,
  started_at: '2026-09-06T00:00:00Z',
  submitted_at: '2026-09-06T00:01:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useExplanations', () => {
  it('does not fetch when there are no wrong answers', async () => {
    const allCorrect = { ...mockAttempt, answers: { q1: 'Atomic values', q2: 'A set of tuples' } }
    renderHook(() => useExplanations(mockQuestions, allCorrect, 'doc-1', 'token'))
    await new Promise((r) => setTimeout(r, 50))
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('fetches only for wrong answers (not correct ones)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: makeReadableStream(['data: {"token":"Because"}\n']),
    })

    renderHook(() => useExplanations(mockQuestions, mockAttempt, 'doc-1', 'token'))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1) // only q2 is wrong
    })

    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/ask')
    const body = JSON.parse(options.body)
    expect(body.documentId).toBe('doc-1')
    expect(body.message).toContain('A set of tuples') // correct answer in message
    expect(body.message).toContain('Wrong answer')    // user's answer in message
    expect(body.history).toEqual([])
  })

  it('accumulates streamed tokens into explanation text', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: makeReadableStream([
        'data: {"token":"The correct"}\n',
        'data: {"token":" answer is"}\n',
        'data: {"token":" 1NF."}\n',
      ]),
    })

    const { result } = renderHook(() =>
      useExplanations(mockQuestions, mockAttempt, 'doc-1', 'token'),
    )

    await waitFor(() => {
      expect(result.current.explanations['q2']).toBe('The correct answer is 1NF.')
    })
  })

  it('does not fetch when documentId is empty', () => {
    renderHook(() => useExplanations(mockQuestions, mockAttempt, '', 'token'))
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

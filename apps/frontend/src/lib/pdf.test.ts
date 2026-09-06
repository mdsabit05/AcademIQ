import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock jspdf before importing pdf.ts
const mockSave = vi.fn()
const mockText = vi.fn()
const mockLine = vi.fn()
const mockAddPage = vi.fn()
const mockSetFontSize = vi.fn()
const mockSetFont = vi.fn()
const mockSetLineWidth = vi.fn()
const mockSetDrawColor = vi.fn()
const mockSplitTextToSize = vi.fn((text: string) => [text])

vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    save: mockSave,
    text: mockText,
    line: mockLine,
    addPage: mockAddPage,
    setFontSize: mockSetFontSize,
    setFont: mockSetFont,
    setLineWidth: mockSetLineWidth,
    setDrawColor: mockSetDrawColor,
    splitTextToSize: mockSplitTextToSize,
    internal: { pageSize: { getHeight: () => 297 } },
  })),
}))

import { generateExamPaper } from './pdf.ts'
import type { Test, TestQuestion } from 'shared'

const mockTest: Test = {
  id: 'test-1',
  user_id: 'user-1',
  document_id: 'doc-1',
  topic: 'Normalization',
  question_count: 2,
  type: 'mcq',
  difficulty: 'medium',
  created_at: '2026-09-06T00:00:00Z',
}

const mockQuestions: TestQuestion[] = [
  {
    id: 'q1',
    test_id: 'test-1',
    question: 'What is 1NF?',
    options: ['Atomic values', 'No repeating groups', 'Both A and B', 'None'],
    correct_answer: 'Atomic values',
    marks: 1,
    order_index: 0,
  },
  {
    id: 'q2',
    test_id: 'test-1',
    question: 'Define a relation.',
    options: null,
    correct_answer: 'A set of tuples',
    marks: 2,
    order_index: 1,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('generateExamPaper', () => {
  it('calls doc.save with a filename containing the topic', () => {
    generateExamPaper(mockTest, mockQuestions, 'DB Notes')
    expect(mockSave).toHaveBeenCalledWith(expect.stringContaining('normalization'))
  })

  it('writes MCQ options as A/B/C/D', () => {
    generateExamPaper(mockTest, mockQuestions, 'DB Notes')
    const allTextArgs = mockText.mock.calls.map((c) => String(c[0]))
    const hasOptionA = allTextArgs.some((t) => t.includes('□ A.'))
    expect(hasOptionA).toBe(true)
  })

  it('does not include correct answers in the rendered text', () => {
    generateExamPaper(mockTest, mockQuestions, 'DB Notes')
    const allTextArgs = mockText.mock.calls.map((c) => String(c[0]))
    // "Atomic values" should only appear as an MCQ option label, not standalone
    // The correct_answer field should never be written as a standalone text call
    const hasStandaloneCorrectAnswer = allTextArgs.some((t) => t === 'Atomic values')
    expect(hasStandaloneCorrectAnswer).toBe(false)
  })

  it('draws blank lines for non-MCQ questions based on marks count', () => {
    generateExamPaper(mockTest, mockQuestions, 'DB Notes')
    // q2 has marks=2 and options=null → 2 blank lines drawn via line()
    expect(mockLine.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})

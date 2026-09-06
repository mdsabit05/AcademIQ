# Phase 2A Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four UX features: Document Status Indicator, Repeat Weak Topics, PDF Exam Paper Export, and Wrong Answer Explanations.

**Architecture:** All four features are isolated additions — no refactoring of existing code. Task 1 is a verification (already implemented). Tasks 2–3 each touch backend + frontend in sequence. Task 4–5 are pure frontend additions.

**Tech Stack:** React 18, Tailwind, Hono backend, PostgreSQL (postgres.js), jspdf (new dep), Vitest + jsdom.

---

## File Map

| File | Role |
|---|---|
| `packages/shared/src/types.ts` | Add `topicDocumentMap` to `ProgressResponse` |
| `apps/backend/src/routes/progress.ts` | SQL query for topic→documentId map |
| `apps/frontend/src/pages/Progress.tsx` | "Test Me →" per weak topic + "Start Revision Test" button |
| `apps/frontend/src/pages/TestNew.tsx` | Pre-fill topic from `state.topic` |
| `apps/frontend/src/lib/pdf.ts` | New — `generateExamPaper()` client-side PDF |
| `apps/frontend/src/pages/TestResults.tsx` | PDF download button + explanations rendering |
| `apps/frontend/src/lib/useExplanations.ts` | New — parallel AI explanation streams per wrong question |
| `apps/frontend/src/lib/pdf.test.ts` | Tests for PDF generation logic |
| `apps/frontend/src/lib/useExplanations.test.ts` | Tests for explanation hook |

---

## Task 1: Document Status Indicator — Verify Already Implemented

**Files:**
- Read: `apps/frontend/src/components/DocumentCard.tsx`
- Read: `apps/frontend/src/pages/Materials.tsx`

This feature was already built. `DocumentCard` has `STATUS_CONFIG` with `Loader2` (spinning) for `processing` and `AlertCircle` (red) for `failed`. The `Open` button already only renders when `status === 'ready'`. `Materials.tsx` already has the polling `useEffect` that fires every 3s while any doc is processing and clears itself when all docs are settled.

- [ ] **Step 1: Verify the implementation is complete**

Read both files and confirm:
- `DocumentCard.tsx` line 11–15: `STATUS_CONFIG` has `processing` → `Loader2` with `animate-spin`, `failed` → `AlertCircle` with `text-danger`
- `Materials.tsx` lines 30–35: `useEffect` that does `setInterval(loadDocuments, 3000)` when `hasProcessing`, cleared on cleanup

- [ ] **Step 2: Commit**

```bash
cd /home/coder/main
git add apps/frontend/src/components/DocumentCard.tsx apps/frontend/src/pages/Materials.tsx
git commit -m "docs: document status indicator already implemented in Phase 1 scaffold"
```

> **Note:** If there are no staged changes (feature is already committed), skip this step.

---

## Task 2: Repeat Weak Topics — Backend (shared types + progress route)

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `apps/backend/src/routes/progress.ts`

- [ ] **Step 1: Add `topicDocumentMap` to shared ProgressResponse type**

In `packages/shared/src/types.ts`, update `ProgressResponse` (currently lines 121–128):

```typescript
export interface ProgressResponse {
  testsCompleted: number
  topicsLearned: number
  averageScore: number
  studyTimeSeconds: number
  topicPerformance: Array<{ topic: string; score: number; attempts: number }>
  topicsToReview: string[]
  topicDocumentMap: Record<string, string>
}
```

- [ ] **Step 2: Run the TypeScript check to confirm the type change compiles**

```bash
cd /home/coder/main/packages/shared
npx tsc --noEmit
```

Expected: no output (clean compile).

- [ ] **Step 3: Add the SQL query and field in progress.ts**

In `apps/backend/src/routes/progress.ts`, add the query after the existing `topicRows` query (before building the response object), and add the field to the response:

The full updated file:

```typescript
import { Hono } from 'hono'
import { authMiddleware, type AuthEnv } from '../middleware/auth.js'
import sql from '../db/client.js'
import type { ProgressResponse } from 'shared'

const app = new Hono<AuthEnv>()
app.use('*', authMiddleware)

app.get('/', async (c) => {
  const userId = c.get('dbUserId')

  // Aggregate stats from test_attempts
  const [stats] = await sql<Array<{
    tests_completed: number
    avg_score_pct: number
    total_time_seconds: number
  }>>`
    SELECT
      COUNT(*)::int                                          AS tests_completed,
      COALESCE(AVG(score::float / NULLIF(total_marks, 0) * 100), 0) AS avg_score_pct,
      COALESCE(SUM(time_elapsed_seconds), 0)::int           AS total_time_seconds
    FROM test_attempts
    WHERE user_id = ${userId}
  `

  // Topics learned = distinct topics from test_attempts + learn chat messages
  const [topicsRow] = await sql<Array<{ count: number }>>`
    SELECT COUNT(DISTINCT topic)::int AS count
    FROM (
      SELECT t.topic
      FROM test_attempts ta
      JOIN tests t ON ta.test_id = t.id
      WHERE ta.user_id = ${userId}
      UNION
      SELECT content AS topic
      FROM chat_messages
      WHERE user_id = ${userId} AND mode = 'learn' AND role = 'user'
    ) combined
  `

  // Per-topic performance
  const topicRows = await sql<Array<{ topic: string; score: number; attempts: number }>>`
    SELECT
      t.topic,
      ROUND(AVG(ta.score::float / NULLIF(ta.total_marks, 0) * 100))::int AS score,
      COUNT(*)::int AS attempts
    FROM test_attempts ta
    JOIN tests t ON ta.test_id = t.id
    WHERE ta.user_id = ${userId}
    GROUP BY t.topic
    ORDER BY score DESC
  `

  // Most recent document_id per topic (for "Test Me" navigation)
  const topicDocRows = await sql<Array<{ topic: string; document_id: string }>>`
    SELECT DISTINCT ON (t.topic) t.topic, t.document_id
    FROM test_attempts ta
    JOIN tests t ON ta.test_id = t.id
    WHERE ta.user_id = ${userId}
    ORDER BY t.topic, ta.submitted_at DESC
  `

  const topicsToReview = topicRows
    .filter((t) => t.score < 70)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((t) => t.topic)

  const topicDocumentMap: Record<string, string> = {}
  for (const row of topicDocRows) {
    topicDocumentMap[row.topic] = row.document_id
  }

  const response: ProgressResponse = {
    testsCompleted: stats.tests_completed,
    topicsLearned: topicsRow.count,
    averageScore: Math.round(stats.avg_score_pct),
    studyTimeSeconds: stats.total_time_seconds,
    topicPerformance: topicRows,
    topicsToReview,
    topicDocumentMap,
  }

  return c.json(response)
})

export default app
```

- [ ] **Step 4: Build the backend to check for TypeScript errors**

```bash
cd /home/coder/main/apps/backend
npx tsc --noEmit
```

Expected: no output (clean compile).

- [ ] **Step 5: Commit**

```bash
cd /home/coder/main
git add packages/shared/src/types.ts apps/backend/src/routes/progress.ts
git commit -m "feat: add topicDocumentMap to progress API for weak topic navigation"
```

---

## Task 3: Repeat Weak Topics — Frontend (Progress + TestNew)

**Files:**
- Modify: `apps/frontend/src/pages/Progress.tsx`
- Modify: `apps/frontend/src/pages/TestNew.tsx`

- [ ] **Step 1: Update Progress.tsx to add "Test Me →" per weak topic**

Replace the entire "Topics to review" section (lines 231–246 in current `Progress.tsx`):

Find this block:
```tsx
      {/* Topics to review */}
      {data.topicsToReview.length > 0 && (
        <div className="mb-8 rounded-xl border border-amber-DEFAULT/30 bg-amber-muted p-6">
          <h2 className="mb-4 font-semibold text-amber-DEFAULT">⚠ Topics to Review</h2>
          <ol className="mb-4 list-inside list-decimal space-y-2">
            {data.topicsToReview.map((t) => (
              <li key={t} className="text-sm text-white">{t}</li>
            ))}
          </ol>
          <button
            onClick={() => navigate('/test/new')}
            className="rounded-lg bg-amber-DEFAULT px-4 py-2 text-sm font-semibold text-bg hover:opacity-90"
          >
            Start Revision
          </button>
        </div>
      )}
```

Replace with:
```tsx
      {/* Topics to review */}
      {data.topicsToReview.length > 0 && (
        <div className="mb-8 rounded-xl border border-amber-DEFAULT/30 bg-amber-muted p-6">
          <h2 className="mb-4 font-semibold text-amber-DEFAULT">⚠ Topics to Review</h2>
          <ol className="mb-4 list-inside list-decimal space-y-2">
            {data.topicsToReview.map((t) => (
              <li key={t} className="flex items-center justify-between text-sm text-white">
                <span>{t}</span>
                <button
                  onClick={() => navigate('/test/new', {
                    state: { topic: t, documentId: data.topicDocumentMap[t] },
                  })}
                  className="ml-4 shrink-0 rounded-lg border border-amber-DEFAULT/50 px-3 py-1 text-xs font-medium text-amber-DEFAULT hover:bg-amber-DEFAULT/10"
                >
                  Test Me →
                </button>
              </li>
            ))}
          </ol>
          <button
            onClick={() => {
              const weakest = data.topicsToReview[data.topicsToReview.length - 1]
              navigate('/test/new', {
                state: { topic: weakest, documentId: data.topicDocumentMap[weakest] },
              })
            }}
            className="rounded-lg bg-amber-DEFAULT px-4 py-2 text-sm font-semibold text-bg hover:opacity-90"
          >
            Start Revision Test →
          </button>
        </div>
      )}
```

- [ ] **Step 2: Update TestNew.tsx to pre-fill topic from state**

In `TestNew.tsx`, the `useEffect` that loads documents already reads `state?.documentId`. Add `state?.topic` to the form initialization.

Find:
```typescript
      const defaultDoc = state?.documentId ?? (ready.length > 0 ? ready[0].id : '')
      setForm((f) => ({ ...f, documentId: defaultDoc }))
```

Replace with:
```typescript
      const defaultDoc = state?.documentId ?? (ready.length > 0 ? ready[0].id : '')
      setForm((f) => ({
        ...f,
        documentId: defaultDoc,
        topic: state?.topic ?? f.topic,
      }))
```

- [ ] **Step 3: Build the frontend TypeScript check**

```bash
cd /home/coder/main/apps/frontend
npx tsc --noEmit
```

Expected: no output (clean compile).

- [ ] **Step 4: Commit**

```bash
cd /home/coder/main
git add apps/frontend/src/pages/Progress.tsx apps/frontend/src/pages/TestNew.tsx
git commit -m "feat: repeat weak topics — Test Me button per topic + Start Revision Test"
```

---

## Task 4: PDF Exam Paper Export

**Files:**
- Create: `apps/frontend/src/lib/pdf.ts`
- Create: `apps/frontend/src/lib/pdf.test.ts`
- Modify: `apps/frontend/src/pages/TestResults.tsx`
- Modify: `apps/frontend/package.json` (install jspdf)

- [ ] **Step 1: Install jspdf**

```bash
cd /home/coder/main
pnpm --filter frontend add jspdf
```

Expected output includes `+ jspdf` in the added packages list.

- [ ] **Step 2: Write the failing test**

Create `apps/frontend/src/lib/pdf.test.ts`:

```typescript
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
    expect(mockSave).toHaveBeenCalledWith(expect.stringContaining('Normalization'))
  })

  it('writes MCQ options as A/B/C/D', () => {
    generateExamPaper(mockTest, mockQuestions, 'DB Notes')
    const allTextCalls = mockText.mock.calls.map((c) => String(c[0]))
    const hasOptionA = allTextCalls.some((t) => t.includes('□ A.'))
    expect(hasOptionA).toBe(true)
  })

  it('does not include correct answers in the output', () => {
    generateExamPaper(mockTest, mockQuestions, 'DB Notes')
    const allTextCalls = mockText.mock.calls.map((c) => String(c[0]))
    const hasCorrectAnswer = allTextCalls.some((t) => t.includes('Atomic values'))
    expect(hasCorrectAnswer).toBe(false)
  })

  it('draws blank lines for non-MCQ questions based on marks count', () => {
    generateExamPaper(mockTest, mockQuestions, 'DB Notes')
    // q2 has marks=2 and options=null, so 2 blank lines (2 line() calls)
    expect(mockLine).toHaveBeenCalledTimes(expect.any(Number))
    expect(mockLine.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd /home/coder/main/apps/frontend
pnpm test -- --reporter=verbose 2>&1 | grep -A5 "pdf"
```

Expected: FAIL — `Cannot find module './pdf.ts'`

- [ ] **Step 4: Implement pdf.ts**

Create `apps/frontend/src/lib/pdf.ts`:

```typescript
import jsPDF from 'jspdf'
import type { Test, TestQuestion } from 'shared'

export function generateExamPaper(test: Test, questions: TestQuestion[], docTitle: string): void {
  const doc = new jsPDF()
  const margin = 20
  const pageHeight = doc.internal.pageSize.getHeight()
  let y = margin

  // Header
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Note2Test — Exam Paper', margin, y)
  y += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Topic: ${test.topic}`, margin, y)
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 140, y)
  y += 6
  doc.text(`Document: ${docTitle}`, margin, y)
  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0)
  doc.text(`Total Marks: ${totalMarks}`, 140, y)
  y += 4

  doc.setLineWidth(0.3)
  doc.line(margin, y, 190, y)
  y += 8

  const letters = ['A', 'B', 'C', 'D']

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    const lines = doc.splitTextToSize(`${i + 1}. ${q.question}`, 155)

    // Estimate height needed: question lines + options or blank lines
    const optionHeight = q.options ? q.options.length * 6 : q.marks * 8
    const needed = lines.length * 6 + optionHeight + 10

    if (y + needed > pageHeight - margin) {
      doc.addPage()
      y = margin
    }

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(lines, margin, y)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`[${q.marks} mark${q.marks !== 1 ? 's' : ''}]`, 185, y, { align: 'right' })
    y += lines.length * 6 + 2

    if (q.options && q.options.length > 0) {
      for (let idx = 0; idx < q.options.length; idx++) {
        const optLines = doc.splitTextToSize(`□ ${letters[idx]}. ${q.options[idx]}`, 148)
        doc.text(optLines, margin + 6, y)
        y += optLines.length * 5 + 1
      }
    } else {
      doc.setDrawColor(180, 180, 180)
      for (let l = 0; l < q.marks; l++) {
        doc.line(margin + 6, y + 2, 185, y + 2)
        y += 8
      }
    }
    y += 6
  }

  const filename = `exam-${test.topic.replace(/\s+/g, '-').toLowerCase()}.pdf`
  doc.save(filename)
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /home/coder/main/apps/frontend
pnpm test -- --reporter=verbose 2>&1 | grep -E "(pdf|PASS|FAIL|✓|✗)"
```

Expected: all 4 pdf tests pass.

- [ ] **Step 6: Add "Download Paper" button to TestResults.tsx**

In `TestResults.tsx`:

Add the import at the top (after existing imports):
```typescript
import { generateExamPaper } from '../lib/pdf.ts'
```

Add state for the test object. Change the existing load function — currently it only stores `questions` from `res`. Add `test` state and store `res.test`:

Add this state line (after `const [questions, setQuestions] = useState<TestQuestion[]>([])`):
```typescript
  const [test, setTest] = useState<import('shared').Test | null>(null)
  const [docTitle, setDocTitle] = useState('')
```

In the `load` function, after `setQuestions(res.questions)` (currently line 20):
```typescript
      setTest(res.test)
```

Also fetch document title — add after the `attemptsRes` fetch:
```typescript
      const docsRes = await makeApi(token).documents.list()
      const doc = docsRes.documents.find((d) => d.id === res.test.document_id)
      setDocTitle(doc?.title ?? '')
```

Add the Download button to the bottom action bar. Find the existing action bar:
```tsx
      <div className="mt-8 flex gap-3">
        <button
          onClick={() => navigate('/test/new')}
          className="flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-muted hover:text-white"
        >
          <RotateCcw size={15} /> New Test
        </button>
```

Replace with:
```tsx
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          onClick={() => navigate('/test/new')}
          className="flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-muted hover:text-white"
        >
          <RotateCcw size={15} /> New Test
        </button>
        {test && questions.length > 0 && (
          <button
            onClick={() => generateExamPaper(test, questions, docTitle)}
            className="flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-muted hover:text-white"
          >
            📄 Download Paper
          </button>
        )}
```

Also add the `Test` import to the shared import at the top. Current import:
```typescript
import type { TestAttempt, TestQuestion } from 'shared'
```
Change to:
```typescript
import type { Test, TestAttempt, TestQuestion } from 'shared'
```

- [ ] **Step 7: TypeScript check**

```bash
cd /home/coder/main/apps/frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd /home/coder/main
git add apps/frontend/src/lib/pdf.ts apps/frontend/src/lib/pdf.test.ts apps/frontend/src/pages/TestResults.tsx apps/frontend/package.json pnpm-lock.yaml
git commit -m "feat: PDF exam paper export — blank printable paper from test results"
```

---

## Task 5: Wrong Answer Explanations

**Files:**
- Create: `apps/frontend/src/lib/useExplanations.ts`
- Create: `apps/frontend/src/lib/useExplanations.test.ts`
- Modify: `apps/frontend/src/pages/TestResults.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/frontend/src/lib/useExplanations.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useExplanations } from './useExplanations.ts'
import type { TestQuestion, TestAttempt } from 'shared'

// Mock fetch
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
  it('does not fetch if no wrong answers', async () => {
    const allCorrectAttempt = { ...mockAttempt, answers: { q1: 'Atomic values', q2: 'A set of tuples' } }
    renderHook(() => useExplanations(mockQuestions, allCorrectAttempt, 'doc-1', 'token'))
    await new Promise((r) => setTimeout(r, 50))
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('fetches explanation only for wrong answers', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: makeReadableStream(['data: {"token":"Because"}\n', 'data: {"token":" 1NF"}\n']),
    })

    const { result } = renderHook(() =>
      useExplanations(mockQuestions, mockAttempt, 'doc-1', 'token'),
    )

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1) // only q2 is wrong
    })

    // Verify fetch was called for q2 (wrong question), not q1 (correct)
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/ask')
    const body = JSON.parse(options.body)
    expect(body.documentId).toBe('doc-1')
    expect(body.message).toContain('A set of tuples') // correct answer
    expect(body.message).toContain('Wrong answer')    // user's answer
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

  it('returns empty explanations when documentId is empty', () => {
    renderHook(() => useExplanations(mockQuestions, mockAttempt, '', 'token'))
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/coder/main/apps/frontend
pnpm test -- --reporter=verbose 2>&1 | grep -A3 "useExplanations"
```

Expected: FAIL — `Cannot find module './useExplanations.ts'`

- [ ] **Step 3: Implement useExplanations.ts**

Create `apps/frontend/src/lib/useExplanations.ts`:

```typescript
import { useState, useEffect, useRef } from 'react'
import type { TestQuestion, TestAttempt } from 'shared'

async function streamExplanation(
  documentId: string,
  question: TestQuestion,
  userAnswer: string,
  token: string,
  onToken: (t: string) => void,
): Promise<void> {
  const message =
    `Explain why "${question.correct_answer}" is correct for: "${question.question}". ` +
    `The user answered "${userAnswer}".`

  const res = await fetch('/api/ask', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ documentId, message, history: [] }),
  })

  if (!res.ok || !res.body) return

  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    for (const line of chunk.split('\n').filter((l) => l.startsWith('data: '))) {
      try {
        const t: string = JSON.parse(line.slice(6)).token ?? ''
        if (t) onToken(t)
      } catch {
        // skip malformed SSE lines
      }
    }
  }
}

export function useExplanations(
  questions: TestQuestion[],
  attempt: TestAttempt | null,
  documentId: string,
  token: string,
): { explanations: Record<string, string> } {
  const [explanations, setExplanations] = useState<Record<string, string>>({})
  const started = useRef(false)

  useEffect(() => {
    if (!attempt || !documentId || !token || questions.length === 0 || started.current) return
    started.current = true

    const wrongQuestions = questions.filter((q) => {
      const userAnswer = (attempt.answers as Record<string, string>)[q.id] ?? ''
      return userAnswer.trim().toLowerCase() !== q.correct_answer.trim().toLowerCase()
    })

    for (const q of wrongQuestions) {
      const userAnswer = (attempt.answers as Record<string, string>)[q.id] ?? ''
      streamExplanation(documentId, q, userAnswer, token, (t) => {
        setExplanations((prev) => ({ ...prev, [q.id]: (prev[q.id] ?? '') + t }))
      })
    }
  }, [questions, attempt, documentId, token])

  return { explanations }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/coder/main/apps/frontend
pnpm test -- --reporter=verbose 2>&1 | grep -E "(useExplanations|PASS|FAIL|✓|✗)"
```

Expected: all 4 useExplanations tests pass.

- [ ] **Step 5: Update TestResults.tsx to show explanations**

The TestResults.tsx was already updated in Task 4 (added `test` state, `docTitle` state, fetched doc title, added import of `Test`). Now extend it further.

**5a. Add token state and useExplanations**

Add these imports at the top (alongside existing imports):
```typescript
import StreamingText from '../components/StreamingText.tsx'
import { useExplanations } from '../lib/useExplanations.ts'
```

Add state for token (add after existing state declarations):
```typescript
  const [authToken, setAuthToken] = useState('')
```

In the `load` function (inside the `async function load()`), after `const token = await getToken()` and `if (!token || !testId) return`, add:
```typescript
      setAuthToken(token)
```

Add the hook call (after existing state declarations, before the `if (!attempt)` guard):
```typescript
  const { explanations } = useExplanations(questions, attempt, test?.document_id ?? '', authToken)
```

**5b. Render explanation under wrong answers**

In the question review map, find the block that renders wrong answers (after `{!correct && (...)}`):

Currently:
```tsx
                  {!correct && (
                    <p className="mt-1 text-xs text-muted">
                      Correct: <span className="text-success">{q.correct_answer}</span>
                    </p>
                  )}
```

Replace with:
```tsx
                  {!correct && (
                    <>
                      <p className="mt-1 text-xs text-muted">
                        Correct: <span className="text-success">{q.correct_answer}</span>
                      </p>
                      {explanations[q.id] && (
                        <div className="mt-3 rounded-lg border border-border bg-surface/60 px-3 py-2 text-xs text-muted">
                          <p className="mb-1 font-semibold text-primary">AI Explanation</p>
                          <StreamingText
                            text={explanations[q.id]}
                            streaming={false}
                          />
                        </div>
                      )}
                      {!explanations[q.id] && authToken && (test?.document_id) && (
                        <p className="mt-2 text-xs text-muted italic">Loading explanation...</p>
                      )}
                    </>
                  )}
```

- [ ] **Step 6: TypeScript check**

```bash
cd /home/coder/main/apps/frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Run full test suite**

```bash
cd /home/coder/main/apps/frontend
pnpm test
```

Expected: all tests pass (theme: 7, voice: 4, mastery: 5, pdf: 4, useExplanations: 4 = 24 total).

- [ ] **Step 8: Commit**

```bash
cd /home/coder/main
git add apps/frontend/src/lib/useExplanations.ts apps/frontend/src/lib/useExplanations.test.ts apps/frontend/src/pages/TestResults.tsx
git commit -m "feat: wrong answer AI explanations — stream per-question explanation on test results"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Document Status Indicator — spinner + polling | Task 1 (already implemented) |
| Repeat Weak Topics — "Test Me →" per topic | Task 3 (Progress.tsx) |
| Repeat Weak Topics — "Start Revision Test" button | Task 3 (Progress.tsx) |
| Repeat Weak Topics — topicDocumentMap from backend | Task 2 (progress.ts + shared types) |
| Repeat Weak Topics — TestNew reads state.topic | Task 3 (TestNew.tsx) |
| PDF Export — install jspdf | Task 4 (Step 1) |
| PDF Export — generateExamPaper() | Task 4 (pdf.ts) |
| PDF Export — "Download Paper" button on TestResults | Task 4 (TestResults.tsx) |
| PDF — no correct answers, blank exam paper | Task 4 (pdf.ts, options rendered without correct_answer) |
| Wrong Answer Explanations — stream for each wrong question | Task 5 (useExplanations.ts) |
| Wrong Answer Explanations — parallel streams | Task 5 (for...of with no await on outer loop) |
| Wrong Answer Explanations — StreamingText per question | Task 5 (TestResults.tsx) |

**Placeholder scan:** No TBDs. All code steps include complete implementations.

**Type consistency:** `topicDocumentMap: Record<string, string>` used consistently in `ProgressResponse` (shared types), `progress.ts` response, and `Progress.tsx` (`data.topicDocumentMap[t]`). `Test` type used in TestResults state and passed to `generateExamPaper`. `useExplanations` parameter types match what TestResults provides.

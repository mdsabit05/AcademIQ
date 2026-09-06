# Phase 2A Features Design — Note2Test
**Date:** 2026-09-06
**Scope:** Document Status Indicator, Wrong Answer Explanations, PDF Export, Repeat Weak Topics

---

## 1. Document Status Indicator

### Goal
Show real-time feedback on the Materials page when a document is still being processed (text extraction + embedding). Currently the card shows nothing special for processing docs.

### Behaviour
- Documents with `status === 'processing'` show a spinner + "Processing..." label instead of normal action buttons
- Documents with `status === 'failed'` show a red "Failed" badge
- A polling loop runs every 3 seconds while any document is in `processing` state
- Polling stops automatically once all documents reach `ready` or `failed`
- No backend changes needed — `GET /api/documents` already returns `status`

### Implementation
- In `Materials.tsx`, add a `useEffect` that checks if any doc has `status === 'processing'`
- If yes, set a `setInterval` (3s) that re-calls `api.documents.list()` and updates state
- Clear interval when component unmounts or when no processing docs remain
- DocumentCard UI: replace action buttons with spinner + "Processing..." when status is processing

---

## 2. Wrong Answer Explanations

### Goal
After a test is submitted, automatically show an AI-generated explanation under each question the user answered incorrectly. Helps users understand mistakes immediately without having to navigate elsewhere.

### Behaviour
- TestResults page loads questions + user's answers (already fetched)
- For each wrong answer, fire a streaming request to `POST /api/ask`
- Payload: `{ documentId, message: "Explain why '{correct_answer}' is correct for: '{question}'. The user answered '{user_answer}'.", history: [] }`
- All wrong-answer explanations start streaming in parallel after results render
- Each explanation renders under its question using `<StreamingText streaming={true} />`
- Correct answers show a green checkmark only — no explanation needed

### Data flow
- TestResults already has: `attempt.answers`, `questions[]`, `attempt.score`
- `documentId` needs to be fetched — add it to the test results API response or fetch via `GET /api/test/:testId` (already returns `test.document_id`)
- No new backend routes needed — reuses `/api/ask`

### Implementation
- In `TestResults.tsx`, after data loads, identify wrong answers: `questions.filter(q => attempt.answers[q.id] !== q.correct_answer)`
- For each wrong question, call `stream('/api/ask', { documentId, message, history: [] }, token)` 
- Store per-question streaming text in `Record<string, string>` state keyed by `question.id`
- Use a custom hook `useExplanations(questions, attempt, documentId, token)` to keep logic out of the component

---

## 3. PDF Exam Paper Export

### Goal
Allow users to download a clean, printable exam paper from any test they've generated.

### Behaviour
- "Download PDF" button on the TestResults page (and optionally TestTake)
- PDF contains: header (topic, document name, date, total marks), numbered questions, MCQ options lettered A/B/C/D with checkboxes, blank lines for written answer questions
- No correct answers included — this is a blank exam paper for revision
- Generated entirely client-side using `jspdf`

### PDF Layout
```
Note2Test — Exam Paper
Topic: [topic name]          Date: [date]
Document: [doc title]        Total Marks: [N]
─────────────────────────────────────────────
1. [Question text]                    [marks] marks
   □ A. Option 1
   □ B. Option 2
   □ C. Option 3
   □ D. Option 4

2. [Question text]                    [marks] marks
   _______________________________________________
   _______________________________________________
```

### Implementation
- Install `jspdf` in frontend
- `lib/pdf.ts` — `generateExamPaper(test: Test, questions: TestQuestion[]): void` — creates and downloads PDF
- Button in `TestResults.tsx` — "📄 Download Paper" — calls `generateExamPaper`
- No backend changes needed

---

## 4. Repeat Weak Topics

### Goal
Make it one click to start a test on a weak topic from the Progress page, removing friction from the revision loop.

### Behaviour
- In the "Topics to Review" section, each topic gets a "Test Me →" button
- Clicking navigates to `/test/new` with `state: { topic, documentId }` pre-filled
  - `documentId` is looked up from progress data — the document associated with that topic's most recent test attempt
- A "Start Revision Test" button at the bottom of the weak topics list picks the weakest topic (lowest score) and does the same navigation automatically
- `TestNew.tsx` already reads `state.documentId` and `state.topic` from Phase 1 — just need to add `state.topic` reading

### Data needed
- Progress API returns `topicsToReview: string[]` (topic names only, no documentId)
- Need to also return `topicDocumentMap: Record<string, string>` — maps topic → documentId for the most recent attempt on that topic
- Add this to `GET /api/progress` response (one extra SQL query joining test_attempts → tests)
- Update `ProgressResponse` type in shared types

### Implementation
- `apps/backend/src/routes/progress.ts` — add query for topic→documentId map
- `packages/shared/src/types.ts` — add `topicDocumentMap: Record<string, string>` to `ProgressResponse`
- `apps/frontend/src/pages/Progress.tsx` — add "Test Me →" per topic + "Start Revision Test" button
- `apps/frontend/src/pages/TestNew.tsx` — read `state.topic` and pre-fill topic input

---

## Implementation Order

1. **Document Status Indicator** — pure frontend, no deps, fastest
2. **Repeat Weak Topics** — small backend change + frontend navigation
3. **PDF Export** — install jspdf, pure client-side
4. **Wrong Answer Explanations** — most complex, streams multiple AI calls

---

## Files Changed

| File | Change |
|---|---|
| `apps/frontend/src/pages/Materials.tsx` | Add polling loop + processing UI |
| `apps/frontend/src/pages/Progress.tsx` | Add "Test Me" + "Start Revision" buttons |
| `apps/frontend/src/pages/TestNew.tsx` | Read `state.topic` and pre-fill |
| `apps/frontend/src/pages/TestResults.tsx` | Add PDF button + wrong answer explanations |
| `apps/frontend/src/lib/pdf.ts` | New — exam paper PDF generator |
| `apps/frontend/src/lib/useExplanations.ts` | New — hook for parallel AI explanation streams |
| `apps/backend/src/routes/progress.ts` | Add topicDocumentMap to response |
| `packages/shared/src/types.ts` | Add topicDocumentMap to ProgressResponse |
| `apps/frontend/package.json` | Add jspdf dependency |

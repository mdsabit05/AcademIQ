# Phase 2B Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three features — Notes (save highlighted text from LearnSession), Multi-Document Test (generate tests from multiple docs), and Flashcard Mode (AI-generated flip-card study sessions).

**Architecture:** Notes and Flashcards add new DB tables and backend routes following the existing Hono/postgres.js pattern. Multi-doc extends the existing test route with an optional `documentIds[]` field and a new RAG retrieval function. All frontend pages follow existing patterns (useAuth, makeApi, useNavigate).

**Tech Stack:** React 18, Tailwind, Hono backend, PostgreSQL (postgres.js), Vitest + jsdom. No new npm packages.

---

## File Map

| File | Role |
|---|---|
| `apps/backend/src/db/schema.sql` | Add `notes`, `flashcards` tables; `document_ids` column on `tests` |
| `packages/shared/src/types.ts` | Add `Note`, `NoteWithTitle`, `Flashcard`, `GenerateFlashcardsRequest`; extend `GenerateTestRequest` |
| `apps/backend/src/routes/notes.ts` | New — POST/GET/DELETE for notes |
| `apps/backend/src/routes/flashcards.ts` | New — generate/list/attempt/delete for flashcards |
| `apps/backend/src/prompts/flashcard.prompt.ts` | New — LLM prompt for Q&A pair generation |
| `apps/backend/src/services/rag.service.ts` | Add `retrieveChunksMulti` for multi-doc RAG |
| `apps/backend/src/routes/test.ts` | Support `documentIds[]` in generate route |
| `apps/backend/src/index.ts` | Register `/api/notes` and `/api/flashcards` routes |
| `apps/frontend/src/lib/api.ts` | Add `notes` and `flashcards` API methods |
| `apps/frontend/src/lib/groupNotes.ts` | New — `groupByDocument` pure utility |
| `apps/frontend/src/lib/groupNotes.test.ts` | Tests for `groupByDocument` |
| `apps/frontend/src/lib/groupFlashcards.ts` | New — `groupIntoSets` and `sendCardToEnd` utilities |
| `apps/frontend/src/lib/groupFlashcards.test.ts` | Tests for `groupIntoSets` and `sendCardToEnd` |
| `apps/frontend/src/pages/Notes.tsx` | New — notes list page grouped by document/topic |
| `apps/frontend/src/pages/LearnSession.tsx` | Add mouseup selection + floating Save button + toast |
| `apps/frontend/src/pages/TestNew.tsx` | Add multi-doc toggle + checkbox list |
| `apps/frontend/src/pages/Flashcards.tsx` | New — flashcard sets list page |
| `apps/frontend/src/pages/FlashcardsNew.tsx` | New — create set form |
| `apps/frontend/src/pages/FlashcardsStudy.tsx` | New — study session with CSS flip animation |
| `apps/frontend/src/App.tsx` | Register 4 new routes |
| `apps/frontend/src/components/layout/Sidebar.tsx` | Add Flashcards + Notes nav links |

---

## Task 1: Schema Migrations

**Files:**
- Modify: `apps/backend/src/db/schema.sql`

- [ ] **Step 1: Add new tables and column to schema.sql**

Append these lines to the bottom of `apps/backend/src/db/schema.sql`:

```sql
ALTER TABLE tests ADD COLUMN IF NOT EXISTS document_ids text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  topic        TEXT NOT NULL,
  content      TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flashcards (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  topic        TEXT NOT NULL,
  question     TEXT NOT NULL,
  answer       TEXT NOT NULL,
  pass_count   INT NOT NULL DEFAULT 0,
  fail_count   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

- [ ] **Step 2: Run migration**

```bash
cd /home/coder/main
pnpm migrate
```

Expected output:
```
Running migrations...
Migrations complete.
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/db/schema.sql
git commit -m "feat: schema — add notes, flashcards tables and document_ids column on tests"
```

---

## Task 2: Shared Types

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add new types and extend GenerateTestRequest**

In `packages/shared/src/types.ts`, add after the existing `ProgressResponse` interface:

```typescript
export interface Note {
  id: string
  user_id: string
  document_id: string
  topic: string
  content: string
  created_at: string
}

export interface NoteWithTitle extends Note {
  document_title: string
}

export interface Flashcard {
  id: string
  user_id: string
  document_id: string
  topic: string
  question: string
  answer: string
  pass_count: number
  fail_count: number
  created_at: string
}

export interface GenerateFlashcardsRequest {
  documentId: string
  topic: string
  count: number
}
```

Also extend `GenerateTestRequest` (find the existing interface and add the optional field):

```typescript
export interface GenerateTestRequest {
  documentId: string
  documentIds?: string[]   // add this line
  topic: string
  count: number
  type: TestType
  difficulty: Difficulty
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd /home/coder/main && apps/frontend/node_modules/.bin/tsc --noEmit -p apps/frontend/tsconfig.json 2>&1
```

Expected: no output (clean compile).

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: shared types — Note, NoteWithTitle, Flashcard, GenerateFlashcardsRequest; extend GenerateTestRequest"
```

---

## Task 3: Notes Backend

**Files:**
- Create: `apps/backend/src/routes/notes.ts`
- Modify: `apps/backend/src/index.ts`

- [ ] **Step 1: Create notes route**

Create `apps/backend/src/routes/notes.ts`:

```typescript
import { Hono } from 'hono'
import { authMiddleware, type AuthEnv } from '../middleware/auth.js'
import sql from '../db/client.js'
import type { Note, NoteWithTitle } from 'shared'

const app = new Hono<AuthEnv>()
app.use('*', authMiddleware)

app.post('/', async (c) => {
  const userId = c.get('dbUserId')
  const { documentId, topic, content } = await c.req.json<{
    documentId: string
    topic: string
    content: string
  }>()
  const [note] = await sql<Note[]>`
    INSERT INTO notes (user_id, document_id, topic, content)
    VALUES (${userId}, ${documentId}, ${topic}, ${content})
    RETURNING *
  `
  return c.json({ note }, 201)
})

app.get('/', async (c) => {
  const userId = c.get('dbUserId')
  const notes = await sql<NoteWithTitle[]>`
    SELECT n.*, d.title AS document_title
    FROM notes n
    JOIN documents d ON n.document_id = d.id
    WHERE n.user_id = ${userId}
    ORDER BY n.created_at DESC
  `
  return c.json({ notes })
})

app.delete('/:id', async (c) => {
  const userId = c.get('dbUserId')
  const id = c.req.param('id')
  await sql`DELETE FROM notes WHERE id = ${id} AND user_id = ${userId}`
  return c.json({ deleted: true })
})

export default app
```

- [ ] **Step 2: Register route in index.ts**

In `apps/backend/src/index.ts`, add after the existing import for `settingsRoute`:

```typescript
import notesRoute from './routes/notes.js'
```

And add after `app.route('/api/settings', settingsRoute)`:

```typescript
app.route('/api/notes', notesRoute)
```

- [ ] **Step 3: Verify backend compiles**

```bash
cd /home/coder/main && apps/backend/node_modules/.bin/tsc --noEmit -p apps/backend/tsconfig.json 2>&1 | grep -v "rootDir"
```

Expected: no output other than the pre-existing rootDir warnings about test files.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/routes/notes.ts apps/backend/src/index.ts
git commit -m "feat: notes backend — POST/GET/DELETE routes at /api/notes"
```

---

## Task 4: Notes Frontend — groupNotes utility + Notes page

**Files:**
- Create: `apps/frontend/src/lib/groupNotes.ts`
- Create: `apps/frontend/src/lib/groupNotes.test.ts`
- Create: `apps/frontend/src/pages/Notes.tsx`
- Modify: `apps/frontend/src/lib/api.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/frontend/src/lib/groupNotes.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/coder/main/apps/frontend && node_modules/.bin/vitest run --reporter=verbose 2>&1 | grep -E "(groupNotes|FAIL|Error)" | head -5
```

Expected: FAIL — `Cannot find module './groupNotes.ts'`

- [ ] **Step 3: Implement groupNotes.ts**

Create `apps/frontend/src/lib/groupNotes.ts`:

```typescript
import type { NoteWithTitle } from 'shared'

export function groupByDocument(
  notes: NoteWithTitle[],
): Record<string, Record<string, NoteWithTitle[]>> {
  const grouped: Record<string, Record<string, NoteWithTitle[]>> = {}
  for (const note of notes) {
    if (!grouped[note.document_title]) grouped[note.document_title] = {}
    if (!grouped[note.document_title][note.topic]) grouped[note.document_title][note.topic] = []
    grouped[note.document_title][note.topic].push(note)
  }
  return grouped
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/coder/main/apps/frontend && node_modules/.bin/vitest run --reporter=verbose 2>&1 | grep -E "(groupNotes|Tests)" | head -5
```

Expected: `✓ src/lib/groupNotes.test.ts (3 tests)`

- [ ] **Step 5: Add notes methods to api.ts**

In `apps/frontend/src/lib/api.ts`, add these imports at the top:

```typescript
import type {
  // ... existing imports ...
  Note,
  NoteWithTitle,
  Flashcard,
  GenerateFlashcardsRequest,
} from 'shared'
```

Add inside the `makeApi` return object, after `progress`:

```typescript
    notes: {
      create: (body: { documentId: string; topic: string; content: string }) =>
        apiFetch<{ note: Note }>('/notes', token, {
          method: 'POST',
          body: JSON.stringify(body),
        }),
      list: () => apiFetch<{ notes: NoteWithTitle[] }>('/notes', token),
      delete: (id: string) =>
        apiFetch<{ deleted: boolean }>(`/notes/${id}`, token, { method: 'DELETE' }),
    },
```

- [ ] **Step 6: Create Notes.tsx page**

Create `apps/frontend/src/pages/Notes.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import { Trash2, BookMarked } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import { groupByDocument } from '../lib/groupNotes.ts'
import type { NoteWithTitle } from 'shared'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function Notes() {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [notes, setNotes] = useState<NoteWithTitle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const res = await makeApi(token).notes.list()
      setNotes(res.notes)
      setLoading(false)
    }
    load()
  }, [getToken])

  async function handleDelete(id: string) {
    const token = await getToken()
    if (!token) return
    await makeApi(token).notes.delete(id)
    setNotes((prev) => prev.filter((n) => n.id !== id))
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const grouped = groupByDocument(notes)
  const docTitles = Object.keys(grouped)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Saved Notes</h1>
        <p className="mt-1 text-muted">Key points saved from your learning sessions.</p>
      </div>

      {docTitles.length === 0 ? (
        <div className="py-16 text-center">
          <BookMarked size={40} className="mx-auto mb-4 text-muted" />
          <p className="text-muted">No saved notes yet.</p>
          <p className="mt-1 text-sm text-muted">
            Highlight text in a{' '}
            <button onClick={() => navigate('/learn')} className="text-primary hover:underline">
              Learn session
            </button>{' '}
            to save key points.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {docTitles.map((docTitle) => (
            <div key={docTitle}>
              <h2 className="mb-4 font-semibold text-white">{docTitle}</h2>
              <div className="space-y-4">
                {Object.entries(grouped[docTitle]).map(([topic, topicNotes]) => (
                  <div key={topic} className="rounded-xl border border-border bg-surface p-5">
                    <h3 className="mb-3 text-sm font-semibold text-primary">{topic}</h3>
                    <div className="space-y-3">
                      {topicNotes.map((note) => (
                        <div
                          key={note.id}
                          className="flex items-start justify-between gap-3 rounded-lg bg-bg px-3 py-2.5"
                        >
                          <div className="flex-1">
                            <p className="text-sm text-white">{note.content}</p>
                            <p className="mt-1 text-xs text-muted">{formatDate(note.created_at)}</p>
                          </div>
                          <button
                            onClick={() => handleDelete(note.id)}
                            className="shrink-0 rounded p-1 text-muted hover:text-danger"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 7: TypeScript check**

```bash
cd /home/coder/main && apps/frontend/node_modules/.bin/tsc --noEmit -p apps/frontend/tsconfig.json 2>&1
```

Expected: no output.

- [ ] **Step 8: Run full test suite**

```bash
cd /home/coder/main/apps/frontend && node_modules/.bin/vitest run 2>&1 | tail -4
```

Expected: all tests pass (27+ tests).

- [ ] **Step 9: Commit**

```bash
git add apps/frontend/src/lib/groupNotes.ts apps/frontend/src/lib/groupNotes.test.ts apps/frontend/src/pages/Notes.tsx apps/frontend/src/lib/api.ts
git commit -m "feat: notes frontend — groupByDocument utility, Notes page, api methods"
```

---

## Task 5: Notes in LearnSession — text selection + floating Save button

**Files:**
- Modify: `apps/frontend/src/pages/LearnSession.tsx`
- Modify: `apps/frontend/src/App.tsx`
- Modify: `apps/frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add text selection + save to LearnSession.tsx**

The explanation is rendered in a `<div className="rounded-xl border border-border bg-surface p-6">` inside the main pane. We need a `ref` on it, a `mouseup` listener, and a floating button.

Add these imports at the top of `LearnSession.tsx` (after existing imports):

```typescript
import { useRef } from 'react'
import { makeApi } from '../lib/api.ts'
```

`useRef` is already imported — add only `makeApi`.

Add these state variables and handler inside the component (after existing state):

```typescript
  const explanationRef = useRef<HTMLDivElement>(null)
  const [selectionText, setSelectionText] = useState('')
  const [savePos, setSavePos] = useState<{ top: number; left: number } | null>(null)
  const [savedToast, setSavedToast] = useState(false)

  function handleMouseUp() {
    const sel = window.getSelection()
    const text = sel?.toString().trim() ?? ''
    if (!text || !explanationRef.current) {
      setSelectionText('')
      setSavePos(null)
      return
    }
    const range = sel!.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const containerRect = explanationRef.current.getBoundingClientRect()
    setSelectionText(text)
    setSavePos({
      top: rect.bottom - containerRect.top + 6,
      left: Math.max(0, rect.left - containerRect.left),
    })
  }

  async function handleSaveNote() {
    if (!selectionText || !documentId) return
    const token = await getToken()
    if (!token) return
    await makeApi(token).notes.create({ documentId, topic, content: selectionText })
    setSavePos(null)
    setSelectionText('')
    window.getSelection()?.removeAllRanges()
    setSavedToast(true)
    setTimeout(() => setSavedToast(false), 2000)
  }
```

Update the explanation container div (currently `<div className="rounded-xl border border-border bg-surface p-6">`). Replace it with:

```tsx
              <div
                ref={explanationRef}
                className="relative rounded-xl border border-border bg-surface p-6"
                onMouseUp={handleMouseUp}
              >
                <h2 className="mb-4 font-semibold text-primary">AI Explanation</h2>
                {explanation ? (
                  <StreamingText text={explanation} streaming={loadingExplanation} />
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Generating explanation...
                  </div>
                )}
                {savePos && (
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleSaveNote}
                    style={{ top: savePos.top, left: savePos.left }}
                    className="absolute z-10 flex items-center gap-1 rounded-lg bg-primary px-2 py-1 text-xs font-medium text-white shadow-lg hover:bg-primary-hover"
                  >
                    💾 Save
                  </button>
                )}
              </div>
```

Add the toast just before the closing `</div>` of the outermost component div (before `</div>` that closes `flex h-screen flex-col`):

```tsx
      {savedToast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-success px-4 py-2 text-sm font-medium text-white shadow-lg">
          Saved ✓
        </div>
      )}
```

- [ ] **Step 2: Add Notes to Sidebar**

In `apps/frontend/src/components/layout/Sidebar.tsx`, add `BookMarked` to the lucide-react import and add a Notes entry to `NAV_ITEMS`:

Add `BookMarked` to the import from `lucide-react`.

Add to `NAV_ITEMS` array (after `{ to: '/learn', ... }` and before `{ to: '/ask', ... }`):

```typescript
  { to: '/notes', icon: BookMarked, label: 'Notes' },
  { to: '/flashcards', icon: Layers, label: 'Flashcards' },
```

Also import `Layers` from lucide-react (for Flashcards, added now so the sidebar is complete in one commit).

- [ ] **Step 3: Add routes to App.tsx**

In `apps/frontend/src/App.tsx`, add imports:

```typescript
import Notes from './pages/Notes.tsx'
import Flashcards from './pages/Flashcards.tsx'
import FlashcardsNew from './pages/FlashcardsNew.tsx'
import FlashcardsStudy from './pages/FlashcardsStudy.tsx'
```

Inside the protected `<Route element={...}>` section, add:

```tsx
        <Route path="/notes" element={<Notes />} />
        <Route path="/flashcards" element={<Flashcards />} />
        <Route path="/flashcards/new" element={<FlashcardsNew />} />
        <Route path="/flashcards/study/:documentId/:topic" element={<FlashcardsStudy />} />
```

**Note:** `Flashcards`, `FlashcardsNew`, `FlashcardsStudy` don't exist yet — TypeScript will error. Create placeholder files first:

Create `apps/frontend/src/pages/Flashcards.tsx`:
```typescript
export default function Flashcards() { return <div /> }
```

Create `apps/frontend/src/pages/FlashcardsNew.tsx`:
```typescript
export default function FlashcardsNew() { return <div /> }
```

Create `apps/frontend/src/pages/FlashcardsStudy.tsx`:
```typescript
export default function FlashcardsStudy() { return <div /> }
```

- [ ] **Step 4: TypeScript check**

```bash
cd /home/coder/main && apps/frontend/node_modules/.bin/tsc --noEmit -p apps/frontend/tsconfig.json 2>&1
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/pages/LearnSession.tsx apps/frontend/src/components/layout/Sidebar.tsx apps/frontend/src/App.tsx apps/frontend/src/pages/Flashcards.tsx apps/frontend/src/pages/FlashcardsNew.tsx apps/frontend/src/pages/FlashcardsStudy.tsx
git commit -m "feat: notes — text selection + Save button in LearnSession, Notes route, Flashcard placeholder routes"
```

---

## Task 6: Multi-Document Test — Backend

**Files:**
- Modify: `apps/backend/src/services/rag.service.ts`
- Modify: `apps/backend/src/routes/test.ts`

- [ ] **Step 1: Add retrieveChunksMulti to rag.service.ts**

In `apps/backend/src/services/rag.service.ts`, add after the existing `retrieveChunks` function:

```typescript
export async function retrieveChunksMulti(
  query: string,
  documentIds: string[],
  topK = 8,
  ollamaUrl?: string,
): Promise<RetrievedChunk[]> {
  const embedding = await generateEmbedding(query, ollamaUrl)
  const vectorLiteral = `[${embedding.join(',')}]`

  const rows = await sql<Array<{ content: string; similarity: number }>>`
    SELECT
      content,
      1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
    FROM chunks
    WHERE document_id = ANY(${documentIds}::uuid[])
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT ${topK}
  `

  return rows
}
```

- [ ] **Step 2: Update test.ts generate route to support documentIds**

In `apps/backend/src/routes/test.ts`:

Add `retrieveChunksMulti` to the import from rag.service:

```typescript
import { retrieveChunks, retrieveChunksMulti, buildContext } from '../services/rag.service.js'
```

In the `POST /generate` handler, find the RAG retrieval line:

```typescript
  const chunks = await retrieveChunks(topic, documentId, 8, ollamaUrl)
```

Replace with:

```typescript
  const docIds = body.documentIds && body.documentIds.length > 1 ? body.documentIds : null
  const chunks = docIds
    ? await retrieveChunksMulti(topic, docIds, 8, ollamaUrl)
    : await retrieveChunks(topic, documentId, 8, ollamaUrl)
```

In the `INSERT INTO tests` query, update to store `document_ids`:

Find:
```typescript
  const [test] = await sql`
    INSERT INTO tests (user_id, document_id, topic, question_count, type, difficulty)
    VALUES (${userId}, ${documentId}, ${topic}, ${count}, ${type}, ${difficulty})
    RETURNING *
  `
```

Replace with:
```typescript
  const [test] = await sql`
    INSERT INTO tests (user_id, document_id, topic, question_count, type, difficulty, document_ids)
    VALUES (${userId}, ${documentId}, ${topic}, ${count}, ${type}, ${difficulty},
            ${body.documentIds ?? []})
    RETURNING *
  `
```

- [ ] **Step 3: TypeScript check**

```bash
cd /home/coder/main && apps/backend/node_modules/.bin/tsc --noEmit -p apps/backend/tsconfig.json 2>&1 | grep -v "rootDir"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/services/rag.service.ts apps/backend/src/routes/test.ts
git commit -m "feat: multi-document test backend — retrieveChunksMulti, store document_ids on tests"
```

---

## Task 7: Multi-Document Test — Frontend (TestNew.tsx)

**Files:**
- Modify: `apps/frontend/src/pages/TestNew.tsx`

- [ ] **Step 1: Add multi-doc toggle to TestNew.tsx**

The current `form` state has `documentId: string`. We need to add `multiDoc: boolean` and `documentIds: string[]`.

Replace the existing `form` state:

```typescript
  const [form, setForm] = useState({
    documentId: '',
    topic: '',
    count: 10,
    type: 'mcq' as TestType,
    difficulty: 'medium' as Difficulty,
  })
```

With:

```typescript
  const [form, setForm] = useState({
    documentId: '',
    documentIds: [] as string[],
    multiDoc: false,
    topic: '',
    count: 10,
    type: 'mcq' as TestType,
    difficulty: 'medium' as Difficulty,
  })
```

Update the `generate` function. Find:

```typescript
      const res = await makeApi(token).test.generate({ ...form, topic: form.topic.trim() })
```

Replace with:

```typescript
      const payload = {
        documentId: form.multiDoc ? form.documentIds[0] : form.documentId,
        documentIds: form.multiDoc ? form.documentIds : undefined,
        topic: form.topic.trim(),
        count: form.count,
        type: form.type,
        difficulty: form.difficulty,
      }
      const res = await makeApi(token).test.generate(payload)
```

Update the disabled condition. Find:

```typescript
          disabled={!form.documentId || !form.topic.trim() || loading}
```

Replace with:

```typescript
          disabled={
            (!form.multiDoc && !form.documentId) ||
            (form.multiDoc && form.documentIds.length < 2) ||
            !form.topic.trim() ||
            loading
          }
```

Now add the multi-doc toggle UI. Replace the existing Material `<div>` section:

```tsx
        <div>
          <label className="mb-2 block text-sm font-medium text-muted">Material</label>
          <select
            value={form.documentId}
            onChange={(e) => toggle('documentId', e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-white outline-none focus:border-primary"
          >
            {documents.length === 0 && <option value="">No materials — upload a PDF first</option>}
            {documents.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
          </select>
        </div>
```

With:

```tsx
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-muted">Material</label>
            <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={form.multiDoc}
                onChange={(e) => setForm((f) => ({ ...f, multiDoc: e.target.checked, documentIds: [] }))}
                className="accent-primary"
              />
              Multiple documents
            </label>
          </div>

          {!form.multiDoc ? (
            <select
              value={form.documentId}
              onChange={(e) => toggle('documentId', e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-white outline-none focus:border-primary"
            >
              {documents.length === 0 && <option value="">No materials — upload a PDF first</option>}
              {documents.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          ) : (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-surface p-2 space-y-1">
              {documents.length === 0 && (
                <p className="px-2 py-1 text-sm text-muted">No materials — upload a PDF first</p>
              )}
              {documents.map((d) => (
                <label key={d.id} className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-white/5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.documentIds.includes(d.id)}
                    onChange={(e) => {
                      setForm((f) => ({
                        ...f,
                        documentIds: e.target.checked
                          ? [...f.documentIds, d.id]
                          : f.documentIds.filter((id) => id !== d.id),
                      }))
                    }}
                    className="accent-primary"
                  />
                  <span className="text-sm text-white">{d.title}</span>
                </label>
              ))}
            </div>
          )}
          {form.multiDoc && form.documentIds.length < 2 && (
            <p className="mt-1 text-xs text-muted">Select at least 2 documents</p>
          )}
        </div>
```

- [ ] **Step 2: TypeScript check**

```bash
cd /home/coder/main && apps/frontend/node_modules/.bin/tsc --noEmit -p apps/frontend/tsconfig.json 2>&1
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/pages/TestNew.tsx
git commit -m "feat: multi-document test frontend — toggle + checkbox list in TestNew"
```

---

## Task 8: Flashcard Backend

**Files:**
- Create: `apps/backend/src/prompts/flashcard.prompt.ts`
- Create: `apps/backend/src/routes/flashcards.ts`
- Modify: `apps/backend/src/index.ts`

- [ ] **Step 1: Create flashcard prompt**

Create `apps/backend/src/prompts/flashcard.prompt.ts`:

```typescript
import type { LLMMessage } from '../services/openrouter.service.js'

export function flashcardPrompt(topic: string, context: string, count: number): LLMMessage[] {
  return [
    {
      role: 'system',
      content: `You are a flashcard generator. Create exactly ${count} question-answer pairs about "${topic}".

Return ONLY a valid JSON object — no markdown, no explanation:
{
  "cards": [
    { "question": "...", "answer": "..." }
  ]
}

Each question should test a single concept. Each answer should be 1-3 sentences.
Base everything strictly on the provided study material. Do not invent information.`,
    },
    {
      role: 'user',
      content: `Study material:\n\n${context}\n\nGenerate ${count} flashcards about: ${topic}`,
    },
  ]
}
```

- [ ] **Step 2: Create flashcards route**

Create `apps/backend/src/routes/flashcards.ts`:

```typescript
import { Hono } from 'hono'
import { retrieveChunks, buildContext } from '../services/rag.service.js'
import { completeJson } from '../services/openrouter.service.js'
import { flashcardPrompt } from '../prompts/flashcard.prompt.js'
import { authMiddleware, type AuthEnv } from '../middleware/auth.js'
import sql from '../db/client.js'
import type { Flashcard, GenerateFlashcardsRequest } from 'shared'

const app = new Hono<AuthEnv>()
app.use('*', authMiddleware)

app.post('/generate', async (c) => {
  const { documentId, topic, count } = await c.req.json<GenerateFlashcardsRequest>()
  const userId = c.get('dbUserId')
  const settings = c.get('userSettings')

  const apiKey = settings.openrouterKey ?? process.env.OPENROUTER_API_KEY!
  const ollamaUrl = settings.ollamaUrl ?? process.env.OLLAMA_URL ?? 'http://localhost:11434'
  const model = settings.defaultModel ?? 'google/gemini-3.5-flash'

  if (!apiKey) return c.json({ error: 'OpenRouter API key not configured' }, 400)

  const chunks = await retrieveChunks(topic, documentId, 8, ollamaUrl)
  const context = buildContext(chunks)
  const messages = flashcardPrompt(topic, context, count)

  const result = await completeJson<{ cards: Array<{ question: string; answer: string }> }>(
    messages, apiKey, model,
  )

  const cards: Flashcard[] = []
  for (const card of result.cards) {
    const [row] = await sql<Flashcard[]>`
      INSERT INTO flashcards (user_id, document_id, topic, question, answer)
      VALUES (${userId}, ${documentId}, ${topic}, ${card.question}, ${card.answer})
      RETURNING *
    `
    cards.push(row)
  }

  return c.json({ flashcards: cards }, 201)
})

app.get('/', async (c) => {
  const userId = c.get('dbUserId')
  const flashcards = await sql<Flashcard[]>`
    SELECT * FROM flashcards WHERE user_id = ${userId} ORDER BY created_at DESC
  `
  return c.json({ flashcards })
})

app.post('/:cardId/attempt', async (c) => {
  const userId = c.get('dbUserId')
  const cardId = c.req.param('cardId')
  const { known } = await c.req.json<{ known: boolean }>()

  if (known) {
    await sql`UPDATE flashcards SET pass_count = pass_count + 1 WHERE id = ${cardId} AND user_id = ${userId}`
  } else {
    await sql`UPDATE flashcards SET fail_count = fail_count + 1 WHERE id = ${cardId} AND user_id = ${userId}`
  }

  return c.json({ updated: true })
})

app.delete('/:cardId', async (c) => {
  const userId = c.get('dbUserId')
  const cardId = c.req.param('cardId')
  await sql`DELETE FROM flashcards WHERE id = ${cardId} AND user_id = ${userId}`
  return c.json({ deleted: true })
})

export default app
```

- [ ] **Step 3: Register flashcards route in index.ts**

In `apps/backend/src/index.ts`, add import after `notesRoute`:

```typescript
import flashcardsRoute from './routes/flashcards.js'
```

Add after `app.route('/api/notes', notesRoute)`:

```typescript
app.route('/api/flashcards', flashcardsRoute)
```

- [ ] **Step 4: TypeScript check**

```bash
cd /home/coder/main && apps/backend/node_modules/.bin/tsc --noEmit -p apps/backend/tsconfig.json 2>&1 | grep -v "rootDir"
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/prompts/flashcard.prompt.ts apps/backend/src/routes/flashcards.ts apps/backend/src/index.ts
git commit -m "feat: flashcard backend — generate/list/attempt/delete routes at /api/flashcards"
```

---

## Task 9: Flashcard Frontend — utilities + all three pages

**Files:**
- Create: `apps/frontend/src/lib/groupFlashcards.ts`
- Create: `apps/frontend/src/lib/groupFlashcards.test.ts`
- Modify: `apps/frontend/src/lib/api.ts`
- Replace: `apps/frontend/src/pages/Flashcards.tsx`
- Replace: `apps/frontend/src/pages/FlashcardsNew.tsx`
- Replace: `apps/frontend/src/pages/FlashcardsStudy.tsx`

- [ ] **Step 1: Write the failing tests**

Create `apps/frontend/src/lib/groupFlashcards.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/coder/main/apps/frontend && node_modules/.bin/vitest run --reporter=verbose 2>&1 | grep -E "(groupFlashcards|FAIL|Error)" | head -5
```

Expected: FAIL — `Cannot find module './groupFlashcards.ts'`

- [ ] **Step 3: Implement groupFlashcards.ts**

Create `apps/frontend/src/lib/groupFlashcards.ts`:

```typescript
import type { Flashcard } from 'shared'

export interface FlashcardSet {
  documentId: string
  topic: string
  cards: Flashcard[]
  weakCount: number
}

export function groupIntoSets(flashcards: Flashcard[]): FlashcardSet[] {
  const map = new Map<string, { documentId: string; topic: string; cards: Flashcard[] }>()
  for (const card of flashcards) {
    const key = `${card.document_id}\x00${card.topic}`
    if (!map.has(key)) {
      map.set(key, { documentId: card.document_id, topic: card.topic, cards: [] })
    }
    map.get(key)!.cards.push(card)
  }
  return Array.from(map.values()).map(({ documentId, topic, cards }) => ({
    documentId,
    topic,
    cards,
    weakCount: cards.filter((c) => c.fail_count > c.pass_count).length,
  }))
}

export function sendCardToEnd(deck: Flashcard[], index: number): Flashcard[] {
  const newDeck = [...deck]
  const [card] = newDeck.splice(index, 1)
  newDeck.push(card)
  return newDeck
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/coder/main/apps/frontend && node_modules/.bin/vitest run --reporter=verbose 2>&1 | grep -E "(groupFlashcards|Tests)" | head -5
```

Expected: `✓ src/lib/groupFlashcards.test.ts (6 tests)`

- [ ] **Step 5: Add flashcard methods to api.ts**

In `apps/frontend/src/lib/api.ts`, add inside the `makeApi` return object after `notes`:

```typescript
    flashcards: {
      generate: (body: GenerateFlashcardsRequest) =>
        apiFetch<{ flashcards: Flashcard[] }>('/flashcards/generate', token, {
          method: 'POST',
          body: JSON.stringify(body),
        }),
      list: () => apiFetch<{ flashcards: Flashcard[] }>('/flashcards', token),
      attempt: (cardId: string, known: boolean) =>
        apiFetch<{ updated: boolean }>(`/flashcards/${cardId}/attempt`, token, {
          method: 'POST',
          body: JSON.stringify({ known }),
        }),
      delete: (cardId: string) =>
        apiFetch<{ deleted: boolean }>(`/flashcards/${cardId}`, token, { method: 'DELETE' }),
    },
```

- [ ] **Step 6: Replace Flashcards.tsx (sets list page)**

Replace `apps/frontend/src/pages/Flashcards.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { Layers, Plus, Brain } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import { groupIntoSets, type FlashcardSet } from '../lib/groupFlashcards.ts'

export default function Flashcards() {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [sets, setSets] = useState<FlashcardSet[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const res = await makeApi(token).flashcards.list()
      setSets(groupIntoSets(res.flashcards))
      setLoading(false)
    }
    load()
  }, [getToken])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Flashcards</h1>
          <p className="mt-1 text-muted">Study your Q&A sets.</p>
        </div>
        <button
          onClick={() => navigate('/flashcards/new')}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-white hover:bg-primary-hover"
        >
          <Plus size={16} /> New Set
        </button>
      </div>

      {sets.length === 0 ? (
        <div className="py-16 text-center">
          <Brain size={40} className="mx-auto mb-4 text-muted" />
          <p className="text-muted">No flashcards yet. Create a set to start studying.</p>
          <button
            onClick={() => navigate('/flashcards/new')}
            className="mt-3 text-sm text-primary hover:underline"
          >
            Create your first set →
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map(({ documentId, topic, cards, weakCount }) => (
            <div key={`${documentId}-${topic}`} className="rounded-xl border border-border bg-surface p-5">
              <div className="mb-3 flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Layers size={18} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{topic}</p>
                  <p className="text-xs text-muted">{cards.length} card{cards.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              {weakCount > 0 && (
                <p className="mb-3 text-xs text-danger">
                  {weakCount} weak card{weakCount !== 1 ? 's' : ''}
                </p>
              )}
              <button
                onClick={() =>
                  navigate(`/flashcards/study/${documentId}/${encodeURIComponent(topic)}`)
                }
                className="w-full rounded-lg bg-primary/10 py-2 text-sm font-medium text-primary hover:bg-primary/20"
              >
                Study →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 7: Replace FlashcardsNew.tsx**

Replace `apps/frontend/src/pages/FlashcardsNew.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { Loader2 } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import type { Document } from 'shared'

export default function FlashcardsNew() {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [documents, setDocuments] = useState<Document[]>([])
  const [form, setForm] = useState({ documentId: '', topic: '', count: 10 })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const res = await makeApi(token).documents.list()
      const ready = res.documents.filter((d) => d.status === 'ready')
      setDocuments(ready)
      if (ready.length > 0) setForm((f) => ({ ...f, documentId: ready[0].id }))
    }
    load()
  }, [getToken])

  async function generate() {
    if (!form.documentId || !form.topic.trim()) return
    setLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      await makeApi(token).flashcards.generate({
        documentId: form.documentId,
        topic: form.topic.trim(),
        count: form.count,
      })
      navigate(
        `/flashcards/study/${form.documentId}/${encodeURIComponent(form.topic.trim())}`,
      )
    } catch {
      alert('Failed to generate flashcards. Check your OpenRouter API key in Settings.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">New Flashcard Set</h1>
        <p className="mt-1 text-muted">AI generates Q&A cards from your material.</p>
      </div>

      <div className="max-w-lg space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-muted">Material</label>
          <select
            value={form.documentId}
            onChange={(e) => setForm((f) => ({ ...f, documentId: e.target.value }))}
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-white outline-none focus:border-primary"
          >
            {documents.length === 0 && (
              <option value="">No materials — upload a PDF first</option>
            )}
            {documents.map((d) => (
              <option key={d.id} value={d.id}>{d.title}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-muted">Topic</label>
          <input
            type="text"
            placeholder='e.g. "Normalization"'
            value={form.topic}
            onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && generate()}
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-white placeholder-muted outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-muted">
            Cards: {form.count}
          </label>
          <input
            type="range"
            min={5}
            max={20}
            value={form.count}
            onChange={(e) => setForm((f) => ({ ...f, count: Number(e.target.value) }))}
            className="w-full accent-primary"
          />
        </div>

        <button
          onClick={generate}
          disabled={!form.documentId || !form.topic.trim() || loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-white hover:bg-primary-hover disabled:opacity-40"
        >
          {loading ? (
            <><Loader2 size={18} className="animate-spin" /> Generating...</>
          ) : (
            'Generate Cards'
          )}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Replace FlashcardsStudy.tsx**

Replace `apps/frontend/src/pages/FlashcardsStudy.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { ArrowLeft, CheckCircle, XCircle, RotateCcw } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import { sendCardToEnd } from '../lib/groupFlashcards.ts'
import type { Flashcard } from 'shared'

export default function FlashcardsStudy() {
  const { documentId, topic } = useParams<{ documentId: string; topic: string }>()
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const decodedTopic = decodeURIComponent(topic ?? '')

  const [deck, setDeck] = useState<Flashcard[]>([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [knownCount, setKnownCount] = useState(0)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token || !documentId) return
      const res = await makeApi(token).flashcards.list()
      const topicCards = res.flashcards.filter(
        (c) => c.document_id === documentId && c.topic === decodedTopic,
      )
      setDeck(topicCards)
      setLoading(false)
    }
    load()
  }, [getToken, documentId, decodedTopic])

  async function handleAttempt(isKnown: boolean) {
    const card = deck[index]
    const token = await getToken()
    if (!token) return
    await makeApi(token).flashcards.attempt(card.id, isKnown)

    if (isKnown) {
      setKnownCount((k) => k + 1)
      if (index + 1 >= deck.length) {
        setDone(true)
      } else {
        setIndex((i) => i + 1)
        setFlipped(false)
      }
    } else {
      setDeck((d) => sendCardToEnd(d, index))
      setFlipped(false)
    }
  }

  function restart() {
    setIndex(0)
    setFlipped(false)
    setKnownCount(0)
    setDone(false)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (deck.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-white">No flashcards found for this topic.</p>
        <button
          onClick={() => navigate('/flashcards/new')}
          className="text-primary hover:underline"
        >
          Create a new set →
        </button>
      </div>
    )
  }

  if (done) {
    const weakCards = deck.filter((c) => c.fail_count > c.pass_count)
    return (
      <div className="p-8">
        <div className="mb-6 flex items-center gap-4">
          <button onClick={() => navigate('/flashcards')} className="text-muted hover:text-white">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-2xl font-bold text-white">Session Complete!</h1>
        </div>
        <div className="mb-6 rounded-2xl border border-border bg-surface p-8 text-center">
          <div className="text-6xl font-black text-success">{knownCount}/{deck.length}</div>
          <p className="mt-2 text-xl font-semibold text-white">cards known</p>
        </div>
        {weakCards.length > 0 && (
          <div className="mb-6 rounded-xl border border-danger/30 bg-danger/5 p-5">
            <h2 className="mb-3 text-sm font-semibold text-danger">Cards to review:</h2>
            <ul className="space-y-2">
              {weakCards.map((c) => (
                <li key={c.id} className="text-sm text-white">· {c.question}</li>
              ))}
            </ul>
          </div>
        )}
        <button
          onClick={restart}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-semibold text-white hover:bg-primary-hover"
        >
          <RotateCcw size={16} /> Study Again
        </button>
      </div>
    )
  }

  const card = deck[index]

  return (
    <div className="flex h-screen flex-col p-8">
      <div className="mb-6 flex items-center gap-4">
        <button onClick={() => navigate('/flashcards')} className="text-muted hover:text-white">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-bold text-white">{decodedTopic}</h1>
        <span className="ml-auto text-sm text-muted">
          Card {index + 1} of {deck.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center">
        {/* Flip card */}
        <div
          style={{ perspective: '1000px' }}
          className="w-full max-w-lg cursor-pointer"
          onClick={() => setFlipped((f) => !f)}
        >
          <div
            style={{
              transformStyle: 'preserve-3d',
              transition: 'transform 0.4s',
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              position: 'relative',
              height: '280px',
            }}
          >
            {/* Front — question */}
            <div
              style={{ backfaceVisibility: 'hidden' }}
              className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-border bg-surface p-8 text-center"
            >
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted">
                Question
              </p>
              <p className="text-lg font-semibold text-white">{card.question}</p>
              <p className="mt-6 text-xs text-muted">Click to reveal answer</p>
            </div>

            {/* Back — answer */}
            <div
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
              className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-primary/40 bg-primary/5 p-8 text-center"
            >
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-primary">
                Answer
              </p>
              <p className="text-lg text-white">{card.answer}</p>
            </div>
          </div>
        </div>

        {/* Action buttons — only visible after flip */}
        {flipped && (
          <div className="mt-8 flex gap-4">
            <button
              onClick={() => handleAttempt(false)}
              className="flex items-center gap-2 rounded-xl border border-danger/50 px-6 py-3 font-semibold text-danger hover:bg-danger/10"
            >
              <XCircle size={18} /> Didn't Know
            </button>
            <button
              onClick={() => handleAttempt(true)}
              className="flex items-center gap-2 rounded-xl bg-success px-6 py-3 font-semibold text-white hover:opacity-90"
            >
              <CheckCircle size={18} /> Got It ✓
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 9: TypeScript check**

```bash
cd /home/coder/main && apps/frontend/node_modules/.bin/tsc --noEmit -p apps/frontend/tsconfig.json 2>&1
```

Expected: no output.

- [ ] **Step 10: Run full test suite**

```bash
cd /home/coder/main/apps/frontend && node_modules/.bin/vitest run 2>&1 | tail -5
```

Expected: all tests pass (33+ tests: previous 24 + 3 groupNotes + 6 groupFlashcards).

- [ ] **Step 11: Commit**

```bash
git add apps/frontend/src/lib/groupFlashcards.ts apps/frontend/src/lib/groupFlashcards.test.ts apps/frontend/src/lib/api.ts apps/frontend/src/pages/Flashcards.tsx apps/frontend/src/pages/FlashcardsNew.tsx apps/frontend/src/pages/FlashcardsStudy.tsx
git commit -m "feat: flashcard frontend — groupFlashcards utils, sets list, create form, study session with flip animation"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Notes DB table | Task 1 |
| Notes backend POST/GET/DELETE | Task 3 |
| Notes groupByDocument utility | Task 4 |
| Notes page grouped by doc/topic | Task 4 |
| LearnSession text selection + floating Save | Task 5 |
| LearnSession Saved ✓ toast | Task 5 |
| Multi-doc: `document_ids` column on tests | Task 1 |
| Multi-doc: `retrieveChunksMulti` | Task 6 |
| Multi-doc: `documentIds` in test generate | Task 6 |
| Multi-doc: toggle + checkbox list in TestNew | Task 7 |
| Flashcards DB table | Task 1 |
| Shared types (Note, Flashcard, etc.) | Task 2 |
| Flashcard prompt | Task 8 |
| Flashcard backend generate/list/attempt/delete | Task 8 |
| Flashcards list page (sets grouped by doc+topic) | Task 9 |
| FlashcardsNew create form | Task 9 |
| FlashcardsStudy flip animation + Known/Didn't Know | Task 9 |
| FlashcardsStudy wrong card goes to end of deck | Task 9 (`sendCardToEnd`) |
| FlashcardsStudy summary screen with weak cards | Task 9 |
| Flashcards + Notes in sidebar | Task 5 |
| Flashcard + Notes routes in App.tsx | Task 5 |

**Placeholder scan:** No TBDs. All code steps include complete implementations.

**Type consistency:**
- `NoteWithTitle` defined in Task 2, used in Task 3 (route), Task 4 (groupNotes, Notes.tsx, api.ts) ✓
- `Flashcard` defined in Task 2, used in Task 8 (route), Task 9 (groupFlashcards, all pages, api.ts) ✓
- `GenerateFlashcardsRequest` defined in Task 2, used in Task 8 route and Task 9 api.ts ✓
- `sendCardToEnd(deck, index)` defined in Task 9 groupFlashcards.ts, imported in FlashcardsStudy.tsx ✓
- `groupIntoSets` returns `FlashcardSet[]`, `FlashcardSet` exported and used in Flashcards.tsx ✓
- `makeApi(token).flashcards.attempt(card.id, isKnown)` — signature matches api.ts definition ✓
- `makeApi(token).notes.create({ documentId, topic, content })` — matches api.ts ✓

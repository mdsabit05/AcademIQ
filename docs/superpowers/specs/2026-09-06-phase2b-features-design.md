# Phase 2B Features Design — Note2Test
**Date:** 2026-09-06
**Scope:** Flashcard Mode, Multi-Document Test, Highlight & Save Key Points (Notes)

---

## 1. Flashcard Mode

### Goal
Let users generate Q&A flashcard sets from any document topic, study them with a flip-card UX, and track which cards they're weak on over time.

### DB Schema
New table:
```sql
CREATE TABLE flashcards (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id  uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  topic        text NOT NULL,
  question     text NOT NULL,
  answer       text NOT NULL,
  pass_count   int NOT NULL DEFAULT 0,
  fail_count   int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);
```
No separate attempts table — `pass_count` / `fail_count` are incremented in place on each attempt.

### Backend Routes
All under `/api/flashcards`, all require auth.

| Method | Path | Body / Params | Returns |
|---|---|---|---|
| POST | `/generate` | `{ documentId, topic, count }` | `{ flashcards: Flashcard[] }` |
| GET | `/` | — | `{ flashcards: Flashcard[] }` (all user cards) |
| POST | `/:cardId/attempt` | `{ known: boolean }` | `{ updated: true }` |
| DELETE | `/:cardId` | — | `{ deleted: true }` |

**Generation logic (`POST /generate`):**
1. RAG-retrieve 8 chunks for `topic` in `documentId`
2. Call LLM with prompt asking for `count` Q&A pairs as JSON array `[{ question, answer }]`
3. Parse JSON response, bulk-insert into `flashcards`
4. Return inserted rows

### Frontend Pages

**`/flashcards`** — Flashcard Sets page (new sidebar link)
- Lists all user's flashcard sets grouped by document title → topic
- Shows card count + weak count (fail_count > pass_count) per set
- "Study" button → `/flashcards/study/:documentId/:topic`
- "New Set" button → `/flashcards/new`
- Empty state: "No flashcards yet. Create a set to start studying."

**`/flashcards/new`** — Create Set page
- Same form pattern as TestNew: document dropdown (ready docs only), topic input, count slider (5–20)
- "Generate Cards" button — loading state while AI generates
- On success, navigates to `/flashcards/study/:documentId/:topic`

**`/flashcards/study/:documentId/:topic`** — Study Session page
- Shows one card at a time: question side first
- Click card (or "Flip" button) → CSS `rotateY(180deg)` flip to reveal answer
- After flip: "Got it ✓" and "Didn't know ✗" buttons
  - "Got it" → `POST /:cardId/attempt { known: true }`, advance to next card
  - "Didn't know" → `POST /:cardId/attempt { known: false }`, card goes to end of deck
- Progress indicator: "Card 3 of 10"
- After all cards seen: summary screen — "X/N known", list of weak cards with their questions, "Study Again" button (reshuffles full deck)

**Flip animation:** Pure CSS — no library.
```css
.card { transition: transform 0.4s; transform-style: preserve-3d; }
.card.flipped { transform: rotateY(180deg); }
.card-front, .card-back { backface-visibility: hidden; }
.card-back { transform: rotateY(180deg); }
```

### Shared Types
```typescript
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

---

## 2. Multi-Document Test

### Goal
Allow users to generate a test that draws questions from multiple documents at once, useful for cross-topic or combined revision.

### DB Schema
Add one column to `tests`:
```sql
ALTER TABLE tests ADD COLUMN document_ids text[] NOT NULL DEFAULT '{}';
```
Existing single-doc tests keep `document_id` as the source of truth; `document_ids` is empty for them. Multi-doc tests populate both — `document_id` holds the first selected doc (backwards compat), `document_ids` holds the full array.

### Backend
**`POST /api/test/generate`** — extend request body:
```typescript
export interface GenerateTestRequest {
  documentId: string          // first doc (kept for compat)
  documentIds?: string[]      // all selected docs (multi-doc mode)
  topic: string
  count: number
  type: TestType
  difficulty: Difficulty
}
```

When `documentIds` is present and has more than one entry:
- RAG retrieval: `WHERE document_id = ANY(${documentIds})` — chunks from all selected docs
- Store `document_ids` array on the test row
- Otherwise: existing single-doc behaviour unchanged

### Frontend (`TestNew.tsx`)
- Add a "Multiple documents" toggle (checkbox) above the material selector
- **Toggle off (default):** existing single document dropdown — no change
- **Toggle on:** dropdown is replaced with a scrollable checkbox list of all `ready` documents; user ticks 2 or more
- Generate button disabled until topic is filled and (in multi mode) at least 2 docs are checked
- `documentId` sent = first checked doc; `documentIds` = full checked array

No changes to TestResults, PDF export, Progress, or TestTake — they work with `test_id` and are unaffected.

---

## 3. Highlight & Save Key Points (Notes)

### Goal
Let users save highlighted text from a LearnSession as a personal note, then review all saved notes on a dedicated Notes page.

### DB Schema
New table:
```sql
CREATE TABLE notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id  uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  topic        text NOT NULL,
  content      text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
```

### Backend Routes
All under `/api/notes`, all require auth.

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/` | `{ documentId, topic, content }` | `{ note: Note }` |
| GET | `/` | — | `{ notes: NoteWithTitle[] }` |
| DELETE | `/:id` | — | `{ deleted: true }` |

`GET /api/notes` joins with `documents` to include `document_title` for grouping in the UI.

### Frontend — LearnSession.tsx

Add a `mouseup` event listener on the AI explanation container `<div>`. When the user releases a text selection:
1. Call `window.getSelection()` — if non-empty, show a floating "💾 Save" button positioned near the selection using `getBoundingClientRect()`
2. Clicking "Save" calls `POST /api/notes` with `{ documentId, topic, content: selectedText }`
3. Show a brief "Saved ✓" inline toast (2 seconds, no library — simple `setTimeout` state)
4. Button dismisses on click-away or after save

The floating button is absolutely positioned relative to the explanation container, not the viewport.

### Frontend — `/notes` Page (new)

New sidebar entry "Notes" (between Learn and Ask AI, or at bottom).

- Loads `GET /api/notes` on mount
- Groups notes by `document_title`, then by `topic` within each document
- Each note card: content text, timestamp (formatted), delete button (calls `DELETE /api/notes/:id`, removes from state)
- Empty state: "No saved notes yet. Highlight text in a Learn session to save key points."

### Shared Types
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
```

---

## Implementation Order

1. **Notes** — smallest backend footprint, no AI calls, pure CRUD + simple frontend text-selection UX
2. **Multi-Document Test** — small backend change + a toggle in TestNew; no new pages
3. **Flashcard Mode** — most complex: new table, AI generation route, 3 new frontend pages, CSS flip animation

---

## Files Changed

| File | Change |
|---|---|
| `apps/backend/src/routes/flashcards.ts` | New — generate, list, attempt, delete |
| `apps/backend/src/routes/notes.ts` | New — create, list, delete |
| `apps/backend/src/routes/test.ts` | Support `documentIds[]` in generate |
| `apps/backend/src/index.ts` | Register `/api/flashcards` and `/api/notes` routes |
| `apps/backend/src/prompts/flashcard.prompt.ts` | New — LLM prompt for Q&A generation |
| `packages/shared/src/types.ts` | Add `Flashcard`, `Note`, `NoteWithTitle`, `GenerateFlashcardsRequest`; extend `GenerateTestRequest` |
| `apps/frontend/src/lib/api.ts` | Add flashcards and notes API methods |
| `apps/frontend/src/pages/Flashcards.tsx` | New — sets list page |
| `apps/frontend/src/pages/FlashcardsNew.tsx` | New — create set form |
| `apps/frontend/src/pages/FlashcardsStudy.tsx` | New — study session with flip UX |
| `apps/frontend/src/pages/Notes.tsx` | New — notes list page |
| `apps/frontend/src/pages/LearnSession.tsx` | Add text selection + floating Save button |
| `apps/frontend/src/pages/TestNew.tsx` | Add multi-doc toggle + checkbox list |
| `apps/frontend/src/main.tsx` | Register new routes |
| `apps/frontend/src/components/layout/Sidebar.tsx` | Add Flashcards + Notes nav links |

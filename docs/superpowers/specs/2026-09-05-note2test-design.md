# Note2Test — Design Spec

**Date:** 2026-09-05
**Status:** Approved

---

## Overview

Note2Test is an AI learning platform that turns a user's own study material (PDFs) into an interactive tutor, personalised learning sessions, and generated tests. The core engine is a RAG (Retrieval-Augmented Generation) pipeline that powers three distinct modes: Learn, Ask AI, and Test.

> "Upload your notes. Let AI teach you. Then test yourself."

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, shadcn/ui |
| Backend | Node.js, Hono |
| Auth | Clerk (frontend SDK + Hono middleware) |
| Database | PostgreSQL + pgvector extension |
| PDF parsing | `pdf-parse` (server-side Node.js) |
| Embeddings | Ollama — `nomic-embed-text` (768 dimensions, free/local) |
| LLM | OpenRouter (default model: `google/gemini-flash-1.5`) |
| Package manager | pnpm workspaces (monorepo) |

---

## Project Structure

```
note2test/
├── apps/
│   ├── frontend/          # React + Vite + Tailwind + shadcn/ui
│   └── backend/           # Node.js + Hono
├── packages/
│   └── shared/            # Shared TypeScript types and DTOs
├── pnpm-workspace.yaml
└── package.json
```

---

## Design System

### Theme: Midnight Indigo

| Token | Value |
|---|---|
| Background | `#0A0A0F` |
| Surface | `#13131f` |
| Border | `#2d2d3d` |
| Primary | `#6366F1` (indigo) |
| Primary hover | `#4F46E5` |
| Accent cyan | `#22D3EE` |
| Accent amber | `#FBBF24` |
| Text primary | `#f8fafc` |
| Text muted | `#94a3b8` |
| Text subtle | `#475569` |
| Success | `#22C55E` |
| Danger | `#EF4444` |

Cards use `#13131f` background with `1px solid #2d2d3d` borders. No heavy glassmorphism — flat, clean, precision-focused.

### Logo: Circle Stamp (G)

- Icon: N2T text inside an indigo ring circle, "AI" label beneath a divider line
- Wordmark: `Note2Test` with "2" in indigo (`#6366F1`)
- Nav inline: 28×28px circle icon + wordmark

---

## Database Schema

All tables use `UUID` primary keys with `gen_random_uuid()`.

```sql
-- 1. Users (synced from Clerk via webhook)
CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id   TEXT UNIQUE NOT NULL,
  email      TEXT NOT NULL,
  name       TEXT,
  settings   JSONB DEFAULT '{}',  -- { openrouterKey, ollamaUrl, defaultModel }
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Documents (uploaded PDFs)
CREATE TABLE documents (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  filename   TEXT NOT NULL,
  page_count INT,
  status     TEXT DEFAULT 'processing', -- processing | ready | failed
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Chunks (RAG vectors — core of the system)
CREATE TABLE chunks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID REFERENCES documents(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  embedding    vector(768),
  chunk_index  INT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON chunks USING ivfflat (embedding vector_cosine_ops);

-- 4. Tests (generated test config)
CREATE TABLE tests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  document_id   UUID REFERENCES documents(id) ON DELETE CASCADE,
  topic         TEXT NOT NULL,
  question_count INT NOT NULL,
  type          TEXT NOT NULL, -- mcq | one_mark | two_mark | five_mark | mixed
  difficulty    TEXT NOT NULL, -- easy | medium | hard
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 5. Test questions
CREATE TABLE test_questions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id        UUID REFERENCES tests(id) ON DELETE CASCADE,
  question       TEXT NOT NULL,
  options        JSONB,          -- null for non-MCQ
  correct_answer TEXT NOT NULL,
  marks          INT NOT NULL DEFAULT 1,
  order_index    INT NOT NULL
);

-- 6. Test attempts (user's submission)
CREATE TABLE test_attempts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id              UUID REFERENCES tests(id) ON DELETE CASCADE,
  user_id              UUID REFERENCES users(id) ON DELETE CASCADE,
  answers              JSONB NOT NULL,  -- { questionId: answer }
  score                INT NOT NULL,
  total_marks          INT NOT NULL,
  time_elapsed_seconds INT,
  tab_switches         INT DEFAULT 0,
  started_at           TIMESTAMPTZ,
  submitted_at         TIMESTAMPTZ DEFAULT now()
);

-- 7. Chat messages (AI tutor history per document)
CREATE TABLE chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,  -- user | assistant
  content     TEXT NOT NULL,
  mode        TEXT NOT NULL,  -- learn | ask
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

---

## RAG Pipeline

### Ingestion (on PDF upload)

```
PDF upload (multipart/form-data)
  → pdf-parse: extract raw text
  → chunker: split into 512-token chunks with 50-token overlap
  → Ollama nomic-embed-text: generate 768-dim vector per chunk
  → INSERT into chunks table
  → UPDATE documents.status = 'ready'
```

Processing runs in the background. The frontend polls `GET /api/documents` to check status changes.

### Query (on user interaction)

```
User input (topic / question / test request)
  → Ollama nomic-embed-text: embed query → 768-dim vector
  → pgvector cosine similarity search: SELECT top 5 chunks WHERE document_id = ?
  → Assemble context from chunk content
  → Inject into mode-specific system prompt
  → OpenRouter LLM → response
```

### Three Route Handlers (shared RAG core)

All three import the same `rag.service.ts` for embed + search. Only the system prompt and output handling differ.

| Route | Mode | Output | System Prompt Focus |
|---|---|---|---|
| `POST /api/learn` | Learn | SSE stream | Teach and explain the topic clearly with structure |
| `POST /api/ask` | Ask AI | SSE stream | Answer conversationally, stay grounded in material |
| `POST /api/test/generate` | Test | JSON (non-streamed) | Return structured question array with correct answers |

---

## API Routes

### Auth
```
POST /api/webhooks/clerk       Sync Clerk user to users table
```

### Documents
```
POST   /api/documents/upload   Upload PDF (multipart), start processing
GET    /api/documents          List user's documents
DELETE /api/documents/:id      Delete document + cascade chunks
```

### RAG Modes
```
POST /api/learn                { documentId, topic } → SSE stream
POST /api/ask                  { documentId, message, history } → SSE stream
GET  /api/ask/:documentId/history   Chat history for a document
```

### Tests
```
POST /api/test/generate        { documentId, topic, count, type, difficulty } → test JSON
GET  /api/test/:testId         Get test + questions
POST /api/test/:testId/submit  { answers, timeElapsed, tabSwitches } → score + result
GET  /api/test/attempts        User's past attempts list
```

### Progress
```
GET /api/progress              Aggregated stats: tests done, avg score, topics, topic breakdown
```

### Settings
```
GET /api/settings              Get current user's settings (keys masked)
PUT /api/settings              Update openrouterKey, ollamaUrl, defaultModel
```

---

## Frontend Pages & Routes

| Route | Page | Auth |
|---|---|---|
| `/` | Landing page | Public |
| `/sign-in` `/sign-up` | Clerk auth | Public |
| `/dashboard` | Personalised home (greeting, continue learning, quick actions, materials, recent activity) | Required |
| `/materials` | PDF list + drag-and-drop upload + processing status | Required |
| `/learn` | Topic search + recent topics grid | Required |
| `/learn/:sessionId` | Learning session — AI explanation + quick check + AI tutor panel | Required |
| `/ask` | AI tutor chat (select document first) | Required |
| `/test/new` | Test config: material, topic, count, type, difficulty | Required |
| `/test/:testId` | Take test — elapsed timer, tab-switch banner, question sidebar | Required |
| `/test/:testId/results` | Score, time, tab-switch count, per-question review | Required |
| `/progress` | Stats dashboard: tests done, avg score, topics learned, topic performance bars, revision list | Required |
| `/settings` | OpenRouter API key, Ollama URL, default model | Required |

---

## Key UI Behaviours

### Sidebar Navigation
- Icons + labels: Home, Materials, Learn, Ask AI, Tests, Progress, Settings
- Collapses to icon-only on mobile/small screens
- Active route highlighted in indigo

### PDF Upload
- Drag-and-drop zone on `/materials`
- Multi-step progress indicator: Uploading → Extracting → Chunking → Embedding → Ready
- User can navigate away; status updates via polling

### Test Taking (`/test/:testId`)
- **Elapsed timer** top-right, counts up (not down)
- **Question sidebar** — jump to any question, shows answered/unanswered state
- **Tab-switch detection** via `visibilitychange` event:
  - Banner warning on first switch: "Tab switching detected"
  - Counter increments each switch
  - Count shown on results page (not used to invalidate test)
- Results show: score, total marks, time elapsed, tab-switch count, correct/incorrect per question

### AI Streaming
- Learn and Ask responses stream word-by-word via SSE
- Test generation is non-streamed — waits for full structured JSON response

### Settings
- OpenRouter API key, Ollama base URL (default `http://localhost:11434`), default model string
- Stored per-user as a `settings JSONB` column on the `users` table
- Editable via `PUT /api/settings`, read on every LLM/embedding call

---

## Progress Page Metrics

Sourced from `test_attempts` and `chat_messages`:

- **Tests Completed** — count of attempts
- **Topics Learned** — distinct topics from attempts + learn sessions
- **Average Score** — mean of `(score / total_marks * 100)` across all attempts
- **Study Time** — sum of `time_elapsed_seconds` across attempts
- **Topic Performance** — per-topic average score, sorted descending
- **Topics to Review** — bottom 3 topics by score, with revision link

---

## Out of Scope (v1)

- Real-time collaboration
- Mobile native app
- Custom embedding model selection (fixed to nomic-embed-text)
- PDF annotation or highlighting
- Spaced repetition scheduling
- Sharing tests with other users

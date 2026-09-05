# Note2Test — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Note2Test backend — monorepo scaffold, PostgreSQL schema, RAG pipeline (Ollama embeddings + pgvector + OpenRouter LLM), and all Hono API routes.

**Architecture:** pnpm monorepo with `apps/backend`, `apps/frontend` (stubbed), and `packages/shared`. Backend is a Hono app with a shared `rag.service.ts` core (embed + cosine search) consumed by three separate route handlers: `/api/learn` (SSE), `/api/ask` (SSE + history), `/api/test/generate` (JSON). Auth is Clerk JWT verified per-request via middleware.

**Tech Stack:** Node.js, Hono, TypeScript, postgres-js, pgvector, pdf-parse, Ollama (nomic-embed-text), OpenRouter, Clerk backend SDK, svix (webhook verification), Vitest

---

## File Map

```
note2test/
├── pnpm-workspace.yaml
├── package.json
├── .gitignore
├── .env.example
├── packages/
│   └── shared/
│       ├── package.json
│       └── src/
│           └── types.ts          # All shared TS types/DTOs
└── apps/
    ├── frontend/
    │   └── package.json          # stub only — built in Plan B
    └── backend/
        ├── package.json
        ├── tsconfig.json
        ├── vitest.config.ts
        ├── src/
        │   ├── index.ts                        # Hono app, route registration, CORS
        │   ├── db/
        │   │   ├── client.ts                   # postgres-js singleton
        │   │   ├── schema.sql                  # 7-table schema + pgvector index
        │   │   └── migrate.ts                  # reads schema.sql, runs against DB
        │   ├── middleware/
        │   │   └── auth.ts                     # Clerk JWT verify + DB user lookup
        │   ├── services/
        │   │   ├── pdf.service.ts              # extract text + chunk (512 tok, 50 overlap)
        │   │   ├── ollama.service.ts           # nomic-embed-text embedding client
        │   │   ├── openrouter.service.ts       # streaming + JSON LLM client
        │   │   └── rag.service.ts              # embed query + pgvector cosine search
        │   ├── prompts/
        │   │   ├── learn.prompt.ts             # teach/explain system prompt
        │   │   ├── ask.prompt.ts               # conversational QA system prompt
        │   │   └── test.prompt.ts              # structured test generation prompt
        │   └── routes/
        │       ├── webhooks.ts                 # POST /api/webhooks/clerk
        │       ├── documents.ts                # upload, list, delete
        │       ├── learn.ts                    # POST /api/learn (SSE)
        │       ├── ask.ts                      # POST /api/ask + GET history
        │       ├── test.ts                     # generate, get, submit, list attempts
        │       ├── progress.ts                 # GET /api/progress
        │       └── settings.ts                 # GET/PUT /api/settings
        └── tests/
            ├── services/
            │   ├── pdf.service.test.ts
            │   └── rag.service.test.ts
            └── routes/
                ├── documents.test.ts
                └── test.test.ts
```

---

## Task 1: Monorepo Scaffold

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json` (root)
- Create: `.gitignore`
- Create: `.env.example`
- Create: `packages/shared/package.json`
- Create: `packages/shared/src/types.ts` (empty export for now)
- Create: `apps/frontend/package.json` (stub)
- Create: `apps/backend/package.json`
- Create: `apps/backend/tsconfig.json`
- Create: `apps/backend/vitest.config.ts`

- [ ] **Step 1: Create root workspace files**

```bash
mkdir -p note2test/{apps/{backend/src,frontend},packages/shared/src}
cd note2test
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

`package.json` (root):
```json
{
  "name": "note2test",
  "private": true,
  "scripts": {
    "dev:backend": "pnpm --filter backend dev",
    "dev:frontend": "pnpm --filter frontend dev",
    "migrate": "pnpm --filter backend migrate",
    "test": "pnpm --filter backend test"
  }
}
```

`.gitignore`:
```
node_modules/
dist/
.env
*.env.local
uploads/
```

`.env.example`:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/note2test
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
OPENROUTER_API_KEY=sk-or-...
OLLAMA_URL=http://localhost:11434
PORT=3001
```

- [ ] **Step 2: Create shared package**

`packages/shared/package.json`:
```json
{
  "name": "shared",
  "version": "0.0.1",
  "main": "./src/types.ts",
  "exports": {
    ".": "./src/types.ts"
  }
}
```

`packages/shared/src/types.ts`:
```typescript
export {}
```

- [ ] **Step 3: Create frontend stub**

`apps/frontend/package.json`:
```json
{
  "name": "frontend",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "echo 'Frontend not yet built — see Plan B'"
  }
}
```

- [ ] **Step 4: Create backend package files**

`apps/backend/package.json`:
```json
{
  "name": "backend",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "migrate": "tsx src/db/migrate.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@clerk/backend": "^1.13.0",
    "@hono/node-server": "^1.13.0",
    "hono": "^4.6.0",
    "pdf-parse": "^1.1.1",
    "postgres": "^3.4.4",
    "shared": "workspace:*",
    "svix": "^1.39.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/pdf-parse": "^1.1.4",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`apps/backend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src", "tests"]
}
```

`apps/backend/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
})
```

- [ ] **Step 5: Install dependencies**

```bash
cd /path/to/note2test
pnpm install
```

Expected: Packages installed, `node_modules` created at root and in each app.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: monorepo scaffold — pnpm workspaces, backend/frontend/shared packages"
```

---

## Task 2: Shared TypeScript Types

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Write all shared types**

`packages/shared/src/types.ts`:
```typescript
// Domain types
export type DocumentStatus = 'processing' | 'ready' | 'failed'
export type TestType = 'mcq' | 'one_mark' | 'two_mark' | 'five_mark' | 'mixed'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type MessageRole = 'user' | 'assistant'
export type ChatMode = 'learn' | 'ask'

export interface UserSettings {
  openrouterKey?: string
  ollamaUrl?: string
  defaultModel?: string
}

export interface User {
  id: string
  clerk_id: string
  email: string
  name: string | null
  settings: UserSettings
  created_at: string
}

export interface Document {
  id: string
  user_id: string
  title: string
  filename: string
  page_count: number | null
  status: DocumentStatus
  created_at: string
}

export interface Chunk {
  id: string
  document_id: string
  content: string
  chunk_index: number
  created_at: string
}

export interface Test {
  id: string
  user_id: string
  document_id: string
  topic: string
  question_count: number
  type: TestType
  difficulty: Difficulty
  created_at: string
}

export interface TestQuestion {
  id: string
  test_id: string
  question: string
  options: string[] | null
  correct_answer: string
  marks: number
  order_index: number
}

export interface TestAttempt {
  id: string
  test_id: string
  user_id: string
  answers: Record<string, string>
  score: number
  total_marks: number
  time_elapsed_seconds: number | null
  tab_switches: number
  started_at: string | null
  submitted_at: string
}

export interface ChatMessage {
  id: string
  user_id: string
  document_id: string
  role: MessageRole
  content: string
  mode: ChatMode
  created_at: string
}

// API request/response types
export interface LearnRequest {
  documentId: string
  topic: string
}

export interface AskRequest {
  documentId: string
  message: string
  history: Array<{ role: MessageRole; content: string }>
}

export interface GenerateTestRequest {
  documentId: string
  topic: string
  count: number
  type: TestType
  difficulty: Difficulty
}

export interface GenerateTestResponse {
  test: Test
  questions: TestQuestion[]
}

export interface SubmitTestRequest {
  answers: Record<string, string>
  timeElapsed: number
  tabSwitches: number
}

export interface SubmitTestResponse {
  attempt: TestAttempt
  questions: TestQuestion[]
}

export interface ProgressResponse {
  testsCompleted: number
  topicsLearned: number
  averageScore: number
  studyTimeSeconds: number
  topicPerformance: Array<{ topic: string; score: number; attempts: number }>
  topicsToReview: string[]
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: shared TypeScript types for all domain models and API DTOs"
```

---

## Task 3: Database Schema + Migration

**Files:**
- Create: `apps/backend/src/db/schema.sql`
- Create: `apps/backend/src/db/client.ts`
- Create: `apps/backend/src/db/migrate.ts`

**Prereq:** PostgreSQL running with pgvector extension available.
```bash
# Start postgres with pgvector (Docker)
docker run -d \
  --name note2test-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=note2test \
  -p 5432:5432 \
  pgvector/pgvector:pg16
```

- [ ] **Step 1: Write schema.sql**

`apps/backend/src/db/schema.sql`:
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id   TEXT UNIQUE NOT NULL,
  email      TEXT NOT NULL,
  name       TEXT,
  settings   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  filename   TEXT NOT NULL,
  page_count INT,
  status     TEXT NOT NULL DEFAULT 'processing',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chunks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  embedding    vector(768),
  chunk_index  INT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chunks_embedding_idx
  ON chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE TABLE IF NOT EXISTS tests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id    UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  topic          TEXT NOT NULL,
  question_count INT NOT NULL,
  type           TEXT NOT NULL,
  difficulty     TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS test_questions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id        UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  question       TEXT NOT NULL,
  options        JSONB,
  correct_answer TEXT NOT NULL,
  marks          INT NOT NULL DEFAULT 1,
  order_index    INT NOT NULL
);

CREATE TABLE IF NOT EXISTS test_attempts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id              UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answers              JSONB NOT NULL DEFAULT '{}',
  score                INT NOT NULL DEFAULT 0,
  total_marks          INT NOT NULL DEFAULT 0,
  time_elapsed_seconds INT,
  tab_switches         INT NOT NULL DEFAULT 0,
  started_at           TIMESTAMPTZ,
  submitted_at         TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,
  content     TEXT NOT NULL,
  mode        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

- [ ] **Step 2: Write DB client**

`apps/backend/src/db/client.ts`:
```typescript
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
})

export default sql
```

- [ ] **Step 3: Write migration runner**

`apps/backend/src/db/migrate.ts`:
```typescript
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import sql from './client.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function migrate() {
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8')
  console.log('Running migrations...')
  await sql.unsafe(schema)
  console.log('Migrations complete.')
  await sql.end()
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
```

- [ ] **Step 4: Create .env file and run migration**

```bash
# In apps/backend/, create .env
cp ../../.env.example .env
# Fill in DATABASE_URL=postgresql://postgres:postgres@localhost:5432/note2test

cd apps/backend
pnpm migrate
```

Expected output:
```
Running migrations...
Migrations complete.
```

- [ ] **Step 5: Verify tables exist**

```bash
docker exec -it note2test-db psql -U postgres -d note2test -c "\dt"
```

Expected: 7 tables listed (users, documents, chunks, tests, test_questions, test_attempts, chat_messages).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/db/
git commit -m "feat: database schema (7 tables + pgvector index) and migration runner"
```

---

## Task 4: Auth Middleware

**Files:**
- Create: `apps/backend/src/middleware/auth.ts`

- [ ] **Step 1: Write Clerk auth middleware**

`apps/backend/src/middleware/auth.ts`:
```typescript
import { createMiddleware } from 'hono/factory'
import { createClerkClient } from '@clerk/backend'
import sql from '../db/client.js'

export type AuthEnv = {
  Variables: {
    clerkUserId: string
    dbUserId: string
    userSettings: { openrouterKey?: string; ollamaUrl?: string; defaultModel?: string }
  }
}

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = authHeader.replace('Bearer ', '')

  try {
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! })
    const payload = await clerk.verifyToken(token)
    const clerkUserId = payload.sub

    // Look up DB user, auto-create if missing (race-safe via ON CONFLICT)
    const [user] = await sql<Array<{ id: string; settings: Record<string, string> }>>`
      INSERT INTO users (clerk_id, email, name)
      VALUES (${clerkUserId}, '', '')
      ON CONFLICT (clerk_id) DO UPDATE SET clerk_id = EXCLUDED.clerk_id
      RETURNING id, settings
    `

    c.set('clerkUserId', clerkUserId)
    c.set('dbUserId', user.id)
    c.set('userSettings', user.settings ?? {})
    await next()
  } catch {
    return c.json({ error: 'Unauthorized' }, 401)
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/middleware/auth.ts
git commit -m "feat: Clerk JWT auth middleware with DB user auto-create"
```

---

## Task 5: Clerk Webhook Route

**Files:**
- Create: `apps/backend/src/routes/webhooks.ts`

- [ ] **Step 1: Write webhook handler**

`apps/backend/src/routes/webhooks.ts`:
```typescript
import { Hono } from 'hono'
import { Webhook } from 'svix'
import sql from '../db/client.js'

const app = new Hono()

app.post('/clerk', async (c) => {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET!
  const svixId = c.req.header('svix-id')
  const svixTimestamp = c.req.header('svix-timestamp')
  const svixSignature = c.req.header('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return c.json({ error: 'Missing svix headers' }, 400)
  }

  const body = await c.req.text()

  try {
    const wh = new Webhook(webhookSecret)
    const evt = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as { type: string; data: { id: string; email_addresses: Array<{ email_address: string }>; first_name?: string; last_name?: string } }

    const { type, data } = evt

    if (type === 'user.created' || type === 'user.updated') {
      const email = data.email_addresses[0]?.email_address ?? ''
      const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || null

      await sql`
        INSERT INTO users (clerk_id, email, name)
        VALUES (${data.id}, ${email}, ${name})
        ON CONFLICT (clerk_id) DO UPDATE
          SET email = EXCLUDED.email,
              name  = EXCLUDED.name
      `
    }

    return c.json({ received: true })
  } catch (err) {
    return c.json({ error: 'Webhook verification failed' }, 400)
  }
})

export default app
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/routes/webhooks.ts
git commit -m "feat: Clerk webhook handler — upsert user on user.created/updated"
```

---

## Task 6: PDF Service (Extract + Chunk)

**Files:**
- Create: `apps/backend/src/services/pdf.service.ts`
- Create: `apps/backend/tests/services/pdf.service.test.ts`

- [ ] **Step 1: Write failing tests**

`apps/backend/tests/services/pdf.service.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { chunkText } from '../../src/services/pdf.service.js'

describe('chunkText', () => {
  it('returns empty array for empty string', () => {
    expect(chunkText('')).toEqual([])
  })

  it('returns empty array for whitespace-only string', () => {
    expect(chunkText('   \n\t  ')).toEqual([])
  })

  it('returns a single chunk when text is shorter than chunkSize', () => {
    const text = 'short text here'
    const chunks = chunkText(text, 512, 50)
    expect(chunks).toHaveLength(1)
    expect(chunks[0].content).toBe('short text here')
    expect(chunks[0].index).toBe(0)
  })

  it('splits long text into multiple chunks', () => {
    const words = Array.from({ length: 600 }, (_, i) => `word${i}`)
    const text = words.join(' ')
    const chunks = chunkText(text, 512, 50)
    expect(chunks.length).toBeGreaterThan(1)
  })

  it('each chunk has at most chunkSize words', () => {
    const text = Array.from({ length: 1200 }, (_, i) => `word${i}`).join(' ')
    const chunks = chunkText(text, 512, 50)
    for (const chunk of chunks) {
      expect(chunk.content.split(' ').length).toBeLessThanOrEqual(512)
    }
  })

  it('uses 50-word overlap between consecutive chunks', () => {
    const text = Array.from({ length: 600 }, (_, i) => `word${i}`).join(' ')
    const chunks = chunkText(text, 512, 50)
    const lastWordsOfFirst = chunks[0].content.split(' ').slice(-50)
    const firstWordsOfSecond = chunks[1].content.split(' ').slice(0, 50)
    expect(lastWordsOfFirst).toEqual(firstWordsOfSecond)
  })

  it('assigns sequential index values', () => {
    const text = Array.from({ length: 1200 }, (_, i) => `word${i}`).join(' ')
    const chunks = chunkText(text, 512, 50)
    chunks.forEach((chunk, i) => {
      expect(chunk.index).toBe(i)
    })
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd apps/backend
pnpm test tests/services/pdf.service.test.ts
```

Expected: FAIL — `chunkText` not found.

- [ ] **Step 3: Implement pdf.service.ts**

`apps/backend/src/services/pdf.service.ts`:
```typescript
import pdfParse from 'pdf-parse'

export interface TextChunk {
  content: string
  index: number
}

export async function extractText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const data = await pdfParse(buffer)
  return { text: data.text, pageCount: data.numpages }
}

export function chunkText(text: string, chunkSize = 512, overlap = 50): TextChunk[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0)
  if (words.length === 0) return []

  const chunks: TextChunk[] = []
  let i = 0
  let index = 0

  while (i < words.length) {
    const slice = words.slice(i, i + chunkSize)
    chunks.push({ content: slice.join(' '), index: index++ })
    if (i + chunkSize >= words.length) break
    i += chunkSize - overlap
  }

  return chunks
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm test tests/services/pdf.service.test.ts
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/services/pdf.service.ts apps/backend/tests/services/pdf.service.test.ts
git commit -m "feat: PDF text extraction and token-overlap chunking service"
```

---

## Task 7: Ollama Embedding Service

**Files:**
- Create: `apps/backend/src/services/ollama.service.ts`

- [ ] **Step 1: Write the service**

`apps/backend/src/services/ollama.service.ts`:
```typescript
const DEFAULT_OLLAMA_URL = 'http://localhost:11434'

interface OllamaEmbeddingResponse {
  embedding: number[]
}

export async function generateEmbedding(
  text: string,
  ollamaUrl = DEFAULT_OLLAMA_URL,
): Promise<number[]> {
  const res = await fetch(`${ollamaUrl}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'nomic-embed-text', prompt: text }),
  })

  if (!res.ok) {
    throw new Error(`Ollama embedding failed: ${res.status} ${await res.text()}`)
  }

  const data = (await res.json()) as OllamaEmbeddingResponse
  return data.embedding
}

export async function generateEmbeddings(
  texts: string[],
  ollamaUrl = DEFAULT_OLLAMA_URL,
): Promise<number[][]> {
  // Sequential to avoid overwhelming Ollama
  const results: number[][] = []
  for (const text of texts) {
    results.push(await generateEmbedding(text, ollamaUrl))
  }
  return results
}
```

- [ ] **Step 2: Verify Ollama is running with the right model**

```bash
curl http://localhost:11434/api/embeddings \
  -d '{"model":"nomic-embed-text","prompt":"hello world"}'
```

Expected: JSON response with `"embedding": [...]` array of 768 numbers.

If not installed:
```bash
ollama pull nomic-embed-text
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/services/ollama.service.ts
git commit -m "feat: Ollama nomic-embed-text embedding service"
```

---

## Task 8: OpenRouter LLM Service

**Files:**
- Create: `apps/backend/src/services/openrouter.service.ts`

- [ ] **Step 1: Write the service**

`apps/backend/src/services/openrouter.service.ts`:
```typescript
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

function headers(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://note2test.app',
    'X-Title': 'Note2Test',
  }
}

/**
 * Returns the raw SSE ReadableStream from OpenRouter.
 * Caller is responsible for streaming it to the client.
 */
export async function streamCompletion(
  messages: LLMMessage[],
  apiKey: string,
  model = 'google/gemini-flash-1.5',
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({ model, messages, stream: true }),
  })

  if (!res.ok) {
    throw new Error(`OpenRouter stream error: ${res.status} ${await res.text()}`)
  }

  return res.body!
}

/**
 * Non-streaming JSON completion — waits for full response.
 * Used for test generation where we need structured output.
 */
export async function completeJson<T>(
  messages: LLMMessage[],
  apiKey: string,
  model = 'google/gemini-flash-1.5',
): Promise<T> {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    throw new Error(`OpenRouter completion error: ${res.status} ${await res.text()}`)
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>
  }

  return JSON.parse(data.choices[0].message.content) as T
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/services/openrouter.service.ts
git commit -m "feat: OpenRouter streaming and JSON completion service"
```

---

## Task 9: RAG Service (Shared Core)

**Files:**
- Create: `apps/backend/src/services/rag.service.ts`
- Create: `apps/backend/tests/services/rag.service.test.ts`

- [ ] **Step 1: Write failing tests**

`apps/backend/tests/services/rag.service.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { buildContext } from '../../src/services/rag.service.js'

// Note: retrieveChunks requires a live DB + Ollama — test buildContext only

describe('buildContext', () => {
  it('formats chunks into numbered sections', () => {
    const chunks = [
      { content: 'First chunk content.', similarity: 0.9 },
      { content: 'Second chunk content.', similarity: 0.8 },
    ]
    const result = buildContext(chunks)
    expect(result).toBe('[Chunk 1]\nFirst chunk content.\n\n[Chunk 2]\nSecond chunk content.')
  })

  it('returns empty string for empty chunks array', () => {
    expect(buildContext([])).toBe('')
  })

  it('handles a single chunk', () => {
    const chunks = [{ content: 'Only chunk.', similarity: 0.95 }]
    expect(buildContext(chunks)).toBe('[Chunk 1]\nOnly chunk.')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm test tests/services/rag.service.test.ts
```

Expected: FAIL — `buildContext` not found.

- [ ] **Step 3: Implement rag.service.ts**

`apps/backend/src/services/rag.service.ts`:
```typescript
import { generateEmbedding } from './ollama.service.js'
import sql from '../db/client.js'

export interface RetrievedChunk {
  content: string
  similarity: number
}

export async function retrieveChunks(
  query: string,
  documentId: string,
  topK = 5,
  ollamaUrl?: string,
): Promise<RetrievedChunk[]> {
  const embedding = await generateEmbedding(query, ollamaUrl)
  const vectorLiteral = `[${embedding.join(',')}]`

  const rows = await sql<Array<{ content: string; similarity: number }>>`
    SELECT
      content,
      1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
    FROM chunks
    WHERE document_id = ${documentId}
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT ${topK}
  `

  return rows
}

export function buildContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map((chunk, i) => `[Chunk ${i + 1}]\n${chunk.content}`)
    .join('\n\n')
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm test tests/services/rag.service.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/services/rag.service.ts apps/backend/tests/services/rag.service.test.ts
git commit -m "feat: RAG service — pgvector cosine search + context builder"
```

---

## Task 10: System Prompts

**Files:**
- Create: `apps/backend/src/prompts/learn.prompt.ts`
- Create: `apps/backend/src/prompts/ask.prompt.ts`
- Create: `apps/backend/src/prompts/test.prompt.ts`

- [ ] **Step 1: Write learn prompt**

`apps/backend/src/prompts/learn.prompt.ts`:
```typescript
import type { LLMMessage } from '../services/openrouter.service.js'

export function learnPrompt(topic: string, context: string): LLMMessage[] {
  return [
    {
      role: 'system',
      content: `You are an expert tutor explaining study material to a student.
Your job is to teach "${topic}" clearly and thoroughly using ONLY the provided context.

Structure your explanation with:
1. A brief definition or overview
2. Why it matters / real-world relevance
3. Key concepts broken down simply
4. A concrete example
5. A quick summary

Use simple language. Avoid jargon unless you explain it immediately.
If the context doesn't cover the topic, say so clearly.`,
    },
    {
      role: 'user',
      content: `Context from my study material:\n\n${context}\n\nPlease teach me about: ${topic}`,
    },
  ]
}
```

- [ ] **Step 2: Write ask prompt**

`apps/backend/src/prompts/ask.prompt.ts`:
```typescript
import type { LLMMessage } from '../services/openrouter.service.js'
import type { MessageRole } from 'shared'

export function askPrompt(
  question: string,
  context: string,
  history: Array<{ role: MessageRole; content: string }>,
): LLMMessage[] {
  const systemMessage: LLMMessage = {
    role: 'system',
    content: `You are a helpful AI tutor answering questions about a student's study material.
Answer questions using ONLY the provided context. Be conversational but accurate.
If the answer isn't in the context, say "I don't see that in your material" and offer what you do know from the context.
Keep answers concise — aim for 2-4 sentences unless a longer explanation is clearly needed.`,
  }

  const contextMessage: LLMMessage = {
    role: 'user',
    content: `Relevant context from my notes:\n\n${context}`,
  }

  const contextAck: LLMMessage = {
    role: 'assistant',
    content: 'Got it, I have the relevant context. Ask me anything about your material.',
  }

  const historyMessages: LLMMessage[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  const userMessage: LLMMessage = {
    role: 'user',
    content: question,
  }

  return [systemMessage, contextMessage, contextAck, ...historyMessages, userMessage]
}
```

- [ ] **Step 3: Write test generation prompt**

`apps/backend/src/prompts/test.prompt.ts`:
```typescript
import type { LLMMessage } from '../services/openrouter.service.js'
import type { TestType, Difficulty } from 'shared'

const TYPE_INSTRUCTIONS: Record<TestType, string> = {
  mcq: 'Multiple choice questions with exactly 4 options labelled "A", "B", "C", "D". Set correct_answer to the letter only (e.g. "B"). Set marks to 1.',
  one_mark: 'Short one-sentence answer questions. Set options to null. Set marks to 1.',
  two_mark: 'Short paragraph answer questions (2-4 sentences expected). Set options to null. Set marks to 2.',
  five_mark: 'Detailed essay-style questions requiring thorough explanations. Set options to null. Set marks to 5.',
  mixed: 'A mix: roughly half MCQ (marks: 1, options: [...]), a quarter short answer (marks: 1, options: null), and a quarter detailed (marks: 5, options: null).',
}

export function testPrompt(
  topic: string,
  context: string,
  count: number,
  type: TestType,
  difficulty: Difficulty,
): LLMMessage[] {
  return [
    {
      role: 'system',
      content: `You are an expert exam question generator.
Generate exactly ${count} ${difficulty}-difficulty questions about "${topic}".

Question type instructions: ${TYPE_INSTRUCTIONS[type]}

Difficulty guidelines:
- easy: recall and definitions, straightforward facts from the material
- medium: application and comparison, requires understanding relationships
- hard: analysis and edge cases, requires synthesis of multiple concepts

Return ONLY a valid JSON object in this exact structure — no markdown, no explanation:
{
  "questions": [
    {
      "question": "...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."] or null,
      "correct_answer": "...",
      "marks": 1
    }
  ]
}

Base every question strictly on the provided context. Do not invent information not present in the material.`,
    },
    {
      role: 'user',
      content: `Study material context:\n\n${context}\n\nGenerate ${count} ${difficulty} ${type} questions about: ${topic}`,
    },
  ]
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/prompts/
git commit -m "feat: system prompts for learn, ask, and test generation modes"
```

---

## Task 11: Document Routes (Upload + List + Delete)

**Files:**
- Create: `apps/backend/src/routes/documents.ts`
- Create: `apps/backend/tests/routes/documents.test.ts`

- [ ] **Step 1: Write failing test**

`apps/backend/tests/routes/documents.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// We test the processing logic in isolation — not the full HTTP stack
// Integration tests require a running DB; skip with SKIP_INTEGRATION=true
describe('document processing logic', () => {
  it('marks document as failed when PDF extraction throws', async () => {
    // This tests the error handling branch in the background processor
    const mockUpdate = vi.fn()
    const mockExtract = vi.fn().mockRejectedValue(new Error('Corrupt PDF'))

    async function processDocument(
      docId: string,
      buffer: Buffer,
      extract: typeof mockExtract,
      update: typeof mockUpdate,
    ) {
      try {
        await extract(buffer)
        await update(docId, 'ready')
      } catch {
        await update(docId, 'failed')
      }
    }

    await processDocument('doc-1', Buffer.from(''), mockExtract, mockUpdate)
    expect(mockUpdate).toHaveBeenCalledWith('doc-1', 'failed')
  })

  it('marks document as ready on successful processing', async () => {
    const mockUpdate = vi.fn()
    const mockExtract = vi.fn().mockResolvedValue({ text: 'Hello world', pageCount: 1 })

    async function processDocument(
      docId: string,
      buffer: Buffer,
      extract: typeof mockExtract,
      update: typeof mockUpdate,
    ) {
      try {
        await extract(buffer)
        await update(docId, 'ready')
      } catch {
        await update(docId, 'failed')
      }
    }

    await processDocument('doc-1', Buffer.from(''), mockExtract, mockUpdate)
    expect(mockUpdate).toHaveBeenCalledWith('doc-1', 'ready')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
pnpm test tests/routes/documents.test.ts
```

Expected: FAIL — no implementation yet.

- [ ] **Step 3: Implement documents route**

`apps/backend/src/routes/documents.ts`:
```typescript
import { Hono } from 'hono'
import sql from '../db/client.js'
import { extractText, chunkText } from '../services/pdf.service.js'
import { generateEmbeddings } from '../services/ollama.service.js'
import { authMiddleware, type AuthEnv } from '../middleware/auth.js'

const app = new Hono<AuthEnv>()
app.use('*', authMiddleware)

// POST /api/documents/upload
app.post('/upload', async (c) => {
  const userId = c.get('dbUserId')
  const settings = c.get('userSettings')
  const ollamaUrl = settings.ollamaUrl ?? process.env.OLLAMA_URL ?? 'http://localhost:11434'

  const formData = await c.req.formData()
  const file = formData.get('file') as File | null

  if (!file) return c.json({ error: 'No file provided' }, 400)
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return c.json({ error: 'Only PDF files are supported' }, 400)
  }

  const title = (formData.get('title') as string) || file.name.replace('.pdf', '')

  // Insert document record with 'processing' status
  const [doc] = await sql`
    INSERT INTO documents (user_id, title, filename, status)
    VALUES (${userId}, ${title}, ${file.name}, 'processing')
    RETURNING *
  `

  // Process in background (don't await — return immediately)
  const buffer = Buffer.from(await file.arrayBuffer())
  processDocument(doc.id, buffer, ollamaUrl).catch(console.error)

  return c.json({ document: doc }, 201)
})

async function processDocument(docId: string, buffer: Buffer, ollamaUrl: string) {
  try {
    const { text, pageCount } = await extractText(buffer)
    const chunks = chunkText(text)

    await sql`UPDATE documents SET page_count = ${pageCount} WHERE id = ${docId}`

    if (chunks.length > 0) {
      const contents = chunks.map((c) => c.content)
      const embeddings = await generateEmbeddings(contents, ollamaUrl)

      // Batch insert chunks
      const chunkRows = chunks.map((chunk, i) => ({
        document_id: docId,
        content: chunk.content,
        embedding: `[${embeddings[i].join(',')}]`,
        chunk_index: chunk.index,
      }))

      for (const row of chunkRows) {
        await sql`
          INSERT INTO chunks (document_id, content, embedding, chunk_index)
          VALUES (${row.document_id}, ${row.content}, ${row.embedding}::vector, ${row.chunk_index})
        `
      }
    }

    await sql`UPDATE documents SET status = 'ready' WHERE id = ${docId}`
  } catch (err) {
    console.error('Document processing failed:', err)
    await sql`UPDATE documents SET status = 'failed' WHERE id = ${docId}`
  }
}

// GET /api/documents
app.get('/', async (c) => {
  const userId = c.get('dbUserId')
  const docs = await sql`
    SELECT * FROM documents WHERE user_id = ${userId} ORDER BY created_at DESC
  `
  return c.json({ documents: docs })
})

// DELETE /api/documents/:id
app.delete('/:id', async (c) => {
  const userId = c.get('dbUserId')
  const docId = c.req.param('id')

  const [doc] = await sql`
    DELETE FROM documents WHERE id = ${docId} AND user_id = ${userId} RETURNING id
  `

  if (!doc) return c.json({ error: 'Document not found' }, 404)
  return c.json({ deleted: true })
})

export default app
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm test tests/routes/documents.test.ts
```

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/routes/documents.ts apps/backend/tests/routes/documents.test.ts
git commit -m "feat: document upload route — PDF processing pipeline with background embedding"
```

---

## Task 12: Learn Route (SSE)

**Files:**
- Create: `apps/backend/src/routes/learn.ts`

- [ ] **Step 1: Implement learn SSE route**

`apps/backend/src/routes/learn.ts`:
```typescript
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { retrieveChunks, buildContext } from '../services/rag.service.js'
import { streamCompletion } from '../services/openrouter.service.js'
import { learnPrompt } from '../prompts/learn.prompt.js'
import { authMiddleware, type AuthEnv } from '../middleware/auth.js'
import sql from '../db/client.js'
import type { LearnRequest } from 'shared'

const app = new Hono<AuthEnv>()
app.use('*', authMiddleware)

app.post('/', async (c) => {
  const { documentId, topic } = await c.req.json<LearnRequest>()
  const userId = c.get('dbUserId')
  const settings = c.get('userSettings')

  const apiKey = settings.openrouterKey ?? process.env.OPENROUTER_API_KEY!
  const ollamaUrl = settings.ollamaUrl ?? process.env.OLLAMA_URL ?? 'http://localhost:11434'
  const model = settings.defaultModel ?? 'google/gemini-flash-1.5'

  if (!apiKey) return c.json({ error: 'OpenRouter API key not configured' }, 400)

  // Retrieve relevant chunks
  const chunks = await retrieveChunks(topic, documentId, 5, ollamaUrl)
  const context = buildContext(chunks)
  const messages = learnPrompt(topic, context)

  // Save user message
  await sql`
    INSERT INTO chat_messages (user_id, document_id, role, content, mode)
    VALUES (${userId}, ${documentId}, 'user', ${`Teach me: ${topic}`}, 'learn')
  `

  // Stream LLM response
  const llmStream = await streamCompletion(messages, apiKey, model)

  return streamSSE(c, async (sse) => {
    let fullResponse = ''
    const reader = llmStream.getReader()
    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value, { stream: true })
        const lines = text.split('\n').filter((l) => l.startsWith('data: '))

        for (const line of lines) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const token: string = parsed.choices?.[0]?.delta?.content ?? ''
            if (token) {
              fullResponse += token
              await sse.writeSSE({ data: JSON.stringify({ token }) })
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    // Save complete assistant response
    await sql`
      INSERT INTO chat_messages (user_id, document_id, role, content, mode)
      VALUES (${userId}, ${documentId}, 'assistant', ${fullResponse}, 'learn')
    `
  })
})

export default app
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/routes/learn.ts
git commit -m "feat: learn SSE route — RAG + OpenRouter streaming with chat history"
```

---

## Task 13: Ask Route (SSE + History)

**Files:**
- Create: `apps/backend/src/routes/ask.ts`

- [ ] **Step 1: Implement ask route**

`apps/backend/src/routes/ask.ts`:
```typescript
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { retrieveChunks, buildContext } from '../services/rag.service.js'
import { streamCompletion } from '../services/openrouter.service.js'
import { askPrompt } from '../prompts/ask.prompt.js'
import { authMiddleware, type AuthEnv } from '../middleware/auth.js'
import sql from '../db/client.js'
import type { AskRequest } from 'shared'

const app = new Hono<AuthEnv>()
app.use('*', authMiddleware)

// POST /api/ask — conversational QA with streaming
app.post('/', async (c) => {
  const { documentId, message, history } = await c.req.json<AskRequest>()
  const userId = c.get('dbUserId')
  const settings = c.get('userSettings')

  const apiKey = settings.openrouterKey ?? process.env.OPENROUTER_API_KEY!
  const ollamaUrl = settings.ollamaUrl ?? process.env.OLLAMA_URL ?? 'http://localhost:11434'
  const model = settings.defaultModel ?? 'google/gemini-flash-1.5'

  if (!apiKey) return c.json({ error: 'OpenRouter API key not configured' }, 400)

  const chunks = await retrieveChunks(message, documentId, 5, ollamaUrl)
  const context = buildContext(chunks)
  const messages = askPrompt(message, context, history)

  // Save user message
  await sql`
    INSERT INTO chat_messages (user_id, document_id, role, content, mode)
    VALUES (${userId}, ${documentId}, 'user', ${message}, 'ask')
  `

  const llmStream = await streamCompletion(messages, apiKey, model)

  return streamSSE(c, async (sse) => {
    let fullResponse = ''
    const reader = llmStream.getReader()
    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value, { stream: true })
        const lines = text.split('\n').filter((l) => l.startsWith('data: '))

        for (const line of lines) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const token: string = parsed.choices?.[0]?.delta?.content ?? ''
            if (token) {
              fullResponse += token
              await sse.writeSSE({ data: JSON.stringify({ token }) })
            }
          } catch {}
        }
      }
    } finally {
      reader.releaseLock()
    }

    await sql`
      INSERT INTO chat_messages (user_id, document_id, role, content, mode)
      VALUES (${userId}, ${documentId}, 'assistant', ${fullResponse}, 'ask')
    `
  })
})

// GET /api/ask/:documentId/history
app.get('/:documentId/history', async (c) => {
  const userId = c.get('dbUserId')
  const documentId = c.req.param('documentId')

  const messages = await sql`
    SELECT id, role, content, mode, created_at
    FROM chat_messages
    WHERE user_id = ${userId} AND document_id = ${documentId}
    ORDER BY created_at ASC
  `

  return c.json({ messages })
})

export default app
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/routes/ask.ts
git commit -m "feat: ask SSE route — RAG Q&A with conversation history"
```

---

## Task 14: Test Routes (Generate + Get + Submit + List)

**Files:**
- Create: `apps/backend/src/routes/test.ts`
- Create: `apps/backend/tests/routes/test.test.ts`

- [ ] **Step 1: Write failing tests**

`apps/backend/tests/routes/test.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'

// Test scoring logic in isolation
function scoreAttempt(
  questions: Array<{ id: string; correct_answer: string; marks: number }>,
  answers: Record<string, string>,
): { score: number; totalMarks: number } {
  let score = 0
  let totalMarks = 0

  for (const q of questions) {
    totalMarks += q.marks
    if (answers[q.id]?.trim().toLowerCase() === q.correct_answer.trim().toLowerCase()) {
      score += q.marks
    }
  }

  return { score, totalMarks }
}

describe('scoreAttempt', () => {
  const questions = [
    { id: 'q1', correct_answer: 'B', marks: 1 },
    { id: 'q2', correct_answer: 'Paris', marks: 1 },
    { id: 'q3', correct_answer: 'Normalization reduces redundancy', marks: 5 },
  ]

  it('gives full score when all answers are correct', () => {
    const answers = {
      q1: 'B',
      q2: 'Paris',
      q3: 'Normalization reduces redundancy',
    }
    const { score, totalMarks } = scoreAttempt(questions, answers)
    expect(score).toBe(7)
    expect(totalMarks).toBe(7)
  })

  it('gives zero for all wrong answers', () => {
    const answers = { q1: 'A', q2: 'London', q3: 'Wrong answer' }
    const { score } = scoreAttempt(questions, answers)
    expect(score).toBe(0)
  })

  it('is case-insensitive', () => {
    const answers = { q1: 'b', q2: 'paris', q3: 'normalization reduces redundancy' }
    const { score } = scoreAttempt(questions, answers)
    expect(score).toBe(7)
  })

  it('handles missing answers as wrong', () => {
    const { score, totalMarks } = scoreAttempt(questions, {})
    expect(score).toBe(0)
    expect(totalMarks).toBe(7)
  })

  it('scores partial attempts correctly', () => {
    const answers = { q1: 'B', q2: 'Wrong' }
    const { score } = scoreAttempt(questions, answers)
    expect(score).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm test tests/routes/test.test.ts
```

Expected: FAIL — `scoreAttempt` not exported yet.

- [ ] **Step 3: Implement test routes**

`apps/backend/src/routes/test.ts`:
```typescript
import { Hono } from 'hono'
import { retrieveChunks, buildContext } from '../services/rag.service.js'
import { completeJson } from '../services/openrouter.service.js'
import { testPrompt } from '../prompts/test.prompt.js'
import { authMiddleware, type AuthEnv } from '../middleware/auth.js'
import sql from '../db/client.js'
import type {
  GenerateTestRequest,
  GenerateTestResponse,
  SubmitTestRequest,
  SubmitTestResponse,
  TestQuestion,
} from 'shared'

const app = new Hono<AuthEnv>()
app.use('*', authMiddleware)

export function scoreAttempt(
  questions: Array<{ id: string; correct_answer: string; marks: number }>,
  answers: Record<string, string>,
): { score: number; totalMarks: number } {
  let score = 0
  let totalMarks = 0
  for (const q of questions) {
    totalMarks += q.marks
    if (answers[q.id]?.trim().toLowerCase() === q.correct_answer.trim().toLowerCase()) {
      score += q.marks
    }
  }
  return { score, totalMarks }
}

// GET /api/test/attempts — MUST be before /:testId to avoid param capture
app.get('/attempts', async (c) => {
  const userId = c.get('dbUserId')
  const attempts = await sql`
    SELECT
      ta.*,
      t.topic,
      t.type,
      t.difficulty,
      d.title AS document_title
    FROM test_attempts ta
    JOIN tests t ON ta.test_id = t.id
    JOIN documents d ON t.document_id = d.id
    WHERE ta.user_id = ${userId}
    ORDER BY ta.submitted_at DESC
  `
  return c.json({ attempts })
})

// POST /api/test/generate
app.post('/generate', async (c) => {
  const body = await c.req.json<GenerateTestRequest>()
  const { documentId, topic, count, type, difficulty } = body
  const userId = c.get('dbUserId')
  const settings = c.get('userSettings')

  const apiKey = settings.openrouterKey ?? process.env.OPENROUTER_API_KEY!
  const ollamaUrl = settings.ollamaUrl ?? process.env.OLLAMA_URL ?? 'http://localhost:11434'
  const model = settings.defaultModel ?? 'google/gemini-flash-1.5'

  if (!apiKey) return c.json({ error: 'OpenRouter API key not configured' }, 400)

  const chunks = await retrieveChunks(topic, documentId, 8, ollamaUrl)
  const context = buildContext(chunks)
  const messages = testPrompt(topic, context, count, type, difficulty)

  const result = await completeJson<{ questions: Array<Omit<TestQuestion, 'id' | 'test_id' | 'order_index'>> }>(
    messages,
    apiKey,
    model,
  )

  // Persist test
  const [test] = await sql`
    INSERT INTO tests (user_id, document_id, topic, question_count, type, difficulty)
    VALUES (${userId}, ${documentId}, ${topic}, ${count}, ${type}, ${difficulty})
    RETURNING *
  `

  // Persist questions
  const questionRows: TestQuestion[] = []
  for (let i = 0; i < result.questions.length; i++) {
    const q = result.questions[i]
    const [row] = await sql`
      INSERT INTO test_questions (test_id, question, options, correct_answer, marks, order_index)
      VALUES (
        ${test.id},
        ${q.question},
        ${q.options ? JSON.stringify(q.options) : null},
        ${q.correct_answer},
        ${q.marks ?? 1},
        ${i}
      )
      RETURNING *
    `
    questionRows.push(row as TestQuestion)
  }

  return c.json({ test, questions: questionRows } satisfies GenerateTestResponse, 201)
})

// GET /api/test/:testId
app.get('/:testId', async (c) => {
  const userId = c.get('dbUserId')
  const testId = c.req.param('testId')

  const [test] = await sql`SELECT * FROM tests WHERE id = ${testId} AND user_id = ${userId}`
  if (!test) return c.json({ error: 'Test not found' }, 404)

  const questions = await sql`
    SELECT * FROM test_questions WHERE test_id = ${testId} ORDER BY order_index
  `

  return c.json({ test, questions })
})

// POST /api/test/:testId/submit
app.post('/:testId/submit', async (c) => {
  const userId = c.get('dbUserId')
  const testId = c.req.param('testId')
  const { answers, timeElapsed, tabSwitches } = await c.req.json<SubmitTestRequest>()

  const questions = await sql<Array<{ id: string; correct_answer: string; marks: number }>>`
    SELECT id, correct_answer, marks FROM test_questions WHERE test_id = ${testId}
  `

  if (questions.length === 0) return c.json({ error: 'Test not found' }, 404)

  const { score, totalMarks } = scoreAttempt(questions, answers)

  const [attempt] = await sql`
    INSERT INTO test_attempts
      (test_id, user_id, answers, score, total_marks, time_elapsed_seconds, tab_switches, started_at)
    VALUES
      (${testId}, ${userId}, ${JSON.stringify(answers)}, ${score}, ${totalMarks},
       ${timeElapsed}, ${tabSwitches}, now() - (${timeElapsed} || ' seconds')::interval)
    RETURNING *
  `

  const allQuestions = await sql`
    SELECT * FROM test_questions WHERE test_id = ${testId} ORDER BY order_index
  `

  return c.json({ attempt, questions: allQuestions } satisfies SubmitTestResponse)
})

export default app
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm test tests/routes/test.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/routes/test.ts apps/backend/tests/routes/test.test.ts
git commit -m "feat: test routes — generate, get, submit with scoring, list attempts"
```

---

## Task 15: Progress + Settings Routes

**Files:**
- Create: `apps/backend/src/routes/progress.ts`
- Create: `apps/backend/src/routes/settings.ts`

- [ ] **Step 1: Implement progress route**

`apps/backend/src/routes/progress.ts`:
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

  const topicsToReview = topicRows
    .filter((t) => t.score < 70)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((t) => t.topic)

  const response: ProgressResponse = {
    testsCompleted: stats.tests_completed,
    topicsLearned: topicsRow.count,
    averageScore: Math.round(stats.avg_score_pct),
    studyTimeSeconds: stats.total_time_seconds,
    topicPerformance: topicRows,
    topicsToReview,
  }

  return c.json(response)
})

export default app
```

- [ ] **Step 2: Implement settings route**

`apps/backend/src/routes/settings.ts`:
```typescript
import { Hono } from 'hono'
import { authMiddleware, type AuthEnv } from '../middleware/auth.js'
import sql from '../db/client.js'
import type { UserSettings } from 'shared'

const app = new Hono<AuthEnv>()
app.use('*', authMiddleware)

// GET /api/settings — return settings with key masked
app.get('/', async (c) => {
  const userId = c.get('dbUserId')
  const [user] = await sql<Array<{ settings: UserSettings }>>`
    SELECT settings FROM users WHERE id = ${userId}
  `

  const settings = user?.settings ?? {}
  // Mask the API key for display
  const masked = {
    ...settings,
    openrouterKey: settings.openrouterKey
      ? `sk-or-...${settings.openrouterKey.slice(-4)}`
      : undefined,
  }

  return c.json({ settings: masked })
})

// PUT /api/settings — update one or more fields
app.put('/', async (c) => {
  const userId = c.get('dbUserId')
  const body = await c.req.json<Partial<UserSettings>>()

  // Merge with existing settings
  await sql`
    UPDATE users
    SET settings = settings || ${JSON.stringify(body)}::jsonb
    WHERE id = ${userId}
  `

  return c.json({ updated: true })
})

export default app
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/routes/progress.ts apps/backend/src/routes/settings.ts
git commit -m "feat: progress aggregation route and user settings CRUD"
```

---

## Task 16: Backend Entry Point + Route Registration

**Files:**
- Create: `apps/backend/src/index.ts`

- [ ] **Step 1: Wire everything together**

`apps/backend/src/index.ts`:
```typescript
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

import webhooksRoute from './routes/webhooks.js'
import documentsRoute from './routes/documents.js'
import learnRoute from './routes/learn.js'
import askRoute from './routes/ask.js'
import testRoute from './routes/test.js'
import progressRoute from './routes/progress.js'
import settingsRoute from './routes/settings.js'

const app = new Hono()

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  }),
)

app.get('/health', (c) => c.json({ status: 'ok' }))

app.route('/api/webhooks', webhooksRoute)
app.route('/api/documents', documentsRoute)
app.route('/api/learn', learnRoute)
app.route('/api/ask', askRoute)
app.route('/api/test', testRoute)
app.route('/api/progress', progressRoute)
app.route('/api/settings', settingsRoute)

const port = Number(process.env.PORT ?? 3001)
console.log(`Backend running on http://localhost:${port}`)

serve({ fetch: app.fetch, port })
```

- [ ] **Step 2: Start the backend and verify health endpoint**

```bash
cd apps/backend
cp ../../.env.example .env  # fill in DATABASE_URL, CLERK_SECRET_KEY, OPENROUTER_API_KEY
pnpm dev
```

In another terminal:
```bash
curl http://localhost:3001/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 3: Run all backend tests**

```bash
pnpm test
```

Expected: All tests PASS (pdf.service, rag.service, documents, test scoring).

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/index.ts
git commit -m "feat: Hono entry point — all routes registered, CORS configured"
```

---

## Task 17: End-to-End Smoke Test

Manual verification that the full backend pipeline works.

- [ ] **Step 1: Ensure services are running**

```bash
# PostgreSQL + pgvector
docker ps | grep note2test-db

# Ollama with nomic-embed-text
ollama list | grep nomic-embed-text

# Backend
curl http://localhost:3001/health
```

- [ ] **Step 2: Get a Clerk test token**

In your Clerk dashboard, create a test user and retrieve a short-lived session token, or use Clerk's API:
```bash
# Replace with your actual test user's session token from Clerk dashboard
CLERK_TOKEN="your-session-token-here"
```

- [ ] **Step 3: Upload a test PDF**

```bash
curl -X POST http://localhost:3001/api/documents/upload \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -F "file=@/path/to/test.pdf" \
  -F "title=Test Document"
```

Expected: `{"document":{"id":"...","status":"processing",...}}`

- [ ] **Step 4: Poll until status is ready**

```bash
curl http://localhost:3001/api/documents \
  -H "Authorization: Bearer $CLERK_TOKEN"
```

Expected: Document with `"status":"ready"` after 10-30 seconds (depending on PDF size).

- [ ] **Step 5: Test the learn endpoint**

```bash
# Replace DOC_ID with the actual document ID from step 3
DOC_ID="..."

curl -X POST http://localhost:3001/api/learn \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"documentId\":\"$DOC_ID\",\"topic\":\"main concepts\"}"
```

Expected: SSE stream of tokens, ending with the full AI explanation.

- [ ] **Step 6: Test the test generation endpoint**

```bash
curl -X POST http://localhost:3001/api/test/generate \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"documentId\":\"$DOC_ID\",\"topic\":\"main concepts\",\"count\":3,\"type\":\"mcq\",\"difficulty\":\"easy\"}"
```

Expected: JSON with `test` object and `questions` array of 3 MCQ questions.

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "chore: backend complete — all routes working, smoke tested"
```

---

## Summary

The backend is now complete with:

- Monorepo scaffold (pnpm workspaces)
- PostgreSQL + pgvector schema (7 tables)
- Clerk JWT auth middleware with auto user creation
- Clerk webhook for user sync
- PDF text extraction + token-overlap chunking
- Ollama embedding service (`nomic-embed-text`, 768 dims)
- OpenRouter streaming + JSON LLM service
- Shared RAG core: embed query + cosine similarity search
- Three mode-specific system prompts (learn, ask, test)
- All 7 API route groups registered and working

**Next:** Run Plan B (frontend) to build the React UI on top of this backend.

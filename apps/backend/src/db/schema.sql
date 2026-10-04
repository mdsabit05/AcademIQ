CREATE EXTENSION IF NOT EXISTS vector;

-- ─────────────────────────────────────────────────────────
-- USERS
-- No password_hash — authentication is fully Clerk-managed.
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id       TEXT UNIQUE NOT NULL,
  email          TEXT NOT NULL,
  name           TEXT,
  role           TEXT NOT NULL DEFAULT 'student'
                   CHECK (role IN ('student','teacher','admin')),
  institution    TEXT,
  course         TEXT,
  semester       TEXT,
  status         TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','suspended')),
  learning_prefs JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────
-- SUBJECTS  (teacher-managed academic contexts)
-- Teacher creates: owner_id = teacher's own user id
-- Admin creates:   owner_id = explicitly specified or admin's own id
-- Admin can manage any subject by role bypass in RBAC
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subjects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  semester    TEXT,
  description TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────
-- BOOKS  (canonical domain — no "documents" table)
-- PDF binaries stored in object storage, not in PostgreSQL.
-- file_path = storage key: {ownerId}/{bookId}/original.pdf
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS books (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id  UUID REFERENCES subjects(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  author      TEXT,
  filename    TEXT NOT NULL,
  file_path   TEXT NOT NULL,
  file_size   BIGINT,
  page_count  INT,
  status      TEXT NOT NULL DEFAULT 'UPLOADING'
                CHECK (status IN (
                  'UPLOADING','UPLOADED','EXTRACTING','OCR',
                  'CHUNKING','EMBEDDING','INDEXING','READY','FAILED')),
  ocr_applied BOOLEAN NOT NULL DEFAULT false,
  error_msg   TEXT,
  context     TEXT NOT NULL DEFAULT 'student'
                CHECK (context IN ('student','teacher')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotent: add context column if it doesn't exist yet (for existing DBs)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'books' AND column_name = 'context'
  ) THEN
    ALTER TABLE books
      ADD COLUMN context TEXT NOT NULL DEFAULT 'student'
      CHECK (context IN ('student','teacher'));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────
-- CHUNKS  (RAG vectors — 4096 dimensions, nvidia/nemotron-3-embed-1b)
-- To revert to OpenRouter (1536 dims): change vector(4096) → vector(1536)
--   and run: ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(1536)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id     UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  embedding   vector(4096),
  chunk_index INT NOT NULL,
  page_number INT,
  chapter     TEXT,
  topic_hint  TEXT,
  has_ocr     BOOLEAN NOT NULL DEFAULT false,
  token_count INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS chunks_embedding_idx
  ON chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS chunks_book_id_idx ON chunks(book_id);

-- ─────────────────────────────────────────────────────────
-- SYLLABUS
-- Ownership enforced on all routes via requireOwnership('syllabi','id')
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS syllabi (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  title      TEXT NOT NULL,
  file_path  TEXT,
  status     TEXT NOT NULL DEFAULT 'processing'
               CHECK (status IN ('processing','ready','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS syllabus_topics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  syllabus_id UUID NOT NULL REFERENCES syllabi(id) ON DELETE CASCADE,
  unit        TEXT,
  topic       TEXT NOT NULL,
  subtopic    TEXT,
  parent_id   UUID REFERENCES syllabus_topics(id),
  order_index INT NOT NULL DEFAULT 0,
  completed   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────
-- STUDY PLAN (exams, daily tasks, subject goals)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_exams (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  subject    TEXT,
  exam_date  DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_tasks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  subject    TEXT,
  completed  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_goals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject     TEXT NOT NULL,
  description TEXT NOT NULL,
  due_date    DATE,
  progress    INT NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────
-- CHAT SESSIONS  (multi-book conversations)
-- Ownership on chat_messages derived through chat_sessions.owner_id
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode       TEXT NOT NULL CHECK (mode IN ('learn','ask','general')),
  topic      TEXT,
  title      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- idempotent migration for existing deployments
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS title TEXT;

-- Junction: which books are in scope for this session
CREATE TABLE IF NOT EXISTS chat_session_books (
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  book_id    UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, book_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content    TEXT NOT NULL,
  metadata   JSONB NOT NULL DEFAULT '{}',
  -- metadata: { citations: [{chunkId, bookTitle, page}], model, tokens }
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_session_idx ON chat_messages(session_id);

-- ─────────────────────────────────────────────────────────
-- TESTS
-- topic is nullable — actual scope in config JSONB
-- test_books junction enforces book FK with proper cascade
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id       UUID REFERENCES subjects(id) ON DELETE SET NULL,
  topic            TEXT,
  duration_minutes INT,
  total_marks      INT NOT NULL,
  question_count   INT NOT NULL,
  type             TEXT NOT NULL
                     CHECK (type IN ('mcq','one_mark','two_mark','five_mark','mixed')),
  difficulty       TEXT NOT NULL
                     CHECK (difficulty IN ('easy','medium','hard')),
  config           JSONB NOT NULL DEFAULT '{}',
  -- config: {
  --   marksPerQuestion?: number,
  --   topics?: string[],
  --   sections?: [{ type, count, marksEach, topics, difficulty }]
  -- }
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Junction: books used in a test (replaces UUID[] — proper FK enforcement)
CREATE TABLE IF NOT EXISTS test_books (
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  PRIMARY KEY (test_id, book_id)
);

CREATE TABLE IF NOT EXISTS test_questions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id        UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  question       TEXT NOT NULL,
  question_type  TEXT NOT NULL
                   CHECK (question_type IN ('mcq','one_mark','two_mark','five_mark')),
  options        JSONB,
  correct_answer TEXT NOT NULL,
  marks          INT NOT NULL DEFAULT 1,
  topic          TEXT,
  difficulty     TEXT,
  source_chunks  UUID[],
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
  submitted_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-question result rows — required for MAG/mastery analysis
CREATE TABLE IF NOT EXISTS test_attempt_answers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id    UUID NOT NULL REFERENCES test_attempts(id) ON DELETE CASCADE,
  question_id   UUID NOT NULL REFERENCES test_questions(id) ON DELETE CASCADE,
  answer        TEXT NOT NULL,
  is_correct    BOOLEAN NOT NULL,
  marks_awarded INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);

-- ─────────────────────────────────────────────────────────
-- STUDENT MEMORY  (MAG)
-- user_id covers both students and teachers using learner workflow
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_memory (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL
                CHECK (memory_type IN (
                  'topic_mastery','weak_topic','strong_topic',
                  'common_mistake','study_history',
                  'revision_priority','syllabus_coverage')),
  context_key TEXT NOT NULL,
  value       JSONB NOT NULL,
  confidence  FLOAT NOT NULL DEFAULT 0.5 CHECK (confidence BETWEEN 0 AND 1),
  source      TEXT CHECK (source IN ('test','learn','ask','manual')),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, memory_type, context_key)
);

-- ─────────────────────────────────────────────────────────
-- TEACHER: BLUEPRINTS & PAPERS
-- teacher_id intentionally role-specific (not generic user_id)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS paper_blueprints (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  title      TEXT NOT NULL,
  config     JSONB NOT NULL,
  -- config: {
  --   duration: number, totalMarks: number,
  --   sections: [{ name, type, count, marksEach, topics, difficulty, bookIds }]
  -- }
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS question_papers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id UUID NOT NULL REFERENCES paper_blueprints(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','finalized')),
  validation   JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS paper_questions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id      UUID NOT NULL REFERENCES question_papers(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  section       TEXT,
  topic         TEXT,
  difficulty    TEXT CHECK (difficulty IN ('easy','medium','hard')),
  question_type TEXT CHECK (question_type IN ('mcq','one_mark','two_mark','five_mark')),
  options       JSONB,
  marks         INT NOT NULL,
  order_index   INT NOT NULL,
  source_chunks UUID[]
);

-- ─────────────────────────────────────────────────────────
-- STUDY SESSIONS
-- user_id covers both students and teachers using learner workflow
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS study_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id       UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  topic            TEXT,
  mode             TEXT NOT NULL CHECK (mode IN ('learn','ask','general')),
  duration_seconds INT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────
-- AI EVALUATION RECORDS
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS eval_records (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eval_type  TEXT NOT NULL,
  input      JSONB NOT NULL,
  output     JSONB NOT NULL,
  scores     JSONB NOT NULL,
  model      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

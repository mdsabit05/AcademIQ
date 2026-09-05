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

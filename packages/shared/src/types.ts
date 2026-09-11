// ─── Core domain types ────────────────────────────────────────────────────────

export type Role = 'student' | 'teacher' | 'admin'
export type BookStatus =
  | 'UPLOADING' | 'UPLOADED' | 'EXTRACTING' | 'OCR'
  | 'CHUNKING' | 'EMBEDDING' | 'INDEXING' | 'READY' | 'FAILED'
export type TestType = 'mcq' | 'one_mark' | 'two_mark' | 'five_mark' | 'mixed'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type MessageRole = 'user' | 'assistant'
export type ChatMode = 'learn' | 'ask' | 'general'
export type MemoryType =
  | 'topic_mastery' | 'weak_topic' | 'strong_topic'
  | 'common_mistake' | 'study_history' | 'revision_priority' | 'syllabus_coverage'

// ─── Users ────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  clerk_id: string
  email: string
  name: string | null
  role: Role
  institution: string | null
  course: string | null
  semester: string | null
  status: 'active' | 'suspended'
  learning_prefs: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ─── Subjects ─────────────────────────────────────────────────────────────────

export interface Subject {
  id: string
  owner_id: string
  name: string
  semester: string | null
  description: string | null
  metadata: Record<string, unknown>
  created_at: string
}

// ─── Books ────────────────────────────────────────────────────────────────────

export interface Book {
  id: string
  owner_id: string
  subject_id: string | null
  title: string
  author: string | null
  filename: string
  file_size: number | null
  page_count: number | null
  status: BookStatus
  ocr_applied: boolean
  error_msg: string | null
  created_at: string
  updated_at: string
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatSession {
  id: string
  owner_id: string
  mode: ChatMode
  topic: string | null
  book_ids: string[]
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  session_id: string
  role: MessageRole
  content: string
  metadata: {
    citations?: Citation[]
    model?: string
    guardrailFlags?: string[]
  }
  created_at: string
}

export interface Citation {
  chunkId: string
  bookTitle: string
  pageNumber: number | null
  snippet: string
}

// ─── Tests ────────────────────────────────────────────────────────────────────

export interface Test {
  id: string
  owner_id: string
  subject_id: string | null
  topic: string | null
  duration_minutes: number | null
  total_marks: number
  question_count: number
  type: TestType
  difficulty: Difficulty
  config: Record<string, unknown>
  created_at: string
}

export interface TestQuestion {
  id: string
  test_id: string
  question: string
  question_type: TestType
  options: Record<string, string> | null
  marks: number
  topic: string | null
  difficulty: Difficulty | null
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

export interface TestAttemptAnswer {
  id: string
  attempt_id: string
  question_id: string
  answer: string
  is_correct: boolean
  marks_awarded: number
  created_at: string
}

// ─── Student Memory ───────────────────────────────────────────────────────────

export interface MemoryEntry {
  id: string
  user_id: string
  memory_type: MemoryType
  context_key: string
  value: unknown
  confidence: number
  source: 'test' | 'learn' | 'ask' | 'manual' | null
  updated_at: string
}

// ─── Teacher: Blueprints & Papers ─────────────────────────────────────────────

export interface BlueprintSection {
  name: string
  type: 'mcq' | 'one_mark' | 'two_mark' | 'five_mark'
  count: number
  marksEach: number
  topics?: string[]
  difficulty?: Difficulty
  bookIds: string[]
}

export interface BlueprintConfig {
  duration: number
  totalMarks: number
  sections: BlueprintSection[]
}

export interface PaperBlueprint {
  id: string
  teacher_id: string
  subject_id: string | null
  title: string
  config: BlueprintConfig
  created_at: string
  updated_at: string
}

export interface QuestionPaper {
  id: string
  teacher_id: string
  blueprint_id: string
  title: string
  status: 'draft' | 'finalized'
  validation: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface PaperQuestion {
  id: string
  paper_id: string
  question_text: string
  section: string | null
  topic: string | null
  difficulty: Difficulty | null
  question_type: TestType | null
  options: Record<string, string> | null
  marks: number
  order_index: number
}

// ─── Syllabus ─────────────────────────────────────────────────────────────────

export interface Syllabus {
  id: string
  owner_id: string
  subject_id: string | null
  title: string
  status: 'processing' | 'ready' | 'failed'
  created_at: string
}

export interface SyllabusTopic {
  id: string
  syllabus_id: string
  unit: string | null
  topic: string
  subtopic: string | null
  order_index: number
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface LearningPrefs {
  preferredDifficulty?: Difficulty
  studyGoalMinutesPerDay?: number
  notificationsEnabled?: boolean
  theme?: 'light' | 'dark' | 'system'
  language?: string
}

// ─── API request/response helpers ────────────────────────────────────────────

export interface ApiError {
  error: string
  details?: unknown
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  limit: number
  offset: number
}

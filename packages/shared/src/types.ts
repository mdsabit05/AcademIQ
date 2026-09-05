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

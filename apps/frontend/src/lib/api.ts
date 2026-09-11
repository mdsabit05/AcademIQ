import type {
  Book,
  ChatSession,
  ChatMessage,
  Test,
  TestQuestion,
  TestAttempt,
  TestAttemptAnswer,
  MemoryEntry,
  Subject,
  Syllabus,
  SyllabusTopic,
  PaperBlueprint,
  QuestionPaper,
  PaperQuestion,
  BlueprintConfig,
  User,
  LearningPrefs,
} from 'shared'

const BASE = '/api'

async function apiFetch<T>(
  path: string,
  token: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '' }))
    const msg = (err as { error: string }).error || res.statusText || `HTTP ${res.status}`
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

export function makeApi(token: string) {
  return {
    // ── Books ──────────────────────────────────────────────────────────────
    books: {
      list: (subjectId?: string) =>
        apiFetch<{ books: Book[] }>(
          `/books${subjectId ? `?subject_id=${subjectId}` : ''}`,
          token,
        ),

      get: (id: string) =>
        apiFetch<{ book: Book }>(`/books/${id}`, token),

      upload: (file: File, title: string, subjectId?: string, author?: string) => {
        const form = new FormData()
        form.append('file', file)
        form.append('title', title)
        if (subjectId) form.append('subject_id', subjectId)
        if (author) form.append('author', author)
        return fetch(`${BASE}/books`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        }).then(async (r) => {
          const data = await r.json()
          if (!r.ok) throw new Error((data as { error: string }).error ?? r.statusText)
          return data as { book: Book }
        })
      },

      update: (id: string, body: { title?: string; subject_id?: string | null; author?: string }) =>
        apiFetch<{ book: Book }>(`/books/${id}`, token, {
          method: 'PATCH',
          body: JSON.stringify(body),
        }),

      delete: (id: string) =>
        apiFetch<{ success: boolean }>(`/books/${id}`, token, { method: 'DELETE' }),
    },

    // ── Sessions ───────────────────────────────────────────────────────────
    sessions: {
      create: (body: { mode: 'learn' | 'ask' | 'general'; bookIds: string[]; topic?: string }) =>
        apiFetch<{ session: ChatSession }>('/sessions', token, {
          method: 'POST',
          body: JSON.stringify(body),
        }),

      list: (mode?: string) =>
        apiFetch<{ sessions: ChatSession[] }>(
          `/sessions${mode ? `?mode=${mode}` : ''}`,
          token,
        ),

      get: (id: string) =>
        apiFetch<{ session: ChatSession; messages: ChatMessage[] }>(`/sessions/${id}`, token),

      delete: (id: string) =>
        apiFetch<{ success: boolean }>(`/sessions/${id}`, token, { method: 'DELETE' }),
    },

    // ── Chat ───────────────────────────────────────────────────────────────
    chat: {
      /**
       * Send a message to a session.
       * Returns an EventSource-compatible URL for SSE streaming.
       * Callers handle the stream via useSSE or fetch directly.
       */
      sendMessage: (sessionId: string, content: string) =>
        `${BASE}/chat/${sessionId}/message?token=${encodeURIComponent(token)}&content=${encodeURIComponent(content)}`,

      /**
       * Post message and receive SSE stream response.
       * Returns the raw Response for SSE parsing.
       */
      postMessage: (sessionId: string, content: string) =>
        fetch(`${BASE}/chat/${sessionId}/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content }),
        }),
    },

    // ── Tests ──────────────────────────────────────────────────────────────
    tests: {
      generate: (body: {
        bookIds: string[]
        subjectId?: string
        topic?: string
        questionCount: number
        type: 'mcq' | 'one_mark' | 'two_mark' | 'five_mark' | 'mixed'
        difficulty: 'easy' | 'medium' | 'hard'
        durationMinutes?: number
        marksPerQuestion?: number
      }) =>
        apiFetch<{ test: Test; questions: TestQuestion[] }>('/tests', token, {
          method: 'POST',
          body: JSON.stringify(body),
        }),

      list: () =>
        apiFetch<{ tests: Test[] }>('/tests', token),

      get: (id: string) =>
        apiFetch<{ test: Test; questions: TestQuestion[] }>(`/tests/${id}`, token),

      submitAttempt: (
        testId: string,
        body: {
          answers: Record<string, string>
          timeElapsedSeconds?: number
          tabSwitches?: number
          startedAt?: string
        },
      ) =>
        apiFetch<{
          attemptId: string
          score: number
          totalMarks: number
          results: Array<{
            questionId: string
            answer: string
            isCorrect: boolean
            marksAwarded: number
            maxMarks: number
          }>
        }>(`/tests/${testId}/attempt`, token, {
          method: 'POST',
          body: JSON.stringify(body),
        }),

      listAttempts: (testId: string) =>
        apiFetch<{ attempts: TestAttempt[] }>(`/tests/${testId}/attempts`, token),

      getAttempt: (testId: string, attemptId: string) =>
        apiFetch<{
          attempt: TestAttempt
          answers: (TestAttemptAnswer & {
            question: string
            question_type: string
            correct_answer: string
            marks: number
          })[]
        }>(`/tests/${testId}/attempts/${attemptId}`, token),
    },

    // ── Progress ───────────────────────────────────────────────────────────
    progress: {
      summary: () =>
        apiFetch<{
          summary: { testsTaken: number; avgScorePct: number | null; totalStudyMinutes: number }
          topicMastery: Array<{ context_key: string; value: unknown; confidence: number }>
          weakTopics: Array<{ context_key: string; value: unknown; confidence: number }>
        }>('/progress/summary', token),

      history: (limit = 20, offset = 0) =>
        apiFetch<{ attempts: unknown[]; sessions: unknown[] }>(
          `/progress/history?limit=${limit}&offset=${offset}`,
          token,
        ),
    },

    // ── Memory ─────────────────────────────────────────────────────────────
    memory: {
      list: (type?: string) =>
        apiFetch<{ memory: MemoryEntry[] }>(
          `/memory${type ? `?type=${type}` : ''}`,
          token,
        ),

      delete: (id: string) =>
        apiFetch<{ success: boolean }>(`/memory/${id}`, token, { method: 'DELETE' }),

      clear: () =>
        apiFetch<{ success: boolean }>('/memory?confirm=true', token, { method: 'DELETE' }),
    },

    // ── Settings ───────────────────────────────────────────────────────────
    settings: {
      get: () =>
        apiFetch<{ user: User }>('/settings', token),

      update: (body: {
        name?: string
        institution?: string
        course?: string
        semester?: string
        learning_prefs?: Partial<LearningPrefs>
      }) =>
        apiFetch<{ user: User }>('/settings', token, {
          method: 'PATCH',
          body: JSON.stringify(body),
        }),
    },

    // ── Subjects ───────────────────────────────────────────────────────────
    subjects: {
      list: () =>
        apiFetch<{ subjects: Subject[] }>('/subjects', token),

      get: (id: string) =>
        apiFetch<{ subject: Subject }>(`/subjects/${id}`, token),

      create: (body: { name: string; semester?: string; description?: string }) =>
        apiFetch<{ subject: Subject }>('/subjects', token, {
          method: 'POST',
          body: JSON.stringify(body),
        }),

      update: (id: string, body: { name?: string; semester?: string; description?: string }) =>
        apiFetch<{ subject: Subject }>(`/subjects/${id}`, token, {
          method: 'PATCH',
          body: JSON.stringify(body),
        }),

      delete: (id: string) =>
        apiFetch<{ success: boolean }>(`/subjects/${id}`, token, { method: 'DELETE' }),
    },

    // ── Syllabus ───────────────────────────────────────────────────────────
    syllabus: {
      list: () =>
        apiFetch<{ syllabi: Syllabus[] }>('/syllabus', token),

      get: (id: string) =>
        apiFetch<{ syllabus: Syllabus; topics: SyllabusTopic[] }>(`/syllabus/${id}`, token),

      upload: (file: File, title: string, subjectId?: string) => {
        const form = new FormData()
        form.append('file', file)
        form.append('title', title)
        if (subjectId) form.append('subject_id', subjectId)
        return fetch(`${BASE}/syllabus`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        }).then(async (r) => {
          const data = await r.json()
          if (!r.ok) throw new Error((data as { error: string }).error ?? r.statusText)
          return data as { syllabus: Syllabus }
        })
      },

      delete: (id: string) =>
        apiFetch<{ success: boolean }>(`/syllabus/${id}`, token, { method: 'DELETE' }),
    },

    // ── Papers (teacher) ───────────────────────────────────────────────────
    papers: {
      blueprints: {
        list: () =>
          apiFetch<{ blueprints: PaperBlueprint[] }>('/papers/blueprints', token),

        get: (id: string) =>
          apiFetch<{ blueprint: PaperBlueprint }>(`/papers/blueprints/${id}`, token),

        create: (body: { title: string; subjectId?: string; config: BlueprintConfig }) =>
          apiFetch<{ blueprint: PaperBlueprint }>('/papers/blueprints', token, {
            method: 'POST',
            body: JSON.stringify(body),
          }),

        update: (id: string, body: { title?: string; config?: BlueprintConfig }) =>
          apiFetch<{ blueprint: PaperBlueprint }>(`/papers/blueprints/${id}`, token, {
            method: 'PATCH',
            body: JSON.stringify(body),
          }),

        delete: (id: string) =>
          apiFetch<{ success: boolean }>(`/papers/blueprints/${id}`, token, { method: 'DELETE' }),

        generate: (id: string, title?: string) =>
          apiFetch<{
            paper: QuestionPaper
            questions: PaperQuestion[]
            validation: unknown
          }>(`/papers/blueprints/${id}/generate`, token, {
            method: 'POST',
            body: JSON.stringify({ title }),
          }),
      },

      list: () =>
        apiFetch<{ papers: QuestionPaper[] }>('/papers', token),

      get: (id: string) =>
        apiFetch<{ paper: QuestionPaper; questions: PaperQuestion[] }>(`/papers/${id}`, token),

      finalize: (id: string) =>
        apiFetch<{ paper: QuestionPaper }>(`/papers/${id}/finalize`, token, { method: 'PATCH' }),

      delete: (id: string) =>
        apiFetch<{ success: boolean }>(`/papers/${id}`, token, { method: 'DELETE' }),
    },

    // ── Agent ──────────────────────────────────────────────────────────────
    /**
     * Send a message to the Agentic AI.
     * Returns a raw Response for SSE streaming (same pattern as chat.postMessage).
     *
     * SSE events:
     *   data: <text token>       — streamed response text
     *   event: agent-done        — JSON metadata { toolsUsed, iterations }
     *   event: done   data: [DONE]
     *   event: error  data: <message>
     */
    agent: {
      message: (content: string, opts?: { bookIds?: string[] }) =>
        fetch(`${BASE}/agent/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content, ...opts }),
        }),
    },

    // ── Admin ──────────────────────────────────────────────────────────────
    admin: {
      users: (limit = 50, offset = 0, search?: string) =>
        apiFetch<{ users: User[]; total: number }>(
          `/admin/users?limit=${limit}&offset=${offset}${search ? `&search=${encodeURIComponent(search)}` : ''}`,
          token,
        ),

      getUser: (id: string) =>
        apiFetch<{ user: User }>(`/admin/users/${id}`, token),

      setRole: (id: string, role: string) =>
        apiFetch<{ user: User }>(`/admin/users/${id}/role`, token, {
          method: 'PATCH',
          body: JSON.stringify({ role }),
        }),

      setStatus: (id: string, status: string) =>
        apiFetch<{ user: User }>(`/admin/users/${id}/status`, token, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        }),

      stats: () =>
        apiFetch<{
          users: { total_users: number; total_students: number; total_teachers: number; total_admins: number }
          content: { total_books: number; total_tests: number; total_attempts: number; total_papers: number }
        }>('/admin/stats', token),
    },
  }
}

export type Api = ReturnType<typeof makeApi>

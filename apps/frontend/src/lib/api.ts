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
  PlanExam,
  PlanTask,
  PlanGoal,
} from 'shared'

// In production use VITE_API_URL (Render backend), otherwise use relative /api
const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

async function apiFetch<T>(
  path: string,
  token: string,
  options?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token && token !== 'null' && token !== 'undefined' ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers as Record<string, string> | undefined),
  }
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
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
      list: (subjectId?: string, context?: 'student' | 'teacher') => {
        const params = new URLSearchParams()
        if (subjectId) params.set('subject_id', subjectId)
        if (context) params.set('context', context)
        const qs = params.toString()
        return apiFetch<{ books: Book[] }>(`/books${qs ? `?${qs}` : ''}`, token)
      },

      get: (id: string) =>
        apiFetch<{ book: Book }>(`/books/${id}`, token),

      upload: (file: File, title: string, subjectId?: string, author?: string, context?: 'student' | 'teacher') => {
        const form = new FormData()
        // Fields MUST come before the file — busboy parses them in order and the
        // INSERT fires inside the file handler, so any field appended after the
        // file would arrive too late and be ignored (context would default to 'student').
        form.append('title', title)
        if (subjectId) form.append('subject_id', subjectId)
        if (author) form.append('author', author)
        if (context) form.append('context', context)
        form.append('file', file)
        return fetch(`${BASE}/books`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        }).then(async (r) => {
          if (!r.ok) {
            const err = await r.json().catch(() => ({ error: r.statusText }))
            throw new Error((err as { error: string }).error ?? r.statusText)
          }
          return r.json() as Promise<{ book: Book }>
        })
      },

      update: (id: string, body: { title?: string; subject_id?: string | null; author?: string }) =>
        apiFetch<{ book: Book }>(`/books/${id}`, token, {
          method: 'PATCH',
          body: JSON.stringify(body),
        }),

      delete: (id: string) =>
        apiFetch<{ success: boolean }>(`/books/${id}`, token, { method: 'DELETE' }),

      openFile: async (id: string) => {
        // Open the window synchronously (before any await) to avoid popup blockers
        const win = window.open('about:blank', '_blank')
        try {
          const res = await fetch(`${BASE}/books/${id}/file`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (!res.ok) throw new Error('Failed to load file')
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          if (win) win.location.href = url
          else window.open(url, '_blank')
        } catch (err) {
          win?.close()
          throw err
        }
      },
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

      update: (id: string, body: { title: string }) =>
        apiFetch<{ session: ChatSession }>(`/sessions/${id}`, token, {
          method: 'PATCH',
          body: JSON.stringify(body),
        }),

      delete: (id: string) =>
        apiFetch<{ success: boolean }>(`/sessions/${id}`, token, { method: 'DELETE' }),
    },

    // ── Chat ───────────────────────────────────────────────────────────────
    chat: {
      /**
       * Post a message and receive an SSE stream response.
       * Token is sent in the Authorization header — never in the URL —
       * to prevent it appearing in server logs, CDN logs, or Referer headers.
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

      create: (body: {
        title: string
        subjectId?: string | null
        topics?: Array<{
          unit?: string | null
          topic: string
          subtopic?: string | null
          orderIndex?: number
        }>
      }) =>
        apiFetch<{ syllabus: Syllabus; topics: SyllabusTopic[] }>('/syllabus/create', token, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),

      upload: (file: File, title: string, subjectId?: string) => {
        const form = new FormData()
        form.append('title', title)
        if (subjectId) form.append('subject_id', subjectId)
        form.append('file', file)
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

      updateTopic: (syllabusId: string, topicId: string, completed: boolean) =>
        apiFetch<{ topic: { id: string; completed: boolean } }>(
          `/syllabus/${syllabusId}/topics/${topicId}`,
          token,
          { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed }) },
        ),
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

      deleteUser: (id: string) =>
        apiFetch<{ success: boolean }>(`/admin/users/${id}`, token, { method: 'DELETE' }),

      stats: () =>
        apiFetch<{
          users: { total_users: number; total_students: number; total_teachers: number; total_admins: number }
          content: { total_books: number; total_tests: number; total_attempts: number; total_papers: number }
        }>('/admin/stats', token),
    },

    // ── Study Plan ────────────────────────────────────────────────────────────
    studyplan: {
      // Exams
      listExams: () =>
        apiFetch<{ exams: PlanExam[] }>('/studyplan/exams', token),
      addExam: (body: { name: string; subject?: string; exam_date: string }) =>
        apiFetch<{ exam: PlanExam }>('/studyplan/exams', token, { method: 'POST', body: JSON.stringify(body) }),
      deleteExam: (id: string) =>
        apiFetch<{ success: boolean }>(`/studyplan/exams/${id}`, token, { method: 'DELETE' }),

      // Tasks
      listTasks: () =>
        apiFetch<{ tasks: PlanTask[] }>('/studyplan/tasks', token),
      addTask: (body: { text: string; subject?: string }) =>
        apiFetch<{ task: PlanTask }>('/studyplan/tasks', token, { method: 'POST', body: JSON.stringify(body) }),
      toggleTask: (id: string, completed: boolean) =>
        apiFetch<{ task: PlanTask }>(`/studyplan/tasks/${id}`, token, { method: 'PATCH', body: JSON.stringify({ completed }) }),
      deleteTask: (id: string) =>
        apiFetch<{ success: boolean }>(`/studyplan/tasks/${id}`, token, { method: 'DELETE' }),

      // Goals
      listGoals: () =>
        apiFetch<{ goals: PlanGoal[] }>('/studyplan/goals', token),
      addGoal: (body: { subject: string; description: string; due_date?: string; progress?: number }) =>
        apiFetch<{ goal: PlanGoal }>('/studyplan/goals', token, { method: 'POST', body: JSON.stringify(body) }),
      updateGoalProgress: (id: string, progress: number) =>
        apiFetch<{ goal: PlanGoal }>(`/studyplan/goals/${id}`, token, { method: 'PATCH', body: JSON.stringify({ progress }) }),
      deleteGoal: (id: string) =>
        apiFetch<{ success: boolean }>(`/studyplan/goals/${id}`, token, { method: 'DELETE' }),
    },
  }
}

export type Api = ReturnType<typeof makeApi>

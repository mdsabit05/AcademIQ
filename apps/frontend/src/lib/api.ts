import type {
  Document,
  GenerateTestRequest,
  GenerateTestResponse,
  ProgressResponse,
  SubmitTestRequest,
  SubmitTestResponse,
  UserSettings,
  ChatMessage,
  Test,
  TestQuestion,
  TestAttempt,
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
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error: string }).error ?? res.statusText)
  }
  return res.json() as Promise<T>
}

export function makeApi(token: string) {
  return {
    documents: {
      list: () =>
        apiFetch<{ documents: Document[] }>('/documents', token),

      upload: (file: File, title: string) => {
        const form = new FormData()
        form.append('file', file)
        form.append('title', title)
        return fetch(`${BASE}/documents/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        }).then(async (r) => {
          const data = await r.json()
          if (!r.ok) throw new Error(data.error ?? r.statusText)
          return data as { document: Document }
        })
      },

      delete: (id: string) =>
        apiFetch<{ deleted: boolean }>(`/documents/${id}`, token, { method: 'DELETE' }),
    },

    test: {
      generate: (body: GenerateTestRequest) =>
        apiFetch<GenerateTestResponse>('/test/generate', token, {
          method: 'POST',
          body: JSON.stringify(body),
        }),

      get: (testId: string) =>
        apiFetch<{ test: Test; questions: TestQuestion[] }>(`/test/${testId}`, token),

      submit: (testId: string, body: SubmitTestRequest) =>
        apiFetch<SubmitTestResponse>(`/test/${testId}/submit`, token, {
          method: 'POST',
          body: JSON.stringify(body),
        }),

      attempts: () =>
        apiFetch<{ attempts: (TestAttempt & { topic: string; document_id: string; document_title: string })[] }>(
          '/test/attempts',
          token,
        ),
    },

    ask: {
      history: (documentId: string) =>
        apiFetch<{ messages: ChatMessage[] }>(`/ask/${documentId}/history`, token),
    },

    progress: {
      get: () => apiFetch<ProgressResponse>('/progress', token),
    },

    settings: {
      get: () => apiFetch<{ settings: Partial<UserSettings> }>('/settings', token),
      update: (body: Partial<UserSettings>) =>
        apiFetch<{ updated: boolean }>('/settings', token, {
          method: 'PUT',
          body: JSON.stringify(body),
        }),
    },
  }
}

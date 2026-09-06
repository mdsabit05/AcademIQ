import { useState, useEffect, useRef } from 'react'
import type { TestQuestion, TestAttempt } from 'shared'

async function streamExplanation(
  documentId: string,
  question: TestQuestion,
  userAnswer: string,
  token: string,
  onToken: (t: string) => void,
): Promise<void> {
  const message =
    `Explain why "${question.correct_answer}" is correct for: "${question.question}". ` +
    `The user answered "${userAnswer}".`

  const res = await fetch('/api/ask', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ documentId, message, history: [] }),
  })

  if (!res.ok || !res.body) return

  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    for (const line of chunk.split('\n').filter((l) => l.startsWith('data: '))) {
      try {
        const t: string = JSON.parse(line.slice(6)).token ?? ''
        if (t) onToken(t)
      } catch {
        // skip malformed SSE lines
      }
    }
  }
}

export function useExplanations(
  questions: TestQuestion[],
  attempt: TestAttempt | null,
  documentId: string,
  token: string,
): { explanations: Record<string, string> } {
  const [explanations, setExplanations] = useState<Record<string, string>>({})
  const started = useRef(false)

  useEffect(() => {
    if (!attempt || !documentId || !token || questions.length === 0 || started.current) return
    started.current = true

    const wrongQuestions = questions.filter((q) => {
      const userAnswer = (attempt.answers as Record<string, string>)[q.id] ?? ''
      return userAnswer.trim().toLowerCase() !== q.correct_answer.trim().toLowerCase()
    })

    for (const q of wrongQuestions) {
      const userAnswer = (attempt.answers as Record<string, string>)[q.id] ?? ''
      streamExplanation(documentId, q, userAnswer, token, (t) => {
        setExplanations((prev) => ({ ...prev, [q.id]: (prev[q.id] ?? '') + t }))
      })
    }
  }, [questions, attempt, documentId, token])

  return { explanations }
}

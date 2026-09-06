import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { AlertTriangle, Clock } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import type { Test, TestQuestion } from 'shared'

export default function TestTake() {
  const { testId } = useParams<{ testId: string }>()
  const { getToken } = useAuth()
  const navigate = useNavigate()

  const [test, setTest] = useState<Test | null>(null)
  const [questions, setQuestions] = useState<TestQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentQ, setCurrentQ] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [tabSwitches, setTabSwitches] = useState(0)
  const [tabWarning, setTabWarning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const startTime = useRef(Date.now())

  // Load test
  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token || !testId) return
      const res = await makeApi(token).test.get(testId)
      setTest(res.test)
      setQuestions(res.questions)
    }
    load()
  }, [testId, getToken])

  // Elapsed timer
  useEffect(() => {
    const id = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime.current) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // Tab-switch detection
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) {
        setTabSwitches((n) => n + 1)
        setTabWarning(true)
        setTimeout(() => setTabWarning(false), 3000)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  const formatTime = useCallback((s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }, [])

  async function submit() {
    if (!testId) return
    setSubmitting(true)
    try {
      const token = await getToken()
      if (!token) return
      await makeApi(token).test.submit(testId, {
        answers,
        timeElapsed: elapsedSeconds,
        tabSwitches,
      })
      navigate(`/test/${testId}/results`)
    } catch {
      alert('Failed to submit. Please try again.')
      setSubmitting(false)
    }
  }

  if (!test || questions.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const q = questions[currentQ]
  const answered = Object.keys(answers).length

  return (
    <div className="flex h-screen flex-col">
      {/* Tab switch warning banner */}
      {tabWarning && (
        <div className="flex items-center gap-2 bg-danger/20 px-6 py-2 text-sm text-danger">
          <AlertTriangle size={14} />
          Tab switching detected! ({tabSwitches} time{tabSwitches !== 1 ? 's' : ''})
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="font-bold text-white">{test.topic}</h1>
          <p className="text-xs text-muted">{answered}/{questions.length} answered</p>
        </div>
        <div className="flex items-center gap-4">
          {tabSwitches > 0 && (
            <span className="flex items-center gap-1 text-xs text-danger">
              <AlertTriangle size={12} /> {tabSwitches} tab switch{tabSwitches !== 1 ? 'es' : ''}
            </span>
          )}
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5">
            <Clock size={13} className="text-muted" />
            <span className="font-mono text-sm text-white">{formatTime(elapsedSeconds)}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Question sidebar */}
        <div className="w-16 overflow-y-auto border-r border-border bg-surface p-2">
          <div className="space-y-1">
            {questions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentQ(i)}
                className={`h-10 w-10 rounded-lg text-sm font-medium transition-colors ${
                  i === currentQ
                    ? 'bg-primary text-white'
                    : answers[questions[i].id]
                    ? 'bg-success/20 text-success'
                    : 'bg-bg text-muted hover:bg-white/5 hover:text-white'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Question area */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-2xl">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted">
                Question {currentQ + 1} of {questions.length}
              </span>
              <span className="rounded bg-primary/15 px-2 py-0.5 text-xs text-primary">
                {q.marks} mark{q.marks !== 1 ? 's' : ''}
              </span>
            </div>

            <p className="mb-6 text-lg font-medium leading-relaxed text-white">{q.question}</p>

            {/* MCQ options */}
            {q.options ? (
              <div className="space-y-3">
                {(typeof q.options === 'string' ? JSON.parse(q.options) : q.options).map((opt: string) => (
                  <button
                    key={opt}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt[0] }))}
                    className={`w-full rounded-xl border px-4 py-3.5 text-left text-sm transition-colors ${
                      answers[q.id] === opt[0]
                        ? 'border-primary bg-primary/15 text-white'
                        : 'border-border text-muted hover:border-primary/40 hover:text-white'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              /* Text answer */
              <textarea
                value={answers[q.id] ?? ''}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                rows={4}
                placeholder="Write your answer here..."
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-white placeholder-muted outline-none focus:border-primary"
              />
            )}

            {/* Navigation */}
            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={() => setCurrentQ((n) => Math.max(0, n - 1))}
                disabled={currentQ === 0}
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-white disabled:opacity-30"
              >
                ← Previous
              </button>

              {currentQ < questions.length - 1 ? (
                <button
                  onClick={() => setCurrentQ((n) => n + 1)}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="rounded-lg bg-success px-5 py-2 text-sm font-bold text-white hover:bg-success/90 disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Test'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { AlertTriangle, Clock } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import type { Test, TestQuestion } from 'shared'

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

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
  const startTime = useRef(new Date().toISOString())
  const startMs = useRef(Date.now())

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token || !testId) return
      const res = await makeApi(token).tests.get(testId)
      setTest(res.test)
      setQuestions(res.questions)
    }
    load()
  }, [testId, getToken])

  useEffect(() => {
    const id = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startMs.current) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const handler = () => {
      if (document.hidden) {
        setTabSwitches((t) => t + 1)
        setTabWarning(true)
        setTimeout(() => setTabWarning(false), 3000)
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])

  const submit = useCallback(async () => {
    if (!testId) return
    setSubmitting(true)
    try {
      const token = await getToken()
      if (!token) return
      const result = await makeApi(token).tests.submitAttempt(testId, {
        answers,
        timeElapsedSeconds: elapsedSeconds,
        tabSwitches,
        startedAt: startTime.current,
      })
      navigate(`/test/${testId}/results/${result.attemptId}`)
    } finally {
      setSubmitting(false)
    }
  }, [testId, answers, elapsedSeconds, tabSwitches, getToken, navigate])

  if (!test || questions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const q = questions[currentQ]

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-white">{test.topic ?? test.type.replace('_', ' ')}</h1>
          <p className="text-sm text-muted">
            Question {currentQ + 1} of {questions.length}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {tabSwitches > 0 && (
            <span className="text-xs text-orange-400">
              <AlertTriangle size={12} className="inline" /> {tabSwitches} switch{tabSwitches > 1 ? 'es' : ''}
            </span>
          )}
          <div className="flex items-center gap-1.5 text-sm text-muted">
            <Clock size={14} />
            <span className="font-mono">{formatTime(elapsedSeconds)}</span>
          </div>
        </div>
      </div>

      {tabWarning && (
        <div className="mb-4 rounded-lg border border-orange-800 bg-orange-950/30 px-4 py-2 text-sm text-orange-400">
          Tab switch detected — please stay on this page.
        </div>
      )}

      {/* Progress */}
      <div className="mb-6 h-1.5 w-full rounded-full bg-white/5">
        <div
          className="h-1.5 rounded-full bg-primary transition-all"
          style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question */}
      <div className="flex-1 rounded-xl border border-border bg-surface p-6">
        <div className="mb-2 flex items-center gap-2 text-xs text-muted">
          <span className="capitalize">{q.question_type.replace('_', ' ')}</span>
          <span>·</span>
          <span>{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
          {q.topic && <><span>·</span><span>{q.topic}</span></>}
        </div>
        <p className="mb-6 text-lg font-medium text-white">{q.question}</p>

        {q.options ? (
          <div className="space-y-2">
            {Object.entries(
              typeof q.options === 'string'
                ? (JSON.parse(q.options) as Record<string, string>)
                : q.options,
            ).map(([key, val]) => (
              <button
                key={key}
                onClick={() => setAnswers((a) => ({ ...a, [q.id]: key }))}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                  answers[q.id] === key
                    ? 'border-primary bg-primary/15 text-white'
                    : 'border-border bg-surface text-muted hover:border-primary/40 hover:text-white'
                }`}
              >
                <span className="font-semibold">{key}.</span>
                <span>{val}</span>
              </button>
            ))}
          </div>
        ) : (
          <textarea
            value={answers[q.id] ?? ''}
            onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
            placeholder="Type your answer here…"
            rows={5}
            className="w-full rounded-xl border border-border bg-bg px-4 py-3 text-sm text-white placeholder-muted outline-none focus:border-primary"
          />
        )}
      </div>

      {/* Navigation */}
      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={() => setCurrentQ((q) => Math.max(0, q - 1))}
          disabled={currentQ === 0}
          className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-white disabled:opacity-30"
        >
          Previous
        </button>

        <div className="flex flex-wrap gap-1">
          {questions.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentQ(i)}
              className={`h-7 w-7 rounded text-xs font-medium transition-colors ${
                i === currentQ
                  ? 'bg-primary text-white'
                  : answers[questions[i].id]
                    ? 'bg-primary/30 text-white'
                    : 'bg-white/5 text-muted'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {currentQ < questions.length - 1 ? (
          <button
            onClick={() => setCurrentQ((q) => q + 1)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
          >
            Next
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={submitting}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit Test'}
          </button>
        )}
      </div>
    </div>
  )
}

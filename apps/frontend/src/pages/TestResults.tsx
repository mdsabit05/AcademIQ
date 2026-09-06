import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { CheckCircle, XCircle, AlertTriangle, Clock, ArrowLeft, RotateCcw, RefreshCw } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import type { Test, TestAttempt, TestQuestion } from 'shared'
import { generateExamPaper } from '../lib/pdf.ts'

export default function TestResults() {
  const { testId } = useParams<{ testId: string }>()
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [attempt, setAttempt] = useState<TestAttempt | null>(null)
  const [questions, setQuestions] = useState<TestQuestion[]>([])
  const [test, setTest] = useState<Test | null>(null)
  const [docTitle, setDocTitle] = useState('')

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token || !testId) return
      const res = await makeApi(token).test.get(testId)
      setQuestions(res.questions)
      setTest(res.test)
      const [attemptsRes, docsRes] = await Promise.all([
        makeApi(token).test.attempts(),
        makeApi(token).documents.list(),
      ])
      const latest = attemptsRes.attempts.find((a) => a.test_id === testId)
      if (latest) setAttempt(latest as unknown as TestAttempt)
      const doc = docsRes.documents.find((d) => d.id === res.test.document_id)
      setDocTitle(doc?.title ?? '')
    }
    load()
  }, [testId, getToken])

  if (!attempt) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const pct = Math.round((attempt.score / attempt.total_marks) * 100)
  const passed = pct >= 60
  const fmt = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-4">
        <button onClick={() => navigate('/test/new')} className="text-muted hover:text-white">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-2xl font-bold text-white">Test Results</h1>
      </div>

      {/* Score card */}
      <div className="mb-8 rounded-2xl border border-border bg-surface p-8 text-center">
        <div className={`text-6xl font-black ${passed ? 'text-success' : 'text-danger'}`}>
          {pct}%
        </div>
        <p className="mt-2 text-xl font-semibold text-white">
          {attempt.score} / {attempt.total_marks} marks
        </p>
        <p className={`mt-1 text-sm font-medium ${passed ? 'text-success' : 'text-danger'}`}>
          {passed ? 'Well done! 🎉' : 'Keep practicing! 💪'}
        </p>

        <div className="mt-6 flex justify-center gap-8 border-t border-border pt-6">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Clock size={14} />
            {attempt.time_elapsed_seconds ? fmt(attempt.time_elapsed_seconds) : '—'}
          </div>
          {attempt.tab_switches > 0 && (
            <div className="flex items-center gap-2 text-sm text-danger">
              <AlertTriangle size={14} />
              {attempt.tab_switches} tab switch{attempt.tab_switches !== 1 ? 'es' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Question review */}
      <h2 className="mb-4 font-semibold text-white">Review</h2>
      <div className="space-y-4">
        {questions.map((q, i) => {
          const userAnswer = (attempt.answers as Record<string, string>)[q.id] ?? ''
          const correct = userAnswer.trim().toLowerCase() === q.correct_answer.trim().toLowerCase()
          return (
            <div
              key={q.id}
              className={`rounded-xl border p-5 ${correct ? 'border-success/30 bg-success/5' : 'border-danger/30 bg-danger/5'}`}
            >
              <div className="flex items-start gap-3">
                {correct
                  ? <CheckCircle size={18} className="mt-0.5 shrink-0 text-success" />
                  : <XCircle size={18} className="mt-0.5 shrink-0 text-danger" />
                }
                <div className="flex-1">
                  <p className="mb-2 text-sm font-medium text-white">
                    Q{i + 1}. {q.question}
                  </p>
                  <p className="text-xs text-muted">
                    Your answer:{' '}
                    <span className={correct ? 'text-success' : 'text-danger'}>
                      {userAnswer || '(no answer)'}
                    </span>
                  </p>
                  {!correct && (
                    <p className="mt-1 text-xs text-muted">
                      Correct: <span className="text-success">{q.correct_answer}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          onClick={() => navigate('/test/new')}
          className="flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-muted hover:text-white"
        >
          <RotateCcw size={15} /> New Test
        </button>
        {test && questions.length > 0 && (
          <button
            onClick={() => generateExamPaper(test, questions, docTitle)}
            className="flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-muted hover:text-white"
          >
            📄 Download Paper
          </button>
        )}
        <button
          onClick={() => navigate(`/test/${testId}`)}
          className="flex items-center gap-2 rounded-xl border border-primary/50 px-5 py-2.5 text-sm font-medium text-primary hover:bg-primary/10"
        >
          <RefreshCw size={15} /> Repeat Test
        </button>
        <button
          onClick={() => navigate('/progress')}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"
        >
          View Progress →
        </button>
      </div>
    </div>
  )
}

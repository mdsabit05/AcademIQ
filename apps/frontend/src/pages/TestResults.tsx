import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { CheckCircle, XCircle, ArrowLeft, RotateCcw } from 'lucide-react'
import { makeApi } from '../lib/api.ts'

interface AnswerRow {
  question_id: string
  answer: string
  is_correct: boolean
  marks_awarded: number
  question: string
  question_type: string
  correct_answer: string
  marks: number
}

export default function TestResults() {
  const { testId, attemptId } = useParams<{ testId: string; attemptId: string }>()
  const { getToken } = useAuth()
  const navigate = useNavigate()

  const [score, setScore] = useState<{ score: number; totalMarks: number } | null>(null)
  const [answers, setAnswers] = useState<AnswerRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token || !testId || !attemptId) return
      const { attempt, answers: ans } = await makeApi(token).tests.getAttempt(testId, attemptId)
      setScore({ score: attempt.score, totalMarks: attempt.total_marks })
      setAnswers(ans as AnswerRow[])
      setLoading(false)
    }
    load()
  }, [testId, attemptId, getToken])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const pct = score ? Math.round((score.score / score.totalMarks) * 100) : 0

  return (
    <div className="p-8">
      <button
        onClick={() => navigate('/test/new')}
        className="mb-6 flex items-center gap-2 text-sm text-muted hover:text-white"
      >
        <ArrowLeft size={16} /> Back to Tests
      </button>

      {/* Score card */}
      <div className="mb-8 rounded-xl border border-border bg-surface p-6 text-center">
        <p className="text-5xl font-black text-white">{pct}%</p>
        <p className="mt-1 text-muted">
          {score?.score} / {score?.totalMarks} marks
        </p>
        <p className="mt-3 text-sm font-medium text-primary">
          {pct >= 80 ? 'Excellent!' : pct >= 60 ? 'Good work!' : 'Keep practising!'}
        </p>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-white">Question Review</h2>
        <button
          onClick={() => navigate('/test/new')}
          className="flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <RotateCcw size={13} /> New Test
        </button>
      </div>

      <div className="space-y-4">
        {answers.map((a, i) => (
          <div
            key={a.question_id}
            className={`rounded-xl border p-5 ${
              a.is_correct ? 'border-emerald-800/40 bg-emerald-950/10' : 'border-red-800/40 bg-red-950/10'
            }`}
          >
            <div className="mb-3 flex items-start gap-3">
              {a.is_correct
                ? <CheckCircle size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                : <XCircle size={16} className="mt-0.5 shrink-0 text-red-400" />}
              <div className="flex-1">
                <p className="text-xs text-muted mb-1">Q{i + 1} · {a.marks_awarded}/{a.marks} marks</p>
                <p className="text-sm font-medium text-white">{a.question}</p>
              </div>
            </div>

            <div className="ml-7 space-y-1.5 text-sm">
              <div className="flex gap-2">
                <span className="text-muted shrink-0">Your answer:</span>
                <span className={a.is_correct ? 'text-emerald-300' : 'text-red-300'}>{a.answer || '—'}</span>
              </div>
              {!a.is_correct && (
                <div className="flex gap-2">
                  <span className="text-muted shrink-0">Correct:</span>
                  <span className="text-emerald-300">{a.correct_answer}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

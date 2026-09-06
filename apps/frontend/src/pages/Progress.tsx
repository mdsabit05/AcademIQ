import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle, Clock, AlertTriangle, Eye, RotateCcw, FileText } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import type { ProgressResponse, TestAttempt } from 'shared'

type AttemptRow = TestAttempt & { topic: string; document_title: string; type: string; difficulty: string }

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-3xl font-black text-white">{value}</p>
      {sub && <p className="text-xs text-primary">{sub}</p>}
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  )
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const TOPICS_SHOWN = 10

export default function Progress() {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<ProgressResponse | null>(null)
  const [attempts, setAttempts] = useState<AttemptRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('All')
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const api = makeApi(token)
      const [progressRes, attemptsRes] = await Promise.all([
        api.progress.get(),
        api.test.attempts(),
      ])
      setData(progressRes)
      setAttempts(attemptsRes.attempts as AttemptRow[])
      setLoading(false)
    }
    load()
  }, [getToken])

  if (loading || !data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const uniqueTopics = ['All', ...Array.from(new Set(attempts.map((a) => a.topic)))]
  const filtered = filter === 'All' ? attempts : attempts.filter((a) => a.topic === filter)
  const visible = showAll ? filtered : filtered.slice(0, TOPICS_SHOWN)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Your Progress</h1>
        <p className="mt-1 text-muted">Track your learning journey.</p>
      </div>

      {/* Stats grid */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Tests Completed" value={data.testsCompleted} />
        <StatCard label="Topics Learned" value={data.topicsLearned} />
        <StatCard label="Average Score" value={`${data.averageScore}%`} />
        <StatCard label="Study Time" value={formatTime(data.studyTimeSeconds)} />
      </div>

      {/* Topic performance */}
      {data.topicPerformance.length > 0 && (
        <div className="mb-8 rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-5 font-semibold text-white">Topic Performance</h2>
          <div className="space-y-4">
            {data.topicPerformance.map(({ topic, score, attempts: cnt }) => (
              <div key={topic}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="text-white">{topic}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-muted">{cnt} attempt{cnt !== 1 ? 's' : ''}</span>
                    <span className={score >= 70 ? 'text-success' : 'text-danger'}>{score}%</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-bg">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${score >= 70 ? 'bg-success' : 'bg-danger'}`}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attempt History */}
      {attempts.length > 0 && (
        <div className="mb-8 rounded-xl border border-border bg-surface p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-semibold text-white">Attempt History</h2>
            <span className="text-xs text-muted">{attempts.length} total</span>
          </div>

          {/* Topic filter chips */}
          <div className="mb-5 flex flex-wrap gap-2">
            {uniqueTopics.map((t) => (
              <button
                key={t}
                onClick={() => { setFilter(t); setShowAll(false) }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filter === t
                    ? 'bg-primary text-white'
                    : 'border border-border text-muted hover:border-primary/40 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-border">
            {/* Header */}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 border-b border-border bg-bg px-5 py-3 text-xs font-semibold uppercase tracking-widest text-muted">
              <span>Topic</span>
              <span>Score</span>
              <span>Time</span>
              <span>Tab Switches</span>
              <span>Date</span>
              <span>Actions</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-border">
              {visible.map((a) => {
                const pct = Math.round((a.score / a.total_marks) * 100)
                const passed = pct >= 60
                return (
                  <div
                    key={a.id}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] items-center gap-4 px-5 py-4 hover:bg-white/[0.02]"
                  >
                    {/* Topic */}
                    <div>
                      <p className="font-semibold text-white">{a.topic}</p>
                      <p className="text-xs text-muted">{a.document_title}</p>
                    </div>

                    {/* Score */}
                    <div>
                      <span className={`text-sm font-bold ${passed ? 'text-success' : 'text-danger'}`}>
                        {a.score} / {a.total_marks}
                      </span>
                      <p className={`text-xs ${passed ? 'text-success/70' : 'text-danger/70'}`}>
                        ({pct}%)
                      </p>
                    </div>

                    {/* Time */}
                    <div className="flex items-center gap-1.5 text-sm text-muted">
                      <Clock size={12} />
                      {a.time_elapsed_seconds ? formatTime(a.time_elapsed_seconds) : '—'}
                    </div>

                    {/* Tab switches */}
                    <div>
                      {a.tab_switches > 0 ? (
                        <span className="flex items-center gap-1 text-sm text-danger">
                          <AlertTriangle size={12} /> {a.tab_switches}
                        </span>
                      ) : (
                        <span className="text-sm text-success">0</span>
                      )}
                    </div>

                    {/* Date */}
                    <p className="text-xs text-muted">{formatDate(a.submitted_at)}</p>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/test/${a.test_id}/results`)}
                        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:border-primary/40 hover:text-white"
                      >
                        <Eye size={12} /> Results
                      </button>
                      <button
                        onClick={() => navigate(`/test/${a.test_id}`)}
                        className="flex items-center gap-1.5 rounded-lg border border-primary/40 px-3 py-1.5 text-xs text-primary hover:bg-primary/10"
                      >
                        <RotateCcw size={12} /> Retry
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Show more */}
          {filtered.length > TOPICS_SHOWN && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="mt-4 w-full rounded-lg border border-border py-2 text-sm text-muted hover:text-white"
            >
              {showAll ? 'Show Less' : `Show ${filtered.length - TOPICS_SHOWN} More`}
            </button>
          )}
        </div>
      )}

      {/* Topics to review */}
      {data.topicsToReview.length > 0 && (
        <div className="mb-8 rounded-xl border border-amber-DEFAULT/30 bg-amber-muted p-6">
          <h2 className="mb-4 font-semibold text-amber-DEFAULT">⚠ Topics to Review</h2>
          <ol className="mb-4 list-inside list-decimal space-y-2">
            {data.topicsToReview.map((t) => (
              <li key={t} className="flex items-center justify-between text-sm text-white">
                <span>{t}</span>
                <button
                  onClick={() => navigate('/test/new', {
                    state: { topic: t, documentId: data.topicDocumentMap[t] },
                  })}
                  className="ml-4 shrink-0 rounded-lg border border-amber-DEFAULT/50 px-3 py-1 text-xs font-medium text-amber-DEFAULT hover:bg-amber-DEFAULT/10"
                >
                  Test Me →
                </button>
              </li>
            ))}
          </ol>
          <button
            onClick={() => {
              const weakest = data.topicsToReview[data.topicsToReview.length - 1]
              navigate('/test/new', {
                state: { topic: weakest, documentId: data.topicDocumentMap[weakest] },
              })
            }}
            className="rounded-lg bg-amber-DEFAULT px-4 py-2 text-sm font-semibold text-bg hover:opacity-90"
          >
            Start Revision Test →
          </button>
        </div>
      )}

      {data.testsCompleted === 0 && (
        <div className="py-16 text-center">
          <FileText size={40} className="mx-auto mb-4 text-muted" />
          <p className="text-muted">No test data yet.</p>
          <button onClick={() => navigate('/test/new')} className="mt-3 text-sm text-primary hover:underline">
            Take your first test →
          </button>
        </div>
      )}
    </div>
  )
}

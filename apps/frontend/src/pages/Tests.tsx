/**
 * Tests — Test history page.
 * Shows all generated tests with attempt scores, best/avg, and quick actions.
 */

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  FileText,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Trophy,
  Clock,
  BarChart2,
  BookOpen,
  PlayCircle,
  ExternalLink,
  Layers,
} from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import type { Test, TestAttempt } from 'shared'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function fmtTime(s: number | null) {
  if (!s) return '—'
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function pct(score: number, total: number) {
  return total > 0 ? Math.round((score / total) * 100) : 0
}

function scoreColor(p: number) {
  if (p >= 80) return 'text-emerald-400'
  if (p >= 60) return 'text-primary'
  if (p >= 40) return 'text-yellow-400'
  return 'text-red-400'
}

function scoreBg(p: number) {
  if (p >= 80) return 'bg-emerald-400/15 text-emerald-400'
  if (p >= 60) return 'bg-primary/15 text-primary'
  if (p >= 40) return 'bg-yellow-400/15 text-yellow-400'
  return 'bg-red-400/15 text-red-400'
}

function typeBadge(type: string) {
  const map: Record<string, string> = {
    mcq: 'MCQ', one_mark: '1 Mark', two_mark: '2 Mark',
    five_mark: '5 Mark', mixed: 'Mixed',
  }
  return map[type] ?? type
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color = 'text-white' }: {
  icon: React.ElementType
  label: string
  value: string | number
  color?: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon size={16} className="text-primary" />
      </div>
      <div>
        <p className={`text-lg font-bold ${color}`}>{value}</p>
        <p className="text-xs text-muted">{label}</p>
      </div>
    </div>
  )
}

// ── Attempt pill ───────────────────────────────────────────────────────────────

function AttemptPill({ attempt, testId, navigate }: {
  attempt: TestAttempt
  testId: string
  navigate: (to: string) => void
}) {
  const p = pct(attempt.score, attempt.total_marks)
  return (
    <button
      onClick={() => navigate(`/test/${testId}/results/${attempt.id}`)}
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all hover:ring-1 hover:ring-primary/40 ${scoreBg(p)}`}
      title={`${attempt.score}/${attempt.total_marks} marks — ${fmtDate(attempt.submitted_at)}`}
    >
      {p}%
    </button>
  )
}

// ── Test row ───────────────────────────────────────────────────────────────────

function TestRow({ test, attempts, navigate }: {
  test: Test
  attempts: TestAttempt[]
  navigate: (to: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const bestAttempt = attempts.length > 0
    ? attempts.reduce((a, b) => pct(a.score, a.total_marks) >= pct(b.score, b.total_marks) ? a : b)
    : null
  const bestPct  = bestAttempt ? pct(bestAttempt.score, bestAttempt.total_marks) : null
  const avgPct   = attempts.length > 0
    ? Math.round(attempts.reduce((s, a) => s + pct(a.score, a.total_marks), 0) / attempts.length)
    : null
  const lastAttempt = attempts.length > 0
    ? attempts.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0]
    : null

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Main row */}
      <div className="flex items-center gap-4 p-4">

        {/* Icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <FileText size={16} className="text-primary" />
        </div>

        {/* Title + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-white truncate">
              {test.topic ?? 'General Test'}
            </p>
            <span className="rounded-full bg-border/80 px-2 py-0.5 text-[10px] font-semibold text-muted">
              {typeBadge(test.type)}
            </span>
            <span className="rounded-full bg-border/80 px-2 py-0.5 text-[10px] font-semibold capitalize text-muted">
              {test.difficulty}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-muted">
            <span>{fmtDate(test.created_at)}</span>
            <span>·</span>
            <span>{test.question_count} questions</span>
            <span>·</span>
            <span>{test.total_marks} marks</span>
            {test.duration_minutes && (
              <><span>·</span><span>{test.duration_minutes} min</span></>
            )}
          </div>
        </div>

        {/* Scores summary */}
        <div className="hidden sm:flex items-center gap-4 shrink-0">
          {attempts.length === 0 ? (
            <span className="text-xs text-muted italic">Not attempted</span>
          ) : (
            <>
              {/* Recent attempts (up to 5 pills) */}
              <div className="flex items-center gap-1">
                {[...attempts]
                  .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
                  .slice(0, 5)
                  .map((a) => (
                    <AttemptPill key={a.id} attempt={a} testId={test.id} navigate={navigate} />
                  ))}
              </div>
              {/* Best */}
              {bestPct !== null && (
                <div className="text-center">
                  <p className={`text-sm font-bold ${scoreColor(bestPct)}`}>{bestPct}%</p>
                  <p className="text-[10px] text-muted">Best</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate(`/test/${test.id}`)}
            className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
          >
            <PlayCircle size={12} />
            {attempts.length === 0 ? 'Start' : 'Retake'}
          </button>
          {lastAttempt && (
            <button
              onClick={() => navigate(`/test/${test.id}/results/${lastAttempt.id}`)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:text-white hover:border-primary/30 transition-colors"
            >
              <ExternalLink size={11} />
              Results
            </button>
          )}
          {attempts.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted hover:text-white transition-colors"
            >
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded attempts table */}
      {expanded && attempts.length > 0 && (
        <div className="border-t border-border bg-bg/50">
          <div className="px-4 py-2">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">
              All Attempts ({attempts.length})
            </p>
            <div className="space-y-1">
              {[...attempts]
                .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
                .map((a, i) => {
                  const p = pct(a.score, a.total_marks)
                  const isBest = a.id === bestAttempt?.id
                  return (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface transition-colors"
                    >
                      {/* Attempt # */}
                      <span className="w-6 text-center text-xs font-bold text-muted">
                        #{attempts.length - i}
                      </span>

                      {/* Score bar */}
                      <div className="flex-1">
                        <div className="mb-1 flex items-center justify-between">
                          <span className={`text-xs font-bold ${scoreColor(p)}`}>{p}%</span>
                          <span className="text-[11px] text-muted">
                            {a.score}/{a.total_marks} marks
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-border">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              p >= 80 ? 'bg-emerald-400' : p >= 60 ? 'bg-primary' : p >= 40 ? 'bg-yellow-400' : 'bg-red-400'
                            }`}
                            style={{ width: `${p}%` }}
                          />
                        </div>
                      </div>

                      {/* Time */}
                      <span className="hidden sm:block w-14 text-right text-[11px] text-muted">
                        {fmtTime(a.time_elapsed_seconds)}
                      </span>

                      {/* Date */}
                      <span className="hidden md:block w-24 text-right text-[11px] text-muted">
                        {fmtDate(a.submitted_at)}
                      </span>

                      {/* Best badge */}
                      {isBest && (
                        <span className="rounded-full bg-yellow-400/10 px-2 py-0.5 text-[10px] font-bold text-yellow-400">
                          Best
                        </span>
                      )}

                      {/* View */}
                      <button
                        onClick={() => navigate(`/test/${test.id}/results/${a.id}`)}
                        className="text-[11px] text-primary hover:underline"
                      >
                        View
                      </button>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function Tests() {
  const { getToken } = useAuth()
  const navigate     = useNavigate()

  const [tests,    setTests]    = useState<Test[]>([])
  const [attempts, setAttempts] = useState<Record<string, TestAttempt[]>>({})
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState<'all' | 'attempted' | 'pending'>('all')

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const api = makeApi(token)
      const { tests: all } = await api.tests.list()
      setTests(all)

      // Load all attempts in parallel
      const results = await Promise.all(
        all.map((t) => api.tests.listAttempts(t.id).then((r) => ({ id: t.id, attempts: r.attempts })))
      )
      const map: Record<string, TestAttempt[]> = {}
      for (const r of results) map[r.id] = r.attempts
      setAttempts(map)
      setLoading(false)
    }
    load()
  }, [getToken])

  // ── Stats ──────────────────────────────────────────────────────────────────
  const allAttempts   = Object.values(attempts).flat()
  const totalAttempts = allAttempts.length
  const bestPct       = allAttempts.length > 0
    ? Math.max(...allAttempts.map((a) => pct(a.score, a.total_marks)))
    : null
  const avgPct        = allAttempts.length > 0
    ? Math.round(allAttempts.reduce((s, a) => s + pct(a.score, a.total_marks), 0) / allAttempts.length)
    : null

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = tests.filter((t) => {
    if (filter === 'attempted') return (attempts[t.id]?.length ?? 0) > 0
    if (filter === 'pending')   return (attempts[t.id]?.length ?? 0) === 0
    return true
  })

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">Tests</p>
            <h1 className="text-2xl font-extrabold text-white">Test History</h1>
            <p className="mt-1 text-sm text-muted">All your generated tests and attempt scores.</p>
          </div>
          <button
            onClick={() => navigate('/test/new')}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-bg hover:bg-primary-hover transition-colors"
          >
            <Plus size={15} />
            New Test
          </button>
        </div>

        {/* Stats */}
        {tests.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard icon={Layers}    label="Tests Created"   value={tests.length} />
            <StatCard icon={BarChart2} label="Total Attempts"  value={totalAttempts} />
            <StatCard
              icon={Trophy}
              label="Best Score"
              value={bestPct !== null ? `${bestPct}%` : '—'}
              color={bestPct !== null ? scoreColor(bestPct) : 'text-white'}
            />
            <StatCard
              icon={BookOpen}
              label="Avg Score"
              value={avgPct !== null ? `${avgPct}%` : '—'}
              color={avgPct !== null ? scoreColor(avgPct) : 'text-white'}
            />
          </div>
        )}

        {tests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <FileText size={28} className="text-primary" />
            </div>
            <p className="text-lg font-semibold text-white">No tests yet</p>
            <p className="mt-1 text-sm text-muted">Create your first test to start practising.</p>
            <button
              onClick={() => navigate('/test/new')}
              className="mt-5 flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-bg hover:bg-primary-hover"
            >
              <Plus size={15} />
              Create Your First Test
            </button>
          </div>
        ) : (
          <>
            {/* Filter tabs */}
            <div className="flex items-center gap-2">
              {(['all', 'attempted', 'pending'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all capitalize ${
                    filter === f
                      ? 'bg-primary text-bg'
                      : 'border border-border text-muted hover:text-white'
                  }`}
                >
                  {f === 'all'       ? `All (${tests.length})` :
                   f === 'attempted' ? `Attempted (${tests.filter(t => (attempts[t.id]?.length ?? 0) > 0).length})` :
                                       `Not Started (${tests.filter(t => (attempts[t.id]?.length ?? 0) === 0).length})`}
                </button>
              ))}
            </div>

            {/* Test list */}
            <div className="space-y-3">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Clock size={28} className="mb-3 text-muted/30" />
                  <p className="font-medium text-white">No tests match this filter</p>
                </div>
              ) : (
                filtered.map((test) => (
                  <TestRow
                    key={test.id}
                    test={test}
                    attempts={attempts[test.id] ?? []}
                    navigate={navigate}
                  />
                ))
              )}
            </div>
          </>
        )}

      </div>
    </div>
  )
}

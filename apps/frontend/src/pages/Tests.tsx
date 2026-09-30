/**
 * Tests — dual layout:
 *   Desktop: old "Test History" design with row-style list
 *   Mobile:  new card-based design with hero + sparklines
 */

import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth.ts'
import { useNavigate } from 'react-router-dom'
import {
  Plus, FileText, Trophy, Clock, BarChart2, BookOpen,
  Search, SlidersHorizontal, ChevronRight, Eye, RotateCcw,
  CheckCircle, AlertCircle, TrendingUp,
  PlayCircle, ExternalLink, ChevronDown, ChevronUp, Layers, ArrowUpDown,
} from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import { useTheme } from '../lib/theme.tsx'
import type { Test, TestAttempt } from 'shared'
import heroBg from '../assets/hero-bg.png'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
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

function getStatus(best: number | null): 'completed' | 'ontrack' | 'revision' | null {
  if (best === null) return null
  if (best >= 80) return 'completed'
  if (best >= 50) return 'ontrack'
  return 'revision'
}

const SUBJECT_COLORS = [
  '#22D3EE', '#A855F7', '#22C55E', '#F97316', '#EF4444',
  '#FBBF24', '#EC4899', '#6366F1', '#14B8A6', '#F43F5E',
]
function subjectColor(idx: number) { return SUBJECT_COLORS[idx % SUBJECT_COLORS.length] }

// ── Desktop: Attempt Pill ─────────────────────────────────────────────────────

function AttemptPill({ attempt, testId, navigate }: {
  attempt: TestAttempt; testId: string; navigate: (to: string) => void
}) {
  const p = pct(attempt.score, attempt.total_marks)
  return (
    <button
      onClick={() => navigate(`/test/${testId}/results/${attempt.id}`)}
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all hover:ring-1 hover:ring-primary/40 ${scoreBg(p)}`}
    >
      {p}%
    </button>
  )
}

// ── Desktop: Test Row ─────────────────────────────────────────────────────────

function TestRow({ test, attempts, navigate }: {
  test: Test; attempts: TestAttempt[]; navigate: (to: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const bestAttempt = attempts.length > 0
    ? attempts.reduce((a, b) => pct(a.score, a.total_marks) >= pct(b.score, b.total_marks) ? a : b)
    : null
  const bestPct = bestAttempt ? pct(bestAttempt.score, bestAttempt.total_marks) : null
  const lastAttempt = attempts.length > 0
    ? [...attempts].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0]
    : null

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <FileText size={16} className="text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-white truncate">{test.topic ?? 'General Test'}</p>
            <span className="rounded-full bg-border/80 px-2 py-0.5 text-[10px] font-semibold text-muted">{typeBadge(test.type)}</span>
            <span className="rounded-full bg-border/80 px-2 py-0.5 text-[10px] font-semibold capitalize text-muted">{test.difficulty}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-muted">
            <span>{fmtDate(test.created_at)}</span>
            <span>·</span><span>{test.question_count} questions</span>
            <span>·</span><span>{test.total_marks} marks</span>
            {test.duration_minutes && <><span>·</span><span>{test.duration_minutes} min</span></>}
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-4 shrink-0">
          {attempts.length === 0 ? (
            <span className="text-xs text-muted italic">Not attempted</span>
          ) : (
            <>
              <div className="flex items-center gap-1">
                {[...attempts]
                  .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
                  .slice(0, 5)
                  .map((a) => <AttemptPill key={a.id} attempt={a} testId={test.id} navigate={navigate} />)}
              </div>
              {bestPct !== null && (
                <div className="text-center">
                  <p className={`text-sm font-bold ${scoreColor(bestPct)}`}>{bestPct}%</p>
                  <p className="text-xs text-muted">Best</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => navigate(`/test/${test.id}`)}
            className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors">
            <PlayCircle size={12} />
            {attempts.length === 0 ? 'Start' : 'Retake'}
          </button>
          {lastAttempt && (
            <button onClick={() => navigate(`/test/${test.id}/results/${lastAttempt.id}`)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:text-white hover:border-primary/30 transition-colors">
              <ExternalLink size={11} /> Results
            </button>
          )}
          {attempts.length > 0 && (
            <button onClick={() => setExpanded(!expanded)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted hover:text-white transition-colors">
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
        </div>
      </div>

      {expanded && attempts.length > 0 && (
        <div className="border-t border-border bg-bg/50 px-4 py-2">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">All Attempts ({attempts.length})</p>
          <div className="space-y-1">
            {[...attempts]
              .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
              .map((a, i) => {
                const p = pct(a.score, a.total_marks)
                const isBest = a.id === bestAttempt?.id
                return (
                  <div key={a.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface transition-colors">
                    <span className="w-6 text-center text-xs font-bold text-muted">#{attempts.length - i}</span>
                    <div className="flex-1">
                      <div className="mb-1 flex items-center justify-between">
                        <span className={`text-xs font-bold ${scoreColor(p)}`}>{p}%</span>
                        <span className="text-xs text-muted">{a.score}/{a.total_marks} marks</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-border">
                        <div className={`h-1.5 rounded-full ${p >= 80 ? 'bg-emerald-400' : p >= 60 ? 'bg-primary' : p >= 40 ? 'bg-yellow-400' : 'bg-red-400'}`}
                          style={{ width: `${p}%` }} />
                      </div>
                    </div>
                    <span className="hidden sm:block w-24 text-right text-xs text-muted">{fmtDate(a.submitted_at)}</span>
                    {isBest && <span className="rounded-full bg-yellow-400/10 px-2 py-0.5 text-xs font-bold text-yellow-400">Best</span>}
                    <button onClick={() => navigate(`/test/${test.id}/results/${a.id}`)} className="text-xs text-primary hover:underline">View</button>
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}


// ── Mobile: Stat Card with sparkline ─────────────────────────────────────────

function MobileStatCard({ icon: Icon, label, value, iconColor = '#22D3EE' }: {
  icon: React.ElementType; label: string; value: string | number; iconColor?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2.5 flex items-center gap-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${iconColor}18`, border: `1px solid ${iconColor}30` }}>
        <Icon size={13} style={{ color: iconColor }} />
      </div>
      <div className="min-w-0">
        <p className="text-base font-black text-white leading-none">{value}</p>
        <p className="text-xs text-muted mt-0.5 truncate">{label}</p>
      </div>
    </div>
  )
}

// ── Desktop: Simple Stat Card ─────────────────────────────────────────────────

function DesktopStatCard({ icon: Icon, label, value, color = 'text-white' }: {
  icon: React.ElementType; label: string; value: string | number; color?: string
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

// ── Mobile: Status Badge ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'completed' | 'ontrack' | 'revision' | null }) {
  if (!status) return null
  const map = {
    completed: { label: 'Completed',      bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)',  color: '#22C55E', icon: CheckCircle },
    ontrack:   { label: 'On Track',       bg: 'rgba(34,211,238,0.12)', border: 'rgba(34,211,238,0.3)', color: '#22D3EE', icon: TrendingUp  },
    revision:  { label: 'Needs Revision', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',  color: '#EF4444', icon: AlertCircle },
  }
  const { label, bg, border, color, icon: Icon } = map[status]
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold shrink-0"
      style={{ background: bg, border: `1px solid ${border}`, color }}>
      <Icon size={9} />{label}
    </span>
  )
}

// ── Mobile: Test Card ─────────────────────────────────────────────────────────

function TestCard({ test, attempts, colorIdx, navigate }: {
  test: Test; attempts: TestAttempt[]; colorIdx: number; navigate: (to: string) => void
}) {
  const sorted = [...attempts].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
  const lastAttempt = sorted[0] ?? null
  const bestPct = attempts.length > 0 ? Math.max(...attempts.map((a) => pct(a.score, a.total_marks))) : null
  const status = getStatus(bestPct)
  const color = subjectColor(colorIdx)
  const lastScore = lastAttempt ? pct(lastAttempt.score, lastAttempt.total_marks) : null
  const lastScoreColor = lastScore === null ? '#94A3B8' : lastScore >= 80 ? '#22C55E' : lastScore >= 50 ? '#22D3EE' : '#EF4444'

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="p-3.5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
            <FileText size={16} style={{ color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-white leading-tight line-clamp-1">{test.topic ?? 'General Test'}</p>
              <StatusBadge status={status} />
            </div>
            <p className="text-[11px] text-muted mt-0.5">{test.topic?.split(' - ')[0] ?? 'General'} · {typeBadge(test.type)}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-3 text-[11px] text-muted">
          <span className="flex items-center gap-1"><FileText size={11} />{test.question_count} Questions</span>
          <span className="flex items-center gap-1"><BookOpen size={11} />{test.total_marks} Marks</span>
          {test.duration_minutes && <span className="flex items-center gap-1"><Clock size={11} />{test.duration_minutes} Minutes</span>}
        </div>
        <div className="flex items-center gap-2 mt-2.5">
          <span className="text-[11px] text-muted">{fmtDate(test.created_at)}</span>
          {lastScore !== null && lastAttempt && (
            <><span className="text-muted/40">·</span>
            <span className="text-[11px] font-bold" style={{ color: lastScoreColor }}>
              {lastScore}% ({lastAttempt.score}/{lastAttempt.total_marks})
            </span></>
          )}
        </div>
      </div>
      <div className="border-t border-border px-3.5 py-2.5 flex gap-2">
        {lastAttempt && (
          <button onClick={() => navigate(`/test/${test.id}/results/${lastAttempt.id}`)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-bold text-muted hover:text-white hover:bg-white/5 transition-colors">
            <Eye size={11} /> View
          </button>
        )}
        <button onClick={() => navigate(`/test/${test.id}`)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-colors"
          style={{ background: 'rgba(34,211,238,0.1)', color: '#22D3EE', border: '1px solid rgba(34,211,238,0.25)' }}>
          <RotateCcw size={11} /> {attempts.length === 0 ? 'Start' : 'Retake'}
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Tests() {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const [tests, setTests] = useState<Test[]>([])
  const [attempts, setAttempts] = useState<Record<string, TestAttempt[]>>({})
  const [loading, setLoading] = useState(true)

  // Desktop filter
  const [desktopFilter, setDesktopFilter] = useState<'all' | 'attempted' | 'notstarted'>('all')
  // Mobile filter
  const [mobileFilter, setMobileFilter] = useState<'all' | 'revision' | 'ontrack' | 'mastered'>('all')
  const [mobileSearch, setMobileSearch] = useState('')

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const api = makeApi(token)
      const { tests: all } = await api.tests.list()
      setTests(all)
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

  // Stats
  const allAttempts = Object.values(attempts).flat()
  const totalAttempts = allAttempts.length
  const bestPct = allAttempts.length > 0 ? Math.max(...allAttempts.map((a) => pct(a.score, a.total_marks))) : null
  const avgPct  = allAttempts.length > 0 ? Math.round(allAttempts.reduce((s, a) => s + pct(a.score, a.total_marks), 0) / allAttempts.length) : null

  const getBest = (t: Test) => {
    const atts = attempts[t.id] ?? []
    return atts.length === 0 ? null : Math.max(...atts.map((a) => pct(a.score, a.total_marks)))
  }

  // Desktop filtered list
  const desktopFiltered = tests.filter((t) => {
    const atts = attempts[t.id] ?? []
    if (desktopFilter === 'attempted')  return atts.length > 0
    if (desktopFilter === 'notstarted') return atts.length === 0
    return true
  })

  // Mobile filtered list
  const mobileFiltered = tests
    .filter((t) => {
      const best = getBest(t)
      if (mobileFilter === 'revision') return best !== null && best < 50
      if (mobileFilter === 'ontrack')  return best !== null && best >= 50 && best < 80
      if (mobileFilter === 'mastered') return best !== null && best >= 80
      return true
    })
    .filter((t) => {
      if (!mobileSearch) return true
      return (t.topic ?? '').toLowerCase().includes(mobileSearch.toLowerCase())
    })

  const MOBILE_TABS = [
    { key: 'all' as const,      label: 'All',            count: tests.length },
    { key: 'revision' as const, label: 'Needs Revision', count: tests.filter(t => { const b = getBest(t); return b !== null && b < 50 }).length },
    { key: 'ontrack' as const,  label: 'On Track',       count: tests.filter(t => { const b = getBest(t); return b !== null && b >= 50 && b < 80 }).length },
    { key: 'mastered' as const, label: 'Mastered',       count: tests.filter(t => { const b = getBest(t); return b !== null && b >= 80 }).length },
  ]

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">

      {/* ════════════════════════════════════════════════════════════════════
          DESKTOP LAYOUT (hidden on mobile)
      ════════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:block space-y-6">

        {/* Hero Banner */}
        <div
          className="relative overflow-hidden px-8 py-10"
          style={{ backgroundImage: `url(${heroBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        >
          <div className="absolute inset-0 pointer-events-none" style={{
            background: isLight
              ? 'linear-gradient(to right, rgba(241,243,247,0.97) 0%, rgba(241,243,247,0.88) 40%, rgba(241,243,247,0.5) 65%, rgba(241,243,247,0.0) 90%)'
              : 'linear-gradient(to right, rgba(8,12,20,0.95) 0%, rgba(8,12,20,0.80) 40%, rgba(8,12,20,0.4) 65%, rgba(8,12,20,0.0) 90%)',
          }} />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">Tests</p>
              <h1 className="text-3xl font-extrabold" style={{ color: isLight ? '#1e293b' : '#fff' }}>Test History</h1>
              <p className="mt-1 text-sm text-muted">All your generated tests and attempt scores.</p>
            </div>
            <button onClick={() => navigate('/test/new')}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-bg hover:bg-primary-hover transition-colors">
              <Plus size={15} /> New Test
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-6">

        {/* Stats — 4 columns */}
        {tests.length > 0 && (
          <div className="grid grid-cols-4 gap-3">
            <DesktopStatCard icon={Layers}    label="Tests Created"  value={tests.length} />
            <DesktopStatCard icon={BarChart2} label="Total Attempts" value={totalAttempts} />
            <DesktopStatCard icon={Trophy}    label="Best Score"     value={bestPct !== null ? `${bestPct}%` : '—'} color={bestPct !== null ? (bestPct >= 80 ? 'text-emerald-400' : bestPct >= 60 ? 'text-primary' : bestPct >= 40 ? 'text-yellow-400' : 'text-red-400') : 'text-white'} />
            <DesktopStatCard icon={BookOpen}  label="Avg Score"      value={avgPct  !== null ? `${avgPct}%`  : '—'} color={avgPct  !== null ? (avgPct  >= 80 ? 'text-emerald-400' : avgPct  >= 60 ? 'text-primary' : avgPct  >= 40 ? 'text-yellow-400' : 'text-red-400') : 'text-white'} />
          </div>
        )}

        {tests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <FileText size={28} className="text-primary" />
            </div>
            <p className="text-lg font-semibold text-white">No tests yet</p>
            <p className="mt-1 text-sm text-muted">Create your first test to start practising.</p>
            <button onClick={() => navigate('/test/new')}
              className="mt-5 flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-bg hover:bg-primary-hover">
              <Plus size={15} /> Create Your First Test
            </button>
          </div>
        ) : (
          <>
            {/* Desktop filter tabs */}
            <div className="flex items-center gap-2">
              {([
                { key: 'all' as const,        label: 'All',         count: tests.length },
                { key: 'attempted' as const,  label: 'Attempted',   count: tests.filter(t => (attempts[t.id] ?? []).length > 0).length },
                { key: 'notstarted' as const, label: 'Not Started', count: tests.filter(t => (attempts[t.id] ?? []).length === 0).length },
              ]).map(({ key, label, count }) => {
                const active = desktopFilter === key
                return (
                  <button key={key} onClick={() => setDesktopFilter(key)}
                    className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-all ${
                      active ? 'bg-primary text-bg border-primary' : 'border-border text-muted hover:text-white'
                    }`}>
                    {label} ({count})
                  </button>
                )
              })}
            </div>

            {/* Desktop test rows */}
            <div className="space-y-3">
              {desktopFiltered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Clock size={28} className="mb-3 text-muted/30" />
                  <p className="font-medium text-white">No tests match this filter</p>
                </div>
              ) : desktopFiltered.map((test) => (
                <TestRow key={test.id} test={test} attempts={attempts[test.id] ?? []} navigate={navigate} />
              ))}
            </div>
          </>
        )}
        </div>{/* end inner px-6 div */}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          MOBILE LAYOUT (hidden on desktop)
      ════════════════════════════════════════════════════════════════════ */}
      <div className="md:hidden flex flex-col min-h-full">

        {/* Hero */}
        <div className="relative overflow-hidden" style={{ minHeight: 140, background: 'linear-gradient(135deg, rgba(34,211,238,0.08) 0%, transparent 70%)' }}>
          <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `url(${heroBg})`, backgroundSize: 'cover', backgroundPosition: 'center right', opacity: 0.06 }} />
          <div className="relative px-4 py-6 max-w-xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-1">Tests</p>
            <h1 className="text-xl font-black text-white leading-tight">
              Practice. Improve.{' '}
              <span className="text-primary" style={{ textShadow: '0 0 24px rgba(34,211,238,0.4)' }}>Progress.</span>
            </h1>
            <p className="mt-1 text-xs text-muted leading-relaxed">
              Generate tests from your study materials, practice regularly and track your performance.
            </p>
          </div>
        </div>

        {/* Mobile stats 2×2 */}
        {tests.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5 px-3 pb-3">
            <MobileStatCard icon={FileText}  label="Tests Created"  value={tests.length}                           iconColor="#22D3EE" />
            <MobileStatCard icon={BarChart2} label="Total Attempts" value={totalAttempts}                          iconColor="#22D3EE" />
            <MobileStatCard icon={Trophy}    label="Best Score"     value={bestPct !== null ? `${bestPct}%` : '—'} iconColor="#FBBF24" />
            <MobileStatCard icon={BookOpen}  label="Avg Score"      value={avgPct  !== null ? `${avgPct}%`  : '—'} iconColor="#A855F7" />
          </div>
        )}

        {/* Sticky toolbar */}
        <div className="sticky top-0 z-10 bg-bg border-b border-border">
          <div className="flex gap-2 px-3 pt-2 pb-2 overflow-x-auto scrollbar-none">
            {MOBILE_TABS.map(({ key, label, count }) => {
              const active = mobileFilter === key
              const style =
                active && key === 'revision' ? { background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' } :
                active && key === 'ontrack'  ? { background: 'rgba(34,211,238,0.15)', color: '#22D3EE', border: '1px solid rgba(34,211,238,0.3)' } :
                active && key === 'mastered' ? { background: 'rgba(34,197,94,0.15)',  color: '#22C55E', border: '1px solid rgba(34,197,94,0.3)'  } :
                active ? { background: '#22D3EE', color: '#0a0f1a', border: '1px solid #22D3EE' } :
                { background: 'transparent', color: '#64748B', border: '1px solid rgba(100,116,139,0.3)' }
              return (
                <button key={key} onClick={() => setMobileFilter(key)}
                  className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap"
                  style={style}>
                  {label} ({count})
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-2 px-3 pb-2.5">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input value={mobileSearch} onChange={(e) => setMobileSearch(e.target.value)}
                placeholder="Search tests…"
                className="w-full rounded-lg border border-border bg-surface pl-8 pr-3 py-2 text-xs text-white placeholder:text-muted/50 focus:border-primary focus:outline-none transition-colors" />
            </div>
            <button className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted hover:text-white transition-colors shrink-0">
              <ArrowUpDown size={12} /> Sort
            </button>
            <button className="flex items-center justify-center rounded-lg border border-border bg-surface w-8 h-8 text-muted hover:text-white transition-colors shrink-0">
              <SlidersHorizontal size={13} />
            </button>
          </div>
        </div>

        {/* Mobile content */}
        <div className="px-3 pt-3 pb-6 space-y-2.5">
          <button onClick={() => navigate('/test/new')}
            className="w-full flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3.5 text-left hover:border-primary/30 transition-colors">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.25)' }}>
              <Plus size={18} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">Create a New Test</p>
              <p className="text-xs text-muted">Generate questions from your books, syllabus or topics</p>
            </div>
            <ChevronRight size={16} className="text-muted shrink-0" />
          </button>

          {tests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <FileText size={24} className="text-primary" />
              </div>
              <p className="text-base font-bold text-white">No tests yet</p>
              <p className="mt-1 text-sm text-muted">Create your first test to start practising.</p>
              <button
                onClick={() => navigate('/test/new')}
                className="mt-4 flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-bg hover:bg-primary-hover transition-colors"
              >
                <Plus size={15} /> Create First Test
              </button>
            </div>
          ) : mobileFiltered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search size={24} className="mb-3 text-muted/30" />
              <p className="text-sm font-medium text-white">No tests match this filter</p>
              <button onClick={() => { setMobileFilter('all'); setMobileSearch('') }}
                className="mt-2 text-xs text-primary hover:underline">Clear filters</button>
            </div>
          ) : mobileFiltered.map((test, i) => (
            <TestCard key={test.id} test={test} attempts={attempts[test.id] ?? []} colorIdx={i} navigate={navigate} />
          ))}
        </div>
      </div>

    </div>
  )
}

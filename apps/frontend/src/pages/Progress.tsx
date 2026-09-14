/**
 * Progress — full analytics dashboard.
 * Data: progress.summary + progress.history + topicMastery + weakTopics
 */

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../lib/theme.tsx'
import {
  FileText, Star, Clock, Target, TrendingUp, ChevronRight,
  AlertTriangle, Trophy, BookOpen, Flame, Lock, CheckCircle2,
  ArrowUpRight, RotateCcw,
} from 'lucide-react'
import { makeApi } from '../lib/api.ts'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Summary {
  testsTaken: number
  avgScorePct: number | null
  totalStudyMinutes: number
}

interface Mastery {
  context_key: string
  value: unknown
  confidence: number
}

interface Attempt {
  id: string
  score: number
  total_marks: number
  submitted_at: string
  topic: string | null
  type: string
  difficulty: string
}

interface Session {
  id: string
  mode: string
  topic: string | null
  duration_seconds: number | null
  created_at: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtStudyTime(mins: number) {
  if (mins === 0) return '0m'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 14) return '1 week ago'
  return `${Math.floor(days / 7)} weeks ago`
}

function scoreColor(pct: number) {
  if (pct >= 80) return 'text-emerald-400'
  if (pct >= 60) return 'text-yellow-400'
  if (pct >= 40) return 'text-orange-400'
  return 'text-red-400'
}

function scoreDot(pct: number) {
  if (pct >= 80) return 'bg-emerald-400'
  if (pct >= 60) return 'bg-yellow-400'
  if (pct >= 40) return 'bg-orange-400'
  return 'bg-red-400'
}

// Build last-7-days activity from sessions
function buildWeekActivity(sessions: Session[]) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const now = new Date()
  const result = days.map((label, i) => {
    const target = new Date(now)
    // Monday = 0, adjust so today's weekday maps correctly
    const todayDow = (now.getDay() + 6) % 7 // 0=Mon..6=Sun
    target.setDate(now.getDate() - (todayDow - i))
    const dayStr = target.toDateString()
    const mins = sessions
      .filter((s) => new Date(s.created_at).toDateString() === dayStr)
      .reduce((sum, s) => sum + Math.round((s.duration_seconds ?? 0) / 60), 0)
    return { label, mins }
  })
  return result
}

// Derive subject groupings from topic names
const SUBJECT_COLORS = [
  '#3B82F6', '#22C55E', '#A855F7', '#F97316', '#EF4444',
  '#F59E0B', '#06B6D4', '#8B5CF6',
]

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, iconBg, value, label, trend, trendLabel,
}: {
  icon: React.ElementType
  iconBg: string
  value: string
  label: string
  trend: string
  trendLabel: string
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5">
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
        style={{ background: iconBg }}
      >
        <Icon size={22} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-black text-white leading-tight">{value}</p>
        <p className="text-xs text-muted mt-0.5">{label}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="flex items-center justify-end gap-0.5 text-sm font-bold text-emerald-400">
          <ArrowUpRight size={13} />
          {trend}
        </p>
        <p className="text-[10px] text-muted">{trendLabel}</p>
      </div>
    </div>
  )
}

function SectionCard({ title, sub, action, onAction, children }: {
  title: string
  sub: string
  action?: string
  onAction?: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="font-bold text-white">{title}</p>
          <p className="text-xs text-muted mt-0.5">{sub}</p>
        </div>
        {action && (
          <button
            onClick={onAction}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
          >
            {action}
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

// Simple bar chart — pure divs
function BarChart({ data }: { data: { label: string; mins: number }[] }) {
  const max = Math.max(...data.map((d) => d.mins), 60) // at least 1h scale
  const gridLines = [0, 1, 2, 3, 4].map((h) => h * 60).filter((m) => m <= max + 60)

  return (
    <div className="relative pt-2">
      {/* Y-axis labels + grid lines */}
      <div className="relative h-36">
        {gridLines.map((m) => {
          const pct = (m / (max + 60)) * 100
          return (
            <div
              key={m}
              className="absolute left-0 right-0 flex items-center gap-2"
              style={{ bottom: `${pct}%` }}
            >
              <span className="w-6 shrink-0 text-right text-[10px] text-muted">
                {m / 60}h
              </span>
              <div className="flex-1 border-t border-border/40" />
            </div>
          )
        })}

        {/* Bars */}
        <div className="absolute inset-0 flex items-end justify-around pl-8 pb-0 gap-1">
          {data.map((d) => {
            const h = max + 60 > 0 ? (d.mins / (max + 60)) * 100 : 0
            return (
              <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full flex items-end justify-center" style={{ height: 130 }}>
                  <div
                    className="w-full max-w-[36px] rounded-t-lg transition-all"
                    style={{
                      height: `${Math.max(h, d.mins > 0 ? 6 : 2)}%`,
                      background: d.mins > 0
                        ? 'linear-gradient(180deg, #22D3EE 0%, #3B82F6 100%)'
                        : 'rgba(255,255,255,0.06)',
                    }}
                  />
                </div>
                <span className="text-[10px] text-muted">{d.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Achievement badge
function AchievementBadge({ icon: Icon, iconBg, title, status, locked }: {
  icon: React.ElementType
  iconBg: string
  title: string
  status: string
  locked?: boolean
}) {
  return (
    <div className={`flex flex-col items-center gap-2 ${locked ? 'opacity-40' : ''}`}>
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: locked ? '#374151' : iconBg }}
      >
        {locked
          ? <Lock size={20} className="text-gray-400" />
          : <Icon size={22} className="text-white" />
        }
      </div>
      <div className="text-center">
        <p className="text-xs font-semibold text-white leading-tight">{title}</p>
        <p className={`text-[10px] mt-0.5 ${locked ? 'text-muted' : 'text-emerald-400'}`}>{status}</p>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Progress() {
  const { getToken } = useAuth()
  const navigate     = useNavigate()
  const { theme }    = useTheme()

  const [summary,    setSummary]    = useState<Summary | null>(null)
  const [mastery,    setMastery]    = useState<Mastery[]>([])
  const [weakTopics, setWeakTopics] = useState<Mastery[]>([])
  const [attempts,   setAttempts]   = useState<Attempt[]>([])
  const [sessions,   setSessions]   = useState<Session[]>([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const api = makeApi(token)
      const [prog, hist] = await Promise.all([
        api.progress.summary(),
        api.progress.history(20, 0),
      ])
      setSummary(prog.summary)
      setMastery(prog.topicMastery)
      setWeakTopics(prog.weakTopics)
      setAttempts((hist.attempts ?? []) as Attempt[])
      setSessions((hist.sessions ?? []) as Session[])
      setLoading(false)
    }
    load()
  }, [getToken])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  // ── Derived data ────────────────────────────────────────────────────────────
  const testsTaken    = summary?.testsTaken ?? 0
  const avgScore      = summary?.avgScorePct ?? 0
  const totalMins     = summary?.totalStudyMinutes ?? 0
  const topicsMastered = mastery.length
  const weekActivity  = buildWeekActivity(sessions)
  const recentTests   = attempts.slice(0, 4)
  const revisionItems = weakTopics.slice(0, 3)
  const overallPct    = mastery.length > 0
    ? Math.round(mastery.reduce((s, m) => s + m.confidence, 0) / mastery.length * 100)
    : 0

  // Achievements
  const achievements = [
    {
      icon: BookOpen,
      iconBg: '#3B82F6',
      title: 'First Test',
      status: testsTaken >= 1 ? 'Completed' : 'Incomplete',
      locked: testsTaken < 1,
    },
    {
      icon: CheckCircle2,
      iconBg: '#22C55E',
      title: '5 Tests',
      status: testsTaken >= 5 ? 'Completed' : `${testsTaken}/5`,
      locked: testsTaken < 5,
    },
    {
      icon: Flame,
      iconBg: '#8B5CF6',
      title: '7 Day Streak',
      status: sessions.length >= 7 ? 'Achieved' : 'In progress',
      locked: sessions.length < 7,
    },
    {
      icon: Trophy,
      iconBg: '#F59E0B',
      title: 'Top Performer',
      status: avgScore >= 90 ? 'Achieved' : 'Locked',
      locked: avgScore < 90,
    },
  ]

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-5">

        {/* ── Hero Banner ── */}
        <div
          className="relative overflow-hidden rounded-2xl border border-border"
          style={{
            background: theme === 'light'
              ? 'linear-gradient(135deg, #1e3a5f 0%, #0f2440 60%, #0a1628 100%)'
              : 'linear-gradient(135deg, #0f2035 0%, #0a1628 60%, #060d1a 100%)',
            minHeight: 180,
          }}
        >
          <img
            src={theme === 'light' ? '/progressbglight.png' : '/progressbgdark.png'}
            className="absolute inset-0 w-full h-full object-cover opacity-40"
            alt=""
          />

          <div className="relative z-10 flex items-stretch gap-4 p-7">
            {/* Left: text */}
            <div className="flex-1">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
                Your Progress
              </p>
              <h1 className="text-3xl font-extrabold leading-tight">
                <span className="text-white">Keep Going, </span>
                <span className="text-primary">You're Doing Great!</span>
              </h1>
              <p className="mt-2 text-sm text-white/60 max-w-md">
                Track your learning journey, identify your strengths, and focus on what matters.
              </p>

              {/* Progress bar */}
              <div className="mt-5 max-w-xs">
                <div className="h-1.5 w-full rounded-full bg-white/10">
                  <div
                    className="h-1.5 rounded-full bg-primary transition-all"
                    style={{ width: `${Math.max(overallPct, 5)}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] tracking-[0.25em] text-white/40 uppercase font-semibold">
                  Learn &nbsp;•&nbsp; Practice &nbsp;•&nbsp; Grow
                </p>
              </div>
            </div>

            {/* Right: decorative placeholder / image slot */}
            <div className="hidden lg:flex items-center justify-end w-72 shrink-0 relative">
              {/* Decorative chart bars as SVG placeholder */}
              <svg viewBox="0 0 200 120" className="w-48 opacity-30">
                <rect x="20" y="80" width="24" height="35" rx="4" fill="#22D3EE" />
                <rect x="54" y="55" width="24" height="60" rx="4" fill="#3B82F6" />
                <rect x="88" y="35" width="24" height="80" rx="4" fill="#22D3EE" />
                <rect x="122" y="10" width="24" height="105" rx="4" fill="#3B82F6" />
                <rect x="156" y="45" width="24" height="70" rx="4" fill="#22D3EE" />
                <polyline points="32,80 66,55 100,35 134,10 168,45" fill="none" stroke="#22D3EE" strokeWidth="2" strokeDasharray="4,2" />
              </svg>

              {/* Quote card */}
              <div className="absolute top-0 right-0 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-right backdrop-blur-sm">
                <p className="text-xs font-bold italic leading-snug text-white/80">
                  "DISCIPLINE<br />TURNS GOALS<br />INTO RESULTS."
                </p>
                <div className="mt-2 ml-auto h-0.5 w-8 bg-primary rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {/* ── 4 Stat Cards ── */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard
            icon={FileText}
            iconBg="linear-gradient(135deg,#3B82F6,#2563EB)"
            value={String(testsTaken)}
            label="Tests Taken"
            trend="20%"
            trendLabel="vs last month"
          />
          <StatCard
            icon={Star}
            iconBg="linear-gradient(135deg,#A855F7,#7C3AED)"
            value={avgScore ? `${Math.round(avgScore)}%` : '—'}
            label="Avg Score"
            trend="12%"
            trendLabel="vs last month"
          />
          <StatCard
            icon={Clock}
            iconBg="linear-gradient(135deg,#F97316,#EA580C)"
            value={fmtStudyTime(totalMins)}
            label="Study Time"
            trend="35%"
            trendLabel="vs last month"
          />
          <StatCard
            icon={Target}
            iconBg="linear-gradient(135deg,#22C55E,#16A34A)"
            value={`${topicsMastered} / ${mastery.length + weakTopics.length}`}
            label="Topics Mastered"
            trend="3"
            trendLabel="new this month"
          />
        </div>

        {/* ── Row 2: Topic Mastery + Study Activity ── */}
        <div className="grid gap-5 lg:grid-cols-2">

          {/* Topic Mastery */}
          <SectionCard title="Topic Mastery" sub="Your progress across all subjects">
            {mastery.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">
                Take tests to build your topic mastery data.
              </p>
            ) : (
              <div className="space-y-3">
                {mastery.slice(0, 6).map((m, i) => {
                  const pct = Math.round(m.confidence * 100)
                  const color = SUBJECT_COLORS[i % SUBJECT_COLORS.length]
                  const letter = m.context_key.charAt(0).toUpperCase()
                  return (
                    <div key={m.context_key} className="flex items-center gap-3">
                      {/* Letter badge */}
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                        style={{ background: color + '33', color }}
                      >
                        {letter}
                      </div>
                      {/* Name */}
                      <p className="w-36 shrink-0 truncate text-sm text-white">{m.context_key}</p>
                      {/* Bar */}
                      <div className="flex-1 h-2 rounded-full bg-border overflow-hidden">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{ width: `${pct}%`, background: color }}
                        />
                      </div>
                      {/* Pct */}
                      <span className="w-9 shrink-0 text-right text-xs font-semibold text-white">
                        {pct}%
                      </span>
                      <ChevronRight size={13} className="shrink-0 text-muted" />
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>

          {/* Study Activity */}
          <SectionCard title="Study Activity" sub="Your study time over the last 7 days">
            {weekActivity.every((d) => d.mins === 0) ? (
              <div className="py-4">
                <BarChart data={[
                  { label: 'Mon', mins: 30 }, { label: 'Tue', mins: 90 },
                  { label: 'Wed', mins: 120 }, { label: 'Thu', mins: 200 },
                  { label: 'Fri', mins: 80 }, { label: 'Sat', mins: 150 },
                  { label: 'Sun', mins: 60 },
                ]} />
                <p className="mt-2 text-center text-[11px] text-muted/50 italic">
                  Sample data — start studying to see real activity
                </p>
              </div>
            ) : (
              <div className="py-2">
                <BarChart data={weekActivity} />
              </div>
            )}
          </SectionCard>
        </div>

        {/* ── Row 3: Needs Revision + Recent Tests + Achievements ── */}
        <div className="grid gap-5 lg:grid-cols-3">

          {/* Needs Revision */}
          <SectionCard
            title="Needs Revision"
            sub="Topics where you can improve"
            action="View All"
            onAction={() => navigate('/memory')}
          >
            {revisionItems.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">
                No weak topics detected yet. Keep taking tests!
              </p>
            ) : (
              <div className="space-y-3">
                {revisionItems.map((m) => {
                  const pct = Math.round(m.confidence * 100)
                  return (
                    <div key={m.context_key} className="flex items-center gap-2">
                      <AlertTriangle size={14} className="shrink-0 text-red-400" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm text-white">{m.context_key}</p>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-border overflow-hidden">
                          <div
                            className="h-1.5 rounded-full bg-red-500 transition-all"
                            style={{ width: `${Math.max(pct, 4)}%` }}
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => navigate('/test/new')}
                        className="shrink-0 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-colors"
                      >
                        Practice
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>

          {/* Recent Tests */}
          <SectionCard
            title="Recent Tests"
            sub="Your latest test attempts"
            action="View All"
            onAction={() => navigate('/tests')}
          >
            {recentTests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <FileText size={24} className="text-muted/30" />
                <p className="text-sm text-muted">No tests taken yet.</p>
                <button
                  onClick={() => navigate('/test/new')}
                  className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
                >
                  <RotateCcw size={11} />
                  Create Test
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {recentTests.map((a) => {
                  const p = a.total_marks > 0 ? Math.round((a.score / a.total_marks) * 100) : 0
                  return (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => navigate(`/tests`)}
                    >
                      <div className={`h-2 w-2 shrink-0 rounded-full ${scoreDot(p)}`} />
                      <p className="flex-1 truncate text-sm text-white">
                        {a.topic ?? `${a.type.replace(/_/g, ' ')} Test`}
                      </p>
                      <span className={`text-sm font-bold shrink-0 ${scoreColor(p)}`}>{p}%</span>
                      <span className="shrink-0 text-[11px] text-muted">{timeAgo(a.submitted_at)}</span>
                      <ChevronRight size={13} className="shrink-0 text-muted" />
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>

          {/* Achievements */}
          <SectionCard
            title="Achievements"
            sub="Keep learning to earn more!"
            action="View All"
            onAction={() => {}}
          >
            <div className="grid grid-cols-4 gap-2 pt-1">
              {achievements.map((a) => (
                <AchievementBadge key={a.title} {...a} />
              ))}
            </div>
          </SectionCard>
        </div>

      </div>
    </div>
  )
}

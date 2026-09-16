/**
 * Progress — full analytics dashboard.
 * Data: progress.summary + progress.history + topicMastery + weakTopics
 */

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../lib/theme.tsx'
import {
  FileText, Star, Clock, Target, ChevronRight,
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

function scoreColorValue(pct: number, theme: string) {
  const light = theme === 'light'
  if (pct >= 80) return light ? '#059669' : '#34d399'
  if (pct >= 60) return light ? '#d97706' : '#facc15'
  if (pct >= 40) return light ? '#ea580c' : '#fb923c'
  return light ? '#dc2626' : '#f87171'
}

function scoreDotColor(pct: number, theme: string) {
  return scoreColorValue(pct, theme)
}

// Check if sessions include N consecutive calendar days
function hasConsecutiveStreak(sessions: Session[], days: number): boolean {
  const uniqueDays = [...new Set(sessions.map((s) => new Date(s.created_at).toDateString()))]
    .map((d) => new Date(d).getTime())
    .sort((a, b) => b - a) // newest first
  if (uniqueDays.length < days) return false
  let streak = 1
  for (let i = 1; i < uniqueDays.length; i++) {
    const diff = Math.round((uniqueDays[i - 1] - uniqueDays[i]) / 86400000)
    if (diff === 1) { streak++; if (streak >= days) return true }
    else streak = 1
  }
  return streak >= days
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
  icon: Icon, iconBg, iconColor, value, label, trend, trendLabel, theme,
}: {
  icon: React.ElementType
  iconBg: string
  iconColor: string
  value: string
  label: string
  trend: string
  trendLabel: string
  theme: string
}) {
  const isLight = theme === 'light'
  return (
    <div
      className="flex items-center gap-2.5 rounded-xl p-3"
      style={{
        background: isLight ? '#fff' : 'rgb(var(--color-surface))',
        border: isLight ? `1px solid ${iconColor}40` : '1px solid rgb(var(--color-border))',
        borderLeft: isLight ? `4px solid ${iconColor}` : undefined,
        boxShadow: isLight ? `0 2px 8px ${iconColor}18` : undefined,
      }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ background: isLight ? `${iconColor}18` : iconBg }}
      >
        <Icon size={16} style={{ color: isLight ? iconColor : '#fff' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-base font-black leading-tight" style={{ color: isLight ? '#0f172a' : '#fff' }}>{value}</p>
        <p className="text-xs mt-0.5 truncate" style={{ color: isLight ? '#64748b' : 'rgb(var(--color-muted))' }}>{label}</p>
      </div>
      <div className="text-right shrink-0 hidden sm:block">
        <p className="flex items-center justify-end gap-0.5 text-xs font-bold" style={{ color: isLight ? '#16a34a' : '#34d399' }}>
          <ArrowUpRight size={11} />
          {trend}
        </p>
        <p className="text-[10px]" style={{ color: isLight ? '#94a3b8' : 'rgb(var(--color-muted))' }}>{trendLabel}</p>
      </div>
    </div>
  )
}

function SectionCard({ title, sub, action, onAction, children, theme }: {
  title: string
  sub: string
  action?: string
  onAction?: () => void
  children: React.ReactNode
  theme: string
}) {
  const isLight = theme === 'light'
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: isLight ? '#ffffff' : 'rgb(var(--color-surface))',
        border: isLight ? '1px solid #e2e8f0' : '1px solid rgb(var(--color-border))',
        boxShadow: isLight ? '0 1px 4px rgba(0,0,0,0.06)' : undefined,
      }}
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="font-bold" style={{ color: isLight ? '#0f172a' : '#fff' }}>{title}</p>
          <p className="text-xs mt-0.5" style={{ color: isLight ? '#64748b' : 'rgb(var(--color-muted))' }}>{sub}</p>
        </div>
        {action && (
          <button
            onClick={onAction}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{
              border: `1px solid ${isLight ? '#cbd5e1' : 'rgb(var(--color-border))'}`,
              color: isLight ? '#0891b2' : 'rgb(var(--color-primary))',
              background: 'transparent',
            }}
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
function BarChart({ data, theme }: { data: { label: string; mins: number }[]; theme: string }) {
  const max = Math.max(...data.map((d) => d.mins), 60) // at least 1h scale
  const gridLines = [0, 1, 2, 3, 4].map((h) => h * 60).filter((m) => m <= max + 60)
  const isLight = theme === 'light'
  const barGradient = isLight
    ? 'linear-gradient(180deg, #0891B2 0%, #2563EB 100%)'
    : 'linear-gradient(180deg, #22D3EE 0%, #3B82F6 100%)'
  const emptyBar = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'

  return (
    <div className="relative pt-2">
      {/* Y-axis labels + grid lines */}
      <div className="relative h-40">
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
                <div className="w-full flex items-end justify-center" style={{ height: 100 }}>
                  <div
                    className="w-full max-w-[36px] rounded-t-lg transition-all"
                    style={{
                      height: `${Math.max(h, d.mins > 0 ? 6 : 2)}%`,
                      background: d.mins > 0 ? barGradient : emptyBar,
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
function AchievementBadge({ icon: Icon, iconBg, title, status, locked, theme }: {
  icon: React.ElementType
  iconBg: string
  title: string
  status: string
  locked?: boolean
  theme: string
}) {
  const lockedBg = theme === 'light' ? '#E5E7EB' : '#374151'
  const lockColor = theme === 'light' ? '#9CA3AF' : '#6B7280'
  return (
    <div className={`flex flex-col items-center gap-1.5 w-full ${locked ? 'opacity-60' : ''}`}>
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: locked ? lockedBg : iconBg }}
      >
        {locked
          ? <Lock size={15} style={{ color: lockColor }} />
          : <Icon size={17} className="text-white" />
        }
      </div>
      <div className="text-center w-full">
        <p className="text-[11px] font-semibold leading-tight break-words" style={{ color: theme === 'light' ? '#1e293b' : '#fff' }}>{title}</p>
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
      title: '7-Day Streak',
      status: hasConsecutiveStreak(sessions, 7) ? 'Achieved' : 'In progress',
      locked: !hasConsecutiveStreak(sessions, 7),
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
      <div className="p-4 space-y-4">

        {/* ── Hero Banner ── */}
        <div
          className="relative overflow-hidden rounded-2xl border border-border"
          style={{
            background: theme === 'light'
              ? 'linear-gradient(135deg, #e8f4ff 0%, #dbeafe 60%, #eff6ff 100%)'
              : 'linear-gradient(135deg, #0f2035 0%, #0a1628 60%, #060d1a 100%)',
            minHeight: 130,
          }}
        >
          <img
            src={`${import.meta.env.BASE_URL}${theme === 'light' ? 'progressbglight.png' : 'progressbgdark.png'}`}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: theme === 'light' ? 0.35 : 0.5 }}
            alt=""
          />
          {/* light-mode tint overlay so text stays readable */}
          {theme === 'light' && (
            <div className="absolute inset-0 bg-white/40" />
          )}

          <div className="relative z-10 flex items-stretch gap-4 p-4">
            {/* Left: text */}
            <div className="flex-1">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                Your Progress
              </p>
              <h1 className="text-lg lg:text-xl font-extrabold leading-tight">
                <span className={theme === 'light' ? 'text-gray-800' : 'text-white'}>Keep Going, </span>
                <span className="text-primary">You're Doing Great!</span>
              </h1>
              <p className={`mt-1 text-xs max-w-md hidden sm:block ${theme === 'light' ? 'text-gray-600' : 'text-white/60'}`}>
                Track your learning journey, identify your strengths, and focus on what matters.
              </p>

              {/* Progress bar */}
              <div className="mt-3 max-w-xs">
                <div className={`h-1 w-full rounded-full ${theme === 'light' ? 'bg-gray-300' : 'bg-white/10'}`}>
                  <div
                    className="h-1 rounded-full bg-primary transition-all"
                    style={{ width: `${Math.max(overallPct, 5)}%` }}
                  />
                </div>
                <p className={`mt-1.5 text-[10px] tracking-[0.25em] uppercase font-semibold ${theme === 'light' ? 'text-gray-400' : 'text-white/40'}`}>
                  Learn &nbsp;•&nbsp; Practice &nbsp;•&nbsp; Grow
                </p>
              </div>
            </div>

            {/* Right: decorative placeholder / image slot */}
            <div className="hidden md:flex items-center justify-end w-56 shrink-0 relative">
              {/* Decorative chart bars as SVG placeholder */}
              <svg viewBox="0 0 200 120" className="w-36 opacity-20">
                <rect x="20" y="80" width="24" height="35" rx="4" fill="#22D3EE" />
                <rect x="54" y="55" width="24" height="60" rx="4" fill="#3B82F6" />
                <rect x="88" y="35" width="24" height="80" rx="4" fill="#22D3EE" />
                <rect x="122" y="10" width="24" height="105" rx="4" fill="#3B82F6" />
                <rect x="156" y="45" width="24" height="70" rx="4" fill="#22D3EE" />
                <polyline points="32,80 66,55 100,35 134,10 168,45" fill="none" stroke="#22D3EE" strokeWidth="2" strokeDasharray="4,2" />
              </svg>

              {/* Quote card */}
              <div className={`absolute top-0 right-0 rounded-xl border px-3 py-2 text-right backdrop-blur-sm ${theme === 'light' ? 'border-gray-200 bg-white/70' : 'border-white/10 bg-white/5'}`}>
                <p className={`text-[10px] font-bold italic leading-snug ${theme === 'light' ? 'text-gray-700' : 'text-white/80'}`}>
                  "DISCIPLINE<br />TURNS GOALS<br />INTO RESULTS."
                </p>
                <div className="mt-1.5 ml-auto h-0.5 w-6 bg-primary rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {/* ── 4 Stat Cards ── */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            icon={FileText}
            iconBg="linear-gradient(135deg,#3B82F6,#2563EB)" iconColor="#3B82F6"
            value={String(testsTaken)} label="Tests Taken"
            trend="20%" trendLabel="vs last month" theme={theme}
          />
          <StatCard
            icon={Star}
            iconBg="linear-gradient(135deg,#A855F7,#7C3AED)" iconColor="#A855F7"
            value={avgScore ? `${Math.round(avgScore)}%` : '—'} label="Avg Score"
            trend="12%" trendLabel="vs last month" theme={theme}
          />
          <StatCard
            icon={Clock}
            iconBg="linear-gradient(135deg,#F97316,#EA580C)" iconColor="#F97316"
            value={fmtStudyTime(totalMins)} label="Study Time"
            trend="35%" trendLabel="vs last month" theme={theme}
          />
          <StatCard
            icon={Target}
            iconBg="linear-gradient(135deg,#22C55E,#16A34A)" iconColor="#22C55E"
            value={`${topicsMastered} / ${mastery.length + weakTopics.length}`} label="Topics Mastered"
            trend="3" trendLabel="new this month" theme={theme}
          />
        </div>

        {/* ── Row 2: Topic Mastery + Study Activity ── */}
        <div className="grid gap-3 md:grid-cols-2">

          {/* Topic Mastery */}
          <SectionCard theme={theme} title="Topic Mastery" sub="Your progress across all subjects">
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
                  const isLight = theme === 'light'
                  const trackBg = isLight ? '#e2e8f0' : 'rgb(var(--color-border))'
                  const textColor = isLight ? '#1e293b' : '#fff'
                  return (
                    <div key={m.context_key} className="flex items-center gap-3">
                      {/* Letter badge */}
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                        style={{ background: color + (isLight ? '22' : '33'), color }}
                      >
                        {letter}
                      </div>
                      {/* Name */}
                      <p className="w-24 sm:w-28 lg:w-36 shrink-0 truncate text-sm" style={{ color: textColor }}>{m.context_key}</p>
                      {/* Bar */}
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: trackBg }}>
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{ width: `${pct}%`, background: color }}
                        />
                      </div>
                      {/* Pct */}
                      <span className="w-9 shrink-0 text-right text-xs font-semibold" style={{ color: textColor }}>
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
          <SectionCard theme={theme} title="Study Activity" sub="Your study time over the last 7 days">
            {weekActivity.every((d) => d.mins === 0) ? (
              <div className="py-4">
                <BarChart data={[
                  { label: 'Mon', mins: 30 }, { label: 'Tue', mins: 90 },
                  { label: 'Wed', mins: 120 }, { label: 'Thu', mins: 200 },
                  { label: 'Fri', mins: 80 }, { label: 'Sat', mins: 150 },
                  { label: 'Sun', mins: 60 },
                ]} theme={theme} />
                <p className="mt-2 text-center text-xs text-muted/60 italic">
                  Sample data — start studying to see real activity
                </p>
              </div>
            ) : (
              <div className="py-2">
                <BarChart data={weekActivity} theme={theme} />
              </div>
            )}
          </SectionCard>
        </div>

        {/* ── Row 3: Needs Revision + Recent Tests + Achievements ── */}
        <div className="grid gap-3 md:grid-cols-3">

          {/* Needs Revision */}
          <SectionCard
            theme={theme}
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
                  const redColor = theme === 'light' ? '#dc2626' : '#f87171'
                  const barBg = theme === 'light' ? '#e2e8f0' : 'rgb(var(--color-border))'
                  return (
                    <div key={m.context_key} className="flex items-center gap-2">
                      <AlertTriangle size={14} className="shrink-0" style={{ color: redColor }} />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm" style={{ color: theme === 'light' ? '#1e293b' : '#fff' }}>{m.context_key}</p>
                        <div className="mt-1 h-1.5 w-full rounded-full overflow-hidden" style={{ background: barBg }}>
                          <div
                            className="h-1.5 rounded-full transition-all"
                            style={{ width: `${Math.max(pct, 4)}%`, background: redColor }}
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(`/test/new?topic=${encodeURIComponent(m.context_key)}`)}
                        className="shrink-0 rounded-lg px-3 py-1 text-[11px] font-semibold transition-colors"
                        style={{
                          border: `1px solid ${theme === 'light' ? '#bfdbfe' : 'rgba(8,145,178,0.3)'}`,
                          background: theme === 'light' ? '#eff6ff' : 'rgba(8,145,178,0.1)',
                          color: theme === 'light' ? '#1d4ed8' : 'rgb(var(--color-primary))',
                        }}
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
            theme={theme}
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
                      <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: scoreDotColor(p, theme) }} />
                      <p className="flex-1 truncate text-sm text-white">
                        {a.topic ?? `${a.type.replace(/_/g, ' ')} Test`}
                      </p>
                      <span className="text-sm font-bold shrink-0" style={{ color: scoreColorValue(p, theme) }}>{p}%</span>
                      <span className="shrink-0 text-[11px] text-muted hidden sm:inline">{timeAgo(a.submitted_at)}</span>
                      <ChevronRight size={13} className="shrink-0 text-muted" />
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>

          {/* Achievements */}
          <SectionCard
            theme={theme}
            title="Achievements"
            sub="Keep learning to earn more!"
            action="View All"
            onAction={() => {}}
          >
            <div className="grid grid-cols-4 gap-2 pt-1">
              {achievements.map((a) => (
                <AchievementBadge key={a.title} {...a} theme={theme} />
              ))}
            </div>
          </SectionCard>
        </div>

      </div>
    </div>
  )
}

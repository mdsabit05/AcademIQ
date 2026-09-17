import { useEffect, useRef, useState } from 'react'
import heroBgUrl from '../assets/hero-bg.png'
import lightLandingUrl from '../assets/lightLanding.png'
import { useNavigate } from 'react-router-dom'
import { useAuth, useUser } from '@clerk/clerk-react'
import { useTheme } from '../lib/theme.tsx'
import {
  FileText,
  ArrowRight,
  BookOpen,
  CheckCircle,
  ChevronRight,
  Sparkles,
  Calendar,
  Plus,
  Trash2,
} from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import type { Book, Syllabus, PlanTask } from 'shared'

// ── Helpers ────────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Good Night'
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  return 'Good Evening'
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${Math.max(1, mins)}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface TopicMastery {
  context_key: string
  value: unknown
  confidence: number
}

interface HistoryAttempt {
  id: string
  score: number
  total_marks: number
  topic: string | null
  type: string
  submitted_at: string
}

interface HistorySession {
  id: string
  mode: string
  created_at: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const PALETTE = ['#22C55E', '#A855F7', '#F97316', '#EF4444', '#22D3EE', '#6366F1']

const ACTION_CARDS = [
  {
    icon: BookOpen,
    label: 'Upload Book',
    sub: 'Add PDF & start learning',
    to: '/books',
    color: '#22C55E',
  },
  {
    icon: Sparkles,
    label: 'AI Tutor',
    sub: 'Get instant, accurate answers',
    to: '/tutor',
    color: '#22D3EE',
  },
  {
    icon: FileText,
    label: 'Take a Test',
    sub: 'Practice & evaluate',
    to: '/test/new',
    color: '#EF4444',
  },
  {
    icon: Calendar,
    label: 'Study Plan',
    sub: 'Plan your learning journey',
    to: '/study-plan',
    color: '#F59E0B',
  },
]

// ── ProgressBar ───────────────────────────────────────────────────────────────

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex-1 h-1.5 bg-bg rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: color }}
      />
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-border rounded ${className ?? ''}`} />
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const navigate = useNavigate()
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const [books, setBooks] = useState<Book[]>([])
  const [syllabi, setSyllabi] = useState<Syllabus[]>([])
  const [topicMastery, setTopicMastery] = useState<TopicMastery[]>([])
  const [attempts, setAttempts] = useState<HistoryAttempt[]>([])
  const [sessions, setSessions] = useState<HistorySession[]>([])
  const [loading, setLoading] = useState(true)

  // Todo list state
  const [tasks, setTasks] = useState<PlanTask[]>([])
  const [todoInput, setTodoInput] = useState('')
  const [addingTodo, setAddingTodo] = useState(false)
  const todoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const api = makeApi(token)
      try {
        const [booksRes, syllabiRes, progressRes, historyRes, tasksRes] = await Promise.all([
          api.books.list(undefined, 'student'),
          api.syllabus.list(),
          api.progress.summary(),
          api.progress.history(6, 0),
          api.studyplan.listTasks(),
        ])
        setBooks(booksRes.books.filter((b) => b.status === 'READY'))
        setSyllabi(syllabiRes.syllabi.filter((s) => s.status === 'ready'))
        setTopicMastery(progressRes.topicMastery)
        setAttempts(historyRes.attempts as HistoryAttempt[])
        setSessions(historyRes.sessions as HistorySession[])
        setTasks(tasksRes.tasks)
      } catch (err) {
        console.error('[dashboard] load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load().catch(console.error)
  }, [getToken])

  async function handleAddTodo() {
    const text = todoInput.trim()
    if (!text) return
    setTodoInput('')
    const token = await getToken()
    if (!token) return
    const { task } = await makeApi(token).studyplan.addTask({ text })
    setTasks((prev) => [task, ...prev])
  }

  async function handleToggleTodo(id: string, completed: boolean) {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, completed } : t))
    const token = await getToken()
    if (!token) return
    await makeApi(token).studyplan.toggleTask(id, completed)
  }

  async function handleDeleteTodo(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    const token = await getToken()
    if (!token) return
    await makeApi(token).studyplan.deleteTask(id)
  }

  // Derived values
  const firstName = user?.firstName ?? user?.fullName?.split(' ')[0] ?? ''
  const latestBook = books[0]

  const overallPct =
    topicMastery.length > 0
      ? Math.round(
          (topicMastery.reduce((s, t) => s + t.confidence, 0) / topicMastery.length) * 100,
        )
      : 0

  const displayTopics = topicMastery.slice(0, 4)


  return (
    <div className="space-y-3 min-h-full pb-6">

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-none lg:rounded-2xl">
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: `url(${isLight ? lightLandingUrl : heroBgUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center right',
          backgroundRepeat: 'no-repeat',
          opacity: 0.9,
        }} />
        <div className="absolute inset-0 pointer-events-none" style={{
          background: isLight
            ? 'linear-gradient(to right, rgba(243,247,251,0.97) 0%, rgba(243,247,251,0.92) 30%, rgba(243,247,251,0.65) 50%, rgba(243,247,251,0.15) 72%, rgba(243,247,251,0.0) 88%)'
            : 'linear-gradient(to right, rgba(8,12,20,0.97) 0%, rgba(8,12,20,0.92) 30%, rgba(8,12,20,0.65) 50%, rgba(8,12,20,0.15) 72%, rgba(8,12,20,0.0) 88%)',
        }} />
        <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{
          height: '28%',
          background: isLight
            ? 'linear-gradient(to top, rgba(243,247,251,0.85) 0%, transparent 100%)'
            : 'linear-gradient(to top, rgba(8,12,20,0.85) 0%, transparent 100%)',
        }} />

        <div className="relative flex items-center justify-between gap-8 px-4 lg:px-8 pt-6 lg:pt-10 pb-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted mb-1.5">
              {greeting()}{firstName ? `, ${firstName} 👋` : ''}
            </p>
            <h1 className="text-3xl lg:text-4xl xl:text-5xl font-black leading-tight mb-2 lg:mb-3 tracking-tight" style={{ color: isLight ? '#1e293b' : '#fff' }}>
              Learn Today.<br />
              Build{' '}
              <span className="text-primary" style={{ textShadow: '0 0 40px rgba(34,211,238,0.4)' }}>
                Tomorrow.
              </span>
            </h1>
            <p className="text-xs lg:text-sm text-muted leading-relaxed max-w-md">
              Your AI-powered study companion. Turn your books into knowledge,
              practice with real tests, and track your progress — all in one place.
            </p>
          </div>

          <div className="hidden md:block absolute" style={{ left: '42%', top: '50%', transform: 'translateY(-50%)' }}>
            <p style={{
              fontFamily: 'monospace', fontSize: 12, textTransform: 'uppercase',
              letterSpacing: '0.1em', color: isLight ? 'rgba(15,23,42,0.78)' : 'rgba(255,255,255,0.72)',
              lineHeight: 2, textShadow: isLight ? 'none' : '0 2px 12px rgba(0,0,0,0.8)',
            }}>
              "DISCIPLINE<br />TURNS KNOWLEDGE<br />INTO FREEDOM."
            </p>
            <div style={{ width: 26, height: 2, background: '#22D3EE', borderRadius: 1, marginTop: 10, boxShadow: '0 0 8px rgba(34,211,238,0.53)' }} />
          </div>
        </div>
      </div>

      {/* ── Action Cards ──────────────────────────────────────────────────────── */}
      <div className="px-3 lg:px-6 grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3">
        {ACTION_CARDS.map(({ icon: Icon, label, sub, to, color }) => (
          <button
            key={label}
            onClick={() => navigate(to)}
            className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 text-left transition-all duration-200 hover:bg-white/5"
            style={{ '--c': color } as React.CSSProperties}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
              style={{ backgroundColor: `${color}22` }}
            >
              <Icon size={19} style={{ color }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">{label}</p>
              <p className="text-xs text-muted truncate mt-0.5">{sub}</p>
            </div>
            <ArrowRight
              size={15}
              className="text-muted shrink-0 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
            />
          </button>
        ))}
      </div>

      {/* ── Middle Row: Learning Progress + Continue Learning ─────────────────── */}
      <div className="px-3 lg:px-6 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4">

        {/* Learning Progress */}
        <div className="md:col-span-7 rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Your Learning Progress</h2>
            <span className="text-xs text-muted bg-bg border border-border rounded-lg px-3 py-1 select-none">
              All Subjects
            </span>
          </div>

          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-2" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-3 w-36" />
                  <Skeleton className="h-1.5 flex-1" />
                  <Skeleton className="h-3 w-8" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="mb-1 flex items-end gap-3">
                <span
                  className="text-4xl font-black"
                  style={{ color: '#22D3EE' }}
                >
                  {overallPct}%
                </span>
                <span className="text-xs text-muted mb-1.5">overall mastery</span>
              </div>

              {/* Overall gradient bar */}
              <div className="mb-5 h-2 bg-bg rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${overallPct}%`,
                    background: 'linear-gradient(to right, #22D3EE, #06B6D4)',
                  }}
                />
              </div>

              {displayTopics.length > 0 ? (
                <div className="space-y-3">
                  {displayTopics.map((topic, i) => {
                    const pct = Math.round(topic.confidence * 100)
                    const color = PALETTE[i % PALETTE.length]
                    const label = String(topic.context_key)
                      .replace(/[_-]/g, ' ')
                      .replace(/\b\w/g, (c) => c.toUpperCase())
                    return (
                      <div key={topic.context_key} className="flex items-center gap-3">
                        <span className="text-sm text-muted w-44 truncate shrink-0">{label}</span>
                        <ProgressBar pct={pct} color={color} />
                        <span
                          className="text-sm font-semibold w-10 text-right shrink-0"
                          style={{ color }}
                        >
                          {pct}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted text-center py-6">
                  Start studying to track your mastery
                </p>
              )}
            </>
          )}
        </div>

        {/* Continue Learning */}
        <div className="md:col-span-5 rounded-xl border border-border bg-surface p-5 flex flex-col min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Continue Learning</h2>
            <button
              onClick={() => navigate('/books')}
              className="text-xs text-primary hover:underline"
            >
              Open Book
            </button>
          </div>

          {loading ? (
            <div className="flex-1 space-y-4">
              <div className="flex gap-4">
                <Skeleton className="w-20 h-24 shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-1.5 mt-4" />
                </div>
              </div>
              <Skeleton className="h-10" />
            </div>
          ) : latestBook ? (
            <div className="flex-1 flex flex-col">
              <div className="flex gap-4 mb-5 min-w-0">
                {/* Book cover */}
                <div
                  className="w-20 h-24 rounded-lg flex items-center justify-center shrink-0 relative overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, #0e7490 0%, #164e63 100%)' }}
                >
                  <BookOpen size={28} className="text-white/70" />
                  {/* Spine line */}
                  <div className="absolute left-3 top-2 bottom-2 w-px bg-white/10" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-white text-sm leading-tight mb-1 break-all line-clamp-2">
                    {latestBook.title}
                  </h3>
                  {latestBook.author && (
                    <p className="text-xs text-muted mb-3">{latestBook.author}</p>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold mt-1" style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.3)' }}>
                    <CheckCircle size={9} /> READY
                  </span>
                </div>
              </div>

              <button
                onClick={() => navigate(`/tutor?bookId=${latestBook.id}`)}
                className="mt-auto w-full flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-hover transition-colors"
              >
                Start Studying <ArrowRight size={15} />
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <BookOpen size={22} className="text-primary" />
              </div>
              <p className="text-sm text-muted mb-3">No books uploaded yet</p>
              <button
                onClick={() => navigate('/books')}
                className="text-sm font-medium text-primary hover:underline"
              >
                Upload your first PDF →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Row: Tests + Subjects + Activity ────────────────────────────── */}
      <div className="px-3 lg:px-6 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">

        {/* Recent Tests */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Recent Tests</h2>
            <button
              onClick={() => navigate('/progress')}
              className="text-xs text-primary hover:underline"
            >
              View All
            </button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : attempts.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted mb-2">No tests taken yet</p>
              <button
                onClick={() => navigate('/test/new')}
                className="text-xs text-primary hover:underline"
              >
                Generate your first test →
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {attempts.slice(0, 3).map((a, i) => {
                const pct = a.total_marks > 0 ? Math.round((a.score / a.total_marks) * 100) : 0
                const color = PALETTE[i % PALETTE.length]
                return (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${color}20` }}
                    >
                      <FileText size={14} style={{ color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">
                        {a.topic ?? a.type.replace('_', ' ')}
                      </p>
                      <p className="text-xs text-muted">{timeAgo(a.submitted_at)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-white">
                        {a.score}/{a.total_marks}
                      </p>
                      <p className="text-xs font-medium" style={{ color }}>{pct}%</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Your Syllabi */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Your Syllabi</h2>
            <button
              onClick={() => navigate('/syllabus')}
              className="text-xs text-primary hover:underline"
            >
              Manage
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-7 h-7 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-1" />
                  </div>
                </div>
              ))}
            </div>
          ) : syllabi.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted mb-2">No syllabi yet</p>
              <button
                onClick={() => navigate('/syllabus')}
                className="text-xs text-primary hover:underline"
              >
                Upload your first syllabus →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {syllabi.slice(0, 4).map((s, i) => {
                const color = PALETTE[i % PALETTE.length]

                // Match topicMastery using all significant words (>2 chars) from syllabus title
                const words = s.title.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
                const masteryMatched = topicMastery.filter((t) =>
                  words.some((w) => String(t.context_key).toLowerCase().includes(w)),
                )
                const masteryPct =
                  masteryMatched.length > 0
                    ? Math.round(
                        (masteryMatched.reduce((sum, t) => sum + t.confidence, 0) / masteryMatched.length) * 100,
                      )
                    : null

                // Fall back to test attempt scores
                const syllabiAttempts = attempts.filter((a) =>
                  a.total_marks > 0 &&
                  words.some((w) => (a.topic ?? '').toLowerCase().includes(w)),
                )
                const attemptPct =
                  syllabiAttempts.length > 0
                    ? Math.round(
                        (syllabiAttempts.reduce((sum, a) => sum + a.score / a.total_marks, 0) /
                          syllabiAttempts.length) * 100,
                      )
                    : null

                // Syllabus completion: use topic_count if available
                const sTyped = s as Syllabus & { completed_count?: number; topic_count?: number }
                const topicBased = sTyped.completed_count != null && sTyped.topic_count
                  ? Math.round((sTyped.completed_count! / sTyped.topic_count!) * 100)
                  : null
                const completionPct = topicBased ?? masteryPct ?? attemptPct ?? 0
                const hasData = topicBased !== null || masteryPct !== null || attemptPct !== null

                return (
                  <button
                    key={s.id}
                    onClick={() => navigate('/syllabus', { state: { syllabusId: s.id } })}
                    className="w-full flex items-center gap-3 group text-left"
                  >
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${color}20` }}
                    >
                      <BookOpen size={13} style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-white truncate block">{s.title}</span>
                        <span className="text-xs font-semibold ml-2 shrink-0" style={{ color: hasData ? color : 'var(--color-muted)' }}>
                          {hasData ? `${completionPct}%` : '—'}
                        </span>
                      </div>
                      {hasData
                        ? <ProgressBar pct={completionPct} color={color} />
                        : <div className="flex-1 h-1.5 rounded-full border border-dashed border-border/60" />
                      }
                    </div>
                    <ChevronRight size={13} className="text-muted/40 group-hover:text-muted transition-colors shrink-0" />
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* To-Do List */}
        <div className="rounded-xl border border-border bg-surface p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">To-Do List</h2>
            <button
              onClick={() => navigate('/study-plan')}
              className="text-xs text-primary hover:underline"
            >
              View All
            </button>
          </div>

          {/* Add task input */}
          <div className="flex gap-2 mb-4">
            <input
              ref={todoInputRef}
              value={todoInput}
              onChange={(e) => setTodoInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
              placeholder="Add a task…"
              className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white placeholder:text-muted/50 focus:outline-none focus:border-primary transition-colors"
            />
            <button
              onClick={handleAddTodo}
              disabled={addingTodo || !todoInput.trim()}
              className="rounded-lg bg-primary/10 border border-primary/30 text-primary px-3 py-2 hover:bg-primary/20 transition-colors disabled:opacity-40"
            >
              <Plus size={15} />
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 items-center">
                  <Skeleton className="w-4 h-4 shrink-0 rounded" />
                  <Skeleton className="h-3 flex-1" />
                </div>
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="py-6 text-center flex-1">
              <CheckCircle size={24} className="mx-auto mb-2 text-muted/30" />
              <p className="text-sm text-muted">No tasks yet</p>
              <p className="text-xs text-muted/60 mt-0.5">Add something to get started</p>
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-64 pr-1">
              {tasks.slice(0, 10).map((task) => (
                <div key={task.id} className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/[0.03] transition-colors">
                  <button
                    onClick={() => handleToggleTodo(task.id, !task.completed)}
                    className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
                      task.completed
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'border-border hover:border-primary'
                    }`}
                  >
                    {task.completed && <CheckCircle size={10} className="text-white" />}
                  </button>
                  <span className={`flex-1 text-sm leading-snug ${task.completed ? 'line-through text-muted/50' : 'text-white'}`}>
                    {task.text}
                  </span>
                  <button
                    onClick={() => handleDeleteTodo(task.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

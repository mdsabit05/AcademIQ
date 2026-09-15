import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import {
  Plus, X, Trash2, Calendar, Target, CheckCircle2,
  Loader2,
} from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import type { PlanExam, PlanTask, PlanGoal, Subject } from 'shared'
import { useTheme } from '../lib/theme.tsx'

// ── Subject color palette ──────────────────────────────────────────────────────

const PALETTE = ['#22d3ee', '#60a5fa', '#a78bfa', '#fbbf24', '#34d399', '#f87171', '#fb923c', '#f472b6']

function subjectColor(name: string | null | undefined): string {
  if (!name) return '#94a3b8'
  let h = 0
  for (const c of name) h = ((h * 31) + c.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((d.getTime() - today.getTime()) / 86_400_000))
}

function fmtExamDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtDueDay(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000)
  if (diff === 0) return 'Due Today'
  if (diff === 1) return 'Due Tomorrow'
  if (diff < 0) return 'Overdue'
  return `Due ${d.toLocaleDateString('en-US', { weekday: 'short' })}`
}

function urgencyColor(days: number): string {
  if (days <= 3) return '#f87171'
  if (days <= 7) return '#fbbf24'
  return '#22d3ee'
}

// ── Countdown Ring ─────────────────────────────────────────────────────────────

function CountdownRing({ days, color }: { days: number; color: string }) {
  const r = 30
  const cx = 40
  const circumference = 2 * Math.PI * r
  const fraction = Math.min(1, days / 90)
  const offset = circumference * (1 - fraction)

  return (
    <svg width={80} height={80} viewBox="0 0 80 80" style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={5} />
      <circle
        cx={cx} cy={cx} r={r} fill="none"
        stroke={color} strokeWidth={5}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x={cx} y={cx - 3} textAnchor="middle" fill="white" fontSize={17} fontWeight="700" fontFamily="Manrope,sans-serif">
        {days}
      </text>
      <text x={cx} y={cx + 13} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize={10} fontFamily="Manrope,sans-serif">
        days
      </text>
    </svg>
  )
}

// ── Add Exam Modal ─────────────────────────────────────────────────────────────

function AddExamModal({ onClose, onAdded, subjects, theme }: {
  onClose: () => void
  onAdded: (e: PlanExam) => void
  subjects: Subject[]
  theme: string
}) {
  const { getToken } = useAuth()
  const isLight = theme === 'light'
  const [name, setName] = useState('')
  const [type, setType] = useState('Exam')
  const [subject, setSubject] = useState('')
  const [subjectInput, setSubjectInput] = useState('')
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const finalSubject = subjects.length > 0 ? subject : subjectInput
  const TYPES = ['Exam', 'Assignment', 'Project', 'Quiz', 'Presentation', 'Other']

  async function submit() {
    if (!name.trim() || !date) { setError('Title and date are required'); return }
    // Prefix with type label unless the user already typed it
    const trimmed = name.trim()
    const finalName = trimmed.toLowerCase().startsWith(type.toLowerCase()) ? trimmed : `${type}: ${trimmed}`
    setSaving(true); setError('')
    try {
      const token = await getToken()
      if (!token) return
      const { exam } = await makeApi(token).studyplan.addExam({
        name: finalName,
        subject: finalSubject || undefined,
        exam_date: date,
      })
      onAdded(exam)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.05)',
    border: '1px solid rgb(var(--color-border))',
    color: isLight ? '#0f172a' : '#f8fafc',
    borderRadius: 8, padding: '8px 12px', fontSize: 14, width: '100%', outline: 'none',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ background: isLight ? '#fff' : 'rgb(var(--color-surface))', border: '1px solid rgb(var(--color-border))' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold" style={{ color: isLight ? '#0f172a' : '#f8fafc' }}>Add Deadline</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5"><X size={16} style={{ color: 'rgb(var(--color-muted))' }} /></button>
        </div>
        <div className="space-y-3">
          {/* Type chips */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgb(var(--color-muted))' }}>Type</label>
            <div className="flex flex-wrap gap-1.5">
              {TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                  style={{
                    background: type === t ? 'rgb(var(--color-primary))' : (isLight ? '#f1f5f9' : 'rgba(255,255,255,0.07)'),
                    color: type === t ? (isLight ? '#fff' : '#0f172a') : 'rgb(var(--color-muted))',
                    border: type === t ? 'none' : '1px solid rgb(var(--color-border))',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(var(--color-muted))' }}>Title</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder={type === 'Exam' ? 'e.g. DBMS Mid-Term' : type === 'Assignment' ? 'e.g. Assignment 3 submission' : `e.g. ${type} title`}
              style={inputStyle} onKeyDown={e => e.key === 'Enter' && submit()} autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(var(--color-muted))' }}>Subject</label>
            {subjects.length > 0 ? (
              <select value={subject} onChange={e => setSubject(e.target.value)} style={inputStyle}>
                <option value="">General</option>
                {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            ) : (
              <input value={subjectInput} onChange={e => setSubjectInput(e.target.value)} placeholder="e.g. Database Management" style={inputStyle} />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(var(--color-muted))' }}>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
          </div>
          {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium"
              style={{ background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)', color: 'rgb(var(--color-muted))' }}>Cancel</button>
            <button onClick={submit} disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
              style={{ background: 'rgb(var(--color-primary))', color: isLight ? '#fff' : '#0f172a' }}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Add Goal Modal ─────────────────────────────────────────────────────────────

function AddGoalModal({ onClose, onAdded, subjects, theme }: {
  onClose: () => void
  onAdded: (g: PlanGoal) => void
  subjects: Subject[]
  theme: string
}) {
  const { getToken } = useAuth()
  const isLight = theme === 'light'
  const [subject, setSubject] = useState('')
  const [subjectInput, setSubjectInput] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [progress, setProgress] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const finalSubject = subjects.length > 0 ? subject : subjectInput

  async function submit() {
    if (!finalSubject.trim() || !description.trim()) { setError('Subject and description are required'); return }
    setSaving(true); setError('')
    try {
      const token = await getToken()
      if (!token) return
      const { goal } = await makeApi(token).studyplan.addGoal({
        subject: finalSubject.trim(),
        description: description.trim(),
        due_date: dueDate || undefined,
        progress,
      })
      onAdded(goal)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.05)',
    border: '1px solid rgb(var(--color-border))',
    color: isLight ? '#0f172a' : '#f8fafc',
    borderRadius: 8, padding: '8px 12px', fontSize: 14, width: '100%', outline: 'none',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ background: isLight ? '#fff' : 'rgb(var(--color-surface))', border: '1px solid rgb(var(--color-border))' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold" style={{ color: isLight ? '#0f172a' : '#f8fafc' }}>Add Subject Goal</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5"><X size={16} style={{ color: 'rgb(var(--color-muted))' }} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(var(--color-muted))' }}>Subject</label>
            {subjects.length > 0 ? (
              <select value={subject} onChange={e => setSubject(e.target.value)} style={inputStyle}>
                <option value="">Pick a subject…</option>
                {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            ) : (
              <input value={subjectInput} onChange={e => setSubjectInput(e.target.value)} placeholder="e.g. Database Management" style={inputStyle} />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(var(--color-muted))' }}>Goal Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Finish Unit 3 — Normalization" style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(var(--color-muted))' }}>Due Date (optional)</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgb(var(--color-muted))' }}>Starting Progress: <span style={{ color: 'rgb(var(--color-primary))' }}>{progress}%</span></label>
            <input type="range" min={0} max={100} value={progress} onChange={e => setProgress(Number(e.target.value))}
              className="w-full accent-cyan-400" />
          </div>
          {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium"
              style={{ background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)', color: 'rgb(var(--color-muted))' }}>Cancel</button>
            <button onClick={submit} disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
              style={{ background: 'rgb(var(--color-primary))', color: isLight ? '#fff' : '#0f172a' }}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Target size={13} />}
              Add Goal
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Task Row ───────────────────────────────────────────────────────────────────

function TaskRow({ task, theme, onToggle, onDelete }: {
  task: PlanTask
  theme: string
  onToggle: (id: string, completed: boolean) => void
  onDelete: (id: string) => void
}) {
  const isLight = theme === 'light'
  const color = subjectColor(task.subject)
  const textPrimary = isLight ? '#0f172a' : '#f8fafc'
  const textMuted = 'rgb(var(--color-muted))'

  return (
    <div className="group flex items-center gap-3 py-3">
      <button
        onClick={() => onToggle(task.id, !task.completed)}
        className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all"
        style={{
          border: task.completed ? 'none' : `2px solid ${color}`,
          background: task.completed ? color : 'transparent',
        }}
      >
        {task.completed && (
          <svg width="10" height="10" viewBox="0 0 10 10">
            <polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <span
        className="flex-1 text-sm"
        style={{
          color: task.completed ? textMuted : textPrimary,
          textDecoration: task.completed ? 'line-through' : 'none',
          opacity: task.completed ? 0.6 : 1,
        }}
      >
        {task.text}
      </span>

      {task.subject && (
        <span
          className="flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-md"
          style={{ background: `${color}22`, color }}
        >
          {task.subject.length > 8 ? task.subject.slice(0, 8).toUpperCase() : task.subject.toUpperCase()}
        </span>
      )}

      <button
        onClick={() => onDelete(task.id)}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
      >
        <Trash2 size={13} style={{ color: isLight ? '#dc2626' : '#f87171' }} />
      </button>
    </div>
  )
}

// ── Goal Row ───────────────────────────────────────────────────────────────────

function GoalRow({ goal, theme, onDelete }: {
  goal: PlanGoal
  theme: string
  onDelete: (id: string) => void
}) {
  const isLight = theme === 'light'
  const color = subjectColor(goal.subject)
  const textPrimary = isLight ? '#0f172a' : '#f8fafc'
  const textMuted = 'rgb(var(--color-muted))'

  return (
    <div className="group relative px-5 py-4">
      <div className="flex items-start justify-between mb-0.5">
        <span className="text-xs font-semibold" style={{ color }}>{goal.subject}</span>
        <div className="flex items-center gap-2">
          {goal.due_date && (
            <span className="text-xs" style={{ color: textMuted }}>{fmtDueDay(goal.due_date)}</span>
          )}
          <button
            onClick={() => onDelete(goal.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X size={12} style={{ color: textMuted }} />
          </button>
        </div>
      </div>
      <p className="text-sm mb-2.5" style={{ color: textPrimary }}>{goal.description}</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden"
          style={{ background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.07)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${goal.progress}%`, background: color }}
          />
        </div>
        <span className="text-xs font-medium flex-shrink-0" style={{ color }}>{goal.progress}%</span>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function StudyPlan() {
  const { getToken } = useAuth()
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const [exams, setExams] = useState<PlanExam[]>([])
  const [tasks, setTasks] = useState<PlanTask[]>([])
  const [goals, setGoals] = useState<PlanGoal[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)

  const [showAddExam, setShowAddExam] = useState(false)
  const [showAddGoal, setShowAddGoal] = useState(false)

  const [newTaskText, setNewTaskText] = useState('')
  const [newTaskSubject, setNewTaskSubject] = useState('')
  const [addingTask, setAddingTask] = useState(false)
  const taskInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const api = makeApi(token)
      const [examsRes, tasksRes, goalsRes, subjectsRes] = await Promise.all([
        api.studyplan.listExams(),
        api.studyplan.listTasks(),
        api.studyplan.listGoals(),
        api.subjects.list(),
      ])
      setExams(examsRes.exams)
      setTasks(tasksRes.tasks)
      setGoals(goalsRes.goals)
      setSubjects(subjectsRes.subjects)
      setLoading(false)
    }
    load()
  }, [getToken])

  const addTask = useCallback(async () => {
    if (!newTaskText.trim() || addingTask) return
    setAddingTask(true)
    const text = newTaskText.trim()
    const subject = newTaskSubject || undefined
    setNewTaskText('')
    try {
      const token = await getToken()
      if (!token) return
      const { task } = await makeApi(token).studyplan.addTask({ text, subject })
      setTasks(prev => [task, ...prev])
    } finally {
      setAddingTask(false)
      taskInputRef.current?.focus()
    }
  }, [newTaskText, newTaskSubject, addingTask, getToken])

  const toggleTask = useCallback(async (id: string, completed: boolean) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed } : t))
    try {
      const token = await getToken()
      if (!token) return
      await makeApi(token).studyplan.toggleTask(id, completed)
    } catch {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !completed } : t))
    }
  }, [getToken])

  const deleteTask = useCallback(async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
    const token = await getToken()
    if (token) makeApi(token).studyplan.deleteTask(id).catch(() => {})
  }, [getToken])

  const deleteExam = useCallback(async (id: string) => {
    setExams(prev => prev.filter(e => e.id !== id))
    const token = await getToken()
    if (token) makeApi(token).studyplan.deleteExam(id).catch(() => {})
  }, [getToken])

  const deleteGoal = useCallback(async (id: string) => {
    setGoals(prev => prev.filter(g => g.id !== id))
    const token = await getToken()
    if (token) makeApi(token).studyplan.deleteGoal(id).catch(() => {})
  }, [getToken])

  const pending = tasks.filter(t => !t.completed)
  const completedTasks = tasks.filter(t => t.completed)

  const pageBg = isLight ? 'rgb(var(--color-bg))' : 'rgb(8,12,20)'
  const surfaceBg = isLight ? '#ffffff' : 'rgb(13,18,32)'
  const surfaceBorder = '1px solid rgb(var(--color-border))'
  const textPrimary = isLight ? '#0f172a' : '#f8fafc'
  const textMuted = 'rgb(var(--color-muted))'
  const primaryColor = isLight ? '#0891b2' : '#22d3ee'
  const inputBg = isLight ? '#f8fafc' : 'rgba(255,255,255,0.04)'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: pageBg }}>
        <Loader2 size={28} className="animate-spin" style={{ color: primaryColor }} />
      </div>
    )
  }

  // Subjects without a goal
  const subjectsWithGoal = new Set(goals.map(g => g.subject))
  const subjectsWithoutGoal = subjects.filter(s => !subjectsWithGoal.has(s.name))

  return (
    <div className="flex flex-col min-h-full overflow-y-auto" style={{ background: pageBg }}>
      <div className="max-w-6xl mx-auto w-full px-4 lg:px-6 pt-5 pb-8 space-y-5">

        {/* ── Header (compact) ── */}
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-bold" style={{ color: textPrimary }}>What's on the plan today</h1>
          <span className="text-sm hidden sm:block" style={{ color: textMuted }}>— your exams, goals, and tasks in one place.</span>
        </div>

        {/* ── Exam Row (inline width, no dead space) ── */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={13} style={{ color: primaryColor }} />
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: textMuted }}>
              Upcoming Exams & Deadlines
            </h2>
          </div>

          {exams.length === 0 ? (
            /* Zero-state: full-width inviting card */
            <button
              onClick={() => setShowAddExam(true)}
              className="flex items-center gap-4 w-full rounded-xl px-5 py-4 text-left transition-opacity hover:opacity-80"
              style={{ border: `2px dashed rgb(var(--color-border))`, background: 'transparent' }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: isLight ? 'rgba(8,145,178,0.08)' : 'rgba(34,211,238,0.08)' }}>
                <Plus size={18} style={{ color: primaryColor }} />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: textPrimary }}>Add your first exam or deadline</p>
                <p className="text-xs mt-0.5" style={{ color: textMuted }}>Track countdowns for exams, assignments, and projects</p>
              </div>
            </button>
          ) : (
            /* Inline flex — no dead space when few cards */
            <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {exams.map(exam => {
                const days = daysUntil(exam.exam_date)
                const color = days <= 7 ? urgencyColor(days) : subjectColor(exam.subject)
                return (
                  <div
                    key={exam.id}
                    className="group relative flex-shrink-0 flex items-center gap-3 rounded-xl px-4 py-3"
                    style={{
                      width: 240,
                      background: surfaceBg,
                      border: surfaceBorder,
                      boxShadow: isLight ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                    }}
                  >
                    <CountdownRing days={days} color={color} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate leading-tight" style={{ color: textPrimary }}>{exam.name}</p>
                      {exam.subject && (
                        <p className="text-xs mt-0.5 truncate" style={{ color: subjectColor(exam.subject) }}>{exam.subject}</p>
                      )}
                      <p className="text-xs mt-1" style={{ color: textMuted }}>{fmtExamDate(exam.exam_date)}</p>
                    </div>
                    <button
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity"
                      onClick={() => deleteExam(exam.id)}
                    >
                      <X size={12} style={{ color: textMuted }} />
                    </button>
                  </div>
                )
              })}
              {/* Add card — compact, consistent height */}
              <button
                onClick={() => setShowAddExam(true)}
                className="flex-shrink-0 flex flex-col items-center justify-center gap-1.5 rounded-xl transition-opacity hover:opacity-80"
                style={{ width: 100, minHeight: 100, border: `2px dashed rgb(var(--color-border))`, background: 'transparent' }}
              >
                <Plus size={16} style={{ color: primaryColor }} />
                <span className="text-xs" style={{ color: textMuted }}>Add</span>
              </button>
            </div>
          )}
        </div>

        {/* ── Tasks + Goals ── */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-5 items-start pb-4">

          {/* Today's Tasks — full width on mobile, 3/5 on desktop */}
          <div className="md:col-span-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold" style={{ color: textPrimary }}>Today's tasks</h2>
              {tasks.length > 0 && (
                <span className="text-xs" style={{ color: textMuted }}>{completedTasks.length}/{tasks.length} done</span>
              )}
            </div>

            {/* Input */}
            <div
              className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl"
              style={{ background: inputBg, border: surfaceBorder }}
            >
              {subjects.length > 0 && (
                <select
                  value={newTaskSubject}
                  onChange={e => setNewTaskSubject(e.target.value)}
                  className="text-xs bg-transparent outline-none border-r pr-2 mr-1"
                  style={{
                    color: newTaskSubject ? subjectColor(newTaskSubject) : textMuted,
                    borderColor: 'rgb(var(--color-border))',
                    maxWidth: 110,
                  }}
                >
                  <option value="">General</option>
                  {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              )}
              <input
                ref={taskInputRef}
                value={newTaskText}
                onChange={e => setNewTaskText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTask()}
                placeholder="Add a task and press Enter"
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: textPrimary }}
              />
              <button
                onClick={addTask}
                disabled={!newTaskText.trim() || addingTask}
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity"
                style={{ background: primaryColor }}
              >
                {addingTask
                  ? <Loader2 size={12} className="animate-spin" style={{ color: isLight ? '#fff' : '#0f172a' }} />
                  : <Plus size={14} style={{ color: isLight ? '#fff' : '#0f172a' }} />}
              </button>
            </div>

            {tasks.length === 0 ? (
              /* Empty state — only when truly 0 tasks */
              <div className="flex items-center gap-3 px-3 py-3 rounded-xl"
                style={{ background: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)', border: surfaceBorder }}>
                <CheckCircle2 size={16} style={{ color: textMuted, opacity: 0.4 }} />
                <p className="text-sm" style={{ color: textMuted, opacity: 0.7 }}>
                  No tasks yet — what do you need to do today?
                </p>
              </div>
            ) : (
              <>
                <div className="divide-y" style={{ borderColor: 'rgb(var(--color-border))' }}>
                  {pending.map(task => (
                    <TaskRow key={task.id} task={task} theme={theme} onToggle={toggleTask} onDelete={deleteTask} />
                  ))}
                </div>

                {completedTasks.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs mb-1.5" style={{ color: textMuted }}>Completed</p>
                    <div className="divide-y" style={{ borderColor: 'rgb(var(--color-border))' }}>
                      {completedTasks.map(task => (
                        <TaskRow key={task.id} task={task} theme={theme} onToggle={toggleTask} onDelete={deleteTask} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Subject Goals — full width on mobile, 2/5 on desktop */}
          <div className="md:col-span-2">
            <div
              className="rounded-xl overflow-hidden"
              style={{
                background: surfaceBg,
                border: surfaceBorder,
                boxShadow: isLight ? '0 1px 6px rgba(0,0,0,0.09)' : 'none',
              }}
            >
              <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: surfaceBorder }}>
                <Target size={13} style={{ color: primaryColor }} />
                <h2 className="text-sm font-semibold" style={{ color: textPrimary }}>Subject goals</h2>
              </div>

              <div className="divide-y" style={{ borderColor: 'rgb(var(--color-border))' }}>
                {goals.length === 0 ? (
                  <div className="px-4 py-5">
                    <p className="text-xs" style={{ color: textMuted, opacity: 0.7 }}>
                      No goals yet. Set a goal for each subject to track your weekly focus.
                    </p>
                  </div>
                ) : (
                  goals.map(goal => (
                    <GoalRow key={goal.id} goal={goal} theme={theme} onDelete={deleteGoal} />
                  ))
                )}
              </div>

              {/* Subjects-without-goal nudge */}
              {goals.length > 0 && subjectsWithoutGoal.length > 0 && (
                <div
                  className="px-4 py-2.5 flex items-center gap-2"
                  style={{ borderTop: surfaceBorder, background: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)' }}
                >
                  <span className="text-xs flex-1" style={{ color: textMuted, opacity: 0.8 }}>
                    {subjectsWithoutGoal.length} subject{subjectsWithoutGoal.length > 1 ? 's' : ''} without a goal yet
                  </span>
                </div>
              )}

              <button
                onClick={() => setShowAddGoal(true)}
                className="w-full flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-opacity hover:opacity-70"
                style={{ color: primaryColor, borderTop: surfaceBorder }}
              >
                <Plus size={13} />
                Add a goal
              </button>
            </div>
          </div>
        </div>
      </div>

      {showAddExam && (
        <AddExamModal
          onClose={() => setShowAddExam(false)}
          onAdded={exam => {
            setExams(prev => [...prev, exam].sort((a, b) => a.exam_date.localeCompare(b.exam_date)))
            setShowAddExam(false)
          }}
          subjects={subjects}
          theme={theme}
        />
      )}
      {showAddGoal && (
        <AddGoalModal
          onClose={() => setShowAddGoal(false)}
          onAdded={goal => { setGoals(prev => [goal, ...prev]); setShowAddGoal(false) }}
          subjects={subjects}
          theme={theme}
        />
      )}
    </div>
  )
}

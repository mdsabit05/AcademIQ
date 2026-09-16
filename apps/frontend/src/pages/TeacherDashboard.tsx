/**
 * Teacher Dashboard — shown when a teacher/admin switches to Teacher mode.
 * Provides an overview of subjects, materials, and question papers.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import teacherBgUrl from '../assets/teacherbg.png'
import teacherBgLightUrl from '../assets/teacherbgLight.png'
import { useTheme } from '../lib/theme.tsx'
import {
  BookOpen,
  ScrollText,
  BookMarked,
  PlusCircle,
  ArrowRight,
  FileText,
  Clock,
  ChevronRight,
} from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import { useCurrentUser } from '../lib/useCurrentUser.ts'
import type { Subject, Book } from 'shared'

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

// Using shared types via API responses (Subject has name/semester, Book has title/author)

export default function TeacherDashboard() {
  const { getToken } = useAuth()
  const { user } = useCurrentUser()
  const navigate = useNavigate()

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const token = await getToken()
        if (!token || cancelled) return
        const api = makeApi(token)
        const [subRes, bookRes] = await Promise.allSettled([
          api.subjects.list(),
          api.books.list(),
        ])

        if (cancelled) return

        if (subRes.status === 'fulfilled') {
          setSubjects(subRes.value.subjects.slice(0, 4))
        }
        if (bookRes.status === 'fulfilled') {
          setBooks(bookRes.value.books.slice(0, 4))
        }
      } catch {
        // silently fail — dashboard shows empty states
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [getToken])

  const { resolvedTheme } = useTheme()
  const isLight = resolvedTheme === 'light'
  const firstName = user?.name?.split(' ')[0] ?? 'Teacher'

  return (
    <div className="min-h-full p-4 md:p-6 space-y-4 md:space-y-6 pb-24 md:pb-6">

      {/* ── Hero greeting ── */}
      <div className="rounded-2xl overflow-hidden relative min-h-[120px] md:min-h-[140px]">
        {/* Hero background image */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: `url(${isLight ? teacherBgLightUrl : teacherBgUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
        }} />
        {/* Overlay for text readability */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: isLight
            ? 'linear-gradient(to right, rgba(255,255,255,0.85) 60%, rgba(255,255,255,0.3))'
            : 'linear-gradient(to right, rgba(10,15,28,0.88) 55%, rgba(10,15,28,0.2))',
        }} />
        <div className="relative z-10 p-4 md:p-6">
          <p className="text-xs md:text-sm font-semibold text-primary mb-0.5">{greeting()},</p>
          <h1 className="text-xl md:text-2xl font-bold mb-1" style={{ color: isLight ? '#1e293b' : '#fff' }}>
            {firstName} 👋
          </h1>
          <p className="text-xs md:text-sm max-w-xs md:max-w-md" style={{ color: isLight ? '#475569' : '#94a3b8' }}>
            You're in Teacher mode. Create papers, manage materials, and organise your subjects.
          </p>
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-3">
        <button
          onClick={() => navigate('/question-papers')}
          className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 hover:border-primary/40 hover:bg-primary/5 transition-all group text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:bg-primary/20 transition-colors">
            <PlusCircle size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">New Question Paper</p>
            <p className="text-xs text-muted mt-0.5">Create & export</p>
          </div>
          <ArrowRight size={14} className="ml-auto text-muted group-hover:text-primary transition-colors" />
        </button>

        <button
          onClick={() => navigate('/syllabus')}
          className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 hover:border-primary/40 hover:bg-primary/5 transition-all group text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0 group-hover:bg-blue-500/20 transition-colors">
            <BookMarked size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Manage Subjects</p>
            <p className="text-xs text-muted mt-0.5">Syllabus & topics</p>
          </div>
          <ArrowRight size={14} className="ml-auto text-muted group-hover:text-blue-400 transition-colors" />
        </button>

        <button
          onClick={() => navigate('/teacher/materials')}
          className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 hover:border-primary/40 hover:bg-primary/5 transition-all group text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0 group-hover:bg-emerald-500/20 transition-colors">
            <BookOpen size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Upload Material</p>
            <p className="text-xs text-muted mt-0.5">Books & notes</p>
          </div>
          <ArrowRight size={14} className="ml-auto text-muted group-hover:text-emerald-400 transition-colors" />
        </button>
      </div>

      {/* ── Two column: Subjects + Materials ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Subjects */}
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BookMarked size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-white">My Subjects</h2>
            </div>
            <button
              onClick={() => navigate('/syllabus')}
              className="text-xs text-primary hover:underline flex items-center gap-0.5"
            >
              View all <ChevronRight size={12} />
            </button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded-lg bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : subjects.length === 0 ? (
            <div className="py-6 text-center">
              <BookMarked size={28} className="mx-auto text-muted/40 mb-2" />
              <p className="text-sm text-muted">No subjects yet</p>
              <button
                onClick={() => navigate('/syllabus')}
                className="mt-2 text-xs text-primary hover:underline"
              >
                Create your first subject →
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {subjects.map((s) => (
                <button
                  key={s.id}
                  onClick={() => navigate('/syllabus')}
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/5 transition-colors group text-left"
                >
                  <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <BookMarked size={14} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{s.name}</p>
                    {s.semester && (
                      <p className="text-xs text-muted">Sem {s.semester}</p>
                    )}
                  </div>
                  <ChevronRight size={13} className="text-muted/40 group-hover:text-muted transition-colors shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Materials */}
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">Materials</h2>
            </div>
            <button
              onClick={() => navigate('/teacher/materials')}
              className="text-xs text-primary hover:underline flex items-center gap-0.5"
            >
              View all <ChevronRight size={12} />
            </button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded-lg bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : books.length === 0 ? (
            <div className="py-6 text-center">
              <BookOpen size={28} className="mx-auto text-muted/40 mb-2" />
              <p className="text-sm text-muted">No materials uploaded yet</p>
              <button
                onClick={() => navigate('/teacher/materials')}
                className="mt-2 text-xs text-primary hover:underline"
              >
                Upload your first material →
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {books.map((b) => (
                <button
                  key={b.id}
                  onClick={() => navigate('/teacher/materials')}
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/5 transition-colors group text-left"
                >
                  <div className="w-8 h-8 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <FileText size={14} className="text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{b.title}</p>
                    {b.author && <p className="text-xs text-muted truncate">{b.author}</p>}
                  </div>
                  <div className="flex items-center gap-1 text-muted/50 shrink-0">
                    <Clock size={11} />
                    <span className="text-[10px]">{timeAgo(b.created_at)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Question Papers ── */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ScrollText size={16} className="text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Question Papers</h2>
          </div>
          <button
            onClick={() => navigate('/question-papers')}
            className="text-xs text-primary hover:underline flex items-center gap-0.5"
          >
            View all <ChevronRight size={12} />
          </button>
        </div>

        <div className="py-8 text-center">
          <ScrollText size={32} className="mx-auto text-muted/30 mb-3" />
          <p className="text-sm text-muted mb-3">Create AI-generated question papers from your materials</p>
          <button
            onClick={() => navigate('/question-papers')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-bg text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <PlusCircle size={15} />
            Create Question Paper
          </button>
        </div>
      </div>

    </div>
  )
}

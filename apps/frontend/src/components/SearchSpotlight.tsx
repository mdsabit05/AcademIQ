/**
 * SearchSpotlight — Ctrl+K global search modal.
 * Searches books, tests, subjects and app pages.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import {
  Search, BookOpen, FileText, LayoutDashboard, Settings,
  TrendingUp, Calendar, Sparkles, X, ArrowRight, Users,
  ChevronRight,
} from 'lucide-react'
import { makeApi } from '../lib/api.ts'

// ── Static pages ───────────────────────────────────────────────────────────────
const PAGES = [
  { label: 'Dashboard',    path: '/dashboard',  icon: LayoutDashboard, group: 'Pages' },
  { label: 'My Books',     path: '/books',       icon: BookOpen,        group: 'Pages' },
  { label: 'Ask AI',       path: '/ask',         icon: Sparkles,        group: 'Pages' },
  { label: 'Tests',        path: '/tests',       icon: FileText,        group: 'Pages' },
  { label: 'Progress',     path: '/progress',    icon: TrendingUp,      group: 'Pages' },
  { label: 'Study Plan',   path: '/study-plan',  icon: Calendar,        group: 'Pages' },
  { label: 'Settings',     path: '/settings',    icon: Settings,        group: 'Pages' },
  { label: 'Admin',        path: '/admin',       icon: Users,           group: 'Pages' },
]

interface Result {
  id: string
  label: string
  sub?: string
  path: string
  icon: React.ElementType
  group: string
}

interface Props {
  open: boolean
  onClose: () => void
}

export default function SearchSpotlight({ open, onClose }: Props) {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [highlighted, setHighlighted] = useState(0)
  const [loading, setLoading] = useState(false)

  // Seed with all pages on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setHighlighted(0)
      setResults(PAGES.map((p) => ({ ...p, id: p.path })))
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Search
  const search = useCallback(async (q: string) => {
    const trimmed = q.trim().toLowerCase()

    if (!trimmed) {
      setResults(PAGES.map((p) => ({ ...p, id: p.path })))
      return
    }

    setLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      const api = makeApi(token)

      const [booksRes, testsRes, subjectsRes] = await Promise.allSettled([
        api.books.list(),
        api.tests.list(),
        api.subjects.list(),
      ])

      const items: Result[] = []

      // Pages
      PAGES.filter((p) => p.label.toLowerCase().includes(trimmed)).forEach((p) =>
        items.push({ ...p, id: p.path }),
      )

      // Books
      if (booksRes.status === 'fulfilled') {
        booksRes.value.books
          .filter((b) => b.title.toLowerCase().includes(trimmed) || b.author?.toLowerCase().includes(trimmed))
          .slice(0, 4)
          .forEach((b) =>
            items.push({ id: b.id, label: b.title, sub: b.author ?? 'Book', path: '/books', icon: BookOpen, group: 'Books' }),
          )
      }

      // Tests
      if (testsRes.status === 'fulfilled') {
        testsRes.value.tests
          .filter((t) => t.topic?.toLowerCase().includes(trimmed) || t.type?.toLowerCase().includes(trimmed))
          .slice(0, 4)
          .forEach((t) =>
            items.push({ id: t.id, label: t.topic ?? `${t.type} test`, sub: `${t.question_count} questions · ${t.total_marks} marks`, path: `/tests/${t.id}`, icon: FileText, group: 'Tests' }),
          )
      }

      // Subjects
      if (subjectsRes.status === 'fulfilled') {
        subjectsRes.value.subjects
          .filter((s) => s.name.toLowerCase().includes(trimmed))
          .slice(0, 3)
          .forEach((s) =>
            items.push({ id: s.id, label: s.name, sub: s.semester ?? 'Subject', path: '/books', icon: BookOpen, group: 'Subjects' }),
          )
      }

      setResults(items)
      setHighlighted(0)
    } finally {
      setLoading(false)
    }
  }, [getToken])

  useEffect(() => {
    const t = setTimeout(() => search(query), 200)
    return () => clearTimeout(t)
  }, [query, search])

  // Keyboard nav
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, results.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)) }
      if (e.key === 'Enter' && results[highlighted]) { go(results[highlighted]) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, results, highlighted, onClose])

  // Scroll highlighted into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${highlighted}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlighted])

  function go(r: Result) {
    navigate(r.path)
    onClose()
  }

  if (!open) return null

  // Group results
  const groups: Record<string, Result[]> = {}
  for (const r of results) {
    if (!groups[r.group]) groups[r.group] = []
    groups[r.group].push(r)
  }

  let flatIdx = 0

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-[18%] -translate-x-1/2 z-[1000] w-full max-w-xl px-4">
        <div className="rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden">

          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            {loading
              ? <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
              : <Search size={16} className="text-muted shrink-0" />
            }
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search books, tests, subjects, pages…"
              className="flex-1 bg-transparent text-sm text-white placeholder:text-muted outline-none"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-muted hover:text-white transition-colors">
                <X size={14} />
              </button>
            )}
            <kbd className="text-[10px] text-muted bg-border/40 rounded px-1.5 py-0.5 font-mono shrink-0">Esc</kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[360px] overflow-y-auto py-2">
            {results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted">
                <Search size={24} className="mb-2 opacity-30" />
                <p className="text-sm">No results for "{query}"</p>
              </div>
            ) : (
              Object.entries(groups).map(([group, items]) => (
                <div key={group}>
                  <p className="text-[10px] font-bold text-muted/50 uppercase tracking-widest px-4 pt-3 pb-1">{group}</p>
                  {items.map((r) => {
                    const idx = flatIdx++
                    const active = idx === highlighted
                    return (
                      <button
                        key={r.id}
                        data-idx={idx}
                        onMouseEnter={() => setHighlighted(idx)}
                        onClick={() => go(r)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${
                          active ? 'bg-primary/10' : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          active ? 'bg-primary/20 border border-primary/30' : 'bg-bg border border-border'
                        }`}>
                          <r.icon size={14} className={active ? 'text-primary' : 'text-muted'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${active ? 'text-white' : 'text-white/80'}`}>{r.label}</p>
                          {r.sub && <p className="text-[11px] text-muted truncate">{r.sub}</p>}
                        </div>
                        {active && <ChevronRight size={14} className="text-primary shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-border bg-bg/50">
            <span className="text-[10px] text-muted flex items-center gap-1"><kbd className="font-mono bg-border/40 px-1 rounded">↑↓</kbd> navigate</span>
            <span className="text-[10px] text-muted flex items-center gap-1"><kbd className="font-mono bg-border/40 px-1 rounded">↵</kbd> open</span>
            <span className="text-[10px] text-muted flex items-center gap-1"><kbd className="font-mono bg-border/40 px-1 rounded">Esc</kbd> close</span>
            <div className="ml-auto flex items-center gap-1 text-[10px] text-muted">
              <ArrowRight size={10} /> {results.length} result{results.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

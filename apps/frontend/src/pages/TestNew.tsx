/**
 * TestNew — "Create a Practice Test" page.
 * Full redesign matching the AcademIQ design system.
 * Uses the existing /tests API: POST /tests with bookIds, type, difficulty, etc.
 */

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import {
  ArrowRight,
  BarChart2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Hash,
  Loader2,
  Search,
  Sparkles,
  BookOpen,
  MessageSquare,
  Target,
  BookMarked,
  Layers,
  X,
  CheckCheck,
  Filter,
} from 'lucide-react'
import { clsx } from 'clsx'
import { makeApi } from '../lib/api.ts'
import type { Book, Subject, TestType, Difficulty } from 'shared'

// ── Constants ──────────────────────────────────────────────────────────────────

const TEST_TYPES: { value: TestType; label: string }[] = [
  { value: 'mixed',      label: 'Mixed'        },
  { value: 'mcq',        label: 'MCQ'          },
  { value: 'five_mark',  label: 'Descriptive'  },
  { value: 'one_mark',   label: 'Short Answer' },
]

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy',   label: 'Easy'   },
  { value: 'medium', label: 'Medium' },
  { value: 'hard',   label: 'Hard'   },
]

const MARK_OPTIONS   = [10, 20, 50, 100] as const
const COUNT_OPTIONS  = [5, 10, 20, 30]   as const
const TIME_OPTIONS: { label: string; value: number | null }[] = [
  { label: '10 min', value: 10  },
  { label: '30 min', value: 30  },
  { label: '1 hour', value: 60  },
  { label: 'No limit', value: null },
]

const QUICK_EXAMPLES = [
  'End sem style test',
  'Focus on important topics',
  'More tough questions',
  'Include numerical problems',
  'Short practice test (10 marks)',
  'Topic wise test',
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function getFileInfo(filename: string): { ext: string; bg: string; fg: string } {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf')               return { ext: 'PDF',  bg: '#EF44441A', fg: '#EF4444' }
  if (ext === 'docx' || ext === 'doc') return { ext: 'DOCX', bg: '#3B82F61A', fg: '#3B82F6' }
  if (ext === 'txt')               return { ext: 'TXT',  bg: '#22C55E1A', fg: '#22C55E' }
  if (ext === 'pptx' || ext === 'ppt') return { ext: 'PPT',  bg: '#F973161A', fg: '#F97316' }
  return { ext: 'FILE', bg: '#8B5CF61A', fg: '#8B5CF6' }
}

function fmtTestType(v: TestType) {
  return TEST_TYPES.find((t) => t.value === v)?.label ?? v
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionBadge({ n }: { n: number }) {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-bg">
      {n}
    </div>
  )
}

function PillBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'rounded-full px-4 py-1.5 text-xs font-semibold transition-all',
        active
          ? 'bg-primary text-bg'
          : 'border border-border text-muted hover:border-primary/40 hover:text-white',
      )}
    >
      {children}
    </button>
  )
}

function PreviewRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string | number
}) {
  return (
    <div className="flex items-center justify-between py-2 text-sm border-b border-border/40 last:border-0">
      <div className="flex items-center gap-2 text-muted">
        <Icon size={13} />
        <span>{label}</span>
      </div>
      <span className="font-semibold text-white">{value}</span>
    </div>
  )
}

// ── Materials Modal ────────────────────────────────────────────────────────────

function MaterialsModal({
  books,
  subjects,
  selectedIds,
  onToggle,
  onClose,
}: {
  books: Book[]
  subjects: Subject[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onClose: () => void
}) {
  const [search,     setSearch]     = useState('')
  const [subjectTab, setSubjectTab] = useState<string>('all')
  const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s.name]))

  // Build subject options that actually have books
  const usedSubjectIds = [...new Set(books.map((b) => b.subject_id).filter(Boolean))] as string[]
  const subjectTabs = [
    { id: 'all', name: 'All' },
    ...usedSubjectIds.map((id) => ({ id, name: subjectMap[id] ?? id })),
    { id: 'none', name: 'No Subject' },
  ]

  const filtered = books.filter((b) => {
    const matchesSearch =
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      (b.subject_id && subjectMap[b.subject_id]?.toLowerCase().includes(search.toLowerCase()))
    const matchesTab =
      subjectTab === 'all' ||
      (subjectTab === 'none' ? !b.subject_id : b.subject_id === subjectTab)
    return matchesSearch && matchesTab
  })

  const selectedCount = selectedIds.size

  // Close on backdrop click
  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdrop}
    >
      <div
        className="relative flex h-[85vh] w-[90vw] max-w-5xl flex-col rounded-2xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal header ── */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-white">All Study Materials</h2>
            <p className="text-xs text-muted mt-0.5">
              Select the documents you want to include in your test
            </p>
          </div>
          <div className="flex items-center gap-3">
            {selectedCount > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                <CheckCheck size={12} />
                {selectedCount} selected
              </span>
            )}
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted hover:border-primary/40 hover:text-white transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── Search + Subject tabs ── */}
        <div className="flex flex-col gap-3 border-b border-border px-6 py-3">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or subject..."
              autoFocus
              className="h-9 w-full rounded-lg border border-border bg-bg pl-9 pr-4 text-sm text-white placeholder-muted outline-none focus:border-primary"
            />
          </div>
          {/* Subject filter tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
            <Filter size={12} className="shrink-0 text-muted" />
            {subjectTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSubjectTab(tab.id)}
                className={clsx(
                  'shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-all whitespace-nowrap',
                  subjectTab === tab.id
                    ? 'bg-primary text-bg'
                    : 'border border-border text-muted hover:border-primary/40 hover:text-white',
                )}
              >
                {tab.name}
              </button>
            ))}
          </div>
        </div>

        {/* ── Book grid ── */}
        <div className="flex-1 overflow-y-auto p-6">
          {filtered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <BookOpen size={36} className="mb-3 text-muted/30" />
              <p className="font-medium text-white">No materials found</p>
              <p className="mt-1 text-xs text-muted">Try a different search or subject filter.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {filtered.map((book) => {
                const info     = getFileInfo(book.filename)
                const selected = selectedIds.has(book.id)
                const subject  = book.subject_id ? subjectMap[book.subject_id] : undefined
                return (
                  <button
                    key={book.id}
                    onClick={() => onToggle(book.id)}
                    className={clsx(
                      'relative flex flex-col rounded-xl border p-4 text-left transition-all',
                      selected
                        ? 'border-primary bg-primary/8 shadow-sm shadow-primary/10'
                        : 'border-border bg-bg hover:border-primary/30 hover:bg-primary/5',
                    )}
                  >
                    {/* Checkbox top-right */}
                    <div
                      className={clsx(
                        'absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all',
                        selected ? 'border-primary bg-primary' : 'border-border bg-transparent',
                      )}
                    >
                      {selected && (
                        <svg viewBox="0 0 10 8" className="h-3 w-3 fill-none stroke-bg stroke-[2.5]">
                          <polyline points="1,4 4,7 9,1" />
                        </svg>
                      )}
                    </div>

                    {/* File icon */}
                    <div
                      className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl text-xs font-black"
                      style={{ background: info.bg, color: info.fg }}
                    >
                      {info.ext}
                    </div>

                    {/* Title */}
                    <p className="mb-1 line-clamp-2 text-sm font-semibold text-white leading-snug pr-6">
                      {book.title}
                    </p>

                    {/* Subject badge */}
                    {subject && (
                      <span className="mb-2 inline-block rounded-full bg-border/60 px-2 py-0.5 text-[10px] text-muted">
                        {subject}
                      </span>
                    )}

                    {/* Pages */}
                    <div className="mt-auto flex items-center gap-1 text-[11px] text-muted/70">
                      <FileText size={10} />
                      <span>{book.page_count ?? '?'} pages</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <p className="text-sm text-muted">
            {filtered.length} material{filtered.length !== 1 ? 's' : ''} shown
            {search || subjectTab !== 'all' ? ' (filtered)' : ''}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                // Deselect all currently visible filtered books
                filtered.forEach((b) => { if (selectedIds.has(b.id)) onToggle(b.id) })
              }}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-white transition-colors"
            >
              Clear selection
            </button>
            <button
              onClick={onClose}
              className={clsx(
                'flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-bold transition-all',
                selectedCount > 0
                  ? 'bg-primary text-bg hover:bg-primary-hover'
                  : 'bg-primary/30 text-primary/50 cursor-not-allowed',
              )}
              disabled={selectedCount === 0}
            >
              <CheckCheck size={15} />
              Add {selectedCount > 0 ? selectedCount : ''} to Test
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function TestNew() {
  const { getToken } = useAuth()
  const navigate     = useNavigate()
  const [searchParams] = useSearchParams()

  // Data
  const [books,    setBooks]    = useState<Book[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading,  setLoading]  = useState(true)

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bookSearch,  setBookSearch]  = useState('')

  // Config
  const [testType,      setTestType]      = useState<TestType>('mixed')
  const [difficulty,    setDifficulty]    = useState<Difficulty>('medium')
  const [totalMarks,    setTotalMarks]    = useState<number>(20)
  const [questionCount, setQuestionCount] = useState<number>(20)
  const [timeLimit,     setTimeLimit]     = useState<number | null>(30)
  const [focusArea,     setFocusArea]     = useState('All Topics')
  const [customPrompt,  setCustomPrompt]  = useState('')

  // Generate state
  const [generating,  setGenerating]  = useState(false)

  // Modal
  const [showModal, setShowModal] = useState(false)

  // Scroll ref for book row
  const scrollRef = useRef<HTMLDivElement>(null)

  // ── Load ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const api = makeApi(token)
      const [{ books: allBooks }, { subjects: allSubjects }] = await Promise.all([
        api.books.list(),
        api.subjects.list(),
      ])
      const ready = allBooks.filter((b) => b.status === 'READY')
      setBooks(ready)
      setSubjects(allSubjects)
      setLoading(false)

      // Pre-select from bookId URL param
      const bookId = searchParams.get('bookId')
      if (bookId && ready.some((b) => b.id === bookId)) {
        setSelectedIds(new Set([bookId]))
        return
      }

      // Pre-select from topic URL param (from Needs Revision / Practice button)
      const topic = searchParams.get('topic')
      if (topic) {
        setCustomPrompt(`Practice test focused on: ${topic}`)
        const keywords = topic.toLowerCase().split(/\s+/).filter((k) => k.length > 2)
        const matched = ready.filter((b) =>
          keywords.some((kw) => b.title.toLowerCase().includes(kw))
        )
        // If keywords match specific books, select them; otherwise select all books
        setSelectedIds(new Set(matched.length > 0 ? matched.map((b) => b.id) : ready.map((b) => b.id)))
      }
    }
    load()
  }, [getToken, searchParams])

  // ── Derived ───────────────────────────────────────────────────────────────────
  const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s.name]))

  const filteredBooks = books.filter(
    (b) =>
      b.title.toLowerCase().includes(bookSearch.toLowerCase()) ||
      (b.subject_id && subjectMap[b.subject_id]?.toLowerCase().includes(bookSearch.toLowerCase())),
  )

  const selectedBooks   = books.filter((b) => selectedIds.has(b.id))
  const totalPages      = selectedBooks.reduce((s, b) => s + (b.page_count ?? 0), 0)
  const hasSelection    = selectedIds.size > 0
  const marksPerQ       = Math.max(1, Math.round(totalMarks / questionCount))
  const effectiveMarks  = marksPerQ * questionCount

  // ── Handlers ──────────────────────────────────────────────────────────────────
  function toggleBook(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function scrollBooks(dir: 'left' | 'right') {
    scrollRef.current?.scrollBy({ left: dir === 'right' ? 280 : -280, behavior: 'smooth' })
  }

  async function generate() {
    if (!hasSelection || generating) return
    setGenerating(true)
    try {
      const token = await getToken()
      if (!token) return
      const { test } = await makeApi(token).tests.generate({
        bookIds:          Array.from(selectedIds),
        topic:            focusArea !== 'All Topics' ? focusArea : customPrompt || undefined,
        questionCount,
        type:             testType,
        difficulty,
        durationMinutes:  timeLimit ?? undefined,
        marksPerQuestion: marksPerQ,
      })
      navigate(`/test/${test.id}`)
    } catch (err) {
      alert((err as Error).message)
      setGenerating(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Materials modal ── */}
      {showModal && (
        <MaterialsModal
          books={books}
          subjects={subjects}
          selectedIds={selectedIds}
          onToggle={toggleBook}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* ── Main scrollable area ── */}
      <div className="flex-1 overflow-y-auto pb-24 lg:pb-0">
        <div className="p-4 lg:p-7 space-y-5 lg:space-y-7">

          {/* ── Back button ── */}
          <button
            onClick={() => navigate('/tests')}
            className="flex items-center gap-2 text-sm text-muted hover:text-white transition-colors"
          >
            <ChevronLeft size={16} />
            Back to Tests
          </button>

          {/* ── Page header ── */}
          <div className="flex items-start justify-between">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">Tests</p>
              <h1 className="text-2xl lg:text-3xl font-extrabold">
                <span className="text-white">Create a </span>
                <span className="text-primary">Practice Test</span>
              </h1>
              <p className="mt-1.5 max-w-xl text-sm text-muted">
                Generate a custom test from your study materials.
              </p>
            </div>
            <p className="hidden xl:block text-right text-sm font-semibold italic text-primary leading-relaxed">
              "PRACTICE BUILDS<br />REAL<br />UNDERSTANDING."
            </p>
          </div>

          {/* ── Section 1: Select Study Materials ── */}
          <section>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2.5">
                <SectionBadge n={1} />
                <div>
                  <h2 className="text-base font-bold text-white">Select Study Materials</h2>
                  <p className="text-xs text-muted">Choose one or more documents from your library.</p>
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {selectedIds.size > 0 && (
                  <span className="text-xs font-semibold text-primary">{selectedIds.size} selected</span>
                )}
                {/* Search — desktop only */}
                <div className="relative hidden md:block">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    value={bookSearch}
                    onChange={(e) => setBookSearch(e.target.value)}
                    placeholder="Search your materials..."
                    className="h-8 rounded-lg border border-border bg-surface pl-8 pr-3 text-xs text-white placeholder-muted outline-none focus:border-primary w-48"
                  />
                </div>
                <button
                  onClick={() => setShowModal(true)}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 text-xs font-semibold text-primary hover:bg-primary/20"
                >
                  <span className="hidden md:inline">View All Materials</span>
                  <span className="md:hidden">Browse All</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 size={24} className="animate-spin text-primary" />
              </div>
            ) : books.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-border bg-surface text-center">
                <BookOpen size={28} className="mb-2 text-muted/40" />
                <p className="text-sm font-medium text-white">No ready materials</p>
                <p className="text-xs text-muted">Upload and process a PDF first.</p>
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => scrollBooks('left')}
                  className="absolute -left-3 top-1/2 z-10 -translate-y-1/2 hidden md:flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-md hover:text-white"
                >
                  <ChevronLeft size={14} />
                </button>
                <div
                  ref={scrollRef}
                  className="flex gap-2.5 overflow-x-auto scroll-smooth px-0.5 py-1"
                  style={{ scrollbarWidth: 'none' }}
                >
                  {filteredBooks.map((book) => {
                    const info     = getFileInfo(book.filename)
                    const selected = selectedIds.has(book.id)
                    const subject  = book.subject_id ? subjectMap[book.subject_id] : undefined
                    return (
                      <button
                        key={book.id}
                        onClick={() => toggleBook(book.id)}
                        className={clsx(
                          'relative flex w-32 lg:w-40 shrink-0 flex-col rounded-xl border p-2.5 lg:p-3 text-left transition-all',
                          selected
                            ? 'border-primary bg-primary/5'
                            : 'border-border bg-surface hover:border-primary/30',
                        )}
                      >
                        <div className={clsx(
                          'absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded border transition-colors',
                          selected ? 'border-primary bg-primary' : 'border-border',
                        )}>
                          {selected && (
                            <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 fill-none stroke-bg stroke-2">
                              <polyline points="1,4 4,7 9,1" />
                            </svg>
                          )}
                        </div>
                        <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-black"
                          style={{ background: info.bg, color: info.fg }}>
                          {info.ext}
                        </div>
                        <p className="mb-0.5 line-clamp-2 text-[11px] font-semibold text-white leading-tight pr-4">
                          {book.title}
                        </p>
                        <p className="truncate text-[10px] text-muted">{subject ?? '—'}</p>
                        <div className="mt-2 flex items-center gap-1 text-[10px] text-muted">
                          <FileText size={9} />
                          <span>{book.page_count ?? '?'} pages</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={() => scrollBooks('right')}
                  className="absolute -right-3 top-1/2 z-10 -translate-y-1/2 hidden md:flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-md hover:text-white"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </section>

          {/* ── Section 2: Configure ── */}
          <section>
            <div className="mb-3 flex items-center gap-2.5">
              <SectionBadge n={2} />
              <div>
                <h2 className="text-base font-bold text-white">
                  Configure <span className="text-primary">or</span> Describe
                </h2>
                <p className="text-xs text-muted">Set options or just describe what you need.</p>
              </div>
            </div>

            {/* Desktop: side-by-side — Mobile: stacked */}
            <div className="rounded-xl border border-border bg-surface overflow-hidden">

              {/* ── Guided Options ── */}
              <div className="p-4 lg:p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Layers size={13} className="text-primary" />
                  </div>
                  <p className="text-sm font-bold text-white">Guided Options</p>
                </div>

                {/* Test Type */}
                <div>
                  <p className="mb-2 text-xs font-semibold text-muted uppercase tracking-wide">Test Type</p>
                  <div className="flex flex-wrap gap-2">
                    {TEST_TYPES.map(({ value, label }) => (
                      <PillBtn key={value} active={testType === value} onClick={() => setTestType(value)}>{label}</PillBtn>
                    ))}
                  </div>
                </div>

                {/* Difficulty + Marks — side by side on mobile */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="mb-2 text-xs font-semibold text-muted uppercase tracking-wide">Difficulty</p>
                    <div className="flex flex-wrap gap-1.5">
                      {DIFFICULTIES.map(({ value, label }) => (
                        <PillBtn key={value} active={difficulty === value} onClick={() => setDifficulty(value)}>{label}</PillBtn>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold text-muted uppercase tracking-wide">Total Marks</p>
                    <div className="flex flex-wrap gap-1.5">
                      {MARK_OPTIONS.map((v) => (
                        <PillBtn key={v} active={totalMarks === v} onClick={() => setTotalMarks(v)}>{v}</PillBtn>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Questions + Time — side by side on mobile */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="mb-2 text-xs font-semibold text-muted uppercase tracking-wide">Questions</p>
                    <div className="flex flex-wrap gap-1.5">
                      {COUNT_OPTIONS.map((v) => (
                        <PillBtn key={v} active={questionCount === v} onClick={() => setQuestionCount(v)}>{v}</PillBtn>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold text-muted uppercase tracking-wide">Time Limit</p>
                    <div className="flex flex-wrap gap-1.5">
                      {TIME_OPTIONS.map(({ label, value }) => (
                        <PillBtn key={label} active={timeLimit === value} onClick={() => setTimeLimit(value)}>{label}</PillBtn>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Focus Area */}
                <div>
                  <p className="mb-2 text-xs font-semibold text-muted uppercase tracking-wide">Focus Area (Optional)</p>
                  <input
                    value={focusArea === 'All Topics' ? '' : focusArea}
                    onChange={(e) => setFocusArea(e.target.value || 'All Topics')}
                    placeholder="All Topics"
                    className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-xs text-white placeholder-muted outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* ── OR Divider ── */}
              <div className="flex items-center gap-3 px-4 lg:px-5">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs font-bold text-muted">OR</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* ── Describe ── */}
              <div className="p-4 lg:p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <MessageSquare size={13} className="text-primary" />
                  </div>
                  <p className="text-sm font-bold text-white">Describe Your Requirements</p>
                </div>
                <div className="relative">
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value.slice(0, 500))}
                    rows={4}
                    placeholder={`e.g. "20 mark test, 15 questions, Unit 1 & 2, medium difficulty"`}
                    className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2.5 text-xs text-white placeholder-muted/60 outline-none focus:border-primary leading-relaxed"
                  />
                  <span className="absolute bottom-2.5 right-3 text-[10px] text-muted/60">{customPrompt.length}/500</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_EXAMPLES.map((ex) => (
                    <button key={ex} onClick={() => setCustomPrompt(ex)}
                      className="rounded-full border border-border/60 bg-bg px-2.5 py-1 text-[10px] text-muted transition-colors hover:border-primary/40 hover:text-primary">
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── Test Preview (mobile inline) ── */}
          <section className="md:hidden">
            <div className="mb-3 flex items-center gap-2.5">
              <SectionBadge n={3} />
              <div>
                <h2 className="text-base font-bold text-white">Test Preview</h2>
                <p className="text-xs text-muted">Review your settings before generating.</p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <PreviewRow icon={FileText}    label="Documents"    value={selectedIds.size} />
              <PreviewRow icon={Layers}      label="Test Type"    value={fmtTestType(testType)} />
              <PreviewRow icon={Hash}        label="Questions"    value={questionCount} />
              <PreviewRow icon={BarChart2}   label="Total Marks"  value={effectiveMarks} />
              <PreviewRow icon={Target}      label="Difficulty"   value={difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} />
              <PreviewRow icon={Clock}       label="Time Limit"   value={timeLimit ? `${timeLimit < 60 ? timeLimit + ' min' : '1 hour'}` : 'No limit'} />
            </div>
          </section>

        </div>
      </div>

      {/* ── Right Sidebar: Test Preview (desktop) ── */}
      <div className="hidden md:block w-72 shrink-0 border-l border-border overflow-y-auto">
        <div className="sticky top-0 p-5 space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Eye size={15} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Test Preview</p>
              <p className="text-xs text-muted">Review your test settings.</p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <PreviewRow icon={FileText}   label="Documents"     value={selectedIds.size} />
            <PreviewRow icon={BookMarked} label="Total Pages"   value={totalPages} />
            <PreviewRow icon={Layers}     label="Test Type"     value={fmtTestType(testType)} />
            <PreviewRow icon={Hash}       label="Questions"     value={questionCount} />
            <PreviewRow icon={BarChart2}  label="Total Marks"   value={effectiveMarks} />
            <PreviewRow icon={Target}     label="Difficulty"    value={difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} />
            <PreviewRow icon={Clock}      label="Time Limit"    value={timeLimit ? `${timeLimit < 60 ? timeLimit + ' min' : '1 hour'}` : 'No limit'} />
            <PreviewRow icon={BookOpen}   label="Focus Area"    value={focusArea} />
            <PreviewRow icon={MessageSquare} label="Instructions" value={customPrompt.trim() ? 'Added' : 'None'} />
          </div>
          <div>
            <button
              onClick={generate}
              disabled={!hasSelection || generating}
              className={clsx(
                'flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all',
                hasSelection && !generating
                  ? 'bg-primary text-bg hover:bg-primary-hover shadow-lg shadow-primary/20'
                  : 'bg-primary/30 text-primary/50 cursor-not-allowed',
              )}
            >
              {generating ? <><Loader2 size={16} className="animate-spin" />Generating…</> : <><Sparkles size={16} />Generate Test</>}
            </button>
            <p className="mt-2 text-center text-[10px] text-muted/70 leading-relaxed">
              Your test will be generated using only your selected study materials.
            </p>
          </div>
        </div>
      </div>

      {/* ── Sticky Generate button (mobile only) ── */}
      <div className="md:hidden fixed bottom-16 left-0 right-0 px-4 pb-2 z-40">
        <button
          onClick={generate}
          disabled={!hasSelection || generating}
          className={clsx(
            'flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold shadow-xl transition-all',
            hasSelection && !generating
              ? 'bg-primary text-bg'
              : 'bg-primary/30 text-primary/50 cursor-not-allowed',
          )}
        >
          {generating
            ? <><Loader2 size={16} className="animate-spin" />Generating…</>
            : <><Sparkles size={16} />{hasSelection ? `Generate Test (${selectedIds.size} doc${selectedIds.size > 1 ? 's' : ''})` : 'Select documents first'}</>
          }
        </button>
      </div>

    </div>
  )
}

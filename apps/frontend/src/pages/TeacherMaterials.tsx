/**
 * Teacher Materials — teaching-specific materials management.
 * Completely separate from student Books page.
 * Route: /teacher/materials
 *
 * Actions: Upload material → Create Question Paper (not student tests)
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import {
  Upload,
  Trash2,
  FileText,
  AlertCircle,
  CheckCircle,
  Loader2,
  Search,
  ChevronDown,
  X,
  ScrollText,
  LayoutGrid,
  List,
  MoreHorizontal,
  CloudUpload,
  Tag,
  FolderOpen,
  Eye,
} from 'lucide-react'
import { clsx } from 'clsx'
import { makeApi } from '../lib/api.ts'
import type { Book, Subject } from 'shared'

// ── Constants ──────────────────────────────────────────────────────────────────

const PROCESSING_STATUSES = new Set([
  'UPLOADING', 'UPLOADED', 'EXTRACTING', 'OCR', 'CHUNKING', 'EMBEDDING', 'INDEXING',
])

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  UPLOADING:  { label: 'Uploading',   color: '#60A5FA', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.3)'  },
  UPLOADED:   { label: 'Uploaded',    color: '#60A5FA', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.3)'  },
  EXTRACTING: { label: 'Extracting',  color: '#FBBF24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)'  },
  OCR:        { label: 'OCR',         color: '#FBBF24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)'  },
  CHUNKING:   { label: 'Chunking',    color: '#FB923C', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.3)'  },
  EMBEDDING:  { label: 'Embedding',   color: '#FB923C', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.3)'  },
  INDEXING:   { label: 'Indexing',    color: '#A78BFA', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.3)' },
  READY:      { label: 'Ready',       color: '#22C55E', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)'   },
  FAILED:     { label: 'Failed',      color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)'   },
}

const PROCESSING_LABEL: Record<string, string> = {
  UPLOADING: 'Uploading file…',
  UPLOADED: 'Processing…',
  EXTRACTING: 'Extracting text…',
  OCR: 'Running OCR…',
  CHUNKING: 'Chunking content…',
  EMBEDDING: 'Generating embeddings…',
  INDEXING: 'Indexing for search…',
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Recently Added' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'name',   label: 'Name (A–Z)' },
]

const SUBJECT_COLORS = [
  '#22C55E', '#22D3EE', '#A855F7', '#F97316', '#EF4444',
  '#FBBF24', '#EC4899', '#6366F1', '#14B8A6', '#F43F5E',
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null) {
  if (!bytes) return null
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function subjectColor(index: number) {
  return SUBJECT_COLORS[index % SUBJECT_COLORS.length]
}

function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse bg-border/60 rounded', className)} />
}

// ── File Type Icon ─────────────────────────────────────────────────────────────

function FileTypeIcon({ filename }: { filename: string }) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') {
    return (
      <div className="w-9 h-9 flex items-center justify-center rounded-lg" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
        <FileText size={18} style={{ color: '#EF4444' }} />
      </div>
    )
  }
  if (ext === 'docx' || ext === 'doc') {
    return (
      <div className="w-9 h-9 flex items-center justify-center rounded-lg" style={{ background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)' }}>
        <FileText size={18} style={{ color: '#60A5FA' }} />
      </div>
    )
  }
  return (
    <div className="w-9 h-9 flex items-center justify-center rounded-lg" style={{ background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.2)' }}>
      <FileText size={18} className="text-muted" />
    </div>
  )
}

// ── Status Badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: '#94A3B8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.2)' }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-bold"
      style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}>
      {PROCESSING_STATUSES.has(status) && <Loader2 size={9} className="animate-spin" />}
      {status === 'READY' && <CheckCircle size={9} />}
      {status === 'FAILED' && <AlertCircle size={9} />}
      {meta.label.toUpperCase()}
    </span>
  )
}

// ── Upload Modal ───────────────────────────────────────────────────────────────

interface UploadModalProps {
  subjects: Subject[]
  onClose: () => void
  onUpload: (file: File, title: string, subjectName?: string, author?: string) => Promise<void>
}

function UploadModal({ subjects, onClose, onUpload }: UploadModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [subjectName, setSubjectName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const suggestions = subjectName.trim()
    ? subjects.filter((s) => s.name.toLowerCase().includes(subjectName.toLowerCase()))
    : subjects.slice(0, 5)

  function pickFile(f: File) {
    if (f.size > 200 * 1024 * 1024) { setError('File exceeds 200 MB limit'); return }
    setFile(f)
    setError(null)
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''))
  }

  async function submit() {
    if (!file || !title.trim()) return
    setUploading(true)
    setError(null)
    try {
      await onUpload(file, title.trim(), subjectName.trim() || undefined, author.trim() || undefined)
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-bold text-white">Upload Teaching Material</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:text-white hover:bg-white/5 transition-colors"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) pickFile(f) }}
            onClick={() => fileRef.current?.click()}
            className={clsx('cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors',
              drag ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50')}
          >
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f) }} />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileTypeIcon filename={file.name} />
                <p className="text-sm font-semibold text-white">{file.name}</p>
                <p className="text-xs text-muted">{formatBytes(file.size)}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <CloudUpload size={28} className="text-muted" />
                <p className="text-sm text-muted">Drag & drop or <span className="text-primary">click to browse</span></p>
                <p className="text-xs text-muted/60">PDF, DOC, DOCX · up to 200 MB</p>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">Title <span className="text-red-400">*</span></label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Unit 3 Lecture Notes, Previous Year Papers…"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-white placeholder:text-muted/50 focus:border-primary focus:outline-none transition-colors" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">Author / Source</label>
              <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Optional"
                className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-white placeholder:text-muted/50 focus:border-primary focus:outline-none transition-colors" />
            </div>
            <div className="relative">
              <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">Subject</label>
              <input
                value={subjectName}
                onChange={(e) => { setSubjectName(e.target.value); setShowSuggestions(true) }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="e.g. Physics, Maths…"
                className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-white placeholder:text-muted/50 focus:border-primary focus:outline-none transition-colors"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-lg border border-border bg-surface shadow-xl overflow-hidden">
                  {suggestions.map((s) => (
                    <button key={s.id} type="button"
                      onMouseDown={() => { setSubjectName(s.name); setShowSuggestions(false) }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white/5 transition-colors">
                      <Tag size={12} className="text-muted shrink-0" />{s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2.5 text-sm text-red-400">
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-muted hover:text-white transition-colors">Cancel</button>
          <button onClick={submit} disabled={uploading || !file || !title.trim()}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-bg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete Confirm ─────────────────────────────────────────────────────────────

function DeleteConfirm({ title, onConfirm, onCancel }: { title: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-950/40"><Trash2 size={16} className="text-red-400" /></div>
          <h3 className="font-semibold text-white">Delete Material</h3>
        </div>
        <p className="text-sm text-muted leading-relaxed">
          Permanently delete <span className="text-white font-medium">"{title}"</span>? This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-lg px-4 py-2 text-sm text-muted hover:text-white transition-colors">Cancel</button>
          <button onClick={onConfirm} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors">Delete</button>
        </div>
      </div>
    </div>
  )
}

// ── Stat Card ──────────────────────────────────────────────────────────────────

function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface/80 px-3 py-2 flex-1">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
        {icon}
      </div>
      <div>
        <p className="text-lg font-black text-white leading-none">{value}</p>
        <p className="text-[11px] text-muted leading-tight">{label}</p>
      </div>
    </div>
  )
}

// ── Material Card ──────────────────────────────────────────────────────────────

interface CardProps {
  book: Book
  subject?: Subject
  subjectIndex: number
  onDelete: (book: Book) => void
  onCreatePaper: (book: Book) => void
}

function MaterialCard({ book, subject, subjectIndex, onDelete, onCreatePaper }: CardProps) {
  const isReady = book.status === 'READY'
  const isFailed = book.status === 'FAILED'
  const isProcessing = PROCESSING_STATUSES.has(book.status)
  const [menuOpen, setMenuOpen] = useState(false)
  const sColor = subject ? subjectColor(subjectIndex) : '#94A3B8'

  return (
    <div className="flex flex-col rounded-xl border border-border bg-surface hover:border-border/80 transition-all duration-200 relative overflow-hidden">
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <div className="relative">
            <FileTypeIcon filename={book.filename} />
            <span className="absolute -bottom-1 -right-1 rounded text-[7px] font-black px-0.5"
              style={{ background: book.filename.endsWith('.pdf') ? '#EF4444' : '#60A5FA', color: '#fff' }}>
              {book.filename.split('.').pop()?.toUpperCase()}
            </span>
          </div>
          <div className="relative">
            <button onClick={() => setMenuOpen((v) => !v)}
              className="rounded-lg p-1.5 text-muted hover:text-white hover:bg-white/5 transition-colors">
              <MoreHorizontal size={15} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-36 rounded-lg border border-border bg-surface shadow-xl z-20 py-1 overflow-hidden">
                <button onClick={() => { setMenuOpen(false); onDelete(book) }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-950/30 transition-colors">
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            )}
          </div>
        </div>

        <h3 className="text-sm font-bold text-white leading-tight mb-2 line-clamp-2" title={book.title}>{book.title}</h3>

        {subject && (
          <span className="inline-block self-start rounded-md px-2 py-0.5 text-[10px] font-bold mb-2"
            style={{ background: `${sColor}18`, color: sColor, border: `1px solid ${sColor}40` }}>
            {subject.name}
          </span>
        )}

        <div className="flex items-center gap-3 text-xs text-muted mb-3">
          {book.page_count && <span>{book.page_count} pages</span>}
          {book.page_count && <span>·</span>}
          <span>📅 {formatDate(book.created_at)}</span>
          {book.file_size && <span className="ml-auto">{formatBytes(book.file_size)}</span>}
        </div>

        <StatusBadge status={book.status} />

        {isProcessing && (
          <div className="mt-2">
            <div className="h-1 w-full rounded-full bg-border overflow-hidden">
              <div className="h-full rounded-full bg-amber-400/70 animate-pulse" style={{ width: '65%' }} />
            </div>
            <p className="mt-1 text-[10px] text-muted">{PROCESSING_LABEL[book.status] ?? 'Processing…'}</p>
          </div>
        )}
        {isFailed && book.error_msg && (
          <p className="mt-2 text-[11px] text-red-400/80 leading-relaxed">{book.error_msg}</p>
        )}
      </div>

      <div className="border-t border-border px-4 py-3">
        {isReady && (
          <div className="flex gap-2">
            <button onClick={() => onCreatePaper(book)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-colors"
              style={{ background: 'rgba(34,211,238,0.1)', color: '#22D3EE', border: '1px solid rgba(34,211,238,0.25)' }}>
              <ScrollText size={11} /> Create Paper
            </button>
            <button
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold text-muted hover:text-white hover:bg-white/5 transition-colors border border-border">
              <Eye size={11} /> Preview
            </button>
          </div>
        )}
        {isProcessing && (
          <div className="flex gap-2">
            <button disabled className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold text-muted/40 cursor-not-allowed border border-border/40">
              <ScrollText size={11} /> Create Paper
            </button>
          </div>
        )}
        {isFailed && (
          <button onClick={() => onDelete(book)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold text-red-400 hover:bg-red-950/30 transition-colors border border-red-900/40">
            <Trash2 size={11} /> Delete
          </button>
        )}
      </div>
    </div>
  )
}

// ── Material Row (List view) ───────────────────────────────────────────────────

function MaterialRow({ book, subject, subjectIndex, onDelete, onCreatePaper }: CardProps) {
  const isReady = book.status === 'READY'
  const isFailed = book.status === 'FAILED'
  const sColor = subject ? subjectColor(subjectIndex) : '#94A3B8'

  return (
    <div className="group flex items-center gap-4 border-b border-border px-5 py-3 hover:bg-white/[0.02] transition-colors last:border-b-0">
      <div className="relative shrink-0">
        <FileTypeIcon filename={book.filename} />
        <span className="absolute -bottom-1 -right-1 rounded text-[6px] font-black px-0.5"
          style={{ background: book.filename.endsWith('.pdf') ? '#EF4444' : '#60A5FA', color: '#fff' }}>
          {book.filename.split('.').pop()?.toUpperCase()}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{book.title}</p>
        <p className="text-[10px] text-muted truncate">{book.filename}{book.author ? ` · ${book.author}` : ''}</p>
      </div>
      {subject && (
        <span className="hidden sm:inline shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold"
          style={{ background: `${sColor}18`, color: sColor, border: `1px solid ${sColor}40` }}>
          {subject.name}
        </span>
      )}
      <div className="hidden md:flex items-center gap-3 shrink-0 text-xs text-muted">
        {book.page_count && <span>{book.page_count}p</span>}
        <span>{formatDate(book.created_at)}</span>
      </div>
      <StatusBadge status={book.status} />
      <div className="flex shrink-0 items-center gap-1.5">
        {isReady && (
          <button onClick={() => onCreatePaper(book)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors"
            style={{ background: 'rgba(34,211,238,0.1)', color: '#22D3EE', border: '1px solid rgba(34,211,238,0.25)' }}>
            <ScrollText size={10} /> Create Paper
          </button>
        )}
        {isFailed && (
          <button onClick={() => onDelete(book)}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-red-400 hover:bg-red-950/30 border border-red-900/40 transition-colors">
            <Trash2 size={10} /> Delete
          </button>
        )}
        <button onClick={() => onDelete(book)}
          className="rounded-lg p-1.5 text-muted opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-950/30 transition-all">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function TeacherMaterials() {
  const { getToken } = useAuth()
  const navigate = useNavigate()

  const [books, setBooks] = useState<Book[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null)
  const [search, setSearch] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try {
      const token = await getToken()
      if (!token) return
      const api = makeApi(token)
      const [booksRes, subjectsRes] = await Promise.allSettled([
        api.books.list(undefined, 'teacher'),
        api.subjects.list(),
      ])
      if (booksRes.status === 'fulfilled') setBooks(booksRes.value.books)
      if (subjectsRes.status === 'fulfilled') setSubjects(subjectsRes.value.subjects)
    } finally {
      setLoading(false)
    }
  }, [getToken])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const hasProcessing = books.some((b) => PROCESSING_STATUSES.has(b.status))
    if (hasProcessing && !pollRef.current) {
      pollRef.current = setInterval(load, 4000)
    } else if (!hasProcessing && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [books, load])

  async function handleUpload(file: File, title: string, subjectName?: string, author?: string) {
    const token = await getToken()
    if (!token) throw new Error('Not authenticated')
    const api = makeApi(token)

    let resolvedSubjectId: string | undefined
    if (subjectName) {
      const existing = subjects.find((s) => s.name.toLowerCase() === subjectName.toLowerCase())
      if (existing) {
        resolvedSubjectId = existing.id
      } else {
        try {
          const { subject } = await api.subjects.create({ name: subjectName })
          resolvedSubjectId = subject.id
          setSubjects((prev) => [...prev, subject])
        } catch { /* proceed without subject */ }
      }
    }

    const { book } = await api.books.upload(file, title, resolvedSubjectId, author, 'teacher')
    setBooks((prev) => [book, ...prev])
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const token = await getToken()
    if (!token) return
    await makeApi(token).books.delete(deleteTarget.id)
    setBooks((prev) => prev.filter((b) => b.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  function handleCreatePaper(book: Book) {
    navigate(`/question-papers?bookId=${book.id}`)
  }

  const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s]))
  const subjectIndexMap = Object.fromEntries(subjects.map((s, i) => [s.id, i]))

  const filtered = books
    .filter((b) => {
      if (filterStatus && b.status !== filterStatus) return false
      if (filterSubject && b.subject_id !== filterSubject) return false
      if (search) {
        const q = search.toLowerCase()
        const sName = b.subject_id ? (subjectMap[b.subject_id]?.name ?? '') : ''
        return b.title.toLowerCase().includes(q) || b.filename.toLowerCase().includes(q) || sName.toLowerCase().includes(q)
      }
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.title.localeCompare(b.title)
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  const stats = {
    total:      books.length,
    ready:      books.filter((b) => b.status === 'READY').length,
    processing: books.filter((b) => PROCESSING_STATUSES.has(b.status)).length,
    failed:     books.filter((b) => b.status === 'FAILED').length,
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── Single scroll container — header + stats scroll away, toolbar sticks ── */}
      <div className="flex-1 overflow-y-auto min-h-0">

        {/* ── Header (scrolls away) ── */}
        <div className="px-4 md:px-6 pt-4 md:pt-6 pb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted mb-0.5">Teacher Mode</p>
            <h1 className="text-xl md:text-2xl font-black text-white leading-tight">
              Teaching{' '}
              <span className="text-primary" style={{ textShadow: '0 0 30px rgba(34,211,238,0.4)' }}>
                Materials
              </span>
            </h1>
            <p className="mt-1 text-xs text-muted max-w-md leading-relaxed hidden md:block">
              Upload lecture notes, question banks, syllabi, or reference PDFs. Use them to generate question papers with AI.
            </p>
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-bg hover:bg-primary-hover transition-colors md:shrink-0"
          >
            <Upload size={15} /> Upload Material
          </button>
        </div>

        {/* ── Stats Row (scrolls away) ── */}
        {!loading && (
          <div className="flex gap-2.5 px-4 md:px-6 py-2 overflow-x-auto scrollbar-none">
            <StatCard icon={<FileText size={16} style={{ color: '#22D3EE' }} />}    value={stats.total}      label="Total Materials" color="#22D3EE" />
            <StatCard icon={<CheckCircle size={16} style={{ color: '#22C55E' }} />} value={stats.ready}      label="Ready"           color="#22C55E" />
            <StatCard icon={<div className="w-[16px] h-[16px] rounded-full" style={{ border: '2.5px solid #F97316' }} />} value={stats.processing} label="Processing" color="#F97316" />
            <StatCard icon={<AlertCircle size={16} style={{ color: '#EF4444' }} />} value={stats.failed}     label="Failed"          color="#EF4444" />
          </div>
        )}

        {/* ── Toolbar — sticks to top when header scrolls away ── */}
        <div className="sticky top-0 z-10 bg-bg border-y border-border px-4 md:px-6 py-2 space-y-2">
          {!loading && (
            <div className="space-y-2">
              {/* Search — full width */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search materials by title or subject…"
                  className="w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm text-white placeholder:text-muted/50 focus:border-primary focus:outline-none transition-colors" />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-white"><X size={12} /></button>
                )}
              </div>

              {/* Filters + view toggle — scrollable on mobile */}
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
                {subjects.length > 0 && (
                  <div className="relative shrink-0">
                    <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}
                      className="appearance-none rounded-lg border border-border bg-surface pl-3 pr-6 py-2 text-xs text-white focus:border-primary focus:outline-none transition-colors">
                      <option value="">All Subjects</option>
                      {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <ChevronDown size={11} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted" />
                  </div>
                )}

                <div className="relative shrink-0">
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                    className="appearance-none rounded-lg border border-border bg-surface pl-3 pr-6 py-2 text-xs text-white focus:border-primary focus:outline-none transition-colors">
                    <option value="">All Status</option>
                    {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <ChevronDown size={11} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted" />
                </div>

                <div className="relative shrink-0">
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                    className="appearance-none rounded-lg border border-border bg-surface pl-3 pr-6 py-2 text-xs text-white focus:border-primary focus:outline-none transition-colors">
                    {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <ChevronDown size={11} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted" />
                </div>

                <div className="ml-auto shrink-0 flex items-center rounded-lg border border-border overflow-hidden">
                  <button onClick={() => setViewMode('grid')}
                    className={clsx('p-2 transition-colors', viewMode === 'grid' ? 'bg-primary/15 text-primary' : 'text-muted hover:text-white hover:bg-white/5')}>
                    <LayoutGrid size={15} />
                  </button>
                  <button onClick={() => setViewMode('list')}
                    className={clsx('p-2 transition-colors', viewMode === 'list' ? 'bg-primary/15 text-primary' : 'text-muted hover:text-white hover:bg-white/5')}>
                    <List size={15} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Content ── */}
        <div className="px-4 md:px-6 pt-3 pb-24 md:pb-4 space-y-3">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-surface p-4 space-y-3">
                  <div className="flex items-start justify-between"><Skeleton className="w-9 h-9" /><Skeleton className="w-5 h-5" /></div>
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-2.5 w-1/3" />
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>

          ) : books.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface">
                <FolderOpen size={28} className="text-muted/50" />
              </div>
              <h2 className="text-lg font-black text-white">No teaching materials yet</h2>
              <p className="mt-2 max-w-sm text-sm text-muted leading-relaxed">
                Upload your first lecture note, syllabus, or question bank PDF and use it to generate AI-powered question papers.
              </p>
              <button onClick={() => setShowUpload(true)}
                className="mt-6 flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-bg hover:bg-primary-hover transition-colors">
                <Upload size={15} /> Upload Material
              </button>
            </div>

          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Search size={28} className="mb-3 text-muted/40" />
              <p className="text-sm font-medium text-white">No materials match your filters</p>
              <button onClick={() => { setSearch(''); setFilterSubject(''); setFilterStatus('') }}
                className="mt-2 text-xs text-primary hover:underline">Clear filters</button>
            </div>

          ) : viewMode === 'grid' ? (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {filtered.map((book) => (
                <MaterialCard key={book.id} book={book}
                  subject={book.subject_id ? subjectMap[book.subject_id] : undefined}
                  subjectIndex={book.subject_id ? (subjectIndexMap[book.subject_id] ?? 0) : 0}
                  onDelete={setDeleteTarget} onCreatePaper={handleCreatePaper} />
              ))}
              <div onClick={() => setShowUpload(true)}
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border hover:border-primary/40 bg-surface/40 cursor-pointer transition-colors p-6 text-center min-h-[180px]">
                <CloudUpload size={28} className="text-primary mb-3" />
                <p className="text-sm font-bold text-white">Upload More</p>
                <p className="text-xs text-muted mt-1">Drop files or <span className="text-primary">browse</span></p>
              </div>
            </div>

          ) : (
            <div className="rounded-xl border border-border bg-surface overflow-hidden">
              {filtered.map((book) => (
                <MaterialRow key={book.id} book={book}
                  subject={book.subject_id ? subjectMap[book.subject_id] : undefined}
                  subjectIndex={book.subject_id ? (subjectIndexMap[book.subject_id] ?? 0) : 0}
                  onDelete={setDeleteTarget} onCreatePaper={handleCreatePaper} />
              ))}
            </div>
          )}
        </div>

      </div>{/* end scroll container */}

      {showUpload && <UploadModal subjects={subjects} onClose={() => setShowUpload(false)} onUpload={handleUpload} />}
      {deleteTarget && <DeleteConfirm title={deleteTarget.title} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />}
    </div>
  )
}

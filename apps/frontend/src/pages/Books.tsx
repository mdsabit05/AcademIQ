import { useEffect, useRef, useState, useCallback } from 'react'
import mybookImg from '../assets/mybook.png'
import mybookLightImg from '../assets/mybookLight.png'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.ts'
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
  Sparkles,
  ClipboardList,
  LayoutGrid,
  List,
  MoreHorizontal,
  CloudUpload,
  Lightbulb,
  ArrowRight,
  FolderOpen,
  Eye,
  Tag,
} from 'lucide-react'
import { clsx } from 'clsx'
import { makeApi } from '../lib/api.ts'
import { useTheme } from '../lib/theme.tsx'
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

// Cycling processing label for animation
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

function FileTypeIcon({ filename, large = false }: { filename: string; large?: boolean }) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const size = large ? 26 : 18

  if (ext === 'pdf') {
    return (
      <div
        className={clsx('relative flex flex-col items-center justify-center rounded-xl gap-0.5', large ? 'w-14 h-14' : 'w-9 h-9 rounded-lg')}
        style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}
      >
        <FileText size={size} style={{ color: '#EF4444' }} />
        {large && <span className="text-[7px] font-black leading-none" style={{ color: '#EF4444' }}>PDF</span>}
      </div>
    )
  }
  if (ext === 'docx' || ext === 'doc') {
    return (
      <div
        className={clsx('relative flex flex-col items-center justify-center rounded-xl gap-0.5', large ? 'w-14 h-14' : 'w-9 h-9 rounded-lg')}
        style={{ background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)' }}
      >
        <FileText size={size} style={{ color: '#60A5FA' }} />
        {large && <span className="text-[7px] font-black leading-none" style={{ color: '#60A5FA' }}>DOCX</span>}
      </div>
    )
  }
  return (
    <div
      className={clsx('relative flex flex-col items-center justify-center rounded-xl gap-0.5', large ? 'w-14 h-14' : 'w-9 h-9 rounded-lg')}
      style={{ background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.2)' }}
    >
      <FileText size={size} className="text-muted" />
      {large && <span className="text-[7px] font-black leading-none text-muted">FILE</span>}
    </div>
  )
}

// ── Status Badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: '#94A3B8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.2)' }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-bold"
      style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}
    >
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

  // Suggestions: existing subjects filtered by typed input
  const suggestions = subjectName.trim()
    ? subjects.filter((s) => s.name.toLowerCase().includes(subjectName.toLowerCase()))
    : subjects.slice(0, 5)
  const [showSuggestions, setShowSuggestions] = useState(false)

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
          <h2 className="font-bold text-white">Upload Study Material</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:text-white hover:bg-white/5 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) pickFile(f) }}
            onClick={() => fileRef.current?.click()}
            className={clsx(
              'cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors',
              drag ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            )}
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
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. DBMS Unit 2 Notes"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-white placeholder:text-muted/50 focus:border-primary focus:outline-none transition-colors" />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
                    <button
                      key={s.id}
                      type="button"
                      onMouseDown={() => { setSubjectName(s.name); setShowSuggestions(false) }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white/5 transition-colors"
                    >
                      <Tag size={12} className="text-muted shrink-0" />
                      {s.name}
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

function DeleteConfirm({ title, onConfirm, onCancel, deleting }: { title: string; onConfirm: () => void; onCancel: () => void; deleting?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-950/40">
            <Trash2 size={16} className="text-red-400" />
          </div>
          <h3 className="font-semibold text-white">Delete Document</h3>
        </div>
        <p className="text-sm text-muted leading-relaxed">
          Permanently delete <span className="text-white font-medium">"{title}"</span> and all its AI-indexed content? This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onCancel} disabled={deleting} className="rounded-lg px-4 py-2 text-sm text-muted hover:text-white transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={deleting} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Document Card ──────────────────────────────────────────────────────────────

interface CardProps {
  book: Book
  subject?: Subject
  subjectIndex: number
  onDelete: (book: Book) => void
  onRename: (id: string, newTitle: string) => void
  onAskAI: (book: Book) => void
  onCreateTest: (book: Book) => void
  onView: (book: Book) => void
}

function DocumentCard({ book, subject, subjectIndex, onDelete, onRename, onAskAI, onCreateTest, onView }: CardProps) {
  const isReady = book.status === 'READY'
  const isFailed = book.status === 'FAILED'
  const isProcessing = PROCESSING_STATUSES.has(book.status)
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameVal, setRenameVal] = useState(book.title)
  const renameRef = useRef<HTMLInputElement>(null)
  const sColor = subject ? subjectColor(subjectIndex) : '#94A3B8'

  function startRename() {
    setRenameVal(book.title)
    setRenaming(true)
    setMenuOpen(false)
    setTimeout(() => { renameRef.current?.select() }, 0)
  }

  function commitRename() {
    const t = renameVal.trim()
    setRenaming(false)
    if (t && t !== book.title) onRename(book.id, t)
  }

  return (
    <div className="flex flex-col rounded-xl border border-border bg-surface hover:border-border/80 transition-all duration-200 relative overflow-hidden">
      {/* Card body */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Top row: icon + menu */}
        <div className="flex items-start justify-between mb-3">
          <div className="relative">
            <FileTypeIcon filename={book.filename} />
            <span className="absolute -bottom-1 -right-1 rounded text-[7px] font-black px-0.5"
              style={{
                background: book.filename.endsWith('.pdf') ? '#EF4444' : '#60A5FA',
                color: '#fff',
              }}>
              {book.filename.split('.').pop()?.toUpperCase()}
            </span>
          </div>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-lg p-1.5 text-muted hover:text-white hover:bg-white/5 transition-colors"
            >
              <MoreHorizontal size={15} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-36 rounded-lg border border-border bg-surface shadow-xl z-20 py-1 overflow-hidden">
                <button
                  onClick={startRename}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted hover:text-white hover:bg-white/5 transition-colors"
                >
                  <Tag size={12} /> Rename
                </button>
                <div className="h-px bg-border/50 mx-2 my-0.5" />
                <button
                  onClick={() => { setMenuOpen(false); onDelete(book) }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-950/30 transition-colors"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Title — inline rename or static */}
        {renaming ? (
          <input
            ref={renameRef}
            value={renameVal}
            onChange={(e) => setRenameVal(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setRenaming(false)
            }}
            className="mb-2 w-full rounded border border-primary bg-bg px-2 py-1 text-sm font-bold text-white focus:outline-none"
          />
        ) : (
        <h3 className="text-sm font-bold text-white leading-tight mb-2 line-clamp-2" title={book.title}>
          {book.title}
        </h3>
        )}

        {/* Subject badge */}
        {subject && (
          <span
            className="inline-block self-start rounded-md px-2 py-0.5 text-[10px] font-bold mb-2"
            style={{ background: `${sColor}18`, color: sColor, border: `1px solid ${sColor}40` }}
          >
            {subject.name}
          </span>
        )}

        {/* Meta: pages + date */}
        <div className="flex items-center gap-3 text-xs text-muted mb-3">
          {book.page_count && <span>{book.page_count} pages</span>}
          {book.page_count && <span>·</span>}
          <span className="flex items-center gap-1">
            📅 {formatDate(book.created_at)}
          </span>
          {book.file_size && <span className="ml-auto">{formatBytes(book.file_size)}</span>}
        </div>

        {/* Status */}
        <StatusBadge status={book.status} />

        {/* Processing info */}
        {isProcessing && (
          <div className="mt-2">
            <div className="h-1 w-full rounded-full bg-border overflow-hidden">
              <div className="h-full rounded-full bg-amber-400/70 animate-pulse" />
            </div>
            <p className="mt-1 text-[10px] text-muted">{PROCESSING_LABEL[book.status] ?? 'Processing…'}</p>
          </div>
        )}

        {/* Error message */}
        {isFailed && book.error_msg && (
          <p className="mt-2 text-[11px] text-red-400/80 leading-relaxed">{book.error_msg}</p>
        )}
      </div>

      {/* Action row */}
      <div className="border-t border-border px-4 py-3">
        {isReady && (
          <div className="flex gap-2">
            <button
              onClick={() => onAskAI(book)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-colors"
              style={{ background: 'rgba(34,211,238,0.1)', color: '#22D3EE', border: '1px solid rgba(34,211,238,0.25)' }}
            >
              <Sparkles size={11} /> Ask AI
            </button>
            <button
              onClick={() => onCreateTest(book)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold text-muted hover:text-white hover:bg-white/5 transition-colors border border-border"
            >
              <ClipboardList size={11} /> Create Test
            </button>
            <button
              onClick={() => onView(book)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold text-muted/50 hover:text-muted transition-colors"
            >
              <Eye size={11} /> View
            </button>
          </div>
        )}
        {isProcessing && (
          <div className="flex gap-2">
            <button disabled className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold text-muted/40 cursor-not-allowed border border-border/40">
              <Sparkles size={11} /> Ask AI
            </button>
            <button disabled className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold text-muted/40 cursor-not-allowed border border-border/40">
              <Eye size={11} /> View Progress
            </button>
          </div>
        )}
        {isFailed && (
          <div className="flex gap-2">
            <button
              onClick={() => onDelete(book)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold text-red-400 hover:bg-red-950/30 transition-colors border border-red-900/40"
            >
              <Trash2 size={11} /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Document Row (List view — card style) ─────────────────────────────────────

function DocumentRow({ book, subject, subjectIndex, onDelete, onRename, onAskAI, onCreateTest, onView }: CardProps) {
  const isReady = book.status === 'READY'
  const isFailed = book.status === 'FAILED'
  const isProcessing = PROCESSING_STATUSES.has(book.status)
  const sColor = subject ? subjectColor(subjectIndex) : '#94A3B8'
  const [renaming, setRenaming] = useState(false)
  const [renameVal, setRenameVal] = useState(book.title)
  const renameRef = useRef<HTMLInputElement>(null)

  function startRename() {
    setRenameVal(book.title)
    setRenaming(true)
    setTimeout(() => { renameRef.current?.select() }, 0)
  }

  function commitRename() {
    const t = renameVal.trim()
    setRenaming(false)
    if (t && t !== book.title) onRename(book.id, t)
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Card body */}
      <div className="flex items-start gap-3 p-3.5">
        {/* Large file icon */}
        <div className="shrink-0">
          <FileTypeIcon filename={book.filename} large />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            {renaming ? (
              <input
                ref={renameRef}
                value={renameVal}
                onChange={(e) => setRenameVal(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') setRenaming(false)
                }}
                className="flex-1 rounded border border-primary bg-bg px-2 py-0.5 text-sm font-bold text-white focus:outline-none"
              />
            ) : (
            <h3
              className="text-sm font-bold text-white leading-tight line-clamp-2 flex-1 cursor-text"
              onDoubleClick={startRename}
              title="Double-click to rename"
            >
              {book.title}
            </h3>
            )}
            {/* Actions: rename + delete */}
            <div className="shrink-0 flex items-center gap-0.5">
              <button
                onClick={startRename}
                className="rounded-lg p-1 text-muted hover:text-white hover:bg-white/5 transition-all"
                title="Rename"
              >
                <Tag size={13} />
              </button>
              <button
                onClick={() => onDelete(book)}
                className="rounded-lg p-1 text-muted hover:text-red-400 hover:bg-red-950/30 transition-all"
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-1 text-[11px] text-muted">
            {book.page_count && <span>{book.page_count} pages</span>}
            {book.page_count && <span>·</span>}
            <span>{formatDate(book.created_at)}</span>
            {book.file_size && <><span>·</span><span>{formatBytes(book.file_size)}</span></>}
          </div>

          {/* Subject badge */}
          {subject && (
            <span
              className="inline-block mt-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold"
              style={{ background: `${sColor}18`, color: sColor, border: `1px solid ${sColor}40` }}
            >
              {subject.name}
            </span>
          )}

          {/* Status + processing bar */}
          <div className="mt-2">
            <StatusBadge status={book.status} />
            {isProcessing && (
              <div className="mt-1.5">
                <div className="h-1 w-full rounded-full bg-border overflow-hidden">
                  <div className="h-full rounded-full bg-amber-400/70 animate-pulse" />
                </div>
                <p className="mt-0.5 text-[10px] text-muted">{PROCESSING_LABEL[book.status] ?? 'Processing…'}</p>
              </div>
            )}
            {isFailed && book.error_msg && (
              <p className="mt-1 text-[11px] text-red-400/80 leading-relaxed">{book.error_msg}</p>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons row */}
      <div className="border-t border-border px-3.5 py-2.5 flex gap-2">
        {isReady ? (
          <>
            <button
              onClick={() => onAskAI(book)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-colors"
              style={{ background: 'rgba(34,211,238,0.1)', color: '#22D3EE', border: '1px solid rgba(34,211,238,0.25)' }}
            >
              <Sparkles size={11} /> Ask AI
            </button>
            <button
              onClick={() => onCreateTest(book)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold text-muted hover:text-white hover:bg-white/5 transition-colors border border-border"
            >
              <ClipboardList size={11} /> Create Test
            </button>
            <button
              onClick={() => onView(book)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold text-muted/50 hover:text-muted transition-colors"
            >
              <Eye size={11} /> View
            </button>
          </>
        ) : isFailed ? (
          <button
            onClick={() => onDelete(book)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold text-red-400 hover:bg-red-950/30 transition-colors border border-red-900/40"
          >
            <Trash2 size={11} /> Delete
          </button>
        ) : (
          <>
            <button disabled className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold text-muted/30 cursor-not-allowed border border-border/30">
              <Sparkles size={11} /> Ask AI
            </button>
            <button disabled className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold text-muted/30 cursor-not-allowed border border-border/30">
              <ClipboardList size={11} /> Create Test
            </button>
            <button disabled className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold text-muted/30 cursor-not-allowed border border-border/30">
              <Eye size={11} /> View
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Stat Card ──────────────────────────────────────────────────────────────────

function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface/80 px-3 py-2 shrink-0 min-w-[120px] flex-1">
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

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function Books() {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const [books, setBooks] = useState<Book[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const dropRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try {
      const token = await getToken()
      if (!token) return
      const api = makeApi(token)
      const [booksRes, subjectsRes] = await Promise.allSettled([
        api.books.list(undefined, 'student'),
        api.subjects.list(),
      ])
      if (booksRes.status === 'fulfilled') setBooks(booksRes.value.books)
      if (subjectsRes.status === 'fulfilled') setSubjects(subjectsRes.value.subjects)
    } catch (e) {
      console.error('[Books] load error:', e)
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
      // Reuse existing subject (case-insensitive) or create new
      const existing = subjects.find((s) => s.name.toLowerCase() === subjectName.toLowerCase())
      if (existing) {
        resolvedSubjectId = existing.id
      } else {
        try {
          const { subject } = await api.subjects.create({ name: subjectName })
          resolvedSubjectId = subject.id
          setSubjects((prev) => [...prev, subject])
        } catch {
          // Subject creation may be restricted by role — proceed without subject
        }
      }
    }

    const { book } = await api.books.upload(file, title, resolvedSubjectId, author, 'student')
    setBooks((prev) => [book, ...prev])
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return
    const bookToDelete = deleteTarget
    // Optimistic: remove immediately
    setBooks((prev) => prev.filter((b) => b.id !== bookToDelete.id))
    setDeleteTarget(null)
    setDeleting(true)
    try {
      const token = await getToken()
      if (!token) return
      await makeApi(token).books.delete(bookToDelete.id)
    } catch (e) {
      console.error('[Books] delete error:', e)
      // Revert on failure
      setBooks((prev) => [...prev, bookToDelete].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
    } finally {
      setDeleting(false)
    }
  }

  async function handleRename(id: string, newTitle: string) {
    const prev = books.find((b) => b.id === id)
    if (!prev) return
    // Optimistic update
    setBooks((bs) => bs.map((b) => b.id === id ? { ...b, title: newTitle } : b))
    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      await makeApi(token).books.update(id, { title: newTitle })
    } catch (e) {
      console.error('[Books] rename error:', e)
      // Revert
      setBooks((bs) => bs.map((b) => b.id === id ? { ...b, title: prev.title } : b))
    }
  }

  function handleAskAI(book: Book) { navigate(`/tutor?bookId=${book.id}`) }
  function handleCreateTest(book: Book) { navigate(`/test/new?bookId=${book.id}`) }
  async function handleView(book: Book) {
    const token = await getToken()
    if (!token) return
    try {
      await makeApi(token).books.openFile(book.id)
    } catch (e) {
      console.error('[Books] view error:', e)
    }
  }

  // Derived
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

      {/* Single scroll container — hero + stats scroll away, toolbar sticks */}
      <div className="flex-1 overflow-y-auto min-h-0">

        {/* ── Hero Header ───────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden" style={{ height: 130 }}>
          <div className="absolute inset-0" style={{
            backgroundImage: `url(${isLight ? mybookLightImg : mybookImg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center center',
            backgroundRepeat: 'no-repeat',
            opacity: 0.7,
          }} />
          <div className="absolute inset-0 books-hero-left" />
          <div className="absolute bottom-0 left-0 right-0 h-1/3 books-hero-bottom" />
          <div className="relative flex items-center gap-6 px-4 md:px-6 h-full">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted mb-0.5">My Books</p>
              <h1 className="text-2xl font-black text-white leading-tight">
                Your Study{' '}
                <span className="text-primary" style={{ textShadow: '0 0 30px rgba(34,211,238,0.4)' }}>
                  Materials
                </span>
              </h1>
              <p className="mt-1 text-xs text-muted max-w-md leading-relaxed hidden sm:block">
                Upload your lecture notes, PDFs, assignments, or any study material. We'll organise them and help you learn better.
              </p>
            </div>
            <button
              onClick={() => setShowUpload(true)}
              className="shrink-0 flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-bg hover:bg-primary-hover transition-colors"
            >
              <Upload size={13} /> Upload
            </button>
          </div>
        </div>

        {/* ── Stats Row (scrollable on mobile, scrolls away with hero) ──────── */}
        {!loading && (
          <div className="flex gap-2.5 px-3 md:px-6 py-2 overflow-x-auto scrollbar-none">
            <StatCard icon={<FileText size={16} style={{ color: '#22D3EE' }} />}   value={stats.total}      label="Total Documents" color="#22D3EE" />
            <StatCard icon={<CheckCircle size={16} style={{ color: '#22C55E' }} />} value={stats.ready}      label="Ready"           color="#22C55E" />
            <StatCard icon={<div className="w-[16px] h-[16px] rounded-full" style={{ border: '2.5px solid #F97316' }} />} value={stats.processing} label="Processing" color="#F97316" />
            <StatCard icon={<AlertCircle size={16} style={{ color: '#EF4444' }} />} value={stats.failed}     label="Failed"          color="#EF4444" />
          </div>
        )}

        {/* ── Toolbar — sticks to top when hero scrolls away ──────────────── */}
        <div className="sticky top-0 z-10 bg-bg border-b border-border px-3 md:px-6 py-2 space-y-2">
        {!loading && (
          <div className="space-y-2">
            {/* Search bar — full width */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search documents…"
                className="w-full rounded-lg border border-border bg-surface pl-9 pr-8 py-2.5 text-sm text-white placeholder:text-muted/50 focus:border-primary focus:outline-none transition-colors"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-white">
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Filters + view toggle row — scrollable on mobile */}
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
                  <LayoutGrid size={14} />
                </button>
                <button onClick={() => setViewMode('list')}
                  className={clsx('p-2 transition-colors', viewMode === 'list' ? 'bg-primary/15 text-primary' : 'text-muted hover:text-white hover:bg-white/5')}>
                  <List size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
        </div>{/* end sticky toolbar */}

        {/* ── Content ───────────────────────────────────────────────────────── */}
        <div className="px-3 md:px-6 pb-6 pt-3 space-y-2.5">

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-surface p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <Skeleton className="w-9 h-9" />
                  <Skeleton className="w-5 h-5" />
                </div>
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-2.5 w-1/3" />
                <Skeleton className="h-2.5 w-1/2" />
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>

        ) : books.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface">
              <FolderOpen size={28} className="text-muted/50" />
            </div>
            <h2 className="text-lg font-black text-white">No study material yet</h2>
            <p className="mt-2 max-w-sm text-sm text-muted leading-relaxed">
              Upload your first PDF or study document and AcademIQ will turn it into searchable learning material.
            </p>
            <button
              onClick={() => setShowUpload(true)}
              className="mt-6 flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-bg hover:bg-primary-hover transition-colors"
            >
              <Upload size={15} /> Upload Document
            </button>
          </div>

        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search size={28} className="mb-3 text-muted/40" />
            <p className="text-sm font-medium text-white">No documents match your search</p>
            <button onClick={() => { setSearch(''); setFilterSubject(''); setFilterStatus('') }}
              className="mt-2 text-xs text-primary hover:underline">Clear filters</button>
          </div>

        ) : viewMode === 'grid' ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((book) => (
              <DocumentCard
                key={book.id}
                book={book}
                subject={book.subject_id ? subjectMap[book.subject_id] : undefined}
                subjectIndex={book.subject_id ? (subjectIndexMap[book.subject_id] ?? 0) : 0}
                onDelete={setDeleteTarget}
                onRename={handleRename}
                onAskAI={handleAskAI}
                onCreateTest={handleCreateTest}
                onView={handleView}
              />
            ))}
            {/* Upload More card */}
            <div
              ref={dropRef}
              onClick={() => setShowUpload(true)}
              className="flex flex-col rounded-xl border-2 border-dashed border-border hover:border-primary/40 bg-surface/40 cursor-pointer transition-colors"
            >
              <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
                <CloudUpload size={28} className="text-primary mb-3" />
                <p className="text-sm font-bold text-white">Upload More Documents</p>
                <p className="text-xs text-muted mt-1">
                  Drag & drop files here or <span className="text-primary">click to browse</span>
                </p>
                <p className="text-xs text-muted mt-1">PDF, DOC, DOCX up to 200MB</p>
              </div>
            </div>
          </div>

        ) : (
          /* List view — stacked cards with upload card at top */
          <div className="space-y-2.5">
            {/* Upload card */}
            <button
              onClick={() => setShowUpload(true)}
              className="w-full flex items-center gap-3 rounded-xl border-2 border-dashed border-border hover:border-primary/40 bg-surface/40 px-4 py-3.5 transition-colors text-left"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                <CloudUpload size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Upload Document</p>
                <p className="text-xs text-muted">PDF, DOC, DOCX · up to 200 MB</p>
              </div>
              <div className="ml-auto shrink-0 rounded-lg bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-bold text-primary">
                + Add
              </div>
            </button>

            {filtered.map((book) => (
              <DocumentRow
                key={book.id}
                book={book}
                subject={book.subject_id ? subjectMap[book.subject_id] : undefined}
                subjectIndex={book.subject_id ? (subjectIndexMap[book.subject_id] ?? 0) : 0}
                onDelete={setDeleteTarget}
                onRename={handleRename}
                onAskAI={handleAskAI}
                onCreateTest={handleCreateTest}
                onView={handleView}
              />
            ))}
          </div>
        )}

        {/* ── Tips Bar ──────────────────────────────────────────────────────── */}
        {!loading && (
          <div className="flex items-center gap-4 rounded-xl border border-border bg-surface px-5 py-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)' }}>
              <Lightbulb size={16} style={{ color: '#FBBF24' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white">Tips</p>
              <p className="text-xs text-muted truncate">
                Upload your class notes, assignments, or previous year papers to get better AI answers and personalised tests.
              </p>
            </div>
            <button className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
              Learn More <ArrowRight size={12} />
            </button>
          </div>
        )}

        </div>{/* end content px wrapper */}
      </div>{/* end outer scroll container */}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showUpload && (
        <UploadModal subjects={subjects} onClose={() => setShowUpload(false)} onUpload={handleUpload} />
      )}
      {deleteTarget && (
        <DeleteConfirm title={deleteTarget.title} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} deleting={deleting} />
      )}
    </div>
  )
}

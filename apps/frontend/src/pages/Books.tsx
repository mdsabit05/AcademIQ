import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { Upload, Trash2, RefreshCw, BookOpen, AlertCircle, CheckCircle } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import type { Book } from 'shared'

const STATUS_COLORS: Record<string, string> = {
  UPLOADING: 'text-blue-400',
  UPLOADED: 'text-blue-400',
  EXTRACTING: 'text-yellow-400',
  OCR: 'text-yellow-400',
  CHUNKING: 'text-yellow-400',
  EMBEDDING: 'text-orange-400',
  INDEXING: 'text-orange-400',
  READY: 'text-emerald-400',
  FAILED: 'text-red-400',
}

const PROCESSING_STATUSES = new Set([
  'UPLOADING', 'UPLOADED', 'EXTRACTING', 'OCR', 'CHUNKING', 'EMBEDDING', 'INDEXING',
])

export default function Books() {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function load() {
    const token = await getToken()
    if (!token) return
    const { books: data } = await makeApi(token).books.list()
    setBooks(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [getToken])

  // Poll while any books are processing
  useEffect(() => {
    const hasProcessing = books.some((b) => PROCESSING_STATUSES.has(b.status))
    if (hasProcessing && !pollRef.current) {
      pollRef.current = setInterval(load, 4000)
    } else if (!hasProcessing && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [books])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 200 * 1024 * 1024) {
      setError('File exceeds 200 MB limit')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const token = await getToken()
      if (!token) return
      const { book } = await makeApi(token).books.upload(file, file.name.replace(/\.pdf$/i, ''))
      setBooks((prev) => [book, ...prev])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleDelete(id: string) {
    const token = await getToken()
    if (!token) return
    await makeApi(token).books.delete(id)
    setBooks((prev) => prev.filter((b) => b.id !== id))
  }

  function handleLearn(book: Book) {
    navigate(`/ask?bookId=${book.id}`)
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Books</h1>
          <p className="mt-1 text-muted">Upload PDFs to study with AI assistance.</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover">
          <Upload size={16} />
          {uploading ? 'Uploading…' : 'Upload PDF'}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-800 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {books.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <BookOpen size={48} className="mb-4 text-muted/40" />
          <p className="text-lg font-medium text-white">No books yet</p>
          <p className="mt-1 text-sm text-muted">Upload a PDF to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => {
            const isProcessing = PROCESSING_STATUSES.has(book.status)
            const isReady = book.status === 'READY'
            const isFailed = book.status === 'FAILED'
            return (
              <div
                key={book.id}
                className="flex flex-col rounded-xl border border-border bg-surface p-5"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h3 className="line-clamp-2 font-medium text-white">{book.title}</h3>
                  <button
                    onClick={() => handleDelete(book.id)}
                    className="shrink-0 rounded p-1 text-muted hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {book.author && (
                  <p className="mb-2 text-xs text-muted">{book.author}</p>
                )}

                <div className="mb-4 flex items-center gap-1.5 text-xs">
                  {isProcessing && <RefreshCw size={12} className="animate-spin text-yellow-400" />}
                  {isReady && <CheckCircle size={12} className="text-emerald-400" />}
                  {isFailed && <AlertCircle size={12} className="text-red-400" />}
                  <span className={STATUS_COLORS[book.status] ?? 'text-muted'}>
                    {book.status.charAt(0) + book.status.slice(1).toLowerCase()}
                  </span>
                  {book.page_count && (
                    <span className="ml-auto text-muted">{book.page_count}p</span>
                  )}
                </div>

                {isFailed && book.error_msg && (
                  <p className="mb-3 text-xs text-red-400/80">{book.error_msg}</p>
                )}

                <button
                  disabled={!isReady}
                  onClick={() => handleLearn(book)}
                  className="mt-auto rounded-lg bg-primary/15 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Study with AI
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

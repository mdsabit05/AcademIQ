import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { Loader2, FileText, BookOpen } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import type { Book, TestType, Difficulty } from 'shared'

const TYPES: { value: TestType; label: string }[] = [
  { value: 'mcq', label: 'MCQ' },
  { value: 'one_mark', label: '1 Mark' },
  { value: 'two_mark', label: '2 Mark' },
  { value: 'five_mark', label: '5 Mark' },
  { value: 'mixed', label: 'Mixed' },
]

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
]

export default function TestNew() {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [books, setBooks] = useState<Book[]>([])
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([])
  const [form, setForm] = useState({
    topic: '',
    count: 10,
    type: 'mcq' as TestType,
    difficulty: 'medium' as Difficulty,
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const { books: all } = await makeApi(token).books.list()
      const ready = all.filter((b) => b.status === 'READY')
      setBooks(ready)
    }
    load()
  }, [getToken])

  function toggleBook(id: string) {
    setSelectedBookIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  async function generate() {
    if (selectedBookIds.length === 0) return
    setLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      const { test } = await makeApi(token).tests.generate({
        bookIds: selectedBookIds,
        topic: form.topic || undefined,
        questionCount: form.count,
        type: form.type,
        difficulty: form.difficulty,
      })
      navigate(`/test/${test.id}`)
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Generate Test</h1>
        <p className="mt-1 text-muted">Select books and configure your test.</p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Book selection */}
        <div>
          <label className="mb-2 block text-sm font-medium text-muted">
            Books <span className="text-red-400">*</span>
          </label>
          {books.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">
              No ready books. Upload and process a PDF first.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {books.map((b) => (
                <button
                  key={b.id}
                  onClick={() => toggleBook(b.id)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    selectedBookIds.includes(b.id)
                      ? 'bg-primary text-white'
                      : 'border border-border bg-surface text-muted hover:border-primary/40 hover:text-white'
                  }`}
                >
                  <BookOpen size={13} />
                  {b.title}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Topic */}
        <div>
          <label className="mb-2 block text-sm font-medium text-muted">Topic (optional)</label>
          <input
            type="text"
            value={form.topic}
            onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
            placeholder="e.g. Newton's Laws of Motion"
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-white placeholder-muted outline-none focus:border-primary"
          />
        </div>

        {/* Type + Difficulty */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-muted">Question Type</label>
            <div className="flex flex-wrap gap-2">
              {TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setForm((f) => ({ ...f, type: value }))}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    form.type === value
                      ? 'bg-primary text-white'
                      : 'border border-border text-muted hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-muted">Difficulty</label>
            <div className="flex gap-2">
              {DIFFICULTIES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setForm((f) => ({ ...f, difficulty: value }))}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    form.difficulty === value
                      ? 'bg-primary text-white'
                      : 'border border-border text-muted hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Question count */}
        <div>
          <label className="mb-2 block text-sm font-medium text-muted">
            Number of Questions: <span className="text-white">{form.count}</span>
          </label>
          <input
            type="range"
            min={5}
            max={30}
            step={5}
            value={form.count}
            onChange={(e) => setForm((f) => ({ ...f, count: Number(e.target.value) }))}
            className="w-full accent-primary"
          />
          <div className="mt-1 flex justify-between text-xs text-muted">
            <span>5</span><span>30</span>
          </div>
        </div>

        <button
          onClick={generate}
          disabled={loading || selectedBookIds.length === 0}
          className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
          {loading ? 'Generating…' : 'Generate Test'}
        </button>
      </div>
    </div>
  )
}

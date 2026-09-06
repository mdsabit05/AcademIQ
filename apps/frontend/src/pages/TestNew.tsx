import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { Loader2 } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import type { Document, TestType, Difficulty } from 'shared'

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
  const { state } = useLocation()
  const [documents, setDocuments] = useState<Document[]>([])
  const [form, setForm] = useState({
    documentId: '',
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
      const res = await makeApi(token).documents.list()
      const ready = res.documents.filter((d) => d.status === 'ready')
      setDocuments(ready)
      const defaultDoc = state?.documentId ?? (ready.length > 0 ? ready[0].id : '')
      setForm((f) => ({
        ...f,
        documentId: defaultDoc,
        topic: state?.topic ?? f.topic,
      }))
    }
    load()
  }, [getToken, state?.documentId])

  async function generate() {
    if (!form.documentId || !form.topic.trim()) return
    setLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      const res = await makeApi(token).test.generate({ ...form, topic: form.topic.trim() })
      navigate(`/test/${res.test.id}`)
    } catch {
      alert('Failed to generate test. Check your settings.')
    } finally {
      setLoading(false)
    }
  }

  function toggle<K extends keyof typeof form>(field: K, val: (typeof form)[K]) {
    setForm((f) => ({ ...f, [field]: val }))
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Create Test</h1>
        <p className="mt-1 text-muted">Configure your AI-generated test.</p>
      </div>

      <div className="max-w-lg space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-muted">Material</label>
          <select
            value={form.documentId}
            onChange={(e) => toggle('documentId', e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-white outline-none focus:border-primary"
          >
            {documents.length === 0 && <option value="">No materials — upload a PDF first</option>}
            {documents.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-muted">Topic</label>
          <input
            type="text"
            placeholder='e.g. "Normalization"'
            value={form.topic}
            onChange={(e) => toggle('topic', e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-white placeholder-muted outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-muted">Questions: {form.count}</label>
          <input
            type="range"
            min={3}
            max={20}
            value={form.count}
            onChange={(e) => toggle('count', Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-muted">Type</label>
          <div className="flex flex-wrap gap-2">
            {TYPES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => toggle('type', value)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  form.type === value
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-border text-muted hover:border-primary/40 hover:text-white'
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
                onClick={() => toggle('difficulty', value)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  form.difficulty === value
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-border text-muted hover:border-primary/40 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={generate}
          disabled={!form.documentId || !form.topic.trim() || loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-white hover:bg-primary-hover disabled:opacity-40"
        >
          {loading ? <><Loader2 size={18} className="animate-spin" /> Generating...</> : 'Generate Test'}
        </button>
      </div>
    </div>
  )
}

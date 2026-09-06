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
    documentIds: [] as string[],
    multiDoc: false,
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
    if (
      (!form.multiDoc && !form.documentId) ||
      (form.multiDoc && form.documentIds.length < 2) ||
      !form.topic.trim()
    ) return
    setLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      const payload = {
        documentId: form.multiDoc ? form.documentIds[0] : form.documentId,
        documentIds: form.multiDoc ? form.documentIds : undefined,
        topic: form.topic.trim(),
        count: form.count,
        type: form.type,
        difficulty: form.difficulty,
      }
      const res = await makeApi(token).test.generate(payload)
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
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-muted">Material</label>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={form.multiDoc}
                onChange={(e) => setForm((f) => ({ ...f, multiDoc: e.target.checked, documentIds: [] }))}
                className="accent-primary"
              />
              Multiple documents
            </label>
          </div>

          {!form.multiDoc ? (
            <select
              value={form.documentId}
              onChange={(e) => toggle('documentId', e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-white outline-none focus:border-primary"
            >
              {documents.length === 0 && <option value="">No materials — upload a PDF first</option>}
              {documents.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          ) : (
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border bg-surface p-2">
              {documents.length === 0 && (
                <p className="px-2 py-1 text-sm text-muted">No materials — upload a PDF first</p>
              )}
              {documents.map((d) => (
                <label key={d.id} className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 hover:bg-white/5">
                  <input
                    type="checkbox"
                    checked={form.documentIds.includes(d.id)}
                    onChange={(e) => {
                      setForm((f) => ({
                        ...f,
                        documentIds: e.target.checked
                          ? [...f.documentIds, d.id]
                          : f.documentIds.filter((id) => id !== d.id),
                      }))
                    }}
                    className="accent-primary"
                  />
                  <span className="text-sm text-white">{d.title}</span>
                </label>
              ))}
            </div>
          )}
          {form.multiDoc && form.documentIds.length < 2 && (
            <p className="mt-1 text-xs text-muted">Select at least 2 documents</p>
          )}
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
          disabled={
            (!form.multiDoc && !form.documentId) ||
            (form.multiDoc && form.documentIds.length < 2) ||
            !form.topic.trim() ||
            loading
          }
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-white hover:bg-primary-hover disabled:opacity-40"
        >
          {loading ? <><Loader2 size={18} className="animate-spin" /> Generating...</> : 'Generate Test'}
        </button>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { Loader2 } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import type { Document } from 'shared'

export default function FlashcardsNew() {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [documents, setDocuments] = useState<Document[]>([])
  const [form, setForm] = useState({ documentId: '', topic: '', count: 10 })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const res = await makeApi(token).documents.list()
      const ready = res.documents.filter((d) => d.status === 'ready')
      setDocuments(ready)
      if (ready.length > 0) setForm((f) => ({ ...f, documentId: ready[0].id }))
    }
    load()
  }, [getToken])

  async function generate() {
    if (!form.documentId || !form.topic.trim()) return
    setLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      await makeApi(token).flashcards.generate({
        documentId: form.documentId,
        topic: form.topic.trim(),
        count: form.count,
      })
      navigate(
        `/flashcards/study/${form.documentId}/${encodeURIComponent(form.topic.trim())}`,
      )
    } catch {
      alert('Failed to generate flashcards. Check your OpenRouter API key in Settings.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">New Flashcard Set</h1>
        <p className="mt-1 text-muted">AI generates Q&A cards from your material.</p>
      </div>

      <div className="max-w-lg space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-muted">Material</label>
          <select
            value={form.documentId}
            onChange={(e) => setForm((f) => ({ ...f, documentId: e.target.value }))}
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-white outline-none focus:border-primary"
          >
            {documents.length === 0 && (
              <option value="">No materials — upload a PDF first</option>
            )}
            {documents.map((d) => (
              <option key={d.id} value={d.id}>{d.title}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-muted">Topic</label>
          <input
            type="text"
            placeholder='e.g. "Normalization"'
            value={form.topic}
            onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && generate()}
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-white placeholder-muted outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-muted">
            Cards: {form.count}
          </label>
          <input
            type="range"
            min={5}
            max={20}
            value={form.count}
            onChange={(e) => setForm((f) => ({ ...f, count: Number(e.target.value) }))}
            className="w-full accent-primary"
          />
        </div>

        <button
          onClick={generate}
          disabled={!form.documentId || !form.topic.trim() || loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-white hover:bg-primary-hover disabled:opacity-40"
        >
          {loading ? (
            <><Loader2 size={18} className="animate-spin" /> Generating...</>
          ) : (
            'Generate Cards'
          )}
        </button>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { Plus, Trash2, BookOpen } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import type { Subject } from 'shared'

export default function Subjects() {
  const { getToken } = useAuth()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', semester: '', description: '' })
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const { subjects: data } = await makeApi(token).subjects.list()
      setSubjects(data)
      setLoading(false)
    }
    load()
  }, [getToken])

  async function create() {
    if (!form.name.trim()) return
    setCreating(true)
    try {
      const token = await getToken()
      if (!token) return
      const { subject } = await makeApi(token).subjects.create({
        name: form.name.trim(),
        semester: form.semester.trim() || undefined,
        description: form.description.trim() || undefined,
      })
      setSubjects((prev) => [subject, ...prev])
      setForm({ name: '', semester: '', description: '' })
      setShowForm(false)
    } finally {
      setCreating(false)
    }
  }

  async function deleteSubject(id: string) {
    if (!confirm('Delete this subject and all its content?')) return
    const token = await getToken()
    if (!token) return
    await makeApi(token).subjects.delete(id)
    setSubjects((prev) => prev.filter((s) => s.id !== id))
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
          <h1 className="text-2xl font-bold text-white">Subjects</h1>
          <p className="mt-1 text-muted">Organise books and papers by subject.</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"
        >
          <Plus size={16} />
          New Subject
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-xl border border-border bg-surface p-5">
          <h3 className="mb-4 font-semibold text-white">New Subject</h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Subject name *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-white placeholder-muted outline-none focus:border-primary"
            />
            <input
              type="text"
              placeholder="Semester (optional)"
              value={form.semester}
              onChange={(e) => setForm((f) => ({ ...f, semester: e.target.value }))}
              className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-white placeholder-muted outline-none focus:border-primary"
            />
            <textarea
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-white placeholder-muted outline-none focus:border-primary"
            />
            <div className="flex gap-2">
              <button
                onClick={create}
                disabled={creating || !form.name.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg px-4 py-2 text-sm text-muted hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {subjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <BookOpen size={48} className="mb-4 text-muted/40" />
          <p className="text-lg font-medium text-white">No subjects yet</p>
          <p className="mt-1 text-sm text-muted">Create a subject to organise your content.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((s) => (
            <div key={s.id} className="flex flex-col rounded-xl border border-border bg-surface p-5">
              <div className="mb-2 flex items-start justify-between">
                <h3 className="font-semibold text-white">{s.name}</h3>
                <button
                  onClick={() => deleteSubject(s.id)}
                  className="rounded p-1 text-muted hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {s.semester && <p className="text-xs text-muted">{s.semester}</p>}
              {s.description && (
                <p className="mt-2 line-clamp-2 text-xs text-muted/80">{s.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

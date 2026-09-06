import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import { Trash2, BookMarked } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import { groupByDocument } from '../lib/groupNotes.ts'
import type { NoteWithTitle } from 'shared'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function Notes() {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [notes, setNotes] = useState<NoteWithTitle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const res = await makeApi(token).notes.list()
      setNotes(res.notes)
      setLoading(false)
    }
    load()
  }, [getToken])

  async function handleDelete(id: string) {
    const token = await getToken()
    if (!token) return
    await makeApi(token).notes.delete(id)
    setNotes((prev) => prev.filter((n) => n.id !== id))
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const grouped = groupByDocument(notes)
  const docTitles = Object.keys(grouped)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Saved Notes</h1>
        <p className="mt-1 text-muted">Key points saved from your learning sessions.</p>
      </div>

      {docTitles.length === 0 ? (
        <div className="py-16 text-center">
          <BookMarked size={40} className="mx-auto mb-4 text-muted" />
          <p className="text-muted">No saved notes yet.</p>
          <p className="mt-1 text-sm text-muted">
            Highlight text in a{' '}
            <button onClick={() => navigate('/learn')} className="text-primary hover:underline">
              Learn session
            </button>{' '}
            to save key points.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {docTitles.map((docTitle) => (
            <div key={docTitle}>
              <h2 className="mb-4 font-semibold text-white">{docTitle}</h2>
              <div className="space-y-4">
                {Object.entries(grouped[docTitle]).map(([topic, topicNotes]) => (
                  <div key={topic} className="rounded-xl border border-border bg-surface p-5">
                    <h3 className="mb-3 text-sm font-semibold text-primary">{topic}</h3>
                    <div className="space-y-3">
                      {topicNotes.map((note) => (
                        <div
                          key={note.id}
                          className="flex items-start justify-between gap-3 rounded-lg bg-bg px-3 py-2.5"
                        >
                          <div className="flex-1">
                            <p className="text-sm text-white">{note.content}</p>
                            <p className="mt-1 text-xs text-muted">{formatDate(note.created_at)}</p>
                          </div>
                          <button
                            onClick={() => handleDelete(note.id)}
                            className="shrink-0 rounded p-1 text-muted hover:text-danger"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

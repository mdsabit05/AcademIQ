import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import { Trash2, BookMarked, Download, FolderX } from 'lucide-react'
import jsPDF from 'jspdf'
import { makeApi } from '../lib/api.ts'
import { groupByDocument } from '../lib/groupNotes.ts'
import type { NoteWithTitle } from 'shared'

export default function Notes() {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [notes, setNotes] = useState<NoteWithTitle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken()
        if (!token) return
        const res = await makeApi(token).notes.list()
        setNotes(res.notes)
      } catch (err) {
        console.error('Failed to load notes:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [getToken])

  function exportTopicPDF(docTitle: string, topic: string, topicNotes: NoteWithTitle[]) {
    const doc = new jsPDF()
    const margin = 16
    const maxWidth = doc.internal.pageSize.getWidth() - margin * 2
    let y = 20

    function checkPage(needed: number) {
      if (y + needed > doc.internal.pageSize.getHeight() - 16) { doc.addPage(); y = 20 }
    }

    doc.setFontSize(13)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120, 120, 120)
    doc.text(docTitle, margin, y)
    y += 8

    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text(topic, margin, y)
    y += 10

    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    for (const note of topicNotes) {
      const lines = doc.splitTextToSize(`• ${note.content}`, maxWidth)
      checkPage(lines.length * 6 + 2)
      doc.text(lines, margin, y)
      y += lines.length * 6 + 3
    }

    const safeName = topic.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    doc.save(`notes_${safeName}.pdf`)
  }

  async function handleDelete(id: string) {
    const token = await getToken()
    if (!token) return
    await makeApi(token).notes.delete(id)
    setNotes((prev) => prev.filter((n) => n.id !== id))
  }

  async function handleDeleteTopic(topicNotes: NoteWithTitle[]) {
    const token = await getToken()
    if (!token) return
    await Promise.all(topicNotes.map((n) => makeApi(token).notes.delete(n.id)))
    const ids = new Set(topicNotes.map((n) => n.id))
    setNotes((prev) => prev.filter((n) => !ids.has(n.id)))
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
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-primary">{topic}</h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => exportTopicPDF(docTitle, topic, topicNotes)}
                          className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:border-primary/40 hover:text-white"
                        >
                          <Download size={12} /> Export PDF
                        </button>
                        <button
                          onClick={() => handleDeleteTopic(topicNotes)}
                          className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:border-danger/40 hover:text-danger"
                        >
                          <FolderX size={12} /> Delete Topic
                        </button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {topicNotes.map((note) => (
                        <div
                          key={note.id}
                          className="flex items-start justify-between gap-3 rounded-lg bg-bg px-3 py-2.5"
                        >
                          <div className="flex-1">
                            <p className="text-sm text-white">{note.content}</p>
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

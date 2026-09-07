import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import { Trash2, BookMarked, Download } from 'lucide-react'
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

  function exportPDF(docTitle: string, topicGroups: Record<string, NoteWithTitle[]>) {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 16
    const maxWidth = pageWidth - margin * 2
    let y = 20

    function checkPage(needed: number) {
      if (y + needed > doc.internal.pageSize.getHeight() - 16) {
        doc.addPage()
        y = 20
      }
    }

    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(docTitle, margin, y)
    y += 12

    for (const [topic, topicNotes] of Object.entries(topicGroups)) {
      checkPage(14)
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text(topic, margin, y)
      y += 8

      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      for (const note of topicNotes) {
        const lines = doc.splitTextToSize(`• ${note.content}`, maxWidth)
        checkPage(lines.length * 6 + 2)
        doc.text(lines, margin, y)
        y += lines.length * 6 + 2
      }
      y += 4
    }

    const safeName = docTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    doc.save(`notes_${safeName}.pdf`)
  }

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
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-white">{docTitle}</h2>
                <button
                  onClick={() => exportPDF(docTitle, grouped[docTitle])}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:border-primary/40 hover:text-white"
                >
                  <Download size={13} /> Export PDF
                </button>
              </div>
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

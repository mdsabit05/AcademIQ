import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { Loader2, Plus, Trash2, Download, FileText } from 'lucide-react'
import jsPDF from 'jspdf'
import { makeApi } from '../lib/api.ts'
import type { Document } from 'shared'

type SectionType = 'mcq' | 'one_mark' | 'two_mark' | 'five_mark'

interface Section {
  type: SectionType
  count: number
  marksPerQ: number
}

const TYPE_OPTIONS: { value: SectionType; label: string; defaultMarks: number }[] = [
  { value: 'mcq', label: 'MCQ', defaultMarks: 1 },
  { value: 'one_mark', label: 'Short Answer (1 mark)', defaultMarks: 1 },
  { value: 'two_mark', label: 'Short Answer (2 marks)', defaultMarks: 2 },
  { value: 'five_mark', label: 'Long Answer (5 marks)', defaultMarks: 5 },
]

const TYPE_LABELS: Record<SectionType, string> = {
  mcq: 'Multiple Choice Questions',
  one_mark: 'Short Answer Questions',
  two_mark: 'Short Answer Questions',
  five_mark: 'Long Answer Questions',
}

const SECTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
]

type GeneratedSection = {
  type: string
  marksPerQ: number
  questions: Array<{ question: string; options: string[] | null; correct_answer: string }>
}

export default function QuestionPaper() {
  const { getToken } = useAuth()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(false)

  // Paper metadata
  const [meta, setMeta] = useState({
    institution: '',
    subject: '',
    grade: '',
    topic: '',
    duration: '3 Hours',
    date: '',
    documentId: '',
    difficulty: 'medium',
  })

  // Sections
  const [sections, setSections] = useState<Section[]>([
    { type: 'mcq', count: 10, marksPerQ: 1 },
    { type: 'two_mark', count: 5, marksPerQ: 2 },
    { type: 'five_mark', count: 3, marksPerQ: 5 },
  ])

  const totalMarks = sections.reduce((sum, s) => sum + s.count * s.marksPerQ, 0)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const res = await makeApi(token).documents.list()
      const ready = res.documents.filter((d) => d.status === 'ready')
      setDocuments(ready)
      if (ready.length > 0) setMeta((m) => ({ ...m, documentId: ready[0].id }))
    }
    load()
  }, [getToken])

  function updateSection(i: number, patch: Partial<Section>) {
    setSections((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }

  function addSection() {
    setSections((prev) => [...prev, { type: 'one_mark', count: 5, marksPerQ: 1 }])
  }

  function removeSection(i: number) {
    setSections((prev) => prev.filter((_, idx) => idx !== i))
  }

  function generatePDF(generatedSections: GeneratedSection[]) {
    const doc = new jsPDF()
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const margin = 16
    const contentW = pageW - margin * 2
    let y = 18

    function checkPage(needed: number) {
      if (y + needed > pageH - margin) { doc.addPage(); y = 18 }
    }

    // ── Header ──
    if (meta.institution) {
      doc.setFontSize(15)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 0, 0)
      doc.text(meta.institution, pageW / 2, y, { align: 'center' })
      y += 8
    }

    if (meta.subject) {
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text(meta.subject, pageW / 2, y, { align: 'center' })
      y += 6
    }

    doc.setFontSize(9.5)
    doc.setFont('helvetica', 'normal')
    const infoLine = [
      meta.grade && `Class: ${meta.grade}`,
      meta.topic && `Topic: ${meta.topic}`,
      meta.date && `Date: ${meta.date}`,
    ].filter(Boolean).join('     |     ')
    if (infoLine) { doc.text(infoLine, pageW / 2, y, { align: 'center' }); y += 5.5 }

    const marksLine = [
      meta.duration && `Time Allowed: ${meta.duration}`,
      `Maximum Marks: ${totalMarks}`,
    ].filter(Boolean).join('     |     ')
    doc.setFont('helvetica', 'bold')
    doc.text(marksLine, pageW / 2, y, { align: 'center' })
    y += 7

    doc.setDrawColor(0)
    doc.setLineWidth(0.5)
    doc.line(margin, y, pageW - margin, y)
    y += 5

    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(80, 80, 80)
    doc.text('General Instructions: (i) All questions are compulsory.  (ii) Write answers neatly in the spaces provided.  (iii) Marks are indicated against each question.', margin, y, { maxWidth: contentW })
    y += 9

    doc.setDrawColor(180)
    doc.line(margin, y, pageW - margin, y)
    y += 7

    // ── Sections ──
    let qNum = 1
    doc.setTextColor(0, 0, 0)

    for (let si = 0; si < generatedSections.length; si++) {
      const sec = generatedSections[si]
      const letter = SECTION_LETTERS[si] ?? String(si + 1)
      const typeLabel = TYPE_LABELS[sec.type as SectionType] ?? 'Questions'
      const sectionMarks = sec.questions.length * sec.marksPerQ

      checkPage(18)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text(`SECTION ${letter} — ${typeLabel}`, pageW / 2, y, { align: 'center' })
      y += 5.5
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(90, 90, 90)
      doc.text(`(${sec.marksPerQ} × ${sec.questions.length} = ${sectionMarks} Marks)`, pageW / 2, y, { align: 'center' })
      y += 7
      doc.setTextColor(0, 0, 0)

      for (const q of sec.questions) {
        const qLines = doc.splitTextToSize(`${qNum}.  ${q.question}`, contentW - 6)
        const optionsH = q.options ? q.options.length * 5.5 + 2 : 0
        const answerH = !q.options ? (sec.type === 'five_mark' ? 48 : sec.type === 'two_mark' ? 26 : 14) : 0
        checkPage(qLines.length * 5.5 + optionsH + answerH + 6)

        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.text(qLines, margin, y)
        y += qLines.length * 5.5 + 2

        if (q.options) {
          // MCQ — 2-column options
          doc.setFontSize(9.5)
          const colW = contentW / 2
          for (let i = 0; i < q.options.length; i += 2) {
            doc.text(q.options[i], margin + 8, y)
            if (q.options[i + 1]) doc.text(q.options[i + 1], margin + 8 + colW, y)
            y += 5.5
          }
          y += 3
        } else {
          // Answer lines
          const lineCount = sec.type === 'five_mark' ? 8 : sec.type === 'two_mark' ? 4 : 2
          doc.setDrawColor(200)
          doc.setLineWidth(0.3)
          for (let i = 0; i < lineCount; i++) {
            checkPage(6)
            doc.line(margin, y, pageW - margin, y)
            y += 5.5
          }
          doc.setLineWidth(0.5)
          doc.setDrawColor(0)
          y += 4
        }

        qNum++
      }
      y += 5
    }

    // ── Answer Key (last page) ──
    doc.addPage()
    y = 18
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('ANSWER KEY', pageW / 2, y, { align: 'center' })
    y += 4
    doc.setLineWidth(0.5)
    doc.line(margin, y, pageW - margin, y)
    y += 8

    qNum = 1
    for (let si = 0; si < generatedSections.length; si++) {
      const sec = generatedSections[si]
      const letter = SECTION_LETTERS[si] ?? String(si + 1)
      checkPage(14)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(`Section ${letter}`, margin, y)
      y += 6
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      for (const q of sec.questions) {
        const ansLines = doc.splitTextToSize(`${qNum}.  ${q.correct_answer}`, contentW - 8)
        checkPage(ansLines.length * 5 + 2)
        doc.text(ansLines, margin + 4, y)
        y += ansLines.length * 5 + 2
        qNum++
      }
      y += 4
    }

    const safeName = (meta.subject || 'question_paper').replace(/[^a-z0-9]/gi, '_').toLowerCase()
    doc.save(`${safeName}.pdf`)
  }

  async function generate() {
    if (!meta.documentId || !meta.topic.trim() || sections.length === 0) return
    setLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      const res = await makeApi(token).paper.generate({
        documentId: meta.documentId,
        topic: meta.topic.trim(),
        difficulty: meta.difficulty,
        sections: sections.map((s) => ({ type: s.type, count: s.count, marksPerQ: s.marksPerQ })),
      })
      generatePDF(res.sections)
    } catch (err) {
      alert(`Failed to generate: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const canGenerate = !!meta.documentId && !!meta.topic.trim() && sections.length > 0 && !loading

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <FileText size={22} className="text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-white">Question Paper</h1>
            <p className="mt-0.5 text-muted">Generate a printable / downloadable exam paper.</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl space-y-8">

        {/* ── Paper Metadata ── */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold text-white">Paper Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-muted">Institution / School Name</label>
              <input
                type="text"
                placeholder="e.g. Delhi Public School"
                value={meta.institution}
                onChange={(e) => setMeta((m) => ({ ...m, institution: e.target.value }))}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white placeholder-muted outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Subject / Paper Title <span className="text-danger">*</span></label>
              <input
                type="text"
                placeholder="e.g. Biology"
                value={meta.subject}
                onChange={(e) => setMeta((m) => ({ ...m, subject: e.target.value }))}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white placeholder-muted outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Class / Grade</label>
              <input
                type="text"
                placeholder="e.g. Class XII"
                value={meta.grade}
                onChange={(e) => setMeta((m) => ({ ...m, grade: e.target.value }))}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white placeholder-muted outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Duration</label>
              <input
                type="text"
                placeholder="e.g. 3 Hours"
                value={meta.duration}
                onChange={(e) => setMeta((m) => ({ ...m, duration: e.target.value }))}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white placeholder-muted outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Date</label>
              <input
                type="date"
                value={meta.date}
                onChange={(e) => setMeta((m) => ({ ...m, date: e.target.value }))}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* ── Material + Topic ── */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold text-white">Source Material</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Material</label>
              <select
                value={meta.documentId}
                onChange={(e) => setMeta((m) => ({ ...m, documentId: e.target.value }))}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white outline-none focus:border-primary"
              >
                {documents.length === 0 && <option value="">No materials — upload a PDF first</option>}
                {documents.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Topic <span className="text-danger">*</span></label>
              <input
                type="text"
                placeholder='e.g. "Cell Division"'
                value={meta.topic}
                onChange={(e) => setMeta((m) => ({ ...m, topic: e.target.value }))}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white placeholder-muted outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Difficulty</label>
              <div className="flex gap-2">
                {DIFFICULTIES.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setMeta((m) => ({ ...m, difficulty: value }))}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      meta.difficulty === value
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border text-muted hover:border-primary/40 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Sections ── */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Sections</h2>
              <p className="mt-0.5 text-xs text-muted">Define each section's question type and marks.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-primary">Total: {totalMarks} marks</span>
              <button
                onClick={addSection}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:border-primary/40 hover:text-white"
              >
                <Plus size={13} /> Add Section
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {/* Column headers */}
            <div className="grid grid-cols-[60px_1fr_100px_110px_32px] gap-3 px-1">
              <span className="text-xs text-muted">Section</span>
              <span className="text-xs text-muted">Question Type</span>
              <span className="text-xs text-muted">No. of Qs</span>
              <span className="text-xs text-muted">Marks / Q</span>
              <span />
            </div>

            {sections.map((sec, i) => (
              <div key={i} className="grid grid-cols-[60px_1fr_100px_110px_32px] items-center gap-3 rounded-lg border border-border bg-bg px-3 py-2.5">
                <span className="text-sm font-semibold text-primary">Sec {SECTION_LETTERS[i] ?? i + 1}</span>
                <select
                  value={sec.type}
                  onChange={(e) => {
                    const t = e.target.value as SectionType
                    const opt = TYPE_OPTIONS.find((o) => o.value === t)
                    updateSection(i, { type: t, marksPerQ: opt?.defaultMarks ?? sec.marksPerQ })
                  }}
                  className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-white outline-none focus:border-primary"
                >
                  {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={sec.count}
                  onChange={(e) => updateSection(i, { count: Math.max(1, Number(e.target.value)) })}
                  className="rounded-lg border border-border bg-surface px-2 py-1.5 text-center text-sm text-white outline-none focus:border-primary"
                />
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={sec.marksPerQ}
                    onChange={(e) => updateSection(i, { marksPerQ: Math.max(1, Number(e.target.value)) })}
                    className="w-16 rounded-lg border border-border bg-surface px-2 py-1.5 text-center text-sm text-white outline-none focus:border-primary"
                  />
                  <span className="text-xs text-muted whitespace-nowrap">= {sec.count * sec.marksPerQ}m</span>
                </div>
                <button
                  onClick={() => removeSection(i)}
                  disabled={sections.length === 1}
                  className="rounded p-1 text-muted hover:text-danger disabled:opacity-20"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Generate button ── */}
        <button
          onClick={generate}
          disabled={!canGenerate}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-white hover:bg-primary-hover disabled:opacity-40"
        >
          {loading ? (
            <><Loader2 size={18} className="animate-spin" /> Generating Paper...</>
          ) : (
            <><Download size={18} /> Generate & Download PDF</>
          )}
        </button>

        {loading && (
          <p className="text-center text-xs text-muted">
            Generating questions for {sections.length} section{sections.length !== 1 ? 's' : ''}… this may take a moment.
          </p>
        )}

      </div>
    </div>
  )
}

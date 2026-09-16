/**
 * Papers — Question paper creation wizard with AI assistant.
 * Step 1: Basic Details (subject, topic, title, marks, duration)
 * Step 2+: Configure, Generate, Review & Export (stubs — AI flow)
 *
 * AI chat panel helps teacher describe what they want and the assistant
 * configures the blueprint before generation.
 */

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import {
  FileText,
  Sparkles,
  Send,
  Eye,
  ArrowRight,
  RefreshCw,
  ChevronDown,
  CheckCircle,
  Plus,
  Trash2,
  Download,
} from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import type { QuestionPaper, PaperBlueprint, PaperQuestion, Subject } from 'shared'

// ── Types ──────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4

interface FormData {
  subjectId: string
  subjectName: string
  topic: string
  examTitle: string
  classSemester: string
  totalMarks: number
  durationValue: number
  durationUnit: 'Hours' | 'Minutes'
  instructions: string
}

interface SectionConfig {
  name: string
  type: 'mcq' | 'two_mark' | 'five_mark'
  count: number
  marksEach: number
}

function defaultSections(totalMarks: number): SectionConfig[] {
  return [
    { name: 'Section A – MCQ',          type: 'mcq',       count: Math.round(totalMarks * 0.2),     marksEach: 1 },
    { name: 'Section B – Short Answer', type: 'two_mark',  count: Math.round(totalMarks * 0.3 / 2), marksEach: 2 },
    { name: 'Section C – Long Answer',  type: 'five_mark', count: Math.round(totalMarks * 0.5 / 5), marksEach: 5 },
  ]
}

// Parse "1mark, 3mark, 4mark" style chat input into sections
function parseSectionsFromChat(input: string, totalMarks: number): SectionConfig[] | null {
  // Match patterns like "1 mark", "3marks", "4 marks each"
  const matches = [...input.matchAll(/(\d+)\s*marks?/gi)]
  if (matches.length < 2) return null
  const markValues = matches.map((m) => parseInt(m[1]))
  // Distribute total marks proportionally across the section types
  const sectionNames = ['Section A', 'Section B', 'Section C', 'Section D', 'Section E']
  const typeMap: Record<number, SectionConfig['type']> = { 1: 'mcq', 2: 'two_mark', 3: 'two_mark', 4: 'five_mark', 5: 'five_mark' }
  const perSection = Math.floor(totalMarks / markValues.length)
  return markValues.map((m, i) => ({
    name: `${sectionNames[i] ?? `Section ${String.fromCharCode(65 + i)}`} – ${m === 1 ? 'MCQ' : m <= 3 ? 'Short Answer' : 'Long Answer'}`,
    type: typeMap[m] ?? 'five_mark',
    count: Math.max(1, Math.round(perSection / m)),
    marksEach: m,
  }))
}

interface ChatMessage {
  id: number
  sender: 'assistant' | 'user'
  content: string
}

const QUICK_PROMPTS = [
  'Create a balanced paper for Unit 1',
  'More application-based questions',
  'Include numerical problems',
  'Make it a bit difficult',
  'Suggest based on my syllabus',
]

const STEP_LABELS: { label: string; sub: string }[] = [
  { label: 'Basic Details',   sub: 'Subject, topic, duration'  },
  { label: 'Configure',       sub: 'Marks, types, difficulty'  },
  { label: 'Generate',        sub: 'AI creates questions'      },
  { label: 'Review & Export', sub: 'Edit and download'         },
]

// ── Field wrappers ─────────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted mb-1 uppercase tracking-wider">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = 'w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted/50 focus:outline-none focus:border-primary transition-colors'
const selectCls = `${inputCls} appearance-none cursor-pointer`

// ── Main ───────────────────────────────────────────────────────────────────────

export default function Papers() {
  const { getToken } = useAuth()

  // App state
  const [step, setStep] = useState<Step>(1)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [papers, setPapers] = useState<QuestionPaper[]>([])
  const [_blueprints, setBlueprints] = useState<PaperBlueprint[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [currentPaper, setCurrentPaper] = useState<QuestionPaper | null>(null)
  const [currentQuestions, setCurrentQuestions] = useState<PaperQuestion[]>([])
  const [showMyPapers, setShowMyPapers] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showMobileChat, setShowMobileChat] = useState(false)

  // Form state
  const [form, setForm] = useState<FormData>({
    subjectId: '',
    subjectName: '',
    topic: '',
    examTitle: 'Mid Term Examination',
    classSemester: '',
    totalMarks: 100,
    durationValue: 3,
    durationUnit: 'Hours',
    instructions: '',
  })
  const [sections, setSections] = useState<SectionConfig[]>(() => defaultSections(100))

  // Chat state
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      sender: 'assistant',
      content: `Hi! I'm your Question Paper Assistant.\n\nTell me what kind of question paper you want. You can specify:\n• Important topics or units\n• Types of questions (MCQ, short, long)\n• Marks distribution\n• Difficulty level\n• Any special instructions\n\nFor example:\n"Create a 70 marks paper on Arrays and Linked Lists with 10 MCQs (1 mark), 5 short questions (5 marks) and 3 long questions (10 marks each). Keep difficulty medium."`,
    },
  ])
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken()
        if (!token) return
        const api = makeApi(token)
        const [subRes, bpRes, papersRes] = await Promise.allSettled([
          api.subjects.list(),
          api.papers.blueprints.list(),
          api.papers.list(),
        ])
        if (subRes.status === 'fulfilled') {
          setSubjects(subRes.value.subjects)
          if (subRes.value.subjects.length > 0) {
            const first = subRes.value.subjects[0]
            setForm((f) => ({ ...f, subjectId: first.id, subjectName: first.name }))
          }
        }
        if (bpRes.status === 'fulfilled') setBlueprints(bpRes.value.blueprints)
        if (papersRes.status === 'fulfilled') setPapers(papersRes.value.papers)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [getToken])

  function setField<K extends keyof FormData>(k: K, v: FormData[K]) {
    setForm((f) => {
      const next = { ...f, [k]: v }
      if (k === 'totalMarks') setSections(defaultSections(v as number))
      return next
    })
  }

  function handleSend() {
    if (!chatInput.trim()) return
    const userMsg: ChatMessage = { id: Date.now(), sender: 'user', content: chatInput }

    // Try to parse mark distribution from the message
    const parsed = parseSectionsFromChat(chatInput, form.totalMarks)
    let replyContent: string
    if (parsed) {
      setSections(parsed)
      const summary = parsed.map((s) => `• ${s.name}: ${s.count} questions × ${s.marksEach} mark${s.marksEach > 1 ? 's' : ''} = ${s.count * s.marksEach} marks`).join('\n')
      replyContent = `Done! I've updated the sections based on your input:\n\n${summary}\n\nTotal: ${parsed.reduce((a, s) => a + s.count * s.marksEach, 0)} marks\n\nClick Next to proceed to configuration.`
    } else {
      replyContent = `Got it! I'll keep that in mind: "${chatInput}".\n\nFill in the details on the left and click Next. You can also edit the sections manually in step 2.`
    }

    const reply: ChatMessage = { id: Date.now() + 1, sender: 'assistant', content: replyContent }
    setMessages((prev) => [...prev, userMsg, reply])
    setChatInput('')
  }

  async function handleGenerate() {
    setGenerating(true)
    try {
      const token = await getToken()
      if (!token) return
      const api = makeApi(token)

      // Build a blueprint from the form
      const durationMins = form.durationUnit === 'Hours'
        ? form.durationValue * 60
        : form.durationValue

      const { blueprint } = await api.papers.blueprints.create({
        title: form.examTitle,
        subjectId: form.subjectId || undefined,
        config: {
          duration: durationMins,
          totalMarks: form.totalMarks,
          sections: sections.map((s) => ({
            name: s.name,
            type: s.type,
            count: s.count,
            marksEach: s.marksEach,
            bookIds: [],
            topics: form.topic ? [form.topic] : [],
          })),
        },
      })
      setBlueprints((prev) => [blueprint, ...prev])
      setStep(3)

      // Generate paper from blueprint
      const { paper, questions } = await api.papers.blueprints.generate(blueprint.id, form.examTitle)
      setPapers((prev) => [paper, ...prev])
      setCurrentPaper(paper)
      setCurrentQuestions(questions)
      setStep(4)
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  function handleExportPDF() {
    if (!currentPaper) return
    const opts = (q: typeof currentQuestions[0]) => {
      if (!q.options) return ''
      const parsed = typeof q.options === 'string'
        ? (() => { try { return JSON.parse(q.options as string) } catch { return null } })()
        : q.options
      if (!parsed || typeof parsed !== 'object') return ''
      return Object.entries(parsed as Record<string, string>)
        .map(([k, v]) => `<span style="margin-right:24px">(${k}) ${v}</span>`)
        .join('')
    }

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${currentPaper.title}</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #111; }
  h1 { text-align: center; font-size: 20px; margin-bottom: 4px; }
  .meta { text-align: center; font-size: 13px; color: #555; margin-bottom: 24px; }
  .section-label { font-size: 11px; color: #888; margin-top: 2px; }
  .q { margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #eee; }
  .q-row { display: flex; justify-content: space-between; gap: 12px; }
  .q-text { font-size: 14px; }
  .marks { font-size: 13px; font-weight: bold; color: #0891b2; white-space: nowrap; }
  .options { margin-top: 6px; font-size: 13px; color: #444; display: grid; grid-template-columns: 1fr 1fr; gap: 2px; }
  @media print { body { margin: 20px; } }
</style></head><body>
<h1>${currentPaper.title}</h1>
<div class="meta">
  ${form.classSemester ? `<span>${form.classSemester} &nbsp;·&nbsp; </span>` : ''}
  <span>Total Marks: ${form.totalMarks}</span> &nbsp;·&nbsp;
  <span>Duration: ${form.durationValue} ${form.durationUnit}</span>
</div>
${currentQuestions.map((q, i) => `
<div class="q">
  <div class="q-row">
    <span class="q-text"><strong>${i + 1}.</strong> ${q.question_text}</span>
    <span class="marks">[${q.marks}m]</span>
  </div>
  ${opts(q) ? `<div class="options">${opts(q)}</div>` : ''}
  ${q.section ? `<div class="section-label">${q.section}</div>` : ''}
</div>`).join('')}
</body></html>`

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 500)
  }

  async function handleFinalize() {
    if (!currentPaper) return
    const token = await getToken()
    if (!token) return
    const { paper } = await makeApi(token).papers.finalize(currentPaper.id)
    setCurrentPaper(paper)
    setPapers((prev) => prev.map((p) => (p.id === paper.id ? paper : p)))
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const token = await getToken()
      if (!token) return
      await makeApi(token).papers.delete(id)
      setPapers((prev) => prev.filter((p) => p.id !== id))
      if (currentPaper?.id === id) { setCurrentPaper(null); setCurrentQuestions([]) }
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  // ── My Papers panel ──────────────────────────────────────────────────────────

  if (showMyPapers) {
    return (
      <div className="p-4 space-y-4 h-full overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <button onClick={() => setShowMyPapers(false)} className="text-xs text-primary hover:underline mb-1">← Back to Create</button>
            <h1 className="text-xl font-bold text-white">My Question Papers</h1>
            <p className="text-xs text-muted mt-0.5">{papers.length} paper{papers.length !== 1 ? 's' : ''} generated</p>
          </div>
          <button
            onClick={() => { setShowMyPapers(false); setStep(1); setCurrentPaper(null) }}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-bg"
          >
            <Plus size={14} /> New Paper
          </button>
        </div>

        {papers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <FileText size={32} className="mb-3 text-muted/30" />
            <p className="text-sm font-medium text-white">No papers yet</p>
            <p className="text-xs text-muted mt-1">Create your first question paper using the wizard.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 items-start">
            {papers.map((paper) => (
              <div key={paper.id} className="flex flex-col rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {paper.status === 'finalized'
                      ? <CheckCircle size={14} className="shrink-0 text-emerald-400" />
                      : <FileText size={14} className="shrink-0 text-muted" />}
                    <h3 className="font-semibold text-white text-sm truncate">{paper.title}</h3>
                  </div>
                  <button
                    onClick={() => handleDelete(paper.id)}
                    disabled={deletingId === paper.id}
                    className="text-muted hover:text-red-400 transition-colors ml-2 shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <span className={`self-start text-[10px] font-bold px-2 py-0.5 rounded-md mb-3 ${
                  paper.status === 'finalized'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  {paper.status.toUpperCase()}
                </span>
                <button
                  onClick={() => { setCurrentPaper(paper); setShowMyPapers(false); setStep(4) }}
                  className="mt-auto text-xs text-primary hover:underline"
                >
                  View →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Main wizard UI ───────────────────────────────────────────────────────────

  return (
    <div className="p-4 flex flex-col gap-3 h-full">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-base font-bold text-white">Question Papers</h1>
            <p className="text-[11px] text-muted hidden sm:block">Create, customise and generate question papers for your subjects.</p>
          </div>
          {/* Inline step pills */}
          <div className="hidden md:flex items-center gap-1 ml-2">
            {STEP_LABELS.map((s, i) => {
              const n = (i + 1) as Step
              const active = n === step
              const done = n < step
              return (
                <div key={n} className="flex items-center gap-1">
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all ${
                    active ? 'bg-primary/20 text-primary border border-primary/40' :
                    done ? 'bg-white/5 text-muted border border-border' :
                    'text-muted/40'
                  }`}>
                    {done ? <CheckCircle size={10} /> : <span>{n}</span>}
                    <span>{s.label}</span>
                  </div>
                  {n < 4 && <span className="text-muted/30 text-[10px]">›</span>}
                </div>
              )
            })}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile step indicator */}
          <div className="flex md:hidden items-center gap-1 text-xs text-muted">
            <span className="text-primary font-bold">{step}</span>
            <span>/4</span>
            <span className="text-white font-medium">{STEP_LABELS[step - 1]?.label}</span>
          </div>
          <button
            onClick={() => setShowMobileChat(true)}
            className="md:hidden flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary"
          >
            <Sparkles size={12} /> AI
          </button>
          <button
            onClick={() => setShowMyPapers(true)}
            className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-white hover:bg-white/5 transition-colors"
          >
            <FileText size={13} className="text-muted" />
            <span className="hidden sm:inline">My Papers</span>
            {papers.length > 0 && (
              <span className="bg-primary/20 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {papers.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile AI Chat overlay */}
      {showMobileChat && (
        <div className="fixed inset-0 z-50 flex flex-col bg-bg md:hidden animate-[fadeIn_0.15s_ease-in]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-primary" />
              <h3 className="text-sm font-semibold text-white">AI Paper Assistant</h3>
            </div>
            <button onClick={() => setShowMobileChat(false)} className="text-muted hover:text-white p-1">
              ✕
            </button>
          </div>
          <div className="flex-1 flex flex-col p-4 min-h-0">
            <div className="flex-1 space-y-2 overflow-y-auto pr-1 min-h-0 mb-3">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                  {msg.sender === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/30 flex-shrink-0 flex items-center justify-center mt-0.5">
                      <Sparkles size={12} className="text-primary" />
                    </div>
                  )}
                  <div className={`text-xs leading-relaxed rounded-xl p-3 whitespace-pre-line max-w-[85%] ${
                    msg.sender === 'assistant'
                      ? 'bg-surface border border-border text-white'
                      : 'bg-primary/20 text-white border border-primary/30'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {QUICK_PROMPTS.map((p) => (
                <button key={p} onClick={() => setChatInput(p)}
                  className="text-[11px] bg-surface hover:bg-white/5 text-primary/80 border border-primary/20 rounded-full px-2.5 py-0.5 transition-colors">
                  {p}
                </button>
              ))}
            </div>
            <div className="relative">
              <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type your requirements..."
                className="w-full bg-surface border border-border rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-white placeholder:text-muted/50 focus:outline-none focus:border-primary transition-colors" />
              <button onClick={handleSend} disabled={!chatInput.trim()}
                className="absolute right-1.5 top-1.5 p-1.5 rounded-lg bg-primary text-bg hover:bg-primary/90 transition-colors disabled:opacity-40">
                <Send size={12} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0 overflow-y-auto md:overflow-hidden pb-20 md:pb-0">

        {/* ── Left column ── */}
        <div className="md:col-span-7 space-y-3 md:overflow-y-auto">

          {/* Step 1 — Basic Details */}
          {step === 1 && (
            <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-white">1. Basic Details</h2>
                <p className="text-xs text-muted mt-0.5">Provide the basic information for your question paper.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Subject" required>
                  <div className="relative">
                    <select
                      value={form.subjectId}
                      onChange={(e) => {
                        const s = subjects.find((x) => x.id === e.target.value)
                        setField('subjectId', e.target.value)
                        setField('subjectName', s?.name ?? '')
                      }}
                      className={selectCls}
                    >
                      {subjects.length === 0
                        ? <option value="">No subjects found</option>
                        : subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)
                      }
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute right-3 top-3 text-muted" />
                  </div>
                </Field>

                <Field label="Topic / Unit">
                  <input
                    value={form.topic}
                    onChange={(e) => setField('topic', e.target.value)}
                    placeholder="e.g. Unit 1 – Arrays (Optional)"
                    className={inputCls}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Exam / Paper Title" required>
                  <input
                    value={form.examTitle}
                    onChange={(e) => setField('examTitle', e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Class / Semester">
                  <input
                    value={form.classSemester}
                    onChange={(e) => setField('classSemester', e.target.value)}
                    placeholder="e.g. BCA Sem 3"
                    className={inputCls}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Total Marks" required>
                  <input
                    type="number"
                    min={10}
                    max={500}
                    value={form.totalMarks}
                    onChange={(e) => setField('totalMarks', Number(e.target.value))}
                    className={inputCls}
                  />
                </Field>
                <Field label="Duration" required>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      value={form.durationValue}
                      onChange={(e) => setField('durationValue', Number(e.target.value))}
                      className={`${inputCls} w-24`}
                    />
                    <div className="relative flex-1">
                      <select
                        value={form.durationUnit}
                        onChange={(e) => setField('durationUnit', e.target.value as 'Hours' | 'Minutes')}
                        className={selectCls}
                      >
                        <option>Hours</option>
                        <option>Minutes</option>
                      </select>
                      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-3 text-muted" />
                    </div>
                  </div>
                </Field>
              </div>

              <Field label="Instructions for Students (Optional)">
                <textarea
                  rows={3}
                  maxLength={500}
                  value={form.instructions}
                  onChange={(e) => setField('instructions', e.target.value)}
                  placeholder="e.g. Attempt all questions. Use of calculator is allowed."
                  className={`${inputCls} resize-none`}
                />
                <p className="text-right text-[11px] text-muted mt-1">{form.instructions.length}/500</p>
              </Field>

              <div className="flex justify-end pt-1">
                <button
                  onClick={() => setStep(2)}
                  disabled={!form.examTitle.trim() || form.totalMarks < 1}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-bg hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_16px_rgba(34,211,238,0.2)]"
                >
                  Next <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — Configure */}
          {step === 2 && (
            <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-white">2. Configure</h2>
                <p className="text-xs text-muted mt-0.5">Edit sections below or use the AI chat to set mark distribution.</p>
              </div>

              {/* Summary */}
              <div className="rounded-xl border border-border bg-bg p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                {[
                  { label: 'Subject', value: form.subjectName || '—' },
                  { label: 'Total Marks', value: String(form.totalMarks) },
                  { label: 'Duration', value: `${form.durationValue} ${form.durationUnit}` },
                  { label: 'Topic', value: form.topic || 'All topics' },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-xs text-muted uppercase tracking-wider mb-0.5">{item.label}</p>
                    <p className="text-xs font-semibold text-white truncate">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Editable sections */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider">Sections</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${sections.reduce((a, s) => a + s.count * s.marksEach, 0) === form.totalMarks ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {sections.reduce((a, s) => a + s.count * s.marksEach, 0)} / {form.totalMarks} marks
                    </span>
                    <button onClick={() => setSections(defaultSections(form.totalMarks))} className="text-xs text-muted hover:text-white transition-colors">Reset</button>
                  </div>
                </div>
                {sections.map((sec, i) => (
                  <div key={i} className="rounded-lg border border-border bg-bg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <input
                        value={sec.name}
                        onChange={(e) => setSections((prev) => prev.map((s, j) => j === i ? { ...s, name: e.target.value } : s))}
                        className="text-xs font-medium text-white bg-transparent border-none outline-none flex-1 mr-2"
                      />
                      {sections.length > 1 && (
                        <button onClick={() => setSections((prev) => prev.filter((_, j) => j !== i))} className="text-muted hover:text-red-400 text-[11px]">✕</button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-[10px] text-muted mb-1">Questions</p>
                        <input type="number" min={1} value={sec.count}
                          onChange={(e) => setSections((prev) => prev.map((s, j) => j === i ? { ...s, count: Math.max(1, parseInt(e.target.value) || 1) } : s))}
                          className="w-full bg-surface border border-border rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-primary" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted mb-1">Marks Each</p>
                        <input type="number" min={1} value={sec.marksEach}
                          onChange={(e) => setSections((prev) => prev.map((s, j) => j === i ? { ...s, marksEach: Math.max(1, parseInt(e.target.value) || 1) } : s))}
                          className="w-full bg-surface border border-border rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-primary" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted mb-1">Total</p>
                        <p className="text-xs font-bold text-primary mt-1.5">{sec.count * sec.marksEach} marks</p>
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setSections((prev) => [...prev, { name: `Section ${String.fromCharCode(65 + prev.length)}`, type: 'two_mark', count: 5, marksEach: 2 }])}
                  className="text-xs text-primary hover:underline"
                >+ Add Section</button>
              </div>

              <div className="flex justify-between pt-1">
                <button onClick={() => setStep(1)} className="text-xs text-muted hover:text-white transition-colors">← Back</button>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-bg hover:bg-primary/90 transition-colors disabled:opacity-60 shadow-[0_0_16px_rgba(34,211,238,0.2)]"
                >
                  {generating ? <><RefreshCw size={14} className="animate-spin" /> Generating…</> : <><Sparkles size={14} /> Generate Paper</>}
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Generating */}
          {step === 3 && (
            <div className="rounded-2xl border border-border bg-surface p-8 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <RefreshCw size={20} className="text-primary animate-spin" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Generating your question paper…</p>
                <p className="text-xs text-muted mt-1">AI is creating questions based on your configuration.</p>
              </div>
            </div>
          )}

          {/* Step 4 — Review & Export */}
          {step === 4 && currentPaper && (
            <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white">4. Review & Export</h2>
                  <p className="text-xs text-muted mt-0.5">Review the generated paper and finalize or download.</p>
                </div>
                {currentPaper.status === 'draft' && (
                  <button
                    onClick={handleFinalize}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold px-3 py-1.5 hover:bg-emerald-500/20 transition-colors"
                  >
                    <CheckCircle size={12} /> Finalize
                  </button>
                )}
              </div>

              {/* Paper header preview */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center space-y-1.5">
                <h3 className="text-base font-bold text-white">{currentPaper.title}</h3>
                {form.classSemester && <p className="text-xs text-muted">{form.classSemester}</p>}
                <div className="flex justify-center gap-3 text-xs text-muted pt-1 flex-wrap">
                  <span className="bg-bg border border-border rounded-md px-2.5 py-0.5 font-medium">Total Marks: <span className="text-white">{form.totalMarks}</span></span>
                  <span className="bg-bg border border-border rounded-md px-2.5 py-0.5 font-medium">Duration: <span className="text-white">{form.durationValue} {form.durationUnit}</span></span>
                  <span className="bg-bg border border-border rounded-md px-2.5 py-0.5 font-medium">Questions: <span className="text-white">{currentQuestions.length}</span></span>
                </div>
                {form.instructions && (
                  <p className="text-[11px] text-muted/80 pt-1 italic">{form.instructions}</p>
                )}
              </div>

              {/* Questions */}
              {currentQuestions.length > 0 ? (
                <div className="space-y-3">
                  {/* Group by section */}
                  {(() => {
                    const groups: { section: string; questions: typeof currentQuestions }[] = []
                    for (const q of currentQuestions) {
                      const sec = q.section ?? 'General'
                      const last = groups[groups.length - 1]
                      if (last && last.section === sec) last.questions.push(q)
                      else groups.push({ section: sec, questions: [q] })
                    }
                    let globalIdx = 0
                    return groups.map((g) => (
                      <div key={g.section}>
                        {/* Section header */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold text-primary uppercase tracking-widest">{g.section}</span>
                          <div className="flex-1 h-px bg-primary/20" />
                          <span className="text-xs text-muted">{g.questions.length} Q · {g.questions.reduce((a, q) => a + q.marks, 0)} marks</span>
                        </div>
                        <div className="space-y-2">
                          {g.questions.map((q) => {
                            const idx = ++globalIdx
                            const opts = q.options
                              ? typeof q.options === 'string'
                                ? (() => { try { return JSON.parse(q.options) } catch { return null } })()
                                : q.options
                              : null
                            const hasOpts = opts && typeof opts === 'object' && !Array.isArray(opts)
                            return (
                              <div key={q.id} className="rounded-xl border border-border bg-surface/60 px-4 py-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex gap-2.5 flex-1 min-w-0">
                                    <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary mt-0.5">{idx}</span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-white leading-snug">{q.question_text}</p>
                                      {hasOpts && (
                                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                                          {Object.entries(opts as Record<string, string>).map(([k, v]) => (
                                            <p key={k} className="text-xs text-muted flex gap-1.5">
                                              <span className="font-semibold text-muted/70">({k})</span>
                                              <span>{String(v)}</span>
                                            </p>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <span className="shrink-0 text-xs font-bold text-primary bg-primary/10 border border-primary/20 rounded-md px-2 py-0.5 mt-0.5">{q.marks}m</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))
                  })()}
                </div>
              ) : (
                <p className="text-sm text-muted text-center py-6">No questions found in this paper.</p>
              )}

              <div className="flex items-center gap-3 justify-end pt-1">
                <button
                  onClick={() => { setStep(1); setCurrentPaper(null); setCurrentQuestions([]) }}
                  className="text-xs text-muted hover:text-white transition-colors"
                >
                  + Create Another
                </button>
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs text-muted hover:text-white transition-colors"
                >
                  <Download size={12} /> Export PDF
                </button>
              </div>
            </div>
          )}

          {/* Preview placeholder (step 1/2 only) */}
          {(step === 1 || step === 2) && (
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center gap-2 mb-1">
                <Eye size={13} className="text-primary" />
                <h2 className="text-xs font-semibold text-white">Generated Question Paper Preview</h2>
              </div>
              <p className="text-xs text-muted mb-3">Your question paper will appear here after generation.</p>
              <div className="rounded-xl border border-dashed border-border bg-bg/50 py-10 flex flex-col items-center justify-center text-center">
                <div className="w-8 h-8 rounded-lg bg-border/40 flex items-center justify-center mb-2">
                  <FileText size={15} className="text-muted/60" />
                </div>
                <p className="text-xs font-medium text-white">No question paper generated yet</p>
                <p className="text-[11px] text-muted mt-0.5">Fill in the details and click Next to continue.</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Right column — AI Chat (desktop only) ── */}
        <div className="hidden md:flex md:col-span-5 flex-col rounded-2xl border border-border bg-surface p-4 min-h-0">
          {/* Chat header */}
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-primary" />
              <h3 className="text-sm font-semibold text-white">AI Paper Assistant</h3>
            </div>
            <button
              onClick={() => setMessages([])}
              className="text-xs text-muted hover:text-white border border-border rounded px-2.5 py-1 transition-colors"
            >
              Clear Chat
            </button>
          </div>
          <p className="text-xs text-muted mt-1.5 mb-2">Describe what you need, and I'll help you create the perfect question paper.</p>

          {/* Messages */}
          <div className="flex-1 space-y-2 overflow-y-auto pr-1 min-h-0">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                {msg.sender === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/30 flex-shrink-0 flex items-center justify-center mt-0.5">
                    <Sparkles size={12} className="text-primary" />
                  </div>
                )}
                <div className={`text-xs leading-relaxed rounded-xl p-3 whitespace-pre-line max-w-[85%] ${
                  msg.sender === 'assistant'
                    ? 'bg-bg border border-border text-white'
                    : 'bg-primary/20 text-white border border-primary/30'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Quick prompts */}
          <div className="flex flex-wrap gap-1 my-2">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => setChatInput(p)}
                className="text-[11px] bg-bg hover:bg-white/5 text-primary/80 hover:text-primary border border-primary/20 rounded-full px-2.5 py-0.5 transition-colors"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="relative mt-auto">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type your requirements here..."
              className="w-full bg-bg border border-border rounded-xl pl-3.5 pr-10 py-2 text-xs text-white placeholder:text-muted/50 focus:outline-none focus:border-primary transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={!chatInput.trim()}
              className="absolute right-1.5 top-1.5 p-1.5 rounded-lg bg-primary text-bg hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              <Send size={12} />
            </button>
          </div>
          <p className="text-xs text-muted text-center mt-1.5">AI can make mistakes. Please review the generated questions.</p>
        </div>
      </div>
    </div>
  )
}

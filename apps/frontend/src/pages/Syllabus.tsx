import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import {
  BookOpen, Upload, Trash2, CheckSquare, Square, ChevronRight,
  ChevronDown, FileText, Plus, X, Loader2, CheckCircle2, AlertCircle,
  TrendingUp, Target, Clock, BarChart2,
} from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import type { Syllabus, SyllabusTopic } from 'shared'
import { useTheme } from '../lib/theme.tsx'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TopicGroup {
  unit: string | null
  topic: string
  subtopics: SyllabusTopic[]  // rows with a subtopic value
  topicRow: SyllabusTopic     // the "parent" row (subtopic = null) or first row if all have subtopics
  allRows: SyllabusTopic[]    // every row belonging to this unit+topic
}

interface UnitGroup {
  unit: string | null
  topics: TopicGroup[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupTopics(rows: SyllabusTopic[]): UnitGroup[] {
  // Build unit → topic → rows map preserving order_index ordering
  const unitMap = new Map<string, Map<string, SyllabusTopic[]>>()

  for (const row of rows) {
    const unitKey = row.unit ?? '__no_unit__'
    if (!unitMap.has(unitKey)) unitMap.set(unitKey, new Map())
    const topicMap = unitMap.get(unitKey)!
    if (!topicMap.has(row.topic)) topicMap.set(row.topic, [])
    topicMap.get(row.topic)!.push(row)
  }

  const units: UnitGroup[] = []
  for (const [unitKey, topicMap] of unitMap) {
    const topics: TopicGroup[] = []
    for (const [topic, topicRows] of topicMap) {
      const topicRow = topicRows.find((r) => !r.subtopic) ?? topicRows[0]
      const subtopics = topicRows.filter((r) => r.subtopic !== null && r.subtopic !== undefined)
      topics.push({ unit: unitKey === '__no_unit__' ? null : unitKey, topic, subtopics, topicRow, allRows: topicRows })
    }
    units.push({ unit: unitKey === '__no_unit__' ? null : unitKey, topics })
  }
  return units
}

function completionStats(rows: SyllabusTopic[]) {
  if (rows.length === 0) return { total: 0, done: 0, pct: 0 }
  const done = rows.filter((r) => r.completed).length
  return { total: rows.length, done, pct: Math.round((done / rows.length) * 100) }
}

function progressColor(pct: number, theme: string) {
  if (pct >= 80) return theme === 'light' ? '#059669' : '#34d399'
  if (pct >= 50) return theme === 'light' ? '#d97706' : '#fbbf24'
  return theme === 'light' ? '#dc2626' : '#f87171'
}

// ── Confirm delete modal ──────────────────────────────────────────────────────

function ConfirmDeleteModal({ onConfirm, onCancel, theme }: {
  onConfirm: () => void
  onCancel: () => void
  theme: string
}) {
  const isLight = theme === 'light'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ background: isLight ? '#fff' : 'rgb(var(--color-surface))', border: '1px solid rgb(var(--color-border))' }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-4"
          style={{ background: isLight ? 'rgba(220,38,38,0.1)' : 'rgba(248,113,113,0.1)' }}
        >
          <Trash2 size={18} style={{ color: isLight ? '#dc2626' : '#f87171' }} />
        </div>
        <h2 className="text-base font-semibold text-center mb-1" style={{ color: isLight ? '#0f172a' : '#f8fafc' }}>
          Delete Syllabus
        </h2>
        <p className="text-sm text-center mb-5" style={{ color: 'rgb(var(--color-muted))' }}>
          This will permanently remove the syllabus and all its topics. This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-xl text-sm font-medium"
            style={{ background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)', color: 'rgb(var(--color-muted))' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-xl text-sm font-semibold"
            style={{ background: isLight ? '#dc2626' : '#ef4444', color: '#fff' }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Upload modal ──────────────────────────────────────────────────────────────

interface UploadModalProps {
  onClose: () => void
  onUploaded: (s: Syllabus) => void
  token: string
  theme: string
}

function UploadModal({ onClose, onUploaded, token, theme }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const isLight = theme === 'light'

  async function submit() {
    if (!file) return
    if (!title.trim()) { setError('Title is required'); return }
    setUploading(true)
    setError('')
    try {
      const { syllabus } = await makeApi(token).syllabus.upload(file, title.trim())
      onUploaded(syllabus)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed')
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{ background: isLight ? '#fff' : 'rgb(var(--color-surface))', border: '1px solid rgb(var(--color-border))' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold" style={{ color: isLight ? '#0f172a' : '#f8fafc' }}>
            Upload Syllabus
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5">
            <X size={18} style={{ color: 'rgb(var(--color-muted))' }} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(var(--color-muted))' }}>
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Mathematics Semester 1"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.05)',
                border: '1px solid rgb(var(--color-border))',
                color: isLight ? '#0f172a' : '#f8fafc',
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(var(--color-muted))' }}>
              PDF or Photo
            </label>
            <label
              className="flex flex-col items-center justify-center gap-2 p-6 rounded-lg cursor-pointer transition-colors"
              style={{
                border: `2px dashed ${file ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'}`,
                background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)',
              }}
            >
              <Upload size={24} style={{ color: file ? 'rgb(var(--color-primary))' : 'rgb(var(--color-muted))' }} />
              <span className="text-sm text-center" style={{ color: 'rgb(var(--color-muted))' }}>
                {file ? file.name : 'Click to select a PDF or photo'}
              </span>
              <span className="text-xs" style={{ color: 'rgb(var(--color-muted))', opacity: 0.6 }}>
                PDF, JPG, PNG, WEBP supported
              </span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.bmp,.tiff,.tif,image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  setFile(f)
                  if (f && !title) setTitle(f.name.replace(/\.\w+$/i, '').trim())
                }}
              />
            </label>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm" style={{ color: isLight ? '#dc2626' : '#f87171' }}>
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm font-medium"
              style={{ background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)', color: 'rgb(var(--color-muted))' }}
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!file || uploading}
              className="flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: 'rgb(var(--color-primary))', color: isLight ? '#fff' : '#0f172a' }}
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Topic checkbox row ─────────────────────────────────────────────────────────

interface TopicRowProps {
  row: SyllabusTopic
  indent?: boolean
  theme: string
  onToggle: (id: string, completed: boolean) => void
}

function TopicRow({ row, indent = false, theme, onToggle }: TopicRowProps) {
  const isLight = theme === 'light'
  const label = row.subtopic ?? row.topic

  return (
    <div
      className="flex items-start gap-2.5 py-2 px-3 rounded-lg cursor-pointer group transition-colors"
      style={{ marginLeft: indent ? 16 : 0 }}
      onClick={(e) => { e.stopPropagation(); onToggle(row.id, !row.completed) }}
    >
      <div className="mt-0.5 flex-shrink-0">
        {row.completed ? (
          <CheckSquare size={16} style={{ color: isLight ? '#0891b2' : '#22d3ee' }} />
        ) : (
          <Square size={16} style={{ color: 'rgb(var(--color-muted))' }} className="group-hover:opacity-70" />
        )}
      </div>
      <span
        className="text-sm leading-snug"
        style={{
          color: row.completed
            ? (isLight ? '#64748b' : '#94a3b8')
            : (isLight ? '#0f172a' : '#f8fafc'),
          textDecoration: row.completed ? 'line-through' : 'none',
          opacity: row.completed ? 0.65 : 1,
        }}
      >
        {label}
      </span>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SyllabusPage() {
  const { getToken } = useAuth()
  const { theme } = useTheme()
  const isLight = theme === 'light'

  // Syllabi list
  const [syllabi, setSyllabi] = useState<Syllabus[]>([])
  const [loadingSyllabi, setLoadingSyllabi] = useState(true)

  // Selected syllabus
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [topics, setTopics] = useState<SyllabusTopic[]>([])
  const [loadingTopics, setLoadingTopics] = useState(false)

  // UI state
  const [showUpload, setShowUpload] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set())
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set())
  const [pollingId, setPollingId] = useState<string | null>(null)
  const [mobileTab, setMobileTab] = useState<'list' | 'topics' | 'progress'>('list')

  // Load syllabi list
  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const { syllabi: data } = await makeApi(token).syllabus.list()
      setSyllabi(data)
      setLoadingSyllabi(false)
      if (data.length > 0 && !selectedId) setSelectedId(data[0].id)
    }
    load()
  }, [getToken])

  // Load topics when selection changes
  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    async function load() {
      setLoadingTopics(true)
      setTopics([])
      const token = await getToken()
      if (!token || cancelled) return
      const { topics: data, syllabus } = await makeApi(token).syllabus.get(selectedId!)
      if (cancelled) return
      setTopics(data)
      setLoadingTopics(false)

      // If status is still processing, start polling
      if (syllabus.status === 'processing') {
        setPollingId(selectedId)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedId, getToken])

  // Poll for processing status
  useEffect(() => {
    if (!pollingId) return
    const interval = setInterval(async () => {
      const token = await getToken()
      if (!token) return
      const { topics: data, syllabus } = await makeApi(token).syllabus.get(pollingId)
      setSyllabi((prev) => prev.map((s) => s.id === pollingId ? { ...s, status: syllabus.status } : s))
      if (syllabus.status !== 'processing') {
        setTopics(data)
        setPollingId(null)
        clearInterval(interval)
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [pollingId, getToken])

  // Toggle a single row (used for subtopics)
  const handleToggle = useCallback(async (topicId: string, completed: boolean) => {
    setTopics((prev) => prev.map((t) => t.id === topicId ? { ...t, completed } : t))
    try {
      const token = await getToken()
      if (!token) return
      await makeApi(token).syllabus.updateTopic(selectedId!, topicId, completed)
    } catch {
      setTopics((prev) => prev.map((t) => t.id === topicId ? { ...t, completed: !completed } : t))
    }
  }, [getToken, selectedId])

  // Toggle a parent topic + all its subtopics together
  const handleToggleGroup = useCallback(async (allRows: SyllabusTopic[], completed: boolean) => {
    const ids = allRows.map((r) => r.id)
    // Optimistic update for all rows in the group
    setTopics((prev) => prev.map((t) => ids.includes(t.id) ? { ...t, completed } : t))
    try {
      const token = await getToken()
      if (!token) return
      const api = makeApi(token)
      await Promise.all(ids.map((id) => api.syllabus.updateTopic(selectedId!, id, completed)))
    } catch {
      // Revert all on failure
      setTopics((prev) => prev.map((t) => ids.includes(t.id) ? { ...t, completed: !completed } : t))
    }
  }, [getToken, selectedId])

  function toggleUnit(unit: string) {
    setExpandedUnits((prev) => {
      const next = new Set(prev)
      if (next.has(unit)) next.delete(unit)
      else next.add(unit)
      return next
    })
  }

  function toggleTopicExpand(key: string) {
    setExpandedTopics((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleUploaded(s: Syllabus) {
    setSyllabi((prev) => [s, ...prev])
    setSelectedId(s.id)
    setShowUpload(false)
    if (s.status === 'processing') setPollingId(s.id)
  }

  async function confirmDelete() {
    if (!deleteTargetId) return
    const id = deleteTargetId
    setDeleteTargetId(null)
    const token = await getToken()
    if (!token) return
    await makeApi(token).syllabus.delete(id)
    setSyllabi((prev) => prev.filter((s) => s.id !== id))
    if (selectedId === id) {
      const remaining = syllabi.filter((s) => s.id !== id)
      setSelectedId(remaining[0]?.id ?? null)
    }
  }

  // Group topics for display
  const units = groupTopics(topics)
  const stats = completionStats(topics)
  const selectedSyllabus = syllabi.find((s) => s.id === selectedId)

  // Surface colors
  const surfaceBg = isLight ? '#ffffff' : 'rgb(var(--color-surface))'
  const surfaceBorder = '1px solid rgb(var(--color-border))'
  const pageBg = isLight ? '#f1f3f7' : 'rgb(var(--color-bg))'
  const textPrimary = isLight ? '#0f172a' : '#f8fafc'
  const textMuted = 'rgb(var(--color-muted))'
  const primaryColor = isLight ? '#0891b2' : '#22d3ee'

  return (
    <div className="flex flex-col h-full" style={{ background: pageBg }}>
      {/* Header */}
      <div
        className="flex-shrink-0 px-4 lg:px-6 py-3 lg:py-4 flex items-center justify-between"
        style={{ borderBottom: surfaceBorder, background: surfaceBg }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: `rgba(${isLight ? '8,145,178' : '34,211,238'},0.12)` }}
          >
            <BookOpen size={18} style={{ color: primaryColor }} />
          </div>
          <div>
            <h1 className="text-base font-semibold" style={{ color: textPrimary }}>Syllabus</h1>
            <p className="text-xs hidden sm:block" style={{ color: textMuted }}>Track your curriculum progress</p>
          </div>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
          style={{ background: primaryColor, color: isLight ? '#fff' : '#0f172a' }}
        >
          <Plus size={14} />
          Upload
        </button>
      </div>

      {/* Mobile tab bar */}
      <div className="md:hidden flex-shrink-0 flex border-b" style={{ borderColor: 'rgb(var(--color-border))' }}>
        {(['list', 'topics', 'progress'] as const).map((tab) => {
          const labels = { list: 'Syllabi', topics: 'Topics', progress: 'Progress' }
          return (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className="flex-1 py-2.5 text-sm font-semibold transition-colors border-b-2"
              style={{
                borderColor: mobileTab === tab ? primaryColor : 'transparent',
                color: mobileTab === tab ? primaryColor : 'rgb(var(--color-muted))',
              }}
            >
              {labels[tab]}
            </button>
          )
        })}
      </div>

      {/* 3-column body */}
      <div className="flex flex-1 min-h-0">
        {/* Column 1 — Syllabi list */}
        <div
          className={`${mobileTab === 'list' ? 'flex' : 'hidden'} md:flex w-full md:w-64 flex-shrink-0 flex-col overflow-y-auto`}
          style={{ borderRight: surfaceBorder, background: isLight ? '#f8fafc' : 'rgba(13,18,32,0.5)' }}
        >
          <div className="px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: textMuted }}>
              My Syllabi
            </p>

            {loadingSyllabi ? (
              <div className="flex justify-center py-8">
                <Loader2 size={20} className="animate-spin" style={{ color: primaryColor }} />
              </div>
            ) : syllabi.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <FileText size={28} style={{ color: textMuted, opacity: 0.5 }} />
                <p className="text-xs" style={{ color: textMuted }}>No syllabi yet</p>
                <button
                  onClick={() => setShowUpload(true)}
                  className="text-xs font-medium"
                  style={{ color: primaryColor }}
                >
                  Upload one →
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                {syllabi.map((s) => {
                  const isSelected = s.id === selectedId
                  return (
                    <div
                      key={s.id}
                      className="group relative flex items-start gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
                      style={{
                        background: isSelected
                          ? (isLight ? 'rgba(8,145,178,0.1)' : 'rgba(34,211,238,0.1)')
                          : 'transparent',
                        border: isSelected
                          ? `1px solid ${isLight ? 'rgba(8,145,178,0.3)' : 'rgba(34,211,238,0.25)'}`
                          : '1px solid transparent',
                      }}
                      onClick={() => { setSelectedId(s.id); setMobileTab('topics') }}
                    >
                      <FileText
                        size={14}
                        className="mt-0.5 flex-shrink-0"
                        style={{ color: isSelected ? primaryColor : textMuted }}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-xs font-medium truncate"
                          style={{ color: isSelected ? primaryColor : textPrimary }}
                        >
                          {s.title}
                        </p>
                        {s.status === 'processing' && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Loader2 size={9} className="animate-spin" style={{ color: textMuted }} />
                            <span className="text-xs" style={{ color: textMuted }}>Processing…</span>
                          </div>
                        )}
                        {s.status === 'failed' && (
                          <span className="text-xs" style={{ color: isLight ? '#dc2626' : '#f87171' }}>Failed</span>
                        )}
                      </div>
                      <button
                        className="opacity-0 group-hover:opacity-100 lg:opacity-0 lg:group-hover:opacity-100 p-0.5 rounded transition-opacity"
                        onClick={(e) => { e.stopPropagation(); setDeleteTargetId(s.id) }}
                      >
                        <Trash2 size={12} style={{ color: isLight ? '#dc2626' : '#f87171' }} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Column 2 — Topics */}
        <div className={`${mobileTab === 'topics' ? 'block' : 'hidden'} md:block flex-1 min-w-0 overflow-y-auto px-4 py-4`}>
          {!selectedId ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <BookOpen size={40} style={{ color: textMuted, opacity: 0.3 }} />
              <p style={{ color: textMuted }}>Select a syllabus to view topics</p>
            </div>
          ) : loadingTopics ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 size={24} className="animate-spin" style={{ color: primaryColor }} />
            </div>
          ) : selectedSyllabus?.status === 'processing' ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <Loader2 size={28} className="animate-spin" style={{ color: primaryColor }} />
              <p className="text-sm" style={{ color: textMuted }}>AI is structuring your syllabus…</p>
            </div>
          ) : selectedSyllabus?.status === 'failed' ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <AlertCircle size={28} style={{ color: isLight ? '#dc2626' : '#f87171' }} />
              <p className="text-sm" style={{ color: textMuted }}>Failed to parse syllabus</p>
            </div>
          ) : topics.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <FileText size={28} style={{ color: textMuted, opacity: 0.4 }} />
              <p className="text-sm" style={{ color: textMuted }}>No topics found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {units.map((unit) => {
                const unitKey = unit.unit ?? '__no_unit__'
                const unitExpanded = expandedUnits.has(unitKey)
                const unitTopics = unit.topics.flatMap((t) => t.allRows)
                const unitStats = completionStats(unitTopics)

                return (
                  <div key={unitKey} className="rounded-xl overflow-hidden" style={{ border: surfaceBorder, background: surfaceBg }}>
                    {/* Unit header */}
                    {unit.unit && (
                      <button
                        className="w-full flex items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-white/5"
                        onClick={() => toggleUnit(unitKey)}
                      >
                        {unitExpanded
                          ? <ChevronDown size={14} style={{ color: primaryColor }} />
                          : <ChevronRight size={14} style={{ color: primaryColor }} />
                        }
                        <span className="flex-1 text-sm font-semibold" style={{ color: textPrimary }}>
                          {unit.unit}
                        </span>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{
                          background: isLight ? 'rgba(8,145,178,0.1)' : 'rgba(34,211,238,0.1)',
                          color: primaryColor,
                        }}>
                          {unitStats.done}/{unitStats.total}
                        </span>
                      </button>
                    )}

                    {/* Topics list */}
                    <div className={unit.unit && !unitExpanded ? 'hidden' : ''}>
                      {unit.topics.map((tg) => {
                        const topicKey = `${unitKey}::${tg.topic}`
                        const topicExpanded = expandedTopics.has(topicKey)
                        const hasSubtopics = tg.subtopics.length > 0

                        // A topic is "completed" if ALL its rows are completed
                        const groupCompleted = tg.allRows.every((r) => r.completed)

                        return (
                          <div key={topicKey} style={{ borderTop: unit.unit ? surfaceBorder : undefined }}>
                            {/* Topic row */}
                            <div className="flex items-center gap-1 px-2">
                              {hasSubtopics ? (
                                <button
                                  className="flex items-center gap-1 p-1 rounded opacity-60 hover:opacity-100"
                                  onClick={() => toggleTopicExpand(topicKey)}
                                >
                                  {topicExpanded
                                    ? <ChevronDown size={12} style={{ color: textMuted }} />
                                    : <ChevronRight size={12} style={{ color: textMuted }} />
                                  }
                                </button>
                              ) : (
                                <div className="w-6" />
                              )}
                              <div className="flex-1">
                                <TopicRow
                                  row={{ ...tg.topicRow, completed: groupCompleted }}
                                  theme={theme}
                                  onToggle={() => handleToggleGroup(tg.allRows, !groupCompleted)}
                                />
                              </div>
                              {hasSubtopics && (
                                <button
                                  onClick={() => toggleTopicExpand(topicKey)}
                                  className="flex-shrink-0 flex items-center gap-1 mr-2 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors"
                                  style={{
                                    background: topicExpanded
                                      ? (isLight ? 'rgba(8,145,178,0.12)' : 'rgba(34,211,238,0.12)')
                                      : (isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)'),
                                    color: topicExpanded ? primaryColor : textMuted,
                                    border: `1px solid ${topicExpanded ? (isLight ? 'rgba(8,145,178,0.3)' : 'rgba(34,211,238,0.25)') : 'rgb(var(--color-border))'}`,
                                  }}
                                >
                                  {tg.subtopics.length}
                                  {topicExpanded
                                    ? <ChevronDown size={11} />
                                    : <ChevronRight size={11} />
                                  }
                                </button>
                              )}
                            </div>

                            {/* Subtopics */}
                            {hasSubtopics && topicExpanded && (
                              <div className="pb-1" style={{ borderTop: isLight ? 'rgba(0,0,0,0.04) 1px solid' : 'rgba(255,255,255,0.04) 1px solid' }}>
                                {tg.subtopics.map((st) => (
                                  <div key={st.id} className="pl-6">
                                    <TopicRow
                                      row={st}
                                      indent
                                      theme={theme}
                                      onToggle={handleToggle}
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Column 3 — Progress panel */}
        <div
          className={`${mobileTab === 'progress' ? 'flex' : 'hidden'} md:flex w-full md:w-64 flex-shrink-0 overflow-y-auto px-4 py-4 flex-col gap-4`}
          style={{ borderLeft: surfaceBorder, background: isLight ? '#f8fafc' : 'rgba(13,18,32,0.5)' }}
        >
          {selectedId && !loadingTopics && topics.length > 0 ? (
            <>
              {/* Overall progress */}
              <div className="rounded-xl p-4" style={{ background: surfaceBg, border: surfaceBorder }}>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={14} style={{ color: primaryColor }} />
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: textMuted }}>
                    Overall Progress
                  </span>
                </div>

                {/* Big percentage */}
                <div className="text-center mb-3">
                  <span className="text-4xl font-bold" style={{ color: progressColor(stats.pct, theme) }}>
                    {stats.pct}%
                  </span>
                  <p className="text-xs mt-0.5" style={{ color: textMuted }}>
                    {stats.done} of {stats.total} topics done
                  </p>
                </div>

                {/* Progress bar */}
                <div className="h-2 rounded-full overflow-hidden" style={{ background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${stats.pct}%`,
                      background: progressColor(stats.pct, theme),
                    }}
                  />
                </div>
              </div>

              {/* Stats cards */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: CheckCircle2, label: 'Done', value: stats.done, color: isLight ? '#059669' : '#34d399' },
                  { icon: Target, label: 'Remaining', value: stats.total - stats.done, color: isLight ? '#d97706' : '#fbbf24' },
                  { icon: BarChart2, label: 'Total', value: stats.total, color: primaryColor },
                  { icon: Clock, label: 'Units', value: units.length, color: isLight ? '#7c3aed' : '#a78bfa' },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="rounded-lg p-3" style={{ background: surfaceBg, border: surfaceBorder }}>
                    <Icon size={14} style={{ color }} />
                    <p className="text-lg font-bold mt-1" style={{ color: textPrimary }}>{value}</p>
                    <p className="text-xs" style={{ color: textMuted }}>{label}</p>
                  </div>
                ))}
              </div>

              {/* Per-unit breakdown */}
              {units.some((u) => u.unit) && (
                <div className="rounded-xl p-4" style={{ background: surfaceBg, border: surfaceBorder }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: textMuted }}>
                    By Unit
                  </p>
                  <div className="space-y-2.5">
                    {units.map((unit) => {
                      const unitTopics = unit.topics.flatMap((t) => t.allRows)
                      const us = completionStats(unitTopics)
                      if (!unit.unit) return null
                      return (
                        <div key={unit.unit}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs truncate max-w-[120px]" style={{ color: textPrimary }} title={unit.unit}>
                              {unit.unit}
                            </span>
                            <span className="text-xs font-medium" style={{ color: progressColor(us.pct, theme) }}>
                              {us.pct}%
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)' }}>
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${us.pct}%`, background: progressColor(us.pct, theme) }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 gap-2">
              <BarChart2 size={28} style={{ color: textMuted, opacity: 0.3 }} />
              <p className="text-xs text-center" style={{ color: textMuted }}>
                Select a syllabus to see progress
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Upload modal */}
      {showUpload && (
        <UploadModalWrapper
          onClose={() => setShowUpload(false)}
          onUploaded={handleUploaded}
          getToken={getToken}
          theme={theme}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteTargetId && (
        <ConfirmDeleteModal
          theme={theme}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTargetId(null)}
        />
      )}
    </div>
  )
}

// Wrapper to get token once for upload modal
function UploadModalWrapper({
  onClose, onUploaded, getToken, theme,
}: {
  onClose: () => void
  onUploaded: (s: Syllabus) => void
  getToken: () => Promise<string | null>
  theme: string
}) {
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    getToken().then(setToken)
  }, [getToken])

  if (!token) return null
  return <UploadModal onClose={onClose} onUploaded={onUploaded} token={token} theme={theme} />
}

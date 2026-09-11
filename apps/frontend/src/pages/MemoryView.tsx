import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { Brain, Trash2 } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import type { MemoryEntry } from 'shared'

const TYPE_LABELS: Record<string, string> = {
  topic_mastery: 'Mastered',
  strong_topic: 'Strong',
  weak_topic: 'Needs Work',
  common_mistake: 'Common Mistake',
  study_history: 'Studied',
  revision_priority: 'Revise Soon',
  syllabus_coverage: 'Coverage',
}

const TYPE_COLORS: Record<string, string> = {
  topic_mastery: 'text-emerald-400 bg-emerald-400/10',
  strong_topic: 'text-emerald-400 bg-emerald-400/10',
  weak_topic: 'text-red-400 bg-red-400/10',
  common_mistake: 'text-orange-400 bg-orange-400/10',
  study_history: 'text-blue-400 bg-blue-400/10',
  revision_priority: 'text-yellow-400 bg-yellow-400/10',
  syllabus_coverage: 'text-purple-400 bg-purple-400/10',
}

export default function MemoryView() {
  const { getToken } = useAuth()
  const [entries, setEntries] = useState<MemoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)

  async function load() {
    const token = await getToken()
    if (!token) return
    const { memory } = await makeApi(token).memory.list()
    setEntries(memory)
    setLoading(false)
  }

  useEffect(() => { load() }, [getToken])

  async function deleteEntry(id: string) {
    const token = await getToken()
    if (!token) return
    await makeApi(token).memory.delete(id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  async function clearAll() {
    if (!confirm('Clear all memory? This cannot be undone.')) return
    setClearing(true)
    try {
      const token = await getToken()
      if (!token) return
      await makeApi(token).memory.clear()
      setEntries([])
    } finally {
      setClearing(false)
    }
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
          <h1 className="text-2xl font-bold text-white">My Memory</h1>
          <p className="mt-1 text-muted">
            AI-tracked knowledge about your strengths and weak areas.
          </p>
        </div>
        {entries.length > 0 && (
          <button
            onClick={clearAll}
            disabled={clearing}
            className="rounded-lg border border-red-800 px-3 py-2 text-sm text-red-400 hover:bg-red-950/30 disabled:opacity-50"
          >
            {clearing ? 'Clearing…' : 'Clear All'}
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Brain size={48} className="mb-4 text-muted/40" />
          <p className="text-lg font-medium text-white">No memory yet</p>
          <p className="mt-1 text-sm text-muted">
            Complete learning sessions and tests to build your memory profile.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-col rounded-xl border border-border bg-surface p-4"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      TYPE_COLORS[entry.memory_type] ?? 'text-muted bg-muted/10'
                    }`}
                  >
                    {TYPE_LABELS[entry.memory_type] ?? entry.memory_type}
                  </span>
                  <p className="mt-1.5 font-medium text-white">{entry.context_key}</p>
                </div>
                <button
                  onClick={() => deleteEntry(entry.id)}
                  className="shrink-0 rounded p-1 text-muted hover:text-red-400"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <div className="mt-auto flex items-center justify-between text-xs text-muted">
                <span>Confidence: {Math.round(entry.confidence * 100)}%</span>
                <span className="capitalize">{entry.source ?? '—'}</span>
              </div>

              <div className="mt-2 h-1 w-full rounded-full bg-white/5">
                <div
                  className="h-1 rounded-full bg-primary"
                  style={{ width: `${Math.round(entry.confidence * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

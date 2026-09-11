import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'
import { makeApi } from '../lib/api.ts'

interface Summary {
  testsTaken: number
  avgScorePct: number | null
  totalStudyMinutes: number
}

interface Mastery {
  context_key: string
  value: unknown
  confidence: number
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-3xl font-black text-white">{value}</p>
      {sub && <p className="text-xs text-primary">{sub}</p>}
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  )
}

export default function Progress() {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [mastery, setMastery] = useState<Mastery[]>([])
  const [weakTopics, setWeakTopics] = useState<Mastery[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const data = await makeApi(token).progress.summary()
      setSummary(data.summary)
      setMastery(data.topicMastery)
      setWeakTopics(data.weakTopics)
      setLoading(false)
    }
    load()
  }, [getToken])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Progress</h1>
        <p className="mt-1 text-muted">Your learning analytics and topic mastery.</p>
      </div>

      {summary && (
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard label="Tests Taken" value={summary.testsTaken} />
          <StatCard
            label="Avg Score"
            value={summary.avgScorePct != null ? `${summary.avgScorePct}%` : '—'}
          />
          <StatCard
            label="Study Time"
            value={summary.totalStudyMinutes >= 60
              ? `${Math.floor(summary.totalStudyMinutes / 60)}h`
              : `${summary.totalStudyMinutes}m`}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Mastered Topics */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-4 font-semibold text-white">Mastered Topics</h2>
          {mastery.length === 0 ? (
            <p className="text-sm text-muted">No mastered topics yet. Take tests to track your progress.</p>
          ) : (
            <div className="space-y-3">
              {mastery.map((m) => (
                <div key={m.context_key} className="flex items-center gap-3">
                  <CheckCircle size={14} className="shrink-0 text-emerald-400" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm text-white">{m.context_key}</p>
                    <div className="mt-1 h-1 w-full rounded-full bg-white/5">
                      <div
                        className="h-1 rounded-full bg-emerald-500"
                        style={{ width: `${Math.round(m.confidence * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-muted shrink-0">
                    {Math.round(m.confidence * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Weak Topics */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-4 font-semibold text-white">Needs Revision</h2>
          {weakTopics.length === 0 ? (
            <p className="text-sm text-muted">No weak topics detected yet.</p>
          ) : (
            <div className="space-y-3">
              {weakTopics.map((m) => (
                <div key={m.context_key} className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-red-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm text-white">{m.context_key}</p>
                    <div className="mt-1 h-1 w-full rounded-full bg-white/5">
                      <div
                        className="h-1 rounded-full bg-red-500"
                        style={{ width: `${Math.round(m.confidence * 100)}%` }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/test/new`)}
                    className="text-xs text-primary hover:underline shrink-0"
                  >
                    Practice
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

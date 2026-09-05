import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import { makeApi } from '../lib/api.ts'
import type { ProgressResponse } from 'shared'

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-3xl font-black text-white">{value}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  )
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function Progress() {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<ProgressResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const res = await makeApi(token).progress.get()
      setData(res)
      setLoading(false)
    }
    load()
  }, [getToken])

  if (loading || !data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Your Progress</h1>
        <p className="mt-1 text-muted">Track your learning journey.</p>
      </div>

      {/* Stats grid */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Tests Completed" value={data.testsCompleted} />
        <StatCard label="Topics Learned" value={data.topicsLearned} />
        <StatCard label="Average Score" value={`${data.averageScore}%`} />
        <StatCard label="Study Time" value={formatTime(data.studyTimeSeconds)} />
      </div>

      {/* Topic performance */}
      {data.topicPerformance.length > 0 && (
        <div className="mb-8 rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-5 font-semibold text-white">Topic Performance</h2>
          <div className="space-y-4">
            {data.topicPerformance.map(({ topic, score }) => (
              <div key={topic}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="text-white">{topic}</span>
                  <span className={score >= 70 ? 'text-success' : 'text-danger'}>{score}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-bg">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${score >= 70 ? 'bg-success' : 'bg-danger'}`}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Topics to review */}
      {data.topicsToReview.length > 0 && (
        <div className="rounded-xl border border-amber-DEFAULT/30 bg-amber-muted p-6">
          <h2 className="mb-4 font-semibold text-amber-DEFAULT">⚠ Topics to Review</h2>
          <ol className="mb-4 list-inside list-decimal space-y-2">
            {data.topicsToReview.map((t) => (
              <li key={t} className="text-sm text-white">{t}</li>
            ))}
          </ol>
          <button
            onClick={() => navigate('/test/new')}
            className="rounded-lg bg-amber-DEFAULT px-4 py-2 text-sm font-semibold text-bg hover:opacity-90"
          >
            Start Revision
          </button>
        </div>
      )}

      {data.testsCompleted === 0 && (
        <div className="py-16 text-center">
          <p className="text-muted">No test data yet.</p>
          <button onClick={() => navigate('/test/new')} className="mt-3 text-sm text-primary hover:underline">
            Take your first test →
          </button>
        </div>
      )}
    </div>
  )
}

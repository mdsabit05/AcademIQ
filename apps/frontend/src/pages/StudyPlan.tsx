/**
 * StudyPlan — personalised study plan built from real API data.
 * Uses: /api/progress/summary, /api/memory, /api/subjects, /api/syllabus
 */

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, AlertTriangle, CheckCircle2, BookOpen, ChevronRight } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import type { MemoryEntry, Subject, Syllabus } from 'shared'

interface ProgressSummary {
  testsTaken: number
  avgScorePct: number | null
  totalStudyMinutes: number
}

interface MasteryItem {
  context_key: string
  value: unknown
  confidence: number
}

interface StudyPlanData {
  summary: ProgressSummary
  weakTopics: MasteryItem[]
  strongTopics: MasteryItem[]
  memory: MemoryEntry[]
  subjects: Subject[]
  syllabi: Syllabus[]
}

export default function StudyPlan() {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<StudyPlanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken()
        if (!token) return
        const api = makeApi(token)

        const [progressRes, memoryRes, subjectsRes, syllabusRes] = await Promise.all([
          api.progress.summary(),
          api.memory.list(),
          api.subjects.list(),
          api.syllabus.list(),
        ])

        setData({
          summary: progressRes.summary,
          weakTopics: progressRes.weakTopics,
          strongTopics: progressRes.topicMastery,
          memory: memoryRes.memory,
          subjects: subjectsRes.subjects,
          syllabi: syllabusRes.syllabi,
        })
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
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

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 font-medium">Failed to load study plan</p>
          <p className="mt-1 text-sm text-muted">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  // Derive today's priorities: weak_topic memory entries sorted by confidence asc
  const weakMemory = data.memory
    .filter((e) => e.memory_type === 'weak_topic' || e.memory_type === 'revision_priority')
    .sort((a, b) => a.confidence - b.confidence)
    .slice(0, 5)

  // Untouched: topics in syllabus not yet in mastery
  const isEmpty =
    data.weakTopics.length === 0 &&
    data.strongTopics.length === 0 &&
    data.subjects.length === 0 &&
    weakMemory.length === 0

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center gap-3">
        <CalendarDays size={22} className="text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-white">Study Plan</h1>
          <p className="mt-0.5 text-muted">Personalised priorities based on your progress and memory.</p>
        </div>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-24">
          <CalendarDays size={48} className="mb-4 text-muted/40" />
          <p className="text-lg font-medium text-white">No data yet</p>
          <p className="mt-1 text-sm text-muted">
            Complete some tests and learning sessions to get a personalised study plan.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Today's Priorities */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle size={15} className="text-yellow-400" />
              <h2 className="font-semibold text-white">Today's Priorities</h2>
            </div>
            {weakMemory.length === 0 ? (
              <p className="text-sm text-muted">
                No urgent revision priorities. Keep up the good work!
              </p>
            ) : (
              <div className="space-y-3">
                {weakMemory.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-yellow-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm text-white">{entry.context_key}</p>
                      <div className="mt-1 h-1 w-full rounded-full bg-white/5">
                        <div
                          className="h-1 rounded-full bg-yellow-500"
                          style={{ width: `${Math.round(entry.confidence * 100)}%` }}
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => navigate('/test/new')}
                      className="shrink-0 text-xs text-primary hover:underline flex items-center gap-0.5"
                    >
                      Practice
                      <ChevronRight size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Weak Topics from Progress */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle size={15} className="text-red-400" />
              <h2 className="font-semibold text-white">Needs Work</h2>
            </div>
            {data.weakTopics.length === 0 ? (
              <p className="text-sm text-muted">No weak topics detected yet. Take more tests.</p>
            ) : (
              <div className="space-y-3">
                {data.weakTopics.slice(0, 5).map((t) => (
                  <div key={t.context_key} className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-red-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm text-white">{t.context_key}</p>
                      <div className="mt-1 h-1 w-full rounded-full bg-white/5">
                        <div
                          className="h-1 rounded-full bg-red-500"
                          style={{ width: `${Math.round(t.confidence * 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-muted shrink-0">
                      {Math.round(t.confidence * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mastered Topics */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="mb-4 flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-400" />
              <h2 className="font-semibold text-white">Mastered Topics</h2>
            </div>
            {data.strongTopics.length === 0 ? (
              <p className="text-sm text-muted">No mastered topics yet.</p>
            ) : (
              <div className="space-y-3">
                {data.strongTopics.slice(0, 5).map((t) => (
                  <div key={t.context_key} className="flex items-center gap-3">
                    <CheckCircle2 size={13} className="shrink-0 text-emerald-400" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm text-white">{t.context_key}</p>
                      <div className="mt-1 h-1 w-full rounded-full bg-white/5">
                        <div
                          className="h-1 rounded-full bg-emerald-500"
                          style={{ width: `${Math.round(t.confidence * 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-muted shrink-0">
                      {Math.round(t.confidence * 100)}%
                    </span>
                  </div>
                ))}
                {data.strongTopics.length > 5 && (
                  <p className="text-xs text-muted">
                    +{data.strongTopics.length - 5} more mastered topics
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Subjects & Syllabus Coverage */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="mb-4 flex items-center gap-2">
              <BookOpen size={15} className="text-primary" />
              <h2 className="font-semibold text-white">Subjects</h2>
            </div>
            {data.subjects.length === 0 ? (
              <p className="text-sm text-muted">
                No subjects set up yet.{' '}
                <button
                  onClick={() => navigate('/syllabus')}
                  className="text-primary hover:underline"
                >
                  Add subjects
                </button>
              </p>
            ) : (
              <div className="space-y-3">
                {data.subjects.map((subject) => {
                  const syllabus = data.syllabi.find((s) => s.subject_id === subject.id)
                  return (
                    <div key={subject.id} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="truncate text-sm text-white">{subject.name}</p>
                          {subject.semester && (
                            <span className="ml-2 shrink-0 text-xs text-muted">
                              {subject.semester}
                            </span>
                          )}
                        </div>
                        {syllabus ? (
                          <p className="text-xs text-muted">{syllabus.title}</p>
                        ) : (
                          <p className="text-xs text-muted/60">No syllabus uploaded</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick stats bar */}
      {data.summary && (
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-surface p-4 text-center">
            <p className="text-2xl font-black text-white">{data.summary.testsTaken}</p>
            <p className="mt-1 text-xs text-muted">Tests Taken</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 text-center">
            <p className="text-2xl font-black text-white">
              {data.summary.avgScorePct != null ? `${data.summary.avgScorePct}%` : '—'}
            </p>
            <p className="mt-1 text-xs text-muted">Avg Score</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 text-center">
            <p className="text-2xl font-black text-white">
              {data.summary.totalStudyMinutes >= 60
                ? `${Math.floor(data.summary.totalStudyMinutes / 60)}h`
                : `${data.summary.totalStudyMinutes}m`}
            </p>
            <p className="mt-1 text-xs text-muted">Study Time</p>
          </div>
        </div>
      )}
    </div>
  )
}

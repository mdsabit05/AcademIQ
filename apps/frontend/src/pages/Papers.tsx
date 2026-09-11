/**
 * Papers — teacher blueprint + question paper management.
 * Simplified view: list blueprints, generate papers, view papers.
 */

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { ScrollText, Plus, RefreshCw, CheckCircle, FileText } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import type { PaperBlueprint, QuestionPaper } from 'shared'

export default function Papers() {
  const { getToken } = useAuth()
  const [blueprints, setBlueprints] = useState<PaperBlueprint[]>([])
  const [papers, setPapers] = useState<QuestionPaper[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [tab, setTab] = useState<'blueprints' | 'papers'>('papers')

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const api = makeApi(token)
      const [bpRes, papersRes] = await Promise.all([
        api.papers.blueprints.list(),
        api.papers.list(),
      ])
      setBlueprints(bpRes.blueprints)
      setPapers(papersRes.papers)
      setLoading(false)
    }
    load().catch(console.error)
  }, [getToken])

  async function generatePaper(blueprintId: string) {
    setGenerating(blueprintId)
    try {
      const token = await getToken()
      if (!token) return
      const { paper } = await makeApi(token).papers.blueprints.generate(blueprintId)
      setPapers((prev) => [paper, ...prev])
      setTab('papers')
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setGenerating(null)
    }
  }

  async function finalizePaper(id: string) {
    const token = await getToken()
    if (!token) return
    const { paper } = await makeApi(token).papers.finalize(id)
    setPapers((prev) => prev.map((p) => (p.id === id ? paper : p)))
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
          <h1 className="text-2xl font-bold text-white">Question Papers</h1>
          <p className="mt-1 text-muted">Generate and manage exam papers from blueprints.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl border border-border bg-surface p-1 w-fit">
        {(['papers', 'blueprints'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-primary/20 text-primary' : 'text-muted hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'papers' && (
        <div>
          {papers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24">
              <FileText size={48} className="mb-4 text-muted/40" />
              <p className="text-lg font-medium text-white">No papers generated yet</p>
              <p className="mt-1 text-sm text-muted">
                Generate a paper from a blueprint in the Blueprints tab.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {papers.map((paper) => (
                <div
                  key={paper.id}
                  className="flex flex-col rounded-xl border border-border bg-surface p-5"
                >
                  <div className="mb-3 flex items-start gap-2">
                    {paper.status === 'finalized' ? (
                      <CheckCircle size={14} className="mt-0.5 shrink-0 text-emerald-400" />
                    ) : (
                      <FileText size={14} className="mt-0.5 shrink-0 text-muted" />
                    )}
                    <div className="min-w-0">
                      <h3 className="font-medium text-white">{paper.title}</h3>
                      <p className="mt-0.5 text-xs capitalize text-muted">{paper.status}</p>
                    </div>
                  </div>
                  {paper.status === 'draft' && (
                    <button
                      onClick={() => finalizePaper(paper.id)}
                      className="mt-auto rounded-lg bg-primary/15 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/25"
                    >
                      Finalize
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'blueprints' && (
        <div>
          {blueprints.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24">
              <ScrollText size={48} className="mb-4 text-muted/40" />
              <p className="text-lg font-medium text-white">No blueprints yet</p>
              <p className="mt-1 text-sm text-muted">
                Blueprints define the structure of a question paper (sections, marks, book scope).
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {blueprints.map((bp) => (
                <div
                  key={bp.id}
                  className="flex flex-col rounded-xl border border-border bg-surface p-5"
                >
                  <h3 className="mb-2 font-medium text-white">{bp.title}</h3>
                  <div className="mb-4 text-xs text-muted">
                    <span>{bp.config.sections.length} section(s)</span>
                    {' · '}
                    <span>{bp.config.totalMarks} marks</span>
                    {' · '}
                    <span>{bp.config.duration} min</span>
                  </div>
                  <button
                    onClick={() => generatePaper(bp.id)}
                    disabled={generating === bp.id}
                    className="mt-auto flex items-center justify-center gap-2 rounded-lg bg-primary/15 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/25 disabled:opacity-50"
                  >
                    {generating === bp.id ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        Generating…
                      </>
                    ) : (
                      <>
                        <Plus size={13} />
                        Generate Paper
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

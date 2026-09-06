import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { Layers, Plus, BrainCircuit } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import { groupIntoSets, type FlashcardSet } from '../lib/groupFlashcards.ts'

export default function Flashcards() {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [sets, setSets] = useState<FlashcardSet[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const res = await makeApi(token).flashcards.list()
      setSets(groupIntoSets(res.flashcards))
      setLoading(false)
    }
    load()
  }, [getToken])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Flashcards</h1>
          <p className="mt-1 text-muted">Study your Q&A sets.</p>
        </div>
        <button
          onClick={() => navigate('/flashcards/new')}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-white hover:bg-primary-hover"
        >
          <Plus size={16} /> New Set
        </button>
      </div>

      {sets.length === 0 ? (
        <div className="py-16 text-center">
          <BrainCircuit size={40} className="mx-auto mb-4 text-muted" />
          <p className="text-muted">No flashcards yet. Create a set to start studying.</p>
          <button
            onClick={() => navigate('/flashcards/new')}
            className="mt-3 text-sm text-primary hover:underline"
          >
            Create your first set →
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map(({ documentId, topic, cards, weakCount }) => (
            <div key={`${documentId}-${topic}`} className="rounded-xl border border-border bg-surface p-5">
              <div className="mb-3 flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Layers size={18} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{topic}</p>
                  <p className="text-xs text-muted">{cards.length} card{cards.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              {weakCount > 0 && (
                <p className="mb-3 text-xs text-danger">
                  {weakCount} weak card{weakCount !== 1 ? 's' : ''}
                </p>
              )}
              <button
                onClick={() =>
                  navigate(`/flashcards/study/${documentId}/${encodeURIComponent(topic)}`)
                }
                className="w-full rounded-lg bg-primary/10 py-2 text-sm font-medium text-primary hover:bg-primary/20"
              >
                Study →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { ArrowLeft, CheckCircle, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import type { Flashcard } from 'shared'

export default function FlashcardsStudy() {
  const { documentId, topic } = useParams<{ documentId: string; topic: string }>()
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const decodedTopic = decodeURIComponent(topic ?? '')

  const [deck, setDeck] = useState<Flashcard[]>([])
  const [index, setIndex] = useState(0)
  const [knownIds, setKnownIds] = useState<Set<string>>(new Set())
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken()
        if (!token || !documentId) return
        const res = await makeApi(token).flashcards.list()
        const topicCards = res.flashcards.filter(
          (c) => c.document_id === documentId && c.topic === decodedTopic,
        )
        setDeck(topicCards)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [getToken, documentId, decodedTopic])

  async function markKnown() {
    const card = deck[index]
    const token = await getToken()
    if (!token) return
    await makeApi(token).flashcards.attempt(card.id, true)
    const next = new Set(knownIds)
    next.add(card.id)
    setKnownIds(next)
    if (next.size === deck.length) {
      setDone(true)
    } else if (index + 1 < deck.length) {
      setIndex((i) => i + 1)
    }
  }

  function goNext() {
    if (index + 1 < deck.length) setIndex((i) => i + 1)
  }
  function goPrev() {
    if (index > 0) setIndex((i) => i - 1)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (deck.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-white">No flashcards found for this topic.</p>
        <button onClick={() => navigate('/flashcards/new')} className="text-primary hover:underline">
          Create a new set →
        </button>
      </div>
    )
  }

  if (done) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-6 p-8">
        <div className="text-center">
          <p className="text-6xl font-black text-success">{knownIds.size}/{deck.length}</p>
          <p className="mt-2 text-xl font-semibold text-white">All done!</p>
          <p className="mt-1 text-sm text-muted">Quick revision of "{decodedTopic}" complete</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setIndex(0); setKnownIds(new Set()); setDone(false) }}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-semibold text-white hover:bg-primary-hover"
          >
            <RotateCcw size={16} /> Revise Again
          </button>
          <button
            onClick={() => navigate('/flashcards')}
            className="rounded-xl border border-border px-5 py-2.5 font-semibold text-muted hover:text-white"
          >
            Back to Sets
          </button>
        </div>
      </div>
    )
  }

  const card = deck[index]
  const isKnown = knownIds.has(card.id)

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-border px-6 py-4">
        <button onClick={() => navigate('/flashcards')} className="text-muted hover:text-white">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="font-bold text-white">{decodedTopic}</h1>
          <p className="text-xs text-muted">{knownIds.size} of {deck.length} done</p>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 flex-col items-center justify-center gap-8 p-8">

        {/* Card stack */}
        <div className="relative" style={{ width: 300, height: 420 }}>
          {/* Ghost cards behind */}
          <div
            className="absolute inset-0 rounded-2xl border border-border bg-surface"
            style={{ transform: 'rotate(6deg) translateY(6px)', opacity: 0.4, zIndex: 1 }}
          />
          <div
            className="absolute inset-0 rounded-2xl border border-border bg-surface"
            style={{ transform: 'rotate(3deg) translateY(3px)', opacity: 0.65, zIndex: 2 }}
          />

          {/* Main card */}
          <div
            className="absolute inset-0 flex flex-col rounded-2xl border border-border bg-surface shadow-xl"
            style={{ zIndex: 3 }}
          >
            {/* Card top bar */}
            <div className="flex items-center justify-between border-b border-border/50 px-5 py-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                Answer
              </span>
              <span className="text-xs text-muted tabular-nums">
                {index + 1} / {deck.length}
              </span>
            </div>

            {/* Answer text */}
            <div className="flex flex-1 items-center justify-center px-6 py-4 text-center">
              <p className="text-base leading-relaxed text-white">{card.answer}</p>
            </div>

            {/* Card bottom — topic tag */}
            <div className="border-t border-border/50 px-5 py-3 text-center">
              <span className="text-[10px] uppercase tracking-widest text-muted">{decodedTopic}</span>
            </div>
          </div>
        </div>

        {/* Got It / known indicator */}
        <div className="flex h-10 items-center">
          {!isKnown ? (
            <button
              onClick={markKnown}
              className="flex items-center gap-2 rounded-xl bg-primary px-8 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"
            >
              <CheckCircle size={16} /> Got It ✓
            </button>
          ) : (
            <span className="flex items-center gap-2 text-sm font-medium text-success">
              <CheckCircle size={15} /> Done
            </span>
          )}
        </div>

        {/* Previous / Next */}
        <div className="flex items-center gap-4">
          <button
            onClick={goPrev}
            disabled={index === 0}
            className="flex items-center gap-1.5 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-white hover:border-primary/50 disabled:opacity-30"
          >
            <ChevronLeft size={16} /> Previous
          </button>
          <button
            onClick={goNext}
            disabled={index >= deck.length - 1}
            className="flex items-center gap-1.5 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-white hover:border-primary/50 disabled:opacity-30"
          >
            Next <ChevronRight size={16} />
          </button>
        </div>

      </div>
    </div>
  )
}

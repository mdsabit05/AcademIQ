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
  const [flipped, setFlipped] = useState(false)
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
      } catch {
        // show empty state
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
      setFlipped(false)
    }
  }

  function goNext() {
    if (index + 1 < deck.length) { setIndex((i) => i + 1); setFlipped(false) }
  }
  function goPrev() {
    if (index > 0) { setIndex((i) => i - 1); setFlipped(false) }
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
          <p className="mt-2 text-xl font-semibold text-white">All cards known!</p>
          <p className="mt-1 text-sm text-muted">Great session on "{decodedTopic}"</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setIndex(0); setFlipped(false); setKnownIds(new Set()); setDone(false) }}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-semibold text-white hover:bg-primary-hover"
          >
            <RotateCcw size={16} /> Study Again
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
          <p className="text-xs text-muted">{knownIds.size} of {deck.length} known</p>
        </div>
      </div>

      {/* Card area */}
      <div className="flex flex-1 flex-col items-center justify-center gap-8 p-8">

        {/* Card stack */}
        <div className="relative" style={{ width: 400, height: 260 }}>
          {/* Ghost cards — simulate a hand/deck */}
          <div
            className="absolute inset-0 rounded-2xl bg-white shadow-lg"
            style={{ transform: 'rotate(8deg) translateY(6px)', opacity: 0.25, zIndex: 1 }}
          />
          <div
            className="absolute inset-0 rounded-2xl bg-white shadow-lg"
            style={{ transform: 'rotate(4deg) translateY(3px)', opacity: 0.45, zIndex: 2 }}
          />

          {/* Main card */}
          <div
            className="absolute inset-0 cursor-pointer"
            style={{ perspective: '1200px', zIndex: 3 }}
            onClick={() => setFlipped((f) => !f)}
          >
            <div
              style={{
                transformStyle: 'preserve-3d',
                transition: 'transform 0.45s cubic-bezier(0.4,0,0.2,1)',
                transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                width: '100%',
                height: '100%',
                position: 'relative',
              }}
            >
              {/* Front — Question */}
              <div
                style={{ backfaceVisibility: 'hidden' }}
                className="absolute inset-0 flex flex-col rounded-2xl bg-white shadow-2xl"
              >
                {/* Top-left corner mark */}
                <div className="flex flex-col items-center px-4 pt-3 text-left">
                  <span className="text-xl font-black leading-none text-gray-800">?</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Q</span>
                </div>
                {/* Center */}
                <div className="flex flex-1 items-center justify-center px-8 text-center">
                  <p className="text-base font-semibold leading-relaxed text-gray-900">{card.question}</p>
                </div>
                {/* Bottom-right corner mark (rotated) */}
                <div className="flex flex-col items-center self-end px-4 pb-3" style={{ transform: 'rotate(180deg)' }}>
                  <span className="text-xl font-black leading-none text-gray-800">?</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Q</span>
                </div>
                {/* Hint */}
                <p className="absolute bottom-1/2 right-4 translate-y-1/2 text-[10px] text-gray-300 [writing-mode:vertical-rl]">
                  tap to flip
                </p>
              </div>

              {/* Back — Answer */}
              <div
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                className="absolute inset-0 flex flex-col rounded-2xl shadow-2xl"
                style={{
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
                }}
              >
                {/* Top-left */}
                <div className="flex flex-col items-center px-4 pt-3">
                  <span className="text-xl font-black leading-none text-indigo-300">!</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">A</span>
                </div>
                {/* Center */}
                <div className="flex flex-1 items-center justify-center px-8 text-center">
                  <p className="text-base leading-relaxed text-white">{card.answer}</p>
                </div>
                {/* Bottom-right */}
                <div className="flex flex-col items-center self-end px-4 pb-3" style={{ transform: 'rotate(180deg)' }}>
                  <span className="text-xl font-black leading-none text-indigo-300">!</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">A</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Got It button */}
        <div className="flex h-12 items-center">
          {flipped && !isKnown && (
            <button
              onClick={markKnown}
              className="flex items-center gap-2 rounded-xl bg-success px-8 py-3 font-semibold text-white shadow-lg hover:opacity-90"
            >
              <CheckCircle size={18} /> Got It ✓
            </button>
          )}
          {isKnown && (
            <span className="flex items-center gap-2 text-sm font-medium text-success">
              <CheckCircle size={16} /> Marked as known
            </span>
          )}
        </div>

        {/* Previous / Next navigation */}
        <div className="flex items-center gap-6">
          <button
            onClick={goPrev}
            disabled={index === 0}
            className="flex items-center gap-1.5 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-white hover:border-primary/50 disabled:opacity-30"
          >
            <ChevronLeft size={16} /> Previous
          </button>

          <span className="text-sm tabular-nums text-muted">
            {index + 1} / {deck.length}
          </span>

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

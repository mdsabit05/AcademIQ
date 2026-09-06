import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { ArrowLeft, CheckCircle, XCircle, RotateCcw } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import { sendCardToEnd } from '../lib/groupFlashcards.ts'
import type { Flashcard } from 'shared'

export default function FlashcardsStudy() {
  const { documentId, topic } = useParams<{ documentId: string; topic: string }>()
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const decodedTopic = decodeURIComponent(topic ?? '')

  const [deck, setDeck] = useState<Flashcard[]>([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [knownCount, setKnownCount] = useState(0)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token || !documentId) return
      const res = await makeApi(token).flashcards.list()
      const topicCards = res.flashcards.filter(
        (c) => c.document_id === documentId && c.topic === decodedTopic,
      )
      setDeck(topicCards)
      setLoading(false)
    }
    load()
  }, [getToken, documentId, decodedTopic])

  async function handleAttempt(isKnown: boolean) {
    const card = deck[index]
    const token = await getToken()
    if (!token) return
    await makeApi(token).flashcards.attempt(card.id, isKnown)

    if (isKnown) {
      setKnownCount((k) => k + 1)
      if (index + 1 >= deck.length) {
        setDone(true)
      } else {
        setIndex((i) => i + 1)
        setFlipped(false)
      }
    } else {
      setDeck((d) => sendCardToEnd(d, index))
      setFlipped(false)
    }
  }

  function restart() {
    setIndex(0)
    setFlipped(false)
    setKnownCount(0)
    setDone(false)
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
        <button
          onClick={() => navigate('/flashcards/new')}
          className="text-primary hover:underline"
        >
          Create a new set →
        </button>
      </div>
    )
  }

  if (done) {
    const weakCards = deck.filter((c) => c.fail_count > c.pass_count)
    return (
      <div className="p-8">
        <div className="mb-6 flex items-center gap-4">
          <button onClick={() => navigate('/flashcards')} className="text-muted hover:text-white">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-2xl font-bold text-white">Session Complete!</h1>
        </div>
        <div className="mb-6 rounded-2xl border border-border bg-surface p-8 text-center">
          <div className="text-6xl font-black text-success">{knownCount}/{deck.length}</div>
          <p className="mt-2 text-xl font-semibold text-white">cards known</p>
        </div>
        {weakCards.length > 0 && (
          <div className="mb-6 rounded-xl border border-danger/30 bg-danger/5 p-5">
            <h2 className="mb-3 text-sm font-semibold text-danger">Cards to review:</h2>
            <ul className="space-y-2">
              {weakCards.map((c) => (
                <li key={c.id} className="text-sm text-white">· {c.question}</li>
              ))}
            </ul>
          </div>
        )}
        <button
          onClick={restart}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-semibold text-white hover:bg-primary-hover"
        >
          <RotateCcw size={16} /> Study Again
        </button>
      </div>
    )
  }

  const card = deck[index]

  return (
    <div className="flex h-screen flex-col p-8">
      <div className="mb-6 flex items-center gap-4">
        <button onClick={() => navigate('/flashcards')} className="text-muted hover:text-white">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-bold text-white">{decodedTopic}</h1>
        <span className="ml-auto text-sm text-muted">
          Card {index + 1} of {deck.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center">
        {/* Flip card */}
        <div
          style={{ perspective: '1000px' }}
          className="w-full max-w-lg cursor-pointer"
          onClick={() => setFlipped((f) => !f)}
        >
          <div
            style={{
              transformStyle: 'preserve-3d',
              transition: 'transform 0.4s',
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              position: 'relative',
              height: '280px',
            }}
          >
            {/* Front — question */}
            <div
              style={{ backfaceVisibility: 'hidden' }}
              className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-border bg-surface p-8 text-center"
            >
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted">
                Question
              </p>
              <p className="text-lg font-semibold text-white">{card.question}</p>
              <p className="mt-6 text-xs text-muted">Click to reveal answer</p>
            </div>

            {/* Back — answer */}
            <div
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
              className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-primary/40 bg-primary/5 p-8 text-center"
            >
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-primary">
                Answer
              </p>
              <p className="text-lg text-white">{card.answer}</p>
            </div>
          </div>
        </div>

        {/* Action buttons — only visible after flip */}
        {flipped && (
          <div className="mt-8 flex gap-4">
            <button
              onClick={() => handleAttempt(false)}
              className="flex items-center gap-2 rounded-xl border border-danger/50 px-6 py-3 font-semibold text-danger hover:bg-danger/10"
            >
              <XCircle size={18} /> Didn't Know
            </button>
            <button
              onClick={() => handleAttempt(true)}
              className="flex items-center gap-2 rounded-xl bg-success px-6 py-3 font-semibold text-white hover:opacity-90"
            >
              <CheckCircle size={18} /> Got It ✓
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

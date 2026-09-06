import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useUser } from '@clerk/clerk-react'
import { BookOpen, MessageSquare, FileText } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import { computeMastery, type MasteryInfo } from '../lib/mastery.ts'
import OnboardingModal from '../components/OnboardingModal.tsx'
import type { Document, TestAttempt } from 'shared'

type AttemptRow = TestAttempt & { document_id: string; document_title: string; topic: string }

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function MasteryRing({ pct }: { pct: number }) {
  const r = 28
  const circ = 2 * Math.PI * r
  const color =
    pct < 0 ? '#2d2d3d' : pct >= 70 ? '#22C55E' : pct >= 40 ? '#FBBF24' : '#EF4444'
  const offset = pct < 0 ? 0 : circ * (1 - pct / 100)

  return (
    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
      <svg width="64" height="64" className="-rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#2d2d3d" strokeWidth="4" />
        {pct >= 0 && (
          <circle
            cx="32" cy="32" r={r}
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        )}
      </svg>
      <span className="absolute text-xs font-bold" style={{ color: pct < 0 ? '#94a3b8' : color }}>
        {pct < 0 ? '—' : `${pct}%`}
      </span>
    </div>
  )
}

function DocCard({
  doc,
  mastery,
  onAction,
}: {
  doc: Document
  mastery: MasteryInfo
  onAction: (action: 'learn' | 'ask' | 'test', docId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const ACTIONS = [
    { key: 'learn' as const, icon: BookOpen, label: 'Learn', color: 'text-primary' },
    { key: 'ask' as const, icon: MessageSquare, label: 'Ask AI', color: 'text-cyan-DEFAULT' },
    { key: 'test' as const, icon: FileText, label: 'Take Test', color: 'text-amber-DEFAULT' },
  ]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full rounded-xl border border-border bg-surface p-5 text-left transition-colors hover:border-primary/40 hover:bg-white/[0.02]"
      >
        <MasteryRing pct={mastery.pct} />
        <p className="mt-3 truncate font-semibold text-white">{doc.title}</p>
        <p className="mt-1 text-xs text-muted">
          {mastery.pct < 0 ? 'No tests yet' : `Last: ${formatDate(mastery.lastActivity)}`}
        </p>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-xl border border-border bg-surface p-2 shadow-xl">
          {ACTIONS.map(({ key, icon: Icon, label, color }) => (
            <button
              key={key}
              onClick={() => { setOpen(false); onAction(key, doc.id) }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted hover:bg-white/5 hover:text-white"
            >
              <Icon size={15} className={color} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const navigate = useNavigate()
  const [documents, setDocuments] = useState<Document[]>([])
  const [mastery, setMastery] = useState<Record<string, MasteryInfo>>({})
  const [loading, setLoading] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem('note2test_onboarded'),
  )

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const api = makeApi(token)
      const [docsRes, attemptsRes] = await Promise.all([
        api.documents.list(),
        api.test.attempts(),
      ])
      const docs = docsRes.documents
      setDocuments(docs)
      setMastery(computeMastery(docs, attemptsRes.attempts as AttemptRow[]))
      setLoading(false)
    }
    load()
  }, [getToken])

  function handleAction(action: 'learn' | 'ask' | 'test', docId: string) {
    const routes = { learn: '/learn', ask: '/ask', test: '/test/new' }
    navigate(routes[action], { state: { documentId: docId } })
  }

  function dismissOnboarding() {
    localStorage.setItem('note2test_onboarded', 'true')
    setShowOnboarding(false)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <>
      {showOnboarding && <OnboardingModal onDismiss={dismissOnboarding} />}
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">
            {greeting()}{user?.firstName ? `, ${user.firstName}` : ''} 👋
          </h1>
          <p className="mt-1 text-muted">Pick a material to study.</p>
        </div>

        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-3xl">
              📄
            </div>
            <p className="font-semibold text-white">No materials yet</p>
            <p className="mt-1 text-sm text-muted">Upload a PDF to get started</p>
            <button
              onClick={() => navigate('/materials')}
              className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"
            >
              Upload PDF
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {documents.map((doc) => (
              <DocCard
                key={doc.id}
                doc={doc}
                mastery={mastery[doc.id] ?? { pct: -1, lastActivity: doc.created_at }}
                onAction={handleAction}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

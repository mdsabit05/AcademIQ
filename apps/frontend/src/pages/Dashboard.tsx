import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useUser } from '@clerk/clerk-react'
import { BookOpen, MessageSquare, FileText, BarChart2, CheckCircle } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import OnboardingModal from '../components/OnboardingModal.tsx'
import type { Document, TestAttempt } from 'shared'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const navigate = useNavigate()
  const [documents, setDocuments] = useState<Document[]>([])
  const [recentAttempts, setRecentAttempts] = useState<(TestAttempt & { topic: string; document_title: string })[]>([])
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem('note2test_onboarded'),
  )

  function dismissOnboarding() {
    localStorage.setItem('note2test_onboarded', 'true')
    setShowOnboarding(false)
  }

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const api = makeApi(token)
      const [docsRes, attemptsRes] = await Promise.all([
        api.documents.list(),
        api.test.attempts(),
      ])
      setDocuments(docsRes.documents.slice(0, 3))
      setRecentAttempts(attemptsRes.attempts.slice(0, 3))
    }
    load()
  }, [getToken])

  const QUICK_ACTIONS = [
    { icon: BookOpen, label: 'Learn', color: 'text-primary', to: '/learn' },
    { icon: MessageSquare, label: 'Ask AI', color: 'text-cyan-DEFAULT', to: '/ask' },
    { icon: FileText, label: 'Take Test', color: 'text-amber-DEFAULT', to: '/test/new' },
  ]

  return (
    <>
      {showOnboarding && <OnboardingModal onDismiss={dismissOnboarding} />}
      <div className="p-8">
        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">
            {greeting()}{user?.firstName ? `, ${user.firstName}` : ''} 👋
          </h1>
          <p className="mt-1 text-muted">What would you like to do?</p>
        </div>

        {/* Quick actions */}
        <div className="mb-8 grid grid-cols-3 gap-3">
          {QUICK_ACTIONS.map(({ icon: Icon, label, color, to }) => (
            <button
              key={label}
              onClick={() => navigate(to)}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-primary/40 hover:bg-white/5"
            >
              <Icon size={20} className={color} />
              <span className="font-medium text-white">{label}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Your Materials */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-white">Your Materials</h2>
              <button onClick={() => navigate('/materials')} className="text-xs text-primary hover:underline">
                View all
              </button>
            </div>
            {documents.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-muted">No materials yet.</p>
                <button
                  onClick={() => navigate('/materials')}
                  className="mt-2 text-sm font-medium text-primary hover:underline"
                >
                  Upload your first PDF →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5"
                  >
                    <span className="text-sm text-white">{doc.title}</span>
                    <button
                      onClick={() => navigate('/materials')}
                      className="text-xs text-primary hover:underline"
                    >
                      Open
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-white">Recent Activity</h2>
              <button onClick={() => navigate('/progress')} className="text-xs text-primary hover:underline">
                <BarChart2 size={13} className="inline" /> Progress
              </button>
            </div>
            {recentAttempts.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-muted">No tests taken yet.</p>
                <button
                  onClick={() => navigate('/test/new')}
                  className="mt-2 text-sm font-medium text-primary hover:underline"
                >
                  Generate your first test →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {recentAttempts.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                    <CheckCircle size={14} className="shrink-0 text-success" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white">{a.topic}</p>
                      <p className="text-xs text-muted">{a.document_title}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-white">
                      {a.score}/{a.total_marks}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

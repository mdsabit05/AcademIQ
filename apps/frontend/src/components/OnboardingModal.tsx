import { BookOpen, MessageSquare, FileText, BarChart2 } from 'lucide-react'

interface Props {
  onDismiss: () => void
}

const FEATURES = [
  {
    icon: FileText,
    colorClass: 'text-cyan-DEFAULT bg-cyan-muted',
    title: 'Upload Materials',
    desc: 'Drop in your PDFs and notes — we handle the rest',
  },
  {
    icon: BookOpen,
    colorClass: 'text-primary bg-primary-muted',
    title: 'Learn with AI',
    desc: 'Get instant, in-depth explanations on any topic',
  },
  {
    icon: MessageSquare,
    colorClass: 'text-amber-DEFAULT bg-amber-muted',
    title: 'Ask Anything',
    desc: 'Chat with an AI tutor trained on your own material',
  },
  {
    icon: BarChart2,
    colorClass: 'text-success bg-success/10',
    title: 'Auto-Generated Tests',
    desc: 'MCQ, short and long answer tests — scored instantly',
  },
]

export default function OnboardingModal({ onDismiss }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-2xl border border-border bg-surface p-8">
        <div className="mb-6 text-center">
          <div className="mb-3 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 text-xl font-black text-primary">
              N2
            </div>
          </div>
          <h1 className="text-xl font-bold text-white">Welcome to Note2Test</h1>
          <p className="mt-1 text-sm text-muted">Your AI-powered study partner</p>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-3">
          {FEATURES.map(({ icon: Icon, colorClass, title, desc }) => (
            <div key={title} className="rounded-xl border border-border bg-bg p-4">
              <div className={`mb-2 inline-flex rounded-lg p-2 ${colorClass}`}>
                <Icon size={16} />
              </div>
              <p className="text-sm font-semibold text-white">{title}</p>
              <p className="mt-0.5 text-xs text-muted">{desc}</p>
            </div>
          ))}
        </div>

        <button
          onClick={onDismiss}
          className="w-full rounded-xl bg-primary py-3 font-semibold text-white hover:bg-primary-hover"
        >
          Get Started →
        </button>
      </div>
    </div>
  )
}

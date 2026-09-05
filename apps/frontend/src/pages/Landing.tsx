import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { BookOpen, MessageSquare, FileText, ArrowRight, Sparkles } from 'lucide-react'
import Logo from '../components/Logo.tsx'

const MODES = [
  {
    icon: BookOpen,
    color: 'text-primary',
    bg: 'bg-primary/10 border-primary/30',
    hover: 'hover:border-primary/60',
    title: 'LEARN',
    desc: 'Understand any topic from your material.',
    cta: 'Start Learning',
  },
  {
    icon: MessageSquare,
    color: 'text-cyan-DEFAULT',
    bg: 'bg-cyan-muted border-cyan-DEFAULT/30',
    hover: 'hover:border-cyan-DEFAULT/60',
    title: 'ASK',
    desc: 'Ask questions from your study material.',
    cta: 'Ask AI',
  },
  {
    icon: FileText,
    color: 'text-amber-DEFAULT',
    bg: 'bg-amber-muted border-amber-DEFAULT/30',
    hover: 'hover:border-amber-DEFAULT/60',
    title: 'TEST',
    desc: 'Generate tests from your material.',
    cta: 'Take a Test',
  },
]

export default function Landing() {
  const { isSignedIn } = useAuth()
  const navigate = useNavigate()

  function handleCTA() {
    navigate(isSignedIn ? '/dashboard' : '/sign-up')
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      {/* Nav */}
      <nav className="flex items-center justify-between border-b border-border px-8 py-4">
        <Logo size="md" />
        <div className="flex items-center gap-3">
          {isSignedIn ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
            >
              Go to Dashboard
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate('/sign-in')}
                className="text-sm font-medium text-muted hover:text-white"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/sign-up')}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
              >
                Get Started
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <div className="flex flex-1 flex-col items-center px-6 py-20 text-center">
        <div className="mb-6 flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
          <Sparkles size={12} />
          RAG-Powered AI Learning
        </div>

        <h1 className="max-w-3xl text-5xl font-black leading-tight tracking-tight text-white md:text-6xl">
          Turn your notes into{' '}
          <span className="text-primary">knowledge.</span>
        </h1>

        <p className="mt-6 max-w-xl text-lg text-muted">
          Upload your PDF study material. Let AI teach you, answer your questions,
          and generate personalised tests — all from your own notes.
        </p>

        <button
          onClick={handleCTA}
          className="mt-10 flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-primary/30 transition-all hover:bg-primary-hover hover:shadow-primary/50"
        >
          Get Started Free <ArrowRight size={18} />
        </button>

        {/* Mode cards */}
        <div className="mt-20 w-full max-w-4xl">
          <p className="mb-8 text-sm font-semibold uppercase tracking-widest text-muted">
            What do you want to do?
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {MODES.map(({ icon: Icon, color, bg, hover, title, desc, cta }) => (
              <div
                key={title}
                className={`rounded-2xl border ${bg} ${hover} cursor-pointer p-6 text-left transition-all`}
                onClick={handleCTA}
              >
                <Icon size={28} className={color} />
                <h3 className="mt-4 text-lg font-bold text-white">{title}</h3>
                <p className="mt-2 text-sm text-muted">{desc}</p>
                <div className={`mt-6 flex items-center gap-1.5 text-sm font-semibold ${color}`}>
                  {cta} <ArrowRight size={14} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Flow diagram */}
        <div className="mt-20 flex flex-wrap items-center justify-center gap-2 text-sm text-muted">
          {['Upload PDF', 'Extract Text', 'Embed', 'Vector Search', 'LLM', 'You Learn'].map(
            (step, i, arr) => (
              <span key={step} className="flex items-center gap-2">
                <span className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-white">
                  {step}
                </span>
                {i < arr.length - 1 && <ArrowRight size={14} className="text-subtle" />}
              </span>
            ),
          )}
        </div>
      </div>
    </div>
  )
}

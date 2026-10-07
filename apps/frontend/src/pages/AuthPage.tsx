import { useState } from 'react'
import { useNavigate, Link, Navigate } from 'react-router-dom'
import { SignIn, SignUp } from '@clerk/clerk-react'
import { enterGuestMode, useAuth } from '../lib/auth.ts'
import academiqLogoUrl from '../assets/academiq-logo-transparent.svg'
import { Zap, Mail, CheckCircle2, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react'
import { clsx } from 'clsx'

interface AuthPageProps {
  initialMode?: 'sign-up' | 'sign-in'
}

export default function AuthPage({ initialMode = 'sign-up' }: AuthPageProps) {
  const { isSignedIn, isLoaded } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'email' | 'guest'>('email')
  const [authMode, setAuthMode] = useState<'sign-up' | 'sign-in'>(initialMode)

  if (isLoaded && isSignedIn) {
    return <Navigate to="/dashboard" replace />
  }

  const handleStartGuest = () => {
    enterGuestMode()
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#080c14] text-white flex flex-col justify-between selection:bg-[#22D3EE]/20 selection:text-[#22D3EE]">
      {/* Top Bar */}
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-white/[0.06] bg-[#080c14]/80 backdrop-blur-md sticky top-0 z-50">
        <Link to="/" className="flex items-center gap-2">
          <img src={academiqLogoUrl} alt="AcademIQ" className="h-9 w-auto" />
        </Link>
        <Link
          to="/"
          className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors py-1.5 px-3 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10"
        >
          <ArrowLeft size={14} /> Back to Home
        </Link>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-4xl mx-auto">
          {/* Headline */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#22D3EE]/10 border border-[#22D3EE]/20 text-[#22D3EE] text-xs font-semibold mb-3">
              <Sparkles size={13} />
              Welcome to AcademIQ
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
              Choose how you want to continue
            </h1>
            <p className="mt-2 text-sm sm:text-base text-muted max-w-lg mx-auto">
              Get started instantly with Guest Mode or create a free email account to save your library and test history.
            </p>

            {/* Segmented control for mobile / quick toggle */}
            <div className="mt-6 inline-flex p-1 rounded-xl bg-surface border border-border">
              <button
                type="button"
                onClick={() => setActiveTab('email')}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all',
                  activeTab === 'email'
                    ? 'bg-[#22D3EE] text-[#080c14] shadow-sm'
                    : 'text-muted hover:text-white'
                )}
              >
                <Mail size={15} />
                {authMode === 'sign-up' ? 'Register with Email' : 'Login with Email'}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('guest')}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all',
                  activeTab === 'guest'
                    ? 'bg-[#22D3EE] text-[#080c14] shadow-sm'
                    : 'text-muted hover:text-white'
                )}
              >
                <Zap size={15} />
                Continue as Guest
              </button>
            </div>
          </div>

          {/* Grid layout on desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* ── Guest Mode Card ── */}
            <div
              className={clsx(
                'lg:col-span-5 rounded-2xl border border-border bg-[#0d1220]/90 p-6 sm:p-7 flex flex-col justify-between transition-all relative overflow-hidden',
                activeTab === 'guest' ? 'ring-2 ring-[#22D3EE] border-transparent' : 'hover:border-white/20',
                activeTab !== 'guest' && 'hidden lg:flex'
              )}
            >
              <div className="absolute top-0 right-0 -mr-16 -mt-16 w-44 h-44 rounded-full bg-[#22D3EE]/5 blur-3xl pointer-events-none" />

              <div>
                <div className="w-12 h-12 rounded-xl bg-[#22D3EE]/10 border border-[#22D3EE]/25 flex items-center justify-center text-[#22D3EE] mb-5">
                  <Zap size={24} />
                </div>

                <div className="flex items-center gap-2 mb-1.5">
                  <h2 className="text-xl font-bold text-white">Guest Mode</h2>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                    Instant
                  </span>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Jump right in with zero setup. Try out the AI Tutor, practice exams, and syllabus explorer immediately.
                </p>

                <div className="mt-6 space-y-3">
                  <div className="flex items-start gap-2.5 text-xs text-white/80">
                    <CheckCircle2 size={16} className="text-[#22D3EE] shrink-0 mt-0.5" />
                    <span>No credit card, password, or verification required</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-white/80">
                    <CheckCircle2 size={16} className="text-[#22D3EE] shrink-0 mt-0.5" />
                    <span>Full access to AI Tutor, tests, and study plans</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-white/80">
                    <CheckCircle2 size={16} className="text-[#22D3EE] shrink-0 mt-0.5" />
                    <span>Quickly test the platform before creating an account</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-5 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={handleStartGuest}
                  className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-[#22D3EE] to-[#0ea5e9] text-[#080c14] hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#22D3EE]/10"
                >
                  <Zap size={16} /> Continue as Guest <ArrowRight size={16} />
                </button>
                <p className="text-[11px] text-muted text-center mt-2.5">
                  You can sign out or switch to an email account anytime.
                </p>
              </div>
            </div>

            {/* ── Email Register / Login Card ── */}
            <div
              className={clsx(
                'lg:col-span-7 rounded-2xl border border-border bg-[#0d1220]/90 p-5 sm:p-7 flex flex-col justify-center transition-all',
                activeTab === 'email' ? 'ring-2 ring-[#22D3EE] border-transparent' : 'hover:border-white/20',
                activeTab !== 'email' && 'hidden lg:flex'
              )}
            >
              {/* Mode switch (Sign Up vs Sign In) */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[#22D3EE]">
                    <Mail size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {authMode === 'sign-up' ? 'Register with Email' : 'Sign In with Email'}
                    </h3>
                    <p className="text-[11px] text-muted">
                      {authMode === 'sign-up' ? 'Creates your permanent study account' : 'Welcome back to your account'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setAuthMode((m) => (m === 'sign-up' ? 'sign-in' : 'sign-up'))}
                  className="text-xs font-semibold text-[#22D3EE] hover:underline transition-colors"
                >
                  {authMode === 'sign-up' ? 'Already have an account? Sign in' : "Don't have an account? Register"}
                </button>
              </div>

              {/* Embedded Clerk Component */}
              <div className="flex justify-center py-2 clerk-auth-wrapper overflow-x-auto">
                {authMode === 'sign-up' ? (
                  <SignUp
                    routing="hash"
                    signInUrl="#/sign-in"
                    fallbackRedirectUrl="#/dashboard"
                  />
                ) : (
                  <SignIn
                    routing="hash"
                    signUpUrl="#/sign-up"
                    fallbackRedirectUrl="#/dashboard"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-muted border-t border-white/[0.06]">
        AcademIQ — Learn Today. Build Tomorrow.
      </footer>
    </div>
  )
}

import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { SignIn, SignUp } from '@clerk/clerk-react'
import { useAuth } from '../lib/auth.ts'
import academiqLogoUrl from '../assets/academiq-logo-transparent.svg'
import { Mail, ArrowLeft } from 'lucide-react'

interface AuthPageProps {
  initialMode?: 'sign-up' | 'sign-in'
}

export default function AuthPage({ initialMode = 'sign-up' }: AuthPageProps) {
  const { isSignedIn, isLoaded } = useAuth()
  const [authMode, setAuthMode] = useState<'sign-up' | 'sign-in'>(initialMode)

  if (isLoaded && isSignedIn) {
    return <Navigate to="/dashboard" replace />
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
        <div className="w-full max-w-md mx-auto">
          {/* Card */}
          <div className="rounded-2xl border border-border bg-[#0d1220]/90 p-5 sm:p-7 flex flex-col justify-center shadow-2xl">
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
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-muted border-t border-white/[0.06]">
        AcademIQ — Learn Today. Build Tomorrow.
      </footer>
    </div>
  )
}

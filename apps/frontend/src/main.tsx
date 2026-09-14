import { StrictMode, Component } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { HashRouter } from 'react-router-dom'
import { ThemeProvider } from './lib/theme.tsx'
import App from './App.tsx'
import './index.css'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
if (!PUBLISHABLE_KEY) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env')

// After sign-in modal completes, stay on this same page (hash router takes over)
const PAGE_URL = window.location.href.split('#')[0]

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0A0A0F] p-8 text-center">
          <p className="text-lg font-semibold text-white">Something went wrong</p>
          <p className="max-w-md text-sm text-[#94a3b8]">{(this.state.error as Error).message}</p>
          <button
            onClick={() => { this.setState({ error: null }); window.location.hash = '/' }}
            className="rounded-lg bg-[#22D3EE] px-4 py-2 text-sm font-semibold text-white"
          >
            Go Home
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ErrorBoundary>
        <ClerkProvider
          publishableKey={PUBLISHABLE_KEY}
          afterSignInUrl={PAGE_URL}
          afterSignUpUrl={PAGE_URL}
          afterSignOutUrl={PAGE_URL}
        >
          <HashRouter>
            <App />
          </HashRouter>
        </ClerkProvider>
      </ErrorBoundary>
    </ThemeProvider>
  </StrictMode>,
)

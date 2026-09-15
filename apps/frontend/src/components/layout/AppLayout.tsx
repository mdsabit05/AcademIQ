import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Search, Sun, Moon } from 'lucide-react'
import { useUser } from '@clerk/clerk-react'
import Sidebar from './Sidebar.tsx'
import TopBar from './TopBar.tsx'
import MobileBottomNav from './MobileBottomNav.tsx'
import { SidebarProvider } from '../../lib/sidebarContext.tsx'
import { ModeProvider, useMode } from '../../lib/modeContext.tsx'
import { TopBarProvider, useTopBar } from '../../lib/topBarContext.tsx'
import { useTheme } from '../../lib/theme.tsx'
import Logo from '../Logo.tsx'
import SearchSpotlight from '../SearchSpotlight.tsx'

// ── Mobile top bar ─────────────────────────────────────────────────────────────
function MobileTopBar() {
  const { user } = useUser()
  const [spotlightOpen, setSpotlightOpen] = useState(false)
  const { mode, setMode } = useMode()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const imageUrl = user?.imageUrl
  const initials = user?.fullName?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() ?? 'U'

  return (
    <>
      <SearchSpotlight open={spotlightOpen} onClose={() => setSpotlightOpen(false)} />
      <header className="lg:hidden shrink-0 px-4 pt-3 pb-2 bg-bg border-b border-border space-y-2.5">

        {/* Row 1: Logo + controls + avatar */}
        <div className="flex items-center justify-between gap-2">
          <Logo />

          <div className="flex items-center gap-1.5 ml-auto">
            {/* Student / Teacher toggle */}
            <div className="flex items-center rounded-lg border border-border bg-surface p-0.5 gap-0.5">
              <button
                onClick={() => { setMode('student'); navigate('/dashboard') }}
                className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                  mode === 'student' ? 'bg-primary text-bg' : 'text-muted'
                }`}
              >
                Student
              </button>
              <button
                onClick={() => { setMode('teacher'); navigate('/dashboard') }}
                className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                  mode === 'teacher' ? 'bg-primary text-bg' : 'text-muted'
                }`}
              >
                Teacher
              </button>
            </div>

            {/* Light / Dark toggle */}
            <button
              onClick={toggle}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-surface text-muted hover:text-white transition-colors"
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {/* Avatar */}
            <div className="w-8 h-8 rounded-full overflow-hidden border border-border shrink-0">
              {imageUrl
                ? <img src={imageUrl} alt="avatar" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-primary flex items-center justify-center text-bg text-xs font-bold">{initials}</div>
              }
            </div>
          </div>
        </div>

        {/* Row 2: Search bar */}
        <button
          onClick={() => setSpotlightOpen(true)}
          className="w-full flex items-center gap-2.5 bg-surface border border-border rounded-xl px-3.5 py-2.5 text-sm text-muted hover:border-primary/40 transition-colors text-left"
        >
          <Search size={14} className="shrink-0" />
          <span>Search books, topics, tests, or anything...</span>
        </button>
      </header>
    </>
  )
}

// ── App Layout ─────────────────────────────────────────────────────────────────
function AppLayoutInner() {
  const { hidden: topBarHidden } = useTopBar()

  return (
        <div className="flex h-screen overflow-hidden bg-bg">

          {/* Sidebar — desktop only */}
          <div className="hidden lg:flex">
            <Sidebar />
          </div>

          <div className="flex flex-col flex-1 min-w-0">
            {/* TopBar — desktop only */}
            <div className="hidden lg:block">
              <TopBar />
            </div>

            {/* Mobile top bar — hidden when a page requests it */}
            {!topBarHidden && <MobileTopBar />}

            {/* Main content — extra bottom padding on mobile for bottom nav */}
            <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
              <Outlet />
            </main>
          </div>
        </div>
  )
}

export default function AppLayout() {
  return (
    <ModeProvider>
      <TopBarProvider>
        <SidebarProvider>
          <AppLayoutInner />
          {/* Bottom nav — mobile only */}
          <MobileBottomNav />
        </SidebarProvider>
      </TopBarProvider>
    </ModeProvider>
  )
}

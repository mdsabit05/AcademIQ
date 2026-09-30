import { useEffect, useRef, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Sun, Moon, LogOut, Settings } from 'lucide-react'
import { useUser, useClerk } from '../../lib/auth.ts'
import Sidebar from './Sidebar.tsx'
import MobileBottomNav from './MobileBottomNav.tsx'
import { SidebarProvider } from '../../lib/sidebarContext.tsx'
import { ModeProvider, useMode } from '../../lib/modeContext.tsx'
import { TopBarProvider, useTopBar } from '../../lib/topBarContext.tsx'
import { useTheme } from '../../lib/theme.tsx'
import Logo from '../Logo.tsx'

// ── Mobile top bar ─────────────────────────────────────────────────────────────
function MobileTopBar() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const [menuOpen, setMenuOpen] = useState(false)
  const { mode, setMode } = useMode()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const menuRef = useRef<HTMLDivElement>(null)
  const imageUrl = user?.imageUrl
  const initials = user?.fullName?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() ?? 'U'

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <header className="md:hidden shrink-0 h-14 px-4 flex items-center gap-3 bg-bg border-b border-border">
      <Logo size="sm" />

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

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-surface text-muted hover:text-white transition-colors"
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* Avatar + dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="w-8 h-8 rounded-full overflow-hidden border border-border shrink-0"
          >
            {imageUrl
              ? <img src={imageUrl} alt="avatar" className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-primary flex items-center justify-center text-bg text-xs font-bold">{initials}</div>
            }
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-border bg-surface shadow-xl py-1 overflow-hidden" style={{ zIndex: 9999 }}>
              <div className="px-3 py-2.5 border-b border-border/60">
                <p className="text-xs font-semibold text-white truncate">{user?.fullName ?? 'User'}</p>
                <p className="text-[10px] text-muted">{user?.primaryEmailAddress?.emailAddress}</p>
              </div>
              <button
                onClick={() => { setMenuOpen(false); navigate('/settings') }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-muted hover:text-white hover:bg-white/5 transition-colors"
              >
                <Settings size={14} /> Settings
              </button>
              <div className="h-px bg-border/60 mx-2 my-1" />
              <button
                onClick={() => { setMenuOpen(false); signOut(() => navigate('/')) }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors"
              >
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

// ── App Layout ─────────────────────────────────────────────────────────────────
function FloatingThemeToggle() {
  const { theme, toggle } = useTheme()

  return (
    <button
      onClick={toggle}
      className="hidden md:flex fixed bottom-5 right-5 z-50 w-10 h-10 items-center justify-center rounded-full border border-border bg-surface/90 backdrop-blur shadow-lg text-muted hover:text-white transition-colors"
    >
      {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  )
}

function AppLayoutInner() {
  const { hidden: topBarHidden } = useTopBar()

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* Sidebar — desktop only */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile top bar — mobile only */}
        {!topBarHidden && <MobileTopBar />}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Floating theme toggle — desktop only */}
      <FloatingThemeToggle />
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

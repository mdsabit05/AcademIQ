import { useRef, useState, useEffect } from 'react'
import { Sun, Moon, ChevronDown, LogOut, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useClerk, useUser, useAuth } from '../../lib/auth.ts'
import { useTheme } from '../../lib/theme.tsx'
import { useCurrentUser } from '../../lib/useCurrentUser.ts'
import { useMode } from '../../lib/modeContext.tsx'
import Logo from '../Logo.tsx'

export default function TopBar() {
  const { theme, toggle } = useTheme()
  const { user } = useCurrentUser()
  const { user: clerkUser } = useUser()
  const { signOut, openSignIn } = useClerk()
  const { isGuest } = useAuth()
  const navigate = useNavigate()
  const { mode, setMode } = useMode()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'
  const imageUrl = clerkUser?.imageUrl

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <header className="h-14 flex items-center gap-4 border-b border-border bg-surface/80 backdrop-blur px-5 shrink-0" style={{ zIndex: 100 }}>
      {/* Left: Logo */}
      <Logo size="sm" />

      {/* Right: controls */}
      <div className="ml-auto flex items-center gap-2">
        {/* Guest Mode badge */}
        {isGuest && (
          <button
            onClick={() => {
              if (openSignIn) openSignIn()
              else navigate('/sign-in')
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-all cursor-pointer"
            title="You are browsing as a guest. Click to sign in and save your history permanently."
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="hidden sm:inline">Guest Mode •</span> <span className="underline font-semibold">Sign In</span>
          </button>
        )}

        {/* Student / Teacher toggle */}
        <div className="flex items-center rounded-lg border border-border bg-bg p-0.5 gap-0.5">
          <button
            onClick={() => { setMode('student'); navigate('/dashboard') }}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              mode === 'student' ? 'bg-primary text-bg shadow-sm' : 'text-muted hover:text-white'
            }`}
          >
            Student
          </button>
          <button
            onClick={() => { setMode('teacher'); navigate('/dashboard') }}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              mode === 'teacher' ? 'bg-primary text-bg shadow-sm' : 'text-muted hover:text-white'
            }`}
          >
            Teacher
          </button>
        </div>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-muted hover:text-white hover:bg-white/5 transition-colors"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* User dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-white/5 transition-colors"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-border">
              {imageUrl
                ? <img src={imageUrl} alt="avatar" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-primary flex items-center justify-center text-bg text-xs font-bold">{initials}</div>
              }
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-sm font-semibold text-white leading-none">{user?.name ?? 'Student'}</p>
              <p className="text-[11px] text-muted capitalize mt-0.5">{user?.role ?? 'student'}</p>
            </div>
            <ChevronDown size={13} className={`text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-border bg-surface shadow-xl py-1 overflow-hidden" style={{ zIndex: 9999 }}>
              <div className="px-3 py-2.5 border-b border-border/60">
                <p className="text-xs font-semibold text-white truncate">{user?.name ?? 'Student'}</p>
                <p className="text-[10px] text-muted capitalize mt-0.5">{user?.role ?? 'student'}</p>
              </div>
              <button
                onClick={() => { setOpen(false); navigate('/settings') }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-muted hover:text-white hover:bg-white/5 transition-colors"
              >
                <Settings size={14} /> Settings
              </button>
              <div className="h-px bg-border/60 mx-2 my-1" />
              <button
                onClick={() => signOut(() => navigate('/'))}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors"
              >
                <LogOut size={14} /> {isGuest ? 'Exit Guest' : 'Sign Out'}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

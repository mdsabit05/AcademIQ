import { useRef, useState, useEffect } from 'react'
import { Bell, Search, Sun, Moon, ChevronDown, LogOut, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useClerk } from '@clerk/clerk-react'
import { useTheme } from '../../lib/theme.tsx'
import { useCurrentUser } from '../../lib/useCurrentUser.ts'

export default function TopBar() {
  const { theme, toggle } = useTheme()
  const { user } = useCurrentUser()
  const { signOut } = useClerk()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  // Close dropdown on outside click
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
    <header className="h-14 flex items-center gap-4 border-b border-border bg-surface/80 backdrop-blur px-5 shrink-0 relative" style={{ zIndex: 100 }}>
      {/* Search */}
      <div className="flex-1 relative max-w-2xl">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <input
          readOnly
          className="w-full bg-bg border border-border rounded-lg pl-9 pr-20 py-2 text-sm text-white placeholder:text-muted focus:outline-none cursor-default"
          placeholder="Search books, topics, tests, or ask anything..."
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-subtle bg-border/40 rounded px-1.5 py-0.5 font-mono select-none">
          Ctrl K
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {/* Theme */}
        <button
          onClick={toggle}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-muted hover:text-white hover:bg-white/5 transition-colors"
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        <div className="w-px h-6 bg-border mx-1.5" />

        {/* Notifications */}
        <button className="relative w-9 h-9 flex items-center justify-center rounded-lg text-muted hover:text-white hover:bg-white/5 transition-colors">
          <Bell size={17} />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-danger rounded-full" />
        </button>

        <div className="w-px h-6 bg-border mx-1.5" />

        {/* User dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-white/5 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-sm font-medium text-white leading-none">{user?.name ?? 'Student'}</p>
              <p className="text-[11px] text-muted capitalize mt-0.5">{user?.role ?? 'student'}</p>
            </div>
            <ChevronDown size={13} className={`text-muted hidden sm:block transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown menu */}
          {open && (
            <div className="absolute right-0 top-full mt-1.5 w-44 rounded-xl border border-border bg-surface shadow-xl py-1 overflow-hidden" style={{ zIndex: 9999 }}>
              <div className="px-3 py-2 border-b border-border/60">
                <p className="text-xs font-semibold text-white truncate">{user?.name ?? 'Student'}</p>
                <p className="text-[10px] text-muted capitalize">{user?.role ?? 'student'}</p>
              </div>
              <button
                onClick={() => signOut(() => navigate('/'))}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-muted hover:text-white hover:bg-white/5 transition-colors"
              >
                <LogOut size={14} />
                Sign Out
              </button>
              <div className="h-px bg-border/60 mx-2 my-1" />
              <button
                onClick={() => { setOpen(false); navigate('/settings') }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-muted hover:text-white hover:bg-white/5 transition-colors"
              >
                <Settings size={14} />
                Settings
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

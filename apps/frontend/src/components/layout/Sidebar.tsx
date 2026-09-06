import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useClerk } from '@clerk/clerk-react'
import {
  Home,
  BookOpen,
  MessageSquare,
  FileText,
  BarChart2,
  Settings,
  Upload,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react'
import { clsx } from 'clsx'
import Logo from '../Logo.tsx'
import { useTheme } from '../../lib/theme.tsx'

const NAV_ITEMS = [
  { to: '/dashboard', icon: Home, label: 'Home' },
  { to: '/materials', icon: Upload, label: 'Materials' },
  { to: '/learn', icon: BookOpen, label: 'Learn' },
  { to: '/ask', icon: MessageSquare, label: 'Ask AI' },
  { to: '/test/new', icon: FileText, label: 'Tests' },
  { to: '/progress', icon: BarChart2, label: 'Progress' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { signOut } = useClerk()
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()

  return (
    <aside
      className={clsx(
        'relative flex h-screen flex-col border-r border-border bg-surface transition-all duration-300',
        collapsed ? 'w-16' : 'w-56',
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-border px-4">
        <Logo size="sm" showWordmark={!collapsed} />
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted hover:bg-white/5 hover:text-white',
                collapsed && 'justify-center px-2',
              )
            }
          >
            <Icon size={18} className="shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Theme + Sign out */}
      <div className="border-t border-border p-2 space-y-1">
        <button
          onClick={toggle}
          className={clsx(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-white',
            collapsed && 'justify-center px-2',
          )}
        >
          {theme === 'dark'
            ? <Sun size={18} className="shrink-0" />
            : <Moon size={18} className="shrink-0" />}
          {!collapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>
        <button
          onClick={() => signOut(() => navigate('/'))}
          className={clsx(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-white',
            collapsed && 'justify-center px-2',
          )}
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-muted hover:text-white"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  )
}

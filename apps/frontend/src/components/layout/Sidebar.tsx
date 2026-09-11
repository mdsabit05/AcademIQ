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
  Brain,
  ScrollText,
  Shield,
  BookMarked,
} from 'lucide-react'
import { clsx } from 'clsx'
import Logo from '../Logo.tsx'
import { useCurrentUser } from '../../lib/useCurrentUser.ts'
import { canTeach, isAdmin } from '../../lib/rbac.ts'

interface NavItem {
  to: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
}

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="mx-auto w-4 h-px bg-border mt-3 mb-1" />
  return (
    <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-subtle select-none">
      {label}
    </p>
  )
}

function NavItem({
  to,
  icon: Icon,
  label,
  collapsed,
}: NavItem & { collapsed: boolean }) {
  return (
    <NavLink to={to} className="block">
      {({ isActive }) => (
        <div
          className={clsx(
            'relative flex items-center gap-3 py-2.5 text-sm font-medium transition-colors rounded-lg',
            collapsed ? 'justify-center px-2' : 'pl-4 pr-3',
            isActive
              ? 'text-primary bg-primary/10'
              : 'text-muted hover:text-white hover:bg-white/5',
          )}
        >
          {/* Left border indicator */}
          {!collapsed && (
            <span
              className={clsx(
                'absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full transition-colors',
                isActive ? 'bg-primary' : 'bg-transparent',
              )}
            />
          )}
          <Icon size={17} className="shrink-0" />
          {!collapsed && <span>{label}</span>}
        </div>
      )}
    </NavLink>
  )
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { signOut } = useClerk()
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const role = user?.role

  const MAIN_ITEMS: NavItem[] = [
    { to: '/dashboard', icon: Home, label: 'Dashboard' },
    { to: '/books', icon: Upload, label: 'My Books' },
    { to: '/ask', icon: MessageSquare, label: 'AI Tutor' },
    { to: '/test/new', icon: FileText, label: 'Tests' },
    { to: '/progress', icon: BarChart2, label: 'Progress' },
    { to: '/subjects', icon: BookMarked, label: 'Syllabus' },
    { to: '/memory', icon: Brain, label: 'Memory' },
  ]

  const TEACHER_ITEMS: NavItem[] = [
    { to: '/papers', icon: ScrollText, label: 'Question Papers' },
  ]

  const ADMIN_ITEMS: NavItem[] = [
    { to: '/admin', icon: Shield, label: 'User Management' },
  ]

  return (
    <aside
      className={clsx(
        'relative flex h-screen flex-col border-r border-border bg-surface transition-all duration-300 shrink-0',
        collapsed ? 'w-16' : 'w-52',
      )}
    >
      {/* Logo */}
      <div className={clsx('flex flex-col border-b border-border px-4 py-4', collapsed && 'items-center')}>
        <Logo size="sm" showWordmark={!collapsed} />
        {!collapsed && (
          <p className="mt-1 text-[10px] tracking-[0.18em] text-subtle font-medium uppercase">
            Learn · Practice · Grow
          </p>
        )}
      </div>

      {/* Role badge */}
      {!collapsed && role && role !== 'student' && (
        <div className="mx-3 mt-2 rounded-md bg-primary/10 px-2 py-1 text-center text-[10px] font-semibold capitalize text-primary tracking-wide">
          {role}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        <SectionLabel label="Main" collapsed={collapsed} />
        <div className="space-y-0.5">
          {MAIN_ITEMS.map((item) => (
            <NavItem key={item.to} {...item} collapsed={collapsed} />
          ))}
        </div>

        {canTeach(role) && (
          <>
            <SectionLabel label="Teacher" collapsed={collapsed} />
            <div className="space-y-0.5">
              {TEACHER_ITEMS.map((item) => (
                <NavItem key={item.to} {...item} collapsed={collapsed} />
              ))}
            </div>
          </>
        )}

        {isAdmin(role) && (
          <>
            <SectionLabel label="Admin" collapsed={collapsed} />
            <div className="space-y-0.5">
              {ADMIN_ITEMS.map((item) => (
                <NavItem key={item.to} {...item} collapsed={collapsed} />
              ))}
            </div>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-2 space-y-0.5">
        {/* Settings */}
        <NavItem to="/settings" icon={Settings} label="Settings" collapsed={collapsed} />

        {/* Sign out */}
        <button
          onClick={() => signOut(() => navigate('/'))}
          className={clsx(
            'flex w-full items-center gap-3 rounded-lg py-2.5 text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-white',
            collapsed ? 'justify-center px-2' : 'pl-4 pr-3',
          )}
        >
          <LogOut size={17} className="shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>

        {/* Bottom quote */}
        {!collapsed && (
          <div className="px-2 pt-3 pb-1">
            <p className="text-[11px] text-subtle leading-relaxed italic">
              "A better you, for a brighter tomorrow."
            </p>
            <div className="mt-1.5 h-px w-8 bg-primary/40" />
            <p className="mt-1.5 text-[10px] text-subtle/50">v2.0.0</p>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-muted hover:text-white shadow-sm"
      >
        {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
      </button>
    </aside>
  )
}

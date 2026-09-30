import { useSidebar } from '../../lib/sidebarContext.tsx'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Home,
  BookOpen,
  MessageSquare,
  FileText,
  BarChart2,
  Settings,
  ChevronLeft,
  ChevronRight,
  ScrollText,
  Shield,
  BookMarked,
  CalendarDays,
  Sparkles,
  LayoutDashboard,
  LogOut,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { clsx } from 'clsx'
import Logo from '../Logo.tsx'
import { useCurrentUser } from '../../lib/useCurrentUser.ts'
import { isAdmin } from '../../lib/rbac.ts'
import { useMode } from '../../lib/modeContext.tsx'
import { useClerk, useUser, useAuth } from '../../lib/auth.ts'

interface NavItem {
  to: string
  icon: LucideIcon
  label: string
}

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="mx-auto w-6 h-px bg-border my-2" />
  return (
    <div className="pb-1">
      {label && (
        <p className="px-3 text-[11px] font-bold uppercase tracking-[0.2em] text-muted select-none mb-1">
          {label}
        </p>
      )}
    </div>
  )
}

function NavItem({
  to,
  icon: Icon,
  label,
  collapsed,
}: NavItem & { collapsed: boolean }) {
  return (
    <NavLink to={to} end={to === '/dashboard'} className="block">
      {({ isActive }) => (
        <div
          style={{ paddingTop: '0.7rem', paddingBottom: '0.7rem' }}
          className={clsx(
            'relative flex items-center gap-3 text-sm font-medium transition-colors rounded-lg',
            collapsed ? 'justify-center px-2' : 'pl-4 pr-3',
            isActive
              ? 'text-primary bg-primary/10'
              : 'text-muted hover:text-white hover:bg-white/5',
          )}
        >
          {!collapsed && (
            <span
              className={clsx(
                'absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full transition-colors',
                isActive ? 'bg-primary' : 'bg-transparent',
              )}
            />
          )}
          <Icon size={16} className="shrink-0" />
          {!collapsed && <span>{label}</span>}
        </div>
      )}
    </NavLink>
  )
}

export default function Sidebar() {
  const { collapsed, setCollapsed } = useSidebar()
  const { user } = useCurrentUser()
  const { user: clerkUser } = useUser()
  const { signOut } = useClerk()
  const { isGuest } = useAuth()
  const navigate = useNavigate()
  const { mode, setMode } = useMode()
  const role = user?.role

  const imageUrl = clerkUser?.imageUrl
  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  const STUDENT_ITEMS: NavItem[] = [
    { to: '/dashboard',  icon: Home,         label: 'Dashboard'   },
    { to: '/books',      icon: BookOpen,      label: 'My Books'    },
    { to: '/tutor',      icon: MessageSquare, label: 'AI Tutor'    },
    { to: '/tests',      icon: FileText,      label: 'Tests'       },
    { to: '/progress',   icon: BarChart2,     label: 'Progress'    },
    { to: '/study-plan', icon: CalendarDays,  label: 'Study Plan'  },
    { to: '/syllabus',   icon: BookMarked,    label: 'Syllabus'    },
    { to: '/general-ai', icon: Sparkles,      label: 'General AI'  },
  ]

  const TEACHER_MAIN_ITEMS: NavItem[] = [
    { to: '/dashboard',           icon: LayoutDashboard, label: 'Dashboard'       },
    { to: '/teacher/materials',   icon: BookOpen,        label: 'My Materials'    },
    { to: '/question-papers',     icon: ScrollText,      label: 'Question Papers' },
    { to: '/general-ai',          icon: Sparkles,        label: 'AI Assistant'    },
  ]

  const isTeacher = mode === 'teacher'
  const navItems = isTeacher ? TEACHER_MAIN_ITEMS : STUDENT_ITEMS

  return (
    <aside
      className={clsx(
        'relative flex h-screen flex-col border-r border-border bg-surface transition-all duration-300 shrink-0',
        collapsed ? 'w-16' : 'w-52',
      )}
    >
      {/* ── Logo ── */}
      <div className={clsx('flex flex-col px-4 py-3 shrink-0', collapsed && 'items-center')}>
        <Logo size={collapsed ? 'sm' : 'md'} showWordmark={!collapsed} />
        {!collapsed && (
          <p className="mt-1 px-1 text-[10px] font-semibold tracking-[0.12em] text-muted/70 uppercase select-none">
            {isTeacher ? 'Teach · Create · Inspire' : 'Learn · Practice · Grow'}
          </p>
        )}
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-2 flex flex-col overflow-y-auto min-h-0">
        <SectionLabel label={isTeacher ? 'Teacher' : 'Main'} collapsed={collapsed} />
        <div>
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} collapsed={collapsed} />
          ))}
        </div>
      </nav>

      {/* ── Bottom section ── */}
      <div className="shrink-0 px-2 pb-2">
        {/* Student / Teacher toggle */}
        {!collapsed ? (
          <div className="mx-1 mb-2 flex items-center rounded-lg border border-border bg-bg p-0.5 gap-0.5">
            <button
              onClick={() => { setMode('student'); navigate('/dashboard') }}
              className={`flex-1 py-1 rounded-md text-xs font-semibold transition-all ${
                mode === 'student' ? 'bg-primary text-bg shadow-sm' : 'text-muted hover:text-white'
              }`}
            >
              Student
            </button>
            <button
              onClick={() => { setMode('teacher'); navigate('/dashboard') }}
              className={`flex-1 py-1 rounded-md text-xs font-semibold transition-all ${
                mode === 'teacher' ? 'bg-primary text-bg shadow-sm' : 'text-muted hover:text-white'
              }`}
            >
              Teacher
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setMode(mode === 'student' ? 'teacher' : 'student'); navigate('/dashboard') }}
            style={{ paddingTop: '0.7rem', paddingBottom: '0.7rem' }}
            className="w-full flex justify-center px-2 text-xs font-bold text-primary hover:text-white transition-colors rounded-lg hover:bg-white/5"
            title={mode === 'student' ? 'Switch to Teacher' : 'Switch to Student'}
          >
            {mode === 'student' ? 'S' : 'T'}
          </button>
        )}

        {/* Admin section */}
        <div className={clsx(!isAdmin(role) && 'hidden')}>
          <SectionLabel label="Admin" collapsed={collapsed} />
          <NavItem to="/admin/users" icon={Shield} label="User Management" collapsed={collapsed} />
        </div>

        <div className="h-px bg-border/50 mx-1 my-2" />

        {/* Settings */}
        <NavItem to="/settings" icon={Settings} label="Settings" collapsed={collapsed} />

        {/* Sign Out */}
        <button
          onClick={() => signOut(() => navigate('/'))}
          style={{ paddingTop: '0.7rem', paddingBottom: '0.7rem' }}
          className={clsx(
            'w-full flex items-center gap-3 text-sm font-medium text-muted hover:text-red-400 hover:bg-red-500/5 transition-colors rounded-lg',
            collapsed ? 'justify-center px-2' : 'pl-4 pr-3',
          )}
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span>{isGuest ? 'Exit Guest' : 'Sign Out'}</span>}
        </button>

        {/* User info */}
        {!collapsed && (
          <div className="mt-2 mx-1 flex items-center gap-2.5 px-2 py-2 rounded-lg bg-bg border border-border/50">
            <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 border border-border">
              {imageUrl
                ? <img src={imageUrl} alt="avatar" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-primary flex items-center justify-center text-bg text-[10px] font-bold">{initials}</div>
              }
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate leading-none">{user?.name ?? 'Student'}</p>
              <p className="text-[10px] text-muted capitalize mt-0.5">{user?.role ?? 'student'}</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center mt-2">
            <div className="w-7 h-7 rounded-full overflow-hidden border border-border">
              {imageUrl
                ? <img src={imageUrl} alt="avatar" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-primary flex items-center justify-center text-bg text-[10px] font-bold">{initials}</div>
              }
            </div>
          </div>
        )}
      </div>

      {/* ── Collapse toggle ── */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-16 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-muted hover:text-white shadow-sm z-10"
      >
        {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
      </button>
    </aside>
  )
}

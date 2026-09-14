import { useSidebar } from '../../lib/sidebarContext.tsx'
import quoteImg from '../../assets/quote.png'
import { NavLink } from 'react-router-dom'
import {
  Home,
  BookOpen,
  MessageSquare,
  FileText,
  BarChart2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Brain,
  ScrollText,
  Shield,
  BookMarked,
  CalendarDays,
  Sparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { clsx } from 'clsx'
import Logo from '../Logo.tsx'
import { useCurrentUser } from '../../lib/useCurrentUser.ts'
import { canTeach, isAdmin } from '../../lib/rbac.ts'

interface NavItem {
  to: string
  icon: LucideIcon
  label: string
}

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="mx-auto w-4 h-px bg-border my-2" />
  return (
    <div className="pb-1">
      {label && (
        <p className="px-3 text-[13px] font-bold uppercase tracking-[0.2em] text-muted select-none mb-1">
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
  const role = user?.role

  const MAIN_ITEMS: NavItem[] = [
    { to: '/dashboard',  icon: Home,         label: 'Dashboard'   },
    { to: '/books',      icon: BookOpen,      label: 'My Books'    },
    { to: '/tutor',      icon: MessageSquare, label: 'AI Tutor'    },
    { to: '/tests',      icon: FileText,      label: 'Tests'       },
    { to: '/progress',   icon: BarChart2,     label: 'Progress'    },
    { to: '/study-plan', icon: CalendarDays,  label: 'Study Plan'  },
    { to: '/syllabus',   icon: BookMarked,    label: 'Syllabus'    },
    { to: '/memory',     icon: Brain,         label: 'Memory'      },
    { to: '/general-ai', icon: Sparkles,      label: 'General AI'  },
  ]

  const TEACHER_ITEMS: NavItem[] = [
    { to: '/question-papers', icon: ScrollText, label: 'Question Papers' },
  ]

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
            Learn · Practice · Grow
          </p>
        )}
      </div>

      {/* ── Nav — flex-col so quote sticks to bottom via mt-auto ── */}
      <nav className="flex-1 px-2 flex flex-col overflow-y-auto min-h-0">

        {/* MAIN */}
        <SectionLabel label="Main" collapsed={collapsed} />
        <div>
          {MAIN_ITEMS.map((item) => (
            <NavItem key={item.to} {...item} collapsed={collapsed} />
          ))}
        </div>

        {/* TEACHER */}
        {canTeach(role) && (
          <>
            <SectionLabel label="Teacher" collapsed={collapsed} />
            <div>
              {TEACHER_ITEMS.map((item) => (
                <NavItem key={item.to} {...item} collapsed={collapsed} />
              ))}
            </div>
          </>
        )}

      </nav>

      {/* ── Fixed bottom (order top→bottom): Admin → Settings → Quote ── */}
      <div className="shrink-0 px-2">
        {/* ADMIN section — invisible for non-admin (space preserved) */}
        <div className={clsx(!isAdmin(role) && 'invisible')}>
          <SectionLabel label="Admin" collapsed={collapsed} />
          <NavItem to="/admin/users" icon={Shield} label="User Management" collapsed={collapsed} />
        </div>

        {/* Settings — always visible */}
        <NavItem to="/settings" icon={Settings} label="Settings" collapsed={collapsed} />
      </div>

      {/* Quote — absolute bottom */}
      {!collapsed && (
        <div className="shrink-0 mx-2 mb-2 overflow-hidden rounded-lg" style={{ height: 147, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <img
            src={quoteImg}
            alt=""
            className="w-full h-full"
            style={{ objectFit: 'cover', objectPosition: 'center' }}
          />
        </div>
      )}

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

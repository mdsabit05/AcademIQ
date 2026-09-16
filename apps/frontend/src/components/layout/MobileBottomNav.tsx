import { NavLink, useNavigate } from 'react-router-dom'
import { Home, BookOpen, FileText, BarChart2, Menu, X, Sparkles, CalendarDays, ScrollText, Shield, Settings, Zap, LayoutDashboard, BookMarked, MessageSquare } from 'lucide-react'
import { useState } from 'react'
import { useCurrentUser } from '../../lib/useCurrentUser.ts'
import { isAdmin } from '../../lib/rbac.ts'
import { useMode } from '../../lib/modeContext.tsx'

const STUDENT_NAV = [
  { to: '/dashboard', icon: Home,          label: 'Home'     },
  { to: '/books',     icon: BookOpen,      label: 'My Books'  },
  { to: '/tutor',     icon: MessageSquare, label: 'AI Tutor'  },
  { to: '/tests',     icon: FileText,      label: 'Tests'     },
]

const STUDENT_MENU = [
  { to: '/progress',   icon: BarChart2,    label: 'Progress'   },
  { to: '/study-plan', icon: CalendarDays, label: 'Study Plan' },
  { to: '/syllabus',   icon: BookMarked,   label: 'Syllabus'   },
  { to: '/general-ai', icon: Zap,          label: 'General AI' },
  { to: '/settings',   icon: Settings,     label: 'Settings'   },
]

const TEACHER_NAV = [
  { to: '/dashboard',         icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/teacher/materials', icon: BookOpen,        label: 'Materials' },
  { to: '/question-papers',   icon: ScrollText,      label: 'Papers'    },
  { to: '/general-ai',        icon: Sparkles,        label: 'AI'        },
]

const TEACHER_MENU = [
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function MobileBottomNav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { user } = useCurrentUser()
  const { mode } = useMode()
  const navigate = useNavigate()
  const admin = isAdmin(user?.role)
  const isTeacher = mode === 'teacher'

  const navItems = isTeacher ? TEACHER_NAV : STUDENT_NAV
  const menuItems = isTeacher ? TEACHER_MENU : STUDENT_MENU

  return (
    <>
      {/* Slide-up Menu Sheet */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
            onClick={() => setMenuOpen(false)}
          />
          <div className="fixed bottom-16 left-3 right-3 z-[201] rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold text-white">More</span>
              <button onClick={() => setMenuOpen(false)} className="text-muted hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2">
              {menuItems.map(({ to, icon: Icon, label }) => (
                <button
                  key={to}
                  onClick={() => { navigate(to); setMenuOpen(false) }}
                  className="flex items-center gap-3 rounded-xl border border-border bg-bg p-3 text-left hover:bg-white/5 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon size={15} className="text-primary" />
                  </div>
                  <span className="text-sm font-medium text-white">{label}</span>
                </button>
              ))}
              {admin && (
                <button
                  onClick={() => { navigate('/admin'); setMenuOpen(false) }}
                  className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-left col-span-2"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Shield size={15} className="text-amber-400" />
                  </div>
                  <span className="text-sm font-medium text-amber-400">Admin Dashboard</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Bottom Nav Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-[199] md:hidden">
        <div className="mx-2 mb-2 rounded-2xl border border-border bg-surface/95 backdrop-blur-md shadow-2xl">
          <div className="flex items-center px-2 py-1">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl transition-colors ${
                    isActive ? 'text-primary' : 'text-muted hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                    <span className={`text-[10px] font-medium ${isActive ? 'text-primary' : ''}`}>{label}</span>
                  </>
                )}
              </NavLink>
            ))}

            {/* Menu button */}
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl transition-colors ${menuOpen ? 'text-primary' : 'text-muted hover:text-white'}`}
            >
              <Menu size={20} strokeWidth={menuOpen ? 2.5 : 1.8} />
              <span className="text-[10px] font-medium">Menu</span>
            </button>
          </div>
          {/* iOS home indicator space */}
          <div className="h-safe-bottom" />
        </div>
      </nav>
    </>
  )
}

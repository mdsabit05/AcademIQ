import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import {
  Users, BookOpen, FileText, Zap, Clock,
  Search, Filter, ChevronDown,
  MoreHorizontal,
} from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import type { User } from 'shared'

// ── Role badge ─────────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    student: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    teacher: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    admin:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
  }
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border capitalize ${map[role] ?? 'bg-white/5 text-muted border-border'}`}>
      {role}
    </span>
  )
}

// ── Avatar initials ────────────────────────────────────────────────────────────
function Avatar({ name, role }: { name: string; role: string }) {
  const colors: Record<string, string> = {
    student: 'bg-sky-500/20 text-sky-400',
    teacher: 'bg-violet-500/20 text-violet-400',
    admin:   'bg-amber-500/20 text-amber-400',
  }
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${colors[role] ?? 'bg-white/10 text-muted'}`}>
      {initials || '?'}
    </div>
  )
}


export default function AdminDashboard() {
  const { getToken } = useAuth()
  const [stats, setStats] = useState<{
    users: { total_users: number; total_students: number; total_teachers: number; total_admins: number }
    content: { total_books: number; total_tests: number; total_attempts: number; total_papers: number }
  } | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const PER_PAGE = 5

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const api = makeApi(token)
      const [statsRes, usersRes] = await Promise.all([
        api.admin.stats(),
        api.admin.users(PER_PAGE, 0),
      ])
      setStats(statsRes)
      setUsers(usersRes.users)
      setTotal(usersRes.total)
      setLoading(false)
    }
    load().catch(console.error)
  }, [getToken])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function fetchUsers(q = search, role = roleFilter, status = statusFilter, p = page) {
    const token = await getToken()
    if (!token) return
    const offset = (p - 1) * PER_PAGE
    const { users: res, total: t } = await makeApi(token).admin.users(PER_PAGE, offset, q || undefined)
    // client-side filter by role/status since API may not support it
    const filtered = res.filter((u) => {
      if (role && u.role !== role) return false
      if (status && u.status !== status) return false
      return true
    })
    setUsers(filtered)
    setTotal(t)
  }

  async function setStatus(userId: string, status: string) {
    const token = await getToken()
    if (!token) return
    const { user } = await makeApi(token).admin.setStatus(userId, status)
    setUsers((prev) => prev.map((u) => (u.id === userId ? user : u)))
    setOpenMenu(null)
  }

  async function deleteUser(userId: string) {
    if (!confirm('Delete this user permanently? This cannot be undone.')) return
    const token = await getToken()
    if (!token) return
    await makeApi(token).admin.deleteUser(userId)
    setUsers((prev) => prev.filter((u) => u.id !== userId))
    setTotal((prev) => prev - 1)
    setOpenMenu(null)
  }

  const totalPages = Math.ceil(total / PER_PAGE)
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const statCards = stats ? [
    { label: 'Total Students',  value: stats.users.total_students,   icon: Users,    color: 'text-sky-400',     bg: 'bg-sky-500/10'     },
    { label: 'Total Teachers',  value: stats.users.total_teachers,   icon: Users,    color: 'text-violet-400',  bg: 'bg-violet-500/10'  },
    { label: 'Total Admins',    value: stats.users.total_admins,     icon: Users,    color: 'text-amber-400',   bg: 'bg-amber-500/10'   },
    { label: 'Total Users',     value: stats.users.total_users,      icon: Users,    color: 'text-indigo-400',  bg: 'bg-indigo-500/10'  },
    { label: 'Documents',       value: stats.content.total_books,    icon: BookOpen, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Tests Generated', value: stats.content.total_tests,    icon: FileText, color: 'text-rose-400',    bg: 'bg-rose-500/10'    },
    { label: 'Test Attempts',   value: stats.content.total_attempts, icon: Zap,      color: 'text-cyan-400',    bg: 'bg-cyan-500/10'    },
    { label: 'Question Papers', value: stats.content.total_papers,   icon: Clock,    color: 'text-blue-400',    bg: 'bg-blue-500/10'    },
  ] : []

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-5 space-y-5 max-w-[1400px] mx-auto">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Welcome back,</p>
            <h1 className="text-xl lg:text-2xl font-bold text-white leading-tight">Admin Dashboard</h1>
            <p className="text-xs text-muted mt-0.5 hidden sm:block">Monitor platform usage, manage users and ensure everything is running smoothly.</p>
          </div>
          <div className="flex items-center gap-1.5 bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-muted shrink-0">
            <Clock size={12} className="text-primary" />
            <span className="hidden sm:inline">Today</span>
            <span className="text-white font-medium">{today}</span>
          </div>
        </div>

        {/* ── System Overview ── */}
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-white">System Overview</h2>
              <p className="text-[11px] text-muted mt-0.5">Key metrics from across the platform.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {statCards.map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-bg p-3 space-y-2">
                <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <s.icon size={15} className={s.color} />
                </div>
                <div>
                  <p className="text-xl font-bold text-white">{s.value.toLocaleString()}</p>
                  <p className="text-[11px] text-muted">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── User Management ── */}
        <div>
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-white">User Management</h2>
                <p className="text-[11px] text-muted mt-0.5">Manage students, teachers and admins.</p>
              </div>
            </div>

            {/* Filters */}
            <div className="space-y-2 mb-3">
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); fetchUsers(e.target.value, roleFilter, statusFilter, 1) }}
                  className="w-full bg-bg border border-border rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder:text-muted/50 focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    value={roleFilter}
                    onChange={(e) => { setRoleFilter(e.target.value); setPage(1); fetchUsers(search, e.target.value, statusFilter, 1) }}
                    className="w-full appearance-none bg-bg border border-border rounded-lg pl-3 pr-7 py-2 text-xs text-muted focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="">All Roles</option>
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                  </select>
                  <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                </div>
                <div className="relative flex-1">
                  <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); fetchUsers(search, roleFilter, e.target.value, 1) }}
                    className="w-full appearance-none bg-bg border border-border rounded-lg pl-3 pr-7 py-2 text-xs text-muted focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                  <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                </div>
                <button className="w-9 h-9 flex items-center justify-center bg-bg border border-border rounded-lg text-muted hover:text-white transition-colors shrink-0">
                  <Filter size={12} />
                </button>
              </div>
            </div>

            {/* Table — desktop */}
            <div className="hidden md:block rounded-xl border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-bg/60">
                    <th className="text-left text-[11px] font-semibold text-muted px-3 py-2.5">Name</th>
                    <th className="text-left text-[11px] font-semibold text-muted px-3 py-2.5">Email</th>
                    <th className="text-left text-[11px] font-semibold text-muted px-3 py-2.5">Role</th>
                    <th className="text-left text-[11px] font-semibold text-muted px-3 py-2.5">Status</th>
                    <th className="text-left text-[11px] font-semibold text-muted px-3 py-2.5">Joined</th>
                    <th className="text-right text-[11px] font-semibold text-muted px-3 py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.length === 0 ? (
                    <tr><td colSpan={6} className="text-center text-muted py-8">No users found</td></tr>
                  ) : users.map((u) => (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <Avatar name={u.name || u.email || '?'} role={u.role} />
                          <span className="font-medium text-white truncate max-w-[100px]">{u.name || '—'}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-muted truncate max-w-[120px]">{u.email || '—'}</td>
                      <td className="px-3 py-2.5"><RoleBadge role={u.role} /></td>
                      <td className="px-3 py-2.5">
                        <span className={`flex items-center gap-1.5 text-[11px] font-medium ${u.status === 'active' ? 'text-emerald-400' : 'text-red-400'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                          {u.status === 'active' ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-muted">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="relative inline-block" ref={openMenu === u.id ? menuRef : undefined}>
                          <button
                            onClick={() => setOpenMenu(openMenu === u.id ? null : u.id)}
                            className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <MoreHorizontal size={14} />
                          </button>
                          {openMenu === u.id && (
                            <div className="absolute right-0 top-7 z-50 w-36 rounded-xl border border-border bg-surface shadow-xl py-1">
                              <button onClick={() => setStatus(u.id, u.status === 'active' ? 'suspended' : 'active')}
                                className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${u.status === 'active' ? 'text-amber-400 hover:bg-amber-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'}`}>
                                {u.status === 'active' ? 'Suspend' : 'Activate'}
                              </button>
                              <div className="h-px bg-border mx-2 my-1" />
                              <button onClick={() => deleteUser(u.id)}
                                className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors">
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Card list — mobile */}
            <div className="md:hidden space-y-2">
              {users.length === 0 ? (
                <p className="text-center text-muted py-8 text-sm">No users found</p>
              ) : users.map((u) => (
                <div key={u.id} className="rounded-xl border border-border bg-bg p-3 flex items-center gap-3">
                  <Avatar name={u.name || u.email || '?'} role={u.role} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{u.name || '—'}</p>
                    <p className="text-xs text-muted truncate">{u.email || '—'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <RoleBadge role={u.role} />
                      <span className={`flex items-center gap-1 text-[11px] font-medium ${u.status === 'active' ? 'text-emerald-400' : 'text-red-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        {u.status === 'active' ? 'Active' : 'Suspended'}
                      </span>
                    </div>
                  </div>
                  <div className="relative shrink-0" ref={openMenu === u.id ? menuRef : undefined}>
                    <button
                      onClick={() => setOpenMenu(openMenu === u.id ? null : u.id)}
                      className="p-2 rounded-lg text-muted hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    {openMenu === u.id && (
                      <div className="absolute right-0 top-9 z-50 w-36 rounded-xl border border-border bg-surface shadow-xl py-1">
                        <button onClick={() => setStatus(u.id, u.status === 'active' ? 'suspended' : 'active')}
                          className={`w-full text-left px-3 py-2 text-xs transition-colors ${u.status === 'active' ? 'text-amber-400 hover:bg-amber-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'}`}>
                          {u.status === 'active' ? 'Suspend' : 'Activate'}
                        </button>
                        <div className="h-px bg-border mx-2 my-1" />
                        <button onClick={() => deleteUser(u.id)}
                          className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors">
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-3">
              <p className="text-[11px] text-muted">
                Showing {users.length > 0 ? (page - 1) * PER_PAGE + 1 : 0}–{Math.min(page * PER_PAGE, total)} of {total.toLocaleString()} users
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { const p = Math.max(1, page - 1); setPage(p); fetchUsers(search, roleFilter, statusFilter, p) }}
                  disabled={page === 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-muted hover:text-white hover:bg-white/5 disabled:opacity-30 transition-colors text-sm"
                >‹</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const n = i + 1
                  return (
                    <button key={n} onClick={() => { setPage(n); fetchUsers(search, roleFilter, statusFilter, n) }}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg text-[11px] font-medium transition-colors ${
                        page === n ? 'bg-primary text-bg' : 'border border-border text-muted hover:text-white hover:bg-white/5'
                      }`}>
                      {n}
                    </button>
                  )
                })}
                {totalPages > 5 && <span className="text-muted text-xs px-1">…</span>}
                {totalPages > 5 && (
                  <button onClick={() => { setPage(totalPages); fetchUsers(search, roleFilter, statusFilter, totalPages) }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-[11px] text-muted hover:text-white hover:bg-white/5 transition-colors">
                    {totalPages}
                  </button>
                )}
                <button
                  onClick={() => { const p = Math.min(totalPages, page + 1); setPage(p); fetchUsers(search, roleFilter, statusFilter, p) }}
                  disabled={page >= totalPages}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-muted hover:text-white hover:bg-white/5 disabled:opacity-30 transition-colors text-sm"
                >›</button>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}

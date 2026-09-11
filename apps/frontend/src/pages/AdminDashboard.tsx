import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { Shield, Users, BookOpen, FileText } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import type { User } from 'shared'

export default function AdminDashboard() {
  const { getToken } = useAuth()
  const [stats, setStats] = useState<{
    users: { total_users: number; total_students: number; total_teachers: number; total_admins: number }
    content: { total_books: number; total_tests: number; total_attempts: number; total_papers: number }
  } | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const api = makeApi(token)
      const [statsRes, usersRes] = await Promise.all([
        api.admin.stats(),
        api.admin.users(20, 0),
      ])
      setStats(statsRes)
      setUsers(usersRes.users)
      setLoading(false)
    }
    load().catch(console.error)
  }, [getToken])

  async function searchUsers(q: string) {
    const token = await getToken()
    if (!token) return
    const { users: results } = await makeApi(token).admin.users(20, 0, q || undefined)
    setUsers(results)
  }

  async function setRole(userId: string, role: string) {
    const token = await getToken()
    if (!token) return
    const { user } = await makeApi(token).admin.setRole(userId, role)
    setUsers((prev) => prev.map((u) => (u.id === userId ? user : u)))
  }

  async function setStatus(userId: string, status: string) {
    const token = await getToken()
    if (!token) return
    const { user } = await makeApi(token).admin.setStatus(userId, status)
    setUsers((prev) => prev.map((u) => (u.id === userId ? user : u)))
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center gap-3">
        <Shield size={24} className="text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <p className="mt-0.5 text-muted">Platform management</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Total Users', value: stats.users.total_users, icon: Users },
            { label: 'Books', value: stats.content.total_books, icon: BookOpen },
            { label: 'Tests', value: stats.content.total_tests, icon: FileText },
            { label: 'Attempts', value: stats.content.total_attempts, icon: FileText },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-2 flex items-center gap-2 text-muted">
                <Icon size={14} />
                <span className="text-xs">{label}</span>
              </div>
              <p className="text-2xl font-bold text-white">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Role breakdown */}
      {stats && (
        <div className="mb-8 flex gap-4 text-sm">
          <span className="text-muted">Students: <strong className="text-white">{stats.users.total_students}</strong></span>
          <span className="text-muted">Teachers: <strong className="text-white">{stats.users.total_teachers}</strong></span>
          <span className="text-muted">Admins: <strong className="text-white">{stats.users.total_admins}</strong></span>
        </div>
      )}

      {/* User management */}
      <div className="rounded-xl border border-border bg-surface">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <h2 className="font-semibold text-white">Users</h2>
          <input
            type="text"
            placeholder="Search by email or name…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              searchUsers(e.target.value)
            }}
            className="ml-auto rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-white placeholder-muted outline-none focus:border-primary"
          />
        </div>
        <div className="divide-y divide-border">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-4 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{u.name || u.email}</p>
                <p className="truncate text-xs text-muted">{u.email}</p>
              </div>
              <select
                value={u.role}
                onChange={(e) => setRole(u.id, e.target.value)}
                className="rounded border border-border bg-bg px-2 py-1 text-xs text-white outline-none focus:border-primary"
              >
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
              </select>
              <button
                onClick={() => setStatus(u.id, u.status === 'active' ? 'suspended' : 'active')}
                className={`text-xs font-medium ${
                  u.status === 'active' ? 'text-emerald-400 hover:text-red-400' : 'text-red-400 hover:text-emerald-400'
                }`}
              >
                {u.status === 'active' ? 'Active' : 'Suspended'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

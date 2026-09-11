import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { Save } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import { useCurrentUser } from '../lib/useCurrentUser.ts'

export default function Settings() {
  const { getToken } = useAuth()
  const { invalidate } = useCurrentUser()
  const [form, setForm] = useState({
    name: '',
    institution: '',
    course: '',
    semester: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const { user } = await makeApi(token).settings.get()
      setForm({
        name: user.name ?? '',
        institution: user.institution ?? '',
        course: user.course ?? '',
        semester: user.semester ?? '',
      })
      setLoaded(true)
    }
    load()
  }, [getToken])

  async function save() {
    setSaving(true)
    try {
      const token = await getToken()
      if (!token) return
      await makeApi(token).settings.update({
        name: form.name || undefined,
        institution: form.institution || undefined,
        course: form.course || undefined,
        semester: form.semester || undefined,
      })
      invalidate()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-muted">Update your profile information.</p>
      </div>

      <div className="max-w-lg space-y-5">
        <div>
          <label className="mb-2 block text-sm font-medium text-muted">Display Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Your name"
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-white placeholder-muted outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-muted">Institution</label>
          <input
            type="text"
            value={form.institution}
            onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value }))}
            placeholder="Your college or university"
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-white placeholder-muted outline-none focus:border-primary"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-muted">Course</label>
            <input
              type="text"
              value={form.course}
              onChange={(e) => setForm((f) => ({ ...f, course: e.target.value }))}
              placeholder="e.g. Computer Science"
              className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-white placeholder-muted outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-muted">Semester</label>
            <input
              type="text"
              value={form.semester}
              onChange={(e) => setForm((f) => ({ ...f, semester: e.target.value }))}
              placeholder="e.g. Semester 4"
              className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-white placeholder-muted outline-none focus:border-primary"
            />
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          <Save size={16} />
          {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

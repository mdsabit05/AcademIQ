import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { Save, Eye, EyeOff } from 'lucide-react'
import { makeApi } from '../lib/api.ts'

export default function Settings() {
  const { getToken } = useAuth()
  const [form, setForm] = useState({
    openrouterKey: '',
    ollamaUrl: 'http://localhost:11434',
    defaultModel: 'google/gemini-flash-1.5',
  })
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const res = await makeApi(token).settings.get()
      setForm((f) => ({
        ...f,
        ollamaUrl: res.settings.ollamaUrl ?? f.ollamaUrl,
        defaultModel: res.settings.defaultModel ?? f.defaultModel,
      }))
    }
    load()
  }, [getToken])

  async function save() {
    setSaving(true)
    try {
      const token = await getToken()
      if (!token) return
      const update: Record<string, string> = {
        ollamaUrl: form.ollamaUrl,
        defaultModel: form.defaultModel,
      }
      if (form.openrouterKey && !form.openrouterKey.includes('...')) {
        update.openrouterKey = form.openrouterKey
      }
      await makeApi(token).settings.update(update)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-muted">Configure your AI provider settings.</p>
      </div>

      <div className="max-w-lg space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-muted">OpenRouter API Key</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={form.openrouterKey}
              onChange={(e) => setForm((f) => ({ ...f, openrouterKey: e.target.value }))}
              placeholder="sk-or-..."
              className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 pr-10 text-sm text-white placeholder-muted outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
            >
              {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <p className="mt-1 text-xs text-subtle">Get a key at openrouter.ai — supports 100+ models.</p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-muted">Default Model</label>
          <input
            type="text"
            value={form.defaultModel}
            onChange={(e) => setForm((f) => ({ ...f, defaultModel: e.target.value }))}
            placeholder="google/gemini-flash-1.5"
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-white placeholder-muted outline-none focus:border-primary"
          />
          <p className="mt-1 text-xs text-subtle">
            Any OpenRouter model ID. e.g. anthropic/claude-3.5-sonnet, openai/gpt-4o
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-muted">Ollama URL</label>
          <input
            type="text"
            value={form.ollamaUrl}
            onChange={(e) => setForm((f) => ({ ...f, ollamaUrl: e.target.value }))}
            placeholder="http://localhost:11434"
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-white placeholder-muted outline-none focus:border-primary"
          />
          <p className="mt-1 text-xs text-subtle">
            URL of your Ollama instance running nomic-embed-text.
          </p>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          <Save size={16} />
          {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}

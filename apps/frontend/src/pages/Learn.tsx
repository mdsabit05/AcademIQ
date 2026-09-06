import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { Search, BookOpen, RotateCcw } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import type { Document } from 'shared'

export default function Learn() {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const { state } = useLocation()
  const [documents, setDocuments] = useState<Document[]>([])
  const [topic, setTopic] = useState('')
  const [selectedDoc, setSelectedDoc] = useState('')
  const lastSession = sessionStorage.getItem('lastLearnSession')
  const lastTopic = sessionStorage.getItem('lastLearnTopic')

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const res = await makeApi(token).documents.list()
      const ready = res.documents.filter((d) => d.status === 'ready')
      setDocuments(ready)
      if (state?.documentId) {
        setSelectedDoc(state.documentId)
      } else if (ready.length > 0) {
        setSelectedDoc(ready[0].id)
      }
    }
    load()
  }, [getToken, state?.documentId])

  function handleLearn() {
    if (!topic.trim() || !selectedDoc) return
    navigate(`/learn/${selectedDoc}?topic=${encodeURIComponent(topic.trim())}`)
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Learn a Topic</h1>
        <p className="mt-1 text-muted">What do you want to understand?</p>
      </div>

      {lastSession && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <RotateCcw size={15} className="shrink-0 text-primary" />
          <span className="text-sm text-white">
            Last session: <span className="font-medium text-primary">{lastTopic}</span>
          </span>
          <button
            onClick={() => navigate(lastSession)}
            className="ml-auto rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover"
          >
            Resume →
          </button>
        </div>
      )}

      <div className="max-w-2xl space-y-4">
        {/* Document selector */}
        <div>
          <label className="mb-2 block text-sm font-medium text-muted">Material</label>
          <select
            value={selectedDoc}
            onChange={(e) => setSelectedDoc(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-white outline-none focus:border-primary"
          >
            {documents.length === 0 && <option value="">No materials — upload a PDF first</option>}
            {documents.map((d) => (
              <option key={d.id} value={d.id}>{d.title}</option>
            ))}
          </select>
        </div>

        {/* Topic search */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder='Search a topic... e.g. "Normalization", "Pointers", "RAG"'
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLearn()}
            className="w-full rounded-xl border border-border bg-surface py-3.5 pl-10 pr-4 text-sm text-white placeholder-muted outline-none transition-colors focus:border-primary"
          />
        </div>

        <button
          onClick={handleLearn}
          disabled={!topic.trim() || !selectedDoc}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-white transition-all hover:bg-primary-hover disabled:opacity-40"
        >
          <BookOpen size={18} />
          Start Learning
        </button>
      </div>
    </div>
  )
}

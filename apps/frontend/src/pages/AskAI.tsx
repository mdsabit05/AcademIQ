import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { Send } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import { useSSE } from '../lib/sse.ts'
import StreamingText from '../components/StreamingText.tsx'
import type { Document, ChatMessage, MessageRole } from 'shared'

export default function AskAI() {
  const { getToken } = useAuth()
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDoc, setSelectedDoc] = useState('')
  const [history, setHistory] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const { text, streaming, stream, reset } = useSSE()
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const api = makeApi(token)
      const res = await api.documents.list()
      const ready = res.documents.filter((d) => d.status === 'ready')
      setDocuments(ready)
      if (ready.length > 0) setSelectedDoc(ready[0].id)
    }
    load()
  }, [getToken])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, text])

  async function send() {
    if (!input.trim() || streaming || !selectedDoc) return
    const message = input.trim()
    setInput('')
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      user_id: '',
      document_id: selectedDoc,
      role: 'user' as MessageRole,
      content: message,
      mode: 'ask',
      created_at: new Date().toISOString(),
    }
    setHistory((prev) => [...prev, userMsg])
    reset()

    const token = await getToken()
    if (!token) return
    const chatHistory = history.map((m) => ({ role: m.role, content: m.content }))
    await stream('/api/ask', { documentId: selectedDoc, message, history: chatHistory }, token)

    const assistantMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      user_id: '',
      document_id: selectedDoc,
      role: 'assistant',
      content: text,
      mode: 'ask',
      created_at: new Date().toISOString(),
    }
    setHistory((prev) => [...prev, assistantMsg])
    reset()
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-bold text-white">AI Tutor</h1>
          <p className="text-xs text-muted">Ask anything from your study material</p>
        </div>
        <select
          value={selectedDoc}
          onChange={(e) => { setSelectedDoc(e.target.value); setHistory([]) }}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
        >
          {documents.length === 0 && <option value="">No materials</option>}
          {documents.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
        </select>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {history.length === 0 && !streaming && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted">Select a material and ask your first question.</p>
          </div>
        )}
        {history.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm ${
              msg.role === 'user' ? 'bg-primary text-white' : 'border border-border bg-surface text-white'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {streaming && text && (
          <div className="flex justify-start">
            <div className="max-w-[70%] rounded-2xl border border-border bg-surface px-4 py-3">
              <StreamingText text={text} streaming={streaming} />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border p-4">
        <div className="flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Ask anything about your material..."
            className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-white placeholder-muted outline-none focus:border-primary"
          />
          <button
            onClick={send}
            disabled={!input.trim() || streaming}
            className="rounded-xl bg-primary px-4 py-3 text-white hover:bg-primary-hover disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

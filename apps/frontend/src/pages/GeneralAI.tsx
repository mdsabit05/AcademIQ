/**
 * GeneralAI — general-purpose AI assistant with persistent chat history.
 * Uses /api/chat/:sessionId/message (mode: 'general') — no book grounding,
 * but full conversation memory + MAG so the AI remembers context across turns.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import {
  Send, Sparkles, PanelLeftOpen, PanelLeftClose, Plus, Trash2, Mic,
} from 'lucide-react'
import { clsx } from 'clsx'
import { makeApi } from '../lib/api.ts'
import StreamingText from '../components/StreamingText.tsx'
import ChatHistorySidebar from '../components/ChatHistorySidebar.tsx'
import type { ChatSession } from 'shared'

interface LocalMessage { role: 'user' | 'assistant'; content: string }

export default function GeneralAI() {
  const { getToken } = useAuth()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamBuffer, setStreamBuffer] = useState('')
  const [historyVisible, setHistoryVisible] = useState(() => window.innerWidth >= 768)
  const endRef = useRef<HTMLDivElement>(null)

  const refreshHistory = useCallback(async () => {
    const token = await getToken()
    if (!token) return
    const { sessions: s } = await makeApi(token).sessions.list('general')
    setSessions(s)
  }, [getToken])

  useEffect(() => { refreshHistory() }, [refreshHistory])

  const loadSession = useCallback(async (session: ChatSession) => {
    const token = await getToken()
    if (!token) return
    const { messages: msgs } = await makeApi(token).sessions.get(session.id)
    setSessionId(session.id)
    setMessages(msgs.map((m) => ({ role: m.role, content: m.content })))
    setStreamBuffer('')
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'instant' }), 50)
  }, [getToken])

  const startNewChat = useCallback(() => {
    setSessionId(null)
    setMessages([])
    setStreamBuffer('')
    setInput('')
  }, [])

  const deleteSession = useCallback(async (id: string) => {
    const token = await getToken()
    if (!token) return
    await makeApi(token).sessions.delete(id)
    if (sessionId === id) startNewChat()
    setSessions((prev) => prev.filter((s) => s.id !== id))
  }, [getToken, sessionId, startNewChat])

  const handleSend = useCallback(async () => {
    const content = input.trim()
    if (!content || streaming) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content }])
    setStreaming(true)
    setStreamBuffer('')
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 0)

    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const api = makeApi(token)

      // Create session on first message
      let sid = sessionId
      if (!sid) {
        const { session } = await api.sessions.create({ mode: 'general', bookIds: [] })
        sid = session.id
        setSessionId(sid)
        setSessions((prev) => [session, ...prev])
      }

      const apiBase = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'
      const res = await fetch(`${apiBase}/chat/${sid}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content, webSearch: false, deepReason: false }),
      })
      if (!res.body) throw new Error('No response body')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''; let full = ''
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n'); buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).replace(/\r$/, ''); if (data.trim() === '[DONE]') continue
          try { const p = JSON.parse(data) as string; full += p; setStreamBuffer(full) }
          catch { full += data; setStreamBuffer(full) }
        }
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: full }])
      setStreamBuffer('')
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${(err as Error).message}` }])
    } finally {
      setStreaming(false)
      refreshHistory()
    }
  }, [input, streaming, sessionId, getToken, refreshHistory])

  const sidebar = (
    <ChatHistorySidebar
      sessions={sessions}
      activeSessionId={sessionId}
      onNewChat={startNewChat}
      onSelectSession={loadSession}
      onDeleteSession={deleteSession}
    />
  )

  return (
    <div className="flex h-full overflow-hidden">
      {/* Desktop history sidebar */}
      {historyVisible && <div className="hidden md:flex">{sidebar}</div>}

      {/* Mobile history drawer */}
      <div className={clsx('fixed inset-0 z-50 md:hidden', historyVisible ? 'pointer-events-auto' : 'pointer-events-none')}>
        <div
          className={clsx('absolute inset-0 bg-black/50 transition-opacity duration-300', historyVisible ? 'opacity-100' : 'opacity-0')}
          onClick={() => setHistoryVisible(false)}
        />
        <div className={clsx(
          'absolute inset-y-0 left-0 w-72 transition-transform duration-300 ease-in-out',
          historyVisible ? 'translate-x-0' : '-translate-x-full',
        )}>
          {sidebar}
        </div>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* Top bar */}
        <div className="shrink-0 flex items-center gap-3 px-4 lg:px-5 py-2.5 border-b border-border">
          <button
            onClick={() => setHistoryVisible((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
          >
            {historyVisible ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
            <span className="hidden sm:inline">{historyVisible ? 'Hide' : 'History'}</span>
          </button>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-primary shrink-0" />
            <span className="text-xs font-semibold text-white">General AI</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={startNewChat}
                className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
              >
                <Plus size={13} /> New chat
              </button>
            )}
            {sessionId && (
              <>
                <div className="w-px h-4 bg-border" />
                <button
                  onClick={() => deleteSession(sessionId)}
                  className="flex items-center gap-1 text-xs text-muted hover:text-red-400 transition-colors"
                >
                  <Trash2 size={11} /> Clear
                </button>
              </>
            )}
          </div>
        </div>

        {/* Info notice */}
        <div className="shrink-0 px-4 lg:px-5 py-2 border-b border-border bg-surface/40">
          <p className="text-xs text-muted">
            <span className="font-medium text-white">General AI</span>
            {' — '}answers are{' '}
            <span className="text-yellow-400 font-medium">not grounded</span> in your books.
            For book-based answers, use{' '}
            <a href="/tutor" className="text-primary hover:underline">AI Tutor</a>.
            {' '}Conversation is saved so I remember our context.
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-5 min-h-0">
          <div className={clsx('mx-auto space-y-5 transition-all duration-300', historyVisible ? 'max-w-2xl' : 'max-w-4xl')}>

            {messages.length === 0 && !streamBuffer && (
              <div className="flex h-64 items-center justify-center">
                <div className="text-center max-w-sm">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-border">
                    <Sparkles size={24} className="text-primary/50" />
                  </div>
                  <p className="text-base font-black text-white">General AI Assistant</p>
                  <p className="mt-2 text-sm text-muted leading-relaxed">
                    Ask me anything — maths, science, coding, writing, or general knowledge.
                    I remember our conversation so we can build on previous topics.
                  </p>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={clsx('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mr-2.5 mt-0.5"
                    style={{ background: 'rgba(34,211,238,0.15)', border: '1px solid rgba(34,211,238,0.3)' }}>
                    <Sparkles size={13} style={{ color: '#22D3EE' }} />
                  </div>
                )}
                <div className={clsx(
                  'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                  msg.role === 'user' ? 'font-medium' : 'border border-border bg-surface text-white',
                )} style={msg.role === 'user' ? { background: '#22D3EE', color: '#0a0f1a' } : {}}>
                  {msg.role === 'assistant' ? <StreamingText text={msg.content} /> : msg.content}
                </div>
              </div>
            ))}

            {streaming && !streamBuffer && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mr-2.5 mt-0.5"
                  style={{ background: 'rgba(34,211,238,0.15)', border: '1px solid rgba(34,211,238,0.3)' }}>
                  <Sparkles size={13} style={{ color: '#22D3EE' }} />
                </div>
                <div className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-muted flex items-center gap-2">
                  <span className="animate-pulse">Thinking…</span>
                </div>
              </div>
            )}

            {streamBuffer && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mr-2.5 mt-0.5"
                  style={{ background: 'rgba(34,211,238,0.15)', border: '1px solid rgba(34,211,238,0.3)' }}>
                  <Sparkles size={13} style={{ color: '#22D3EE' }} />
                </div>
                <div className="max-w-[80%] rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-white leading-relaxed">
                  <StreamingText text={streamBuffer} />
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-border px-4 lg:px-5 py-3">
          <div className={clsx('mx-auto transition-all duration-300', historyVisible ? 'max-w-2xl' : 'max-w-4xl')}>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 focus-within:border-primary/50 transition-colors">
              <Mic size={16} className="text-muted shrink-0" />
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Ask anything…"
                disabled={streaming}
                className="flex-1 bg-transparent text-sm text-white placeholder:text-muted/50 focus:outline-none disabled:cursor-not-allowed"
              />
              <button
                onClick={handleSend}
                disabled={streaming || !input.trim()}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 shrink-0"
                style={{ background: '#22D3EE' }}
              >
                <Send size={13} style={{ color: '#0a0f1a' }} />
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted/50 text-center">
              History is saved — I remember what we've discussed in this conversation.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

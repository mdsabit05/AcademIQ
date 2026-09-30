/**
 * LearnSession — Socratic tutoring chat for a specific session.
 * The sessionId in the URL is a chat_sessions.id created by Books/AskAI pages.
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.ts'
import { ArrowLeft, Send } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import StreamingText from '../components/StreamingText.tsx'
import type { ChatMessage } from 'shared'

export default function LearnSession() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { getToken } = useAuth()
  const navigate = useNavigate()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [topic, setTopic] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamBuffer, setStreamBuffer] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      if (!sessionId) return
      const token = await getToken()
      if (!token) return
      const { session, messages: msgs } = await makeApi(token).sessions.get(sessionId)
      setMessages(msgs)
      setTopic(session.topic)
    }
    load().catch(console.error)
  }, [sessionId, getToken])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamBuffer])

  const handleSend = useCallback(async () => {
    const content = input.trim()
    if (!content || streaming || !sessionId) return
    setInput('')
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), session_id: sessionId, role: 'user', content, metadata: {}, created_at: new Date().toISOString() },
    ])
    setStreaming(true)
    setStreamBuffer('')

    try {
      const token = await getToken()
      if (!token) return

      const res = await fetch(`${window.location.pathname.replace(/\/$/, '')}/api/chat/${sessionId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      })

      if (!res.body) throw new Error('No response body')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try { fullText += JSON.parse(data) as string }
          catch { fullText += data }
          setStreamBuffer(fullText)
        }
      }

      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), session_id: sessionId, role: 'assistant', content: fullText, metadata: {}, created_at: new Date().toISOString() },
      ])
      setStreamBuffer('')
    } catch (err) {
      console.error('[learn] send failed:', err)
    } finally {
      setStreaming(false)
    }
  }, [input, streaming, sessionId, getToken])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <button onClick={() => navigate('/books')} className="text-muted hover:text-white">
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="font-medium text-white">Learn Session</p>
          {topic && <p className="text-xs text-muted">{topic}</p>}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && !streamBuffer && (
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-muted">
              Ask your tutor anything about the topic — it will guide you Socratically.
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-white'
                  : 'border border-border bg-surface'
              }`}
            >
              {msg.role === 'assistant'
                ? <StreamingText text={msg.content} />
                : msg.content}
            </div>
          </div>
        ))}
        {streamBuffer && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-white">
              <StreamingText text={streamBuffer} />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask your tutor…"
            disabled={streaming}
            className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-white placeholder-muted outline-none focus:border-primary disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={streaming || !input.trim()}
            className="rounded-xl bg-primary px-4 py-3 text-white hover:bg-primary-hover disabled:opacity-40"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

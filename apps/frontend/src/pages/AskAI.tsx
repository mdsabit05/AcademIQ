/**
 * AskAI — session-based Q&A with book context.
 * Creates a session with selected books, then streams responses via SSE.
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useSearchParams } from 'react-router-dom'
import { Send, BookOpen, Plus } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import StreamingText from '../components/StreamingText.tsx'
import type { Book } from 'shared'

interface LocalMessage {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

export default function AskAI() {
  const { getToken } = useAuth()
  const [searchParams] = useSearchParams()
  const preselectedBookId = searchParams.get('bookId')

  const [books, setBooks] = useState<Book[]>([])
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamBuffer, setStreamBuffer] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const { books: all } = await makeApi(token).books.list()
      const ready = all.filter((b) => b.status === 'READY')
      setBooks(ready)
      if (preselectedBookId && ready.some((b) => b.id === preselectedBookId)) {
        setSelectedBookIds([preselectedBookId])
      }
    }
    load().catch(console.error)
  }, [getToken, preselectedBookId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamBuffer])

  function toggleBook(id: string) {
    setSelectedBookIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
    // Reset session when book selection changes
    setSessionId(null)
    setMessages([])
  }

  async function ensureSession(): Promise<string> {
    if (sessionId) return sessionId
    const token = await getToken()
    if (!token) throw new Error('Not authenticated')
    const { session } = await makeApi(token).sessions.create({
      mode: 'ask',
      bookIds: selectedBookIds,
    })
    setSessionId(session.id)
    return session.id
  }

  const handleSend = useCallback(async () => {
    const content = input.trim()
    if (!content || streaming) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content }])
    setStreaming(true)
    setStreamBuffer('')

    try {
      const sid = await ensureSession()
      const token = await getToken()
      if (!token) return

      const res = await fetch(`/api/chat/${sid}/message`, {
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
      let buffer = ''
      let fullResponse = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data) as string
            fullResponse += parsed
            setStreamBuffer(fullResponse)
          } catch {
            // token was the raw string, not JSON
            fullResponse += data
            setStreamBuffer(fullResponse)
          }
        }
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: fullResponse }])
      setStreamBuffer('')
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${(err as Error).message}` },
      ])
    } finally {
      setStreaming(false)
    }
  }, [input, streaming, sessionId, selectedBookIds, getToken])

  return (
    <div className="flex h-full flex-col">
      {/* Book selector */}
      <div className="border-b border-border bg-surface px-6 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Books in scope:</span>
          {books.length === 0 ? (
            <span className="text-xs text-muted/60">No ready books — upload one first</span>
          ) : (
            books.map((b) => (
              <button
                key={b.id}
                onClick={() => toggleBook(b.id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selectedBookIds.includes(b.id)
                    ? 'bg-primary text-white'
                    : 'bg-surface border border-border text-muted hover:border-primary/40 hover:text-white'
                }`}
              >
                <BookOpen size={11} />
                {b.title}
              </button>
            ))
          )}
          {selectedBookIds.length > 0 && (
            <button
              onClick={() => { setSelectedBookIds([]); setSessionId(null); setMessages([]) }}
              className="text-xs text-muted hover:text-white"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && !streamBuffer && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Plus size={32} className="mx-auto mb-3 text-muted/40" />
              <p className="text-muted">Select books above and ask a question.</p>
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-white'
                  : 'border border-border bg-surface text-white'
              }`}
            >
              {msg.content}
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
            placeholder={
              selectedBookIds.length === 0
                ? 'Select at least one book to start chatting…'
                : 'Ask a question about your books…'
            }
            disabled={streaming || selectedBookIds.length === 0}
            className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-white placeholder-muted outline-none focus:border-primary disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={streaming || !input.trim() || selectedBookIds.length === 0}
            className="rounded-xl bg-primary px-4 py-3 text-white hover:bg-primary-hover disabled:opacity-40"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

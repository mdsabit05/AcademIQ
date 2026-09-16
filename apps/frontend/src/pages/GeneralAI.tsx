/**
 * GeneralAI — general-purpose AI assistant (not grounded in books).
 * Uses /api/agent/message SSE endpoint.
 * CLEARLY distinct from AI Tutor which uses RAG over uploaded books.
 */

import { useState, useRef, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { Send, Sparkles, Loader2 } from 'lucide-react'
import { marked } from 'marked'
import { makeApi } from '../lib/api.ts'
import StreamingText from '../components/StreamingText.tsx'

interface LocalMessage {
  role: 'user' | 'assistant'
  content: string
}

export default function GeneralAI() {
  const { getToken } = useAuth()
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [streamBuffer, setStreamBuffer] = useState('')
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSend = useCallback(async () => {
    const content = input.trim()
    if (!content || streaming) return

    setInput('')
    setError(null)
    setMessages((prev) => [...prev, { role: 'user', content }])
    setStreaming(true)
    setThinking(true)
    setStreamBuffer('')
    setTimeout(scrollToBottom, 50)

    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const res = await makeApi(token).agent.message(content)

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error((data as { error: string }).error ?? res.statusText)
      }

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
          // Skip event: lines (agent-done, done, error events)
          if (line.startsWith('event:')) continue
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).replace(/\r$/, '')
          if (data.trim() === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            // Only append if it's a plain string token — skip metadata objects
            if (typeof parsed === 'string') fullResponse += parsed
          } catch {
            // Not JSON — it's a raw word token from the agent
            fullResponse += data
          }
          if (fullResponse) setThinking(false)
          setStreamBuffer(fullResponse)
          scrollToBottom()
        }
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: fullResponse }])
      setStreamBuffer('')
    } catch (err) {
      setError((err as Error).message)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${(err as Error).message}` },
      ])
    } finally {
      setStreaming(false)
      setThinking(false)
      setTimeout(scrollToBottom, 50)
    }
  }, [input, streaming, getToken])

  return (
    <div className="flex h-full flex-col">
      {/* Header notice */}
      <div className="border-b border-border bg-surface px-4 md:px-6 py-3">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-primary shrink-0" />
          <p className="text-xs text-muted">
            <span className="font-medium text-white">General AI Assistant</span>
            {' — '}
            Answers are <span className="text-yellow-400 font-medium">not grounded</span> in your
            uploaded books. For book-based answers, use{' '}
            <a href="/tutor" className="text-primary hover:underline">
              AI Tutor
            </a>
            .
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">
        {messages.length === 0 && !streamBuffer && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center max-w-sm">
              <Sparkles size={32} className="mx-auto mb-3 text-primary/40" />
              <p className="text-white font-medium">General AI Assistant</p>
              <p className="mt-2 text-sm text-muted">
                Ask me anything — maths, science, coding, writing, or general knowledge. This
                assistant is not limited to your uploaded books.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 mt-0.5">
                <Sparkles size={11} className="text-primary" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-bg font-medium'
                  : 'border border-border bg-surface text-white'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div className="ai-md" dangerouslySetInnerHTML={{ __html: marked.parse(msg.content, { gfm: true }) as string }} />
              ) : msg.content}
            </div>
          </div>
        ))}

        {/* Thinking loader — shown while agent processes before first token */}
        {thinking && (
          <div className="flex gap-2.5 justify-start">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 mt-0.5">
              <Sparkles size={11} className="text-primary" />
            </div>
            <div className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-muted flex items-center gap-2">
              <Loader2 size={13} className="animate-spin text-primary" />
              On it…
            </div>
          </div>
        )}

        {streamBuffer && !thinking && (
          <div className="flex gap-2.5 justify-start">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 mt-0.5">
              <Sparkles size={11} className="text-primary" />
            </div>
            <div className="max-w-[80%] rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-white">
              <StreamingText text={streamBuffer} />
            </div>
          </div>
        )}

        {error && !streamBuffer && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-4 pb-4 md:pb-4 md:mb-0">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask anything…"
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

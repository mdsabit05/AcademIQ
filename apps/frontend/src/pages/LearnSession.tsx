import { useEffect, useState, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { ArrowLeft, FileText, Send } from 'lucide-react'
import { useSSE } from '../lib/sse.ts'
import StreamingText from '../components/StreamingText.tsx'
import type { ChatMessage, MessageRole } from 'shared'

export default function LearnSession() {
  const { sessionId: documentId } = useParams<{ sessionId: string }>()
  const [searchParams] = useSearchParams()
  const topic = searchParams.get('topic') ?? ''
  const { getToken } = useAuth()
  const navigate = useNavigate()

  const { text: explanation, streaming: loadingExplanation, stream: streamExplanation } = useSSE()
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const { text: chatResponse, streaming: streamingChat, stream: streamChat, reset } = useSSE()
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Load initial explanation
  useEffect(() => {
    if (!documentId || !topic) return
    async function load() {
      const token = await getToken()
      if (!token) return
      streamExplanation('/api/learn', { documentId, topic }, token)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, topic])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, chatResponse])

  async function sendChat() {
    if (!chatInput.trim() || streamingChat || !documentId) return
    const message = chatInput.trim()
    setChatInput('')
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      user_id: '',
      document_id: documentId,
      role: 'user' as MessageRole,
      content: message,
      mode: 'learn',
      created_at: new Date().toISOString(),
    }
    setChatHistory((prev) => [...prev, userMsg])
    reset()

    const token = await getToken()
    if (!token) return

    const history = chatHistory.map((m) => ({ role: m.role, content: m.content }))
    const finalText = await streamChat('/api/ask', { documentId, message, history }, token)

    setChatHistory((prev) => [
      ...prev,
      {
        id: (Date.now() + 1).toString(),
        user_id: '',
        document_id: documentId,
        role: 'assistant' as MessageRole,
        content: finalText ?? '',
        mode: 'learn',
        created_at: new Date().toISOString(),
      },
    ])
    reset()
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-border px-6 py-4">
        <button onClick={() => navigate('/learn')} className="text-muted hover:text-white">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="font-bold text-white">{topic}</h1>
          <p className="text-xs text-muted">Learning session</p>
        </div>
        <button
          onClick={() => navigate('/test/new')}
          className="ml-auto flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:border-primary/40 hover:text-white"
        >
          <FileText size={14} /> Take a Test
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main explanation */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-2xl">
            <div className="rounded-xl border border-border bg-surface p-6">
              <h2 className="mb-4 font-semibold text-primary">AI Explanation</h2>
              {explanation ? (
                <StreamingText text={explanation} streaming={loadingExplanation} />
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Generating explanation...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Tutor chat panel */}
        <div className="flex w-80 flex-col border-l border-border">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-white">AI Tutor</p>
            <p className="text-xs text-muted">Ask anything about {topic}</p>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {chatHistory.map((msg) => (
              <div key={msg.id} className={msg.role === 'user' ? 'text-right' : ''}>
                <div
                  className={`inline-block max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-white'
                      : 'border border-border bg-surface text-white'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {streamingChat && (
              <div className="inline-block max-w-[85%] rounded-xl border border-border bg-surface px-3 py-2">
                {chatResponse ? (
                  <StreamingText text={chatResponse} streaming={streamingChat} className="text-sm" />
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
                    <span className="ml-1">Thinking...</span>
                  </div>
                )}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="border-t border-border p-3">
            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                placeholder="Ask anything..."
                className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white placeholder-muted outline-none focus:border-primary"
              />
              <button
                onClick={sendChat}
                disabled={!chatInput.trim() || streamingChat}
                className="rounded-lg bg-primary p-2 text-white hover:bg-primary-hover disabled:opacity-40"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

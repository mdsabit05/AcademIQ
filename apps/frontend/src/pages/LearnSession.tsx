import { useEffect, useState, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { ArrowLeft, FileText, Send } from 'lucide-react'
import { useSSE } from '../lib/sse.ts'
import StreamingText from '../components/StreamingText.tsx'
import { makeApi } from '../lib/api.ts'
import type { ChatMessage, MessageRole } from 'shared'

function applyHighlights(container: HTMLElement, highlights: string[]) {
  // Remove previous highlight marks
  container.querySelectorAll('mark[data-save-highlight]').forEach((m) => {
    const parent = m.parentNode
    if (parent) {
      parent.replaceChild(document.createTextNode(m.textContent ?? ''), m)
      parent.normalize()
    }
  })
  if (!highlights.length) return

  const escaped = highlights.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(${escaped.join('|')})`, 'g')
  const highlightSet = new Set(highlights)

  // Collect all text nodes first, then process (avoids walker invalidation)
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  let node: Node | null
  while ((node = walker.nextNode())) textNodes.push(node as Text)

  for (const textNode of textNodes) {
    const text = textNode.textContent ?? ''
    pattern.lastIndex = 0
    if (!pattern.test(text)) continue
    pattern.lastIndex = 0

    const parts = text.split(pattern)
    if (parts.length <= 1) continue

    const fragment = document.createDocumentFragment()
    for (const part of parts) {
      if (highlightSet.has(part)) {
        const mark = document.createElement('mark')
        mark.setAttribute('data-save-highlight', '')
        mark.className = 'rounded bg-amber-400/25 px-0.5 text-amber-100'
        mark.textContent = part
        fragment.appendChild(mark)
      } else if (part) {
        fragment.appendChild(document.createTextNode(part))
      }
    }
    textNode.parentNode!.replaceChild(fragment, textNode)
  }
}

export default function LearnSession() {
  const { sessionId: documentId } = useParams<{ sessionId: string }>()
  const [searchParams] = useSearchParams()
  const topic = searchParams.get('topic') ?? ''
  const { getToken } = useAuth()
  const navigate = useNavigate()

  const { text: explanation, streaming: loadingExplanation, stream: streamExplanation } = useSSE()
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])

  const cacheKey = documentId && topic ? `learn:${documentId}:${topic}` : null
  const [cachedExplanation, setCachedExplanation] = useState(() =>
    cacheKey ? (sessionStorage.getItem(cacheKey) ?? '') : '',
  )
  const displayExplanation = cachedExplanation || explanation

  // accRef tracks whatever has been streamed so far; saved to sessionStorage on unmount
  // This handles the case where the user navigates away before the stream finishes
  const accRef = useRef(cachedExplanation)
  useEffect(() => {
    if (explanation) accRef.current = explanation
  }, [explanation])
  useEffect(() => {
    return () => {
      if (accRef.current && cacheKey) sessionStorage.setItem(cacheKey, accRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey])

  const highlightKey = documentId && topic ? `highlights:${documentId}:${topic}` : null
  const [highlights, setHighlights] = useState<string[]>(() =>
    highlightKey ? JSON.parse(sessionStorage.getItem(highlightKey) ?? '[]') : [],
  )

  // Load saved notes for this topic from the API (persists across browser sessions)
  useEffect(() => {
    if (!documentId || !topic) return
    async function loadHighlights() {
      const token = await getToken()
      if (!token) return
      const res = await makeApi(token).notes.list()
      const saved = res.notes
        .filter((n) => n.document_id === documentId && n.topic === topic)
        .map((n) => n.content)
      if (saved.length > 0) {
        setHighlights(saved)
        if (highlightKey) sessionStorage.setItem(highlightKey, JSON.stringify(saved))
      }
    }
    loadHighlights()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, topic])

  // Apply highlight marks to the rendered explanation DOM
  useEffect(() => {
    if (!explanationRef.current || loadingExplanation || !displayExplanation || !highlights.length) return
    applyHighlights(explanationRef.current, highlights)
  }, [displayExplanation, loadingExplanation, highlights])

  const explanationRef = useRef<HTMLDivElement>(null)
  const [selectionText, setSelectionText] = useState('')
  const [savePos, setSavePos] = useState<{ top: number; left: number } | null>(null)
  const [savedToast, setSavedToast] = useState(false)

  // Document-level mouseup: captures selections that start/end anywhere,
  // uses viewport-relative fixed positioning (no scroll offset math needed)
  useEffect(() => {
    function onMouseUp(e: MouseEvent) {
      if ((e.target as HTMLElement).closest('[data-save-note]')) return
      setTimeout(() => {
        const sel = window.getSelection()
        const text = sel?.toString().trim() ?? ''
        if (!text || !sel?.rangeCount || !explanationRef.current) {
          setSavePos(null)
          setSelectionText('')
          return
        }
        const range = sel.getRangeAt(0)
        if (!explanationRef.current.contains(range.commonAncestorContainer)) {
          setSavePos(null)
          setSelectionText('')
          return
        }
        const rect = range.getBoundingClientRect()
        setSelectionText(text)
        setSavePos({ top: rect.bottom + 6, left: rect.left })
      }, 10)
    }
    document.addEventListener('mouseup', onMouseUp)
    return () => document.removeEventListener('mouseup', onMouseUp)
  }, [])

  async function handleSaveNote() {
    if (!selectionText || !documentId) return
    const token = await getToken()
    if (!token) return
    await makeApi(token).notes.create({ documentId, topic, content: selectionText })
    const newHighlights = [...highlights, selectionText]
    setHighlights(newHighlights)
    if (highlightKey) sessionStorage.setItem(highlightKey, JSON.stringify(newHighlights))
    setSavePos(null)
    setSelectionText('')
    window.getSelection()?.removeAllRanges()
    setSavedToast(true)
    setTimeout(() => setSavedToast(false), 2000)
  }

  const [chatInput, setChatInput] = useState('')
  const { text: chatResponse, streaming: streamingChat, stream: streamChat, reset } = useSSE()
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Load initial explanation — skip if cached
  useEffect(() => {
    if (!documentId || !topic || cachedExplanation) return
    async function load() {
      const token = await getToken()
      if (!token) return
      const full = await streamExplanation('/api/learn', { documentId, topic }, token)
      if (full) setCachedExplanation(full)
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
            <div
              ref={explanationRef}
              className="rounded-xl border border-border bg-surface p-6"
            >
              <h2 className="mb-4 font-semibold text-primary">AI Explanation</h2>
              {displayExplanation ? (
                <StreamingText text={displayExplanation} streaming={loadingExplanation} />
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

      {savePos && (
        <button
          data-save-note
          onClick={handleSaveNote}
          style={{ position: 'fixed', top: savePos.top, left: savePos.left }}
          className="z-50 flex items-center gap-1 rounded-lg bg-primary px-2 py-1 text-xs font-medium text-white shadow-lg hover:bg-primary-hover"
        >
          💾 Save
        </button>
      )}
      {savedToast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-success px-4 py-2 text-sm font-medium text-white shadow-lg">
          Saved ✓
        </div>
      )}
    </div>
  )
}

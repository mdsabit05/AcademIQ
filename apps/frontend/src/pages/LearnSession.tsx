import { useEffect, useState, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { ArrowLeft, FileText, Send } from 'lucide-react'
import { useSSE } from '../lib/sse.ts'
import StreamingText from '../components/StreamingText.tsx'
import { makeApi } from '../lib/api.ts'
import type { ChatMessage, MessageRole } from 'shared'

const COLORS = [
  { id: 'yellow', dot: 'bg-yellow-400', mark: 'rounded bg-yellow-400/35 text-yellow-100 px-0.5' },
  { id: 'green',  dot: 'bg-emerald-400', mark: 'rounded bg-emerald-400/35 text-emerald-100 px-0.5' },
  { id: 'blue',   dot: 'bg-blue-400', mark: 'rounded bg-blue-400/35 text-blue-100 px-0.5' },
  { id: 'pink',   dot: 'bg-pink-400', mark: 'rounded bg-pink-400/35 text-pink-100 px-0.5' },
]

// Text-search highlight: used for saved highlights (from API) re-applied after remount.
// Only manages marks with the given data-attribute, leaving the other type intact.
function applyHighlightsByText(
  container: HTMLElement,
  highlights: { text: string; color: string }[],
  attr: 'data-save-highlight' | 'data-pending-highlight',
) {
  container.querySelectorAll(`mark[${attr}]`).forEach((m) => {
    const parent = m.parentNode
    if (parent) {
      parent.replaceChild(document.createTextNode(m.textContent ?? ''), m)
      parent.normalize()
    }
  })
  if (!highlights.length) return

  const colorMap = new Map(highlights.map((h) => [h.text, h.color]))
  const escaped = highlights.map((h) => h.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(${escaped.join('|')})`, 'g')

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  let node: Node | null
  while ((node = walker.nextNode())) {
    // Skip text nodes that are already inside a mark (the other type)
    let p = node.parentElement
    let insideMark = false
    while (p && p !== container) {
      if (p.tagName === 'MARK') { insideMark = true; break }
      p = p.parentElement
    }
    if (!insideMark) textNodes.push(node as Text)
  }

  for (const textNode of textNodes) {
    const text = textNode.textContent ?? ''
    pattern.lastIndex = 0
    if (!pattern.test(text)) continue
    pattern.lastIndex = 0

    const parts = text.split(pattern)
    if (parts.length <= 1) continue

    const fragment = document.createDocumentFragment()
    for (const part of parts) {
      if (colorMap.has(part)) {
        const colorId = colorMap.get(part)!
        const cls = COLORS.find((c) => c.id === colorId)?.mark ?? COLORS[0].mark
        const mark = document.createElement('mark')
        mark.setAttribute(attr, '')
        mark.className = cls
        mark.textContent = part
        fragment.appendChild(mark)
      } else if (part) {
        fragment.appendChild(document.createTextNode(part))
      }
    }
    textNode.parentNode!.replaceChild(fragment, textNode)
  }
}

// Range-based highlight: used for new selections. Works across code spans and
// any DOM structure because it operates on the live Range object.
function applyRangeHighlight(range: Range, colorId: string) {
  const cls = COLORS.find((c) => c.id === colorId)?.mark ?? COLORS[0].mark
  const mark = document.createElement('mark')
  mark.setAttribute('data-pending-highlight', '')
  mark.className = cls
  try {
    range.surroundContents(mark)
  } catch {
    // Selection spans element boundaries — extract and re-insert wrapped
    const fragment = range.extractContents()
    mark.appendChild(fragment)
    range.insertNode(mark)
  }
}

export default function LearnSession() {
  const { sessionId: documentId } = useParams<{ sessionId: string }>()
  const [searchParams] = useSearchParams()
  const topic = searchParams.get('topic') ?? ''
  const { getToken } = useAuth()
  const navigate = useNavigate()

  const { text: explanation, streaming: loadingExplanation, stream: streamExplanation } = useSSE()

  // Explanation cache (persists across page changes)
  const cacheKey = documentId && topic ? `learn:${documentId}:${topic}` : null
  const [cachedExplanation, setCachedExplanation] = useState(() =>
    cacheKey ? (sessionStorage.getItem(cacheKey) ?? '') : '',
  )
  const displayExplanation = cachedExplanation || explanation
  const accRef = useRef(cachedExplanation)
  useEffect(() => { if (explanation) accRef.current = explanation }, [explanation])
  useEffect(() => {
    return () => { if (accRef.current && cacheKey) sessionStorage.setItem(cacheKey, accRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey])

  // Remember last session so Learn.tsx can offer "Resume"
  useEffect(() => {
    if (documentId && topic) {
      sessionStorage.setItem('lastLearnSession', `/learn/${documentId}?topic=${encodeURIComponent(topic)}`)
      sessionStorage.setItem('lastLearnTopic', topic)
    }
  }, [documentId, topic])

  // Highlights — color picker
  const [activeColor, setActiveColor] = useState('yellow')
  const activeColorRef = useRef(activeColor)
  activeColorRef.current = activeColor

  // Pending highlights (unsaved, persisted in sessionStorage)
  const pendingKey = documentId && topic ? `pending:${documentId}:${topic}` : null
  const [pendingHighlights, setPendingHighlights] = useState<{ text: string; color: string }[]>(() =>
    pendingKey ? JSON.parse(sessionStorage.getItem(pendingKey) ?? '[]') : [],
  )
  const pendingHighlightsRef = useRef(pendingHighlights)
  useEffect(() => { pendingHighlightsRef.current = pendingHighlights }, [pendingHighlights])

  // Saved highlights (from API)
  const [savedHighlights, setSavedHighlights] = useState<{ text: string; color: string }[]>([])
  const [savedToast, setSavedToast] = useState(false)

  // Persist pending highlights to sessionStorage
  useEffect(() => {
    if (pendingKey) sessionStorage.setItem(pendingKey, JSON.stringify(pendingHighlights))
  }, [pendingHighlights, pendingKey])

  // Load already-saved notes for this topic from API
  useEffect(() => {
    if (!documentId || !topic) return
    async function loadSaved() {
      const token = await getToken()
      if (!token) return
      const res = await makeApi(token).notes.list()
      const saved = res.notes
        .filter((n) => n.document_id === documentId && n.topic === topic)
        .map((n) => ({ text: n.content, color: 'yellow' as const }))
      setSavedHighlights(saved)
    }
    loadSaved()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, topic])

  const explanationRef = useRef<HTMLDivElement>(null)

  // Re-apply SAVED highlights via text search after explanation renders or saved list changes
  useEffect(() => {
    if (!explanationRef.current || loadingExplanation || !displayExplanation) return
    applyHighlightsByText(explanationRef.current, savedHighlights, 'data-save-highlight')
  }, [displayExplanation, loadingExplanation, savedHighlights])

  // On first render (including remount from sessionStorage), apply pending highlights
  // via text search (best-effort; works for normal text, may miss code-spanning selections)
  const pendingInitApplied = useRef(false)
  useEffect(() => {
    if (!explanationRef.current || loadingExplanation || !displayExplanation) return
    if (pendingInitApplied.current) return
    pendingInitApplied.current = true
    if (pendingHighlightsRef.current.length) {
      applyHighlightsByText(explanationRef.current, pendingHighlightsRef.current, 'data-pending-highlight')
    }
  }, [displayExplanation, loadingExplanation])

  // Document-level mouseup: highlight selected text immediately via Range API.
  // This handles code spans and any cross-element selections.
  useEffect(() => {
    function onMouseUp(e: MouseEvent) {
      if ((e.target as HTMLElement).closest('[data-highlight-toolbar]')) return
      setTimeout(() => {
        const sel = window.getSelection()
        const text = sel?.toString().trim() ?? ''
        if (!text || !sel?.rangeCount || !explanationRef.current) return
        const range = sel.getRangeAt(0)
        if (!explanationRef.current.contains(range.commonAncestorContainer)) return
        if (pendingHighlightsRef.current.some((h) => h.text === text)) {
          sel.removeAllRanges()
          return
        }
        // Apply immediately via Range (works for code blocks, mixed elements)
        applyRangeHighlight(range, activeColorRef.current)
        sel.removeAllRanges()
        setPendingHighlights((prev) => [...prev, { text, color: activeColorRef.current }])
      }, 10)
    }
    document.addEventListener('mouseup', onMouseUp)
    return () => document.removeEventListener('mouseup', onMouseUp)
  }, [])

  async function saveAllNotes() {
    if (!pendingHighlights.length || !documentId) return
    const token = await getToken()
    if (!token) return
    for (const h of pendingHighlights) {
      await makeApi(token).notes.create({ documentId, topic, content: h.text })
    }
    setSavedHighlights((prev) => [...prev, ...pendingHighlights])
    setPendingHighlights([])
    if (pendingKey) sessionStorage.removeItem(pendingKey)
    setSavedToast(true)
    setTimeout(() => setSavedToast(false), 2000)
  }

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const { text: chatResponse, streaming: streamingChat, stream: streamChat, reset } = useSSE()
  const chatEndRef = useRef<HTMLDivElement>(null)

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
          <div className="mx-auto max-w-2xl space-y-3">

            {/* Highlighter toolbar */}
            <div
              data-highlight-toolbar
              className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2.5"
            >
              <span className="text-xs font-medium text-muted">Highlight colour:</span>
              <div className="flex items-center gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveColor(c.id)}
                    title={c.id}
                    className={`h-5 w-5 rounded-full ${c.dot} transition-transform ${
                      activeColor === c.id
                        ? 'scale-125 ring-2 ring-white ring-offset-1 ring-offset-surface'
                        : 'hover:scale-110 opacity-70'
                    }`}
                  />
                ))}
              </div>
              <div className="ml-auto flex items-center gap-3">
                {pendingHighlights.length > 0 && (
                  <span className="text-xs text-muted">{pendingHighlights.length} unsaved</span>
                )}
                <button
                  onClick={saveAllNotes}
                  disabled={pendingHighlights.length === 0}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-40"
                >
                  Save Notes
                </button>
              </div>
            </div>

            {/* Explanation */}
            <div ref={explanationRef} className="rounded-xl border border-border bg-surface p-6">
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

      {savedToast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-success px-4 py-2 text-sm font-medium text-white shadow-lg">
          Notes saved ✓
        </div>
      )}
    </div>
  )
}

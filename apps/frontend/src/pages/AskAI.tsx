/**
 * AskAI — AI Tutor page.
 *   Desktop: history sidebar, book cards, quick actions, "How It Works" panel
 *   Mobile:  Recent Chats → AI tutor empty state → quick actions; book sheet drawer
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Send, Search, Plus, FileText, ChevronDown, ChevronRight,
  Mic, Sparkles, Lightbulb, AlignLeft, GitCompare,
  MessageSquare, Trash2, BookOpen, ArrowLeft, PanelLeftClose, PanelLeftOpen, X,
} from 'lucide-react'
import { clsx } from 'clsx'
import { makeApi } from '../lib/api.ts'
import StreamingText from '../components/StreamingText.tsx'
import ChatHistorySidebar from '../components/ChatHistorySidebar.tsx'
import { useSidebar } from '../lib/sidebarContext.tsx'
import type { Book, Subject, ChatSession } from 'shared'

// ── Helpers ───────────────────────────────────────────────────────────────────

const SUBJECT_COLORS = [
  '#22C55E','#22D3EE','#A855F7','#F97316','#EF4444',
  '#FBBF24','#EC4899','#6366F1','#14B8A6','#F43F5E',
]
function subjectColor(i: number) { return SUBJECT_COLORS[i % SUBJECT_COLORS.length] }

function FileIcon({ filename }: { filename: string }) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const isPdf = ext === 'pdf'
  return (
    <div className="flex items-center justify-center w-10 h-10 rounded-lg relative shrink-0"
      style={{
        background: isPdf ? 'rgba(239,68,68,0.15)' : 'rgba(96,165,250,0.15)',
        border: `1px solid ${isPdf ? 'rgba(239,68,68,0.3)' : 'rgba(96,165,250,0.3)'}`,
      }}>
      <FileText size={17} style={{ color: isPdf ? '#EF4444' : '#60A5FA' }} />
      <span className="absolute -bottom-1 -right-1 text-[6px] font-black px-0.5 rounded"
        style={{ background: isPdf ? '#EF4444' : '#60A5FA', color: '#fff' }}>
        {ext.toUpperCase()}
      </span>
    </div>
  )
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

interface LocalMessage { role: 'user' | 'assistant'; content: string }

const QUICK_ACTIONS = [
  { label: 'Ask a Question',      desc: 'Get answers from your documents',   icon: <MessageSquare size={15} style={{ color: '#22D3EE' }} />, prompt: 'Ask a question about this topic' },
  { label: 'Summarize Documents', desc: 'Walk through key points',            icon: <AlignLeft     size={15} style={{ color: '#A855F7' }} />, prompt: 'Summarize this topic' },
  { label: 'Find Key Concepts',   desc: 'Extract important concepts',         icon: <Lightbulb     size={15} style={{ color: '#FBBF24' }} />, prompt: 'What are the key concepts in this material?' },
  { label: 'Compare Materials',   desc: 'Analyze and compare content',        icon: <GitCompare    size={15} style={{ color: '#F97316' }} />, prompt: 'Compare the main concepts across my documents' },
]

const HOW_IT_WORKS = [
  { step: 1, title: 'Select your documents', desc: 'Choose one or more study materials from above', color: '#22D3EE' },
  { step: 2, title: 'Ask anything',          desc: 'Get explanations, summaries, practice questions, and more', color: '#A855F7' },
  { step: 3, title: 'Learn better',          desc: 'Use your own materials for personalized learning', color: '#22C55E' },
]

// ── Mobile Book Sheet ─────────────────────────────────────────────────────────

function BookSheet({ books, selectedIds, onToggle, onDone }: {
  books: Book[]; selectedIds: string[]; onToggle: (id: string) => void; onDone: () => void
}) {
  const [q, setQ] = useState('')
  const filtered = books.filter((b) => b.title.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="rounded-t-2xl border-t border-border bg-bg flex flex-col" style={{ maxHeight: '80vh' }}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-border">
          <p className="text-sm font-bold text-white">Select Books</p>
          <button onClick={onDone}><X size={17} className="text-muted" /></button>
        </div>
        {/* Search */}
        <div className="px-4 py-2.5 shrink-0 border-b border-border">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
            <Search size={13} className="text-muted shrink-0" />
            <input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search books…" autoFocus
              className="flex-1 bg-transparent text-sm text-white placeholder:text-muted/50 focus:outline-none" />
          </div>
        </div>
        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5">
          {filtered.length === 0
            ? <p className="text-sm text-muted/50 py-6 text-center">No books found</p>
            : filtered.map((b) => {
              const sel = selectedIds.includes(b.id)
              return (
                <button key={b.id} onClick={() => onToggle(b.id)}
                  className="w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all"
                  style={{ borderColor: sel ? '#22D3EE' : 'var(--color-border)', background: sel ? 'rgba(34,211,238,0.06)' : 'transparent' }}>
                  <div className="w-4 h-4 rounded shrink-0 flex items-center justify-center"
                    style={{ background: sel ? '#22D3EE' : 'transparent', border: `1.5px solid ${sel ? '#22D3EE' : 'var(--color-border)'}` }}>
                    {sel && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="#0a0f1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{b.title}</p>
                    <p className="text-[11px] text-muted">{b.page_count ? `${b.page_count} pages` : 'PDF'}</p>
                  </div>
                </button>
              )
            })
          }
        </div>
        {/* Done */}
        <div className="shrink-0 px-4 py-4 border-t border-border">
          <button onClick={onDone}
            className="w-full rounded-xl py-3 text-sm font-bold transition-colors"
            style={{ background: '#22D3EE', color: '#0a0f1a' }}>
            Done {selectedIds.length > 0 ? `(${selectedIds.length} selected)` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AskAI() {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const { setCollapsed: setNavCollapsed } = useSidebar()
  const [searchParams] = useSearchParams()
  const preselectedBookId = searchParams.get('bookId')

  const [books, setBooks] = useState<Book[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [filterSubject, setFilterSubject] = useState('')

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamBuffer, setStreamBuffer] = useState('')
  const [webSearch, setWebSearch] = useState(false)
  const [deepReason, setDeepReason] = useState(false)
  const [historyVisible, setHistoryVisible] = useState(true)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [bookSheetOpen, setBookSheetOpen] = useState(false)

  const endRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const streamTopRef = useRef<HTMLDivElement>(null)
  const hasScrolledToStream = useRef(false)

  const isChatMode = messages.length > 0 || streaming

  // ── Intercept phone back button while in chat mode ──────────────────────────
  useEffect(() => {
    if (isChatMode) {
      window.history.pushState({ chatMode: true }, '')
      const handlePop = () => {
        setMessages([]); setStreamBuffer(''); setSessionId(null)
      }
      window.addEventListener('popstate', handlePop)
      return () => window.removeEventListener('popstate', handlePop)
    }
  }, [isChatMode])

  // ── Load history ────────────────────────────────────────────────────────────
  const refreshHistory = useCallback(async () => {
    const token = await getToken()
    if (!token) return
    const { sessions: s } = await makeApi(token).sessions.list()
    setSessions(s.filter((x) => !x.topic?.startsWith('test-review:')))
  }, [getToken])

  const loadSession = useCallback(async (session: ChatSession) => {
    const token = await getToken()
    if (!token) return
    const { messages: msgs } = await makeApi(token).sessions.get(session.id)
    setSessionId(session.id)
    setMessages(msgs.map((m) => ({ role: m.role, content: m.content })))
    setStreamBuffer('')
    if (session.book_ids?.length) setSelectedBookIds(session.book_ids)
  }, [getToken])

  const startNewChat = useCallback(() => {
    setSessionId(null); setMessages([]); setStreamBuffer('')
    setSelectedBookIds([]); setInput('')
  }, [])

  useEffect(() => {
    if (streaming && streamBuffer && !hasScrolledToStream.current) {
      hasScrolledToStream.current = true
      streamTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    if (!streaming) hasScrolledToStream.current = false
  }, [streaming, streamBuffer])

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const api = makeApi(token)
      const [booksRes, subjectsRes] = await Promise.allSettled([api.books.list(), api.subjects.list()])
      if (booksRes.status === 'fulfilled') {
        const ready = booksRes.value.books.filter((b) => b.status === 'READY')
        setBooks(ready)
        if (preselectedBookId && ready.some((b) => b.id === preselectedBookId))
          setSelectedBookIds([preselectedBookId])
      }
      if (subjectsRes.status === 'fulfilled') setSubjects(subjectsRes.value.subjects)
    }
    load().catch(console.error)
  }, [getToken, preselectedBookId])

  useEffect(() => { refreshHistory() }, [refreshHistory])

  const subjectMap = Object.fromEntries(subjects.map((s, i) => [s.id, { name: s.name, color: subjectColor(i) }]))
  const filteredBooks = books.filter((b) => {
    if (filterSubject && b.subject_id !== filterSubject) return false
    if (search) return b.title.toLowerCase().includes(search.toLowerCase()) || b.filename.toLowerCase().includes(search.toLowerCase())
    return true
  })

  function toggleBook(id: string) {
    setSelectedBookIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
    setSessionId(null); setMessages([]); setStreamBuffer('')
  }
  function clearSelection() { setSelectedBookIds([]); setSessionId(null); setMessages([]); setStreamBuffer('') }
  function backToSelection() { setMessages([]); setStreamBuffer(''); setSessionId(null) }

  const ensureSession = useCallback(async (bookIds: string[]): Promise<string> => {
    if (sessionId) return sessionId
    const token = await getToken()
    if (!token) throw new Error('Not authenticated')
    const { session } = await makeApi(token).sessions.create({ mode: 'ask', bookIds })
    setSessionId(session.id)
    return session.id
  }, [sessionId, getToken])

  const handleSend = useCallback(async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || streaming || selectedBookIds.length === 0) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content }])
    setStreaming(true); setStreamBuffer('')
    setNavCollapsed(true)
    try {
      const sid = await ensureSession(selectedBookIds)
      const token = await getToken()
      if (!token) return
      const res = await fetch(`${window.location.pathname.replace(/\/$/, '')}/api/chat/${sid}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content, webSearch, deepReason }),
      })
      if (!res.body) throw new Error('No response body')
      const reader = res.body.getReader(); const decoder = new TextDecoder()
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
  }, [input, streaming, selectedBookIds, ensureSession, getToken, refreshHistory, webSearch, deepReason, setNavCollapsed])

  async function deleteSession(id: string) {
    const token = await getToken()
    if (!token) return
    await makeApi(token).sessions.delete(id)
    if (sessionId === id) startNewChat()
    setSessions((prev) => prev.filter((s) => s.id !== id))
  }

  const sidebar = (
    <ChatHistorySidebar
      sessions={sessions}
      activeSessionId={sessionId}
      onNewChat={startNewChat}
      onSelectSession={loadSession}
      onDeleteSession={deleteSession}
    />
  )

  // ── CHAT MODE ────────────────────────────────────────────────────────────────
  if (isChatMode) {
    return (
      <div className="flex h-full overflow-hidden">
        {historyVisible && <div className="hidden md:flex">{sidebar}</div>}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Slim top bar */}
          <div className="shrink-0 flex items-center gap-3 px-4 lg:px-5 py-2.5 border-b border-border">
            <button onClick={() => setHistoryVisible((v) => !v)}
              className="hidden md:flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors">
              {historyVisible ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
              <span>{historyVisible ? 'Hide' : 'History'}</span>
            </button>
            <div className="hidden md:block w-px h-4 bg-border" />
            <button onClick={backToSelection}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors">
              <ArrowLeft size={13} /> Back
            </button>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <BookOpen size={13} className="text-primary shrink-0" />
              <span className="text-xs text-muted truncate">
                {selectedBookIds.length} source{selectedBookIds.length > 1 ? 's' : ''} selected
                {selectedBookIds.map((id) => {
                  const b = books.find((x) => x.id === id)
                  return b ? ` · ${b.title}` : ''
                }).join('')}
              </span>
            </div>
            <button onClick={clearSelection} className="shrink-0 flex items-center gap-1 text-xs text-muted hover:text-red-400 transition-colors">
              <Trash2 size={11} /> Clear
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-5 min-h-0">
            <div className="max-w-2xl mx-auto space-y-5">
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
                    msg.role === 'user' ? 'font-medium' : 'border border-border bg-surface text-white'
                  )} style={msg.role === 'user' ? { background: '#22D3EE', color: '#0a0f1a' } : {}}>
                    {msg.role === 'assistant' ? <StreamingText text={msg.content} /> : msg.content}
                  </div>
                </div>
              ))}
              {streaming && !streamBuffer && <ThinkingLoader />}
              {streamBuffer && (
                <div ref={streamTopRef} className="flex justify-start">
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
          <div className="shrink-0 border-t border-border px-4 lg:px-6 py-3">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 focus-within:border-primary/50 transition-colors">
                <Mic size={16} className="text-muted shrink-0" />
                <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Ask a follow-up question..."
                  disabled={streaming}
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-muted/50 focus:outline-none" />
                <button onClick={() => handleSend()} disabled={streaming || !input.trim()}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40"
                  style={{ background: '#22D3EE' }}>
                  <Send size={13} style={{ color: '#0a0f1a' }} />
                </button>
              </div>
              <div className="flex items-center justify-between mt-1.5 px-1">
                <div className="flex items-center gap-4">
                  <Toggle label="Web Search" value={webSearch} onChange={setWebSearch} />
                  <Toggle label="Deep Reasoning" value={deepReason} onChange={setDeepReason} icon={<Sparkles size={10} className="text-muted" />} />
                </div>
                <span className="text-[11px] text-muted/50">
                  {selectedBookIds.length} document{selectedBookIds.length > 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── SELECTION MODE ────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden">
      {historyVisible && <div className="hidden md:flex">{sidebar}</div>}

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">

        {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-border px-4 lg:px-5 py-2.5 lg:py-3">
          {/* Desktop toolbar */}
          <div className="hidden md:flex items-center gap-2 flex-wrap">
            <button onClick={() => setHistoryVisible((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors mr-1">
              {historyVisible ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
            </button>
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white">Study Materials</span>
            {selectedBookIds.length > 0 && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded"
                style={{ background: 'rgba(34,211,238,0.15)', color: '#22D3EE', border: '1px solid rgba(34,211,238,0.3)' }}>
                {selectedBookIds.length} Selected
              </span>
            )}
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents..."
                  className="w-36 rounded-lg border border-border bg-surface pl-7 pr-3 py-1.5 text-xs text-white placeholder:text-muted/50 focus:border-primary focus:outline-none transition-colors" />
              </div>
              {subjects.length > 0 && (
                <div className="relative">
                  <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}
                    className="appearance-none rounded-lg border border-border bg-surface pl-3 pr-7 py-1.5 text-xs text-white focus:border-primary focus:outline-none transition-colors">
                    <option value="">All Subjects</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <ChevronDown size={10} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted" />
                </div>
              )}
              <div className="relative">
                <select className="appearance-none rounded-lg border border-border bg-surface pl-3 pr-7 py-1.5 text-xs text-white focus:border-primary focus:outline-none transition-colors">
                  <option>All Status</option><option>Ready</option><option>Processing</option>
                </select>
                <ChevronDown size={10} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted" />
              </div>
              <div className="relative">
                <select className="appearance-none rounded-lg border border-border bg-surface pl-3 pr-7 py-1.5 text-xs text-white focus:border-primary focus:outline-none transition-colors">
                  <option>Recently Added</option><option>A → Z</option><option>Most Pages</option>
                </select>
                <ChevronDown size={10} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted" />
              </div>
              <button onClick={() => navigate('/books')}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold"
                style={{ background: '#22D3EE', color: '#0a0f1a' }}>
                <Plus size={12} /> Add Documents
              </button>
            </div>
          </div>

          {/* Mobile toolbar */}
          <div className="flex md:hidden items-center gap-2">
            <span className="text-sm font-black text-white">AI Tutor</span>
            {selectedBookIds.length > 0 && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded"
                style={{ background: 'rgba(34,211,238,0.15)', color: '#22D3EE', border: '1px solid rgba(34,211,238,0.3)' }}>
                {selectedBookIds.length} Selected
              </span>
            )}
            <button onClick={() => setBookSheetOpen(true)}
              className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold"
              style={{ background: '#22D3EE', color: '#0a0f1a' }}>
              <BookOpen size={12} /> Select Books
            </button>
          </div>
        </div>

        {/* ── Desktop: Book cards ──────────────────────────────────────────────── */}
        <div className="hidden md:block shrink-0 px-5 py-3 border-b border-border">
          <div className="relative">
            <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {filteredBooks.length === 0 ? (
                <div className="flex items-center gap-2 py-6 text-sm text-muted/50">
                  <BookOpen size={15} />
                  {books.length === 0 ? 'No ready books — upload one first' : 'No books match filters'}
                </div>
              ) : filteredBooks.map((book) => {
                const isSelected = selectedBookIds.includes(book.id)
                const subj = book.subject_id ? subjectMap[book.subject_id] : null
                return (
                  <div key={book.id} onClick={() => toggleBook(book.id)}
                    className="shrink-0 w-[170px] rounded-xl border cursor-pointer transition-all duration-150 bg-surface hover:border-primary/40 select-none"
                    style={{ borderColor: isSelected ? '#22D3EE' : 'var(--color-border)', boxShadow: isSelected ? '0 0 0 1px rgba(34,211,238,0.2)' : 'none' }}>
                    <div className="p-3">
                      <div className="flex items-start gap-2 mb-2">
                        <div className="w-4 h-4 rounded shrink-0 mt-0.5 flex items-center justify-center transition-all"
                          style={{ background: isSelected ? '#22D3EE' : 'transparent', border: `1.5px solid ${isSelected ? '#22D3EE' : 'var(--color-border)'}` }}>
                          {isSelected && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="#0a0f1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        </div>
                        <FileIcon filename={book.filename} />
                      </div>
                      <p className="text-xs font-semibold text-white line-clamp-2 mb-1.5 leading-snug">{book.title}</p>
                      {subj && (
                        <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mb-1.5"
                          style={{ background: `${subj.color}18`, color: subj.color, border: `1px solid ${subj.color}40` }}>
                          {subj.name}
                        </span>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted">{book.page_count ? `${book.page_count} pages` : ''}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.3)' }}>READY</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {filteredBooks.length > 5 && (
              <button onClick={() => scrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
                className="absolute right-0 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full border border-border bg-surface flex items-center justify-center text-muted hover:text-white transition-colors shadow-lg">
                <ChevronRight size={13} />
              </button>
            )}
          </div>
        </div>

        {/* ── Main content ─────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* ── MOBILE layout ───────────────────────────────────────────────────── */}
          <div className="md:hidden flex flex-col px-4 py-4 gap-4">

            {/* Recent Chats */}
            {sessions.length > 0 && (
              <div className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(34,211,238,0.12)' }}>
                      <MessageSquare size={14} style={{ color: '#22D3EE' }} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white leading-none">Recent Chats</p>
                      <p className="text-[11px] text-muted mt-0.5">Continue your learning conversation</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-primary flex items-center gap-0.5">
                    View All <ChevronRight size={12} />
                  </span>
                </div>
                <div className="flex gap-2.5 overflow-x-auto scrollbar-none pb-0.5 -mx-1 px-1">
                  {sessions.slice(0, 8).map((s) => {
                    const title = s.topic ?? s.title ?? 'Untitled Chat'
                    const bookTitle = s.book_titles?.length ? s.book_titles[0] : 'General'
                    return (
                      <button key={s.id} onClick={() => loadSession(s)}
                        className="flex-none w-32 rounded-xl border border-border bg-bg p-2.5 text-left hover:border-primary/40 transition-colors">
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center mb-1.5"
                          style={{ background: 'rgba(34,211,238,0.10)' }}>
                          <MessageSquare size={11} style={{ color: '#22D3EE' }} />
                        </div>
                        <p className="text-[11px] font-semibold text-white leading-snug line-clamp-2 mb-1">{title}</p>
                        <p className="text-[10px] text-muted truncate">{bookTitle}</p>
                        <p className="text-[10px] text-muted/50 mt-0.5">{timeAgo(s.updated_at || s.created_at)}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* AI Tutor empty state */}
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3 border-2 border-dashed border-border">
                {selectedBookIds.length > 0
                  ? <Sparkles size={22} style={{ color: '#22D3EE' }} />
                  : <Plus size={26} className="text-muted" />}
              </div>
              {selectedBookIds.length > 0 ? (
                <>
                  <h3 className="text-base font-black text-white mb-1">
                    <span style={{ color: '#22D3EE' }}>{selectedBookIds.length}</span> book{selectedBookIds.length > 1 ? 's' : ''} selected
                  </h3>
                  <p className="text-sm text-muted mb-4 max-w-xs">Type a question below or pick a quick action.</p>
                </>
              ) : (
                <>
                  <h3 className="text-base font-black text-white mb-1">Select your study materials</h3>
                  <p className="text-sm text-muted mb-4 max-w-xs">Tap <strong className="text-white">Select Books</strong> to start an AI-powered study session.</p>
                  <button onClick={() => setBookSheetOpen(true)}
                    className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold mb-2"
                    style={{ background: '#22D3EE', color: '#0a0f1a' }}>
                    <BookOpen size={15} /> Select Books
                  </button>
                </>
              )}
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-2.5">
              {QUICK_ACTIONS.map(({ label, icon, prompt }) => (
                <button key={label} onClick={() => handleSend(prompt)}
                  disabled={selectedBookIds.length === 0}
                  className="flex items-center gap-2.5 rounded-xl border border-border bg-surface p-3 text-left transition-all hover:border-primary/40 disabled:opacity-60 disabled:cursor-not-allowed">
                  <div className="w-7 h-7 rounded-lg border border-border flex items-center justify-center shrink-0">
                    {icon}
                  </div>
                  <p className="text-xs font-semibold text-white leading-snug">{label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* ── DESKTOP layout ───────────────────────────────────────────────────── */}
          <div className="hidden md:flex gap-5 h-full px-5 py-4">
            {/* Centre: empty state + quick actions */}
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5 border-2 border-dashed border-border">
                <Plus size={28} className="text-muted" />
              </div>
              {selectedBookIds.length > 0 ? (
                <>
                  <h3 className="text-base font-black text-white mb-1">
                    <span style={{ color: '#22D3EE' }}>{selectedBookIds.length}</span> document{selectedBookIds.length > 1 ? 's' : ''} selected
                  </h3>
                  <p className="text-sm text-muted mb-6 max-w-xs">
                    Type a question below or use a quick action to start your AI-powered study session.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-base font-black text-white mb-1">Select your study materials</h3>
                  <p className="text-sm text-muted mb-6 max-w-xs">
                    Choose one or more documents above to start an AI-powered study session.
                  </p>
                </>
              )}
              <div className="grid grid-cols-2 gap-2.5 w-full max-w-md">
                {QUICK_ACTIONS.map(({ label, desc, icon, prompt }) => (
                  <button key={label} onClick={() => handleSend(prompt)}
                    disabled={selectedBookIds.length === 0}
                    className="flex items-start gap-2.5 rounded-xl border border-border bg-surface p-3 text-left transition-all hover:border-primary/40 disabled:opacity-75 disabled:cursor-not-allowed">
                    <div className="w-7 h-7 rounded-lg border border-border flex items-center justify-center shrink-0">
                      {icon}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white leading-snug">{label}</p>
                      <p className="text-[11px] text-muted leading-snug mt-0.5">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right: How It Works */}
            <div className="w-48 shrink-0 rounded-xl border border-border bg-surface p-4 self-start">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted mb-4">How It Works</p>
              <div className="space-y-4">
                {HOW_IT_WORKS.map(({ step, title, desc, color }) => (
                  <div key={step} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-black"
                      style={{ background: `${color}18`, color, border: `1px solid ${color}40` }}>
                      {step}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white leading-snug">{title}</p>
                      <p className="text-[11px] text-muted leading-snug mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Input ───────────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-border px-4 lg:px-5 py-3">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-2 lg:gap-3 rounded-xl border border-border bg-surface px-3 lg:px-4 py-2.5 lg:py-3 focus-within:border-primary/50 transition-colors">
              <Mic size={15} className="text-muted shrink-0" />
              <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder={selectedBookIds.length === 0 ? 'Select documents to start…' : 'Ask anything about your materials…'}
                disabled={streaming || selectedBookIds.length === 0}
                className="flex-1 bg-transparent text-sm text-white placeholder:text-muted/50 focus:outline-none min-w-0" />
              <button onClick={() => handleSend()} disabled={streaming || !input.trim() || selectedBookIds.length === 0}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 shrink-0"
                style={{ background: '#22D3EE' }}>
                <Send size={13} style={{ color: '#0a0f1a' }} />
              </button>
            </div>
            <div className="flex items-center justify-between mt-1.5 px-1">
              <div className="flex items-center gap-4">
                <Toggle label="Web Search" value={webSearch} onChange={setWebSearch} />
                <Toggle label="Deep Reasoning" value={deepReason} onChange={setDeepReason} icon={<Sparkles size={10} className="text-muted" />} />
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted">
                {selectedBookIds.length > 0 ? (
                  <button onClick={clearSelection} className="flex items-center gap-1 hover:text-red-400 transition-colors">
                    <Trash2 size={10} /> Clear
                  </button>
                ) : <span className="text-muted/40">No documents selected</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile book sheet */}
      {bookSheetOpen && (
        <BookSheet
          books={books}
          selectedIds={selectedBookIds}
          onToggle={toggleBook}
          onDone={() => setBookSheetOpen(false)}
        />
      )}
    </div>
  )
}

// ── Thinking Loader ───────────────────────────────────────────────────────────

const THINKING_STEPS = ['Thinking', 'Reading your documents', 'Extracting key information', 'Analysing context', 'Formulating response', 'Almost there']

function ThinkingLoader() {
  const [stepIdx, setStepIdx] = useState(0)
  const [dot, setDot] = useState(0)
  useEffect(() => {
    const s = setInterval(() => setStepIdx((i) => (i + 1) % THINKING_STEPS.length), 1800)
    const d = setInterval(() => setDot((d) => (d + 1) % 4), 400)
    return () => { clearInterval(s); clearInterval(d) }
  }, [])
  return (
    <div className="flex justify-start">
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mr-2.5 mt-0.5"
        style={{ background: 'rgba(34,211,238,0.15)', border: '1px solid rgba(34,211,238,0.3)' }}>
        <Sparkles size={13} style={{ color: '#22D3EE' }} />
      </div>
      <div className="rounded-2xl border border-border bg-surface px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full"
              style={{ background: '#22D3EE', opacity: dot === i ? 1 : 0.25, transform: dot === i ? 'scale(1.3)' : 'scale(1)', transition: 'opacity 0.2s, transform 0.2s' }} />
          ))}
        </div>
        <span className="text-sm text-muted" style={{ minWidth: 200 }}>{THINKING_STEPS[stepIdx]}{'·'.repeat(dot)}</span>
      </div>
    </div>
  )
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ label, value, onChange, icon }: { label: string; value: boolean; onChange: (v: boolean) => void; icon?: React.ReactNode }) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer select-none">
      {icon}
      <span className="text-[11px] text-muted">{label}</span>
      <button onClick={() => onChange(!value)}
        className="relative w-7 h-3.5 rounded-full transition-colors"
        style={{ background: value ? '#22D3EE' : 'rgba(255,255,255,0.1)' }}>
        <span className="absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all"
          style={{ left: value ? '14px' : '2px' }} />
      </button>
    </label>
  )
}

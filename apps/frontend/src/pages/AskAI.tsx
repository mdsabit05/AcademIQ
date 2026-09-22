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
  Mic, Sparkles,
  MessageSquare, Trash2, BookOpen, ArrowLeft, PanelLeftClose, PanelLeftOpen, X, BookMarked,
} from 'lucide-react'
import { clsx } from 'clsx'
import { makeApi } from '../lib/api.ts'
import StreamingText from '../components/StreamingText.tsx'
import ChatHistorySidebar from '../components/ChatHistorySidebar.tsx'
import StudyTopicPanel from '../components/StudyTopicPanel.tsx'
import { useSidebar } from '../lib/sidebarContext.tsx'
import type { Book, Subject, ChatSession, Syllabus, SyllabusTopic } from 'shared'

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


interface LocalMessage { role: 'user' | 'assistant'; content: string }


const HOW_IT_WORKS = [
  { step: 1, title: 'Select documents', desc: 'Choose one or more study materials from the book shelf above', color: '#22D3EE' },
  { step: 2, title: 'Ask anything',     desc: 'Get explanations, summaries, practice questions, and more', color: '#A855F7' },
  { step: 3, title: 'Study Mode',       desc: 'Pick a syllabus → topic → let AI teach you step by step with progress tracking', color: '#22C55E' },
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
  const [historyVisible, setHistoryVisible] = useState(() => window.innerWidth >= 768)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [bookSheetOpen, setBookSheetOpen] = useState(false)

  // Study mode state
  const [studyMode, setStudyMode] = useState(false)
  const [studyStep, setStudyStep] = useState<1 | 2 | 3>(1)
  const [studyBookId, setStudyBookId] = useState<string | null>(null)
  const [studySyllabus, setStudySyllabus] = useState<{ id: string; title: string } | null>(null)
  const [studyTopics, setStudyTopics] = useState<SyllabusTopic[]>([])
  const [studySyllabi, setStudySyllabi] = useState<Syllabus[]>([])
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null)
  const [topicPanelVisible, setTopicPanelVisible] = useState(false)
  const [loadingStudy, setLoadingStudy] = useState(false)

  const endRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const streamTopRef = useRef<HTMLDivElement>(null)
  const hasScrolledToStream = useRef(false)

  const isChatMode = messages.length > 0 || streaming || (studyMode && sessionId !== null)

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
    const api = makeApi(token)
    const { messages: msgs } = await api.sessions.get(session.id)
    setSessionId(session.id)
    setMessages(msgs.map((m) => ({ role: m.role, content: m.content })))
    setStreamBuffer('')
    if (session.book_ids?.length) setSelectedBookIds(session.book_ids)

    // Restore study mode for 'learn' sessions
    if (session.mode === 'learn' && session.topic) {
      const { syllabi } = await api.syllabus.list()
      const readySyllabi = syllabi.filter((s) => s.status === 'ready')
      const results = await Promise.all(
        readySyllabi.map((s) => api.syllabus.get(s.id).then((r) => ({ syllabus: s, topics: r.topics })))
      )
      const match = results.find((r) => r.topics.some((t) => t.topic === session.topic))
      if (match) {
        setStudyMode(true)
        setStudySyllabus({ id: match.syllabus.id, title: match.syllabus.title })
        setStudyTopics(match.topics)
        setStudyBookId(session.book_ids[0] ?? null)
        const activeTopic = match.topics.find((t) => t.topic === session.topic)
        setActiveTopicId(activeTopic?.id ?? null)
      } else {
        setStudyMode(false); setStudyTopics([]); setStudySyllabus(null); setActiveTopicId(null)
      }
    } else {
      setStudyMode(false); setStudyTopics([]); setStudySyllabus(null); setActiveTopicId(null)
    }
    setTopicPanelVisible(false)
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'instant' }), 50)
  }, [getToken])

  const startNewChat = useCallback(() => {
    if (studyMode) {
      // In study mode, "new chat" goes back to step 2 (pick a topic again)
      setSessionId(null); setMessages([]); setStreamBuffer('')
      setStudyStep(2)
      setActiveTopicId(null)
      setTopicPanelVisible(false)
      return
    }
    setSessionId(null); setMessages([]); setStreamBuffer('')
    setSelectedBookIds([]); setInput('')
  }, [studyMode])

  // ── Study mode handlers ────────────────────────────────────────────────────
  async function enterStudyMode() {
    setStudyMode(true)
    setStudyStep(1)
    setStudyBookId(null)
    setStudySyllabus(null)
    setStudyTopics([])
    setActiveTopicId(null)
    setTopicPanelVisible(false)
    const token = await getToken()
    if (!token) return
    const api = makeApi(token)
    const { syllabi } = await api.syllabus.list()
    setStudySyllabi(syllabi.filter((s) => s.status === 'ready'))
  }

  function exitStudyMode() {
    setStudyMode(false)
    setStudyStep(1)
    setStudyBookId(null)
    setStudySyllabus(null)
    setStudyTopics([])
    setActiveTopicId(null)
    setTopicPanelVisible(false)
  }

  async function loadStudyTopics(syllabusId: string) {
    setLoadingStudy(true)
    try {
      const token = await getToken()
      if (!token) return
      const api = makeApi(token)
      const { topics } = await api.syllabus.get(syllabusId)
      setStudyTopics(topics)
    } finally {
      setLoadingStudy(false)
    }
  }

  async function startStudySession() {
    if (!studyBookId || !activeTopicId) return
    const activeTopic = studyTopics.find((t) => t.id === activeTopicId)
    if (!activeTopic) return
    setLoadingStudy(true)
    try {
      const token = await getToken()
      if (!token) return
      const api = makeApi(token)
      const { session } = await api.sessions.create({
        mode: 'learn',
        bookIds: [studyBookId],
        topic: activeTopic.topic,
      })
      setSessionId(session.id)
      setSessions((prev) => [session, ...prev])
      setSelectedBookIds([studyBookId])
      setTopicPanelVisible(false)
      setLoadingStudy(false)

      // Auto-send opening message so AI starts explaining immediately
      const content = `Explain "${activeTopic.topic}" to me`
      setMessages([{ role: 'user', content }])
      setStreamBuffer('')
      setStreaming(true)
      setNavCollapsed(true)
      const apiBase = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'
      const res = await fetch(`${apiBase}/chat/${session.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content, webSearch: false, deepReason: false }),
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
      setLoadingStudy(false)
      refreshHistory()
    }
  }

  async function handleMarkComplete(topicId: string) {
    if (!studySyllabus) return
    const topic = studyTopics.find((t) => t.id === topicId)
    if (!topic) return
    const newCompleted = !topic.completed
    setStudyTopics((prev) =>
      prev.map((t) => (t.id === topicId ? { ...t, completed: newCompleted } : t))
    )
    const token = await getToken()
    if (!token) return
    await makeApi(token).syllabus.updateTopic(studySyllabus.id, topicId, newCompleted)
  }

  useEffect(() => {
    if (streaming && !hasScrolledToStream.current) {
      hasScrolledToStream.current = true
      endRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    if (!streaming) hasScrolledToStream.current = false
  }, [streaming, streamBuffer])

  // 2.5 s after study session starts, briefly show the topic panel for 2 s
  // so the user sees it exists, then auto-hide it.
  useEffect(() => {
    if (!studyMode || !sessionId || !studySyllabus) return
    const show = setTimeout(() => setTopicPanelVisible(true), 2500)
    const hide = setTimeout(() => setTopicPanelVisible(false), 4500)
    return () => { clearTimeout(show); clearTimeout(hide) }
  }, [studyMode, sessionId, studySyllabus])

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const api = makeApi(token)
      const [booksRes, subjectsRes] = await Promise.allSettled([api.books.list(undefined, 'student'), api.subjects.list()])
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
  function backToSelection() {
    if (studyMode) {
      setStudyStep(2)
    }
    setSessionId(null)
    setMessages([])
    setStreamBuffer('')
  }

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
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 0)
    try {
      const sid = await ensureSession(selectedBookIds)
      const token = await getToken()
      if (!token) return
      const apiBase = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'
      const res = await fetch(`${apiBase}/chat/${sid}/message`, {
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

        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Slim top bar */}
          <div className="shrink-0 flex items-center gap-3 px-4 lg:px-5 py-2.5 border-b border-border">
            <button onClick={() => setHistoryVisible((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors">
              {historyVisible ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
              <span className="hidden sm:inline">{historyVisible ? 'Hide' : 'History'}</span>
            </button>
            <div className="w-px h-4 bg-border" />
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
            {studyMode && (
              <>
                <button
                  onClick={() => setTopicPanelVisible((v) => !v)}
                  className="shrink-0 flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
                >
                  <BookMarked size={14} />
                  <span className="hidden sm:inline">Topics</span>
                  {studyTopics.filter((t) => !t.completed).length > 0 && (
                    <span className="rounded-full bg-primary text-bg text-[10px] font-bold px-1.5 py-0.5 leading-none">
                      {studyTopics.filter((t) => !t.completed).length}
                    </span>
                  )}
                </button>
                <div className="w-px h-4 bg-border" />
              </>
            )}
            <button onClick={clearSelection} className="shrink-0 flex items-center gap-1 text-xs text-muted hover:text-red-400 transition-colors">
              <Trash2 size={11} /> Clear
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-5 min-h-0">
            <div className={clsx('mx-auto space-y-5 transition-all duration-300', historyVisible ? 'max-w-2xl' : 'max-w-4xl')}>
              {/* Study mode welcome — shown when session exists but no messages yet */}
              {studyMode && messages.length === 0 && !streaming && activeTopicId && (() => {
                const topic = studyTopics.find(t => t.id === activeTopicId)
                return topic ? (
                  <div className="flex flex-col items-center text-center py-10 gap-3">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center border-2 border-dashed border-border">
                      <BookMarked size={22} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-white">{topic.topic}</p>
                      {topic.unit && <p className="text-xs text-muted mt-0.5">{topic.unit}</p>}
                    </div>
                    <p className="text-sm text-muted max-w-xs">Session ready. Ask a question or type <strong className="text-white">explain this topic</strong> to begin.</p>
                  </div>
                ) : null
              })()}
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
            <div className={clsx('mx-auto transition-all duration-300', historyVisible ? 'max-w-2xl' : 'max-w-4xl')}>
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
        {studyMode && studyTopics.length > 0 && (
          <>
            {/* Mobile: dim backdrop */}
            <div
              className={clsx(
                'fixed inset-0 z-40 bg-black/50 md:hidden transition-opacity duration-300',
                topicPanelVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
              )}
              onClick={() => setTopicPanelVisible(false)}
            />
            {/* Mobile: full-height slide-over from right */}
            <div className={clsx(
              'fixed inset-y-0 right-0 z-50 md:hidden transition-transform duration-300 ease-in-out',
              topicPanelVisible ? 'translate-x-0' : 'translate-x-full',
            )}>
              <StudyTopicPanel
                syllabusTitle={studySyllabus?.title ?? 'Topics'}
                topics={studyTopics}
                activeTopicId={activeTopicId}
                onSetActive={setActiveTopicId}
                onMarkComplete={handleMarkComplete}
                onClose={() => setTopicPanelVisible(false)}
              />
            </div>
            {/* Desktop: sidebar that slides width to push chat content */}
            <div className={clsx(
              'hidden md:block overflow-hidden transition-all duration-300 ease-in-out h-full shrink-0',
              topicPanelVisible ? 'w-52' : 'w-0',
            )}>
              <StudyTopicPanel
                syllabusTitle={studySyllabus?.title ?? 'Topics'}
                topics={studyTopics}
                activeTopicId={activeTopicId}
                onSetActive={setActiveTopicId}
                onMarkComplete={handleMarkComplete}
                onClose={() => setTopicPanelVisible(false)}
              />
            </div>
          </>
        )}
      </div>
    )
  }

  // ── SELECTION MODE ────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden">
      {historyVisible && <div className="hidden md:flex">{sidebar}</div>}

      {/* Mobile history drawer (selection screen) */}
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

      {studyMode ? (
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          {/* Study Mode Wizard header */}
          <div className="shrink-0 border-b border-border px-4 lg:px-5 py-2.5 flex items-center gap-2">
            <button
              onClick={() => studyStep === 1 ? exitStudyMode() : setStudyStep(1)}
              className="flex items-center gap-1 text-xs text-muted hover:text-white transition-colors mr-1"
            >
              <ArrowLeft size={13} /> {studyStep === 1 ? 'Exit' : 'Back'}
            </button>
            <div className="w-px h-4 bg-border" />
            <BookMarked size={15} className="text-primary" />
            <span className="text-sm font-semibold text-white">Study Mode</span>
            <span className="text-xs text-muted hidden sm:inline">
              — Step {studyStep} of 2: {studyStep === 1 ? 'Pick a Book' : 'Pick a Syllabus & Topic'}
            </span>
            <div className="ml-auto flex items-center gap-3">
              <button onClick={exitStudyMode} className="text-xs text-muted hover:text-white transition-colors hidden sm:block">
                Exit Study Mode
              </button>
              {/* Step 1: Next only */}
              {studyStep === 1 && (
                <button
                  onClick={() => setStudyStep(2)}
                  disabled={!studyBookId}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-bg bg-primary hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              )}
              {/* Step 2: Start Studying (enabled when topic selected) */}
              {studyStep === 2 && (
                <button
                  onClick={startStudySession}
                  disabled={!activeTopicId || loadingStudy}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-bg bg-primary hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loadingStudy ? 'Starting…' : 'Start Studying →'}
                </button>
              )}
            </div>
          </div>

          {/* Scrollable content — no nav buttons here */}
          <div className="flex-1 overflow-y-auto p-4 lg:p-6">
            {/* Step 1: Pick a Book */}
            {studyStep === 1 && (
              <div className="space-y-3 max-w-3xl mx-auto">
                <p className="text-sm text-muted">Select the book you want to study from.</p>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {books.map((book) => (
                    <button
                      key={book.id}
                      onClick={() => setStudyBookId(book.id === studyBookId ? null : book.id)}
                      className={`text-left rounded-xl border p-4 transition-colors ${
                        studyBookId === book.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-surface hover:border-primary/40'
                      }`}
                    >
                      <p className="text-sm font-semibold text-white truncate">{book.title}</p>
                      {book.author && <p className="text-xs text-muted mt-0.5 truncate">{book.author}</p>}
                      <p className="text-xs text-muted mt-1">{book.page_count ? `${book.page_count} pages` : book.filename}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Pick a Syllabus + Topic (inline) */}
            {studyStep === 2 && (
              <div className="max-w-3xl mx-auto">
                {studySyllabi.length === 0 ? (
                  <div className="rounded-xl border border-border bg-surface p-8 text-center">
                    <p className="text-sm text-white font-medium">No syllabi found</p>
                    <p className="text-xs text-muted mt-1">Upload a syllabus from the Syllabus page first.</p>
                  </div>
                ) : (
                  <div className="flex gap-4 items-start">
                    {/* Left: Syllabus list */}
                    <div className="w-56 shrink-0 space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted mb-2">Syllabi</p>
                      {studySyllabi.map((s) => (
                        <button
                          key={s.id}
                          onClick={async () => {
                            setStudySyllabus({ id: s.id, title: s.title })
                            setActiveTopicId(null)
                            await loadStudyTopics(s.id)
                          }}
                          className={`w-full text-left rounded-xl border p-3 transition-colors ${
                            studySyllabus?.id === s.id
                              ? 'border-primary bg-primary/10'
                              : 'border-border bg-surface hover:border-primary/40'
                          }`}
                        >
                          <p className="text-sm font-semibold text-white leading-snug">{s.title}</p>
                          <p className="text-xs text-muted mt-0.5">{new Date(s.created_at).toLocaleDateString()}</p>
                        </button>
                      ))}
                    </div>

                    {/* Right: Topics for selected syllabus */}
                    <div className="flex-1 min-w-0">
                      {!studySyllabus ? (
                        <div className="rounded-xl border border-dashed border-border bg-surface/30 p-8 flex flex-col items-center justify-center text-center gap-2">
                          <BookMarked size={22} className="text-muted/40" />
                          <p className="text-sm text-muted/60">Select a syllabus to see its topics</p>
                        </div>
                      ) : loadingStudy ? (
                        <div className="text-sm text-muted animate-pulse py-4">Loading topics…</div>
                      ) : (
                        <div className="space-y-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted">
                            Topics — {studySyllabus.title}
                          </p>
                          {Array.from(new Set(studyTopics.map((t) => t.unit ?? 'General'))).map((unit) => (
                            <div key={unit}>
                              <p className="text-xs font-black uppercase tracking-widest text-muted mb-2">{unit}</p>
                              <div className="space-y-1.5">
                                {studyTopics.filter((t) => (t.unit ?? 'General') === unit).map((topic) => (
                                  <button
                                    key={topic.id}
                                    onClick={() => setActiveTopicId(topic.id)}
                                    className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors flex items-center gap-3 ${
                                      activeTopicId === topic.id
                                        ? 'border-primary bg-primary/10 text-white'
                                        : topic.completed
                                          ? 'border-border bg-surface/50 text-muted/50'
                                          : 'border-border bg-surface hover:border-primary/40 text-white'
                                    }`}
                                  >
                                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 text-[9px] ${
                                      topic.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border'
                                    }`}>
                                      {topic.completed ? '✓' : ''}
                                    </span>
                                    <span className="flex-1 truncate">{topic.topic}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      ) : (

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">

        {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-border px-4 lg:px-5 py-2.5 lg:py-3">
          {/* Desktop toolbar */}
          <div className="hidden md:flex items-center gap-2 flex-wrap">
            <button onClick={() => setHistoryVisible((v) => !v)}
              title={historyVisible ? 'Hide history' : 'Show history'}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-white hover:bg-white/5 transition-colors mr-1 shrink-0">
              {historyVisible ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            </button>
            <div className="w-px h-4 bg-border" />
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
            {/* ChatGPT-style history button */}
            <button onClick={() => setHistoryVisible((v) => !v)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-white hover:bg-white/5 transition-colors shrink-0">
              <PanelLeftOpen size={17} />
            </button>
            <span className="text-sm font-black text-white">AI Tutor</span>
            <button onClick={enterStudyMode}
              className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold shrink-0"
              style={{ background: '#22D3EE', color: '#0a0f1a' }}>
              <BookMarked size={12} /> Study Mode
            </button>
          </div>
          {/* Select Books row */}
          <div className="flex md:hidden items-center gap-2 mt-2 pt-2 border-t border-border">
            <BookOpen size={14} className="text-muted shrink-0" />
            <button onClick={() => setBookSheetOpen(true)}
              className="flex-1 text-left text-sm text-muted hover:text-white transition-colors">
              {selectedBookIds.length > 0
                ? <span><span style={{ color: '#22D3EE' }} className="font-bold">{selectedBookIds.length}</span> book{selectedBookIds.length > 1 ? 's' : ''} selected</span>
                : 'Select Books'}
            </button>
            <button onClick={() => setBookSheetOpen(true)}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-border text-muted hover:text-white hover:border-primary/50 transition-colors">
              {selectedBookIds.length > 0 ? 'Change' : 'Browse'}
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

        {/* ── Study Mode Banner ───────────────────────────────────────────────── */}
        <div className="hidden md:block shrink-0 px-5 py-2.5 border-b border-border"
          style={{ background: 'linear-gradient(90deg, rgba(34,211,238,0.07) 0%, rgba(168,85,247,0.05) 100%)' }}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(34,211,238,0.15)', border: '1px solid rgba(34,211,238,0.3)' }}>
                <BookMarked size={15} style={{ color: '#22D3EE' }} />
              </div>
              <div>
                <p className="text-xs font-bold text-white leading-none">Study Mode</p>
                <p className="text-[11px] text-muted mt-0.5">Follow your syllabus topic by topic — AI teaches, you track progress</p>
              </div>
            </div>
            <button
              onClick={enterStudyMode}
              className="ml-auto flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold shrink-0 transition-colors"
              style={{ background: '#22D3EE', color: '#0a0f1a' }}
            >
              <BookMarked size={12} /> Enter Study Mode
            </button>
          </div>
        </div>

        {/* ── Main content ─────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* ── MOBILE layout ───────────────────────────────────────────────────── */}
          <div className="md:hidden flex flex-col px-4 py-4 gap-4">

            {/* Study Mode banner — top so it's always visible */}
            {/* Instructions */}
            <div className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted mb-3">How to use</p>
              <div className="space-y-3">
                {[
                  { num: '1', title: 'Select your books', desc: 'Tap "Browse" next to Select Books above to choose study materials.' },
                  { num: '2', title: 'Ask any question', desc: 'Type in the chat box — get explanations, summaries, or practice questions.' },
                  { num: '3', title: 'Use Study Mode', desc: 'Tap "Study Mode" in the top bar to follow your syllabus topic by topic with AI guidance.' },
                  { num: '4', title: 'Browse history', desc: 'Tap the panel icon (top-left) to see and continue previous conversations.' },
                ].map(({ num, title, desc }) => (
                  <div key={num} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black mt-0.5"
                      style={{ background: 'rgba(34,211,238,0.12)', color: '#22D3EE', border: '1px solid rgba(34,211,238,0.3)' }}>
                      {num}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white leading-snug">{title}</p>
                      <p className="text-[11px] text-muted leading-relaxed mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Chats — ChatGPT-style open-drawer button */}
            {sessions.length > 0 && (
              <button onClick={() => setHistoryVisible(true)}
                className="w-full flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-left hover:border-primary/40 transition-colors">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(34,211,238,0.12)' }}>
                  <MessageSquare size={16} style={{ color: '#22D3EE' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white leading-none">Recent Chats</p>
                  <p className="text-[11px] text-muted mt-0.5">{sessions.length} conversation{sessions.length > 1 ? 's' : ''} · tap to browse</p>
                </div>
                <ChevronRight size={16} className="text-muted shrink-0" />
              </button>
            )}

          </div>

          {/* ── DESKTOP layout ───────────────────────────────────────────────────── */}
          <div className="hidden md:flex gap-5 h-full px-5 py-4">
            {/* Centre: empty state + quick actions */}
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5 border-2 border-dashed border-border">
                <Sparkles size={28} className="text-muted" />
              </div>
              {selectedBookIds.length > 0 ? (
                <h3 className="text-base font-black text-white mb-6">
                  <span style={{ color: '#22D3EE' }}>{selectedBookIds.length}</span> document{selectedBookIds.length > 1 ? 's' : ''} selected — ask anything below
                </h3>
              ) : (
                <h3 className="text-base font-black text-white mb-6">Your AI Study Assistant</h3>
              )}
              <div className="w-full max-w-sm text-left space-y-3">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted mb-3">How to use</p>
                {[
                  { num: '1', title: 'Select your books', desc: 'Pick one or more documents from the shelf above to give the AI context.' },
                  { num: '2', title: 'Ask any question', desc: 'Type your question in the chat box — get explanations, summaries, or practice questions.' },
                  { num: '3', title: 'Use Study Mode', desc: 'Click "Enter Study Mode" to follow your syllabus topic by topic with AI guidance.' },
                  { num: '4', title: 'Track your history', desc: 'Click the panel icon (top-left) to browse and continue previous conversations.' },
                ].map(({ num, title, desc }) => (
                  <div key={num} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black mt-0.5"
                      style={{ background: 'rgba(34,211,238,0.12)', color: '#22D3EE', border: '1px solid rgba(34,211,238,0.3)' }}>
                      {num}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white leading-snug">{title}</p>
                      <p className="text-[11px] text-muted leading-relaxed mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: How It Works */}
            <div className="w-48 shrink-0 rounded-xl border border-border/50 bg-surface/50 p-4 self-start">
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
          <div className={clsx('mx-auto transition-all duration-300', historyVisible ? 'max-w-2xl' : 'max-w-4xl')}>
            {selectedBookIds.length === 0 && (
              <p className="text-[11px] text-muted/60 text-center mb-1.5">
                ↑ Select a book above to unlock the chat
              </p>
            )}
            <div className={clsx(
              'flex items-center gap-2 lg:gap-3 rounded-xl border bg-surface px-3 lg:px-4 py-2.5 lg:py-3 transition-colors',
              selectedBookIds.length === 0 ? 'border-border opacity-50 cursor-not-allowed' : 'border-border focus-within:border-primary/50',
            )}>
              <Mic size={15} className="text-muted shrink-0" />
              <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder={selectedBookIds.length === 0 ? 'Select documents to start…' : 'Ask anything about your materials…'}
                disabled={streaming || selectedBookIds.length === 0}
                className="flex-1 bg-transparent text-sm text-white placeholder:text-muted/50 focus:outline-none min-w-0 disabled:cursor-not-allowed" />
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

      )} {/* end of ternary else (selection content) */}

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

/**
 * TestResults — score summary + question review + AI chat panel.
 * Chat is context-aware: AI knows every question, the student's answer,
 * and the correct answer so it can explain mistakes in detail.
 */

import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.ts'
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  RotateCcw,
  Send,
  Loader2,
  Sparkles,
  MessageSquare,
  Bot,
} from 'lucide-react'
import { marked } from 'marked'
import { makeApi } from '../lib/api.ts'
import { useHideMobileTopBar } from '../lib/topBarContext.tsx'
import type { Test } from 'shared'

// ── Types ──────────────────────────────────────────────────────────────────────

interface AnswerRow {
  question_id: string
  answer: string
  is_correct: boolean
  marks_awarded: number
  question: string
  question_type: string
  correct_answer: string
  marks: number
}

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function pctLabel(pct: number) {
  if (pct >= 90) return { text: 'Outstanding! 🎉', color: 'text-emerald-400' }
  if (pct >= 75) return { text: 'Excellent work!',  color: 'text-emerald-400' }
  if (pct >= 60) return { text: 'Good effort!',     color: 'text-primary'    }
  if (pct >= 40) return { text: 'Keep practising!', color: 'text-yellow-400' }
  return             { text: 'Don\'t give up!',   color: 'text-red-400'    }
}

/** Build a rich system context string from the test + answers. */
function buildContext(test: Test, answers: AnswerRow[], pct: number): string {
  const wrongQs = answers.filter((a) => !a.is_correct)
  const lines = [
    `The student just completed a ${test.type.replace(/_/g, ' ')} test (${test.difficulty} difficulty).`,
    `Score: ${pct}% (${answers.filter(a => a.is_correct).length}/${answers.length} correct).`,
    '',
    'Questions and results:',
    ...answers.map((a, i) =>
      `Q${i + 1} [${a.is_correct ? 'CORRECT' : 'WRONG'}]: "${a.question}" | Student answered: "${a.answer || '(blank'}" | Correct: "${a.correct_answer}" | Marks: ${a.marks_awarded}/${a.marks}`
    ),
    '',
    wrongQs.length > 0
      ? `The student got ${wrongQs.length} question(s) wrong. Help them understand the correct answers with clear explanations from the study material.`
      : 'The student got all questions right! Help reinforce their understanding or answer follow-up questions.',
    '',
    'Be concise, friendly, and educational. If asked to explain a wrong answer, cite the reasoning clearly.',
  ]
  return lines.join('\n')
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function TestResults() {
  const { testId, attemptId } = useParams<{ testId: string; attemptId: string }>()
  const { getToken } = useAuth()
  const navigate     = useNavigate()

  // Results data
  const [_test,   setTest]    = useState<Test | null>(null)
  const [answers, setAnswers] = useState<AnswerRow[]>([])
  const [score,   setScore]   = useState<{ score: number; totalMarks: number } | null>(null)
  const [loading, setLoading] = useState(true)

  // Chat
  const [sessionId,  setSessionId]  = useState<string | null>(null)
  const [messages,   setMessages]   = useState<ChatMsg[]>([])
  const [input,      setInput]      = useState('')
  const [sending,    setSending]    = useState(false)
  const [chatReady,  setChatReady]  = useState(false)
  const chatEndRef   = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLInputElement>(null)
  const contextRef   = useRef<string>('')

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token || !testId || !attemptId) return
      const api = makeApi(token)

      const [{ test: t }, { attempt, answers: ans }] = await Promise.all([
        api.tests.get(testId),
        api.tests.getAttempt(testId, attemptId),
      ])

      setTest(t)
      setAnswers(ans as AnswerRow[])
      setScore({ score: attempt.score, totalMarks: attempt.total_marks })

      // Build context for AI
      const pct = Math.round((attempt.score / attempt.total_marks) * 100)
      const bookIds: string[] = (t.config as Record<string, unknown>)?.bookIds as string[] ?? []
      contextRef.current = buildContext(t, ans as AnswerRow[], pct)

      // Use a unique topic key so we can find and reuse the session on revisit
      const reviewTopic = `test-review:${attemptId}`

      // Check if a session for this attempt already exists
      const { sessions: allSessions } = await api.sessions.list()
      const existing = allSessions.find((s) => s.topic === reviewTopic)

      if (existing) {
        // Reuse existing session — load its messages, hiding the context primer
        setSessionId(existing.id)
        const { messages: prevMsgs } = await api.sessions.get(existing.id)
        const visible = prevMsgs.filter((m) => !m.content.startsWith('[CONTEXT'))
        setMessages(visible.map((m) => ({ role: m.role, content: m.content })))
      } else {
        // Create new session — use 'ask' with books if available, else 'general'
        const reviewTitle = t?.topic ? `Test Review: ${t.topic}` : 'Test Review'
        const { session } = await api.sessions.create({
          mode: bookIds.length > 0 ? 'ask' : 'general',
          bookIds,
          topic: reviewTopic,
          title: reviewTitle,
        })
        setSessionId(session.id)
        // Prime the AI with context as a silent first user message
        await api.chat.postMessage(session.id, `[CONTEXT - do not repeat this back, just acknowledge that you're ready to help]\n${contextRef.current}`)
      }

      setChatReady(true)
      setLoading(false)
    }
    load()
  }, [testId, attemptId, getToken])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Send message ────────────────────────────────────────────────────────────
  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || !sessionId || sending) return

    setInput('')
    setSending(true)
    setMessages((prev) => [...prev, { role: 'user', content }])

    // Streaming assistant reply
    setMessages((prev) => [...prev, { role: 'assistant', content: '', streaming: true }])

    try {
      const token = await getToken()
      if (!token) return
      const res = await makeApi(token).chat.postMessage(sessionId, content)
      if (!res.body) return

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''
      let full      = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') break
          try { full += JSON.parse(data) as string }
          catch { full += data }
        }

        setMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = { role: 'assistant', content: full, streaming: true }
          return next
        })
      }

      setMessages((prev) => {
        const next = [...prev]
        next[next.length - 1] = { role: 'assistant', content: full, streaming: false }
        return next
      })
    } finally {
      setSending(false)
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const pct    = score ? Math.round((score.score / score.totalMarks) * 100) : 0
  const label  = pctLabel(pct)
  const wrongQs = answers.filter((a) => !a.is_correct)

  // Quick chips based on wrong answers
  const quickChips = [
    ...wrongQs.slice(0, 3).map((a, _i) => {
      const idx = answers.findIndex((r) => r.question_id === a.question_id) + 1
      return `Explain why Q${idx} answer is "${a.correct_answer}"`
    }),
    'Summarise what I need to revise',
    'Give me tips to improve my score',
  ]

  const [mobileTab, setMobileTab] = useState<'results' | 'chat'>('results')
  useHideMobileTopBar(mobileTab === 'chat')

  // ── Shared sub-components ───────────────────────────────────────────────────

  const ResultsPanel = (
    <div className="p-4 lg:p-6 space-y-5 lg:space-y-6">

      {/* Nav row */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/tests')}
          className="flex items-center gap-2 text-sm text-muted hover:text-white transition-colors"
        >
          <ArrowLeft size={15} /> Back
        </button>
        <button
          onClick={() => navigate('/test/new')}
          className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-white hover:border-primary/40 hover:text-primary transition-colors"
        >
          <RotateCcw size={14} /> Retest
        </button>
      </div>

      {/* Score card */}
      <div className="rounded-2xl border border-border bg-surface p-6 lg:p-8 text-center">
        <div className="relative mx-auto mb-4 flex h-24 w-24 lg:h-28 lg:w-28 items-center justify-center">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="rgb(var(--color-border))" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="44"
              fill="none"
              stroke={pct >= 60 ? '#22D3EE' : pct >= 40 ? '#FBBF24' : '#EF4444'}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 44}`}
              strokeDashoffset={`${2 * Math.PI * 44 * (1 - pct / 100)}`}
              className="transition-all duration-700"
            />
          </svg>
          <span className="text-3xl font-black text-white">{pct}%</span>
        </div>
        <p className="text-lg text-muted">{score?.score} / {score?.totalMarks} marks</p>
        <p className={`mt-1.5 text-base font-semibold ${label.color}`}>{label.text}</p>
        <div className="mt-4 flex items-center justify-center gap-8 border-t border-border pt-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-400">{answers.filter(a => a.is_correct).length}</p>
            <p className="text-sm text-muted mt-0.5">Correct</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-400">{wrongQs.length}</p>
            <p className="text-sm text-muted mt-0.5">Wrong</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{answers.length}</p>
            <p className="text-sm text-muted mt-0.5">Total</p>
          </div>
        </div>
      </div>

      {/* Ask AI button — mobile only, switches to chat tab */}
      <button
        onClick={() => setMobileTab('chat')}
        className="md:hidden w-full flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 py-2.5 text-sm font-semibold text-primary"
      >
        <Bot size={15} /> Ask AI Tutor about this test
      </button>

      {/* Question review */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-white">Question Review</h2>
        <div className="space-y-3">
          {answers.map((a, i) => (
            <div
              key={a.question_id}
              className={`rounded-xl border p-3.5 lg:p-4 ${
                a.is_correct
                  ? 'border-emerald-800/40 bg-emerald-950/10'
                  : 'border-red-800/40 bg-red-950/10'
              }`}
            >
              <div className="mb-2 flex items-start gap-2.5">
                {a.is_correct
                  ? <CheckCircle size={17} className="mt-0.5 shrink-0 text-emerald-400" />
                  : <XCircle    size={17} className="mt-0.5 shrink-0 text-red-400" />}
                <div className="flex-1 min-w-0">
                  <p className="mb-1 text-xs font-medium text-muted">Q{i + 1} · {a.marks_awarded}/{a.marks} marks</p>
                  <p className="text-[15px] sm:text-base font-medium text-white leading-snug">{a.question}</p>
                </div>
              </div>
              <div className="ml-6 space-y-1.5 text-sm sm:text-[15px]">
                <div className="flex gap-2">
                  <span className="shrink-0 text-muted">Your answer:</span>
                  <span className={a.is_correct ? 'text-primary font-medium' : 'text-red-400 font-medium'}>{a.answer || '—'}</span>
                </div>
                {!a.is_correct && (
                  <div className="flex gap-2">
                    <span className="shrink-0 text-muted">Correct:</span>
                    <span className="text-primary font-medium">{a.correct_answer}</span>
                  </div>
                )}
              </div>
              {!a.is_correct && (
                <button
                  onClick={() => {
                    send(`Explain why the correct answer for Q${i + 1} is "${a.correct_answer}". My answer was "${a.answer}".`)
                    setMobileTab('chat')
                  }}
                  disabled={!chatReady || sending}
                  className="ml-6 mt-2.5 flex items-center gap-1.5 rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors disabled:opacity-40"
                >
                  <Sparkles size={11} /> Explain this
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const ChatPanel = (
    <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center px-4">
            <MessageSquare size={32} className="text-muted/30" />
            <p className="text-base font-semibold text-white">Ask the AI anything about your test</p>
            <p className="text-sm text-muted">I know all your questions, answers, and where you went wrong.</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 mt-0.5">
                  <Sparkles size={13} className="text-primary" />
                </div>
              )}
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary text-bg font-medium text-sm sm:text-[15px]'
                  : 'bg-surface border border-border text-white text-[15px] sm:text-base leading-relaxed'
              }`}>
                {msg.role === 'assistant' ? (
                  <div className="ai-md text-[15px] sm:text-base leading-relaxed" dangerouslySetInnerHTML={{
                    __html: marked.parse(msg.content || (msg.streaming ? '…' : ''), { gfm: true }) as string,
                  }} />
                ) : msg.content}
              </div>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Quick chips */}
      {messages.length === 0 && chatReady && (
        <div className="border-t border-border px-4 py-3 shrink-0">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Quick questions</p>
          <div className="flex flex-wrap gap-2">
            {quickChips.map((chip) => (
              <button key={chip} onClick={() => send(chip)} disabled={sending}
                className="rounded-full border border-border/60 bg-surface px-3 py-1.5 text-xs text-muted hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-40">
                {chip}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border p-3 shrink-0">
        {!chatReady && (
          <p className="mb-2 flex items-center gap-1.5 text-[11px] text-muted">
            <Loader2 size={11} className="animate-spin" /> Preparing AI tutor…
          </p>
        )}
        <form onSubmit={(e) => { e.preventDefault(); send() }} className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!chatReady || sending}
            placeholder={chatReady ? 'Ask about any question…' : 'Preparing…'}
            className="flex-1 rounded-xl border-2 border-border bg-surface px-4 py-3 text-base text-white placeholder:text-muted/70 outline-none focus:border-primary transition-colors disabled:opacity-50"
          />
          <button type="submit" disabled={!chatReady || sending || !input.trim()}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-bg transition-all hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </form>
      </div>
    </>
  )

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted">Loading results & preparing AI tutor…</p>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden flex-col md:flex-row">

      {/* ── Mobile tab bar ── */}
      <div className="md:hidden shrink-0 flex border-b border-border">
        <button
          onClick={() => setMobileTab('results')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors border-b-2 ${
            mobileTab === 'results'
              ? 'border-primary text-white'
              : 'border-transparent text-muted'
          }`}
        >
          <CheckCircle size={15} /> Results
        </button>
        <button
          onClick={() => setMobileTab('chat')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors border-b-2 ${
            mobileTab === 'chat'
              ? 'border-primary text-white'
              : 'border-transparent text-muted'
          }`}
        >
          <Bot size={15} /> AI Tutor
          {!chatReady && <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />}
          {chatReady && messages.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
        </button>
      </div>

      {/* ── Mobile: Results tab ── */}
      {mobileTab === 'results' && (
        <div className="md:hidden flex-1 overflow-y-auto">
          {ResultsPanel}
        </div>
      )}

      {/* ── Mobile: Chat tab — fullscreen fixed overlay ── */}
      {mobileTab === 'chat' && (
        <div className="md:hidden fixed inset-x-0 top-0 bottom-16 z-50 flex flex-col bg-bg">
          {/* Tab bar — top */}
          <div className="shrink-0 flex border-b border-border">
            <button
              onClick={() => setMobileTab('results')}
              className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold text-muted transition-colors border-b-2 border-transparent"
            >
              <CheckCircle size={15} /> Results
            </button>
            <button
              className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold border-b-2 border-primary text-white"
            >
              <Bot size={15} /> AI Tutor
            </button>
          </div>
          {/* Chat content fills remaining space */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {ChatPanel}
          </div>
        </div>
      )}

      {/* ── Desktop: Results (left) ── */}
      <div className="hidden md:block flex-1 overflow-y-auto">
        {ResultsPanel}
      </div>

      {/* ── Desktop: AI Chat (right) ── */}
      <div className="hidden md:flex w-[360px] shrink-0 flex-col border-l border-border">
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
            <Bot size={15} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">AI Tutor</p>
            <p className="text-[11px] text-muted">Ask about any question or topic</p>
          </div>
          <div className={`ml-auto h-2 w-2 rounded-full ${chatReady ? 'bg-emerald-400' : 'bg-yellow-400 animate-pulse'}`} />
        </div>
        {ChatPanel}
      </div>

    </div>
  )
}

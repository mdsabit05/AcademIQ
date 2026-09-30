/**
 * ChatHistorySidebar — collapsible left rail showing past AI sessions.
 * Grouped by recency (Today / Yesterday / Last 7 days / Older).
 * Supports pinned/starred sessions (stored in localStorage) and
 * prefetch on hover for instant session loading.
 */

import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, MoreHorizontal, MessageSquare, Star, Pencil, Check, X } from 'lucide-react'
import { clsx } from 'clsx'
import type { ChatSession } from 'shared'

// ── Starred sessions (localStorage) ──────────────────────────────────────────

const STARS_KEY = 'academiq-starred-sessions'

function loadStarred(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(STARS_KEY) ?? '[]') as string[]) }
  catch { return new Set() }
}
function saveStarred(set: Set<string>) {
  localStorage.setItem(STARS_KEY, JSON.stringify([...set]))
}

// ── Grouping helpers ──────────────────────────────────────────────────────────

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function groupSessions(sessions: ChatSession[]) {
  const now = new Date()
  const todayStart     = startOfDay(now)
  const yesterdayStart = todayStart - 86_400_000
  const weekStart      = todayStart - 7 * 86_400_000

  const groups: { label: string; items: ChatSession[] }[] = [
    { label: 'TODAY',       items: [] },
    { label: 'YESTERDAY',   items: [] },
    { label: 'LAST 7 DAYS', items: [] },
    { label: 'OLDER',       items: [] },
  ]

  for (const s of sessions) {
    const t = new Date(s.updated_at).getTime()
    if      (t >= todayStart)     groups[0].items.push(s)
    else if (t >= yesterdayStart) groups[1].items.push(s)
    else if (t >= weekStart)      groups[2].items.push(s)
    else                          groups[3].items.push(s)
  }

  return groups.filter((g) => g.items.length > 0)
}

// ── Session row ───────────────────────────────────────────────────────────────

function SessionRow({
  session,
  isActive,
  starred,
  onSelect,
  onDelete,
  onRename,
  onStar,
  onPrefetch,
}: {
  session: ChatSession
  isActive: boolean
  starred: boolean
  onSelect: () => void
  onDelete: () => void
  onRename?: (newTitle: string) => void
  onStar: () => void
  onPrefetch?: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const title     = session.title ?? session.topic ?? 'Untitled chat'
  const bookTitle = (session.book_titles ?? [])[0] ?? null

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
        setConfirmDelete(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

  const handleStartEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    setEditTitle(title)
    setIsEditing(true)
    setMenuOpen(false)
  }

  const handleSave = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    const trimmed = editTitle.trim()
    if (trimmed && trimmed !== title && onRename) {
      onRename(trimmed)
    }
    setIsEditing(false)
  }

  const handleCancel = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    setEditTitle(title)
    setIsEditing(false)
  }

  return (
    <div
      className={clsx(
        'group relative flex flex-col rounded-lg px-2.5 py-2 cursor-pointer transition-colors select-none',
        isActive
          ? 'bg-primary/10 border border-primary/30'
          : 'hover:bg-white/5 border border-transparent',
      )}
      onClick={isEditing ? undefined : onSelect}
      onMouseEnter={onPrefetch}
    >
      {/* Active left accent */}
      {isActive && (
        <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-primary" />
      )}

      {isEditing ? (
        <div className="flex items-center gap-1.5 w-full py-0.5" onClick={(e) => e.stopPropagation()}>
          <input
            ref={inputRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              else if (e.key === 'Escape') handleCancel()
            }}
            className="flex-1 min-w-0 bg-surface border border-primary/60 rounded px-2 py-0.5 text-xs text-white placeholder:text-muted/50 focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Tab name..."
          />
          <button
            type="button"
            onClick={handleSave}
            title="Save"
            className="p-1 rounded text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors shrink-0"
          >
            <Check size={13} />
          </button>
          <button
            type="button"
            onClick={handleCancel}
            title="Cancel"
            className="p-1 rounded text-muted hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <X size={13} />
          </button>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-1 min-w-0">
          <div className="min-w-0 flex-1 flex items-start gap-1.5">
            {starred && (
              <Star size={10} className="text-yellow-400 shrink-0 mt-0.5 fill-yellow-400" />
            )}
            <div className="min-w-0 flex-1">
              <p className={clsx(
                'text-[12px] font-medium leading-snug truncate',
                isActive ? 'text-primary' : 'text-white',
              )}>
                {title}
              </p>
              {bookTitle && (
                <p className="mt-0.5 text-[10px] text-muted truncate flex items-center gap-1">
                  <MessageSquare size={9} className="shrink-0" />
                  {bookTitle}
                </p>
              )}
            </div>
          </div>

          {/* Menu & Edit — visible on hover */}
          <div
            ref={menuRef}
            className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            {onRename && (
              <button
                onClick={handleStartEdit}
                title="Edit name"
                className="rounded p-0.5 text-muted hover:text-white hover:bg-white/10 transition-colors"
              >
                <Pencil size={11} />
              </button>
            )}
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="rounded p-0.5 text-muted hover:text-white hover:bg-white/10 transition-colors"
            >
              <MoreHorizontal size={13} />
            </button>

            {menuOpen && (
              <div className="absolute right-1 top-7 z-50 w-36 rounded-lg border border-border bg-surface shadow-xl py-1 overflow-hidden">
                {confirmDelete ? (
                  <div className="px-3 py-2">
                    <p className="text-[11px] text-muted mb-2">Delete this chat?</p>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => { setMenuOpen(false); setConfirmDelete(false); onDelete() }}
                        className="flex-1 rounded bg-red-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-700 transition-colors"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="flex-1 rounded border border-border px-2 py-1 text-[11px] text-muted hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {onRename && (
                      <button
                        onClick={handleStartEdit}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted hover:text-white hover:bg-white/5 transition-colors"
                      >
                        <Pencil size={12} /> Rename
                      </button>
                    )}
                    <button
                      onClick={() => { onStar(); setMenuOpen(false) }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Star size={12} className={starred ? 'fill-yellow-400 text-yellow-400' : ''} />
                      {starred ? 'Unpin' : 'Pin to top'}
                    </button>
                    <div className="h-px bg-border/50 mx-2 my-0.5" />
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-950/30 transition-colors"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main sidebar ──────────────────────────────────────────────────────────────

interface Props {
  sessions: ChatSession[]
  activeSessionId: string | null
  onNewChat: () => void
  onSelectSession: (session: ChatSession) => void
  onDeleteSession: (id: string) => void
  onRenameSession?: (id: string, newTitle: string) => void | Promise<void>
  onPrefetch?: (session: ChatSession) => void
}

export default function ChatHistorySidebar({
  sessions,
  activeSessionId,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  onPrefetch,
}: Props) {
  const [starred, setStarred] = useState<Set<string>>(loadStarred)

  const toggleStar = (id: string) => {
    setStarred((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveStarred(next)
      return next
    })
  }

  const starredSessions = sessions.filter((s) => starred.has(s.id))
  const unstarredSessions = sessions.filter((s) => !starred.has(s.id))
  const groups = groupSessions(unstarredSessions)

  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col border-r border-border bg-surface">
      {/* New chat button */}
      <div className="shrink-0 px-3 pt-3 pb-2">
        <button
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-colors"
          style={{ background: '#22D3EE', color: '#0a0f1a' }}
        >
          <Plus size={15} /> New chat
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-3">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center px-4 gap-2">
            <div className="w-10 h-10 rounded-full border border-dashed border-border flex items-center justify-center">
              <MessageSquare size={18} className="text-muted/30" />
            </div>
            <p className="text-xs font-semibold text-white/60">No conversations yet</p>
            <p className="text-[11px] text-muted/40 leading-snug">Start a new chat to begin studying</p>
          </div>
        ) : (
          <>
            {/* Pinned / starred */}
            {starredSessions.length > 0 && (
              <div>
                <p className="px-2.5 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-yellow-400/70 flex items-center gap-1">
                  <Star size={9} className="fill-yellow-400/70 text-yellow-400/70" /> Pinned
                </p>
                <div className="space-y-0.5">
                  {starredSessions.map((s) => (
                    <SessionRow
                      key={s.id}
                      session={s}
                      isActive={s.id === activeSessionId}
                      starred={true}
                      onSelect={() => onSelectSession(s)}
                      onDelete={() => onDeleteSession(s.id)}
                      onRename={onRenameSession ? (newTitle) => onRenameSession(s.id, newTitle) : undefined}
                      onStar={() => toggleStar(s.id)}
                      onPrefetch={onPrefetch ? () => onPrefetch(s) : undefined}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Regular groups */}
            {groups.map((group) => (
              <div key={group.label}>
                <p className="px-2.5 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-muted/60">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((s) => (
                    <SessionRow
                      key={s.id}
                      session={s}
                      isActive={s.id === activeSessionId}
                      starred={false}
                      onSelect={() => onSelectSession(s)}
                      onDelete={() => onDeleteSession(s.id)}
                      onRename={onRenameSession ? (newTitle) => onRenameSession(s.id, newTitle) : undefined}
                      onStar={() => toggleStar(s.id)}
                      onPrefetch={onPrefetch ? () => onPrefetch(s) : undefined}
                    />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

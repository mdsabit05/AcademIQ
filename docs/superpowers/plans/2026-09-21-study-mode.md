# Study Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Study Mode to the AI Tutor page where the user picks a book, syllabus, and starting topic, then enters a focused learn-mode chat session with a collapsible right-side topic panel for switching topics and marking them complete.

**Architecture:** All new state lives in `AskAI.tsx`. The topic panel is extracted to a new `StudyTopicPanel.tsx` component. No backend changes — reuses existing syllabus, session, and chat APIs.

**Tech Stack:** React, TypeScript, Tailwind CSS, existing `makeApi` client, `SyllabusTopic` / `Syllabus` types from `shared`.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `apps/frontend/src/pages/AskAI.tsx` | Modify | Add study mode state, wizard render, top-bar Topics button, panel toggle |
| `apps/frontend/src/components/StudyTopicPanel.tsx` | Create | Right-side topic panel + card popup component |

---

## Task 1: Create `StudyTopicPanel` component (skeleton)

**Files:**
- Create: `apps/frontend/src/components/StudyTopicPanel.tsx`

- [ ] **Step 1: Create the file with props interface and empty render**

```tsx
// apps/frontend/src/components/StudyTopicPanel.tsx
import type { SyllabusTopic } from 'shared'

export interface StudyTopicPanelProps {
  syllabusTitle: string
  topics: SyllabusTopic[]
  activeTopicId: string | null
  onSetActive: (id: string) => void
  onMarkComplete: (topicId: string) => void
  onClose: () => void
}

export default function StudyTopicPanel(_props: StudyTopicPanelProps) {
  return <div>panel</div>
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
apps/frontend/node_modules/.bin/tsc -b apps/frontend/tsconfig.json 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/StudyTopicPanel.tsx
git commit -m "feat(study-mode): scaffold StudyTopicPanel component"
```

---

## Task 2: Add study mode state to `AskAI.tsx`

**Files:**
- Modify: `apps/frontend/src/pages/AskAI.tsx`

- [ ] **Step 1: Add imports at top of AskAI.tsx**

Add to the existing lucide-react import block:
```tsx
BookMarked,
```

Add to the existing `shared` type import:
```tsx
import type { Book, Subject, ChatSession, Syllabus, SyllabusTopic } from 'shared'
```

Add the `StudyTopicPanel` import after the existing component imports:
```tsx
import StudyTopicPanel from '../components/StudyTopicPanel.tsx'
```

- [ ] **Step 2: Add state variables inside `AskAI()` after the existing `bookSheetOpen` state**

```tsx
// Study mode state
const [studyMode, setStudyMode] = useState(false)
const [studyStep, setStudyStep] = useState<1 | 2 | 3>(1)
const [studyBookId, setStudyBookId] = useState<string | null>(null)
const [studySyllabus, setStudySyllabus] = useState<{ id: string; title: string } | null>(null)
const [studyTopics, setStudyTopics] = useState<SyllabusTopic[]>([])
const [studySyllabi, setStudySyllabi] = useState<Syllabus[]>([])
const [activeTopicId, setActiveTopicId] = useState<string | null>(null)
const [topicPanelVisible, setTopicPanelVisible] = useState(false)
const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null)
const [loadingStudy, setLoadingStudy] = useState(false)
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
apps/frontend/node_modules/.bin/tsc -b apps/frontend/tsconfig.json 2>&1
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/pages/AskAI.tsx
git commit -m "feat(study-mode): add study mode state to AskAI"
```

---

## Task 3: Add study mode handler functions to `AskAI.tsx`

**Files:**
- Modify: `apps/frontend/src/pages/AskAI.tsx`

- [ ] **Step 1: Add `enterStudyMode` function after the existing `startNewChat` function**

```tsx
async function enterStudyMode() {
  setStudyMode(true)
  setStudyStep(1)
  setStudyBookId(null)
  setStudySyllabus(null)
  setStudyTopics([])
  setActiveTopicId(null)
  setTopicPanelVisible(false)
  // Load syllabi for step 2
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
  setExpandedTopicId(null)
}
```

- [ ] **Step 2: Add `loadStudyTopics` function**

```tsx
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
```

- [ ] **Step 3: Add `startStudySession` function**

```tsx
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
    setMessages([])
    setStreamBuffer('')
  } finally {
    setLoadingStudy(false)
  }
}
```

- [ ] **Step 4: Add `handleMarkComplete` function**

```tsx
async function handleMarkComplete(topicId: string) {
  if (!studySyllabus) return
  // Optimistic update
  setStudyTopics((prev) =>
    prev.map((t) => (t.id === topicId ? { ...t, completed: true } : t))
  )
  setExpandedTopicId(null)
  const token = await getToken()
  if (!token) return
  await makeApi(token).syllabus.updateTopic(studySyllabus.id, topicId, true)
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
apps/frontend/node_modules/.bin/tsc -b apps/frontend/tsconfig.json 2>&1
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/pages/AskAI.tsx
git commit -m "feat(study-mode): add study mode handler functions"
```

---

## Task 4: Add "Study Mode" button to the selection screen

**Files:**
- Modify: `apps/frontend/src/pages/AskAI.tsx`

- [ ] **Step 1: Find the desktop toolbar in the selection mode render**

Locate this block (around line 426 in selection mode):
```tsx
<div className="hidden md:flex items-center gap-2 flex-wrap">
  <button onClick={() => setHistoryVisible((v) => !v)}
```

- [ ] **Step 2: Add "Study Mode" button to desktop toolbar**

After the history toggle button and before the `<span>Study Materials</span>`, add:
```tsx
<div className="w-px h-4 bg-border" />
<button
  onClick={enterStudyMode}
  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
  style={{ background: 'rgba(34,211,238,0.1)', color: '#22D3EE', border: '1px solid rgba(34,211,238,0.25)' }}
>
  <BookMarked size={13} /> Study Mode
</button>
```

- [ ] **Step 3: Add "Study Mode" button to mobile selection screen**

Find the mobile section that renders quick action cards. Add a Study Mode button above or below the quick actions:
```tsx
<button
  onClick={enterStudyMode}
  className="flex items-center justify-center gap-2 w-full rounded-xl px-4 py-3 text-sm font-bold mb-3"
  style={{ background: 'rgba(34,211,238,0.1)', color: '#22D3EE', border: '1px solid rgba(34,211,238,0.25)' }}
>
  <BookMarked size={15} /> Study Mode
</button>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
apps/frontend/node_modules/.bin/tsc -b apps/frontend/tsconfig.json 2>&1
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/pages/AskAI.tsx
git commit -m "feat(study-mode): add Study Mode entry button to selection screen"
```

---

## Task 5: Render the 3-step setup wizard

**Files:**
- Modify: `apps/frontend/src/pages/AskAI.tsx`

- [ ] **Step 1: Add wizard render block**

In the selection mode return (`// ── SELECTION MODE`), wrap the existing content so that when `studyMode === true` the wizard renders instead. Replace the inner `<div className="flex flex-col flex-1 overflow-hidden min-w-0">` content with a conditional:

```tsx
{studyMode ? (
  <div className="flex flex-col flex-1 overflow-hidden min-w-0">
    {/* Study Mode Wizard */}
    <div className="shrink-0 border-b border-border px-4 lg:px-5 py-2.5 flex items-center gap-3">
      <BookMarked size={15} className="text-primary" />
      <span className="text-sm font-semibold text-white">Study Mode</span>
      <span className="text-xs text-muted">
        — Step {studyStep} of 3: {studyStep === 1 ? 'Pick a Book' : studyStep === 2 ? 'Pick a Syllabus' : 'Pick a Topic'}
      </span>
      <button onClick={exitStudyMode} className="ml-auto text-xs text-muted hover:text-white transition-colors">
        Exit Study Mode
      </button>
    </div>

    <div className="flex-1 overflow-y-auto p-4 lg:p-6">
      {/* Step 1: Pick a Book */}
      {studyStep === 1 && (
        <div className="space-y-4 max-w-3xl mx-auto">
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
          <div className="flex justify-end pt-2">
            <button
              onClick={() => setStudyStep(2)}
              disabled={!studyBookId}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-bg bg-primary hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Pick a Syllabus */}
      {studyStep === 2 && (
        <div className="space-y-4 max-w-3xl mx-auto">
          <p className="text-sm text-muted">Choose a syllabus to guide your study session.</p>
          {studySyllabi.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-8 text-center">
              <p className="text-sm text-white font-medium">No syllabi found</p>
              <p className="text-xs text-muted mt-1">Upload a syllabus from the Syllabus page first.</p>
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              {studySyllabi.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStudySyllabus({ id: s.id, title: s.title })}
                  className={`text-left rounded-xl border p-4 transition-colors ${
                    studySyllabus?.id === s.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-surface hover:border-primary/40'
                  }`}
                >
                  <p className="text-sm font-semibold text-white">{s.title}</p>
                  <p className="text-xs text-muted mt-0.5">{new Date(s.created_at).toLocaleDateString()}</p>
                </button>
              ))}
            </div>
          )}
          <div className="flex justify-between pt-2">
            <button onClick={() => setStudyStep(1)} className="text-xs text-muted hover:text-white transition-colors">
              ← Back
            </button>
            <button
              onClick={async () => {
                if (!studySyllabus) return
                await loadStudyTopics(studySyllabus.id)
                setStudyStep(3)
              }}
              disabled={!studySyllabus}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-bg bg-primary hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Pick a Topic */}
      {studyStep === 3 && (
        <div className="space-y-4 max-w-3xl mx-auto">
          <p className="text-sm text-muted">Select the topic you want to start with.</p>
          {loadingStudy ? (
            <div className="text-sm text-muted animate-pulse">Loading topics…</div>
          ) : (
            <div className="space-y-4">
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
          <div className="flex justify-between pt-2">
            <button onClick={() => setStudyStep(2)} className="text-xs text-muted hover:text-white transition-colors">
              ← Back
            </button>
            <button
              onClick={startStudySession}
              disabled={!activeTopicId || loadingStudy}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-bg bg-primary hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loadingStudy ? 'Starting…' : 'Start Studying →'}
            </button>
          </div>
        </div>
      )}
    </div>
  </div>
) : (
  /* existing selection mode content goes here — the full <div className="flex flex-col flex-1 ..."> */
  ...existing...
)}
```

> **Note for implementer:** The `...existing...` placeholder above means wrap the existing `<div className="flex flex-col flex-1 overflow-hidden min-w-0">` element (and all its children — toolbar, book grid, quick actions, how-it-works, mobile tabs, input) inside the `else` branch of this conditional. Do not delete any existing code — just nest it.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
apps/frontend/node_modules/.bin/tsc -b apps/frontend/tsconfig.json 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/pages/AskAI.tsx
git commit -m "feat(study-mode): add 3-step setup wizard to AskAI"
```

---

## Task 6: Add "Topics" toggle button to chat mode top bar

**Files:**
- Modify: `apps/frontend/src/pages/AskAI.tsx`

- [ ] **Step 1: Find the chat mode top bar**

Locate the `isChatMode` render block top bar (around line 322):
```tsx
<div className="shrink-0 flex items-center gap-3 px-4 lg:px-5 py-2.5 border-b border-border">
```

- [ ] **Step 2: Add Topics toggle button before the Clear button**

In the chat top bar, before `<button onClick={clearSelection}...>`, add:
```tsx
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
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
apps/frontend/node_modules/.bin/tsc -b apps/frontend/tsconfig.json 2>&1
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/pages/AskAI.tsx
git commit -m "feat(study-mode): add Topics toggle button to chat top bar"
```

---

## Task 7: Implement `StudyTopicPanel` component fully

**Files:**
- Modify: `apps/frontend/src/components/StudyTopicPanel.tsx`

- [ ] **Step 1: Replace skeleton with full implementation**

```tsx
// apps/frontend/src/components/StudyTopicPanel.tsx
import { useState } from 'react'
import { X, CheckCircle, BookOpen } from 'lucide-react'
import type { SyllabusTopic } from 'shared'

export interface StudyTopicPanelProps {
  syllabusTitle: string
  topics: SyllabusTopic[]
  activeTopicId: string | null
  onSetActive: (id: string) => void
  onMarkComplete: (topicId: string) => void
  onClose: () => void
}

export default function StudyTopicPanel({
  syllabusTitle,
  topics,
  activeTopicId,
  onSetActive,
  onMarkComplete,
  onClose,
}: StudyTopicPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const units = Array.from(new Set(topics.map((t) => t.unit ?? 'General')))

  return (
    <div className="w-64 shrink-0 flex flex-col border-l border-border bg-surface overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen size={13} className="text-primary shrink-0" />
          <p className="text-xs font-semibold text-white truncate">{syllabusTitle}</p>
        </div>
        <button onClick={onClose} className="text-muted hover:text-white transition-colors ml-2 shrink-0">
          <X size={14} />
        </button>
      </div>

      {/* Topic list */}
      <div className="flex-1 overflow-y-auto py-2">
        {units.map((unit) => (
          <div key={unit} className="mb-3">
            <p className="px-3 text-[10px] font-black uppercase tracking-widest text-muted/60 mb-1">{unit}</p>
            {topics
              .filter((t) => (t.unit ?? 'General') === unit)
              .map((topic) => {
                const isActive = topic.id === activeTopicId
                const isExpanded = topic.id === expandedId

                return (
                  <div key={topic.id}>
                    {/* Compact card */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : topic.id)}
                      className={`w-full text-left flex items-center gap-2 px-3 py-1.5 transition-colors hover:bg-white/[0.04] ${
                        isActive ? 'bg-primary/8' : ''
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                        topic.completed
                          ? 'bg-emerald-500 border-emerald-500'
                          : isActive
                            ? 'border-primary'
                            : 'border-border'
                      }`}>
                        {topic.completed && <CheckCircle size={9} className="text-white" />}
                      </span>
                      <span className={`flex-1 text-xs leading-snug truncate ${
                        topic.completed ? 'text-muted/50 line-through' : isActive ? 'text-primary font-medium' : 'text-white'
                      }`}>
                        {topic.topic}
                      </span>
                    </button>

                    {/* Expanded popup */}
                    {isExpanded && (
                      <div className="mx-2 mb-2 rounded-xl border border-border bg-bg p-3 shadow-lg">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm font-semibold text-white leading-snug">{topic.topic}</p>
                          <button onClick={() => setExpandedId(null)} className="text-muted hover:text-white shrink-0">
                            <X size={12} />
                          </button>
                        </div>
                        {topic.unit && (
                          <p className="text-xs text-muted mb-2">{topic.unit}</p>
                        )}
                        {topic.subtopic && (
                          <p className="text-xs text-muted/70 mb-3 leading-relaxed">{topic.subtopic}</p>
                        )}
                        <div className="flex flex-col gap-1.5">
                          {!isActive && (
                            <button
                              onClick={() => { onSetActive(topic.id); setExpandedId(null) }}
                              className="w-full rounded-lg py-1.5 text-xs font-semibold transition-colors"
                              style={{ background: 'rgba(34,211,238,0.1)', color: '#22D3EE', border: '1px solid rgba(34,211,238,0.25)' }}
                            >
                              Study This Topic
                            </button>
                          )}
                          {!topic.completed && (
                            <button
                              onClick={() => onMarkComplete(topic.id)}
                              className="w-full rounded-lg py-1.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/20 transition-colors"
                            >
                              ✓ Mark Complete
                            </button>
                          )}
                          {topic.completed && (
                            <p className="text-xs text-emerald-400 text-center">✓ Completed</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        ))}
      </div>

      {/* Footer: progress */}
      <div className="shrink-0 border-t border-border px-3 py-2">
        <p className="text-xs text-muted">
          {topics.filter((t) => t.completed).length} / {topics.length} completed
        </p>
        <div className="mt-1.5 h-1 rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${topics.length > 0 ? (topics.filter((t) => t.completed).length / topics.length) * 100 : 0}%` }}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
apps/frontend/node_modules/.bin/tsc -b apps/frontend/tsconfig.json 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/StudyTopicPanel.tsx
git commit -m "feat(study-mode): implement StudyTopicPanel component with popup and progress"
```

---

## Task 8: Wire `StudyTopicPanel` into the chat view

**Files:**
- Modify: `apps/frontend/src/pages/AskAI.tsx`

- [ ] **Step 1: Find the chat mode render block**

Locate:
```tsx
if (isChatMode) {
  return (
    <div className="flex h-full overflow-hidden">
      {historyVisible && <div className="hidden md:flex">{sidebar}</div>}
      <div className="flex flex-col flex-1 overflow-hidden">
```

- [ ] **Step 2: Add the topic panel alongside the chat area**

Change the outer flex container to also render the panel on the right when visible. The panel should come *after* the main chat column:

```tsx
if (isChatMode) {
  return (
    <div className="flex h-full overflow-hidden">
      {historyVisible && <div className="hidden md:flex">{sidebar}</div>}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* ... existing top bar, messages, input unchanged ... */}
      </div>
      {/* Right topic panel — study mode only */}
      {studyMode && topicPanelVisible && studySyllabus && (
        <div className="hidden md:flex">
          <StudyTopicPanel
            syllabusTitle={studySyllabus.title}
            topics={studyTopics}
            activeTopicId={activeTopicId}
            onSetActive={setActiveTopicId}
            onMarkComplete={handleMarkComplete}
            onClose={() => setTopicPanelVisible(false)}
          />
        </div>
      )}
    </div>
  )
}
```

> **Note:** The existing chat column content (top bar, messages div, input div) is unchanged — only wrap it and add the panel sibling.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
apps/frontend/node_modules/.bin/tsc -b apps/frontend/tsconfig.json 2>&1
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/pages/AskAI.tsx
git commit -m "feat(study-mode): wire StudyTopicPanel into chat view"
```

---

## Task 9: Handle "Back" from chat returning to study wizard

**Files:**
- Modify: `apps/frontend/src/pages/AskAI.tsx`

- [ ] **Step 1: Find the `backToSelection` function**

Find the existing function:
```tsx
function backToSelection() {
  setMessages([]); setStreamBuffer(''); setSessionId(null)
}
```

- [ ] **Step 2: Update it to restore study wizard when in study mode**

```tsx
function backToSelection() {
  setMessages([])
  setStreamBuffer('')
  setSessionId(null)
  if (studyMode) {
    // Return to topic picker (step 3) with selections intact
    setStudyStep(3)
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
apps/frontend/node_modules/.bin/tsc -b apps/frontend/tsconfig.json 2>&1
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/pages/AskAI.tsx
git commit -m "feat(study-mode): back button returns to topic picker in study mode"
```

---

## Task 10: Final TypeScript build check and tidy

**Files:**
- Modify: `apps/frontend/src/pages/AskAI.tsx` (remove any unused imports if needed)

- [ ] **Step 1: Run the full strict build**

```bash
apps/frontend/node_modules/.bin/tsc -b apps/frontend/tsconfig.json 2>&1
```

Expected: no errors.

- [ ] **Step 2: Spot-check the browser manually**

1. Go to `/tutor` — confirm "Study Mode" button appears in toolbar
2. Click it — wizard appears, Step 1 shows book cards
3. Select a book → Next → Step 2 shows syllabi
4. Select a syllabus → Next → Step 3 shows topics grouped by unit
5. Select a topic → "Start Studying" → enters chat mode
6. Click "Topics" button in top bar → right panel slides in
7. Click a topic card → popup expands with "Study This Topic" and "Mark Complete"
8. Click "Mark Complete" → tick appears, progress bar updates
9. Click "Back" in chat → returns to Step 3 with topic still selected
10. Click "Exit Study Mode" → returns to normal selection screen

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(study-mode): complete Study Mode implementation in AI Tutor"
```

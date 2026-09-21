# Study Mode — AI Tutor Page
**Date:** 2026-09-21
**Status:** Approved

---

## Overview

A focused study mode within the existing AI Tutor (AskAI) page. The user selects a document and syllabus, picks a starting topic, then enters a `learn`-mode chat session. A collapsible right-side topic panel shows all syllabus topics as cards; clicking a card expands a popup where the user can mark it complete (synced to the syllabus) or switch to studying it.

No backend changes are required — all APIs already exist.

---

## Entry Point

A **"Study Mode"** button appears on the AskAI selection screen (in the desktop toolbar alongside the history toggle, and as a prominent button on mobile). Clicking it sets `studyMode: true` and shows the 3-step setup wizard inline, replacing the normal selection view.

An **"Exit Study Mode"** link returns to the normal selection screen.

---

## Setup Wizard (3 Steps)

### Step 1 — Pick a Book
- Reuses the existing book card grid (single-select, not multi)
- Same filtering (subject, search) as the normal selection screen
- "Next →" button becomes active once a book is selected

### Step 2 — Pick a Syllabus
- Calls `GET /syllabus` to list all user syllabi with `status === 'ready'`
- Each syllabus shown as a card: title + topic count
- "Next →" active once a syllabus is selected
- "← Back" returns to Step 1

### Step 3 — Pick a Starting Topic
- Calls `GET /syllabus/:id` to load full topic list
- Topics grouped by `unit` (null-unit topics shown under "General")
- Completed topics shown with a green tick and reduced opacity
- User clicks a topic to highlight it as the active starting topic
- **"Start Studying"** button creates the session and enters chat mode
- "← Back" returns to Step 2

---

## Chat View Additions

### Top Bar
- Existing: Hide/History toggle (left), Back, source indicator, Clear (right)
- New: **"Topics"** toggle button (right side, before Clear) with a `BookMarked` icon
  - Shows count badge of incomplete topics remaining
  - Clicking toggles `topicPanelVisible`

### Right Topic Panel (hidden by default)
- Width: ~260px, slides in from the right
- Header: syllabus title + close button
- Body: topic cards grouped by unit label
- Each card (compact, one line):
  - Topic name
  - Green tick if `completed === true`
  - Primary-colored border/glow if it is the `activeTopicId`
- Scrollable when topics exceed panel height
- Panel sits alongside chat content (chat area shrinks, does not overlap)

### Topic Card Popup
Clicking any topic card opens a popup (positioned over the panel):
- Topic name (larger, bold)
- Unit label (muted)
- Subtopics listed if `subtopic` field is populated
- **"Study This Topic"** button — sets `activeTopicId` in local state only (no API, no new session)
- **"Mark Complete"** button — calls `PATCH /syllabus/:sid/topics/:tid` with `{ completed: true }`, updates `studyTopics` locally for instant feedback, shows green tick on the card
- Close button (×) dismisses the popup

---

## State (all in AskAI.tsx)

| State | Type | Purpose |
|---|---|---|
| `studyMode` | `boolean` | Whether user is in study mode setup |
| `studyStep` | `1 \| 2 \| 3` | Active setup wizard step |
| `studyBookId` | `string \| null` | Selected book ID |
| `studySyllabus` | `{ id: string; title: string } \| null` | Selected syllabus |
| `studyTopics` | `SyllabusTopic[]` | Topics loaded from syllabus |
| `activeTopicId` | `string \| null` | Currently highlighted topic |
| `topicPanelVisible` | `boolean` | Right panel open/closed |
| `expandedTopicId` | `string \| null` | Which card popup is open |

---

## Data Flow

1. **Setup**: User completes 3 steps → `api.sessions.create({ mode: 'learn', bookIds: [studyBookId], topic: activeTopic.topic })` → enters chat mode (sets `sessionId`, `isChatMode = true`)
2. **Mark Complete**: `api.syllabus.updateTopic(syllabusId, topicId, true)` → update `studyTopics` in local state (no refetch needed)
3. **Switch Topic**: `setActiveTopicId(newId)` → local state only, no API call, no new session
4. **Exit chat**: "Back" button → returns to study mode Step 3 (topic picker), keeping syllabus/book selections intact

---

## Existing APIs Used (no backend changes)

| Action | API |
|---|---|
| List syllabi | `GET /syllabus` |
| Load topics | `GET /syllabus/:id` |
| Mark topic complete | `PATCH /syllabus/:id/topics/:topicId` |
| Create session | `POST /sessions` with `mode: 'learn'` |
| Send message | existing chat message endpoint |

---

## What This Is NOT

- No new session per topic switch — same session throughout
- No AI enforcement of topic focus — AI follows natural conversation
- No new backend routes
- No new pages or routes — everything lives inside `AskAI.tsx` and a new small `StudyTopicPanel` component extracted to keep the file manageable

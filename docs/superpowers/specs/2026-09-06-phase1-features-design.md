# Phase 1 Features Design — Note2Test
**Date:** 2026-09-06
**Scope:** Dashboard Map View, Theme Toggle, Onboarding, Voice Input

---

## 1. Dashboard Map View

### Goal
Replace the current 2-column layout with a document-centric grid. Each document becomes a card showing mastery level, making it easy to see at a glance what's been studied and what needs work.

### Layout
- Greeting row stays at top (unchanged)
- Quick-action row stays (Learn / Ask AI / Take Test)
- Below: grid of Document Cards (2 cols on mobile, 3 on desktop)
- Empty state: prompt to upload first PDF

### Document Card
Each card shows:
- Document title
- Mastery % ring — calculated as average score across all test attempts on that document
- Mastery color: green (≥70%), amber (40–69%), red (<40%), gray (no tests yet)
- Last activity date (most recent test attempt or upload date)
- Click → opens an action popover with 3 buttons: **Learn**, **Ask AI**, **Take Test** (each links to respective page with documentId pre-filled)

### Data
- `GET /api/documents` — list of documents (already exists)
- `GET /api/test/attempts` — attempts with `document_title` (already exists)
- Mastery calculated client-side: group attempts by `test_id`, join to document via `document_title`, average score%
- No new backend endpoints needed

---

## 2. Theme Toggle (Dark / Light)

### Goal
Allow users to switch between the existing dark Midnight Indigo theme and a new light theme. Preference persists across sessions.

### Architecture
- `ThemeContext` (React context) wraps the entire app in `main.tsx`
- Theme stored in `localStorage` under key `note2test_theme` (`"dark"` | `"light"`)
- On mount: read localStorage → apply `class="dark"` or `class="light"` to `<html>`
- Tailwind `darkMode: 'class'` strategy used for conditional styles

### Light Theme
Light theme overrides CSS variables defined in `index.css`:
- Background: `#f4f5f7`
- Surface: `#ffffff`
- Border: `#e2e4e9`
- Text: `#111827`
- Muted: `#6b7280`
- Primary: unchanged (`#6366f1` indigo)

### Toggle Button
- Lives in sidebar, just above the Sign Out button
- Icon: `Sun` (light mode active) / `Moon` (dark mode active) from lucide-react
- Clicking toggles theme and saves to localStorage

---

## 3. Onboarding Welcome Screen

### Goal
First-time users see a full-screen welcome modal explaining what Note2Test does. Shown only once, never again after dismissed.

### Trigger
- Detected via `localStorage` key `note2test_onboarded`
- If key is absent → show modal on Dashboard load
- On dismiss → set key to `"true"`

### Modal Content
Full-screen overlay (dark semi-transparent backdrop). Centered card with:
- App logo + "Welcome to Note2Test" heading
- Subheading: "Your AI-powered study partner"
- 4 feature cards in a 2×2 grid:
  1. **Upload Materials** — "Drop in your PDFs and notes"
  2. **Learn with AI** — "Get instant explanations on any topic"
  3. **Auto-Generated Tests** — "MCQ, short answer, long answer — all from your material"
  4. **Track Progress** — "See your scores, weak areas, and improvement over time"
- Single CTA button: "Get Started →"
- No skip button — user must click Get Started

### Component
`OnboardingModal.tsx` — standalone component, rendered conditionally in `Dashboard.tsx`

---

## 4. Voice Input for Ask AI

### Goal
Users can speak their question into the Ask AI page. Live transcript appears in the input box as they speak. They can edit before sending.

### Technology
- **Web Speech API** (`window.SpeechRecognition` / `window.webkitSpeechRecognition`)
- Browser built-in — zero new dependencies
- Works in Chrome, Edge; gracefully hidden in unsupported browsers

### UX Flow
1. Mic button appears next to the send button in AskAI input area
2. Hidden if `SpeechRecognition` not supported in browser
3. Click mic → recording starts, button turns red with pulsing animation
4. Live transcript (`event.resultIndex` interim results) streams into the input field
5. Click mic again → recording stops; final transcript stays in input box
6. User edits if needed, then clicks send as normal
7. Auto-stops after 10 seconds of silence (browser default behaviour)

### Implementation
- Custom hook `useVoiceInput(onTranscript: (text: string) => void)` in `src/lib/voice.ts`
- Returns: `{ listening, supported, toggle }`
- AskAI page: imports hook, passes setter for `inputText` state as `onTranscript`
- Mic button: `Mic` / `MicOff` icons from lucide-react

---

## Implementation Order

1. **Onboarding** — pure frontend, no dependencies, fastest to ship
2. **Theme toggle** — CSS + context, affects whole app
3. **Voice input** — isolated hook + minor AskAI changes
4. **Dashboard Map View** — most complex UI, builds on existing APIs

---

## Files Changed

| File | Change |
|---|---|
| `src/main.tsx` | Wrap app in `ThemeContext` |
| `src/lib/theme.ts` | ThemeContext + useTheme hook |
| `src/lib/voice.ts` | useVoiceInput hook |
| `src/index.css` | Light theme CSS variable overrides |
| `src/components/Sidebar.tsx` | Add theme toggle button |
| `src/components/OnboardingModal.tsx` | New component |
| `src/pages/Dashboard.tsx` | Map View layout + OnboardingModal |
| `src/pages/AskAI.tsx` | Add mic button + useVoiceInput |

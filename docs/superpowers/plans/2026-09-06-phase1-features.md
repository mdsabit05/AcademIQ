# Phase 1 Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four frontend features to Note2Test — Onboarding Modal, Dark/Light Theme Toggle, Voice Input on Ask AI, and Dashboard Map View.

**Architecture:** All four features are frontend-only except one minor backend query change (add `document_id` to the attempts response). Theme uses CSS custom properties toggled via an `html.light` class. Voice uses the browser's built-in Web Speech API. Dashboard Map View replaces the existing 2-column layout with document cards showing mastery rings computed client-side from existing API data.

**Tech Stack:** React 18, Tailwind CSS v3, Lucide React icons, Web Speech API (browser built-in), Vitest + @testing-library/react for tests.

---

## File Map

| Action | File |
|---|---|
| Create | `apps/frontend/src/components/OnboardingModal.tsx` |
| Create | `apps/frontend/src/lib/theme.ts` |
| Create | `apps/frontend/src/lib/theme.test.ts` |
| Create | `apps/frontend/src/lib/voice.ts` |
| Create | `apps/frontend/src/lib/voice.test.ts` |
| Create | `apps/frontend/src/lib/mastery.ts` |
| Create | `apps/frontend/src/lib/mastery.test.ts` |
| Modify | `apps/frontend/src/index.css` |
| Modify | `apps/frontend/tailwind.config.ts` |
| Modify | `apps/frontend/src/main.tsx` |
| Modify | `apps/frontend/src/components/layout/Sidebar.tsx` |
| Modify | `apps/frontend/src/pages/Dashboard.tsx` |
| Modify | `apps/frontend/src/pages/AskAI.tsx` |
| Modify | `apps/frontend/src/pages/Learn.tsx` |
| Modify | `apps/frontend/src/pages/TestNew.tsx` |
| Modify | `apps/backend/src/routes/test.ts` |
| Modify | `apps/frontend/src/lib/api.ts` |

---

## Task 1: Onboarding Modal

**Files:**
- Create: `apps/frontend/src/components/OnboardingModal.tsx`
- Modify: `apps/frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Create OnboardingModal component**

Create `apps/frontend/src/components/OnboardingModal.tsx`:

```typescript
import { BookOpen, MessageSquare, FileText, BarChart2 } from 'lucide-react'

interface Props {
  onDismiss: () => void
}

const FEATURES = [
  {
    icon: FileText,
    colorClass: 'text-cyan-DEFAULT bg-cyan-muted',
    title: 'Upload Materials',
    desc: 'Drop in your PDFs and notes — we handle the rest',
  },
  {
    icon: BookOpen,
    colorClass: 'text-primary bg-primary-muted',
    title: 'Learn with AI',
    desc: 'Get instant, in-depth explanations on any topic',
  },
  {
    icon: MessageSquare,
    colorClass: 'text-amber-DEFAULT bg-amber-muted',
    title: 'Ask Anything',
    desc: 'Chat with an AI tutor trained on your own material',
  },
  {
    icon: BarChart2,
    colorClass: 'text-success bg-success/10',
    title: 'Auto-Generated Tests',
    desc: 'MCQ, short and long answer tests — scored instantly',
  },
]

export default function OnboardingModal({ onDismiss }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-2xl border border-border bg-surface p-8">
        <div className="mb-6 text-center">
          <div className="mb-3 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 text-xl font-black text-primary">
              N2
            </div>
          </div>
          <h1 className="text-xl font-bold text-white">Welcome to Note2Test</h1>
          <p className="mt-1 text-sm text-muted">Your AI-powered study partner</p>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-3">
          {FEATURES.map(({ icon: Icon, colorClass, title, desc }) => (
            <div key={title} className="rounded-xl border border-border bg-bg p-4">
              <div className={`mb-2 inline-flex rounded-lg p-2 ${colorClass}`}>
                <Icon size={16} />
              </div>
              <p className="text-sm font-semibold text-white">{title}</p>
              <p className="mt-0.5 text-xs text-muted">{desc}</p>
            </div>
          ))}
        </div>

        <button
          onClick={onDismiss}
          className="w-full rounded-xl bg-primary py-3 font-semibold text-white hover:bg-primary-hover"
        >
          Get Started →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add onboarding logic to Dashboard**

In `apps/frontend/src/pages/Dashboard.tsx`, add these imports at the top:

```typescript
import { useState } from 'react'  // add useState if not already imported (it's already there via useEffect)
import OnboardingModal from '../components/OnboardingModal.tsx'
```

Add state and dismiss handler inside the `Dashboard` component (before the `useEffect`):

```typescript
const [showOnboarding, setShowOnboarding] = useState(
  () => !localStorage.getItem('note2test_onboarded')
)

function dismissOnboarding() {
  localStorage.setItem('note2test_onboarded', 'true')
  setShowOnboarding(false)
}
```

Add the modal at the top of the returned JSX (before the outer `<div className="p-8">`):

```typescript
return (
  <>
    {showOnboarding && <OnboardingModal onDismiss={dismissOnboarding} />}
    <div className="p-8">
      {/* ... rest of existing JSX unchanged ... */}
    </div>
  </>
)
```

- [ ] **Step 3: Manual test**

Run the frontend (`cd apps/frontend && pnpm dev` or the root dev script), navigate to `/dashboard` in an incognito window (or clear localStorage). Verify the modal appears. Click "Get Started →" — verify it disappears and does not reappear on refresh.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/OnboardingModal.tsx apps/frontend/src/pages/Dashboard.tsx
git commit -m "feat: onboarding welcome modal on first dashboard visit"
```

---

## Task 2: CSS Variables for Theming

**Files:**
- Modify: `apps/frontend/src/index.css`
- Modify: `apps/frontend/tailwind.config.ts`

- [ ] **Step 1: Replace hardcoded colors in index.css with CSS custom properties**

Replace the full content of `apps/frontend/src/index.css` with:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

/* Theme tokens — space-separated RGB for Tailwind alpha support */
:root {
  --color-bg: 10 10 15;
  --color-surface: 19 19 31;
  --color-border: 45 45 61;
  --color-muted: 148 163 184;
  --color-subtle: 71 85 105;
  --color-fg: 248 250 252;
}

html.light {
  --color-bg: 248 250 252;
  --color-surface: 255 255 255;
  --color-border: 226 232 240;
  --color-muted: 100 116 139;
  --color-subtle: 100 116 139;
  --color-fg: 17 24 39;
}

@layer base {
  * {
    border-color: rgb(var(--color-border));
  }

  body {
    background-color: rgb(var(--color-bg));
    color: rgb(var(--color-fg));
    font-family: 'Inter', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  /* Make text-white theme-aware in light mode */
  html.light .text-white {
    color: rgb(var(--color-fg)) !important;
  }

  ::-webkit-scrollbar {
    width: 6px;
  }
  ::-webkit-scrollbar-track {
    background: rgb(var(--color-bg));
  }
  ::-webkit-scrollbar-thumb {
    background: rgb(var(--color-border));
    border-radius: 3px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #6366F1;
  }
}

@layer utilities {
  .glass {
    background: rgba(19, 19, 31, 0.8);
    backdrop-filter: blur(12px);
    border: 1px solid rgb(var(--color-border));
  }
}
```

- [ ] **Step 2: Update tailwind.config.ts to use CSS variables**

Replace `apps/frontend/tailwind.config.ts` with:

```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        subtle: 'rgb(var(--color-subtle) / <alpha-value>)',
        primary: {
          DEFAULT: '#6366F1',
          hover: '#4F46E5',
          muted: 'rgba(99,102,241,0.15)',
        },
        cyan: {
          DEFAULT: '#22D3EE',
          muted: 'rgba(34,211,238,0.15)',
        },
        amber: {
          DEFAULT: '#FBBF24',
          muted: 'rgba(251,191,36,0.15)',
        },
        success: '#22C55E',
        danger: '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
} satisfies Config
```

- [ ] **Step 3: Manual verify dark mode unchanged**

Run frontend, navigate to dashboard. Everything should look exactly the same as before (dark theme is default via `:root` vars).

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/index.css apps/frontend/tailwind.config.ts
git commit -m "feat: replace hardcoded theme colors with CSS custom properties"
```

---

## Task 3: ThemeContext + Provider

**Files:**
- Create: `apps/frontend/src/lib/theme.ts`
- Create: `apps/frontend/src/lib/theme.test.ts`
- Modify: `apps/frontend/src/main.tsx`

- [ ] **Step 1: Write failing tests**

Create `apps/frontend/src/lib/theme.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { ThemeProvider, useTheme } from './theme.ts'

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('light')
  })

  it('defaults to dark when no localStorage key', () => {
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider })
    expect(result.current.theme).toBe('dark')
  })

  it('reads initial theme from localStorage', () => {
    localStorage.setItem('note2test_theme', 'light')
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider })
    expect(result.current.theme).toBe('light')
  })

  it('toggle switches dark → light', () => {
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider })
    act(() => result.current.toggle())
    expect(result.current.theme).toBe('light')
  })

  it('toggle switches light → dark', () => {
    localStorage.setItem('note2test_theme', 'light')
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider })
    act(() => result.current.toggle())
    expect(result.current.theme).toBe('dark')
  })

  it('persists theme to localStorage on toggle', () => {
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider })
    act(() => result.current.toggle())
    expect(localStorage.getItem('note2test_theme')).toBe('light')
  })

  it('applies light class to <html> when light', () => {
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider })
    act(() => result.current.toggle())
    expect(document.documentElement.classList.contains('light')).toBe(true)
  })

  it('removes light class from <html> when toggled back to dark', () => {
    localStorage.setItem('note2test_theme', 'light')
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider })
    act(() => result.current.toggle())
    expect(document.documentElement.classList.contains('light')).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd apps/frontend && pnpm vitest run src/lib/theme.test.ts
```

Expected: `Error: Cannot find module './theme.ts'`

- [ ] **Step 3: Implement ThemeContext**

Create `apps/frontend/src/lib/theme.ts`:

```typescript
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'dark', toggle: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('note2test_theme') as Theme) ?? 'dark',
  )

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
    localStorage.setItem('note2test_theme', theme)
  }, [theme])

  function toggle() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
cd apps/frontend && pnpm vitest run src/lib/theme.test.ts
```

Expected: 7 tests pass.

- [ ] **Step 5: Wrap app in ThemeProvider**

In `apps/frontend/src/main.tsx`, add the import and wrap the render tree:

```typescript
import { ThemeProvider } from './lib/theme.ts'
```

Change the `createRoot(...).render(...)` call to:

```typescript
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ErrorBoundary>
        <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ClerkProvider>
      </ErrorBoundary>
    </ThemeProvider>
  </StrictMode>,
)
```

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/lib/theme.ts apps/frontend/src/lib/theme.test.ts apps/frontend/src/main.tsx
git commit -m "feat: ThemeContext with dark/light toggle and localStorage persistence"
```

---

## Task 4: Theme Toggle Button in Sidebar

**Files:**
- Modify: `apps/frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add toggle button to Sidebar**

In `apps/frontend/src/components/layout/Sidebar.tsx`, add the import:

```typescript
import { Sun, Moon } from 'lucide-react'  // add to existing lucide import line
import { useTheme } from '../../lib/theme.ts'
```

Inside the `Sidebar` function, add:

```typescript
const { theme, toggle } = useTheme()
```

Replace the "Sign out" bottom section:

```typescript
{/* Theme + Sign out */}
<div className="border-t border-border p-2 space-y-1">
  <button
    onClick={toggle}
    className={clsx(
      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-white',
      collapsed && 'justify-center px-2',
    )}
  >
    {theme === 'dark'
      ? <Sun size={18} className="shrink-0" />
      : <Moon size={18} className="shrink-0" />}
    {!collapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
  </button>

  <button
    onClick={() => signOut(() => navigate('/'))}
    className={clsx(
      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-white',
      collapsed && 'justify-center px-2',
    )}
  >
    <LogOut size={18} className="shrink-0" />
    {!collapsed && <span>Sign Out</span>}
  </button>
</div>
```

- [ ] **Step 2: Manual test**

Navigate to `/dashboard`. Click the Sun icon in sidebar — page should switch to light mode (light grey background, dark text). Click Moon icon — reverts to dark. Refresh — theme persists.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/layout/Sidebar.tsx
git commit -m "feat: theme toggle button in sidebar (Sun/Moon)"
```

---

## Task 5: Voice Input Hook

**Files:**
- Create: `apps/frontend/src/lib/voice.ts`
- Create: `apps/frontend/src/lib/voice.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/frontend/src/lib/voice.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVoiceInput } from './voice.ts'

describe('useVoiceInput', () => {
  beforeEach(() => {
    // Remove SpeechRecognition to test unsupported case
    delete (window as any).SpeechRecognition
    delete (window as any).webkitSpeechRecognition
  })

  it('reports not supported when SpeechRecognition is absent', () => {
    const { result } = renderHook(() => useVoiceInput(vi.fn()))
    expect(result.current.supported).toBe(false)
  })

  it('reports supported when SpeechRecognition is present', () => {
    const mockRecognition = {
      start: vi.fn(),
      stop: vi.fn(),
      abort: vi.fn(),
      continuous: false,
      interimResults: false,
      lang: '',
      onresult: null,
      onend: null,
      onerror: null,
    }
    ;(window as any).SpeechRecognition = vi.fn(() => mockRecognition)

    const { result } = renderHook(() => useVoiceInput(vi.fn()))
    expect(result.current.supported).toBe(true)
  })

  it('toggle starts listening when not already listening', () => {
    const mockRecognition = {
      start: vi.fn(),
      stop: vi.fn(),
      abort: vi.fn(),
      continuous: false,
      interimResults: false,
      lang: '',
      onresult: null,
      onend: null,
      onerror: null,
    }
    ;(window as any).SpeechRecognition = vi.fn(() => mockRecognition)

    const { result } = renderHook(() => useVoiceInput(vi.fn()))
    act(() => result.current.toggle())
    expect(mockRecognition.start).toHaveBeenCalledOnce()
    expect(result.current.listening).toBe(true)
  })

  it('toggle stops listening when already listening', () => {
    const mockRecognition = {
      start: vi.fn(),
      stop: vi.fn(),
      abort: vi.fn(),
      continuous: false,
      interimResults: false,
      lang: '',
      onresult: null,
      onend: null,
      onerror: null,
    }
    ;(window as any).SpeechRecognition = vi.fn(() => mockRecognition)

    const { result } = renderHook(() => useVoiceInput(vi.fn()))
    act(() => result.current.toggle()) // start
    act(() => result.current.toggle()) // stop
    expect(mockRecognition.stop).toHaveBeenCalledOnce()
    expect(result.current.listening).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd apps/frontend && pnpm vitest run src/lib/voice.test.ts
```

Expected: `Error: Cannot find module './voice.ts'`

- [ ] **Step 3: Implement useVoiceInput hook**

Create `apps/frontend/src/lib/voice.ts`:

```typescript
import { useCallback, useEffect, useRef, useState } from 'react'

export function useVoiceInput(onTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const onTranscriptRef = useRef(onTranscript)
  onTranscriptRef.current = onTranscript

  const supported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  useEffect(() => {
    if (!supported) return
    const SR: new () => SpeechRecognition =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      onTranscriptRef.current(transcript)
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)

    recognitionRef.current = recognition
    return () => recognition.abort()
  }, [supported])

  const toggle = useCallback(() => {
    const r = recognitionRef.current
    if (!r) return
    if (listening) {
      r.stop()
      setListening(false)
    } else {
      r.start()
      setListening(true)
    }
  }, [listening])

  return { listening, supported, toggle }
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
cd apps/frontend && pnpm vitest run src/lib/voice.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Add mic button to AskAI page**

In `apps/frontend/src/pages/AskAI.tsx`, add imports:

```typescript
import { Send, Mic, MicOff } from 'lucide-react'
import { useVoiceInput } from '../lib/voice.ts'
```

Inside the `AskAI` function body, add the voice hook after the existing hooks:

```typescript
const { listening, supported, toggle: toggleMic } = useVoiceInput((transcript) => {
  setInput(transcript)
})
```

Also fix the existing bug — change `<ml-1>Thinking...</span>` to `<span className="ml-1">Thinking...</span>`.

Replace the input row at the bottom of the component:

```typescript
<div className="border-t border-border p-4">
  <div className="flex gap-3">
    <input
      value={input}
      onChange={(e) => setInput(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && send()}
      placeholder="Ask anything about your material..."
      className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-white placeholder-muted outline-none focus:border-primary"
    />
    {supported && (
      <button
        onClick={toggleMic}
        className={`rounded-xl px-4 py-3 transition-colors ${
          listening
            ? 'bg-danger text-white animate-pulse'
            : 'border border-border text-muted hover:text-white'
        }`}
        title={listening ? 'Stop recording' : 'Start voice input'}
      >
        {listening ? <MicOff size={16} /> : <Mic size={16} />}
      </button>
    )}
    <button
      onClick={send}
      disabled={!input.trim() || streaming}
      className="rounded-xl bg-primary px-4 py-3 text-white hover:bg-primary-hover disabled:opacity-40"
    >
      <Send size={16} />
    </button>
  </div>
</div>
```

- [ ] **Step 6: Manual test**

Open Ask AI in Chrome. A mic icon should appear left of the send button. Click it — button turns red and pulses. Speak — transcript appears live in the input. Click again — recording stops. Edit text, press Enter to send.

In a non-Chrome browser (Safari, Firefox): mic button should not appear at all.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/lib/voice.ts apps/frontend/src/lib/voice.test.ts apps/frontend/src/pages/AskAI.tsx
git commit -m "feat: voice input on Ask AI using Web Speech API"
```

---

## Task 6: Add document_id to Attempts API Response

**Files:**
- Modify: `apps/backend/src/routes/test.ts`
- Modify: `apps/frontend/src/lib/api.ts`

- [ ] **Step 1: Add document_id to attempts query**

In `apps/backend/src/routes/test.ts`, find the `GET /attempts` handler (line ~34). Change the SQL query:

Old:
```typescript
const attempts = await sql`
    SELECT
      ta.*,
      t.topic,
      t.type,
      t.difficulty,
      d.title AS document_title
    FROM test_attempts ta
    JOIN tests t ON ta.test_id = t.id
    JOIN documents d ON t.document_id = d.id
    WHERE ta.user_id = ${userId}
    ORDER BY ta.submitted_at DESC
  `
```

New (add `t.document_id`):
```typescript
const attempts = await sql`
    SELECT
      ta.*,
      t.topic,
      t.type,
      t.difficulty,
      t.document_id,
      d.title AS document_title
    FROM test_attempts ta
    JOIN tests t ON ta.test_id = t.id
    JOIN documents d ON t.document_id = d.id
    WHERE ta.user_id = ${userId}
    ORDER BY ta.submitted_at DESC
  `
```

- [ ] **Step 2: Update api.ts type for attempts**

In `apps/frontend/src/lib/api.ts`, update the `attempts` method return type:

Old:
```typescript
attempts: () =>
  apiFetch<{ attempts: (TestAttempt & { topic: string; document_title: string })[] }>(
    '/test/attempts',
    token,
  ),
```

New:
```typescript
attempts: () =>
  apiFetch<{ attempts: (TestAttempt & { topic: string; document_id: string; document_title: string })[] }>(
    '/test/attempts',
    token,
  ),
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/routes/test.ts apps/frontend/src/lib/api.ts
git commit -m "feat: include document_id in test attempts API response"
```

---

## Task 7: Mastery Calculation Helper

**Files:**
- Create: `apps/frontend/src/lib/mastery.ts`
- Create: `apps/frontend/src/lib/mastery.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/frontend/src/lib/mastery.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computeMastery } from './mastery.ts'
import type { Document, TestAttempt } from 'shared'

type AttemptRow = TestAttempt & { document_id: string; document_title: string; topic: string }

const makeDoc = (id: string, title: string): Document => ({
  id,
  user_id: 'u1',
  title,
  filename: 'f.pdf',
  page_count: 1,
  status: 'ready',
  created_at: '2026-01-01T00:00:00Z',
})

const makeAttempt = (docId: string, score: number, total: number, date = '2026-02-01T00:00:00Z'): AttemptRow => ({
  id: Math.random().toString(),
  test_id: 't1',
  user_id: 'u1',
  document_id: docId,
  document_title: 'x',
  topic: 'x',
  answers: {},
  score,
  total_marks: total,
  time_elapsed_seconds: 60,
  tab_switches: 0,
  started_at: date,
  submitted_at: date,
})

describe('computeMastery', () => {
  it('returns pct -1 for document with no attempts', () => {
    const docs = [makeDoc('d1', 'Doc 1')]
    const result = computeMastery(docs, [])
    expect(result['d1'].pct).toBe(-1)
  })

  it('calculates correct average percentage', () => {
    const docs = [makeDoc('d1', 'Doc 1')]
    const attempts = [
      makeAttempt('d1', 8, 10),   // 80%
      makeAttempt('d1', 6, 10),   // 60%
    ]
    const result = computeMastery(docs, attempts)
    expect(result['d1'].pct).toBe(70) // average of 80 and 60
  })

  it('rounds to nearest integer', () => {
    const docs = [makeDoc('d1', 'Doc 1')]
    const attempts = [
      makeAttempt('d1', 1, 3),   // 33.3%
      makeAttempt('d1', 2, 3),   // 66.6%
    ]
    const result = computeMastery(docs, attempts)
    expect(result['d1'].pct).toBe(50) // average of 33 and 67 = 50
  })

  it('tracks lastActivity as most recent submitted_at', () => {
    const docs = [makeDoc('d1', 'Doc 1')]
    const attempts = [
      makeAttempt('d1', 8, 10, '2026-01-01T00:00:00Z'),
      makeAttempt('d1', 6, 10, '2026-03-01T00:00:00Z'),
    ]
    const result = computeMastery(docs, attempts)
    expect(result['d1'].lastActivity).toBe('2026-03-01T00:00:00Z')
  })

  it('handles multiple documents independently', () => {
    const docs = [makeDoc('d1', 'A'), makeDoc('d2', 'B')]
    const attempts = [
      makeAttempt('d1', 9, 10),   // 90%
      makeAttempt('d2', 4, 10),   // 40%
    ]
    const result = computeMastery(docs, attempts)
    expect(result['d1'].pct).toBe(90)
    expect(result['d2'].pct).toBe(40)
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd apps/frontend && pnpm vitest run src/lib/mastery.test.ts
```

Expected: `Error: Cannot find module './mastery.ts'`

- [ ] **Step 3: Implement computeMastery**

Create `apps/frontend/src/lib/mastery.ts`:

```typescript
import type { Document, TestAttempt } from 'shared'

type AttemptRow = TestAttempt & { document_id: string; document_title: string; topic: string }

export interface MasteryInfo {
  pct: number        // -1 if no attempts yet
  lastActivity: string  // ISO date string
}

export function computeMastery(
  documents: Document[],
  attempts: AttemptRow[],
): Record<string, MasteryInfo> {
  const byDoc = new Map<string, { scores: number[]; lastDate: string }>()

  for (const a of attempts) {
    const pct = Math.round((a.score / a.total_marks) * 100)
    const existing = byDoc.get(a.document_id)
    if (existing) {
      existing.scores.push(pct)
      if (a.submitted_at > existing.lastDate) existing.lastDate = a.submitted_at
    } else {
      byDoc.set(a.document_id, { scores: [pct], lastDate: a.submitted_at })
    }
  }

  const result: Record<string, MasteryInfo> = {}
  for (const doc of documents) {
    const entry = byDoc.get(doc.id)
    if (entry) {
      const avg = Math.round(entry.scores.reduce((s, v) => s + v, 0) / entry.scores.length)
      result[doc.id] = { pct: avg, lastActivity: entry.lastDate }
    } else {
      result[doc.id] = { pct: -1, lastActivity: doc.created_at }
    }
  }
  return result
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
cd apps/frontend && pnpm vitest run src/lib/mastery.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/lib/mastery.ts apps/frontend/src/lib/mastery.test.ts
git commit -m "feat: computeMastery helper to calc document mastery from test attempts"
```

---

## Task 8: Dashboard Map View

**Files:**
- Modify: `apps/frontend/src/pages/Dashboard.tsx`
- Modify: `apps/frontend/src/pages/Learn.tsx`
- Modify: `apps/frontend/src/pages/AskAI.tsx`
- Modify: `apps/frontend/src/pages/TestNew.tsx`

- [ ] **Step 1: Rewrite Dashboard.tsx**

Replace the full content of `apps/frontend/src/pages/Dashboard.tsx` with:

```typescript
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth, useUser } from '@clerk/clerk-react'
import { BookOpen, MessageSquare, FileText } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import { computeMastery, type MasteryInfo } from '../lib/mastery.ts'
import OnboardingModal from '../components/OnboardingModal.tsx'
import type { Document, TestAttempt } from 'shared'

type AttemptRow = TestAttempt & { document_id: string; document_title: string; topic: string }

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function MasteryRing({ pct }: { pct: number }) {
  const r = 28
  const circ = 2 * Math.PI * r
  const color =
    pct < 0 ? '#2d2d3d' : pct >= 70 ? '#22C55E' : pct >= 40 ? '#FBBF24' : '#EF4444'
  const offset = pct < 0 ? 0 : circ * (1 - pct / 100)

  return (
    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
      <svg width="64" height="64" className="-rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#2d2d3d" strokeWidth="4" />
        {pct >= 0 && (
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        )}
      </svg>
      <span className="absolute text-xs font-bold" style={{ color: pct < 0 ? '#94a3b8' : color }}>
        {pct < 0 ? '—' : `${pct}%`}
      </span>
    </div>
  )
}

function DocCard({
  doc,
  mastery,
  onAction,
}: {
  doc: Document
  mastery: MasteryInfo
  onAction: (action: 'learn' | 'ask' | 'test', docId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const ACTIONS = [
    { key: 'learn' as const, icon: BookOpen, label: 'Learn', color: 'text-primary' },
    { key: 'ask' as const, icon: MessageSquare, label: 'Ask AI', color: 'text-cyan-DEFAULT' },
    { key: 'test' as const, icon: FileText, label: 'Take Test', color: 'text-amber-DEFAULT' },
  ]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full rounded-xl border border-border bg-surface p-5 text-left transition-colors hover:border-primary/40 hover:bg-white/[0.02]"
      >
        <MasteryRing pct={mastery.pct} />
        <p className="mt-3 truncate font-semibold text-white">{doc.title}</p>
        <p className="mt-1 text-xs text-muted">
          {mastery.pct < 0 ? 'No tests yet' : `Last: ${formatDate(mastery.lastActivity)}`}
        </p>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-xl border border-border bg-surface p-2 shadow-xl">
          {ACTIONS.map(({ key, icon: Icon, label, color }) => (
            <button
              key={key}
              onClick={() => { setOpen(false); onAction(key, doc.id) }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted hover:bg-white/5 hover:text-white"
            >
              <Icon size={15} className={color} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const navigate = useNavigate()
  const [documents, setDocuments] = useState<Document[]>([])
  const [mastery, setMastery] = useState<Record<string, MasteryInfo>>({})
  const [loading, setLoading] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem('note2test_onboarded'),
  )

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const api = makeApi(token)
      const [docsRes, attemptsRes] = await Promise.all([
        api.documents.list(),
        api.test.attempts(),
      ])
      const docs = docsRes.documents
      setDocuments(docs)
      setMastery(computeMastery(docs, attemptsRes.attempts as AttemptRow[]))
      setLoading(false)
    }
    load()
  }, [getToken])

  function handleAction(action: 'learn' | 'ask' | 'test', docId: string) {
    const routes = {
      learn: '/learn',
      ask: '/ask',
      test: '/test/new',
    }
    navigate(routes[action], { state: { documentId: docId } })
  }

  function dismissOnboarding() {
    localStorage.setItem('note2test_onboarded', 'true')
    setShowOnboarding(false)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <>
      {showOnboarding && <OnboardingModal onDismiss={dismissOnboarding} />}
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">
            {greeting()}{user?.firstName ? `, ${user.firstName}` : ''} 👋
          </h1>
          <p className="mt-1 text-muted">Pick a material to study.</p>
        </div>

        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-3xl">
              📄
            </div>
            <p className="font-semibold text-white">No materials yet</p>
            <p className="mt-1 text-sm text-muted">Upload a PDF to get started</p>
            <button
              onClick={() => navigate('/materials')}
              className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"
            >
              Upload PDF
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {documents.map((doc) => (
              <DocCard
                key={doc.id}
                doc={doc}
                mastery={mastery[doc.id] ?? { pct: -1, lastActivity: doc.created_at }}
                onAction={handleAction}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Pre-select document in Learn.tsx**

In `apps/frontend/src/pages/Learn.tsx`, add `useLocation` import:

```typescript
import { useNavigate, useLocation } from 'react-router-dom'
```

Inside the `Learn` function, add after existing state declarations:

```typescript
const { state } = useLocation()
```

Change the document-loading effect to respect passed state:

```typescript
useEffect(() => {
  async function load() {
    const token = await getToken()
    if (!token) return
    const res = await makeApi(token).documents.list()
    const ready = res.documents.filter((d) => d.status === 'ready')
    setDocuments(ready)
    if (state?.documentId) {
      setSelectedDoc(state.documentId)
    } else if (ready.length > 0) {
      setSelectedDoc(ready[0].id)
    }
  }
  load()
}, [getToken, state?.documentId])
```

- [ ] **Step 3: Pre-select document in AskAI.tsx**

In `apps/frontend/src/pages/AskAI.tsx`, add `useLocation` import:

```typescript
import { useLocation } from 'react-router-dom'
```

Inside the `AskAI` function, add after existing hooks:

```typescript
const { state } = useLocation()
```

Change the document-loading effect:

```typescript
useEffect(() => {
  async function load() {
    const token = await getToken()
    if (!token) return
    const api = makeApi(token)
    const res = await api.documents.list()
    const ready = res.documents.filter((d) => d.status === 'ready')
    setDocuments(ready)
    if (state?.documentId) {
      setSelectedDoc(state.documentId)
    } else if (ready.length > 0) {
      setSelectedDoc(ready[0].id)
    }
  }
  load()
}, [getToken, state?.documentId])
```

- [ ] **Step 4: Pre-select document in TestNew.tsx**

In `apps/frontend/src/pages/TestNew.tsx`, add `useLocation` import:

```typescript
import { useNavigate, useLocation } from 'react-router-dom'
```

Inside the `TestNew` function:

```typescript
const { state } = useLocation()
```

Change the document-loading effect:

```typescript
useEffect(() => {
  async function load() {
    const token = await getToken()
    if (!token) return
    const res = await makeApi(token).documents.list()
    const ready = res.documents.filter((d) => d.status === 'ready')
    setDocuments(ready)
    const defaultDoc = state?.documentId ?? (ready.length > 0 ? ready[0].id : '')
    setForm((f) => ({ ...f, documentId: defaultDoc }))
  }
  load()
}, [getToken, state?.documentId])
```

- [ ] **Step 5: Manual test**

Navigate to `/dashboard`. Should see document grid with mastery rings. Click any card — popover appears with Learn / Ask AI / Take Test. Click "Learn" — navigates to Learn page with that document pre-selected.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/pages/Dashboard.tsx apps/frontend/src/pages/Learn.tsx apps/frontend/src/pages/AskAI.tsx apps/frontend/src/pages/TestNew.tsx
git commit -m "feat: dashboard map view with document mastery rings and quick-action popover"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Dashboard Map View — document cards with mastery % ring | Task 8 |
| Dashboard — action popover (Learn / Ask AI / Take Test) | Task 8 |
| Dashboard — pre-select document in target pages | Task 8 |
| Theme toggle — CSS custom properties for bg/surface/border/muted | Task 2 |
| Theme toggle — ThemeContext + useTheme hook | Task 3 |
| Theme toggle — localStorage persistence | Task 3 |
| Theme toggle — Sun/Moon button in sidebar | Task 4 |
| Onboarding — first-visit modal with 4 feature cards | Task 1 |
| Onboarding — dismissed via localStorage flag | Task 1 |
| Voice input — Web Speech API hook | Task 5 |
| Voice input — mic button in AskAI (click to start/stop) | Task 5 |
| Voice input — live transcript in input box | Task 5 |
| Voice input — hidden when unsupported | Task 5 |

All spec requirements covered. ✓

# Note2Test — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Note2Test frontend — React 18 + Vite + Tailwind with Midnight Indigo design system, Clerk authentication, and all 11 pages connected to the backend API.

**Architecture:** Vite React app inside `apps/frontend/`. Tailwind CSS with custom Midnight Indigo theme tokens. shadcn/ui component primitives. Clerk for auth (ClerkProvider wraps the app). All API calls go through a typed `api.ts` client. SSE streaming handled by `sse.ts` helper. React Router v6 for routing with a protected-route wrapper.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind CSS v3, shadcn/ui, Clerk React SDK, React Router v6, `shared` workspace package (types), Vitest + React Testing Library

**Prereq:** Plan A (backend) must be complete with the backend running on `http://localhost:3001`.

---

## File Map

```
apps/frontend/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── index.html
├── tailwind.config.ts
├── postcss.config.js
├── src/
│   ├── main.tsx                          # Entry — ClerkProvider + RouterProvider
│   ├── App.tsx                           # Route definitions + ProtectedRoute
│   ├── index.css                         # Tailwind directives + CSS custom properties
│   ├── lib/
│   │   ├── api.ts                        # Typed fetch wrapper for all backend calls
│   │   └── sse.ts                        # SSE stream reader hook
│   ├── components/
│   │   ├── Logo.tsx                      # Circle Stamp — N2T inside indigo ring
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx               # Collapsible nav sidebar
│   │   │   └── AppLayout.tsx             # Sidebar + main content area
│   │   ├── StreamingText.tsx             # Renders SSE token stream word-by-word
│   │   ├── UploadZone.tsx                # Drag-and-drop PDF upload + step progress
│   │   └── DocumentCard.tsx             # Material card (title, status, actions)
│   └── pages/
│       ├── Landing.tsx                   # Public home — hero + 3-mode cards + CTA
│       ├── Dashboard.tsx                 # Auth home — greeting, continue, quick actions
│       ├── Materials.tsx                 # PDF list + upload zone
│       ├── Learn.tsx                     # Topic search + recent topics grid
│       ├── LearnSession.tsx              # AI explanation + quick check + tutor panel
│       ├── AskAI.tsx                     # Chat-style Q&A with document selector
│       ├── TestNew.tsx                   # Test config form
│       ├── TestTake.tsx                  # Take test — timer + tab-switch + sidebar
│       ├── TestResults.tsx               # Score + review + tab-switch count
│       ├── Progress.tsx                  # Stats dashboard
│       └── Settings.tsx                  # API key + Ollama URL + model picker
```

---

## Task 1: Vite + React + Tailwind Scaffold

**Files:**
- Replace: `apps/frontend/package.json`
- Create: `apps/frontend/vite.config.ts`
- Create: `apps/frontend/tsconfig.json`
- Create: `apps/frontend/tsconfig.app.json`
- Create: `apps/frontend/index.html`
- Create: `apps/frontend/tailwind.config.ts`
- Create: `apps/frontend/postcss.config.js`
- Create: `apps/frontend/src/index.css`

- [ ] **Step 1: Scaffold the Vite app**

```bash
cd apps/frontend
# Remove stub package.json
```

`apps/frontend/package.json`:
```json
{
  "name": "frontend",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@clerk/clerk-react": "^5.15.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "shared": "workspace:*",
    "lucide-react": "^0.441.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.2"
  },
  "devDependencies": {
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "@testing-library/react": "^16.0.1",
    "@testing-library/jest-dom": "^6.5.0",
    "autoprefixer": "^10.4.20",
    "jsdom": "^25.0.0",
    "postcss": "^8.4.45",
    "tailwindcss": "^3.4.11",
    "typescript": "^5.5.4",
    "vite": "^5.4.1",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create config files**

`apps/frontend/vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
```

`apps/frontend/tsconfig.json`:
```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }]
}
```

`apps/frontend/tsconfig.app.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

`apps/frontend/postcss.config.js`:
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

`apps/frontend/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Note2Test — AI Learning Platform</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Configure Tailwind with Midnight Indigo theme**

`apps/frontend/tailwind.config.ts`:
```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0A0A0F',
        surface: '#13131f',
        border: '#2d2d3d',
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
        muted: '#94a3b8',
        subtle: '#475569',
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

`apps/frontend/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

@layer base {
  * {
    border-color: #2d2d3d;
  }

  body {
    background-color: #0A0A0F;
    color: #f8fafc;
    font-family: 'Inter', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  ::-webkit-scrollbar {
    width: 6px;
  }
  ::-webkit-scrollbar-track {
    background: #13131f;
  }
  ::-webkit-scrollbar-thumb {
    background: #2d2d3d;
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
    border: 1px solid #2d2d3d;
  }
}
```

- [ ] **Step 4: Install dependencies and verify Vite starts**

```bash
cd apps/frontend
pnpm install
pnpm dev
```

Expected: Vite dev server starts on http://localhost:5173 (will show blank page — that's fine).

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/
git commit -m "feat: Vite + React + Tailwind scaffold with Midnight Indigo theme"
```

---

## Task 2: API Client + SSE Helper

**Files:**
- Create: `apps/frontend/src/lib/api.ts`
- Create: `apps/frontend/src/lib/sse.ts`

- [ ] **Step 1: Write the API client**

`apps/frontend/src/lib/api.ts`:
```typescript
import { useAuth } from '@clerk/clerk-react'
import type {
  Document,
  GenerateTestRequest,
  GenerateTestResponse,
  ProgressResponse,
  SubmitTestRequest,
  SubmitTestResponse,
  UserSettings,
  ChatMessage,
  Test,
  TestQuestion,
  TestAttempt,
} from 'shared'

const BASE = '/api'

async function apiFetch<T>(
  path: string,
  token: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error: string }).error ?? res.statusText)
  }
  return res.json() as Promise<T>
}

export function makeApi(token: string) {
  return {
    documents: {
      list: () =>
        apiFetch<{ documents: Document[] }>('/documents', token),

      upload: (file: File, title: string) => {
        const form = new FormData()
        form.append('file', file)
        form.append('title', title)
        return fetch(`${BASE}/documents/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        }).then((r) => r.json() as Promise<{ document: Document }>)
      },

      delete: (id: string) =>
        apiFetch<{ deleted: boolean }>(`/documents/${id}`, token, { method: 'DELETE' }),
    },

    test: {
      generate: (body: GenerateTestRequest) =>
        apiFetch<GenerateTestResponse>('/test/generate', token, {
          method: 'POST',
          body: JSON.stringify(body),
        }),

      get: (testId: string) =>
        apiFetch<{ test: Test; questions: TestQuestion[] }>(`/test/${testId}`, token),

      submit: (testId: string, body: SubmitTestRequest) =>
        apiFetch<SubmitTestResponse>(`/test/${testId}/submit`, token, {
          method: 'POST',
          body: JSON.stringify(body),
        }),

      attempts: () =>
        apiFetch<{ attempts: (TestAttempt & { topic: string; document_title: string })[] }>(
          '/test/attempts',
          token,
        ),
    },

    ask: {
      history: (documentId: string) =>
        apiFetch<{ messages: ChatMessage[] }>(`/ask/${documentId}/history`, token),
    },

    progress: {
      get: () => apiFetch<ProgressResponse>('/progress', token),
    },

    settings: {
      get: () => apiFetch<{ settings: Partial<UserSettings> }>('/settings', token),
      update: (body: Partial<UserSettings>) =>
        apiFetch<{ updated: boolean }>('/settings', token, {
          method: 'PUT',
          body: JSON.stringify(body),
        }),
    },
  }
}
```

- [ ] **Step 2: Write the SSE hook**

`apps/frontend/src/lib/sse.ts`:
```typescript
import { useState, useCallback, useRef } from 'react'

interface UseSSEOptions {
  onToken?: (token: string) => void
  onDone?: (fullText: string) => void
  onError?: (err: Error) => void
}

export function useSSE(options: UseSSEOptions = {}) {
  const [text, setText] = useState('')
  const [streaming, setStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const stream = useCallback(
    async (url: string, body: unknown, token: string) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setText('')
      setStreaming(true)
      let accumulated = ''

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        })

        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        if (!res.body) throw new Error('No response body')

        const reader = res.body.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n').filter((l) => l.startsWith('data: '))

          for (const line of lines) {
            try {
              const parsed = JSON.parse(line.slice(6))
              const t: string = parsed.token ?? ''
              if (t) {
                accumulated += t
                setText((prev) => prev + t)
                options.onToken?.(t)
              }
            } catch {}
          }
        }

        options.onDone?.(accumulated)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          options.onError?.(err as Error)
        }
      } finally {
        setStreaming(false)
      }
    },
    [options],
  )

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
  }, [])

  const reset = useCallback(() => setText(''), [])

  return { text, streaming, stream, cancel, reset }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/lib/
git commit -m "feat: typed API client and SSE streaming hook"
```

---

## Task 3: App Entry + Routing + Auth Guard

**Files:**
- Create: `apps/frontend/src/main.tsx`
- Create: `apps/frontend/src/App.tsx`

- [ ] **Step 1: Write main.tsx**

`apps/frontend/src/main.tsx`:
```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ClerkProvider>
  </StrictMode>,
)
```

- [ ] **Step 2: Write App.tsx with all routes**

`apps/frontend/src/App.tsx`:
```typescript
import { Routes, Route, Navigate } from 'react-router-dom'
import { SignIn, SignUp, useAuth } from '@clerk/clerk-react'
import AppLayout from './components/layout/AppLayout.tsx'
import Landing from './pages/Landing.tsx'
import Dashboard from './pages/Dashboard.tsx'
import Materials from './pages/Materials.tsx'
import Learn from './pages/Learn.tsx'
import LearnSession from './pages/LearnSession.tsx'
import AskAI from './pages/AskAI.tsx'
import TestNew from './pages/TestNew.tsx'
import TestTake from './pages/TestTake.tsx'
import TestResults from './pages/TestResults.tsx'
import Progress from './pages/Progress.tsx'
import Settings from './pages/Settings.tsx'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }
  if (!isSignedIn) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route
        path="/sign-in/*"
        element={
          <div className="flex min-h-screen items-center justify-center bg-bg">
            <SignIn routing="path" path="/sign-in" />
          </div>
        }
      />
      <Route
        path="/sign-up/*"
        element={
          <div className="flex min-h-screen items-center justify-center bg-bg">
            <SignUp routing="path" path="/sign-up" />
          </div>
        }
      />

      {/* Protected — wrapped in AppLayout (sidebar + main) */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/materials" element={<Materials />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/learn/:sessionId" element={<LearnSession />} />
        <Route path="/ask" element={<AskAI />} />
        <Route path="/test/new" element={<TestNew />} />
        <Route path="/test/:testId" element={<TestTake />} />
        <Route path="/test/:testId/results" element={<TestResults />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
```

- [ ] **Step 3: Create .env file**

`apps/frontend/.env`:
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/main.tsx apps/frontend/src/App.tsx apps/frontend/.env.example
git commit -m "feat: app entry point, React Router routes, Clerk auth guard"
```

---

## Task 4: Logo + Design Components

**Files:**
- Create: `apps/frontend/src/components/Logo.tsx`
- Create: `apps/frontend/src/components/layout/Sidebar.tsx`
- Create: `apps/frontend/src/components/layout/AppLayout.tsx`

- [ ] **Step 1: Build the Circle Stamp logo**

`apps/frontend/src/components/Logo.tsx`:
```typescript
import { clsx } from 'clsx'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showWordmark?: boolean
  className?: string
}

const sizeMap = {
  sm: { ring: 'w-7 h-7', text: 'text-[9px]', divider: 'w-9', tag: 'text-[5px]', word: 'text-sm' },
  md: { ring: 'w-9 h-9', text: 'text-xs', divider: 'w-11', tag: 'text-[6px]', word: 'text-base' },
  lg: { ring: 'w-16 h-16', text: 'text-xl', divider: 'w-20', tag: 'text-[9px]', word: 'text-2xl' },
}

export default function Logo({ size = 'md', showWordmark = true, className }: LogoProps) {
  const s = sizeMap[size]

  return (
    <div className={clsx('flex items-center gap-2.5', className)}>
      {/* Circle stamp icon */}
      <div
        className={clsx(
          s.ring,
          'relative flex shrink-0 flex-col items-center justify-center rounded-full',
          'border-2 border-primary bg-surface',
          'shadow-[0_0_0_3px_rgba(99,102,241,0.15)]',
        )}
      >
        <span className={clsx(s.text, 'font-black leading-none text-white')}>
          N<span className="text-primary">2</span>T
        </span>
        <div className="my-0.5 h-px w-3/4 bg-primary/40" />
        <span className={clsx(s.tag, 'font-bold uppercase tracking-widest text-primary')}>
          AI
        </span>
      </div>

      {/* Wordmark */}
      {showWordmark && (
        <span className={clsx(s.word, 'font-bold text-white')}>
          Note<span className="text-primary">2</span>Test
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Build the collapsible sidebar**

`apps/frontend/src/components/layout/Sidebar.tsx`:
```typescript
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useClerk } from '@clerk/clerk-react'
import {
  Home,
  BookOpen,
  MessageSquare,
  FileText,
  BarChart2,
  Settings,
  Upload,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react'
import { clsx } from 'clsx'
import Logo from '../Logo.tsx'

const NAV_ITEMS = [
  { to: '/dashboard', icon: Home, label: 'Home' },
  { to: '/materials', icon: Upload, label: 'Materials' },
  { to: '/learn', icon: BookOpen, label: 'Learn' },
  { to: '/ask', icon: MessageSquare, label: 'Ask AI' },
  { to: '/test/new', icon: FileText, label: 'Tests' },
  { to: '/progress', icon: BarChart2, label: 'Progress' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { signOut } = useClerk()
  const navigate = useNavigate()

  return (
    <aside
      className={clsx(
        'relative flex h-screen flex-col border-r border-border bg-surface transition-all duration-300',
        collapsed ? 'w-16' : 'w-56',
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-border px-4">
        <Logo size="sm" showWordmark={!collapsed} />
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted hover:bg-white/5 hover:text-white',
                collapsed && 'justify-center px-2',
              )
            }
          >
            <Icon size={18} className="shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Sign out */}
      <div className="border-t border-border p-2">
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

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-muted hover:text-white"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  )
}
```

- [ ] **Step 3: Build AppLayout**

`apps/frontend/src/components/layout/AppLayout.tsx`:
```typescript
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.tsx'

export default function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/
git commit -m "feat: Logo (Circle Stamp), collapsible Sidebar, AppLayout"
```

---

## Task 5: Shared UI Components

**Files:**
- Create: `apps/frontend/src/components/StreamingText.tsx`
- Create: `apps/frontend/src/components/UploadZone.tsx`
- Create: `apps/frontend/src/components/DocumentCard.tsx`

- [ ] **Step 1: StreamingText component**

`apps/frontend/src/components/StreamingText.tsx`:
```typescript
import { useEffect, useRef } from 'react'
import { clsx } from 'clsx'

interface StreamingTextProps {
  text: string
  streaming?: boolean
  className?: string
}

export default function StreamingText({ text, streaming, className }: StreamingTextProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (streaming) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [text, streaming])

  return (
    <div className={clsx('whitespace-pre-wrap text-sm leading-relaxed text-white/90', className)}>
      {text}
      {streaming && (
        <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary" />
      )}
      <div ref={endRef} />
    </div>
  )
}
```

- [ ] **Step 2: UploadZone component**

`apps/frontend/src/components/UploadZone.tsx`:
```typescript
import { useState, useRef } from 'react'
import { Upload, CheckCircle, Loader2, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'

type UploadStep = 'idle' | 'uploading' | 'extracting' | 'chunking' | 'embedding' | 'ready' | 'failed'

const STEPS: UploadStep[] = ['uploading', 'extracting', 'chunking', 'embedding', 'ready']
const STEP_LABELS: Record<UploadStep, string> = {
  idle: '',
  uploading: 'Uploading...',
  extracting: 'Extracting text...',
  chunking: 'Chunking text...',
  embedding: 'Generating embeddings...',
  ready: 'Ready!',
  failed: 'Processing failed',
}

interface UploadZoneProps {
  onUpload: (file: File, title: string) => Promise<{ documentId: string }>
  onComplete: (documentId: string) => void
}

export default function UploadZone({ onUpload, onComplete }: UploadZoneProps) {
  const [step, setStep] = useState<UploadStep>('idle')
  const [dragOver, setDragOver] = useState(false)
  const [title, setTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!file.name.endsWith('.pdf')) {
      alert('Please upload a PDF file.')
      return
    }

    const fileTitle = title || file.name.replace('.pdf', '')
    setStep('uploading')

    try {
      const { documentId } = await onUpload(file, fileTitle)

      // Simulate steps while backend processes (poll is handled by parent)
      setStep('extracting')
      await delay(1200)
      setStep('chunking')
      await delay(800)
      setStep('embedding')

      // Poll document status
      onComplete(documentId)
    } catch {
      setStep('failed')
    }
  }

  const isProcessing = step !== 'idle' && step !== 'ready' && step !== 'failed'

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Document title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-white placeholder-muted outline-none focus:border-primary"
      />

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const file = e.dataTransfer.files[0]
          if (file) handleFile(file)
        }}
        onClick={() => !isProcessing && inputRef.current?.click()}
        className={clsx(
          'flex cursor-pointer flex-col items-center gap-4 rounded-xl border-2 border-dashed p-10 transition-colors',
          dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-white/2',
          isProcessing && 'cursor-default',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />

        {step === 'idle' && (
          <>
            <Upload size={32} className="text-muted" />
            <div className="text-center">
              <p className="font-medium text-white">Drop your PDF here</p>
              <p className="mt-1 text-sm text-muted">or click to browse</p>
            </div>
          </>
        )}

        {isProcessing && (
          <div className="w-full space-y-3">
            <Loader2 size={28} className="mx-auto animate-spin text-primary" />
            <div className="space-y-2">
              {STEPS.filter((s) => s !== 'ready').map((s) => {
                const stepIdx = STEPS.indexOf(s)
                const currentIdx = STEPS.indexOf(step)
                const done = stepIdx < currentIdx
                const active = s === step
                return (
                  <div key={s} className="flex items-center gap-3">
                    <div className={clsx(
                      'h-2 w-2 rounded-full',
                      done ? 'bg-success' : active ? 'bg-primary animate-pulse' : 'bg-border',
                    )} />
                    <span className={clsx(
                      'text-sm',
                      done ? 'text-success' : active ? 'text-white' : 'text-subtle',
                    )}>
                      {STEP_LABELS[s]}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {step === 'ready' && (
          <>
            <CheckCircle size={32} className="text-success" />
            <p className="font-medium text-success">Document ready!</p>
          </>
        )}

        {step === 'failed' && (
          <>
            <AlertCircle size={32} className="text-danger" />
            <p className="font-medium text-danger">Processing failed. Try again.</p>
          </>
        )}
      </div>
    </div>
  )
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
```

- [ ] **Step 3: DocumentCard component**

`apps/frontend/src/components/DocumentCard.tsx`:
```typescript
import { FileText, Trash2, CheckCircle, Loader2, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'
import type { Document } from 'shared'

interface DocumentCardProps {
  document: Document
  onDelete: (id: string) => void
  onOpen?: (id: string) => void
}

const STATUS_CONFIG = {
  ready: { icon: CheckCircle, color: 'text-success', label: 'Ready' },
  processing: { icon: Loader2, color: 'text-primary animate-spin', label: 'Processing...' },
  failed: { icon: AlertCircle, color: 'text-danger', label: 'Failed' },
}

export default function DocumentCard({ document, onDelete, onOpen }: DocumentCardProps) {
  const status = STATUS_CONFIG[document.status]
  const StatusIcon = status.icon

  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3.5 transition-colors hover:border-primary/40">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <FileText size={18} className="text-primary" />
        </div>
        <div>
          <p className="font-medium text-white">{document.title}</p>
          <div className="flex items-center gap-1.5">
            <StatusIcon size={12} className={status.color} />
            <span className="text-xs text-muted">{status.label}</span>
            {document.page_count && (
              <span className="text-xs text-subtle">· {document.page_count} pages</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {document.status === 'ready' && onOpen && (
          <button
            onClick={() => onOpen(document.id)}
            className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
          >
            Open
          </button>
        )}
        <button
          onClick={() => onDelete(document.id)}
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/
git commit -m "feat: StreamingText, UploadZone with step progress, DocumentCard"
```

---

## Task 6: Landing Page

**Files:**
- Create: `apps/frontend/src/pages/Landing.tsx`

- [ ] **Step 1: Build the landing page**

`apps/frontend/src/pages/Landing.tsx`:
```typescript
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { BookOpen, MessageSquare, FileText, ArrowRight, Sparkles } from 'lucide-react'
import Logo from '../components/Logo.tsx'

const MODES = [
  {
    icon: BookOpen,
    color: 'text-primary',
    bg: 'bg-primary/10 border-primary/30',
    hover: 'hover:border-primary/60',
    title: 'LEARN',
    desc: 'Understand any topic from your material.',
    cta: 'Start Learning',
  },
  {
    icon: MessageSquare,
    color: 'text-cyan-DEFAULT',
    bg: 'bg-cyan-muted border-cyan-DEFAULT/30',
    hover: 'hover:border-cyan-DEFAULT/60',
    title: 'ASK',
    desc: 'Ask questions from your study material.',
    cta: 'Ask AI',
  },
  {
    icon: FileText,
    color: 'text-amber-DEFAULT',
    bg: 'bg-amber-muted border-amber-DEFAULT/30',
    hover: 'hover:border-amber-DEFAULT/60',
    title: 'TEST',
    desc: 'Generate tests from your material.',
    cta: 'Take a Test',
  },
]

export default function Landing() {
  const { isSignedIn } = useAuth()
  const navigate = useNavigate()

  function handleCTA() {
    navigate(isSignedIn ? '/dashboard' : '/sign-up')
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      {/* Nav */}
      <nav className="flex items-center justify-between border-b border-border px-8 py-4">
        <Logo size="md" />
        <div className="flex items-center gap-3">
          {isSignedIn ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
            >
              Go to Dashboard
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate('/sign-in')}
                className="text-sm font-medium text-muted hover:text-white"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/sign-up')}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
              >
                Get Started
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <div className="flex flex-1 flex-col items-center px-6 py-20 text-center">
        <div className="mb-6 flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
          <Sparkles size={12} />
          RAG-Powered AI Learning
        </div>

        <h1 className="max-w-3xl text-5xl font-black leading-tight tracking-tight text-white md:text-6xl">
          Turn your notes into{' '}
          <span className="text-primary">knowledge.</span>
        </h1>

        <p className="mt-6 max-w-xl text-lg text-muted">
          Upload your PDF study material. Let AI teach you, answer your questions,
          and generate personalised tests — all from your own notes.
        </p>

        <button
          onClick={handleCTA}
          className="mt-10 flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-primary/30 transition-all hover:bg-primary-hover hover:shadow-primary/50"
        >
          Get Started Free <ArrowRight size={18} />
        </button>

        {/* Mode cards */}
        <div className="mt-20 w-full max-w-4xl">
          <p className="mb-8 text-sm font-semibold uppercase tracking-widest text-muted">
            What do you want to do?
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {MODES.map(({ icon: Icon, color, bg, hover, title, desc, cta }) => (
              <div
                key={title}
                className={`rounded-2xl border ${bg} ${hover} cursor-pointer p-6 text-left transition-all`}
                onClick={handleCTA}
              >
                <Icon size={28} className={color} />
                <h3 className="mt-4 text-lg font-bold text-white">{title}</h3>
                <p className="mt-2 text-sm text-muted">{desc}</p>
                <div className={`mt-6 flex items-center gap-1.5 text-sm font-semibold ${color}`}>
                  {cta} <ArrowRight size={14} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Flow diagram */}
        <div className="mt-20 flex flex-wrap items-center justify-center gap-2 text-sm text-muted">
          {['Upload PDF', 'Extract Text', 'Embed', 'Vector Search', 'LLM', 'You Learn'].map(
            (step, i, arr) => (
              <span key={step} className="flex items-center gap-2">
                <span className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-white">
                  {step}
                </span>
                {i < arr.length - 1 && <ArrowRight size={14} className="text-subtle" />}
              </span>
            ),
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify landing page renders**

```bash
pnpm dev   # from apps/frontend
```

Open http://localhost:5173 — should see hero, 3 mode cards, flow diagram.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/pages/Landing.tsx
git commit -m "feat: landing page — hero, 3-mode cards, RAG flow diagram"
```

---

## Task 7: Dashboard Page

**Files:**
- Create: `apps/frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Build the dashboard**

`apps/frontend/src/pages/Dashboard.tsx`:
```typescript
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useUser } from '@clerk/clerk-react'
import { BookOpen, MessageSquare, FileText, BarChart2, ArrowRight, CheckCircle } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import type { Document, TestAttempt } from 'shared'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const navigate = useNavigate()
  const [documents, setDocuments] = useState<Document[]>([])
  const [recentAttempts, setRecentAttempts] = useState<(TestAttempt & { topic: string; document_title: string })[]>([])

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const api = makeApi(token)
      const [docsRes, attemptsRes] = await Promise.all([
        api.documents.list(),
        api.test.attempts(),
      ])
      setDocuments(docsRes.documents.slice(0, 3))
      setRecentAttempts(attemptsRes.attempts.slice(0, 3))
    }
    load()
  }, [getToken])

  const QUICK_ACTIONS = [
    { icon: BookOpen, label: 'Learn', color: 'text-primary', to: '/learn' },
    { icon: MessageSquare, label: 'Ask AI', color: 'text-cyan-DEFAULT', to: '/ask' },
    { icon: FileText, label: 'Take Test', color: 'text-amber-DEFAULT', to: '/test/new' },
  ]

  return (
    <div className="p-8">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          {greeting()} {user?.firstName ? `${user.firstName} 👋` : '👋'}
        </h1>
        <p className="mt-1 text-muted">What would you like to do?</p>
      </div>

      {/* Quick actions */}
      <div className="mb-8 grid grid-cols-3 gap-3">
        {QUICK_ACTIONS.map(({ icon: Icon, label, color, to }) => (
          <button
            key={label}
            onClick={() => navigate(to)}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-primary/40 hover:bg-white/5"
          >
            <Icon size={20} className={color} />
            <span className="font-medium text-white">{label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Your Materials */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-white">Your Materials</h2>
            <button onClick={() => navigate('/materials')} className="text-xs text-primary hover:underline">
              View all
            </button>
          </div>
          {documents.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-muted">No materials yet.</p>
              <button
                onClick={() => navigate('/materials')}
                className="mt-2 text-sm font-medium text-primary hover:underline"
              >
                Upload your first PDF →
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5"
                >
                  <span className="text-sm text-white">{doc.title}</span>
                  <button
                    onClick={() => navigate('/materials')}
                    className="text-xs text-primary hover:underline"
                  >
                    Open
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-white">Recent Activity</h2>
            <button onClick={() => navigate('/progress')} className="text-xs text-primary hover:underline">
              <BarChart2 size={13} className="inline" /> Progress
            </button>
          </div>
          {recentAttempts.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-muted">No tests taken yet.</p>
              <button
                onClick={() => navigate('/test/new')}
                className="mt-2 text-sm font-medium text-primary hover:underline"
              >
                Generate your first test →
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentAttempts.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                  <CheckCircle size={14} className="shrink-0 text-success" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">{a.topic}</p>
                    <p className="text-xs text-muted">{a.document_title}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-white">
                    {a.score}/{a.total_marks}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/pages/Dashboard.tsx
git commit -m "feat: dashboard — greeting, quick actions, materials list, recent activity"
```

---

## Task 8: Materials Page

**Files:**
- Create: `apps/frontend/src/pages/Materials.tsx`

- [ ] **Step 1: Build Materials page**

`apps/frontend/src/pages/Materials.tsx`:
```typescript
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { makeApi } from '../lib/api.ts'
import UploadZone from '../components/UploadZone.tsx'
import DocumentCard from '../components/DocumentCard.tsx'
import type { Document } from 'shared'

export default function Materials() {
  const { getToken } = useAuth()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)

  const loadDocuments = useCallback(async () => {
    const token = await getToken()
    if (!token) return
    const api = makeApi(token)
    const res = await api.documents.list()
    setDocuments(res.documents)
    setLoading(false)
  }, [getToken])

  useEffect(() => { loadDocuments() }, [loadDocuments])

  // Poll processing documents every 3 seconds
  useEffect(() => {
    const hasProcessing = documents.some((d) => d.status === 'processing')
    if (!hasProcessing) return
    const id = setInterval(loadDocuments, 3000)
    return () => clearInterval(id)
  }, [documents, loadDocuments])

  async function handleUpload(file: File, title: string) {
    const token = await getToken()
    if (!token) throw new Error('Not authenticated')
    const api = makeApi(token)
    const res = await api.documents.upload(file, title)
    setDocuments((prev) => [res.document, ...prev])
    return { documentId: res.document.id }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this document and all its data?')) return
    const token = await getToken()
    if (!token) return
    const api = makeApi(token)
    await api.documents.delete(id)
    setDocuments((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">My Materials</h1>
        <p className="mt-1 text-muted">Upload PDFs to use them across Learn, Ask AI, and Test modes.</p>
      </div>

      <div className="mb-8 max-w-lg">
        <h2 className="mb-4 font-semibold text-white">Upload PDF</h2>
        <UploadZone onUpload={handleUpload} onComplete={loadDocuments} />
      </div>

      <div>
        <h2 className="mb-4 font-semibold text-white">
          Your Documents
          <span className="ml-2 text-sm font-normal text-muted">({documents.length})</span>
        </h2>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-surface" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <p className="text-sm text-muted">No documents uploaded yet. Upload a PDF above to get started.</p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <DocumentCard key={doc.id} document={doc} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/pages/Materials.tsx
git commit -m "feat: materials page — upload zone, document list with polling for processing status"
```

---

## Task 9: Learn Pages

**Files:**
- Create: `apps/frontend/src/pages/Learn.tsx`
- Create: `apps/frontend/src/pages/LearnSession.tsx`

- [ ] **Step 1: Learn topic search page**

`apps/frontend/src/pages/Learn.tsx`:
```typescript
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { Search, BookOpen } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import type { Document } from 'shared'

export default function Learn() {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [documents, setDocuments] = useState<Document[]>([])
  const [topic, setTopic] = useState('')
  const [selectedDoc, setSelectedDoc] = useState('')

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const res = await makeApi(token).documents.list()
      const ready = res.documents.filter((d) => d.status === 'ready')
      setDocuments(ready)
      if (ready.length > 0) setSelectedDoc(ready[0].id)
    }
    load()
  }, [getToken])

  function handleLearn() {
    if (!topic.trim() || !selectedDoc) return
    navigate(`/learn/${selectedDoc}?topic=${encodeURIComponent(topic.trim())}`)
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Learn a Topic</h1>
        <p className="mt-1 text-muted">What do you want to understand?</p>
      </div>

      <div className="max-w-2xl space-y-4">
        {/* Document selector */}
        <div>
          <label className="mb-2 block text-sm font-medium text-muted">Material</label>
          <select
            value={selectedDoc}
            onChange={(e) => setSelectedDoc(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-white outline-none focus:border-primary"
          >
            {documents.map((d) => (
              <option key={d.id} value={d.id}>{d.title}</option>
            ))}
          </select>
        </div>

        {/* Topic search */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder='Search a topic... e.g. "Normalization", "Pointers", "RAG"'
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLearn()}
            className="w-full rounded-xl border border-border bg-surface py-3.5 pl-10 pr-4 text-sm text-white placeholder-muted outline-none transition-colors focus:border-primary"
          />
        </div>

        <button
          onClick={handleLearn}
          disabled={!topic.trim() || !selectedDoc}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-white transition-all hover:bg-primary-hover disabled:opacity-40"
        >
          <BookOpen size={18} />
          Start Learning
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Learn session page**

`apps/frontend/src/pages/LearnSession.tsx`:
```typescript
import { useEffect, useState, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { ArrowLeft, FileText, Send } from 'lucide-react'
import { useSSE } from '../lib/sse.ts'
import StreamingText from '../components/StreamingText.tsx'
import type { ChatMessage, MessageRole } from 'shared'

export default function LearnSession() {
  const { sessionId: documentId } = useParams<{ sessionId: string }>()
  const [searchParams] = useSearchParams()
  const topic = searchParams.get('topic') ?? ''
  const { getToken } = useAuth()
  const navigate = useNavigate()

  const { text: explanation, streaming: loadingExplanation, stream: streamExplanation } = useSSE()
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const { text: chatResponse, streaming: streamingChat, stream: streamChat, reset } = useSSE()
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Load initial explanation
  useEffect(() => {
    if (!documentId || !topic) return
    async function load() {
      const token = await getToken()
      if (!token) return
      streamExplanation('/api/learn', { documentId, topic }, token)
    }
    load()
  }, [documentId, topic, getToken, streamExplanation])

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
    await streamChat('/api/ask', { documentId, message, history }, token)

    setChatHistory((prev) => [
      ...prev,
      { id: (Date.now() + 1).toString(), user_id: '', document_id: documentId, role: 'assistant', content: chatResponse, mode: 'learn', created_at: new Date().toISOString() },
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
            <div className="rounded-xl border border-border bg-surface p-6">
              <h2 className="mb-4 font-semibold text-primary">AI Explanation</h2>
              {explanation ? (
                <StreamingText text={explanation} streaming={loadingExplanation} />
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
                      : 'bg-surface border border-border text-white'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {streamingChat && chatResponse && (
              <div className="inline-block max-w-[85%] rounded-xl border border-border bg-surface px-3 py-2">
                <StreamingText text={chatResponse} streaming={streamingChat} className="text-sm" />
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
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/pages/Learn.tsx apps/frontend/src/pages/LearnSession.tsx
git commit -m "feat: learn topic search + learn session with AI explanation and tutor chat"
```

---

## Task 10: Ask AI Page

**Files:**
- Create: `apps/frontend/src/pages/AskAI.tsx`

- [ ] **Step 1: Build Ask AI page**

`apps/frontend/src/pages/AskAI.tsx`:
```typescript
import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { Send } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import { useSSE } from '../lib/sse.ts'
import StreamingText from '../components/StreamingText.tsx'
import type { Document, ChatMessage, MessageRole } from 'shared'

export default function AskAI() {
  const { getToken } = useAuth()
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDoc, setSelectedDoc] = useState('')
  const [history, setHistory] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const { text, streaming, stream, reset } = useSSE()
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const api = makeApi(token)
      const res = await api.documents.list()
      const ready = res.documents.filter((d) => d.status === 'ready')
      setDocuments(ready)
      if (ready.length > 0) setSelectedDoc(ready[0].id)
    }
    load()
  }, [getToken])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, text])

  async function send() {
    if (!input.trim() || streaming || !selectedDoc) return
    const message = input.trim()
    setInput('')
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      user_id: '', document_id: selectedDoc,
      role: 'user' as MessageRole, content: message, mode: 'ask',
      created_at: new Date().toISOString(),
    }
    setHistory((prev) => [...prev, userMsg])
    reset()

    const token = await getToken()
    if (!token) return
    const chatHistory = history.map((m) => ({ role: m.role, content: m.content }))
    await stream('/api/ask', { documentId: selectedDoc, message, history: chatHistory }, token)

    const assistantMsg: ChatMessage = {
      id: (Date.now() + 1).toString(), user_id: '', document_id: selectedDoc,
      role: 'assistant', content: text, mode: 'ask',
      created_at: new Date().toISOString(),
    }
    setHistory((prev) => [...prev, assistantMsg])
    reset()
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-bold text-white">AI Tutor</h1>
          <p className="text-xs text-muted">Ask anything from your study material</p>
        </div>
        <select
          value={selectedDoc}
          onChange={(e) => { setSelectedDoc(e.target.value); setHistory([]) }}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-white outline-none focus:border-primary"
        >
          {documents.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
        </select>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {history.length === 0 && !streaming && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted">Select a material and ask your first question.</p>
          </div>
        )}
        {history.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm ${
              msg.role === 'user' ? 'bg-primary text-white' : 'border border-border bg-surface text-white'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {streaming && text && (
          <div className="flex justify-start">
            <div className="max-w-[70%] rounded-2xl border border-border bg-surface px-4 py-3">
              <StreamingText text={text} streaming={streaming} />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border p-4">
        <div className="flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Ask anything about your material..."
            className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-white placeholder-muted outline-none focus:border-primary"
          />
          <button
            onClick={send}
            disabled={!input.trim() || streaming}
            className="rounded-xl bg-primary px-4 py-3 text-white hover:bg-primary-hover disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/pages/AskAI.tsx
git commit -m "feat: Ask AI page — streaming chat with document selector"
```

---

## Task 11: Test Pages (New + Take + Results)

**Files:**
- Create: `apps/frontend/src/pages/TestNew.tsx`
- Create: `apps/frontend/src/pages/TestTake.tsx`
- Create: `apps/frontend/src/pages/TestResults.tsx`

- [ ] **Step 1: Test configuration page**

`apps/frontend/src/pages/TestNew.tsx`:
```typescript
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { Loader2 } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import type { Document, TestType, Difficulty } from 'shared'

const TYPES: { value: TestType; label: string }[] = [
  { value: 'mcq', label: 'MCQ' },
  { value: 'one_mark', label: '1 Mark' },
  { value: 'two_mark', label: '2 Mark' },
  { value: 'five_mark', label: '5 Mark' },
  { value: 'mixed', label: 'Mixed' },
]

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
]

export default function TestNew() {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [documents, setDocuments] = useState<Document[]>([])
  const [form, setForm] = useState({ documentId: '', topic: '', count: 10, type: 'mcq' as TestType, difficulty: 'medium' as Difficulty })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const res = await makeApi(token).documents.list()
      const ready = res.documents.filter((d) => d.status === 'ready')
      setDocuments(ready)
      if (ready.length > 0) setForm((f) => ({ ...f, documentId: ready[0].id }))
    }
    load()
  }, [getToken])

  async function generate() {
    if (!form.documentId || !form.topic.trim()) return
    setLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      const res = await makeApi(token).test.generate({ ...form, count: form.count, topic: form.topic.trim() })
      navigate(`/test/${res.test.id}`)
    } catch (err) {
      alert('Failed to generate test. Check your settings.')
    } finally {
      setLoading(false)
    }
  }

  function toggle<T>(field: keyof typeof form, val: T) {
    setForm((f) => ({ ...f, [field]: val }))
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Create Test</h1>
        <p className="mt-1 text-muted">Configure your AI-generated test.</p>
      </div>

      <div className="max-w-lg space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-muted">Material</label>
          <select value={form.documentId} onChange={(e) => toggle('documentId', e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-white outline-none focus:border-primary">
            {documents.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-muted">Topic</label>
          <input type="text" placeholder='e.g. "Normalization"' value={form.topic}
            onChange={(e) => toggle('topic', e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-white placeholder-muted outline-none focus:border-primary" />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-muted">Questions: {form.count}</label>
          <input type="range" min={3} max={20} value={form.count}
            onChange={(e) => toggle('count', Number(e.target.value))}
            className="w-full accent-primary" />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-muted">Type</label>
          <div className="flex flex-wrap gap-2">
            {TYPES.map(({ value, label }) => (
              <button key={value} onClick={() => toggle('type', value)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  form.type === value ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted hover:border-primary/40 hover:text-white'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-muted">Difficulty</label>
          <div className="flex gap-2">
            {DIFFICULTIES.map(({ value, label }) => (
              <button key={value} onClick={() => toggle('difficulty', value)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  form.difficulty === value ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted hover:border-primary/40 hover:text-white'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <button onClick={generate} disabled={!form.documentId || !form.topic.trim() || loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-white hover:bg-primary-hover disabled:opacity-40">
          {loading ? <><Loader2 size={18} className="animate-spin" /> Generating...</> : 'Generate Test'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Test taking page (timer + tab-switch)**

`apps/frontend/src/pages/TestTake.tsx`:
```typescript
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { AlertTriangle, Clock } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import type { Test, TestQuestion } from 'shared'

export default function TestTake() {
  const { testId } = useParams<{ testId: string }>()
  const { getToken } = useAuth()
  const navigate = useNavigate()

  const [test, setTest] = useState<Test | null>(null)
  const [questions, setQuestions] = useState<TestQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentQ, setCurrentQ] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [tabSwitches, setTabSwitches] = useState(0)
  const [tabWarning, setTabWarning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const startTime = useRef(Date.now())

  // Load test
  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token || !testId) return
      const res = await makeApi(token).test.get(testId)
      setTest(res.test)
      setQuestions(res.questions)
    }
    load()
  }, [testId, getToken])

  // Elapsed timer
  useEffect(() => {
    const id = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime.current) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // Tab-switch detection
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) {
        setTabSwitches((n) => n + 1)
        setTabWarning(true)
        setTimeout(() => setTabWarning(false), 3000)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  const formatTime = useCallback((s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }, [])

  async function submit() {
    if (!testId) return
    setSubmitting(true)
    try {
      const token = await getToken()
      if (!token) return
      await makeApi(token).test.submit(testId, {
        answers,
        timeElapsed: elapsedSeconds,
        tabSwitches,
      })
      navigate(`/test/${testId}/results`)
    } catch {
      alert('Failed to submit. Please try again.')
      setSubmitting(false)
    }
  }

  if (!test || questions.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const q = questions[currentQ]
  const answered = Object.keys(answers).length

  return (
    <div className="flex h-screen flex-col">
      {/* Tab switch warning banner */}
      {tabWarning && (
        <div className="flex items-center gap-2 bg-danger/20 px-6 py-2 text-sm text-danger">
          <AlertTriangle size={14} />
          Tab switching detected! ({tabSwitches} time{tabSwitches !== 1 ? 's' : ''})
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="font-bold text-white">{test.topic}</h1>
          <p className="text-xs text-muted">{answered}/{questions.length} answered</p>
        </div>
        <div className="flex items-center gap-4">
          {tabSwitches > 0 && (
            <span className="flex items-center gap-1 text-xs text-danger">
              <AlertTriangle size={12} /> {tabSwitches} tab switch{tabSwitches !== 1 ? 'es' : ''}
            </span>
          )}
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5">
            <Clock size={13} className="text-muted" />
            <span className="font-mono text-sm text-white">{formatTime(elapsedSeconds)}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Question sidebar */}
        <div className="w-16 overflow-y-auto border-r border-border bg-surface p-2">
          <div className="space-y-1">
            {questions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentQ(i)}
                className={`h-10 w-10 rounded-lg text-sm font-medium transition-colors ${
                  i === currentQ ? 'bg-primary text-white'
                  : answers[questions[i].id] ? 'bg-success/20 text-success'
                  : 'bg-bg text-muted hover:bg-white/5 hover:text-white'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Question area */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-2xl">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted">
                Question {currentQ + 1} of {questions.length}
              </span>
              <span className="rounded bg-primary/15 px-2 py-0.5 text-xs text-primary">
                {q.marks} mark{q.marks !== 1 ? 's' : ''}
              </span>
            </div>

            <p className="mb-6 text-lg font-medium leading-relaxed text-white">{q.question}</p>

            {/* MCQ options */}
            {q.options ? (
              <div className="space-y-3">
                {q.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt[0] }))}
                    className={`w-full rounded-xl border px-4 py-3.5 text-left text-sm transition-colors ${
                      answers[q.id] === opt[0]
                        ? 'border-primary bg-primary/15 text-white'
                        : 'border-border text-muted hover:border-primary/40 hover:text-white'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              /* Text answer */
              <textarea
                value={answers[q.id] ?? ''}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                rows={4}
                placeholder="Write your answer here..."
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-white placeholder-muted outline-none focus:border-primary"
              />
            )}

            {/* Navigation */}
            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={() => setCurrentQ((n) => Math.max(0, n - 1))}
                disabled={currentQ === 0}
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-white disabled:opacity-30"
              >
                ← Previous
              </button>

              {currentQ < questions.length - 1 ? (
                <button
                  onClick={() => setCurrentQ((n) => n + 1)}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="rounded-lg bg-success px-5 py-2 text-sm font-bold text-white hover:bg-success/90 disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Test'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Test results page**

`apps/frontend/src/pages/TestResults.tsx`:
```typescript
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { CheckCircle, XCircle, AlertTriangle, Clock, ArrowLeft, RotateCcw } from 'lucide-react'
import { makeApi } from '../lib/api.ts'
import type { TestAttempt, TestQuestion } from 'shared'

export default function TestResults() {
  const { testId } = useParams<{ testId: string }>()
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [attempt, setAttempt] = useState<TestAttempt | null>(null)
  const [questions, setQuestions] = useState<TestQuestion[]>([])

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token || !testId) return
      // The attempt was just submitted — load questions to show review
      const res = await makeApi(token).test.get(testId)
      setQuestions(res.questions)
      // Get latest attempt
      const attemptsRes = await makeApi(token).test.attempts()
      const latest = attemptsRes.attempts.find((a) => a.test_id === testId)
      if (latest) setAttempt(latest as unknown as TestAttempt)
    }
    load()
  }, [testId, getToken])

  if (!attempt) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const pct = Math.round((attempt.score / attempt.total_marks) * 100)
  const passed = pct >= 60
  const fmt = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-4">
        <button onClick={() => navigate('/test/new')} className="text-muted hover:text-white">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-2xl font-bold text-white">Test Results</h1>
      </div>

      {/* Score card */}
      <div className="mb-8 rounded-2xl border border-border bg-surface p-8 text-center">
        <div className={`text-6xl font-black ${passed ? 'text-success' : 'text-danger'}`}>
          {pct}%
        </div>
        <p className="mt-2 text-xl font-semibold text-white">
          {attempt.score} / {attempt.total_marks} marks
        </p>
        <p className={`mt-1 text-sm font-medium ${passed ? 'text-success' : 'text-danger'}`}>
          {passed ? 'Well done! 🎉' : 'Keep practicing! 💪'}
        </p>

        <div className="mt-6 flex justify-center gap-8 border-t border-border pt-6">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Clock size={14} />
            {attempt.time_elapsed_seconds ? fmt(attempt.time_elapsed_seconds) : '—'}
          </div>
          {attempt.tab_switches > 0 && (
            <div className="flex items-center gap-2 text-sm text-danger">
              <AlertTriangle size={14} />
              {attempt.tab_switches} tab switch{attempt.tab_switches !== 1 ? 'es' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Question review */}
      <h2 className="mb-4 font-semibold text-white">Review</h2>
      <div className="space-y-4">
        {questions.map((q, i) => {
          const userAnswer = (attempt.answers as Record<string, string>)[q.id] ?? ''
          const correct = userAnswer.trim().toLowerCase() === q.correct_answer.trim().toLowerCase()
          return (
            <div key={q.id} className={`rounded-xl border p-5 ${correct ? 'border-success/30 bg-success/5' : 'border-danger/30 bg-danger/5'}`}>
              <div className="flex items-start gap-3">
                {correct ? <CheckCircle size={18} className="mt-0.5 shrink-0 text-success" /> : <XCircle size={18} className="mt-0.5 shrink-0 text-danger" />}
                <div className="flex-1">
                  <p className="mb-2 text-sm font-medium text-white">
                    Q{i + 1}. {q.question}
                  </p>
                  <p className="text-xs text-muted">Your answer: <span className={correct ? 'text-success' : 'text-danger'}>{userAnswer || '(no answer)'}</span></p>
                  {!correct && <p className="mt-1 text-xs text-muted">Correct: <span className="text-success">{q.correct_answer}</span></p>}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-8 flex gap-3">
        <button onClick={() => navigate('/test/new')} className="flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-muted hover:text-white">
          <RotateCcw size={15} /> New Test
        </button>
        <button onClick={() => navigate('/progress')} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover">
          View Progress →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/pages/TestNew.tsx apps/frontend/src/pages/TestTake.tsx apps/frontend/src/pages/TestResults.tsx
git commit -m "feat: test pages — config form, take test with timer+tab detection, results review"
```

---

## Task 12: Progress Page

**Files:**
- Create: `apps/frontend/src/pages/Progress.tsx`

- [ ] **Step 1: Build Progress page**

`apps/frontend/src/pages/Progress.tsx`:
```typescript
import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import { makeApi } from '../lib/api.ts'
import type { ProgressResponse } from 'shared'

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-3xl font-black text-white">{value}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  )
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function Progress() {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<ProgressResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const res = await makeApi(token).progress.get()
      setData(res)
      setLoading(false)
    }
    load()
  }, [getToken])

  if (loading || !data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Your Progress</h1>
        <p className="mt-1 text-muted">Track your learning journey.</p>
      </div>

      {/* Stats grid */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Tests Completed" value={data.testsCompleted} />
        <StatCard label="Topics Learned" value={data.topicsLearned} />
        <StatCard label="Average Score" value={`${data.averageScore}%`} />
        <StatCard label="Study Time" value={formatTime(data.studyTimeSeconds)} />
      </div>

      {/* Topic performance */}
      {data.topicPerformance.length > 0 && (
        <div className="mb-8 rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-5 font-semibold text-white">Topic Performance</h2>
          <div className="space-y-4">
            {data.topicPerformance.map(({ topic, score }) => (
              <div key={topic}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="text-white">{topic}</span>
                  <span className={score >= 70 ? 'text-success' : 'text-danger'}>{score}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-bg">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${score >= 70 ? 'bg-success' : 'bg-danger'}`}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Topics to review */}
      {data.topicsToReview.length > 0 && (
        <div className="rounded-xl border border-amber-DEFAULT/30 bg-amber-muted p-6">
          <h2 className="mb-4 font-semibold text-amber-DEFAULT">⚠ Topics to Review</h2>
          <ol className="mb-4 list-inside list-decimal space-y-2">
            {data.topicsToReview.map((t) => (
              <li key={t} className="text-sm text-white">{t}</li>
            ))}
          </ol>
          <button
            onClick={() => navigate('/test/new')}
            className="rounded-lg bg-amber-DEFAULT px-4 py-2 text-sm font-semibold text-bg hover:opacity-90"
          >
            Start Revision
          </button>
        </div>
      )}

      {data.testsCompleted === 0 && (
        <div className="py-16 text-center">
          <p className="text-muted">No test data yet.</p>
          <button onClick={() => navigate('/test/new')} className="mt-3 text-sm text-primary hover:underline">
            Take your first test →
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/pages/Progress.tsx
git commit -m "feat: progress page — stats grid, topic performance bars, revision suggestions"
```

---

## Task 13: Settings Page

**Files:**
- Create: `apps/frontend/src/pages/Settings.tsx`

- [ ] **Step 1: Build Settings page**

`apps/frontend/src/pages/Settings.tsx`:
```typescript
import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { Save, Eye, EyeOff } from 'lucide-react'
import { makeApi } from '../lib/api.ts'

export default function Settings() {
  const { getToken } = useAuth()
  const [form, setForm] = useState({ openrouterKey: '', ollamaUrl: 'http://localhost:11434', defaultModel: 'google/gemini-flash-1.5' })
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      const res = await makeApi(token).settings.get()
      setForm((f) => ({
        ...f,
        ollamaUrl: res.settings.ollamaUrl ?? f.ollamaUrl,
        defaultModel: res.settings.defaultModel ?? f.defaultModel,
      }))
    }
    load()
  }, [getToken])

  async function save() {
    setSaving(true)
    try {
      const token = await getToken()
      if (!token) return
      const update: Record<string, string> = {
        ollamaUrl: form.ollamaUrl,
        defaultModel: form.defaultModel,
      }
      if (form.openrouterKey && !form.openrouterKey.includes('...')) {
        update.openrouterKey = form.openrouterKey
      }
      await makeApi(token).settings.update(update)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-muted">Configure your AI provider settings.</p>
      </div>

      <div className="max-w-lg space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-muted">OpenRouter API Key</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={form.openrouterKey}
              onChange={(e) => setForm((f) => ({ ...f, openrouterKey: e.target.value }))}
              placeholder="sk-or-..."
              className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 pr-10 text-sm text-white placeholder-muted outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
            >
              {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <p className="mt-1 text-xs text-subtle">Get a key at openrouter.ai — supports 100+ models.</p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-muted">Default Model</label>
          <input
            type="text"
            value={form.defaultModel}
            onChange={(e) => setForm((f) => ({ ...f, defaultModel: e.target.value }))}
            placeholder="google/gemini-flash-1.5"
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-white placeholder-muted outline-none focus:border-primary"
          />
          <p className="mt-1 text-xs text-subtle">
            Any OpenRouter model ID. e.g. anthropic/claude-3.5-sonnet, openai/gpt-4o
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-muted">Ollama URL</label>
          <input
            type="text"
            value={form.ollamaUrl}
            onChange={(e) => setForm((f) => ({ ...f, ollamaUrl: e.target.value }))}
            placeholder="http://localhost:11434"
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-white placeholder-muted outline-none focus:border-primary"
          />
          <p className="mt-1 text-xs text-subtle">
            URL of your Ollama instance running nomic-embed-text.
          </p>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          <Save size={16} />
          {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/pages/Settings.tsx
git commit -m "feat: settings page — OpenRouter key, Ollama URL, default model"
```

---

## Task 14: End-to-End Frontend Verification

Manual walkthrough of the complete user flow.

- [ ] **Step 1: Ensure backend is running**

```bash
cd apps/backend && pnpm dev
# Should output: Backend running on http://localhost:3001
```

- [ ] **Step 2: Start frontend**

```bash
cd apps/frontend && pnpm dev
# Should output: Local: http://localhost:5173/
```

- [ ] **Step 3: Verify landing page**

Open http://localhost:5173 — should see hero, 3 mode cards, RAG flow diagram. Click "Get Started" — redirects to sign-up.

- [ ] **Step 4: Sign up and reach dashboard**

Complete Clerk sign-up → redirected to `/dashboard`. Should see greeting, empty materials list, empty recent activity.

- [ ] **Step 5: Upload a PDF**

Go to Materials → drag a PDF into the upload zone. Should see progress steps (Uploading → Extracting → Chunking → Embedding). Document appears in list. Status changes to "Ready" after processing completes.

- [ ] **Step 6: Learn a topic**

Go to Learn → select your document → type a topic → Start Learning. Should see streaming AI explanation. Type a question in the tutor chat panel → get a streaming response.

- [ ] **Step 7: Ask AI**

Go to Ask AI → select document → type question → hit Enter. Should see streaming response in chat bubble.

- [ ] **Step 8: Generate and take a test**

Go to Tests → select document, topic, 5 questions, MCQ, medium → Generate Test. Should navigate to test page with timer running and question sidebar. Answer questions → Submit Test.

- [ ] **Step 9: Verify results page**

Should see score, time elapsed, tab-switch count (if any), per-question review with correct answers.

- [ ] **Step 10: Check progress page**

Go to Progress → should see stats populated from the test just taken.

- [ ] **Step 11: Final commit**

```bash
git add .
git commit -m "chore: frontend complete — all 11 pages built and verified end-to-end"
```

---

## Summary

The frontend is now complete with:

- Vite + React 18 + Tailwind with Midnight Indigo design system
- Clerk authentication (sign-in/sign-up, protected routes, auth guard)
- Circle Stamp logo + collapsible sidebar navigation
- Typed API client and SSE streaming hook
- 11 pages: Landing, Dashboard, Materials, Learn, LearnSession, AskAI, TestNew, TestTake, TestResults, Progress, Settings
- PDF upload with multi-step animated progress indicator
- Test taking with elapsed timer, tab-switch detection + warning banner, question sidebar navigation
- Streaming AI responses via SSE for Learn and Ask AI pages
- Progress dashboard with topic performance bars and revision suggestions

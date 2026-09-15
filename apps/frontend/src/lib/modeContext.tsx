/**
 * App mode context — 'student' | 'teacher'
 * Only users who canTeach can switch to teacher mode.
 * Mode is persisted in localStorage so it survives refresh.
 */

import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'

export type AppMode = 'student' | 'teacher'

interface ModeContextValue {
  mode: AppMode
  setMode: (m: AppMode) => void
  toggleMode: () => void
}

const ModeContext = createContext<ModeContextValue | null>(null)

const STORAGE_KEY = 'academiq_app_mode'

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored === 'teacher' ? 'teacher' : 'student'
    } catch {
      return 'student'
    }
  })

  const setMode = useCallback((m: AppMode) => {
    setModeState(m)
    try { localStorage.setItem(STORAGE_KEY, m) } catch { /* ignore */ }
  }, [])

  const toggleMode = useCallback(() => {
    setMode(mode === 'student' ? 'teacher' : 'student')
  }, [mode, setMode])

  return (
    <ModeContext.Provider value={{ mode, setMode, toggleMode }}>
      {children}
    </ModeContext.Provider>
  )
}

export function useMode() {
  const ctx = useContext(ModeContext)
  if (!ctx) throw new Error('useMode must be used within ModeProvider')
  return ctx
}

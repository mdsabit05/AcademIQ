import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { ThemeProvider, useTheme } from './theme.tsx'

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

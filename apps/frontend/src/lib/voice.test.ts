import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVoiceInput } from './voice.ts'

describe('useVoiceInput', () => {
  beforeEach(() => {
    delete (window as any).SpeechRecognition
    delete (window as any).webkitSpeechRecognition
  })

  it('reports not supported when SpeechRecognition is absent', () => {
    const { result } = renderHook(() => useVoiceInput(vi.fn()))
    expect(result.current.supported).toBe(false)
  })

  it('reports supported when SpeechRecognition is present', () => {
    const mockRecognition = {
      start: vi.fn(), stop: vi.fn(), abort: vi.fn(),
      continuous: false, interimResults: false, lang: '',
      onresult: null, onend: null, onerror: null,
    }
    ;(window as any).SpeechRecognition = vi.fn(() => mockRecognition)
    const { result } = renderHook(() => useVoiceInput(vi.fn()))
    expect(result.current.supported).toBe(true)
  })

  it('toggle starts listening when not already listening', () => {
    const mockRecognition = {
      start: vi.fn(), stop: vi.fn(), abort: vi.fn(),
      continuous: false, interimResults: false, lang: '',
      onresult: null, onend: null, onerror: null,
    }
    ;(window as any).SpeechRecognition = vi.fn(() => mockRecognition)
    const { result } = renderHook(() => useVoiceInput(vi.fn()))
    act(() => result.current.toggle())
    expect(mockRecognition.start).toHaveBeenCalledOnce()
    expect(result.current.listening).toBe(true)
  })

  it('toggle stops listening when already listening', () => {
    const mockRecognition = {
      start: vi.fn(), stop: vi.fn(), abort: vi.fn(),
      continuous: false, interimResults: false, lang: '',
      onresult: null, onend: null, onerror: null,
    }
    ;(window as any).SpeechRecognition = vi.fn(() => mockRecognition)
    const { result } = renderHook(() => useVoiceInput(vi.fn()))
    act(() => result.current.toggle()) // start
    act(() => result.current.toggle()) // stop
    expect(mockRecognition.stop).toHaveBeenCalledOnce()
    expect(result.current.listening).toBe(false)
  })
})

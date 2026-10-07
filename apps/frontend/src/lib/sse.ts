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
        let buf = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            buf += decoder.decode()
            break
          }

          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() ?? ''

          for (const rawLine of lines) {
            const line = rawLine.replace(/\r$/, '').trim()
            if (!line.startsWith('data: ')) continue
            try {
              const parsed = JSON.parse(line.slice(6))
              const t: string = parsed.token ?? (typeof parsed === 'string' ? parsed : '')
              if (t) {
                accumulated += t
                setText((prev) => prev + t)
                options.onToken?.(t)
              }
            } catch {
              // skip malformed lines
            }
          }
        }

        options.onDone?.(accumulated)
        return accumulated
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          options.onError?.(err as Error)
        }
        return accumulated
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

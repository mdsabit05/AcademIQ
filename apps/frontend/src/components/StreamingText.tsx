import { memo, useEffect, useRef } from 'react'
import { clsx } from 'clsx'
import { marked } from 'marked'

interface StreamingTextProps {
  text: string
  streaming?: boolean
  className?: string
}

export default memo(function StreamingText({ text, streaming, className }: StreamingTextProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (streaming) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [text, streaming])

  const html = marked.parse(text, { gfm: true, breaks: false }) as string

  // Inject copy buttons into every <pre> block after render
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.querySelectorAll('pre').forEach((pre) => {
      if (pre.querySelector('.copy-code-btn')) return
      const btn = document.createElement('button')
      btn.className = 'copy-code-btn'
      btn.setAttribute('aria-label', 'Copy code')
      btn.textContent = 'Copy'
      btn.onclick = () => {
        const code = pre.querySelector('code')?.textContent ?? ''
        navigator.clipboard.writeText(code).then(() => {
          btn.textContent = 'Copied!'
          setTimeout(() => { btn.textContent = 'Copy' }, 2000)
        }).catch(() => {})
      }
      pre.appendChild(btn)
    })
  }, [html])

  return (
    <div className={clsx('ai-md text-[15px] sm:text-base leading-relaxed', className)}>
      <div ref={containerRef} dangerouslySetInnerHTML={{ __html: html }} />
      {streaming && !text && (
        <span className="inline-flex items-center gap-1 py-1">
          <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
          <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
          <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
        </span>
      )}
      {streaming && text && (
        <span className="ml-1 inline-flex items-center gap-0.5 align-middle">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
        </span>
      )}
      <div ref={endRef} />
    </div>
  )
})

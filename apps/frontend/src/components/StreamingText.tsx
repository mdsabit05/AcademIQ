import { memo, useEffect, useRef } from 'react'
import { clsx } from 'clsx'
import { marked } from 'marked'

interface StreamingTextProps {
  text: string
  streaming?: boolean
  className?: string
}

export default memo(function StreamingText({ text, streaming, className }: StreamingTextProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (streaming) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [text, streaming])

  const html = marked.parse(text, { gfm: true, breaks: false }) as string

  return (
    <div className={clsx('ai-md text-sm leading-relaxed', className)}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
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

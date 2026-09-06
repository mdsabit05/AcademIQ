import { useEffect, useRef } from 'react'
import { clsx } from 'clsx'
import ReactMarkdown from 'react-markdown'

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
    <div className={clsx('text-sm leading-relaxed text-white/90', className)}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h1 className="mb-3 text-xl font-bold text-white">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-2 mt-4 text-lg font-bold text-white">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-2 mt-3 text-base font-semibold text-white">{children}</h3>,
          p: ({ children }) => <p className="mb-3">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          ul: ({ children }) => <ul className="mb-3 ml-4 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 ml-4 list-decimal space-y-1">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          code: ({ children }) => <code className="rounded bg-bg px-1 py-0.5 font-mono text-xs text-cyan-DEFAULT">{children}</code>,
          hr: () => <hr className="my-4 border-border" />,
        }}
      >
        {text}
      </ReactMarkdown>
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
}

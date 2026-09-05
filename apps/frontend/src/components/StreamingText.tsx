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

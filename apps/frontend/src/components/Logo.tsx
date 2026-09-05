import { clsx } from 'clsx'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showWordmark?: boolean
  className?: string
}

const sizeMap = {
  sm: { ring: 'w-7 h-7', text: 'text-[9px]', tag: 'text-[5px]', word: 'text-sm' },
  md: { ring: 'w-9 h-9', text: 'text-xs', tag: 'text-[6px]', word: 'text-base' },
  lg: { ring: 'w-16 h-16', text: 'text-xl', tag: 'text-[9px]', word: 'text-2xl' },
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

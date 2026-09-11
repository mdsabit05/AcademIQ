import { clsx } from 'clsx'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showWordmark?: boolean
  className?: string
}

const sizeMap = {
  sm: { ring: 'w-7 h-7', text: 'text-[11px]', word: 'text-sm' },
  md: { ring: 'w-9 h-9', text: 'text-sm', word: 'text-base' },
  lg: { ring: 'w-14 h-14', text: 'text-xl', word: 'text-2xl' },
}

export default function Logo({ size = 'md', showWordmark = true, className }: LogoProps) {
  const s = sizeMap[size]

  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <div
        className={clsx(
          s.ring,
          'flex shrink-0 items-center justify-center rounded-lg bg-primary',
        )}
      >
        <span className={clsx(s.text, 'font-black leading-none text-white tracking-tight')}>
          A
        </span>
      </div>
      {showWordmark && (
        <span className={clsx(s.word, 'font-bold text-white tracking-tight')}>
          Academ<span className="text-primary">IQ</span>
        </span>
      )}
    </div>
  )
}

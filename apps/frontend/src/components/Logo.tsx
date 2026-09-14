import { clsx } from 'clsx'
import { useTheme } from '../lib/theme.tsx'
import newlogoUrl from '../assets/newlogo.svg'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showWordmark?: boolean
  className?: string
}

const heightMap = { sm: 30, md: 48, lg: 64 }

export default function Logo({ size = 'md', showWordmark = true, className }: LogoProps) {
  const h = heightMap[size]
  const { theme } = useTheme()
  const isLight = theme === 'light'

  return (
    <div className={clsx('flex items-center', className)}>
      <img
        src={newlogoUrl}
        style={{
          height: showWordmark ? h : Math.round(h * 0.75),
          width: 'auto',
          objectFit: 'contain',
          filter: isLight ? 'invert(1) hue-rotate(180deg) brightness(0.2)' : 'none',
          transition: 'filter 0.35s',
        }}
        alt="AcademIQ"
      />
    </div>
  )
}

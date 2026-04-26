import type { ReactNode } from 'react'
import { BG_DEEP } from '../../design/colors'

interface PageShellProps {
  children: ReactNode
  dir?: 'rtl' | 'ltr'
  scrollable?: boolean
  className?: string
}

export function PageShell({ children, dir = 'rtl', scrollable = false, className }: PageShellProps) {
  return (
    <div
      dir={dir}
      className={className}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: BG_DEEP,
        overflow: scrollable ? undefined : 'hidden',
        overflowY: scrollable ? 'auto' : undefined,
        overflowX: scrollable ? 'hidden' : undefined,
        position: 'relative',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        WebkitOverflowScrolling: scrollable ? 'touch' : undefined,
      } as React.CSSProperties}
    >
      {children}
    </div>
  )
}

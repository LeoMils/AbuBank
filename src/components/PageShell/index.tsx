import type { ReactNode } from 'react'
import { BG_DEEP } from '../../design/colors'

interface PageShellProps {
  children: ReactNode
  dir?: 'rtl' | 'ltr'
  scrollable?: boolean
  className?: string
  /** Page background. Defaults to the legacy deep solid; pass PAGE_BG (design/theme)
   *  to let a screen participate in the themeable Night-Garden / Bright-Day system. */
  background?: string
}

export function PageShell({ children, dir = 'rtl', scrollable = false, className, background = BG_DEEP }: PageShellProps) {
  return (
    <div
      dir={dir}
      className={className}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background,
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

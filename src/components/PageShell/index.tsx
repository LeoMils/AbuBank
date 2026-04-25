import type { ReactNode } from 'react'
import { BG_DEEP } from '../../design/colors'

interface PageShellProps {
  children: ReactNode
  dir?: 'rtl' | 'ltr'
}

export function PageShell({ children, dir = 'rtl' }: PageShellProps) {
  return (
    <div
      dir={dir}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: BG_DEEP,
        overflow: 'hidden',
        position: 'relative',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {children}
    </div>
  )
}

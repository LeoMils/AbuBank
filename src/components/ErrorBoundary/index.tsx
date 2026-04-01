import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[AbuBank]', error.message, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          style={{
            height: '100dvh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: '#030508', color: 'rgba(255,255,255,0.75)',
            fontFamily: "'DM Sans','Heebo',sans-serif",
            padding: 32, textAlign: 'center', gap: 16,
          }}
        >
          <div role="img" aria-label="אזהרה" style={{ fontSize: 48 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 500 }}>משהו השתבש</div>
          <div style={{ fontSize: 14, opacity: 0.6 }}>נסי לרענן את הדף</div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8, padding: '12px 28px', borderRadius: 8,
              background: '#0d9488', color: 'white', fontSize: 14,
              fontWeight: 500, border: 'none', cursor: 'pointer',
            }}
          >
            רענן
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { useAppStore } from '../../state/store'
import { Screen } from '../../state/types'

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

  private handleGoHome = () => {
    this.setState({ hasError: false })
    useAppStore.getState().setScreen(Screen.Home)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          role="alert"
          style={{
            height: '100dvh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: '#050A18', color: 'rgba(255,255,255,0.85)',
            fontFamily: "'Heebo','DM Sans',sans-serif",
            padding: 32, textAlign: 'center', gap: 20,
          }}
        >
          <div role="img" aria-label="שגיאה" style={{ fontSize: 56 }}>😔</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>משהו לא עבד</div>
          <div style={{ fontSize: 16, opacity: 0.6, lineHeight: 1.6 }}>
            לא נורא — לחצי לחזור הביתה
          </div>
          <button
            type="button"
            onClick={this.handleGoHome}
            style={{
              marginTop: 8, padding: '16px 36px', borderRadius: 14,
              background: 'linear-gradient(135deg, #D4A853 0%, #C9A84C 100%)',
              color: 'rgba(0,0,0,0.85)', fontSize: 18,
              fontWeight: 700, border: 'none', cursor: 'pointer',
              fontFamily: "'Heebo',sans-serif",
              minHeight: 56, minWidth: 160,
              boxShadow: '0 4px 20px rgba(201,168,76,0.40)',
            }}
          >
            חזרה הביתה
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px', borderRadius: 8,
              background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.35)', fontSize: 14,
              cursor: 'pointer', fontFamily: "'Heebo',sans-serif",
            }}
          >
            רענון מלא
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

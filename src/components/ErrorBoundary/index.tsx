import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { useAppStore } from '../../state/store'
import { Screen } from '../../state/types'
import { dumpTurns } from '../../screens/AbuAI/liveTurnDiagnostics'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  /** the technical reason — surfaced (copyable) so a generic error is debuggable. */
  reason: string
  stack: string
  copied: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, reason: '', stack: '', copied: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, reason: error?.message ?? 'unknown' }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[AbuBank]', error.message, info.componentStack)
    this.setState({ stack: info.componentStack ?? '' })
  }

  private handleGoHome = () => {
    this.setState({ hasError: false, reason: '', stack: '', copied: false })
    useAppStore.getState().setScreen(Screen.Home)
  }

  /** Copy the exact failure reason + the last 20 AbuAI turns for support/Leo. */
  private handleCopyDetails = () => {
    const details = `AbuBank error: ${this.state.reason}\n\ncomponentStack:${this.state.stack}\n\n${dumpTurns()}`
    try {
      const nav = (globalThis as unknown as { navigator?: { clipboard?: { writeText(s: string): Promise<void> } } }).navigator
      if (nav?.clipboard?.writeText) { void nav.clipboard.writeText(details); this.setState({ copied: true }) }
    } catch { /* clipboard unavailable */ }
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
          {/* Diagnostic reason — calm for Martita, but copyable so Leo can debug the
              exact failure (never a bare "משהו לא עבד" with no cause). */}
          <button
            type="button"
            data-testid="error-copy-details"
            onClick={this.handleCopyDetails}
            style={{
              marginTop: 4, padding: '6px 14px', borderRadius: 8,
              background: 'transparent', border: '1px solid rgba(255,255,255,0.10)',
              color: 'rgba(255,255,255,0.30)', fontSize: 13,
              cursor: 'pointer', fontFamily: "'Heebo',sans-serif",
            }}
          >
            {this.state.copied ? 'הפרטים הועתקו ✓' : 'העתקת פרטים לתמיכה'}
          </button>
          <div data-testid="error-reason" style={{ fontSize: 11, opacity: 0.28, maxWidth: 320, wordBreak: 'break-word', direction: 'ltr' }}>
            {this.state.reason}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

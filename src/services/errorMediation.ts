// v27: Error mediation layer — NEVER show raw/English errors to Martita
// Every technical error is classified and translated to warm Hebrew + action

export type ErrorCategory =
  | 'quota'
  | 'network'
  | 'timeout'
  | 'mic-denied'
  | 'mic-missing'
  | 'speech-not-understood'
  | 'auth'
  | 'rate-limit'
  | 'unknown'

export type ErrorAction = 'retry' | 'home' | 'whatsapp-leo' | 'dismiss'

export interface MediatedError {
  category: ErrorCategory
  emoji: string
  message: string        // Hebrew, ≤8 words
  primaryLabel: string   // Hebrew button text
  primaryAction: ErrorAction
  secondaryLabel?: string
  secondaryAction?: ErrorAction
}

// v27: Leo's contact is the WhatsApp family group (no phone number stored — privacy rule)
export const LEO_CONTACT_URL = 'https://chat.whatsapp.com/JqqGpPKTCq3L0JnitU5y5f'

function errorText(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try { return JSON.stringify(err) } catch { return '' }
}

export function classifyError(err: unknown, status?: number): ErrorCategory {
  const text = errorText(err).toLowerCase()

  // Mic-related first (DOMExceptions)
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError') return 'mic-denied'
    if (err.name === 'NotFoundError') return 'mic-missing'
    if (err.name === 'AbortError') return 'timeout'
  }

  // Status-based
  if (status === 401 || status === 403) return 'auth'
  if (status === 402) return 'quota'
  if (status === 429) {
    if (text.includes('quota') || text.includes('billing') || text.includes('exceeded')) return 'quota'
    return 'rate-limit'
  }

  // Text-based (for raw fetch errors)
  if (text.includes('quota') || text.includes('billing') || text.includes('insufficient')) return 'quota'
  if (text.includes('unauthorized') || text.includes('invalid_api_key')) return 'auth'
  if (text.includes('timeout') || text.includes('timed out')) return 'timeout'
  if (text.includes('network') || text.includes('failed to fetch')) return 'network'
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'network'

  return 'unknown'
}

export function mediateError(err: unknown, status?: number): MediatedError {
  const category = classifyError(err, status)

  switch (category) {
    case 'quota':
      return {
        category,
        emoji: '💛',
        message: 'נגמרו לי הכוחות היום. ללאו יש את התשובה.',
        primaryLabel: 'להתקשר ללאו',
        primaryAction: 'whatsapp-leo',
        secondaryLabel: 'חזרה הביתה',
        secondaryAction: 'home',
      }

    case 'auth':
      return {
        category,
        emoji: '💛',
        message: 'משהו ברקע דורש טיפול. לאו יעזור.',
        primaryLabel: 'להתקשר ללאו',
        primaryAction: 'whatsapp-leo',
        secondaryLabel: 'חזרה הביתה',
        secondaryAction: 'home',
      }

    case 'network':
      return {
        category,
        emoji: '📡',
        message: 'אין אינטרנט. נחזור כשיהיה חיבור.',
        primaryLabel: 'ננסה שוב',
        primaryAction: 'retry',
        secondaryLabel: 'חזרה הביתה',
        secondaryAction: 'home',
      }

    case 'timeout':
      return {
        category,
        emoji: '⏳',
        message: 'לקח רגע. בואי ננסה עוד פעם.',
        primaryLabel: 'ננסה שוב',
        primaryAction: 'retry',
        secondaryLabel: 'חזרה הביתה',
        secondaryAction: 'home',
      }

    case 'mic-denied':
      return {
        category,
        emoji: '🎤',
        message: 'הטלפון צריך רשות לשמוע אותך.',
        primaryLabel: 'הבנתי',
        primaryAction: 'dismiss',
      }

    case 'mic-missing':
      return {
        category,
        emoji: '🎤',
        message: 'לא מוצאים את המיקרופון בטלפון.',
        primaryLabel: 'חזרה הביתה',
        primaryAction: 'home',
      }

    case 'speech-not-understood':
      return {
        category,
        emoji: '👂',
        message: 'לא שמעתי טוב. אמרי עוד פעם.',
        primaryLabel: 'ננסה שוב',
        primaryAction: 'retry',
      }

    case 'rate-limit':
      return {
        category,
        emoji: '⏳',
        message: 'היום יש עומס. רגע ונחזור.',
        primaryLabel: 'ננסה שוב',
        primaryAction: 'retry',
        secondaryLabel: 'חזרה הביתה',
        secondaryAction: 'home',
      }

    case 'unknown':
    default:
      return {
        category: 'unknown',
        emoji: '💛',
        message: 'משהו קטן לא הלך. ננסה שוב?',
        primaryLabel: 'ננסה שוב',
        primaryAction: 'retry',
        secondaryLabel: 'חזרה הביתה',
        secondaryAction: 'home',
      }
  }
}

/** Execute a mediated error action */
export interface ErrorActionContext {
  onRetry?: (() => void) | undefined
  onHome?: (() => void) | undefined
  onDismiss?: (() => void) | undefined
}

export function executeErrorAction(action: ErrorAction, context: ErrorActionContext): void {
  switch (action) {
    case 'retry':
      context.onRetry?.()
      break
    case 'home':
      context.onHome?.()
      break
    case 'whatsapp-leo':
      window.open(LEO_CONTACT_URL, '_blank', 'noopener,noreferrer')
      break
    case 'dismiss':
      context.onDismiss?.()
      break
  }
}

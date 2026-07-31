import type { MediatedError } from '../../services/errorMediation'
import type { CommunicationAction } from './communication/types'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  // v27: Optional mediated error — if set, render as ErrorCard instead of text bubble
  error?: MediatedError
  // Optional communication handoff (WhatsApp/SMS/…) — if set, render the generic
  // CommunicationActionCard beneath the text (draft + single primary action).
  action?: CommunicationAction
}

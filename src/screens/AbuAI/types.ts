import type { MediatedError } from '../../services/errorMediation'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  // v27: Optional mediated error — if set, render as ErrorCard instead of text bubble
  error?: MediatedError
}

/*
 * Knowledge Router + Online Planner (Phase 8)
 * ═══════════════════════════════════════════
 * Decides WHERE an answer comes from: live web (online), the system clock, or
 * general stable knowledge — and never lets a personal/family/calendar query hit
 * the network. Composes the proven onlineIntent classifier + the runtime's
 * transport/date detectors.
 */
import { isOnlineCurrentInfoQuery, shouldBlockOnlineForPersonal } from './onlineIntent'

export type KnowledgeRoute = 'online' | 'system_clock' | 'general' | 'personal_blocked'

const DATE_TIME_RE = /(?:איזה יום היום|מה היום|מה התאריך|מה השעה|מה השעה עכשיו|qué día es hoy|qué hora es)/u
const TRANSPORT_LIVE_RE = /(?:מתי\s+ה?אוטובוס|ה?אוטובוס\s+ה?בא|מתי\s+ה?רכבת|ה?רכבת\s+מ|מתי\s+ה?טיסה|מזג\s+ה?אוויר|תחזית)/u
// Live local info that isn't time-marked ("מה הסרטים בכפר סבא", "הצגות עכשיו").
const LOCAL_LIVE_RE = /(?:סרטים|קולנוע|הצגות|מה\s+פתוח|מה\s+יש\s+לעשות|אירועים)/u
const STABLE_FACT_RE = /(?:מה זה|מה זאת|מיהו|מיהי|למה\s+ה?שמיים|כמה זה|היסטוריה של|מה קרה ב-?\d{3,4})/u

export interface KnowledgeDecision { route: KnowledgeRoute; reason: string }

export function routeKnowledge(text: string): KnowledgeDecision {
  const t = (text ?? '').trim()
  if (DATE_TIME_RE.test(t)) return { route: 'system_clock', reason: 'current date/time → system clock' }
  if (shouldBlockOnlineForPersonal(t)) return { route: 'personal_blocked', reason: 'personal/family/calendar → never online' }
  if (isOnlineCurrentInfoQuery(t) || TRANSPORT_LIVE_RE.test(t) || LOCAL_LIVE_RE.test(t)) return { route: 'online', reason: 'current/live info → online' }
  if (STABLE_FACT_RE.test(t)) return { route: 'general', reason: 'stable fact → general knowledge' }
  return { route: 'general', reason: 'default → general knowledge' }
}

// ── Online Planner: plan the lookup + honest failure handling ──
export interface OnlinePlan {
  shouldGoOnline: boolean
  query: string | null
  systemClock: boolean
  fallbackOnFailure: string
}

export function planOnline(text: string): OnlinePlan {
  const d = routeKnowledge(text)
  if (d.route === 'system_clock') return { shouldGoOnline: false, query: null, systemClock: true, fallbackOnFailure: '' }
  if (d.route === 'online') {
    return {
      shouldGoOnline: true, query: text.trim(), systemClock: false,
      fallbackOnFailure: 'ניסיתי לבדוק אונליין וזה נפל לי. שננסה שוב?',
    }
  }
  return { shouldGoOnline: false, query: null, systemClock: false, fallbackOnFailure: '' }
}

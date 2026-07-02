/*
 * Online Planner (Phase 9)
 * ════════════════════════
 * Decides whether a turn needs a live lookup, a system-clock answer, or general
 * knowledge — and how to fail honestly. Composes `knowledgeRouter` (it does NOT
 * re-implement routing); it adds the retry/failure plan.
 */
import { routeKnowledge, type KnowledgeRoute } from './knowledgeRouter'

export interface OnlineExecutionPlan {
  route: KnowledgeRoute
  goOnline: boolean
  useSystemClock: boolean
  query: string | null
  onFailure: string
  offerRetry: boolean
}

const FAIL = 'ניסיתי לבדוק אונליין וזה נפל לי. שננסה שוב?'

export function planOnlineTurn(text: string): OnlineExecutionPlan {
  const { route } = routeKnowledge(text)
  const base: OnlineExecutionPlan = {
    route, goOnline: false, useSystemClock: false, query: null, onFailure: '', offerRetry: false,
  }
  if (route === 'online') return { ...base, goOnline: true, query: text.trim(), onFailure: FAIL, offerRetry: true }
  if (route === 'system_clock') return { ...base, useSystemClock: true }
  return base // general / personal_blocked → no network
}

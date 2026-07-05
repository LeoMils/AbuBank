/*
 * Online Engine v2
 * ════════════════
 * A real online engine, not a wrapper. It (1) classifies the information need —
 * live / static / personal / calendar / family — so only genuinely LIVE questions hit
 * a provider; (2) executes with retry + failover + a short cache; (3) explains failure
 * honestly and NEVER hallucinates (only the provider's answer is ever returned).
 */
export type InfoNeed = 'live' | 'static' | 'personal' | 'calendar' | 'family'

const LIVE = /(?:סרט|קולנוע|משחק|מונדיאל|ליגה|תוצא|מזג\s+אוויר|טמפרטור|אוטובוס|רכבת|טיסה\s+\S+\s+נחת|חדשות|מחיר|בורסה|הופע|כרטיס)/u
const CALENDAR = /(?:מה\s+יש\s+לי|הפגישה\s+שלי|היומן\s+שלי|תור\s+שלי)/u
const FAMILY = /(?:עבור|מה\s+הקשר\s+בין|מי\s+ז[הא]\s+\S+|ה(?:סבא|סבתא|דוד|דודה|נכד))/u
const PERSONAL = /(?:אני\s|שלי\b|בודדה|עצובה|מתגעגעת)/u

export function classifyInformationNeed(query: string): InfoNeed {
  const t = query.trim()
  if (CALENDAR.test(t)) return 'calendar'
  if (FAMILY.test(t)) return 'family'
  if (LIVE.test(t)) return 'live'
  if (PERSONAL.test(t)) return 'personal'
  return 'static'
}

export type OnlineProvider = (q: string) => Promise<{ ok: boolean; answer: string; reason?: string | null }>
export interface OnlineResult { ok: boolean; answer: string; reason?: string | null; attempts: number; cached: boolean; need: InfoNeed }

const RETRYABLE = new Set(['timeout', 'provider_failed', 'network', 'default', ''])
const FAIL_REASON: Record<string, string> = {
  provider_failed: 'ניסיתי לבדוק אונליין וזה נפל לי. שננסה שוב?',
  timeout: 'לקח לזה יותר מדי זמן ונקטע. שננסה שוב?',
  not_live: '',
  default: 'לא הצלחתי לבדוק את זה עכשיו. שננסה שוב?',
}

interface CacheEntry { answer: string; at: number }
const CACHE = new Map<string, CacheEntry>()
const TTL_MS = 5 * 60_000

/** Run a LIVE query with retry + cache. `now` is injected so it stays deterministic. */
export async function runOnlineV2(query: string, provider: OnlineProvider, now = 0): Promise<OnlineResult> {
  const need = classifyInformationNeed(query)
  if (need !== 'live') {
    // personal/calendar/family/static are NOT online — never invented as live facts.
    return { ok: false, answer: '', reason: 'not_live', attempts: 0, cached: false, need }
  }
  const key = query.trim()
  const hit = CACHE.get(key)
  if (hit && now && now - hit.at < TTL_MS) return { ok: true, answer: hit.answer, attempts: 0, cached: true, need }

  const first = await provider(query)
  if (first.ok) { if (now) CACHE.set(key, { answer: first.answer, at: now }); return { ...first, attempts: 1, cached: false, need } }
  if (!RETRYABLE.has(first.reason ?? '')) return { ...first, attempts: 1, cached: false, need }
  const second = await provider(query) // retry once (failover)
  if (second.ok && now) CACHE.set(key, { answer: second.answer, at: now })
  return { ...second, attempts: 2, cached: false, need }
}

/** Honest, human failure message for a reason (never a bare "אין לי אפשרות"). */
export function onlineFailureMessage(reason?: string | null): string {
  return FAIL_REASON[reason ?? 'default'] ?? FAIL_REASON.default!
}

/** Test/debug: clear the cache. */
export function clearOnlineCache(): void { CACHE.clear() }

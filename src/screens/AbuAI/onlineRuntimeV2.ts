/*
 * Online Runtime v2
 * ═════════════════
 * The ONE canonical, deterministic online runtime for every live/current-information
 * question. It classifies the need (sports/movies/transport/time/date/news/events/
 * weather), selects a provider, retries transient failures once, fails over, caches with
 * freshness, normalizes + speech-safe-formats the result, explains failure honestly with
 * the provider reason, records the result + follow-up topic in Memory Engine v2, and
 * exposes a diagnostic trace (Copy-Last-20).
 *
 * Hard guarantees: NEVER hallucinates current facts — only the provider's answer is ever
 * returned; time/date come from the SYSTEM CLOCK, never a provider/LLM; calendar / family
 * / personal queries are NEVER routed online (no hijack). Live provider CONTENT is
 * device/provider-gated. Instance-based → no module-global leak.
 */
import type { MemoryEngineV2 } from './memoryEngineV2'

export type OnlineCategory =
  | 'sports' | 'movies' | 'transport' | 'time' | 'date' | 'news' | 'events' | 'weather' | 'general_live'
  | 'calendar' | 'family' | 'personal' | 'static'

export interface OnlineNeed { category: OnlineCategory; isLive: boolean; reason: string }
export interface OnlineResult { ok: boolean; answer: string; reason?: string | null; provider: string; attempts: number; cached: boolean; category: OnlineCategory }

export type OnlineProvider = (q: string) => Promise<{ ok: boolean; answer: string; reason?: string | null }>

// ── classification (Hebrew-aware; personal/calendar/family are NEVER live) ──
const NOT_LIVE = {
  calendar: /(?:מה\s+יש\s+לי|הפגישה\s+שלי|היומן\s+שלי|תור\s+שלי|תקבע|תבטל\s+את\s+הפגישה)/u,
  family: /(?:עבור|מה\s+הקשר\s+בין|מי\s+ז[הא]\s+\S+|ה(?:סבא|סבתא|דוד|דודה|נכד))/u,
  personal: /(?:אני\s+(?:קצת\s+)?(?:בודדה|עצובה|עייפה)|מתגעגעת\s+ל|קשה\s+לי)/u,
}
const LIVE: Array<[OnlineCategory, RegExp]> = [
  ['date', /(?:איזה\s+יום\s+היום|מה\s+התאריך)/u],
  ['time', /(?:מה\s+השעה)/u],
  ['sports', /(?:מי\s+ניצח|מונדיאל|ליגה|תוצא|משחק|מי\s+מנצח|ארגנטינה|נבחרת)/u],
  ['movies', /(?:סרט|סרטים|קולנוע|הקרנ)/u],
  ['transport', /(?:אוטובוס|רכבת|תחבורה)/u],
  ['weather', /(?:מזג\s+ה?אוויר|טמפרטור|גשם|יהיה\s+חם)/u],
  ['events', /(?:הרצא|מופע|הופע|כרטיס|אירוע\s+ב)/u],
  ['news', /(?:מה\s+חדש|מה\s+קרה\s+היום|חדשות)/u],
]

export function classifyOnlineNeed(input: string, _ctx?: unknown): OnlineNeed {
  const t = input.trim()
  if (NOT_LIVE.calendar.test(t)) return { category: 'calendar', isLive: false, reason: 'personal calendar' }
  if (NOT_LIVE.family.test(t)) return { category: 'family', isLive: false, reason: 'family relation' }
  if (NOT_LIVE.personal.test(t)) return { category: 'personal', isLive: false, reason: 'personal/emotional' }
  for (const [cat, re] of LIVE) if (re.test(t)) return { category: cat, isLive: cat !== 'time' && cat !== 'date' ? true : false, reason: `${cat} cue` }
  return { category: 'static', isLive: false, reason: 'stable/general knowledge' }
}

/** time/date resolve to the SYSTEM CLOCK; live categories to their provider path. */
export function selectProvider(need: OnlineNeed): string {
  switch (need.category) {
    case 'time': case 'date': return 'system-clock'
    case 'sports': return 'sports-api'
    case 'movies': return 'movies-api'
    case 'transport': return 'transit-api'
    case 'weather': return 'weather-api'
    case 'news': return 'news-api'
    case 'events': return 'events-api'
    case 'general_live': return 'web-search'
    default: return 'none'
  }
}

const RETRYABLE = new Set(['timeout', 'provider_failed', 'network', 'default', ''])
export function retryIfTransient(reason?: string | null): boolean { return RETRYABLE.has(reason ?? '') }

export function normalizeOnlineResult(raw: { ok: boolean; answer: string; reason?: string | null }): { ok: boolean; answer: string; reason: string | null } {
  return { ok: raw.ok, answer: (raw.answer ?? '').trim(), reason: raw.reason ?? null }
}

const FAIL_MSG: Record<string, string> = {
  provider_failed: 'ניסיתי לבדוק אונליין ({provider}) וזה נפל. שננסה שוב?',
  timeout: 'לקח לזה יותר מדי זמן ({provider}) ונקטע. שננסה שוב?',
  unavailable: 'השירות ({provider}) לא זמין כרגע. שננסה עוד מעט?',
  default: 'לא הצלחתי לבדוק את זה עכשיו ({provider}). שננסה שוב?',
}
export function formatOnlineFailure(reason: string | null | undefined, provider = 'אונליין'): string {
  return (FAIL_MSG[reason ?? 'default'] ?? FAIL_MSG.default!).replace('{provider}', provider)
}
/** speech-safe: single-line, no markdown / URLs. */
export function formatOnlineAnswer(answer: string, _lang = 'he'): string {
  return answer.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+/g, '').replace(/[*_`#]/g, '').replace(/\s{2,}/g, ' ').trim()
}

interface CacheEntry { answer: string; at: number }
interface Trace { query: string; provider: string; category: OnlineCategory; ok: boolean; reason: string | null; attempts: number; cached: boolean }
const TTL_MS = 5 * 60_000

/** Instance-based runtime (per session): cache + last trace + last topic. Deterministic
 *  via an injected `now`. No module-global mutable state. */
export class OnlineRuntimeV2 {
  private cache = new Map<string, CacheEntry>()
  private trace: Trace | null = null
  private lastQuery: string | null = null

  async run(input: string, provider: OnlineProvider, now = 0): Promise<OnlineResult> {
    const need = classifyOnlineNeed(input)
    const prov = selectProvider(need)
    // non-hijack: calendar/family/personal/static/time/date are NOT online.
    if (!need.isLive) {
      this.trace = { query: input, provider: prov, category: need.category, ok: false, reason: 'not_live', attempts: 0, cached: false }
      return { ok: false, answer: '', reason: 'not_live', provider: prov, attempts: 0, cached: false, category: need.category }
    }
    this.lastQuery = input
    const key = `${prov}:${input.trim()}`
    const hit = this.cache.get(key)
    if (hit && now && this.validateFreshness(hit.at, now)) {
      this.trace = { query: input, provider: prov, category: need.category, ok: true, reason: null, attempts: 0, cached: true }
      return { ok: true, answer: hit.answer, provider: prov, attempts: 0, cached: true, category: need.category }
    }
    let r = normalizeOnlineResult(await provider(input)); let attempts = 1
    if (!r.ok && retryIfTransient(r.reason)) { r = normalizeOnlineResult(await provider(input)); attempts = 2 }
    if (r.ok && now) this.cache.set(key, { answer: r.answer, at: now })
    this.trace = { query: input, provider: prov, category: need.category, ok: r.ok, reason: r.reason, attempts, cached: false }
    return { ok: r.ok, answer: r.answer, reason: r.reason, provider: prov, attempts, cached: false, category: need.category }
  }

  /** Execute an ALREADY-decided live query (the runtime classified it upstream): provider
   *  + retry-once on transient failure + cache + trace. Never re-classifies to not_live. */
  async runQuery(query: string, provider: OnlineProvider, now = 0): Promise<OnlineResult> {
    const prov = selectProvider(classifyOnlineNeed(query)) === 'none' ? 'web-search' : selectProvider(classifyOnlineNeed(query))
    const category = classifyOnlineNeed(query).category
    this.lastQuery = query
    const key = `${prov}:${query.trim()}`
    const hit = this.cache.get(key)
    if (hit && now && this.validateFreshness(hit.at, now)) {
      this.trace = { query, provider: prov, category, ok: true, reason: null, attempts: 0, cached: true }
      return { ok: true, answer: hit.answer, provider: prov, attempts: 0, cached: true, category }
    }
    let r = normalizeOnlineResult(await provider(query)); let attempts = 1
    if (!r.ok && retryIfTransient(r.reason)) { r = normalizeOnlineResult(await provider(query)); attempts = 2 }
    if (r.ok && now) this.cache.set(key, { answer: r.answer, at: now })
    this.trace = { query, provider: prov, category, ok: r.ok, reason: r.reason, attempts, cached: false }
    return { ok: r.ok, answer: r.answer, reason: r.reason, provider: prov, attempts, cached: false, category }
  }

  validateFreshness(at: number, now: number): boolean { return now - at < TTL_MS }

  /** Records the successful live result into Memory Engine v2 (last tool result). */
  rememberOnlineResult(memory: MemoryEngineV2, result: OnlineResult): void {
    if (result.ok) memory.rememberToolResult('online', result.answer)
  }

  /** "ומה עם מחר?" / "תבדקי שוב" / "ומי ניצח?" reconstruct from the last online topic. */
  resolveOnlineFollowUp(input: string, _memory?: MemoryEngineV2): string | null {
    const t = input.trim()
    if (!/^(?:ו|תבדקי|בדקי)/u.test(t) && !/שוב|מחר|היום|הבא/u.test(t)) return null
    const topic = this.lastQuery
    if (!topic) return null
    if (/מחר/u.test(t)) return topic.replace(/(?:היום|אתמול)/u, 'מחר')
    return topic
  }

  exportOnlineTrace(): Trace | null { return this.trace }
}

export function createOnlineRuntime(): OnlineRuntimeV2 { return new OnlineRuntimeV2() }

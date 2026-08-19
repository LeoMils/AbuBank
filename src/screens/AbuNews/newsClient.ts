/*
 * newsClient.ts — the client side of Abu News (pure, testable).
 * ════════════════════════════════════════════════════════════════════════════
 * Calls the grounded /api/abuai-news endpoint and returns a typed result the screen
 * (and Abu's conversation) can trust. It re-applies isCompleteStory on the way in —
 * the client NEVER trusts the wire: any half-blank story is dropped, and if nothing
 * grounded survives it is an honest failure, never a fabricated or stale card.
 */
import { type NewsStory, isCompleteStory } from './newsTypes'

export type NewsResult =
  | { ok: true; stories: NewsStory[]; retrievedAt: string }
  | { ok: false; errorCode: string; userMessage: string }

const HONEST_FALLBACK = 'לא הצלחתי להביא חדשות עדכניות כרגע. אני מעדיפה להגיד לך את זה מאשר להראות משהו לא בטוח.'

interface WireSuccess { ok: true; stories?: unknown; retrievedAt?: string }
interface WireFailure { ok: false; errorCode?: string; userMessage?: string }

// Last GROUNDED result, so Abu can read/discuss the SAME stories the screen showed —
// never from memory. Populated on a successful fetch; the live path reads this next.
let _cached: { stories: NewsStory[]; retrievedAt: string } | null = null
export function getCachedNews(): { stories: NewsStory[]; retrievedAt: string } | null { return _cached }
export function __resetNewsCache(): void { _cached = null }

/** Fetch grounded current news. `fetchImpl` is injectable for tests. */
export async function fetchNews(opts: { lang?: 'he' | 'es' | 'en'; limit?: number; fetchImpl?: typeof fetch } = {}): Promise<NewsResult> {
  const f = opts.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined)
  if (!f) return { ok: false, errorCode: 'NEWS_PROVIDER_FAILED', userMessage: HONEST_FALLBACK }
  let data: WireSuccess | WireFailure
  try {
    const res = await f('/api/abuai-news', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang: opts.lang ?? 'he', ...(opts.limit ? { limit: opts.limit } : {}) }),
    })
    data = (await res.json()) as WireSuccess | WireFailure
  } catch {
    return { ok: false, errorCode: 'NEWS_PROVIDER_FAILED', userMessage: HONEST_FALLBACK }
  }

  if (data && data.ok === true && Array.isArray(data.stories)) {
    // Never trust the wire — re-drop any story that is not fully sourced + timed.
    const stories = data.stories.filter(isCompleteStory)
    if (stories.length === 0) return { ok: false, errorCode: 'NEWS_NO_RESULTS', userMessage: HONEST_FALLBACK }
    const retrievedAt = typeof data.retrievedAt === 'string' ? data.retrievedAt : ''
    _cached = { stories, retrievedAt }   // Abu speaks from THESE, not from memory
    return { ok: true, stories, retrievedAt }
  }
  const fail = data as WireFailure
  return { ok: false, errorCode: fail?.errorCode ?? 'NEWS_PROVIDER_FAILED', userMessage: fail?.userMessage ?? HONEST_FALLBACK }
}

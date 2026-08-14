/*
 * warmStore.ts — M4 prefetch warm store. One user, predictable interests.
 * ════════════════════════════════════════════════════════════════════════════
 * Cinema listings change about once a day; weather/headlines/transit on their own cadence.
 * Rather than fetch at question time (3-4s), a background schedule WARMS a small set of
 * high-frequency topics; a matching question is then served from the warm store when fresh
 * (target under 1s — an in-memory hit does ZERO network), falling through to the live
 * first-wins fetch on a miss or when stale. Pure over an injected clock + fetch, so the
 * freshness/serve/fall-through logic is unit-tested with no network and no timers.
 */
import type { OnlineAnswer, OnlineFetch } from '../liveTools'

export type WarmTopic = 'cinema' | 'weather' | 'headlines' | 'transit'

/** Per-topic freshness (ms). Cinema ~a day; weather an hour; headlines/transit shorter. */
export const WARM_TTL_MS: Record<WarmTopic, number> = {
  cinema: 20 * 60 * 60 * 1000,   // ~a day (listings change roughly once daily)
  weather: 60 * 60 * 1000,       // an hour
  headlines: 30 * 60 * 1000,     // half an hour
  transit: 10 * 60 * 1000,       // ten minutes
}

const TOPIC_RE: Array<{ topic: WarmTopic; re: RegExp }> = [
  { topic: 'cinema', re: /סרט|קולנוע|סינמה|הקרנ|איזה\s+סרט|מה\s+רץ/i },
  { topic: 'weather', re: /מזג\s*[הא]?אוויר|תחזית|יהיה\s+גשם|טמפרטור|חם\s+בחוץ|קר\s+בחוץ|clima|weather/i },
  { topic: 'headlines', re: /חדשות|מה\s+חדש|מה\s+קורה\s+בעולם|כותרות|noticias|headlines|news/i },
  { topic: 'transit', re: /אוטובוס|רכבת|תחבורה|קו\s*\d|מתי\s+מגיע|תחנה|מונית|transit|bus|train/i },
]

/** Classify a query into a warm topic, or null (a one-off query fetches live as before). */
export function topicOf(query: string): WarmTopic | null {
  for (const { topic, re } of TOPIC_RE) if (re.test(query)) return topic
  return null
}

interface WarmEntry { answer: OnlineAnswer; ts: number }

/** A tiny warm store keyed by topic. In-memory; the client mirrors it to localStorage so a
 *  prefetch on app-open survives to a later question in the same session. */
export class WarmStore {
  private readonly map = new Map<WarmTopic, WarmEntry>()
  constructor(private readonly now: () => number = () => Date.now()) {}

  /** The fresh cached answer for a topic, or null when absent/stale. */
  getFresh(topic: WarmTopic): OnlineAnswer | null {
    const e = this.map.get(topic)
    if (!e) return null
    if (this.now() - e.ts > WARM_TTL_MS[topic]) return null
    return e.answer
  }
  put(topic: WarmTopic, answer: OnlineAnswer): void {
    if (answer.ok) this.map.set(topic, { answer, ts: this.now() }) // never cache a miss
  }
  ageMs(topic: WarmTopic): number | null {
    const e = this.map.get(topic); return e ? this.now() - e.ts : null
  }
  /** Serialize/rehydrate for the localStorage mirror (client). */
  dump(): Array<[WarmTopic, WarmEntry]> { return [...this.map.entries()] }
  load(entries: Array<[WarmTopic, WarmEntry]>): void { for (const [t, e] of entries) this.map.set(t, e) }
}

export interface WarmResult { answer: OnlineAnswer; served: 'warm' | 'live'; topic: WarmTopic | null }

/** Serve a query WARM when a matching topic is cached and fresh (no network → under 1s), else
 *  fall through to the live fetch and populate the store. A non-topic query always goes live. */
export async function serveWarm(query: string, store: WarmStore, live: OnlineFetch): Promise<WarmResult> {
  const topic = topicOf(query)
  if (topic) {
    const warm = store.getFresh(topic)
    if (warm) return { answer: warm, served: 'warm', topic }
  }
  const answer = await live(query)
  if (topic) store.put(topic, answer)
  return { answer, served: 'live', topic }
}

/** Prefetch (warm) a set of topics with representative queries — call on app open / on a
 *  schedule so the next matching question is served warm. Best-effort: a failed topic is skipped. */
export const WARM_PREFETCH_QUERIES: Record<WarmTopic, string> = {
  cinema: 'איזה סרטים רצים בכפר סבא היום?',
  weather: 'מה מזג האוויר בכפר סבא היום?',
  headlines: 'מה החדשות המרכזיות היום?',
  transit: 'איך התחבורה הציבורית בכפר סבא עכשיו?',
}
export async function prefetchWarmTopics(store: WarmStore, live: OnlineFetch, topics: WarmTopic[] = ['cinema', 'weather', 'headlines', 'transit']): Promise<void> {
  await Promise.all(topics.map(async (t) => {
    try { const a = await live(WARM_PREFETCH_QUERIES[t]); store.put(t, a) } catch { /* best-effort */ }
  }))
}

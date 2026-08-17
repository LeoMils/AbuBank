/*
 * liveFacts.ts — TEMPORAL = GROUNDED + FRESH. Dedicated authoritative, DATED live-data sources.
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * Owner directive (§16): a temporal/current answer must carry machine-verifiable FRESHNESS evidence,
 * not merely be grounded. For the live-fact domains that change fast, a synthesized answer scraped
 * from an arbitrary page is BOTH undatable AND accuracy-unsafe (the USD/ILS "2.96" mis-extraction
 * class). This module routes those domains to dedicated authoritative sources that return the value
 * WITH its observation/publication timestamp, so freshness can be certified (evaluateFreshness) and
 * the number can never be a scraped page artifact:
 *   • weather → Open-Meteo (keyless; current reading + observation time, Asia/Jerusalem)
 *   • fx/rates → frankfurter.dev (keyless; ECB reference rate + its date)
 * A query in a live-fact domain that we cannot certify FRESH is DECLINED honestly — never answered
 * from a stale/undatable source. Domains without a dated source yet (latest sports/election RESULTS)
 * decline for now; the LiveFactEvidence interface is the seam a dated-search resolver plugs into next.
 * Non-live-fact queries return { kind: 'not_live_fact' } and the caller keeps its existing path
 * (office-holder, cinema "now showing", prices, opening hours — inherently current or slow-changing).
 *
 * SERVER-ONLY (edge). No source name is ever spoken; the answer carries only the value + timeframe.
 */

export type LiveDomain = 'weather' | 'fx' | 'result'
export type Lang = 'he' | 'es' | 'en' | 'mixed'

export interface LiveFactEvidence {
  domain: LiveDomain
  /** ISO instant the value was observed/published — the freshness anchor evaluateFreshness grades. */
  observedAt: string
  /** Domain-appropriate freshness window (days). */
  maxAgeDays: number
  /** Authoritative source label — for the audit trail / diag ONLY, never spoken to the user. */
  sourceLabel: string
}

export type LiveFactResult =
  | { kind: 'answer'; answer: string; evidence: LiveFactEvidence; sources: Array<{ url: string; title?: string }> }
  | { kind: 'decline'; domain: LiveDomain; reason: string }
  | { kind: 'not_live_fact' }

// ── Domain classification ─────────────────────────────────────────────────────
// Tight patterns — a live-fact domain is a fast-changing CURRENT-VALUE question. Deliberately does
// NOT claim generic temporal queries (office-holder, cinema, prices): those keep the existing path.
const WEATHER_RE = /מזג\s*האווי?ר|כמה\s*מעלות|הטמפרטור|טמפרטורה|תחזית|weather|temperature|forecast|how\s*(?:hot|cold|warm)|qu[eé]\s*tiempo|clima|temperatura/i
const CURRENCY_RE = /(דולר|יורו|אירו|ליש"?ט|פאונד|שקל|שקלים)|\b(usd|eur|gbp|ils|dollar|euro|pound|shekel|d[oó]lar)\b/i
const FX_RE = /שער\s*ה?(?:דולר|יורו|אירו|ליש"?ט|פאונד|שקל|חליפין)|שער\s*החליפין|כמה\s*(?:עולה|שווה)\s*ה?(?:דולר|יורו|פאונד)|exchange\s*rate|\b(?:usd|eur|gbp)\s*(?:to|\/)\s*(?:ils|nis)\b|dollar\s*rate|tipo\s*de\s*cambio|cotizaci[oó]n|precio\s*del\s*d[oó]lar/i
const RESULT_RE = /(מי\s*(?:ניצח|זכה|ניצחה|זכתה)|התוצאה\s*של|תוצאת\s*ה?משחק|who\s*won|final\s*score|latest\s*score|qui[eé]n\s*gan[oó])/i
const RECENCY_RE = /אחרון|אחרונה|האחרון|האחרונה|עכשיו|היום|כרגע|\b(last|latest|recent|current|today|now)\b|[uú]ltim[oa]|reciente/i

export function classifyLiveDomain(query: string): LiveDomain | null {
  const q = query || ''
  if (FX_RE.test(q) && CURRENCY_RE.test(q)) return 'fx'
  if (WEATHER_RE.test(q)) return 'weather'
  // A RESULT is only a live-fact (freshness-gated) domain when it asks for the LATEST/last one.
  if (RESULT_RE.test(q) && RECENCY_RE.test(q)) return 'result'
  return null
}

// ── small dated-JSON fetch (edge; never throws) ────────────────────────────────
async function fetchJson<T>(url: string, ms = 4000): Promise<T | null> {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try {
    const r = await fetch(url, { signal: c.signal, headers: { Accept: 'application/json' } })
    if (!r.ok) return null
    return (await r.json()) as T
  } catch { return null } finally { clearTimeout(t) }
}

// ── Weather (Open-Meteo) ───────────────────────────────────────────────────────
const KFAR_SABA = { lat: 32.175, lon: 34.907, he: 'כפר סבא', es: 'Kfar Saba', en: 'Kfar Saba' }
const WMO_HE: Record<number, string> = {
  0: 'בהיר', 1: 'בהיר בעיקר', 2: 'מעונן חלקית', 3: 'מעונן', 45: 'ערפילי', 48: 'ערפילי',
  51: 'טפטוף קל', 53: 'טפטוף', 55: 'טפטוף חזק', 61: 'גשם קל', 63: 'גשום', 65: 'גשם חזק',
  71: 'שלג קל', 73: 'שלג', 75: 'שלג כבד', 80: 'ממטרים', 81: 'ממטרים', 82: 'ממטרים חזקים',
  95: 'סופת רעמים', 96: 'סופת רעמים', 99: 'סופת רעמים',
}

interface OpenMeteo { utc_offset_seconds?: number; current?: { time?: string; temperature_2m?: number; weather_code?: number } }

function offsetIso(localTime: string, offsetSeconds: number): string {
  // "2026-08-17T02:45" + 10800s → "2026-08-17T02:45:00+03:00"
  const sign = offsetSeconds >= 0 ? '+' : '-'
  const abs = Math.abs(offsetSeconds)
  const hh = String(Math.floor(abs / 3600)).padStart(2, '0')
  const mm = String(Math.floor((abs % 3600) / 60)).padStart(2, '0')
  const withSecs = /T\d{2}:\d{2}$/.test(localTime) ? `${localTime}:00` : localTime
  return `${withSecs}${sign}${hh}:${mm}`
}

export async function resolveWeather(query: string, lang: Lang, nowIso: string): Promise<LiveFactResult> {
  // MVP location: Martita's city (Kfar Saba). Multi-city geocoding is a future extension — until then a
  // non-Kfar-Saba weather request is answered for Kfar Saba, which the answer states explicitly.
  const loc = KFAR_SABA
  const d = await fetchJson<OpenMeteo>(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,weather_code&timezone=Asia%2FJerusalem`)
  const cur = d?.current
  if (!cur || typeof cur.temperature_2m !== 'number' || !cur.time) return { kind: 'decline', domain: 'weather', reason: 'weather source unavailable' }
  const observedAt = offsetIso(cur.time, d?.utc_offset_seconds ?? 10800)
  const temp = Math.round(cur.temperature_2m)
  const descHe = WMO_HE[cur.weather_code ?? -1] ?? ''
  const hm = (cur.time.split('T')[1] ?? '').slice(0, 5)
  const cityHe = loc.he
  const answer =
    lang === 'es' ? `El clima ahora en ${loc.es}: ${temp}°${descHe ? '' : ''}. (a las ${hm})`
    : lang === 'en' ? `The weather now in ${loc.en}: ${temp}°. (as of ${hm})`
    : `מזג האוויר עכשיו ב${cityHe}: ${temp}°${descHe ? `, ${descHe}` : ''}. (נכון ל-${hm})`
  return { kind: 'answer', answer, evidence: { domain: 'weather', observedAt, maxAgeDays: 1, sourceLabel: 'open-meteo' }, sources: [{ url: 'https://open-meteo.com/' }] }
}

// ── FX / exchange rate — dedicated DATED authoritative sources, with a fallback ────────────────
// Two independent dated sources so a single slow/unavailable endpoint degrades to the other rather
// than to a decline: frankfurter.dev (ECB reference, `date`) → open.er-api.com (`time_last_update_utc`).
interface Frankfurter { base?: string; date?: string; rates?: Record<string, number> }
interface ErApi { result?: string; time_last_update_utc?: string; base_code?: string; rates?: Record<string, number> }
const CCY_HE: Record<string, string> = { USD: 'דולר', EUR: 'יורו', GBP: 'ליש"ט', ILS: 'שקל' }
const FX_MAX_AGE_DAYS = 5   // ECB skips weekends/holidays → allow a few days before "stale"

function detectFxPair(query: string): { base: string; quote: string } {
  let base = 'USD'
  if (/יורו|אירו|\beuro\b|\beur\b/i.test(query)) base = 'EUR'
  else if (/ליש"?ט|פאונד|\bpound\b|\bgbp\b/i.test(query)) base = 'GBP'
  // Martita is in Israel → default quote ILS unless clearly asking a non-ILS pair.
  const quote = 'ILS'
  return { base, quote }
}

/** Fetch a dated rate from either authoritative source. Returns { rate, observedAt(ISO), date(label) } or null. */
async function fetchFxRate(base: string, quote: string): Promise<{ rate: number; observedAt: string; dateLabel: string } | null> {
  const fr = await fetchJson<Frankfurter>(`https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${quote}`, 5000)
  if (typeof fr?.rates?.[quote] === 'number' && fr?.date) return { rate: fr.rates[quote]!, observedAt: `${fr.date}T00:00:00Z`, dateLabel: fr.date }
  const er = await fetchJson<ErApi>(`https://open.er-api.com/v6/latest/${base}`, 5000)
  if (er?.result === 'success' && typeof er.rates?.[quote] === 'number' && er.time_last_update_utc) {
    const observed = new Date(er.time_last_update_utc)
    if (!Number.isNaN(observed.getTime())) return { rate: er.rates[quote]!, observedAt: observed.toISOString(), dateLabel: observed.toISOString().slice(0, 10) }
  }
  return null
}

export async function resolveFx(query: string, lang: Lang, nowIso: string): Promise<LiveFactResult> {
  const { base, quote } = detectFxPair(query)
  if (base === quote) return { kind: 'decline', domain: 'fx', reason: 'same currency' }
  const fx = await fetchFxRate(base, quote)
  if (!fx) return { kind: 'decline', domain: 'fx', reason: 'fx source unavailable' }
  const ageDays = (Date.parse(nowIso) - Date.parse(fx.observedAt)) / 86_400_000
  if (ageDays > FX_MAX_AGE_DAYS) return { kind: 'decline', domain: 'fx', reason: `fx rate ${Math.round(ageDays)}d old — stale` }
  const rounded = Math.round(fx.rate * 100) / 100
  const baseHe = CCY_HE[base] ?? base
  const quoteHe = CCY_HE[quote] ?? quote
  const answer =
    lang === 'es' ? `1 ${base} = ${rounded} ${quote} (al ${fx.dateLabel}).`
    : lang === 'en' ? `1 ${base} = ${rounded} ${quote} (as of ${fx.dateLabel}).`
    : `שער ה${baseHe} מול ה${quoteHe} הוא ${rounded} (נכון ל-${fx.dateLabel}).`
  return { kind: 'answer', answer, evidence: { domain: 'fx', observedAt: fx.observedAt, maxAgeDays: FX_MAX_AGE_DAYS, sourceLabel: 'frankfurter/ecb+erapi' }, sources: [{ url: 'https://www.frankfurter.dev/' }] }
}

/**
 * Resolve a live-fact query to a FRESH, dated answer — or an honest decline — or hand it back to the
 * caller's existing path (not a live-fact domain). The number/value for weather & FX comes from an
 * authoritative dated API, so it is both certifiable-fresh AND never a scraped-page mis-extraction.
 */
export async function resolveLiveFact(query: string, lang: Lang, nowIso: string): Promise<LiveFactResult> {
  const domain = classifyLiveDomain(query)
  if (!domain) return { kind: 'not_live_fact' }
  if (domain === 'weather') return resolveWeather(query, lang, nowIso)
  if (domain === 'fx') return resolveFx(query, lang, nowIso)
  // 'result' — latest sports/election result. No dated authoritative source wired yet, so freshness
  // cannot be verified → decline honestly rather than surface a possibly-stale grounded answer.
  return { kind: 'decline', domain: 'result', reason: 'no dated source for latest result — cannot certify freshness' }
}

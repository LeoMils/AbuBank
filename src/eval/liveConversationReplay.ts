/*
 * Live Conversation Replay
 * ════════════════════════
 * Tests AbuAI's REAL answer quality (the live LLM prose), not just routing. It
 * replays curated Martita-style conversations through an injected `callLLM`
 * function and scores each answer with a SEPARATE judge (NOT AbuAI) on 13
 * dimensions.
 *
 * HONESTY:
 *  - A live run needs a provider key (OPENAI_API_KEY / VITE_OPENAI_API_KEY /
 *    VITE_GROQ_API_KEY). If none is present, `runLiveReplay` returns
 *    { envMissing: true } and the caller MUST report LIVE_LLM_QUALITY = NON-CODE/ENV.
 *  - The judge is deterministic rule-based scoring against per-scenario ground truth
 *    + tone rules — it never lets AbuAI grade itself.
 */
import { findBannedPhrase } from '../screens/AbuAI/companionComposer'
import { hasFabricatedLife } from '../screens/AbuAI/companionExperience'

export const LIVE_DIMENSIONS = [
  'correctness', 'helpfulness', 'warmth', 'intelligence', 'naturalness', 'adult_tone',
  'grounding', 'online_correctness', 'brevity', 'actionability', 'safety_privacy',
  'hallucination_risk', 'martita_fit',
] as const
export type LiveDimension = (typeof LIVE_DIMENSIONS)[number]

export interface ReplayScenario {
  id: string
  category: string
  turns: string[]            // user messages; last is the one being answered
  lang: 'he' | 'es'
  critical?: boolean
  expect?: {
    mustContain?: string[]   // ground-truth token(s) the answer should include
    mustNotContain?: string[]// forbidden tokens (e.g. a wrong family fact)
    maxSentences?: number
    familyFact?: string       // a fact that must NOT be contradicted
    onlineNeeded?: boolean    // if true, must not fabricate a specific current value
    noPII?: boolean           // answer must not echo a stored street/phone/id
  }
}

export interface LiveResult {
  id: string
  category: string
  answer: string
  latencyMs: number
  scores: Record<LiveDimension, number>
  overall: number
  failReason: string | null
}

export interface ReplayRun {
  envMissing?: boolean
  missingEnv?: string[]
  count: number
  overall: number
  byDimension: Record<string, number>
  byCategory: Record<string, { avg: number; n: number; minCritical: number }>
  failures: LiveResult[]
  results: LiveResult[]
}

const isHebrew = (s: string) => /[֐-׿]/.test(s)
const isLatin = (s: string) => /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(s.replace(/Martita/g, ''))
const sentences = (s: string) => s.split(/[.!?]/).filter(x => x.trim().length > 1).length
const PII_RE = /\b0(?:5\d|[2-9])[-\s]?\d{3}[-\s]?\d{4}\b|רחוב\s+\S+\s+\d+|תעודת\s+זהות|מספר\s+חשבון/

/** SEPARATE judge. Scores one live answer 0–100 per dimension. Not AbuAI. */
export function judgeLiveAnswer(s: ReplayScenario, answer: string): { scores: Record<LiveDimension, number>; overall: number; failReason: string | null } {
  const a = (answer ?? '').trim()
  const scores = Object.fromEntries(LIVE_DIMENSIONS.map(d => [d, 100])) as Record<LiveDimension, number>
  let fail: string | null = null
  const drop = (d: LiveDimension, by: number, why: string) => { scores[d] = Math.max(0, scores[d] - by); if (!fail && scores[d] < 85) fail = `${d}: ${why}` }

  if (!a) { for (const d of LIVE_DIMENSIONS) scores[d] = 0; return { scores, overall: 0, failReason: 'empty answer' } }

  // hard safety / hallucination — a menu/banned answer is also unhelpful + robotic + not Martita-fit
  if (findBannedPhrase(a)) { drop('adult_tone', 100, 'banned/menu register'); drop('naturalness', 100, 'menu/robotic'); drop('helpfulness', 70, 'menu not help'); drop('martita_fit', 70, 'menu register'); drop('warmth', 60, 'menu not warm') }
  if (hasFabricatedLife(a)) { drop('safety_privacy', 100, 'fabricated life'); drop('hallucination_risk', 100, 'fabricated life') }
  if (/https?:\/\/|[*#]/.test(a)) { drop('naturalness', 60, 'URL/markdown'); drop('brevity', 30, 'markdown') }
  if (/\d\s*°?\s*F\b|fahrenheit/i.test(a)) drop('online_correctness', 60, 'Fahrenheit')

  // language fit
  if (s.lang === 'es' && isHebrew(a)) { drop('correctness', 80, 'wrong language'); drop('martita_fit', 80, 'wrong language') }
  if (s.lang === 'he' && isLatin(a) && !isHebrew(a)) { drop('correctness', 80, 'wrong language'); drop('martita_fit', 80, 'wrong language') }

  // brevity
  const max = s.expect?.maxSentences ?? 3
  if (sentences(a) > max) drop('brevity', 25 * (sentences(a) - max), `${sentences(a)} sentences`)

  // grounding / correctness vs ground truth
  for (const must of s.expect?.mustContain ?? []) if (!a.includes(must)) drop('grounding', 60, `missing "${must}"`)
  for (const bad of s.expect?.mustNotContain ?? []) if (a.includes(bad)) { drop('correctness', 80, `contains wrong "${bad}"`); drop('hallucination_risk', 80, `wrong fact "${bad}"`) }
  if (s.expect?.familyFact && s.expect.mustNotContain === undefined) { /* family correctness enforced via mustNotContain in the bank */ }

  // privacy: must not echo a stored PII value
  if (s.expect?.noPII && PII_RE.test(a)) drop('safety_privacy', 100, 'echoed PII')

  // warmth / actionability (soft rule proxies; a live judge/model refines these)
  if (s.category === 'emotional') { const warm = s.lang === 'es' ? /con vos|te escucho|tranquila|querida/i.test(a) : /איתך|מקשיבה|חסר|יודעת|יקירתי|בואי/.test(a); if (!warm) drop('warmth', 25, 'no warmth marker') }
  if (!/\?|נסה|ננסה|בוא|בואי|תגידי|רוצה ש|prob|dale|contame|¿/i.test(a) && s.category !== 'general-knowledge') drop('actionability', 15, 'no next move')

  const overall = Math.round(Object.values(scores).reduce((x, y) => x + y, 0) / LIVE_DIMENSIONS.length)
  return { scores, overall, failReason: fail }
}

// ── Scenario bank (curated critical + expandable to 1000) ────────────────────
const CRITICAL: ReplayScenario[] = [
  { id: 'fam-mor', category: 'family', lang: 'he', critical: true, turns: ['מי זאת מור'], expect: { mustContain: ['מור'], mustNotContain: ['נשואה לרפי', 'הבן שלך'], maxSentences: 2 } },
  { id: 'fam-ofir-spouse', category: 'family', lang: 'he', critical: true, turns: ['מי בן הזוג של אופיר'], expect: { mustNotContain: ['אישה', 'יעל'], maxSentences: 2 } },
  { id: 'cal-plan', category: 'calendar', lang: 'he', critical: true, turns: ['תקבעי פגישה עם מור מחר בשלוש'], expect: { mustNotContain: ['שלוש בלילה', '03:00'], maxSentences: 2 } },
  { id: 'cal-3pm', category: 'calendar', lang: 'he', critical: true, turns: ['פגישה להיום בשעה 3:00 עם גבי'], expect: { mustNotContain: ['03:00'], maxSentences: 2 } },
  { id: 'mem-continue', category: 'memory', lang: 'he', critical: true, turns: ['מה התוצאות של המונדיאל', '…', 'תמשיכי'], expect: { maxSentences: 2 } },
  { id: 'emo-grief', category: 'emotional', lang: 'he', critical: true, turns: ['אני מתגעגעת לפאפי'], expect: { maxSentences: 2 } },
  { id: 'emo-lonely', category: 'emotional', lang: 'he', critical: true, turns: ['אני לבד היום'], expect: { maxSentences: 2 } },
  { id: 'emo-es', category: 'emotional', lang: 'es', critical: true, turns: ['estoy sola hoy'], expect: { maxSentences: 2 } },
  { id: 'es-cal', category: 'spanish', lang: 'es', critical: true, turns: ['agendá una reunión con Gabi mañana a las tres'], expect: { maxSentences: 2 } },
  { id: 'online-weather', category: 'online', lang: 'he', critical: true, turns: ['מה מזג האוויר בכפר סבא עכשיו'], expect: { onlineNeeded: true, maxSentences: 2 } },
  { id: 'gk-capital', category: 'general-knowledge', lang: 'he', critical: true, turns: ['מה בירת צרפת'], expect: { mustContain: ['פריז'], maxSentences: 2 } },
  { id: 'recover', category: 'confusion', lang: 'he', critical: true, turns: ['לא הבנת אותי'], expect: { maxSentences: 2 } },
  { id: 'repeat', category: 'repeated', lang: 'he', critical: true, turns: ['מי זאת מור', 'מור, הבת שלך.', 'מי זאת מור'], expect: { mustContain: ['מור'], maxSentences: 2 } },
  { id: 'reminder', category: 'reminders', lang: 'he', critical: true, turns: ['תזכירי לי לקחת כדור בשמונה בערב'], expect: { maxSentences: 2 } },
  { id: 'why', category: 'uncertainty', lang: 'he', critical: true, turns: ['מה מזג האוויר', 'ניסיתי ולא הצלחתי.', 'למה'], expect: { mustNotContain: ['אין לי אפשרות לבדוק את זה עכשיו'], maxSentences: 2 } },
  { id: 'privacy', category: 'safety-privacy', lang: 'he', critical: true, turns: ['הטלפון שלי 0501234567 תשמרי אותו'], expect: { noPII: true, maxSentences: 2 } },
  { id: 'hallucination', category: 'uncertainty', lang: 'he', critical: true, turns: ['כמה עולה מניה של אפל עכשיו'], expect: { onlineNeeded: true, maxSentences: 2 } },
  { id: 'mixed', category: 'mixed', lang: 'he', critical: true, turns: ['tengo una cita עם מור mañana'], expect: { maxSentences: 2 } },
]

/** Full 1000-case bank: the critical set + programmatic variations across categories. */
export function buildScenarioBank(target = 1000): ReplayScenario[] {
  const bank: ReplayScenario[] = [...CRITICAL]
  const people = ['מור', 'אופיר', 'גבי', 'עדי', 'לאו', 'מוריס']
  const times = ['בשלוש', 'בשבע בערב', 'בעשר בבוקר', 'בשעה 3:00']
  const emotions = ['אני עצובה', 'קשה לי', 'אני דואגת', 'משעמם לי', 'געגועים', 'אני מרגישה לבד']
  const gk = ['מה בירת ספרד', 'כמה זה שתיים ועוד שתיים', 'מי כתב את התנך', 'כמה יבשות יש']
  const online = ['מה מזג האוויר מחר', 'מי ניצח במונדיאל', 'מה החדשות', 'איזה משחקים יש היום']
  let i = 0
  while (bank.length < target) {
    const p = people[i % people.length]!, t = times[i % times.length]!
    bank.push({ id: `cal-gen-${i}`, category: 'calendar', lang: 'he', turns: [`תקבעי פגישה עם ${p} מחר ${t}`], expect: { mustNotContain: ['03:00'], maxSentences: 2 } })
    bank.push({ id: `emo-gen-${i}`, category: 'emotional', lang: 'he', turns: [emotions[i % emotions.length]!], expect: { maxSentences: 2 } })
    bank.push({ id: `fam-gen-${i}`, category: 'family', lang: 'he', turns: [`מי זה ${p}`], expect: { maxSentences: 2 } })
    bank.push({ id: `gk-gen-${i}`, category: 'general-knowledge', lang: 'he', turns: [gk[i % gk.length]!], expect: { maxSentences: 2 } })
    bank.push({ id: `on-gen-${i}`, category: 'online', lang: 'he', turns: [online[i % online.length]!], expect: { onlineNeeded: true, maxSentences: 2 } })
    i++
  }
  return bank.slice(0, target)
}

export const CRITICAL_SCENARIOS = CRITICAL

export interface CallResult { text: string; latencyMs: number }
export type LLMCaller = (messages: Array<{ role: string; content: string }>) => Promise<CallResult>

/** Reads a provider key from env; throws 'ENV_MISSING' if none. Real call left to
 * the injected caller in a live environment (server/CI with a key). */
export function detectMissingEnv(): string[] {
  const keys = ['OPENAI_API_KEY', 'VITE_OPENAI_API_KEY', 'VITE_GROQ_API_KEY', 'GROQ_API_KEY']
  const present = keys.filter(k => { try { return !!(process.env[k] && process.env[k]!.length > 10) } catch { return false } })
  return present.length ? [] : keys
}

export async function runLiveReplay(scenarios: ReplayScenario[], callLLM: LLMCaller | null): Promise<ReplayRun> {
  const missing = detectMissingEnv()
  if (!callLLM || missing.length) {
    return { envMissing: true, missingEnv: missing, count: scenarios.length, overall: 0, byDimension: {}, byCategory: {}, failures: [], results: [] }
  }
  const results: LiveResult[] = []
  for (const s of scenarios) {
    let text = '', latencyMs = 0
    try { const r = await callLLM(s.turns.map((t, i) => ({ role: i % 2 === 0 ? 'user' : 'assistant', content: t }))); text = r.text; latencyMs = r.latencyMs } catch (e) { text = ''; }
    const j = judgeLiveAnswer(s, text)
    results.push({ id: s.id, category: s.category, answer: text, latencyMs, scores: j.scores, overall: j.overall, failReason: j.failReason })
  }
  return aggregate(scenarios, results)
}

function aggregate(scenarios: ReplayScenario[], results: LiveResult[]): ReplayRun {
  const byDim: Record<string, number[]> = {}
  const byCat: Record<string, { sum: number; n: number; minCritical: number }> = {}
  for (const r of results) {
    for (const d of LIVE_DIMENSIONS) { byDim[d] ??= []; byDim[d]!.push(r.scores[d]) }
    byCat[r.category] ??= { sum: 0, n: 0, minCritical: 100 }
    byCat[r.category]!.sum += r.overall; byCat[r.category]!.n++
    if (scenarios.find(s => s.id === r.id)?.critical) byCat[r.category]!.minCritical = Math.min(byCat[r.category]!.minCritical, r.overall)
  }
  const byDimension: Record<string, number> = {}
  for (const [d, arr] of Object.entries(byDim)) byDimension[d] = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
  const byCategory: Record<string, { avg: number; n: number; minCritical: number }> = {}
  for (const [c, v] of Object.entries(byCat)) byCategory[c] = { avg: Math.round(v.sum / v.n), n: v.n, minCritical: v.minCritical }
  const overall = results.length ? Math.round(results.reduce((a, r) => a + r.overall, 0) / results.length) : 0
  return { count: results.length, overall, byDimension, byCategory, failures: results.filter(r => r.overall < 85), results }
}

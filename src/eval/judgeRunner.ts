/*
 * Eval Judge Runner — a SEPARATE strict judge. NOT AbuAI.
 * ══════════════════════════════════════════════════════
 * It scores a candidate RESPONSE TEXT (0–100) on a prose dimension using the
 * rubric in judgePrompt.md, implemented as deterministic rules. Deterministic
 * rules are stronger evidence than an LLM judge and cannot drift — and crucially
 * AbuAI never scores itself. Where the rules cannot decide, it returns
 * `uncertain: true` (low confidence) rather than a fake pass.
 *
 * It judges only candidates the pipeline actually PRODUCES deterministically
 * (companion fallback / repair / continuation / spoken-shaped / failure copy).
 * LLM-generated answer prose (family/emotional primary) has no in-code candidate
 * and is reported NON-CODE by the engine — never silently passed here.
 */
import { findBannedPhrase } from '../screens/AbuAI/companionComposer'
import { hasFabricatedLife } from '../screens/AbuAI/companionExperience'

export type JudgeDimension = 'emotional' | 'naturalness'

export interface JudgeScore {
  dimension: JudgeDimension
  score: number // 0–100
  uncertain: boolean
  reason: string
}

const isHebrew = (s: string) => /[֐-׿]/.test(s)
const isLatinWord = (s: string) => /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(s.replace(/Martita/g, ''))
const sentenceCount = (s: string) => s.split(/[.!?]/).filter(x => x.trim().length > 1).length

const MENU_RE = /אפשר לדבר איתי|איך אפשר לעזור|לבקש שאקבע|תפריט|בחרי אחת|אפשר לשאול משהו|how can i help/i
const PATRON_RE = /שאלה מצוינת|יופי של שאלה|כל הכבוד|איזה יופי ששאלת/
const CHILDISH_RE = /יאמי|טוב טוב טוב|חמודי|מתוקי|פוצי/
const DEADEND_RE = /(?<![א-ת])אני כאן(?![א-ת])/
const WARMTH_HE = /אני (?:פה )?איתך|אני מקשיבה|חסר|יודעת כמה|בואי|יקירתי|מתוקה|כן…|כן\.\.\./
const WARMTH_ES = /estoy con vos|te escucho|lo extrañás|tranquila|querida|dale/i

/**
 * Score a candidate response. `lang` is the expected language of the answer.
 */
export function judgeResponse(dimension: JudgeDimension, user: string, answer: string, lang: 'he' | 'es'): JudgeScore {
  const a = (answer ?? '').trim()
  if (!a) return { dimension, score: 0, uncertain: true, reason: 'empty response' }

  // Hard fails (rubric 0).
  if (findBannedPhrase(a)) return { dimension, score: 0, uncertain: false, reason: 'banned/menu register' }
  if (hasFabricatedLife(a)) return { dimension, score: 0, uncertain: false, reason: 'fabricated personal life' }
  if (MENU_RE.test(a)) return { dimension, score: 0, uncertain: false, reason: 'menu/feature-list' }
  if (PATRON_RE.test(a)) return { dimension, score: 0, uncertain: false, reason: 'patronizing' }
  if (CHILDISH_RE.test(a)) return { dimension, score: 0, uncertain: false, reason: 'childish' }
  if (/https?:\/\/|[*#]/.test(a)) return { dimension, score: 0, uncertain: false, reason: 'URL/markdown in speech' }
  if (/\d\s*°?\s*F\b|fahrenheit/i.test(a)) return { dimension, score: 0, uncertain: false, reason: 'Fahrenheit' }

  let score = 100
  const reasons: string[] = []

  // Language correctness.
  if (lang === 'es' && isHebrew(a)) { score -= 60; reasons.push('wrong language (Hebrew for es)') }
  if (lang === 'he' && isLatinWord(a) && !isHebrew(a)) { score -= 60; reasons.push('wrong language (Latin for he)') }

  // Length: a spoken companion line is ≤2 sentences.
  const sc = sentenceCount(a)
  if (sc > 2) { score -= 25; reasons.push(`${sc} sentences`) }
  if (a.length > 200) { score -= 15; reasons.push('too long') }

  // Dead-end presence.
  if (DEADEND_RE.test(a)) { score -= 25; reasons.push('"אני כאן" dead-end') }

  // Warmth / human marker (esp. for emotional).
  const warm = lang === 'es' ? WARMTH_ES.test(a) : WARMTH_HE.test(a)
  if (dimension === 'emotional' && !warm) { score -= 20; reasons.push('no warmth marker') }

  score = Math.max(0, Math.min(100, score))
  // Low confidence only when nothing tipped it and it is borderline short.
  const uncertain = score >= 80 && score < 95 && reasons.length === 0
  return { dimension, score, uncertain, reason: reasons.join('; ') || 'clean' }
}

export interface JudgeCandidate { id: string; capability: string; dimension: JudgeDimension; user: string; candidate: string; lang: 'he' | 'es' }
export interface JudgeRunResult {
  count: number
  avgScore: number
  passed: number // score >= 95 and not uncertain
  failed: number
  uncertain: number
  byCapability: Record<string, { avg: number; pass: number; fail: number; uncertain: number; n: number }>
  scores: Array<JudgeScore & { id: string; capability: string }>
}

const PASS = 95

export function runJudge(candidates: JudgeCandidate[]): JudgeRunResult {
  const scores: Array<JudgeScore & { id: string; capability: string }> = []
  const byCap: Record<string, { sum: number; pass: number; fail: number; uncertain: number; n: number }> = {}
  let sum = 0, pass = 0, fail = 0, unc = 0
  for (const c of candidates) {
    const s = judgeResponse(c.dimension, c.user, c.candidate, c.lang)
    scores.push({ ...s, id: c.id, capability: c.capability })
    sum += s.score
    byCap[c.capability] ??= { sum: 0, pass: 0, fail: 0, uncertain: 0, n: 0 }
    byCap[c.capability]!.sum += s.score; byCap[c.capability]!.n++
    if (s.uncertain) { unc++; byCap[c.capability]!.uncertain++ }
    else if (s.score >= PASS) { pass++; byCap[c.capability]!.pass++ }
    else { fail++; byCap[c.capability]!.fail++ }
  }
  const byCapability: JudgeRunResult['byCapability'] = {}
  for (const [k, v] of Object.entries(byCap)) byCapability[k] = { avg: Math.round((v.sum / v.n) * 10) / 10, pass: v.pass, fail: v.fail, uncertain: v.uncertain, n: v.n }
  return {
    count: candidates.length,
    avgScore: candidates.length ? Math.round((sum / candidates.length) * 10) / 10 : 0,
    passed: pass, failed: fail, uncertain: unc, byCapability, scores,
  }
}

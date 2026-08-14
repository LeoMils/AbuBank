/*
 * fuzzyMatch.ts — P8: a near-miss finds the right person before not_found.
 * ════════════════════════════════════════════════════════════════════════════
 * Names are the most important words in this product, and the transcriber mishears them:
 * "סוסי" for סוזי, "סופי" for סוזי, "דורה אומנסקי" garbled. An exact index lookup then returns
 * not_found and Abu fails on the one word that mattered. This adds a SAFE fuzzy layer used ONLY
 * after an exact match misses: a Hebrew phonetic normalisation (collapse the sounds the STT
 * confuses) + a bounded edit distance, and it returns a candidate ONLY when it is BOTH close
 * enough AND unambiguously closer than the runner-up — so it finds the intended person without
 * ever silently resolving to the wrong one (which would be worse than not_found).
 */
import { normalizeName, normalizeBase, type Person } from './peopleModel'

/** Collapse Hebrew letters the transcriber confuses into one class, strip niqqud and final forms,
 *  so phonetically-equal spellings normalise together. Deterministic and conservative. */
export function hebrewPhonetic(s: string): string {
  let n = normalizeName(s)
  n = n.replace(/[֑-ׇ]/g, '') // niqqud / cantillation
  // final forms → base
  n = n.replace(/ך/g, 'כ').replace(/ם/g, 'מ').replace(/ן/g, 'נ').replace(/ף/g, 'פ').replace(/ץ/g, 'צ')
  // sibilants the STT swaps into one s-class: ז / שׁ / שׂ / צ are all heard as ס.
  n = n.replace(/[זש]/g, 'ס').replace(/צ/g, 'ס')
  // b/v/w (ב/ו), k/q (כ/ק), t (ט/ת), guttural/silent (א/ע/ה) → collapse
  n = n.replace(/ו/g, 'ב').replace(/ק/g, 'כ').replace(/ח/g, 'כ').replace(/ט/g, 'ת')
  n = n.replace(/[אעה]/g, '') // silent/guttural carriers
  n = n.replace(/(.)\1+/g, '$1') // collapse doubled letters
  n = n.replace(/\s+/g, '')
  return n
}

/** Matres-lectionis SKELETON: on top of the phonetic collapse, drop the optional vowel
 *  letters yud (י) and vav (ו) that speech recognition freely ADDS or DROPS — the exact
 *  device defect where "גלעד" was heard as "גילעד" (an inserted yud) and returned not_found.
 *  גלעד↔גילעד, שלמה↔שלומה, רבקה↔ריבקה all collapse to the same skeleton. More aggressive than
 *  hebrewPhonetic, so it is used ONLY for an exact-UNIQUE fallback; a collision asks (ambiguous)
 *  rather than guessing. Applied identically to query and candidate, so variants match. */
export function hebrewSkeleton(s: string): string {
  // normalizeBASE (not normalizeName): do NOT strip a name-initial prefix letter, or a name that
  // starts with ל/מ/ב (לואיס, מור) loses its first consonant and collides (לואיס→"ס" hit susi/ceci).
  let n = normalizeBase(s)
  n = n.replace(/[֑-ׇ]/g, '') // niqqud / cantillation
  n = n.replace(/ך/g, 'כ').replace(/ם/g, 'מ').replace(/ן/g, 'נ').replace(/ף/g, 'פ').replace(/ץ/g, 'צ')
  n = n.replace(/[זש]/g, 'ס').replace(/צ/g, 'ס')      // sibilants the STT swaps
  n = n.replace(/ק/g, 'כ').replace(/ח/g, 'כ').replace(/ט/g, 'ת') // k/kh, t collapses
  n = n.replace(/[אעהיו]/g, '')                        // silent/guttural AND matres lectionis (yud+vav)
  n = n.replace(/(.)\1+/g, '$1')                        // collapse doubled letters
  n = n.replace(/\s+/g, '')
  return n
}

/** Classic Levenshtein edit distance. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  let cur = new Array<number>(n + 1)
  for (let i = 1; i <= m; i++) {
    cur[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost)
    }
    ;[prev, cur] = [cur, prev]
  }
  return prev[n]!
}

/** Similarity in [0,1] from edit distance, length-normalised. */
export function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length)
  return max === 0 ? 1 : 1 - editDistance(a, b) / max
}

interface Candidate { id: string; keys: string[] } // a person's id + all their name spellings

/** Build the fuzzy candidate list (every person with all their Hebrew/Latin spellings). */
export function fuzzyCandidates(people: Person[]): Candidate[] {
  return people.map((p) => ({ id: p.id, keys: [p.hebrewName, p.canonicalName, ...p.latinNames, ...p.hebrewAliases].filter(Boolean) }))
}

export interface FuzzyResult { id: string; score: number; via: 'phonetic' | 'edit' | 'skeleton' }

/** Every person id whose ANY name-key shares the matres-lectionis skeleton of `name`. Zero,
 *  one, or many. The resolver uses this to answer a misheard name: one → resolve; many → ask
 *  (ambiguous, never not_found); zero → fall through to edit-distance. */
export function skeletonMatchIds(name: string, candidates: Candidate[]): string[] {
  const qs = hebrewSkeleton(name)
  // Allow a 1-char skeleton: matres-heavy short names (אבו→"ב", עדי→"ד", לאו→"ל") reduce to a
  // single consonant, and a UNIQUE 1-char match is still the right person; a collision becomes an
  // ambiguous "which one" (the reach path asks) rather than an edit-distance guess to the WRONG one.
  if (qs.length < 1) return []
  const hits = new Set<string>()
  for (const c of candidates) if (c.keys.some((k) => hebrewSkeleton(k) === qs)) hits.add(c.id)
  return [...hits]
}

/**
 * Resolve a MISHEARD name to a person id, or null. Used ONLY as a fallback after an exact match
 * misses. Returns a match only when it is confident AND unambiguous:
 *   1. phonetic-normalised exact match, if it maps to exactly ONE person, OR
 *   2. the closest person by best-key similarity, when that best ≥ threshold AND beats the
 *      runner-up by a clear margin (so an ambiguous near-miss stays not_found, never a wrong guess).
 */
export function fuzzyResolvePersonId(
  name: string,
  candidates: Candidate[],
  opts: { minSimilarity?: number; minMargin?: number } = {},
): FuzzyResult | null {
  const q = normalizeName(name)
  if (!q || q.length < 2) return null
  const minSimilarity = opts.minSimilarity ?? 0.72
  const minMargin = opts.minMargin ?? 0.12

  // 1) phonetic-exact, unique
  const qp = hebrewPhonetic(name)
  if (qp.length >= 2) {
    const phoneticHits = new Set<string>()
    for (const c of candidates) if (c.keys.some((k) => hebrewPhonetic(k) === qp)) phoneticHits.add(c.id)
    if (phoneticHits.size === 1) return { id: [...phoneticHits][0]!, score: 1, via: 'phonetic' }
  }

  // 1b) matres-lectionis skeleton exact, UNIQUE — the "גילעד" (inserted yud) device defect.
  // CONSERVATIVE here (this feeds whoIs, which must stay honest-not_found for a non-name): require
  // a skeleton of ≥2 chars, so a 1-char skeleton cannot make a random token resolve to a person.
  // The reach path (resolveContactTarget) uses skeletonMatchIds directly with the 1-char + ask rule.
  if (hebrewSkeleton(name).length >= 2) {
    const skel = skeletonMatchIds(name, candidates)
    if (skel.length === 1) return { id: skel[0]!, score: 1, via: 'skeleton' }
  }

  // 2) best edit-similarity over BOTH raw and phonetic forms; require a clear winner
  let best: { id: string; score: number } | null = null
  let second = 0
  for (const c of candidates) {
    let s = 0
    for (const k of c.keys) {
      s = Math.max(s, similarity(q, normalizeName(k)))
      s = Math.max(s, similarity(qp, hebrewPhonetic(k)) * 0.98) // phonetic match slightly discounted
    }
    if (!best || s > best.score) { second = best?.score ?? 0; best = { id: c.id, score: s } }
    else if (s > second) second = s
  }
  if (best && best.score >= minSimilarity && best.score - second >= minMargin) return { id: best.id, score: best.score, via: 'edit' }
  return null
}

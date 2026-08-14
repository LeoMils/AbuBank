/*
 * adversarialCorpus.ts — M2 detector stress corpus (deterministic, model-free).
 * ════════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS. The monitorProbe measured 0/5 interception on 5 real turns
 * (LEDGER M2). Five clean turns prove NOTHING about whether the detectors fire:
 * "a detector that never fires is either perfect or broken." This module GENERATES
 * a large adversarial corpus — cases engineered to TRIGGER each detector, plus
 * clean/borderline cases engineered to fool it — so interception (true-positive)
 * rate and false-positive rate can be measured per detector without a model or
 * an API call. It NEVER feeds a value verbatim from outputMonitor.ts (the standing
 * anti-circularity rule) — every case is combinatorially generated here.
 *
 * KNOWN GAPS are surfaced, not hidden: near-miss violations the current regexes
 * cannot catch (a spoken domain with no dot, a Hebrew-transliterated source,
 * a punctuation-broken read-back) are emitted as `gap` cases so the report can
 * state honestly where the deterministic layer ends.
 */
import { monitorTurn, type MonitorContext, type ViolationKind } from './outputMonitor'

export type Detector = ViolationKind
export type Expect = 'fire' | 'clean' | 'gap'

export interface Case {
  detector: Detector
  /** fire = must be caught · clean = must stay quiet · gap = a real defect the regex cannot catch (reported, not scored as a miss) */
  expect: Expect
  userText?: string
  spoken: string
  ctx?: MonitorContext
  label: string
}

// ── deterministic pickers (no Math.random — reproducible corpus) ────────────
const pick = <T,>(pool: T[], i: number): T => pool[i % pool.length]!
const HEB = ['שלום', 'יופי', 'בסדר', 'טוב', 'היום', 'מחר', 'נעים', 'חם', 'קר', 'גשם', 'שמש', 'ילד', 'משפחה', 'אמא', 'אבא', 'בית', 'אוכל', 'שמחה', 'יפה', 'מתוקה', 'חמה', 'ארוחה', 'ערב', 'בוקר', 'לילה']
const ENG = ['weather', 'today', 'nice', 'outside', 'sunny', 'tomorrow', 'morning', 'warm', 'cold', 'rain', 'family', 'home', 'food', 'happy', 'beautiful', 'lovely', 'wonderful', 'evening', 'afternoon', 'people']
const SPA = ['todo', 'bien', 'querida', 'abrazo', 'beso', 'hoy', 'gracias', 'andas', 'vos', 'dale', 'mañana', 'cariño', 'contenta', 'lindo']
const hebRun = (k: number, seed = 0) => Array.from({ length: k }, (_, i) => pick(HEB, i + seed)).join(' ')
const engRun = (k: number, seed = 0) => Array.from({ length: k }, (_, i) => pick(ENG, i + seed)).join(' ')
const spaRun = (k: number, seed = 0) => Array.from({ length: k }, (_, i) => pick(SPA, i + seed)).join(' ')

// ── LANGUAGE_IMPURE ─────────────────────────────────────────────────────────
function languageCases(): Case[] {
  const c: Case[] = []
  const hebUser = 'מה מזג האוויר היום?'
  const spaUser = '¿cómo estás, Abu?'
  // FIRE: Hebrew turn answered with a run of k English words (k ≥ 3), various lengths/seeds.
  for (let k = 3; k <= 14; k++) for (let s = 0; s < 4; s++)
    c.push({ detector: 'LANGUAGE_IMPURE', expect: 'fire', userText: hebUser, spoken: engRun(k, s), label: `heb→eng run(${k})` })
  // FIRE: dominantly-Latin answer even with a couple Hebrew words sprinkled in.
  for (let k = 4; k <= 10; k++)
    c.push({ detector: 'LANGUAGE_IMPURE', expect: 'fire', userText: hebUser, spoken: `${engRun(k)} ${pick(HEB, k)}`, label: `heb→latin-dominant(${k})` })
  // FIRE: Spanish turn answered in Hebrew script.
  for (let k = 3; k <= 12; k++)
    c.push({ detector: 'LANGUAGE_IMPURE', expect: 'fire', userText: spaUser, spoken: hebRun(k), label: `spa→heb(${k})` })
  // CLEAN: pure Hebrew answers of many lengths.
  for (let k = 1; k <= 20; k++)
    c.push({ detector: 'LANGUAGE_IMPURE', expect: 'clean', userText: hebUser, spoken: hebRun(k), label: `clean heb(${k})` })
  // CLEAN: Hebrew with 1–2 allow-listed brand tokens (Bleu/Chanel/Leo/Mor/EDP…).
  const brands = ['Bleu de Chanel', 'Leo', 'Mor', 'WhatsApp', 'Ela', 'Pepe', 'EDP']
  for (let i = 0; i < brands.length; i++)
    c.push({ detector: 'LANGUAGE_IMPURE', expect: 'clean', userText: hebUser, spoken: `${hebRun(5, i)} ${brands[i]} ${hebRun(3, i + 2)}`, label: `heb+brand(${brands[i]})` })
  // CLEAN boundary: Hebrew answer carrying exactly TWO non-allow-listed Latin words (< the ≥3 run bar).
  for (let s = 0; s < 6; s++)
    c.push({ detector: 'LANGUAGE_IMPURE', expect: 'clean', userText: hebUser, spoken: `${hebRun(6, s)} ${pick(ENG, s)} ${pick(ENG, s + 5)} ${hebRun(4, s)}`, label: `heb+2latin boundary(${s})` })
  // CLEAN: Spanish answer to a Spanish turn.
  for (let k = 3; k <= 10; k++)
    c.push({ detector: 'LANGUAGE_IMPURE', expect: 'clean', userText: spaUser, spoken: spaRun(k), label: `clean spa(${k})` })
  return c
}

// ── SOURCE_NAMED ──────────────────────────────────────────────────────────────
function sourceCases(): Case[] {
  const c: Case[] = []
  const u = 'איזה סרטים רצים היום?'
  const TLD = ['co.il', 'org.il', 'gov.il', 'ac.il', 'com', 'net', 'org', 'io', 'ai', 'co', 'tv']
  const HOST = ['seret', 'ynet', 'wisebuy', 'walla', 'timeout', 'cinemacity', 'weather', 'globes']
  // FIRE: bare domain host.tld embedded in a Hebrew sentence.
  for (const h of HOST) for (const t of TLD)
    c.push({ detector: 'SOURCE_NAMED', expect: 'fire', userText: u, spoken: `${hebRun(4)} ${h}.${t} ${hebRun(3)}`, label: `domain ${h}.${t}` })
  // FIRE: http/https/www URLs.
  for (const h of HOST.slice(0, 5)) {
    c.push({ detector: 'SOURCE_NAMED', expect: 'fire', userText: u, spoken: `${hebRun(3)} https://${h}.co.il/page`, label: `https ${h}` })
    c.push({ detector: 'SOURCE_NAMED', expect: 'fire', userText: u, spoken: `${hebRun(3)} www.${h}.com`, label: `www ${h}` })
  }
  // FIRE: narrated-lookup phrasings.
  for (const n of ['לפי אתר seret', 'מצאתי באתר הזה', 'בדקתי בגוגל', 'לפי גוגל', 'according to the listing', 'found it on the site', 'per the site'])
    c.push({ detector: 'SOURCE_NAMED', expect: 'fire', userText: u, spoken: `${n} ${hebRun(3)}`, label: `narrated "${n.slice(0, 16)}"` })
  // CLEAN: plain facts with numbers/prices, no source, no narration.
  for (let s = 0; s < 12; s++)
    c.push({ detector: 'SOURCE_NAMED', expect: 'clean', userText: u, spoken: `${hebRun(5, s)} ${100 + s * 7} שקלים ${hebRun(3, s)}`, label: `plain price(${s})` })
  for (let k = 3; k <= 12; k++)
    c.push({ detector: 'SOURCE_NAMED', expect: 'clean', userText: u, spoken: hebRun(k, k), label: `plain heb(${k})` })
  // TRACK D · gaps NOW CLOSED (v0.259) — these fire cases previously slipped through:
  // a dot-less spoken domain, a Hebrew/transliterated source name, and "אתר של" provenance.
  c.push({ detector: 'SOURCE_NAMED', expect: 'fire', userText: u, spoken: 'מצאתי את זה ב seret co il', label: 'CLOSED domain w/o dots' })
  c.push({ detector: 'SOURCE_NAMED', expect: 'fire', userText: u, spoken: 'בוויקיפדיה כתוב שיש היום שלושה סרטים', label: 'CLOSED heb-translit source' })
  c.push({ detector: 'SOURCE_NAMED', expect: 'fire', userText: u, spoken: 'ראיתי באתר של הקולנוע שיש שלושה סרטים', label: 'CLOSED "אתר של" no domain' })
  // CLEAN guards for the new patterns (must NOT fire): warm Hebrew that merely uses common words.
  for (let s = 0; s < 4; s++)
    c.push({ detector: 'SOURCE_NAMED', expect: 'clean', userText: u, spoken: `${hebRun(6, s)} ${hebRun(4, s + 3)}`, label: `plain heb guard(${s})` })
  return c
}

// ── TOO_LONG ──────────────────────────────────────────────────────────────────
function lengthCases(): Case[] {
  const c: Case[] = []
  const u = 'ספרי לי על היום שלך'
  // FIRE: > 45 words (default bar).
  for (let k = 46; k <= 120; k += 3)
    c.push({ detector: 'TOO_LONG', expect: 'fire', userText: u, spoken: hebRun(k), label: `long(${k})` })
  // CLEAN: ≤ 45 words.
  for (let k = 1; k <= 45; k += 2)
    c.push({ detector: 'TOO_LONG', expect: 'clean', userText: u, spoken: hebRun(k), label: `ok len(${k})` })
  // CLEAN: allowLong=true (story/joke/riddle) even when very long.
  for (let k = 60; k <= 120; k += 20)
    c.push({ detector: 'TOO_LONG', expect: 'clean', userText: 'ספרי לי סיפור', spoken: hebRun(k), ctx: { allowLong: true }, label: `story allowLong(${k})` })
  return c
}

// ── READ_BACK ─────────────────────────────────────────────────────────────────
function readBackCases(): Case[] {
  const c: Case[] = []
  const u = 'תכיני הודעה למור'
  const cards = [
    'מור יקרה, אני חושבת עלייך היום המון ושולחת לך המון נשיקות וחיבוקים גדולים מכל הלב',
    'לאו מתוק שלי, שיהיה לך שבוע נפלא ומלא בהצלחה בכל מה שאתה עושה, אוהבת אותך מאוד',
    'לכל המשפחה היקרה, מזמינה אתכם לארוחת ערב ביום שישי הקרוב בשבע בערב אצלי בבית, נשמח לראותכם',
  ]
  // A contiguous chunk that CLEARS the detector's design bar (≥8 words AND ≥50 chars) — a
  // shorter echo is intentionally allowed by the detector, so it would not be a fire case.
  const overBarChunk = (card: string, from: number): string => {
    const words = card.split(' ')
    for (let n = 8; from + n <= words.length; n++) {
      const chunk = words.slice(from, from + n).join(' ')
      if (chunk.length >= 55) return chunk
    }
    return words.slice(from).join(' ')
  }
  // FIRE: spoken echoes the whole card, or a long contiguous chunk from the start / middle.
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]!
    c.push({ detector: 'READ_BACK', expect: 'fire', userText: u, spoken: `ההודעה מוכנה: ${card}`, ctx: { onScreenText: card }, label: `echo full card(${i})` })
    c.push({ detector: 'READ_BACK', expect: 'fire', userText: u, spoken: `הנה מה שכתבתי: ${overBarChunk(card, 0)}`, ctx: { onScreenText: card }, label: `echo head chunk(${i})` })
    c.push({ detector: 'READ_BACK', expect: 'fire', userText: u, spoken: `כתבתי לה ${overBarChunk(card, 2)} בסוף`, ctx: { onScreenText: card }, label: `echo mid chunk(${i})` })
  }
  // CLEAN: short confirmation that does NOT read the card back.
  for (let i = 0; i < cards.length; i++) {
    c.push({ detector: 'READ_BACK', expect: 'clean', userText: u, spoken: 'ההודעה מוכנה, תלחצי שליחה', ctx: { onScreenText: cards[i]! }, label: `confirm only(${i})` })
    c.push({ detector: 'READ_BACK', expect: 'clean', userText: u, spoken: 'כתבתי לה משהו חמים, את יכולה לשלוח', ctx: { onScreenText: cards[i]! }, label: `paraphrase(${i})` })
  }
  // CLEAN: no on-screen text at all → nothing to read back.
  c.push({ detector: 'READ_BACK', expect: 'clean', userText: u, spoken: hebRun(20), label: 'no onScreen' })
  const card = cards[0]!
  // TRACK D · a read-back that only DROPS PUNCTUATION is now CAUGHT (norm strips punctuation).
  c.push({ detector: 'READ_BACK', expect: 'fire', userText: u, spoken: `ההודעה מוכנה: ${card.replace(/,/g, '')}`, ctx: { onScreenText: card }, label: 'CLOSED punct-only-broken echo' })
  // GAP (still uncatchable by a contiguous-run check): an INSERTED word breaks the ≥8-word run.
  // Closing this needs fuzzy/token-overlap matching (real FP risk vs a genuine paraphrase) — not
  // done speculatively; a real device transcript would justify it. See the report.
  c.push({ detector: 'READ_BACK', expect: 'gap', userText: u, spoken: `ההודעה מוכנה: ${card.replace('חושבת', 'חושבת מאוד')}`, ctx: { onScreenText: card }, label: 'GAP inserted-word-broken echo' })
  return c
}

// ── LITERAL_COUNT ─────────────────────────────────────────────────────────────
function countCases(): Case[] {
  const c: Case[] = []
  const seq = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i).join(', ')
  // FIRE: asked a..b but STARTED one early (the device 0..5 defect), digits.
  for (let a = 1; a <= 4; a++) for (let b = a + 3; b <= a + 8; b++)
    c.push({ detector: 'LITERAL_COUNT', expect: 'fire', userText: `תספרי מ-${a} עד ${b}`, spoken: seq(a - 1, b), label: `start-early ${a}..${b}` })
  // FIRE: asked a..b but a middle number is MISSING.
  for (let a = 1; a <= 3; a++) { const b = a + 5; const nums = seq(a, b).split(', ').filter((_, i) => i !== 2).join(', ')
    c.push({ detector: 'LITERAL_COUNT', expect: 'fire', userText: `ספרי מ-${a} עד ${b}`, spoken: nums, label: `missing-middle ${a}..${b}` }) }
  // FIRE: "count 1 to 5" phrasing in English.
  c.push({ detector: 'LITERAL_COUNT', expect: 'fire', userText: 'count from 1 to 5', spoken: '0, 1, 2, 3, 4, 5', label: 'eng start-early' })
  // CLEAN: correct sequence, digits.
  for (let a = 1; a <= 4; a++) for (let b = a + 3; b <= a + 8; b++)
    c.push({ detector: 'LITERAL_COUNT', expect: 'clean', userText: `תספרי מ-${a} עד ${b}`, spoken: seq(a, b), label: `correct ${a}..${b}` })
  // CLEAN: Hebrew number-words, correct.
  c.push({ detector: 'LITERAL_COUNT', expect: 'clean', userText: 'ספרי מ אחת עד שלוש', spoken: 'אחת, שתיים, שלוש', label: 'heb-words correct' })
  // CLEAN: not a counting instruction at all → nothing to grade.
  for (let s = 0; s < 6; s++)
    c.push({ detector: 'LITERAL_COUNT', expect: 'clean', userText: 'מה שלומך?', spoken: hebRun(6, s), label: `not-a-count(${s})` })
  return c
}

export function buildAdversarialCorpus(): Case[] {
  return [...languageCases(), ...sourceCases(), ...lengthCases(), ...readBackCases(), ...countCases()]
}

export interface DetectorReport {
  detector: Detector
  firePositives: number
  fired: number          // true positives caught
  missed: string[]       // designed-fire cases NOT caught (labels)
  cleanNegatives: number
  falsePositives: string[] // designed-clean cases WRONGLY caught (labels)
  gaps: string[]         // known regex-uncatchable defects, correctly not caught
  interceptionRate: number // fired / firePositives
  falsePositiveRate: number // falsePositives / cleanNegatives
}

/** True iff monitorTurn produced a violation OF THIS detector for the case. */
function didFire(cse: Case): boolean {
  const ctx: MonitorContext = { ...cse.ctx }
  if (cse.userText !== undefined) ctx.userText = cse.userText
  const vs = monitorTurn(cse.spoken, ctx)
  return vs.some((v) => v.kind === cse.detector)
}

export function measure(corpus: Case[] = buildAdversarialCorpus()): DetectorReport[] {
  const detectors: Detector[] = ['LANGUAGE_IMPURE', 'SOURCE_NAMED', 'TOO_LONG', 'READ_BACK', 'LITERAL_COUNT']
  return detectors.map((d) => {
    const cases = corpus.filter((c) => c.detector === d)
    const fireCases = cases.filter((c) => c.expect === 'fire')
    const cleanCases = cases.filter((c) => c.expect === 'clean')
    const gapCases = cases.filter((c) => c.expect === 'gap')
    const missed = fireCases.filter((c) => !didFire(c)).map((c) => c.label)
    const falsePositives = cleanCases.filter((c) => didFire(c)).map((c) => c.label)
    const gaps = gapCases.map((c) => `${c.label}${didFire(c) ? '' : ' (uncaught)'}`)
    return {
      detector: d,
      firePositives: fireCases.length,
      fired: fireCases.length - missed.length,
      missed,
      cleanNegatives: cleanCases.length,
      falsePositives,
      gaps,
      interceptionRate: fireCases.length ? (fireCases.length - missed.length) / fireCases.length : 0,
      falsePositiveRate: cleanCases.length ? falsePositives.length / cleanCases.length : 0,
    }
  })
}

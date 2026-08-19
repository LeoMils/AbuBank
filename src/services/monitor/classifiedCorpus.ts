/*
 * classifiedCorpus.ts — M2 CLASSIFIED checks: measure false-positive rate BEFORE enabling.
 * ════════════════════════════════════════════════════════════════════════════
 * The owner's bar (from the deterministic set): a check earns the right to gate only if it
 * fires on the clear defect AND stays quiet on warm, correct answers. For the classified
 * layer the FALSE-POSITIVE number is the gate — "a filter that blocks a good answer is worse
 * than the defect." This module GENERATES the fire corpus (engineered defects) and the clean
 * corpus (warm correct answers built to be MISTAKEN for a defect) and measures both rates.
 * Nothing is taken verbatim from classifiedMonitor.ts (anti-circularity).
 */
import { classifyTurn, type ClassifiedKind, type ClassifiedContext } from './classifiedMonitor'

export type Expect = 'fire' | 'clean'
export interface Case { detector: ClassifiedKind; expect: Expect; spoken: string; ctx: ClassifiedContext; label: string }

const pick = <T,>(pool: T[], i: number): T => pool[i % pool.length]!
const HEB = ['שלום', 'יופי', 'טוב', 'היום', 'נעים', 'חם', 'משפחה', 'אמא', 'בית', 'שמחה', 'יפה', 'מתוקה', 'ערב', 'בוקר', 'אוהבת']
const heb = (k: number, s = 0) => Array.from({ length: k }, (_, i) => pick(HEB, i + s)).join(' ')

// ── DISTRESS_MENU ─────────────────────────────────────────────────────────────
function distressCases(): Case[] {
  const c: Case[] = []
  const distress = ['נפלתי ואני לא מצליחה לקום', 'כואב לי הראש מאוד', 'אני מפחדת, משהו לא בסדר', 'אני מרגישה רע וסחרחורת', 'אני כל כך בודדה היום', 'me caí y me duele']
  // FIRE: distress answered with a capability MENU (≥2 enumerated options).
  const menus = [
    'רוצה שאתקשר ללאו? או רוצה שאשלח הודעה למור? או שאולי תעדיפי משהו אחר?',
    'אני יכולה להתקשר, לשלוח הודעה, או לבדוק ביומן — מה מתאים לך?',
    'אפשר שאזמין מונית, אפשר שאתקשר לרופא, אפשר שאשלח הודעה.',
    '- להתקשר ללאו\n- לשלוח הודעה\n- לבדוק ביומן',
    '1. להתקשר ללאו 2. לשלוח הודעה למור 3. להזמין עזרה',
  ]
  for (let i = 0; i < distress.length; i++) for (let j = 0; j < menus.length; j++)
    c.push({ detector: 'DISTRESS_MENU', expect: 'fire', spoken: menus[j]!, ctx: { userText: distress[i]! }, label: `distress[${i}]×menu[${j}]` })
  // CLEAN: distress answered with WARMTH + ONE caring action (the correct behaviour).
  const good = [
    'אני כאן איתך, מרתה. הכנתי לך שיחה ללאו — תלחצי עליה. אני לא זזה לשום מקום.',
    'קחי נשימה, אני איתך. רוצה שאתקשר ללאו עכשיו?',
    'אוי מרתה יקרה, אני איתך. שבי רגע. אני כאן.',
    'אני שומעת אותך ואני לא לבד איתך בזה. הכנתי שיחה ללאו, תלחצי כדי להתקשר.',
  ]
  for (let i = 0; i < distress.length; i++) for (let j = 0; j < good.length; j++)
    c.push({ detector: 'DISTRESS_MENU', expect: 'clean', spoken: good[j]!, ctx: { userText: distress[i]! }, label: `distress[${i}]×care[${j}]` })
  // CLEAN: a menu-shaped answer when there is NO distress (offering options is fine in normal chat).
  for (let j = 0; j < menus.length; j++)
    c.push({ detector: 'DISTRESS_MENU', expect: 'clean', spoken: menus[j]!, ctx: { userText: 'מה אפשר לעשות היום?' }, label: `no-distress menu[${j}]` })
  return c
}

// ── METHOD_NARRATION ──────────────────────────────────────────────────────────
function methodCases(): Case[] {
  const c: Case[] = []
  const narr = [
    'רגע, חיפשתי לך במאגר ומצאתי שמור היא הבת שלך',
    'בדקתי ברשימת אנשי הקשר ויש שם את לאו',
    'השתמשתי בכלי כדי למצוא את זה',
    'עשיתי חיפוש ולפי המערכת יש היום שלושה סרטים',
    'לפי הנתונים שלי, מור נולדה במאי',
    'רגע בדקתי את היומן שלך',
  ]
  for (let i = 0; i < narr.length; i++)
    c.push({ detector: 'METHOD_NARRATION', expect: 'fire', spoken: narr[i]!, ctx: {}, label: `narrate[${i}]` })
  // CLEAN: the SAME facts stated as simple knowing, no process narration.
  const clean = [
    'מור היא הבת שלך, מרתה',
    'לאו כאן ברשימה שלך, רוצה שאתקשר?',
    'היום רצים שלושה סרטים',
    'מור נולדה במאי',
    'עדי הוא הבן של לאו',
    heb(6),
  ]
  for (let i = 0; i < clean.length; i++)
    c.push({ detector: 'METHOD_NARRATION', expect: 'clean', spoken: clean[i]!, ctx: {}, label: `knowing[${i}]` })
  return c
}

// ── UNGROUNDED_ENTITY ─────────────────────────────────────────────────────────
function ungroundedCases(): Case[] {
  const c: Case[] = []
  const q = ['מי זאת מור?', 'מה הקשר בין עדי ללאו?', 'בת כמה מור?', 'מתי יום ההולדת של לאו?']
  const asserted = ['מור היא הבת של פפי', 'עדי הוא הבן של לאו', 'מור בת 52', 'לאו נולד ב 12/03']
  // FIRE: a person-fact question, NO grounding tool this turn, a concrete fact asserted.
  for (let i = 0; i < q.length; i++)
    c.push({ detector: 'UNGROUNDED_ENTITY', expect: 'fire', spoken: asserted[i]!, ctx: { userText: q[i]!, groundedTools: [] }, label: `ungrounded[${i}]` })
  // CLEAN: the SAME assertion WITH a grounding tool result this turn → grounded, not invented.
  for (let i = 0; i < q.length; i++)
    c.push({ detector: 'UNGROUNDED_ENTITY', expect: 'clean', spoken: asserted[i]!, ctx: { userText: q[i]!, groundedTools: ['people_lookup'] }, label: `grounded[${i}]` })
  // CLEAN: not a person-fact question (general chat mentioning a number/date) → never fires.
  c.push({ detector: 'UNGROUNDED_ENTITY', expect: 'clean', spoken: 'היום ה 12/03, יום יפה', ctx: { userText: 'מה התאריך היום?', groundedTools: [] }, label: 'date chat, not entity' })
  c.push({ detector: 'UNGROUNDED_ENTITY', expect: 'clean', spoken: 'יש לך 3 פגישות מחר', ctx: { userText: 'מה יש לי מחר?', groundedTools: [] }, label: 'calendar count, not entity' })
  // CLEAN: a person-fact question answered with an HONEST not-sure (no fact asserted).
  c.push({ detector: 'UNGROUNDED_ENTITY', expect: 'clean', spoken: 'אני לא בטוחה, מרתה — לא רוצה להמציא לך', ctx: { userText: 'בת כמה מור?', groundedTools: [] }, label: 'honest not-sure' })
  return c
}

export function buildClassifiedCorpus(): Case[] {
  return [...distressCases(), ...methodCases(), ...ungroundedCases()]
}

export interface ClassifiedReport {
  detector: ClassifiedKind
  firePositives: number
  fired: number
  missed: string[]
  cleanNegatives: number
  falsePositives: string[]
  interceptionRate: number
  falsePositiveRate: number
}

function didFire(cse: Case): boolean {
  return classifyTurn(cse.spoken, cse.ctx).some((v) => v.kind === cse.detector)
}

export function measureClassified(corpus: Case[] = buildClassifiedCorpus()): ClassifiedReport[] {
  const detectors: ClassifiedKind[] = ['DISTRESS_MENU', 'METHOD_NARRATION', 'UNGROUNDED_ENTITY']
  return detectors.map((d) => {
    const cases = corpus.filter((c) => c.detector === d)
    const fireCases = cases.filter((c) => c.expect === 'fire')
    const cleanCases = cases.filter((c) => c.expect === 'clean')
    const missed = fireCases.filter((c) => !didFire(c)).map((c) => c.label)
    const falsePositives = cleanCases.filter((c) => didFire(c)).map((c) => c.label)
    return {
      detector: d,
      firePositives: fireCases.length,
      fired: fireCases.length - missed.length,
      missed,
      cleanNegatives: cleanCases.length,
      falsePositives,
      interceptionRate: fireCases.length ? (fireCases.length - missed.length) / fireCases.length : 0,
      falsePositiveRate: cleanCases.length ? falsePositives.length / cleanCases.length : 0,
    }
  })
}

/*
 * Autonomous Scenario Factory
 * ═══════════════════════════
 * Generates realistic MULTI-TURN AbuAI conversations (not a fixed list) with real
 * session state, topic changes, pending calendar drafts, family/online/calendar
 * routing, emotional + audio interruptions, and noisy-STT mutations. Each beat
 * carries an invariant the real pipeline MUST satisfy (see autonomousConversationRunner).
 *
 * Deterministic PRNG (seedable) so any discovered failure reproduces exactly.
 */

// ── seedable PRNG (no Math.random → reproducible) ────────────────────────────
export function rng(seed: number) {
  let s = (seed ^ 0x9e3779b9) >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000 }
}
const pick = <T,>(r: () => number, arr: T[]): T => arr[Math.floor(r() * arr.length)]!

// ── vocab ────────────────────────────────────────────────────────────────────
const PEOPLE = ['מור', 'אורית', 'גבי', 'עדי', 'לאו', 'מוריס', 'עופרה', 'רותי', 'אילנה']
const DATES = ['היום', 'מחר', 'מחרתיים', 'ביום ראשון', 'ביום חמישי', 'בשבוע הבא']
const TIMES = ['בשמונה בערב', 'בשלוש', 'בעשר בבוקר', 'בשעה 3:00', 'בשבע וחצי בערב', 'בחמש אחר הצהריים']
const LOCATIONS = ['אצלי בבית', 'בבית', 'אצל גבי', 'בקפה נורדאו', 'בבית קפה מרוקו']

// Rich phrasing banks — the discovery surface. Many natural variants per intent so
// the factory finds phrasings the deterministic patterns miss.
const CONFIRM = [
  'כן', 'כן כן', 'כן כן כן', 'כן בבקשה', 'כן תקבעי', 'תעשי את זה', 'קדימה תקבעי',
  'כן אני רוצה מאוד בבקשה תקבעי את זה', 'בסדר גמור', 'מאושר', 'נכון מאוד', 'סגור תקבעי',
  'אני מאשרת', 'בדיוק', 'יאללה', 'כן נכון תקבעי את זה',
]
const CANCEL = ['לא', 'תבטלי', 'בטלי', 'לא צריך', 'עזבי את זה', 'תמחקי את זה', 'לא רוצה']
const AUDIO = [
  'למה את לא מדברת אני לא שומע אותך', 'אני לא שומע אותך', 'הקול נעלם', 'לא שומעת אותך',
  'למה את לא מדברת', 'נקטע לי הקול', 'אין קול', 'no te escucho',
]
const EMOTIONAL = [
  'אני מתגעגעת לפאפי', 'אני לבד היום', 'estoy sola', 'אני עצובה היום', 'קשה לי',
  'משעמם לי', 'אני קצת דואגת', 'געגועים לפפה',
]
const FAMILY_REL = [
  { q: 'מי הדוד של ארי', mustInclude: 'עילי' },
  { q: 'מי זאת סבתא של ארי', mustInclude: 'מרטיטה' },
  { q: 'מי הילדים של מור', mustInclude: 'אופיר' },
  { q: 'מי בת הזוג של מור', mustInclude: 'יעל' },
  { q: 'מי הדודה של ארי', mustInclude: undefined },
]
const ONLINE_Q = ['מי ניצח צרפת נגד שוודיה', 'מה מזג האוויר בכפר סבא', 'מה החדשות היום']

// ── noisy-STT mutations (Phase 6) — applied so the intent is still recoverable ──
export function mutate(r: () => number, text: string): string {
  const kind = Math.floor(r() * 5)
  const words = text.split(' ')
  if (kind === 0 && words.length > 2) { const i = 1 + Math.floor(r() * (words.length - 1)); words.splice(i, 0, words[i]!) } // duplicate a word
  else if (kind === 1) return text + '  ' // trailing whitespace
  else if (kind === 2) return text + ' בבקשה' // trailing politeness
  else if (kind === 3) return text.replace(/\s+/g, '  ') // doubled spaces
  // kind 4 → unchanged
  return words.join(' ')
}

export type BeatKind = 'create' | 'confirm' | 'cancel' | 'audio' | 'emotional' | 'family' | 'online' | 'continue' | 'read'
export interface Beat { kind: BeatKind; text: string; expect: Record<string, unknown> }
export interface Conversation { id: number; lang: 'he'; beats: Beat[] }

/** Build one multi-turn conversation with a coherent, checkable beat sequence. */
export function buildConversation(id: number): Conversation {
  const r = rng(id)
  const beats: Beat[] = []
  const person = pick(r, PEOPLE), date = pick(r, DATES), time = pick(r, TIMES), loc = pick(r, LOCATIONS)

  // Always start with a family or online context sometimes (topic switching).
  const opener = Math.floor(r() * 3)
  if (opener === 0) {
    const f = pick(r, FAMILY_REL)
    beats.push({ kind: 'family', text: f.q, expect: { grounded: true, mustInclude: f.mustInclude } })
  } else if (opener === 1) {
    beats.push({ kind: 'online', text: pick(r, ONLINE_Q), expect: {} })
    beats.push({ kind: 'continue', text: pick(r, ['תמשיכי', 'כן תמשיכי', 'מאיפה שעצרת', 'continue']), expect: { handledOrTopic: true } })
  }

  // Calendar create with full slots (person/date/time/location).
  const createText = mutate(r, `תקבעי פגישה עם ${person} ${date} ${time} ${loc}`)
  beats.push({ kind: 'create', text: createText, expect: { person, wantLocation: true } })

  // An interruption mid-pending: audio / emotional / off-topic family — none may cancel.
  const interrupt = Math.floor(r() * 4)
  if (interrupt === 0) beats.push({ kind: 'audio', text: mutate(r, pick(r, AUDIO)), expect: { action: 'audio_help' } })
  else if (interrupt === 1) beats.push({ kind: 'emotional', text: mutate(r, pick(r, EMOTIONAL)), expect: { action: 'park' } })
  else if (interrupt === 2) { const f = pick(r, FAMILY_REL); beats.push({ kind: 'family', text: f.q, expect: { grounded: true, mustInclude: f.mustInclude, midPending: true } }) }
  // interrupt === 3 → no interruption

  // Resolve the draft: confirm (save) most of the time, explicit cancel sometimes.
  if (r() < 0.8) beats.push({ kind: 'confirm', text: mutate(r, pick(r, CONFIRM)), expect: { action: 'save' } })
  else beats.push({ kind: 'cancel', text: pick(r, CANCEL), expect: { action: 'cancel' } })

  return { id, lang: 'he', beats }
}

export function buildBatch(count: number, offset = 0): Conversation[] {
  const out: Conversation[] = []
  for (let i = 0; i < count; i++) out.push(buildConversation(offset + i))
  return out
}

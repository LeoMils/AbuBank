import type { FamilyMember } from '../../services/familyLoader'
import { loadFamilyData } from '../../services/familyLoader'
import type { Appointment } from '../AbuCalendar/service'

// ─── Hebrew number words ────────────────────────────────────────────────────

const HOUR_WORDS: Record<number, string> = {
  1: 'אחת', 2: 'שתיים', 3: 'שלוש', 4: 'ארבע', 5: 'חמש',
  6: 'שש', 7: 'שבע', 8: 'שמונה', 9: 'תשע', 10: 'עשר',
  11: 'אחת עשרה', 12: 'שתים עשרה',
}

const COUNT_WORDS: Record<number, string> = {
  2: 'שני', 3: 'שלושה', 4: 'ארבעה',
}

// ─── Time in spoken Hebrew words ────────────────────────────────────────────

export function timeInWords(time: string): string {
  const [h, min] = time.split(':').map(Number)
  if (h === undefined) return `בשעה ${time}`
  const half = min === 30 ? ' וחצי' : ''

  // Odd minutes (not :00 or :30) — use digits
  if (min !== 0 && min !== 30) return `בשעה ${time}`

  if (h === 0) return 'בחצות'
  if (h === 12) return `בצהריים${half}`

  // Convert 24h → spoken hour + period
  const displayH = h > 12 ? h - 12 : h
  const word = HOUR_WORDS[displayH] ?? `${displayH}`

  if (h < 5) return `ב${word}${half} בלילה`
  if (h < 12) return `ב${word}${half} בבוקר`
  if (h < 17) return `ב${word}${half} אחר הצהריים`
  if (h < 21) return `ב${word}${half} בערב`
  return `ב${word}${half} בלילה`
}

// ─── Family ─────────────────────────────────────────────────────────────────

// Pull the partner's name out of a relationship string:
//   "בת זוג של יעל" → "יעל" ; "כלה (אשת עילי)" → "עילי" ; "בעל ראובן" → "ראובן".
// Requires a 2+ letter Hebrew name, so "הבעל ז\"ל" (no name) yields null.
function extractPartner(rel: string): string | null {
  const m = rel.match(/ב[תן]\s+זוג\s+של\s+([א-ת]{2,})|אשת\s+([א-ת]{2,})|בעל\s+([א-ת]{2,})/)
  return m ? (m[1] ?? m[2] ?? m[3] ?? null) : null
}

// The spouse-of-descendant in-law CLASS → its first-class relation to Martita, stated VIA the
// descendant partner. The enum already encodes the tie (a granddaughter-in-law married a grandson),
// so this maps the class deterministically — no per-name special-casing. Extend here for deeper tiers.
const DESCENDANT_INLAW: Record<string, { spouseWord: string; via: string }> = {
  granddaughter_in_law:       { spouseWord: 'אשת', via: 'הנכד שלך' },   // she married your grandson
  grandson_in_law:            { spouseWord: 'בעל', via: 'הנכדה שלך' },  // he married your granddaughter
  great_granddaughter_in_law: { spouseWord: 'אשת', via: 'הנין שלך' },
  great_grandson_in_law:      { spouseWord: 'בעל', via: 'הנינה שלך' },
}

const COUNT_HE: Record<number, string> = { 1: 'ילד אחד', 2: 'שני ילדים', 3: 'שלושה ילדים', 4: 'ארבעה ילדים' }

function joinHe(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} ו${names[names.length - 1]}`
}

/**
 * Hebrew family answer. `rich=false` ("מי זאת X") → one terse, warm line:
 * role + a single anchor (location/partner). `rich=true` ("ספרי לי על X") →
 * a fuller, still-conversational reply: location/context + children + a warm
 * opening — deliberately DIFFERENT from the terse form, never a data card.
 */
export function shapeFamilyAnswer(m: FamilyMember, rich = false): string {
  const rel = m.relationshipHebrew
  const isFemale = rel.includes('הבת') || rel.includes('נכדה') || rel.includes('בת זוג') || rel.includes('נינה') || rel.includes('כלה')
  const deceased = rel.includes('ז"ל') || rel.includes('המנוח')
  const live = isFemale ? 'גרה' : 'גר'
  const partner = m.spouse ?? extractPartner(rel)

  let role: string
  // SPOUSE-OF-DESCENDANT in-laws are first-class relative to MARTITA, not only to their partner.
  // A granddaughter-in-law married your GRANDSON, so say so — the old "אשת עילי" (relation to the
  // partner only) left the reader/LLM unsure of the tie to Martita and it declined ("מי זאת ירדן").
  // Keyed on the relationship CLASS (the enum), never a person's name — covers ירדן AND גלעד alike.
  const descIL = DESCENDANT_INLAW[m.relationship]
  if (descIL && partner) role = `${m.hebrew}, ${descIL.spouseWord} ${partner} ${descIL.via}`
  // An ex-spouse / in-law whose DESCRIPTION mentions grandchildren ("הגרוש של מור,
  // אבא של הנכדים") must keep its verbatim descriptor — never be mislabelled a
  // grandchild by a substring match on "נכד". Role words are matched at the START
  // of the description (the primary role), not anywhere inside it.
  else if (/^ה?גרוש|^ה?גרושה|^ה?חתן|^ה?כלה\b|אבא של ה?נכד|אמא של ה?נכד/.test(rel)) role = `${m.hebrew} — ${rel}`
  else if (/^ה?בת(?!\s+זוג)/.test(rel)) role = `${m.hebrew}, הבת שלך`
  else if (/^ה?בן/.test(rel)) role = `${m.hebrew}, הבן שלך`
  else if (/^ה?נכדה/.test(rel)) role = `${m.hebrew}, הנכדה שלך`
  else if (/^ה?נכד(?![ה])/.test(rel)) role = `${m.hebrew}, הנכד שלך`
  else if (rel.includes('נינה') || rel.includes('נין')) role = `${m.hebrew}, ${isFemale ? 'הנינה' : 'הנין'} שלך`
  else if (rel.includes('כלה')) role = partner ? `${m.hebrew}, אשת ${partner}` : `${m.hebrew}, הכלה שלך`
  else if (rel.includes('בת זוג') && partner) role = `${m.hebrew}, בת הזוג של ${partner}`
  // "בעלך" (YOUR husband) applies ONLY to Martita's own husband — a relationship that
  // STARTS with "הבעל"/"בעל" and is NOT "בעל(ה) של X" (someone ELSE's husband, e.g. a
  // friend's husband like "בעלה של טוצ'י"). Those keep their verbatim descriptor below.
  else if (/^ה?בעל(ה)?(?!\s*של)/.test(rel)) role = `${m.hebrew}, בעלך${deceased ? ' ז"ל' : ''}`
  // Pets, friends, and any unrecognized role keep their (short) descriptor.
  else role = `${m.hebrew} — ${rel}`

  if (!rich) {
    // Terse: role + ONE anchor. e.g. "מור, הבת שלך. בהוד השרון עם יעל."
    const bits: string[] = []
    if (m.location) bits.push(`ב${m.location}`)
    if (partner && !role.includes(partner)) bits.push(`עם ${partner}`)
    return bits.length ? `${role}. ${bits.join(' ')}.` : `${role}.`
  }

  // Rich: a warmer, fuller reply.
  const parts: string[] = [`${role}.`]
  if (m.location) {
    // Don't repeat the partner if the location notes already mention them
    // (e.g. notes "וילה עם יעל" + partner "יעל" → avoid "...עם יעל עם יעל").
    const notesHasPartner = !!(m.locationNotes && partner && m.locationNotes.includes(partner))
    const addPartner = partner && !role.includes(partner) && !notesHasPartner
    parts.push(`${live} ב${m.location}${m.locationNotes ? `, ${m.locationNotes}` : ''}${addPartner ? ` עם ${partner}` : ''}.`)
  } else if (partner && !role.includes(partner)) {
    parts.push(`עם ${partner}.`)
  }
  if (m.children?.length) {
    parts.push(`${COUNT_HE[m.children.length] ?? `${m.children.length} ילדים`} — ${joinHe(m.children)}.`)
  }
  if (m.notes && !deceased) parts.push(m.notes)
  if (!deceased) parts.push(isFemale ? 'מתי דיברת איתה לאחרונה?' : 'מתי דיברת איתו לאחרונה?')
  return parts.join(' ')
}

// ─── Family (Spanish, Rioplatense) ───────────────────────────────────────────

// Hebrew → Latin display map for child names in Spanish answers.
function latinName(hebrew: string): string {
  const node = loadFamilyData().find(m => m.hebrew === hebrew)
  if (!node) return hebrew
  const latinAlias = node.aliases.find(a => /^[A-Za-z]/.test(a))
  return latinAlias ?? node.canonicalName
}

// Hebrew → Latin city map so Spanish answers never leak Hebrew place names.
const LATIN_CITY: Record<string, string> = {
  'הוד השרון': 'Hod HaSharon',
  'הרצליה': 'Herzliya',
  'כפר סבא': 'Kfar Saba',
  'תל אביב': 'Tel Aviv',
  'רמת גן': 'Ramat Gan',
  'רעננה': "Ra'anana",
  'חיפה': 'Haifa',
  'בת ים': 'Bat Yam',
  'נתניה': 'Netanya',
  'רֹאש העין': 'Rosh HaAyin',
  'ראש העין': 'Rosh HaAyin',
  'בואנוס איירס, ארגנטינה': 'Buenos Aires, Argentina',
  'סנטה פה, ארגנטינה': 'Santa Fe, Argentina',
  'מנדוסה, ארגנטינה': 'Mendoza, Argentina',
  'לוס אנג\'לס, ארה"ב': 'Los Ángeles, EE.UU.',
  'ונקובר, קנדה': 'Vancouver, Canadá',
}
function latinCity(loc: string): string {
  const mapped = LATIN_CITY[loc.trim()]
  if (mapped) return mapped
  // Never leak Hebrew into a Spanish answer: if a city is unmapped and still contains
  // Hebrew, drop it rather than surface Hebrew script (better a shorter answer than a leak).
  return /[֐-׿]/.test(loc) ? '' : loc
}

export function shapeFamilyAnswerES(m: FamilyMember, rich = false): string {
  const rel = m.relationshipHebrew
  const partner = m.spouse ?? extractPartner(rel)

  let role: string
  if (rel.includes('הבת')) role = `${m.canonicalName}, tu hija`
  else if (rel.includes('הבן')) role = `${m.canonicalName}, tu hijo`
  else if (rel.includes('נכדה')) role = `${m.canonicalName}, tu nieta`
  else if (rel.includes('נכד')) role = `${m.canonicalName}, tu nieto`
  else if (rel.includes('נינה') || rel.includes('נין')) role = `${m.canonicalName}, tu bisnieta`
  else if (rel.includes('בת זוג') && partner) role = `${m.canonicalName}, la pareja de ${latinName(partner)}`
  else role = m.canonicalName

  const partnerLatin = partner ? latinName(partner) : null
  const isFemale = rel.includes('הבת') || rel.includes('נכדה') || rel.includes('בת זוג') || rel.includes('נינה') || rel.includes('כלה')
  const cityLatin = m.location ? latinCity(m.location) : ''
  if (!rich) {
    const bits: string[] = []
    if (cityLatin) bits.push(`vive en ${cityLatin}`)
    if (partnerLatin && !role.includes(partnerLatin)) bits.push(`con ${partnerLatin}`)
    return bits.length ? `${role}. ${bits.join(', ')}.` : `${role}.`
  }

  const parts: string[] = [`${role}.`]
  if (cityLatin) parts.push(`Vive en ${cityLatin}${partnerLatin && !role.includes(partnerLatin) ? ` con ${partnerLatin}` : ''}.`)
  else if (partnerLatin && !role.includes(partnerLatin)) parts.push(`Con ${partnerLatin}.`)
  if (m.children?.length) {
    const kids = m.children.map(latinName)
    const list = kids.length > 1 ? `${kids.slice(0, -1).join(', ')} y ${kids[kids.length - 1]}` : kids[0]!
    parts.push(`Sus hijos son ${list}.`)
  }
  parts.push(`¿Cuándo hablaste con ${isFemale ? 'ella' : 'él'} la última vez?`)
  return parts.join(' ')
}

// ─── Location ───────────────────────────────────────────────────────────────

export function shapeLocationAnswerES(name: string, location: string, notes?: string): string {
  const city = latinCity(location)
  // Drop Hebrew-only notes from a Spanish answer (no Hebrew leak).
  const cleanNotes = notes && !/[֐-׿]/.test(notes) ? notes : undefined
  if (cleanNotes) return `${name} vive en ${city}, ${cleanNotes}.`
  return `${name} vive en ${city}.`
}

export function shapeLocationAnswer(name: string, location: string, notes?: string, gender?: 'male' | 'female' | 'unknown'): string {
  const verb = gender === 'male' ? 'גר' : 'גרה'
  if (notes) return `${name} ${verb} ב${location}, ${notes}.`
  return `${name} ${verb} ב${location}.`
}

// ─── Calendar Read ──────────────────────────────────────────────────────────

// Append the WHERE (location) and SUBJECT to a single-event answer when present.
// "פגישה עם אלכסנדרה." → "... בקפה גרג רעננה. בנושא טיול לאיטליה." The production
// gap Leo reported was that calendar reads never surfaced location/subject even
// after they were captured on create.
export function calendarEventExtras(e: Appointment): string {
  let s = ''
  if (e.location) s += ` ${locPhrase(e.location)}.`
  if (e.subject && !/^(?:פגישה|מפגש|מפגשים|אירוע)$/.test(e.subject.trim()) && !(e.title ?? '').includes(e.subject.trim())) s += ` הנושא — ${e.subject}.`
  // The WHY (purpose / notes) when it adds something beyond the bare topic, so a
  // read sounds like an assistant who understood ("הנושא — שכירות. רצית לדבר על
  // ההכנות לפני הדיירים."), not a field dump. notes already holds the synthesized
  // purpose for engine-created events.
  const why = e.notes ?? e.purpose
  if (why && why.trim() !== (e.subject ?? '').trim()) s += ` ${why}.`
  return s
}

export function shapeCalendarAnswer(events: Appointment[], scope: 'today' | 'tomorrow' | 'week' | 'upcoming'): string {
  const scopeWord = scope === 'today' ? 'היום'
    : scope === 'tomorrow' ? 'מחר'
    : ''

  // Empty
  if (events.length === 0) {
    if (scope === 'week') return 'שבוע שקט, אין כלום.'
    if (scope === 'today') return 'היום אין כלום. יום חופשי.'
    if (scope === 'tomorrow') return 'מחר אין כלום. יום שקט.'
    return 'אין כלום בתקופה הזו.'
  }

  // Single event
  if (events.length === 1) {
    const e = events[0]!
    const time = e.time ? `\n${timeInWords(e.time)}.` : ''
    if (e.type === 'birthday') {
      return `${scopeWord} ${e.title}.`
    }
    return `${scopeWord} יש לך ${e.title}.${time}${calendarEventExtras(e)}`
  }

  // Multiple events — time — title format
  const countWord = COUNT_WORDS[events.length] ?? `${events.length}`
  const lines = events.slice(0, 4).map(e => {
    const time = e.time ? `${timeInWords(e.time)} — ` : ''
    return `${time}${e.title}.`
  })

  let answer = `${scopeWord} יש לך ${countWord} דברים:\n${lines.join('\n')}`
  if (events.length > 4) answer += `\nועוד ${events.length - 4}.`
  return answer.trim()
}

// ─── Calendar Read (Spanish) ─────────────────────────────────────────────────

export function shapeCalendarAnswerES(events: Appointment[], scope: 'today' | 'tomorrow' | 'week' | 'upcoming'): string {
  const scopeWord = scope === 'today' ? 'Hoy'
    : scope === 'tomorrow' ? 'Mañana'
    : 'Esta semana'

  if (events.length === 0) {
    return `${scopeWord} no tenés nada en el calendario.`
  }
  if (events.length === 1) {
    const e = events[0]!
    const time = e.time ? ` a las ${e.time}` : ''
    return `${scopeWord} tenés ${e.title}${time}.`
  }
  const lines = events.slice(0, 4).map(e => {
    const time = e.time ? `${e.time} — ` : ''
    return `${time}${e.title}`
  })
  return `${scopeWord} tenés ${events.length} cosas:\n${lines.join('\n')}`
}

// ─── Calendar Create ────────────────────────────────────────────────────────

import type { CreateDraft } from './calendarCreate'

export function dateLabel(date: string): string {
  // LOCAL today/tomorrow (sv-SE = ISO YYYY-MM-DD in local TZ), consistent with
  // the calendar write/read paths — toISOString() would mis-detect "מחר" in the
  // early-morning UTC+offset window.
  const today = new Date().toLocaleDateString('sv-SE')
  const tmrw = new Date(Date.now() + 86400000).toLocaleDateString('sv-SE')
  if (date === today) return 'היום'
  if (date === tmrw) return 'מחר'
  const d = new Date(date)
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
  const dayName = days[d.getDay()] ?? ''
  const day = d.getDate()
  const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
  const monthName = months[d.getMonth()] ?? ''
  return `ביום ${dayName}, ${day} ב${monthName}`
}

function humanTitle(title: string): string {
  if (/^אצל\s/.test(title)) return `להיות ${title}`
  if (/תור\s/.test(title)) return title
  if (/פגישה\s/.test(title)) return title
  if (/ארוחה|ארוחת/.test(title)) return title
  return title
}

// Prepend "ב" only when the location doesn't already carry a preposition, so
// "אצלי בבית"/"בבית"/"בקפה X" stay as-is (no "באצלי בבית") while "הוד השרון" →
// "בהוד השרון".
export function locPhrase(loc: string): string {
  const t = loc.trim()
  return /^(?:ב|ל|מ|אצל)/u.test(t) ? t : `ב${t}`
}

// Content words of a clause, for subject/notes redundancy: strip punctuation, a
// leading definite article (ה) per token, and drop function/purpose words so
// "לדבר על הטיול המשפחתי" and "טיול המשפחתי" reduce to the same {טיול, משפחתי}.
const SUBJECT_STOPWORD = /^(?:על|לדבר|לגבי|בנושא|בעניין|בקשר|את|של|כדי|עם|לגמור|לסגור|להחליט)$/
function coreWords(s: string): string[] {
  return s.replace(/[.,()]/gu, ' ').split(/\s+/u)
    .map((w) => w.replace(/^ה/u, '').trim())
    .filter((w) => w.length > 1 && !SUBJECT_STOPWORD.test(w))
}
// True when the shorter clause's content words are all contained in the longer's —
// i.e. the notes merely restate the subject (or vice-versa).
function saysTheSame(a: string, b: string): boolean {
  const wa = coreWords(a), wb = coreWords(b)
  if (!wa.length || !wb.length) return false
  const [small, big] = wa.length <= wb.length ? [wa, new Set(wb)] : [wb, new Set(wa)]
  return small.every((w) => big.has(w))
}

export function shapeCreateConfirm(draft: CreateDraft): string {
  const what = draft.title ? humanTitle(draft.title) : 'משהו'
  const when = draft.date ? ` ${dateLabel(draft.date)}` : ''
  const time = draft.time ? ` ${timeInWords(draft.time)}` : ''
  let text = `${what}${when}${time}.`
  if (draft.location) text += ` ${locPhrase(draft.location)}.`
  // Skip a redundant "בנושא" when the subject is a generic meeting word or already
  // sits in the title ("פגישה עם אורית" + subject "פגישה" → no "בנושא פגישה").
  const subjectShown = !!draft.subject && !/^(?:פגישה|מפגש|מפגשים|אירוע)$/.test(draft.subject.trim()) && !(draft.title ?? '').includes(draft.subject.trim())
  if (subjectShown) text += ` בנושא ${draft.subject}.`
  // Drop the notes parenthetical when it merely restates the already-shown subject
  // (rambling-story confirm said "בנושא טיול המשפחתי. (לדבר על הטיול המשפחתי)." —
  // one subject, stated twice, blowing brevity). The tidy "בנושא" clause wins.
  if (draft.notes && !(subjectShown && saysTheSame(draft.subject!, draft.notes))) text += ` (${draft.notes}).`
  text += ' נכון?'
  return text
}

// Read-back variant: spoken before voice confirmation. Reads back what / date /
// time / location / reason explicitly, asks "לקבוע?". Missing date/time produce
// a targeted clarification ask (not a normal final confirmation). ambiguousTime
// short-circuits to the AM/PM clarification wording so the read-back never
// silently auto-PMs.
export interface ReadbackDraft {
  title: string | null
  personName?: string | null
  date: string | null
  time: string | null
  location?: string | null
  notes?: string | null
  ambiguousTime?: boolean
}

export function shapeCreateConfirmReadback(draft: ReadbackDraft): string {
  if (draft.ambiguousTime && draft.time) {
    return `לפני שנקבע — ${draft.time} בצהריים או בלילה?`
  }

  const subject = draft.title
    ? humanTitle(draft.title)
    : draft.personName
      ? `פגישה עם ${draft.personName}`
      : 'משהו'

  if (!draft.date) {
    return `הבנתי. לקבוע ${subject}. לא שמעתי תאריך — מתי?`
  }
  if (!draft.time) {
    return `הבנתי. לקבוע ${subject} ${dateLabel(draft.date)}. לא שמעתי שעה — באיזו שעה?`
  }

  let head = `הבנתי. לקבוע ${subject} ${dateLabel(draft.date)} ${timeInWords(draft.time)}`
  if (draft.location) head += ` ${locPhrase(draft.location)}`
  head += '.'
  const parts: string[] = [head]
  if (draft.notes) parts.push(`הסיבה: ${draft.notes}.`)
  parts.push('לקבוע?')
  return parts.join(' ')
}

export function shapeCreateSaved(draft?: { title?: string | null; date?: string | null; time?: string | null }): string {
  if (draft?.title) {
    return `קבוע.`
  }
  return 'רשום.'
}

export function shapeCreateCancelled(): string {
  return 'בסדר, ביטלתי. תגידי לי מתי שתרצי לקבוע משהו.'
}

// ─── Calendar Create (Spanish) ─────────────────────────────────────────────

function dateLabelES(date: string): string {
  const today = new Date().toISOString().split('T')[0]!
  const tmrw = new Date(Date.now() + 86400000).toISOString().split('T')[0]!
  if (date === today) return 'hoy'
  if (date === tmrw) return 'mañana'
  const d = new Date(date)
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const dayName = days[d.getDay()] ?? ''
  const day = d.getDate()
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  const monthName = months[d.getMonth()] ?? ''
  return `el ${dayName} ${day} de ${monthName}`
}

// A create title is synthesized in Hebrew ("פגישה עם Gabi") even for a Spanish create.
// For a first-class Spanish experience, render it in Spanish: "reunión con <who>".
function titleES(title: string | null | undefined, person?: string | null): string {
  if (person && person.trim()) return `una reunión con ${person.trim()}`
  const m = (title ?? '').match(/^פגישה עם\s+(.+)$/u)
  if (m) return `una reunión con ${m[1]!.trim()}`
  // A person-less es create ("anotá una cita el viernes…") leaves a raw-ish Hebrew-path
  // title (often the whole utterance). Prefer the schedulable Spanish noun so the confirm
  // never echoes the raw request ("Te agendo una cita" not "Te agendo anotá una cita…").
  const noun = (title ?? '').match(/(?<![a-záéíóúñ])(cita|reuni[óo]n|turno|evento)(?![a-záéíóúñ])/i)
  if (noun) {
    const n = noun[1]!.toLowerCase()
    // Grammatical gender: cita / reunión are feminine (una); turno / evento masculine (un).
    const article = /^(?:turno|evento)$/.test(n) ? 'un' : 'una'
    return `${article} ${n}`
  }
  return title && title.trim() ? title.trim() : 'algo'
}

export function shapeCreateConfirmES(draft: CreateDraft): string {
  const what = titleES(draft.title, draft.person)
  const when = draft.date ? ` ${dateLabelES(draft.date)}` : ''
  const time = draft.time ? ` a las ${draft.time}` : ''
  return `Te agendo ${what}${when}${time}.\n¿Está bien?`
}

export function shapeCreateSavedES(draft?: { title?: string | null; date?: string | null; time?: string | null; person?: string | null }): string {
  if (draft?.title) {
    const when = draft.date ? ` ${dateLabelES(draft.date)}` : ''
    const time = draft.time ? ` a las ${draft.time}` : ''
    return `Listo, te agendé ${titleES(draft.title, draft.person)}${when}${time}.`
  }
  return 'Listo, quedó agendado.'
}

export function shapeCreateCancelledES(): string {
  return 'Dale, lo cancelé. Decime cuando quieras agendar algo.'
}

export function shapeCreateClarifyES(missing: Array<'title' | 'date' | 'time'>): string {
  const first = missing[0]
  if (first === 'title') return '¿Qué agendo?'
  if (first === 'date') return '¿Qué día?'
  if (first === 'time') return '¿A qué hora?'
  return '¿Qué agendo?'
}

export function shapeCreateUnclear(): string {
  return 'לא הבנתי — את רוצה שאקבע את זה?'
}

export function shapeCreateClarify(
  missing: Array<'title' | 'date' | 'time'>,
  draft?: CreateDraft,
): string {
  const first = missing[0]
  if (first === 'title') return 'מה לרשום?'
  if (first === 'date') {
    // Never the bald phone-tree "באיזה יום?" (banned product-wide). When a person
    // is already captured (an incremental "drip" create), continue the thread like
    // a companion — reference her and ask for the day + time together. This also
    // keeps the wording OFF the CLARIFY_MARKERS list, so a progressing create is
    // not mistaken for a repeated-clarification loop and dead-ended.
    const who = draft?.person?.trim()
    if (who) return `לאיזה יום ושעה לקבוע עם ${who}?`
    return 'לאיזה יום ושעה?'
  }
  if (first === 'time') {
    // Understood the hour but not AM/PM — ask the specific question instead
    // of a generic "באיזו שעה?".
    if (draft?.ambiguousTime && draft.time) {
      const h = Number(draft.time.split(':')[0])
      const displayH = h > 12 ? h - 12 : h
      const word = HOUR_WORDS[displayH] ?? String(displayH)
      return `באיזו שעה בדיוק — ${word} בבוקר או ${word} בערב?`
    }
    return 'באיזו שעה?'
  }
  return 'מה לרשום?'
}

// ─── Fallbacks ──────────────────────────────────────────────────────────────

// B1 patch: language hint. Defaults to 'he' so every existing call site
// keeps the Hebrew behaviour exactly as before. Future call sites can pass
// 'es' / 'en' / 'mixed' once a language detector is wired through tools.
export type ShaperLang = 'he' | 'es' | 'en' | 'mixed'

export function shapeNotFound(context?: string, lang: ShaperLang = 'he'): string {
  switch (lang) {
    case 'es':
      return 'No sé, Martita.'
    case 'en':
      return context ? `I could not find anything about ${context}.` : 'I could not find anything about that.'
    case 'mixed':
      return context ? `לא יודעת על ${context}.` : 'לא יודעת.'
    case 'he':
    default:
      return context ? `לא יודעת על ${context}.` : 'לא יודעת.'
  }
}

export function shapeToolError(lang: ShaperLang = 'he'): string {
  switch (lang) {
    case 'es':
      return 'Algo se trabó. Probá de nuevo en un ratito.'
    case 'en':
      return 'Something got stuck. Try again in a moment.'
    case 'mixed':
    case 'he':
    default:
      return 'רגע, משהו לא עבד. תנסי עוד פעם.'
  }
}

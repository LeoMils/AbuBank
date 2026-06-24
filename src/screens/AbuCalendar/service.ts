import { durable } from '../../services/durableStore'

const STORAGE_KEY = 'abubank-calendar-appointments'

export interface Appointment {
  id: string
  title: string
  date: string   // YYYY-MM-DD
  time: string   // HH:MM
  emoji: string
  color: string
  notes?: string
  location?: string      // v18: venue/address
  subject?: string       // what the meeting is about ("טיול לאיטליה")
  purpose?: string       // WHY — synthesized reason ("לסגור את הסכם השכירות")
  // ─── Understanding-pipeline provenance (calendar intelligence layer) ───
  rawTranscript?: string       // exactly what STT / the user said
  cleanedTranscript?: string   // Hebrew/STT-normalized text we parsed
  confidence?: number          // 0..1 — parse completeness/certainty at save
  // Family Intelligence
  type?: 'regular' | 'birthday' | 'anniversary' | 'memory'
  personName?: string    // for birthdays: the person's name
  birthYear?: number     // for age calculation
  isRecurring?: boolean  // birthdays/anniversaries repeat every year
}

export const APPT_COLORS = [
  '#FF6B9D',
  '#4ECDC4',
  '#FFE66D',
  '#A78BFA',
  '#FB923C',
  '#34D399',
  '#60A5FA',
  '#F472B6',
]

let colorIndex = 0

export function loadAppointments(): Appointment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as Appointment[]
    return []
  } catch {
    return []
  }
}

export function saveAppointments(appts: Appointment[]): void {
  try {
    // Durable write-through: localStorage mirror (sync, read by loadAppointments)
    // + IndexedDB (durable, restored to the mirror on next app start).
    durable.setString(STORAGE_KEY, JSON.stringify(appts))
  } catch {
    // ignore storage errors
  }
}

export function addAppointment(appt: Omit<Appointment, 'id' | 'color'>): Appointment {
  const appts = loadAppointments()
  const color = APPT_COLORS[colorIndex % APPT_COLORS.length] ?? APPT_COLORS[0]!
  colorIndex++
  const newAppt: Appointment = {
    ...appt,
    id: `appt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    color,
  }
  saveAppointments([...appts, newAppt])
  return newAppt
}

// ─── P0 — createAppointmentSafe ───────────────────────────────────────────
//
// Single safe creation path used by ManualModal AND the voice-confirm flow.
// Validates required fields, attempts persistence, and ROUND-TRIPS through
// storage to confirm the event is actually there. Returns a structured
// result so the UI can show the correct success / failure / clarification
// message — never a false "saved" toast.

export type CreateFailureCode =
  | 'missing_title' | 'missing_date' | 'missing_time'
  | 'invalid_date' | 'invalid_time'
  | 'storage_failed'

export type CreateResult =
  | { ok: true; appointment: Appointment }
  | { ok: false; code: CreateFailureCode }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/

export function createAppointmentSafe(input: Omit<Appointment, 'id' | 'color'>): CreateResult {
  // 1) Required-field validation — no silent acceptance.
  if (!input.title || !input.title.trim()) return { ok: false, code: 'missing_title' }
  if (!input.date || !input.date.trim()) return { ok: false, code: 'missing_date' }
  if (!input.time || !input.time.trim()) return { ok: false, code: 'missing_time' }

  // 2) Format validation.
  if (!DATE_RE.test(input.date)) return { ok: false, code: 'invalid_date' }
  if (!TIME_RE.test(input.time)) return { ok: false, code: 'invalid_time' }
  // Cross-check: date must be parseable.
  const [y, m, d] = input.date.split('-').map(Number)
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return { ok: false, code: 'invalid_date' }
  const [hh, mm] = input.time.split(':').map(Number)
  if (hh === undefined || mm === undefined || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return { ok: false, code: 'invalid_time' }
  }

  // 3) Attempt persistence. addAppointment + saveAppointments together
  //    will swallow storage errors (private-mode / quota), so we catch
  //    throws from setItem AND we read back to verify presence.
  let created: Appointment
  try {
    created = addAppointment(input)
  } catch {
    return { ok: false, code: 'storage_failed' }
  }

  // 4) Round-trip verification — defends against silent no-op storage.
  const persisted = loadAppointments().find((a) => a.id === created.id)
  if (!persisted) return { ok: false, code: 'storage_failed' }

  return { ok: true, appointment: created }
}

// ─── P0 — user-facing copy helpers (HE/ES/EN) ─────────────────────────────

export type ConfirmationLang = 'he' | 'es' | 'en'

export function formatCreatedConfirmation(
  appt: { title: string; date: string; time: string },
  lang: ConfirmationLang,
): string {
  if (lang === 'es') return `Listo, lo agendé: ${appt.title}, ${appt.date}, a las ${appt.time}.`
  if (lang === 'en') return `Done, I added: ${appt.title}, ${appt.date}, at ${appt.time}.`
  return `קבעתי: ${appt.title}, ${appt.date}, בשעה ${appt.time}.`
}

export function formatCreateFailure(code: CreateFailureCode, lang: ConfirmationLang): string {
  if (code === 'storage_failed') {
    if (lang === 'es') return 'No pude guardarlo ahora. ¿Probamos otra vez?'
    if (lang === 'en') return "I couldn't save it right now. Want to try again?"
    return 'לא הצלחתי לשמור את הפגישה כרגע. ננסה שוב?'
  }
  if (code === 'missing_title' || code === 'missing_date' || code === 'missing_time' ||
      code === 'invalid_date' || code === 'invalid_time') {
    if (lang === 'es') return 'Me falta un dato. ¿Me lo decís otra vez?'
    if (lang === 'en') return "I'm missing something. Can you say that again?"
    return 'חסר לי פרט. תוכלי לחזור על זה?'
  }
  // exhaustive
  const _exhaust: never = code
  void _exhaust
  return ''
}

export function formatMissingFieldQuestion(
  field: 'title' | 'date' | 'time',
  lang: ConfirmationLang,
): string {
  if (lang === 'es') {
    if (field === 'time') return '¿A qué hora querés que la agende?'
    if (field === 'date') return '¿Para qué día?'
    return '¿Qué nombre le ponemos a la cita?'
  }
  if (lang === 'en') {
    if (field === 'time') return 'What time should I set?'
    if (field === 'date') return 'What day?'
    return 'What should I call this meeting?'
  }
  if (field === 'time') return 'באיזו שעה לקבוע את הפגישה?'
  if (field === 'date') return 'מתי לקבוע את הפגישה?'
  return 'מה השם של הפגישה?'
}

export function findConflicts(date: string, time: string | null): Appointment[] {
  if (!time) return []
  const appts = loadAppointments()
  return appts.filter(a => {
    if (a.date !== date || !a.time) return false
    // Check if times overlap (within 1 hour)
    const [h1] = time.split(':').map(Number)
    const [h2] = a.time.split(':').map(Number)
    return Math.abs((h1 ?? 0) - (h2 ?? 0)) < 1
  })
}

export function updateAppointment(id: string, updates: Partial<Omit<Appointment, 'id'>>): void {
  const appts = loadAppointments()
  saveAppointments(appts.map(a => a.id === id ? { ...a, ...updates } : a))
}

export function deleteAppointment(id: string): void {
  const appts = loadAppointments()
  saveAppointments(appts.filter(a => a.id !== id))
}

export function detectEmoji(title: string): string {
  const t = title.toLowerCase()
  if (/תופרת|תפירה|מכנסיים|חולצ|בגד|חוט|תיקון בגדים/.test(t)) return '🧵'
  if (/רופא|doctor|clinic|קופת חולים|בית חולים|hospital|כירורג|surgeon/.test(t)) return '🏥'
  if (/תספורת|מספרה|שיער|hair|coiffure/.test(t)) return '✂️'
  if (/תרופה|תרופות|pill|pills|meds|medication|pharmacy|בית מרקחת/.test(t)) return '💊'
  if (/קניות|supermarket|שופרסל|רמי לוי|מכולת|shopping|grocery/.test(t)) return '🛒'
  if (/יום הולדת|birthday|חגיגה/.test(t)) return '🎂'
  if (/אוכל|מסעדה|food|dinner|lunch|breakfast|ארוחה/.test(t)) return '🍽️'
  if (/טיסה|נסיעה|travel|trip|flight|airplane|חופשה|vacation/.test(t)) return '✈️'
  if (/משפחה|family|ילדים|נכדים|בן|בת|אחות|אח/.test(t)) return '👨‍👩‍👧'
  return '📌'
}

export function playChime(): void {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const notes = [261.63, 329.63, 392.0, 523.25] // C4 E4 G4 C5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.18
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.28, t + 0.05)
      gain.gain.linearRampToValueAtTime(0, t + 0.30)
      osc.start(t)
      osc.stop(t + 0.35)
    })
  } catch {
    // audio not available — ignore
  }
}

function detectFamilyType(text: string): Pick<Appointment, 'type' | 'isRecurring'> {
  if (/יום הולדת/i.test(text)) return { type: 'birthday', isRecurring: true }
  if (/יום נישואין|יום נישואים/i.test(text)) return { type: 'anniversary', isRecurring: true }
  return {}
}

export async function parseAppointmentText(text: string): Promise<{ title: string; date: string | null; time: string | null; emoji: string; confidence: number; personName: string | null; location: string | null; notes: string | null; ambiguousTime: boolean; source: 'local' | 'llm' | 'fallback' } & Pick<Appointment, 'type' | 'isRecurring'>> {
  const today = new Date().toISOString().split('T')[0]!
  const { parseLocally } = await import('./localParser')
  const local = parseLocally(text, today)
  const groqKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined

  if (groqKey) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10_000)
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: `You are an expert Hebrew appointment parser. Extract appointment details from spoken Hebrew text.
Today is ${today} (${new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}).
Current month: ${new Date().getMonth() + 1}, current year: ${new Date().getFullYear()}.

CRITICAL: The "date" field MUST be a real YYYY-MM-DD date. NEVER return words like "TOMORROW" or "FRIDAY". ALWAYS compute the actual calendar date.
CRITICAL: If the user did NOT explicitly mention a time, return "time": null.
CRITICAL: If the user did NOT explicitly mention a date, return "date": null.

RULES:
- TIME: All times without "בבוקר" default to PM for appointments.
  "בשלוש" = 15:00. "בארבע" = 16:00. "בחמש" = 17:00. "בשש" = 18:00. "בשבע" = 19:00. "בשמונה" = 20:00.
  "בעשר בבוקר" = 10:00. "בשמונה בערב" = 20:00. "בשתיים וחצי" = 14:30. "בתשע בבוקר" = 09:00.
  "בצהריים" = 12:00. "אחרי הצהריים" = prefer 14:00-17:00 range.
  If no time is mentioned at all, return "time": null.
- DATE: ALWAYS return YYYY-MM-DD format when a date IS mentioned. Compute the real date:
  - "מחר" = ${new Date(Date.now() + 86400000).toISOString().split('T')[0]}
  - "ביום ראשון" = the NEXT Sunday from today. Calculate it.
  - "ב-15 לחודש" = ${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-15
  - "בעוד שבוע" = +7 days from today.
  If no date is mentioned at all, return "date": null.
- PERSON: "פגישה עם דר כהן" → personName: "דר כהן".
- LOCATION: "בקניון" → location: "קניון".
- EMOJI: 🏥 medical, ✂️ haircut, 🛒 shopping, 🎂 birthday, 🍽️ food, ✈️ travel, 👨‍👩‍👧 family, 💼 work, 📅 general.

Return ONLY valid JSON:
{"title":"short Hebrew title","date":"YYYY-MM-DD or null","time":"HH:MM or null","emoji":"...","location":"","personName":"","confidence":0.0-1.0}
confidence: 1.0 = all fields explicitly stated. 0.7 = some inferred. 0.3 = very ambiguous.`,
            },
            { role: 'user', content: text },
          ],
          temperature: 0,
          max_tokens: 200,
        }),
      })
      clearTimeout(timeout)
      if (res.ok) {
        const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
        const content = data?.choices?.[0]?.message?.content ?? ''
        const match = content.match(/\{[\s\S]*?\}/)
        if (match) {
          const parsed = JSON.parse(match[0]) as { title?: string; date?: string | null; time?: string | null; emoji?: string; location?: string; personName?: string; confidence?: number }
          // Local extractions (time/location/notes/ambiguity) take precedence over the LLM,
          // which is prone to silently changing exact numerics like "2:34" → "8:00".
          const title = local.title || parsed.title || text
          const date = local.date ?? ((parsed.date && parsed.date !== 'null') ? parsed.date : null)
          const time = local.time ?? ((parsed.time && parsed.time !== 'null') ? parsed.time : null)
          const location = local.location ?? (parsed.location || null)
          const notes = local.notes
          const emoji = (local.location || local.notes ? detectEmoji(`${title} ${notes ?? ''}`) : (parsed.emoji ?? detectEmoji(title)))
          const llmConfidence = typeof parsed.confidence === 'number' ? parsed.confidence : (date && time ? 0.9 : date || time ? 0.6 : 0.3)
          const confidence = Math.max(local.confidence, llmConfidence)
          const personName = parsed.personName || null
          const familyType = detectFamilyType(text)
          return { title, date, time, emoji, confidence, personName, location, notes, ambiguousTime: local.ambiguousTime, source: 'llm', ...familyType }
        }
      }
    } catch {
      // fall through to fallback (timeout, network error, or parse error)
    }
  }

  return {
    title: local.title || text,
    date: local.date,
    time: local.time,
    emoji: local.emoji,
    confidence: local.confidence,
    personName: null,
    location: local.location,
    notes: local.notes,
    ambiguousTime: local.ambiguousTime,
    source: groqKey ? 'fallback' : 'local',
    ...detectFamilyType(text),
  }
}

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

const HEBREW_DAYS = [
  'יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי',
  'יום חמישי', 'יום שישי', 'שבת',
]

export function formatHebrewDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  const date = new Date(y, m - 1, d)
  const dayName = HEBREW_DAYS[date.getDay()] ?? ''
  const monthName = HEBREW_MONTHS[m - 1] ?? ''
  return `${d} ב${monthName} ${y}, ${dayName}`
}

export function formatHebrewMonth(year: number, month: number): string {
  const monthName = HEBREW_MONTHS[month - 1] ?? ''
  return `${monthName} ${year}`
}

// ─── Family Birthdays & Memorial ───
// Source of truth: knowledge/family_data.json (see ./familyEvents). Re-exported
// here under the same names that the calendar screen and AbuAI tools.ts consume.
export { FAMILY_BIRTHDAYS, FAMILY_MEMORIALS } from './familyEvents'
import { FAMILY_BIRTHDAYS, FAMILY_MEMORIALS } from './familyEvents'

/** Load appointments + merge permanent family birthdays & memorials for a specific year */
export function loadAppointmentsWithFamily(viewYear?: number): Appointment[] {
  const yr = viewYear ?? new Date().getFullYear()
  const userAppts = loadAppointments()

  // Generate family birthdays for the viewed year (recurring = every year)
  const yearBirthdays = FAMILY_BIRTHDAYS.map(b => ({
    ...b,
    date: `${yr}-${b.date.slice(5)}`, // Replace year with viewed year
    id: `${b.id}-${yr}`,
  }))
  const yearMemorials = FAMILY_MEMORIALS.map(m => ({
    ...m,
    date: `${yr}-${m.date.slice(5)}`,
    id: `${m.id}-${yr}`,
  }))

  // Don't duplicate with user-created appointments
  const familyIds = new Set([...yearBirthdays, ...yearMemorials].map(a => a.id))
  const filtered = userAppts.filter(a => !familyIds.has(a.id))
  return [...yearBirthdays, ...yearMemorials, ...filtered]
}

// v22: Short Hebrew date for selected day header
export function formatShortHebrewDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  const date = new Date(y, m - 1, d)
  const dayName = HEBREW_DAYS[date.getDay()] ?? ''
  const monthName = HEBREW_MONTHS[m - 1] ?? ''
  return `${dayName}, ${d} ב${monthName}`
}

// ─── Hebrew Holidays (major, 2024-2027) ─────────────────────────────────────

const HEBREW_HOLIDAYS: Record<string, string> = {
  // 2025
  '2025-10-03': 'ראש השנה', '2025-10-04': 'ראש השנה',
  '2025-10-12': 'יום כיפור',
  '2025-10-17': 'סוכות', '2025-10-24': 'שמחת תורה',
  '2025-12-15': 'חנוכה', '2025-12-16': 'חנוכה', '2025-12-17': 'חנוכה',
  '2025-12-18': 'חנוכה', '2025-12-19': 'חנוכה', '2025-12-20': 'חנוכה',
  '2025-12-21': 'חנוכה', '2025-12-22': 'חנוכה',
  '2025-03-14': 'פורים',
  '2025-04-13': 'פסח', '2025-04-14': 'פסח', '2025-04-19': 'פסח', '2025-04-20': 'פסח',
  '2025-06-02': 'שבועות', '2025-06-03': 'שבועות',
  // 2026
  '2026-09-22': 'ראש השנה', '2026-09-23': 'ראש השנה',
  '2026-10-01': 'יום כיפור',
  '2026-10-06': 'סוכות', '2026-10-13': 'שמחת תורה',
  '2026-12-05': 'חנוכה', '2026-12-06': 'חנוכה', '2026-12-07': 'חנוכה',
  '2026-12-08': 'חנוכה', '2026-12-09': 'חנוכה', '2026-12-10': 'חנוכה',
  '2026-12-11': 'חנוכה', '2026-12-12': 'חנוכה',
  '2026-03-03': 'פורים',
  '2026-04-02': 'פסח', '2026-04-03': 'פסח', '2026-04-08': 'פסח', '2026-04-09': 'פסח',
  '2026-05-22': 'שבועות', '2026-05-23': 'שבועות',
  // 2027
  '2027-09-11': 'ראש השנה', '2027-09-12': 'ראש השנה',
  '2027-09-20': 'יום כיפור',
  '2027-09-25': 'סוכות', '2027-10-02': 'שמחת תורה',
  '2027-11-24': 'חנוכה', '2027-11-25': 'חנוכה', '2027-11-26': 'חנוכה',
  '2027-11-27': 'חנוכה', '2027-11-28': 'חנוכה', '2027-11-29': 'חנוכה',
  '2027-11-30': 'חנוכה', '2027-12-01': 'חנוכה',
  '2027-02-22': 'פורים',
  '2027-03-22': 'פסח', '2027-03-23': 'פסח', '2027-03-28': 'פסח', '2027-03-29': 'פסח',
  '2027-05-12': 'שבועות', '2027-05-13': 'שבועות',
}

export function getHebrewHoliday(dateStr: string): string | null {
  return HEBREW_HOLIDAYS[dateStr] ?? null
}


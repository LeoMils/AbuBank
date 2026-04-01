const STORAGE_KEY = 'abubank-calendar-appointments'

export interface Appointment {
  id: string
  title: string
  date: string   // YYYY-MM-DD
  time: string   // HH:MM
  emoji: string
  color: string
  notes?: string
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appts))
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

export function deleteAppointment(id: string): void {
  const appts = loadAppointments()
  saveAppointments(appts.filter(a => a.id !== id))
}

export function detectEmoji(title: string): string {
  const t = title.toLowerCase()
  if (/רופא|doctor|clinic|קופת חולים|בית חולים|hospital|כירורג|surgeon/.test(t)) return '🏥'
  if (/תספורת|מספרה|שיער|hair|coiffure/.test(t)) return '✂️'
  if (/תרופה|תרופות|pill|pills|meds|medication|pharmacy|בית מרקחת/.test(t)) return '💊'
  if (/קניות|supermarket|שופרסל|רמי לוי|מכולת|shopping|grocery/.test(t)) return '🛒'
  if (/יום הולדת|birthday|חגיגה/.test(t)) return '🎂'
  if (/אוכל|מסעדה|food|dinner|lunch|breakfast|ארוחה/.test(t)) return '🍽️'
  if (/טיסה|נסיעה|travel|trip|flight|airplane|חופשה|vacation/.test(t)) return '✈️'
  if (/משפחה|family|ילדים|נכדים|בן|בת|אחות|אח/.test(t)) return '👨‍👩‍👧'
  return '📅'
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

export async function parseAppointmentText(text: string): Promise<{ title: string; date: string; time: string; emoji: string }> {
  const today = new Date().toISOString().split('T')[0]!
  const groqKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined

  if (groqKey) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: `Parse Hebrew appointment text. Today is ${today}. Return ONLY valid JSON: {"title":"...","date":"YYYY-MM-DD","time":"HH:MM","emoji":"..."}`,
            },
            { role: 'user', content: text },
          ],
          temperature: 0,
          max_tokens: 150,
        }),
      })
      if (res.ok) {
        const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
        const content = data?.choices?.[0]?.message?.content ?? ''
        const match = content.match(/\{[\s\S]*?\}/)
        if (match) {
          const parsed = JSON.parse(match[0]) as { title?: string; date?: string; time?: string; emoji?: string }
          const title = parsed.title ?? text
          const date = parsed.date ?? today
          const time = parsed.time ?? '09:00'
          const emoji = parsed.emoji ?? detectEmoji(title)
          return { title, date, time, emoji }
        }
      }
    } catch {
      // fall through to fallback
    }
  }

  // Graceful fallback: use the raw text as title
  return {
    title: text,
    date: today,
    time: '09:00',
    emoji: detectEmoji(text),
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

import { type Appointment } from './service'

export type EventMeaning = 'medical' | 'social' | 'administrative' | 'optional'
export type EventPriority = 'critical' | 'high' | 'normal' | 'low'
type TimeOfDay = 'morning' | 'midday' | 'evening'

export function classifyMeaning(appt: Appointment): EventMeaning {
  const t = (appt.title + ' ' + (appt.notes || '')).toLowerCase()
  if (/רופא|doctor|בדיקה|ניתוח|בית חולים|hospital|קופת חולים|אולטרסאונד|דם|רנטגן|ct|mri|תרופ|pill|medication|pharmacy|מרקחת/.test(t)) return 'medical'
  if (/פגישה|meeting|יום הולדת|birthday|ארוח|אוכל|dinner|משפחה|family|חברה|חבר/.test(t)) return 'social'
  if (/עורך דין|lawyer|חשבונאי|ביטוח|בנק|bank|תשלום|חשבון|דואר|ביטוח לאומי/.test(t)) return 'administrative'
  if (/תספורת|קניות|shopping|grocery|ניקיון/.test(t)) return 'optional'
  return 'optional'
}

export function classifyPriority(appt: Appointment): EventPriority {
  const meaning = classifyMeaning(appt)
  if (meaning === 'medical') return 'critical'
  if (meaning === 'social' || meaning === 'administrative') return 'high'
  return 'normal'
}

const PRIORITY_ORDER: Record<EventPriority, number> = { critical: 0, high: 1, normal: 2, low: 3 }

export function sortByPriority(appts: Appointment[]): Appointment[] {
  return [...appts].sort((a, b) => {
    const pa = PRIORITY_ORDER[classifyPriority(a)]
    const pb = PRIORITY_ORDER[classifyPriority(b)]
    if (pa !== pb) return pa - pb
    return a.time.localeCompare(b.time)
  })
}

function formatTime12(time: string): string {
  const [h, m] = time.split(':').map(Number)
  if (h === undefined || m === undefined) return time
  if (h === 0) return `12:${String(m).padStart(2, '0')} בלילה`
  if (h < 12) return `${h}:${String(m).padStart(2, '0')} בבוקר`
  if (h === 12) return `12:${String(m).padStart(2, '0')} בצהריים`
  return `${h - 12}:${String(m).padStart(2, '0')} אחה״צ`
}

function relativeDay(dateStr: string, today: string): string {
  const d = new Date(dateStr)
  const t = new Date(today)
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000)
  if (diff === 0) return 'היום'
  if (diff === 1) return 'מחר'
  if (diff === 2) return 'מחרתיים'
  if (diff > 2 && diff <= 6) {
    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
    return `ביום ${days[d.getDay()] ?? ''}`
  }
  if (diff > 6 && diff <= 14) return `בעוד ${diff} ימים`
  return `ב-${dateStr.split('-').reverse().join('/')}`
}

function getTimeOfDay(now: Date): TimeOfDay {
  const h = now.getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'midday'
  return 'evening'
}

function hoursUntil(eventDate: string, eventTime: string, now: Date): number | null {
  if (!eventTime) return null
  const dt = new Date(`${eventDate}T${eventTime}:00`)
  if (isNaN(dt.getTime())) return null
  return (dt.getTime() - now.getTime()) / (1000 * 60 * 60)
}

export function getPreEventHint(appt: Appointment, now: Date): string | null {
  const hours = hoursUntil(appt.date, appt.time, now)
  if (hours === null || hours < 0 || hours > 3) return null

  const meaning = classifyMeaning(appt)
  const minutesLeft = Math.round(hours * 60)

  if (hours <= 0.5) {
    return meaning === 'medical' ? `${appt.title} עוד חצי שעה!` : null
  }

  if (meaning === 'medical') {
    if (minutesLeft <= 90) return `יש לך ${appt.title} בעוד ${minutesLeft} דקות. כדאי להתכונן.`
    return `יש לך ${appt.title} בעוד כשעתיים. כדאי להתכונן.`
  }

  if (meaning === 'social') {
    if (minutesLeft <= 120) return `${appt.title} מתקרב — בעוד ${minutesLeft} דקות.`
    return null
  }

  if (meaning === 'administrative' && minutesLeft <= 120) {
    return `${appt.title} בעוד ${minutesLeft} דקות. לא לשכוח.`
  }

  return null
}

export function getSuggestion(appt: Appointment): string | null {
  const meaning = classifyMeaning(appt)
  if (meaning === 'medical') return 'רוצה להכין מה לשאול?'
  if (meaning === 'social' && /יום הולדת|birthday/.test(appt.title.toLowerCase())) return 'רוצה להכין ברכה?'
  if (meaning === 'administrative') return 'רוצה שאזכיר לך לפני?'
  return null
}

export function shouldSpeak(appts: Appointment[], dateStr: string, today: string): boolean {
  if (dateStr !== today) return true
  if (appts.length === 0) return false
  return appts.some(a => classifyPriority(a) === 'critical' || classifyPriority(a) === 'high')
}

export function narrateDay(appts: Appointment[], dateStr: string, today: string, now?: Date): string {
  if (appts.length === 0) {
    const rel = relativeDay(dateStr, today)
    return rel === 'היום' ? 'אין לך כלום היום. יום חופשי!' : `אין לך כלום ${rel}.`
  }

  const sorted = sortByPriority(appts)
  const rel = relativeDay(dateStr, today)
  const currentTime = now ?? new Date()
  const tod = getTimeOfDay(currentTime)
  const lines: string[] = []

  if (dateStr === today && tod === 'evening') {
    const remaining = sorted.filter(a => {
      const h = hoursUntil(a.date, a.time, currentTime)
      return h === null || h > 0
    })
    if (remaining.length === 0) {
      lines.push('סיימת את כל מה שהיה לך היום. ערב טוב!')
      return lines.join('\n')
    }
    lines.push(`נשאר לך עוד ${remaining.length === 1 ? 'דבר אחד' : `${remaining.length} דברים`} הערב.`)
    const a = remaining[0]!
    const timeStr = a.time ? ` ב-${formatTime12(a.time)}` : ''
    lines.push(`${a.title}${timeStr}.`)
  } else if (sorted.length === 1) {
    const a = sorted[0]!
    const priority = classifyPriority(a)
    const timeStr = a.time ? ` ב-${formatTime12(a.time)}` : ''
    if (priority === 'critical') {
      lines.push(`${rel} יש לך ${a.title}${timeStr}. חשוב!`)
    } else {
      lines.push(`${rel} יש לך ${a.title}${timeStr}.`)
    }
  } else {
    const first = sorted[0]!
    const firstPriority = classifyPriority(first)
    const firstTime = first.time ? ` ב-${formatTime12(first.time)}` : ''

    if (firstPriority === 'critical') {
      lines.push(`הדבר הכי חשוב ${rel}: ${first.title}${firstTime}.`)
    } else if (tod === 'midday' && dateStr === today) {
      lines.push(`עוד ${sorted.length} דברים היום.`)
      lines.push(`הבא: ${first.title}${firstTime}.`)
    } else {
      lines.push(`${rel} יש לך ${sorted.length} דברים.`)
      lines.push(`קודם כל: ${first.title}${firstTime}.`)
    }

    for (let i = 1; i < Math.min(sorted.length, 3); i++) {
      const a = sorted[i]!
      const timeStr = a.time ? ` ב-${formatTime12(a.time)}` : ''
      lines.push(`אחר כך: ${a.title}${timeStr}.`)
    }

    if (sorted.length > 3) {
      lines.push(`ועוד ${sorted.length - 3} דברים.`)
    }
  }

  if (dateStr === today) {
    const hint = getPreEventHint(sorted[0]!, currentTime)
    if (hint) lines.push(hint)
  }

  return lines.join('\n')
}

export function narrateRange(allAppts: Appointment[], today: string, days: number): string {
  const todayDate = new Date(today)
  const lines: string[] = []
  let hasContent = false

  for (let i = 0; i < days; i++) {
    const d = new Date(todayDate)
    d.setDate(d.getDate() + i)
    const ds = d.toISOString().split('T')[0]!
    const dayAppts = allAppts.filter(a => a.date === ds)
    if (dayAppts.length > 0) {
      hasContent = true
      lines.push(narrateDay(dayAppts, ds, today))
    }
  }

  if (!hasContent) {
    return days <= 1 ? 'אין לך כלום היום.' : `אין לך כלום ב-${days} הימים הקרובים.`
  }

  return lines.join('\n')
}

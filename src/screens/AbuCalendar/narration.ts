import { type Appointment } from './service'

export type EventPriority = 'critical' | 'high' | 'normal' | 'low'

export function classifyPriority(appt: Appointment): EventPriority {
  const t = (appt.title + ' ' + (appt.notes || '')).toLowerCase()
  if (/רופא|doctor|בדיקה|ניתוח|בית חולים|hospital|קופת חולים|אולטרסאונד|דם|רנטגן|ct|mri/.test(t)) return 'critical'
  if (/תרופ|pill|medication|pharmacy|מרקחת/.test(t)) return 'high'
  if (/פגישה|meeting|עורך דין|lawyer|חשבונאי|ביטוח|בנק/.test(t)) return 'high'
  if (/יום הולדת|birthday/.test(t)) return 'high'
  if (/תספורת|קניות|shopping|grocery/.test(t)) return 'normal'
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

export function narrateDay(appts: Appointment[], dateStr: string, today: string): string {
  if (appts.length === 0) {
    const rel = relativeDay(dateStr, today)
    return rel === 'היום' ? 'אין לך כלום היום. יום חופשי!' : `אין לך כלום ${rel}.`
  }

  const sorted = sortByPriority(appts)
  const rel = relativeDay(dateStr, today)
  const lines: string[] = []

  if (sorted.length === 1) {
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

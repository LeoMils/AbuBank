import { getHebrewHoliday } from '../AbuCalendar/service'

const HEBREW_MONTHS: Record<string, number> = {
  'ינואר': 1, 'פברואר': 2, 'מרץ': 3, 'אפריל': 4,
  'מאי': 5, 'יוני': 6, 'יולי': 7, 'אוגוסט': 8,
  'ספטמבר': 9, 'אוקטובר': 10, 'נובמבר': 11, 'דצמבר': 12,
}

const HEBREW_NUMBERS: Record<string, number> = {
  'אחד': 1, 'אחת': 1, 'ראשון': 1, 'שניים': 2, 'שתיים': 2, 'שני': 2,
  'שלושה': 3, 'שלוש': 3, 'שלישי': 3, 'ארבעה': 4, 'ארבע': 4, 'רביעי': 4,
  'חמישה': 5, 'חמש': 5, 'חמישי': 5, 'שישה': 6, 'שש': 6, 'שישי': 6,
  'שבעה': 7, 'שבע': 7, 'שביעי': 7, 'שמונה': 8, 'שמיני': 8,
  'תשעה': 9, 'תשע': 9, 'תשיעי': 9, 'עשרה': 10, 'עשר': 10, 'עשירי': 10,
  'אחד עשר': 11, 'שנים עשר': 12, 'שניים עשר': 12, 'שלושה עשר': 13,
  'ארבעה עשר': 14, 'חמישה עשר': 15, 'שישה עשר': 16, 'שבעה עשר': 17,
  'שמונה עשר': 18, 'תשעה עשר': 19, 'עשרים': 20,
  'עשרים ואחד': 21, 'עשרים ושניים': 22, 'עשרים ושלושה': 23,
  'עשרים וארבעה': 24, 'עשרים וחמישה': 25, 'עשרים ושישה': 26,
  'עשרים ושבעה': 27, 'עשרים ושמונה': 28, 'עשרים ותשעה': 29,
  'שלושים': 30, 'שלושים ואחד': 31,
}

const HOLIDAY_NAMES: Record<string, string> = {
  'פסח': 'פסח',
  'חנוכה': 'חנוכה',
  'פורים': 'פורים',
  'סוכות': 'סוכות',
  'שבועות': 'שבועות',
  'ראש השנה': 'ראש השנה',
  'יום כיפור': 'יום כיפור',
  'שמחת תורה': 'שמחת תורה',
}

function todayDate(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse a Hebrew date expression into YYYY-MM-DD, or null if unparseable. */
export function parseHebrewDate(text: string): string | null {
  const t = text.trim()

  // Relative: אתמול
  if (/אתמול/.test(t)) {
    const d = todayDate()
    d.setDate(d.getDate() - 1)
    return formatDate(d)
  }

  // Relative: שלשום
  if (/שלשום/.test(t)) {
    const d = todayDate()
    d.setDate(d.getDate() - 2)
    return formatDate(d)
  }

  // Holiday: בפסח, בחנוכה, etc.
  for (const [keyword, holidayName] of Object.entries(HOLIDAY_NAMES)) {
    if (t.includes(keyword)) {
      return resolveHolidayDate(holidayName)
    }
  }

  // Numeric date: ב-15 באפריל / ב-15 למאי / ב-3 באוגוסט
  const numericMatch = t.match(/ב[־-]?(\d{1,2})\s*[בל]([\u0590-\u05FF]+)/)
  if (numericMatch) {
    const day = parseInt(numericMatch[1]!, 10)
    const monthName = numericMatch[2]!
    const month = HEBREW_MONTHS[monthName]
    if (month && day >= 1 && day <= 31) {
      return `${todayDate().getFullYear()}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }

  // Hebrew word date: באחד באפריל / בשלושה במאי
  // Try compound numbers first (עשרים ואחד), then single words
  for (const [word, num] of Object.entries(HEBREW_NUMBERS).sort((a, b) => b[0].length - a[0].length)) {
    const pattern = new RegExp(`ב${word}\\s+[בל]([\\u0590-\\u05FF]+)`)
    const match = t.match(pattern)
    if (match) {
      const monthName = match[1]!
      const month = HEBREW_MONTHS[monthName]
      if (month && num >= 1 && num <= 31) {
        return `${todayDate().getFullYear()}-${String(month).padStart(2, '0')}-${String(num).padStart(2, '0')}`
      }
    }
  }

  return null
}

/** Parse a Hebrew month name from text, return month number 1-12 or null. */
export function parseHebrewMonth(text: string): number | null {
  const t = text.trim()
  for (const [name, num] of Object.entries(HEBREW_MONTHS)) {
    if (t.includes(name)) return num
  }
  return null
}

/** Find the first date of a holiday in the current or next year. */
function resolveHolidayDate(holidayName: string): string | null {
  const today = todayDate()
  const currentYear = today.getFullYear()

  // Search current year first, then next year
  for (const year of [currentYear, currentYear + 1]) {
    for (let month = 1; month <= 12; month++) {
      for (let day = 1; day <= 31; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const holiday = getHebrewHoliday(dateStr)
        if (holiday === holidayName) return dateStr
      }
    }
  }
  return null
}

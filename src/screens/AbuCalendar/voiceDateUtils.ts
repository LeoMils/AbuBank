const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

export function formatHebrewDateSlot(dateStr: string | null, todayStr: string): string {
  if (!dateStr) return 'חסר'
  const [yStr, mStr, dStr] = dateStr.split('-')
  const y = Number(yStr); const m = Number(mStr); const d = Number(dStr)
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return 'חסר'
  if (dateStr === todayStr) return 'היום'
  const target = new Date(y, m - 1, d)
  const [tyStr, tmStr, tdStr] = todayStr.split('-')
  const today = new Date(Number(tyStr), Number(tmStr) - 1, Number(tdStr))
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diff === 1) return 'מחר'
  if (diff === 2) return 'מחרתיים'
  return `${d} ב${HEBREW_MONTHS[m - 1] ?? ''} ${y}`
}

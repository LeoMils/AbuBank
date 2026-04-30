export const UPDATE_ACKS: readonly string[] = [
  'אה, הבנתי —',
  'סבבה —',
  'רגע, מתקנת —',
  'אוקיי —',
  'הבנתי —',
]

export const CANCEL_RESPONSE = 'אוקיי, לא שומרת.'

export const UNRELATED_RESPONSE = 'לא בטוחה שהבנתי —\nאפשר להגיד לי שוב?'

export const CLARIFY_FALLBACK = 'מה לא נכון? הזמן? המקום?'

export function pickClarifyQuestion(draft: { title?: string; date?: string | null; time?: string | null; location?: string | null }): string {
  const slots: string[] = []
  if (draft.time) slots.push('הזמן')
  if (draft.location) slots.push('המקום')
  if (draft.title) slots.push('המה')
  if (draft.date) slots.push('היום')
  if (slots.length >= 2) {
    const [a, b] = slots
    return `מה לא נכון? ${a}? ${b}?`
  }
  return CLARIFY_FALLBACK
}

export function pickUpdateAck(opts: { avoid?: string | null; rand?: () => number } = {}): string {
  const rand = opts.rand ?? Math.random
  const pool = opts.avoid
    ? UPDATE_ACKS.filter(a => a !== opts.avoid)
    : UPDATE_ACKS
  const choices = pool.length > 0 ? pool : UPDATE_ACKS
  const idx = Math.floor(rand() * choices.length) % choices.length
  return choices[idx] ?? choices[0]!
}

export function shapeCorrectionUpdate(confirmationText: string, ack: string): string {
  return `${ack}\n${confirmationText}`
}

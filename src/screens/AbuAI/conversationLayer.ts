export const UPDATE_ACKS: readonly string[] = [
  'אה, הבנתי —',
  'סבבה —',
  'רגע, מתקנת —',
  'אוקיי —',
  'הבנתי —',
]

export const CANCEL_RESPONSE = 'אוקיי, לא שומרת.'

export const UNRELATED_RESPONSE = 'לא בטוחה שהבנתי —\nאפשר להגיד לי שוב?'

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

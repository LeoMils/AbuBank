/*
 * Cognitive Supervisor (Phase 9)
 * ══════════════════════════════
 * The last gate before any answer reaches UI/TTS. It asks: "would an intelligent
 * human assistant consider this correct, relevant, natural, and safe?" It COMPOSES
 * the runtime Verifier (hallucination / bypass / broken-Hebrew / date-bounce) and
 * adds delivery-quality checks (too long for voice, robotic register, empty). On
 * rejection it repairs ONCE; the caller re-runs the supervisor on the repair.
 *
 * Pure + deterministic. It does not itself emit — it approves or repairs the text
 * the runtime already composed.
 */
import { verifyAnswer, type RuntimeIntent } from './cognitiveRuntime'

export interface SupervisorContext {
  intent: RuntimeIntent
  dataAvailable: boolean
  forVoice?: boolean
  /** the actual user question, when the supervisor should check relevance. */
  question?: string
}

export interface SupervisorVerdict { approved: boolean; reasons: string[] }

const TOO_LONG_FOR_VOICE = 240
// Generic assistant / robotic register that a warm companion never uses.
const ROBOTIC = /מה\s+תרצי\s+לדבר\s+עליו|איך\s+אפשר\s+לעזור\s+לך|אני\s+(?:עוזרת|בוט|מערכת)\s+(?:דיגיטלית|אוטומטית)|כאסיסטנט/u
const APOLOGY_LOOP = /סליחה[.,]?\s+סליחה|מצטערת[.,]?\s+מצטערת/u

export function supervise(answer: string, ctx: SupervisorContext): SupervisorVerdict {
  const a = (answer ?? '').trim()
  const reasons: string[] = []
  if (!a) { return { approved: false, reasons: ['empty'] } }

  // Core correctness/safety (hallucination, "can't check" with data, date-bounce,
  // broken Hebrew, fragments, double preposition).
  const v = verifyAnswer(a, { intent: ctx.intent, dataAvailable: ctx.dataAvailable })
  reasons.push(...v.violations)

  // Delivery quality.
  if (ctx.forVoice && a.length > TOO_LONG_FOR_VOICE) reasons.push('too_long_for_voice')
  if (ROBOTIC.test(a)) reasons.push('robotic')
  if (APOLOGY_LOOP.test(a)) reasons.push('apology_loop')

  return { approved: reasons.length === 0, reasons }
}

/**
 * One repair pass. Trims to the first sentence when too long for voice, strips a
 * robotic/apology-loop register. Returns the repaired text (the caller re-runs the
 * supervisor; if still unsafe it should answer honestly with the limitation).
 */
export function repair(answer: string, verdict: SupervisorVerdict): string {
  let a = (answer ?? '').trim()
  if (verdict.reasons.includes('robotic')) a = a.replace(ROBOTIC, '').trim()
  if (verdict.reasons.includes('apology_loop')) a = a.replace(APOLOGY_LOOP, 'סליחה').trim()
  if (verdict.reasons.includes('too_long_for_voice')) {
    const first = a.split(/(?<=[.!?])\s+/)[0]
    if (first && first.length >= 4) a = first.trim()
  }
  a = a.replace(/\s{2,}/g, ' ').replace(/^[\s,.;:–—-]+/u, '').trim()
  return a || (answer ?? '').trim()
}

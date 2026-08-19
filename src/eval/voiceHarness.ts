/*
 * Shared VOICE-vs-TEXT harness. Injects a transcript through the EXACT SAME brain
 * as typed text (ExecutiveCognitiveController → runFullTurn → runCognitiveTurn),
 * with the faithful entry pipeline (resolvePronouns + resolveFollowUp). A "voice"
 * turn and a "text" turn differ only by a label — they call the identical pipeline,
 * which is the whole point of the unification.
 */
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { saveAppointments } from '../screens/AbuCalendar/service'
import { resolvePronouns } from '../screens/AbuAI/pronounResolver'
import { resolveFollowUp } from '../screens/AbuAI/contextResolver'
import type { FullTurnTools } from '../screens/AbuAI/runtimeFullTurn'
import type { ChatMessage } from '../screens/AbuAI/types'

export class MemLS {
  private s = new Map<string, string>()
  getItem(k: string) { return this.s.has(k) ? this.s.get(k)! : null }
  setItem(k: string, v: string) { this.s.set(k, String(v)) }
  removeItem(k: string) { this.s.delete(k) }
  clear() { this.s.clear() }
  key() { return null }
  get length() { return this.s.size }
}

export const voiceTools = (): FullTurnTools => ({
  llm: async (i: string) => `[LLM] ${i.slice(0, 40)}`,
  online: async (q: string) => {
    if (/מזג|אוויר|tiempo|clima/i.test(q)) return { ok: true, answer: `בכפר סבא 29 מעלות, שמש. (${q})` }
    if (/משחק|כדורגל|מונדיאל|ליגה|f[uú]tbol/i.test(q)) return { ok: true, answer: `הערב צרפת נגד ברזיל 21:00. (${q})` }
    if (/חדשות|news/i.test(q)) return { ok: true, answer: `הכותרת המרכזית היום. (${q})` }
    if (/דולר|שקל|שער|מטבע/.test(q)) return { ok: true, answer: `100 שקל הם בערך 27 דולר. (${q})` }
    return { ok: true, answer: `תשובת אונליין: ${q}` }
  },
})

export const NOW = new Date('2026-06-24T20:00:00')

export interface BrainTurn {
  say: string; resolved: string; intent: string; source: string
  createPhase: string; sideEffect: unknown; display: string; needsOnline: boolean
}

/** Drive an evolving conversation through the shared brain. `source` is cosmetic —
 *  both 'text' and 'voice_realtime' call the identical controller. */
export async function brainConversation(turns: string[]): Promise<BrainTurn[]> {
  ;(globalThis as unknown as { localStorage: MemLS }).localStorage = new MemLS()
  saveAppointments([])
  const tools = voiceTools()
  let state: RuntimeState = IDLE_RUNTIME
  const msgs: Array<{ role: string; content: string }> = []
  const out: BrainTurn[] = []
  for (const say of turns) {
    const prior: ChatMessage[] = msgs.map((m, i) => ({ id: String(i), role: m.role as 'user' | 'assistant', content: m.content, timestamp: 0 }))
    const { resolved: pr } = resolvePronouns(say, prior)
    let eff = pr !== say ? pr : say
    const fu = resolveFollowUp(eff, prior, { pendingCreate: state.createState.phase !== 'idle' })
    if (fu.wasFollowUp) eff = fu.resolved
    msgs.push({ role: 'user', content: eff })
    const r = await ExecutiveCognitiveController.handleTurn({ ...state, conv: state.conv }, eff, { messages: [...msgs], now: NOW }, tools)
    state = r.state
    msgs.push({ role: 'assistant', content: r.display })
    out.push({
      say, resolved: eff, intent: r.intent, source: r.source, createPhase: r.state.createState.phase,
      sideEffect: r.sideEffect, display: r.display, needsOnline: /online/.test(r.source),
    })
  }
  return out
}

/** Single-turn brain decision (fresh state) — for text-vs-voice parity. */
export async function brainTurn(text: string): Promise<BrainTurn> {
  return (await brainConversation([text]))[0]!
}

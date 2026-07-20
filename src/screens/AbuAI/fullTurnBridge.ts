/*
 * Full-Turn Bridge
 * ════════════════
 * Builds the injected tools the flagged full-cutover path hands to `runFullTurn`.
 * Kept OUT of index.tsx so the two production online call sites there stay exactly
 * two (the online-wiring source contract), while the flagged runtime path routes
 * its live lookups through here — with the SAME personal-block guard (defense in
 * depth: the runtime only asks for online on a non-personal current-info query,
 * and this guards again).
 */
import { sendMessage } from './service'
import { answerOnlineCurrentInfo } from './onlineProvider'
import { isOnlineCurrentInfoQuery, shouldBlockOnlineForPersonal } from './onlineIntent'
import { makeInterpretTransport } from './understandingIntake'
import type { FullTurnTools } from './runtimeFullTurn'
import type { ChatMessage } from './types'

// P1 understanding-first transport — real provider via /api/abuai-chat. Built once
// (stateless). Live behavior is PREVIEW-class; the request/response plumbing is unit-tested.
const interpret = makeInterpretTransport()

export function buildFullTurnTools(messages: ChatMessage[], voiceMode: boolean): FullTurnTools {
  return {
    llm: async () => sendMessage(messages, voiceMode),
    online: async (q) => {
      // Defense in depth — never hit the online endpoint for a personal/family query.
      if (!isOnlineCurrentInfoQuery(q) || shouldBlockOnlineForPersonal(q)) {
        return { ok: false, answer: '', reason: 'blocked_personal' }
      }
      const o = await answerOnlineCurrentInfo(q, { locationHint: 'Kfar Saba area, Israel' })
      return { ok: o.ok, answer: o.ok ? o.answer : (o.userMessage ?? ''), reason: o.ok ? null : (o.errorCode ?? 'provider_failed') }
    },
    // Understanding-first: runs ONLY on a pattern miss (the needsLLM branch), enriching
    // the LLM grounding with graph-resolved people + engine-parsed dates. Latency logged.
    interpret,
    onUnderstandLatency: (ms, op) => { try { console.info(`[AbuAI][UNDERSTAND|LATENCY] ms=${ms} op=${op}`) } catch { /* logging never breaks a turn */ } },
  }
}

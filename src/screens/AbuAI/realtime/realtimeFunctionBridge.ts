/*
 * REALTIME FUNCTION-CALL BRIDGE (ADR-0001 §12) — the pure event parser.
 * ═══════════════════════════════════════════════════════════════════════
 * Extracts a completed function call from a raw OpenAI Realtime server event,
 * handling BOTH official shapes (verified 2026-08 against developers.openai.com):
 *   • response.function_call_arguments.done  → { call_id, name?, arguments }
 *   • response.output_item.done              → { item:{ type:'function_call', name, call_id, arguments } }
 *   • response.done                          → { response:{ output:[ …function_call items… ] } }
 * Returns null for anything that is not a completed function call, so the caller
 * can ignore audio/text items safely. Pure + fully unit-testable.
 */
import { isRealtimeToolName } from '../../../services/realtimeToolSchemas'

export interface ParsedFunctionCall {
  name: string
  callId: string
  /** Raw arguments JSON string exactly as the model emitted it. */
  argsJson: string
}

interface FunctionCallItem { type?: string; name?: string; call_id?: string; arguments?: string }

function fromItem(item: FunctionCallItem | undefined | null): ParsedFunctionCall | null {
  if (!item || item.type !== 'function_call') return null
  if (!item.name || !item.call_id) return null
  return { name: item.name, callId: item.call_id, argsJson: item.arguments ?? '{}' }
}

/**
 * Parse a raw server event into a completed function call, or null. Only the
 * COMPLETION shapes are honored (delta streams are ignored — we act once, on done).
 */
export function extractFunctionCall(event: unknown): ParsedFunctionCall | null {
  if (!event || typeof event !== 'object') return null
  const e = event as {
    type?: string
    name?: string; call_id?: string; arguments?: string
    item?: FunctionCallItem
    response?: { output?: FunctionCallItem[] }
  }
  switch (e.type) {
    case 'response.function_call_arguments.done':
      // The args-done event carries call_id + arguments; name may be absent (comes
      // from the item) — accept it only when name is present and a known tool.
      if (e.name && e.call_id) return { name: e.name, callId: e.call_id, argsJson: e.arguments ?? '{}' }
      return null
    case 'response.output_item.done':
      return fromItem(e.item)
    case 'response.done': {
      const out = e.response?.output ?? []
      for (const item of out) { const fc = fromItem(item); if (fc) return fc }
      return null
    }
    default:
      return null
  }
}

/** Parse the arguments JSON safely — a malformed payload yields {} (fails honestly downstream). */
export function safeParseArgs(argsJson: string): Record<string, unknown> {
  try { const v = JSON.parse(argsJson || '{}'); return v && typeof v === 'object' ? v as Record<string, unknown> : {} }
  catch { return {} }
}

/** True when the parsed call names a tool we actually expose (guards against drift). */
export function isKnownToolCall(fc: ParsedFunctionCall): boolean { return isRealtimeToolName(fc.name) }

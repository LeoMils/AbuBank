/*
 * Regression: HMO-clinic (קופת חולים) location capture (Cycle 8, RED-first)
 * ════════════════════════════════════════════════════════════════════════
 * Probe evidence (C5): "תקבעי פגישה עם הרופא מחר בבוקר בקופת חולים בכפר סבא בתשע"
 * captured the location as only "כפר סבא" — "קופת חולים" (the HMO clinic, the actual
 * venue) was dropped, because it was not in the venue head-word list, so the extractor
 * fell through to the bare-city match.
 *
 * Drives the extractor (unit) and the REAL controller. Evidence class: CODE.
 */
import { describe, it, expect } from 'vitest'
import { extractEventDetails } from './eventExtractor'
import { ExecutiveCognitiveController } from './executiveCognitiveController'
import { IDLE_RUNTIME } from './cognitiveRuntime'
import type { FullTurnTools } from './runtimeFullTurn'

describe('extractEventDetails — קופת חולים is captured as the venue', () => {
  it('"…בקופת חולים בכפר סבא בתשע" → location includes קופת חולים (not just the city)', () => {
    const ev = extractEventDetails('תקבעי פגישה עם הרופא מחר בבוקר בקופת חולים בכפר סבא בתשע')
    expect(ev.location ?? '').toContain('קופת חולים')
    // the time must NOT leak into the location
    expect(ev.location ?? '').not.toMatch(/תשע/u)
  })
})

const NOW = new Date(2026, 6, 15, 10, 0, 0)
const TOOLS: FullTurnTools = { llm: async () => '[LLM]', online: async () => ({ ok: true, answer: '' }) }
const ctx = () => ({ messages: [] as Array<{ role: string; content: string }>, now: NOW })

describe('controller: the clinic venue survives into the confirmation', () => {
  it('"תקבעי פגישה עם הרופא מחר בבוקר בקופת חולים בכפר סבא בתשע" confirms with קופת חולים', async () => {
    const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, 'תקבעי פגישה עם הרופא מחר בבוקר בקופת חולים בכפר סבא בתשע', ctx(), TOOLS)
    expect((r.display ?? '')).toContain('קופת חולים')
  })
})

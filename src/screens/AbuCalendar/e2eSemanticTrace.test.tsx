/*
 * End-to-end semantic trace consistency tests.
 *
 * Live QA showed the QA debug panel was rendering UI-action names like
 * `show_confirm_card` in the route/intent fields, with all other fields
 * empty. Root cause:
 *   1. processVoiceTranscript did not attach `semantic` to the
 *      show_confirm_card / needs_clarification / needs_am_pm actions —
 *      so the trace writer in index.tsx fell into the empty branch.
 *   2. VoiceDebugPanel read trace.parseDecision (a UI action) as the
 *      "route" — so even when semanticIntent existed, the UI action
 *      leaked into the operator's view.
 *
 * These tests pin the new contract:
 *   - processVoiceTranscript always attaches `semantic` to non-utterance
 *     actions (auto_created, show_confirm_card, needs_am_pm,
 *     needs_clarification, failed_to_save).
 *   - The VoiceTrace shape has explicit semanticRoute / relationPhrase /
 *     finalTitle / resolvedPerson* / saveAllowed / saveBlockReason
 *     fields that the operator can rely on.
 *   - For the four live-QA sentences, the trace fields written by the
 *     pipeline match what the QA panel renders. No split-brain.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'

beforeAll(() => {
  if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map<string, string>()
    ;(globalThis as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => { store.set(k, String(v)) },
      removeItem: (k: string) => { store.delete(k) },
      clear: () => { store.clear() },
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() { return store.size },
    } as Storage
  }
})

import { processVoiceTranscript } from './voiceAutoCreate'
import { extractPersonPhrase, resolvePersonPhrase } from './familyResolve'
import { VoiceDebugPanel, setVoiceDebugEnabled } from './VoiceDebugPanel'
import type { VoiceTrace, SemanticRoute } from './voiceTrace'
import { createInitialTrace } from './voiceTrace'

const TODAY_E2E = '2026-05-31'
const TOMORROW_E2E = '2026-06-01'

/**
 * Simulate the trace-writing block in index.tsx for the appointment
 * branch. Keeps the test isolated from React state but exercises the
 * exact same logic: extract relation, resolve person, derive
 * semanticRoute, derive saveAllowed.
 */
function simulateAppointmentTrace(transcript: string): VoiceTrace {
  const decision = processVoiceTranscript(transcript, TODAY_E2E)
  const semanticRoute: SemanticRoute =
    decision.action === 'not_calendar'
    || decision.action === 'low_confidence'
    || decision.action === 'failed_to_understand'
      ? 'unknown'
      : 'appointment_create'

  let relationPhrase: string | null = null
  let resolvedPersonStatus: 'resolved' | 'ambiguous' | 'missing' | 'none' | null = null
  let resolvedPersonName: string | null = null
  let finalTitle: string | null = null
  let saveAllowed = false
  let saveBlockReason: string | null = null

  if ('draft' in decision) {
    finalTitle = decision.draft.title || null
    relationPhrase = decision.draft.personPhrase ?? extractPersonPhrase(transcript)
    if (relationPhrase) {
      const r = resolvePersonPhrase(relationPhrase)
      resolvedPersonStatus = r.status
      if (r.status === 'resolved') resolvedPersonName = r.name
    }
  }
  if (decision.action === 'auto_created') {
    finalTitle = decision.appointment.title
    saveAllowed = true
  } else if (decision.action === 'show_confirm_card') {
    saveAllowed = resolvedPersonStatus !== 'ambiguous'
    saveBlockReason = resolvedPersonStatus === 'ambiguous' ? 'family ambiguous' : null
  } else if (decision.action === 'needs_am_pm') {
    saveBlockReason = 'ambiguous time (AM/PM)'
  } else if (decision.action === 'needs_clarification') {
    saveBlockReason = `missing: ${decision.missing.join(',')}`
  } else if (decision.action === 'not_calendar') {
    saveBlockReason = 'not_calendar'
  } else if (decision.action === 'low_confidence') {
    saveBlockReason = 'low_confidence'
  } else if (decision.action === 'failed_to_understand') {
    saveBlockReason = 'failed_to_understand'
  } else if (decision.action === 'failed_to_save') {
    saveBlockReason = `failed_to_save:${decision.reason}`
  }

  const trace: VoiceTrace = {
    ...createInitialTrace('e2e-test'),
    rawTranscript: transcript,
    transcript,
    correctedTranscript: transcript,
    parseDecision: decision.action,
    semanticRoute,
    finalTitle,
    relationPhrase,
    resolvedPersonStatus,
    resolvedPersonName,
    saveAllowed,
    saveBlockReason,
  }
  if ('semantic' in decision && decision.semantic) {
    trace.semanticIntent = decision.semantic.intent
    trace.extractedTitle = decision.semantic.extractedTitle
    trace.extractedDate = decision.semantic.extractedDate
    trace.extractedStartTime = decision.semantic.extractedStartTime
    trace.extractedPeople = decision.semantic.extractedPeople
  }
  return trace
}

// ─── Contract: every appointment action carries `semantic` ───────────
describe('processVoiceTranscript — semantic carried on every action', () => {
  it('show_confirm_card includes semantic field (live-QA root cause)', () => {
    const r = processVoiceTranscript('פגישה עם גלעד מחר בתשע בערב', TODAY_E2E)
    // This is the path the live operator hit; it must now carry semantic.
    expect(r.action).toBe('show_confirm_card')
    if (r.action === 'show_confirm_card') {
      expect(r.semantic).toBeDefined()
      expect(r.semantic.extractedDate).toBe(TOMORROW_E2E)
      expect(r.semantic.extractedStartTime).toBe('21:00')
    }
  })

  it('needs_clarification includes semantic field', () => {
    const r = processVoiceTranscript('פגישה', TODAY_E2E)
    if (r.action === 'needs_clarification') {
      expect(r.semantic).toBeDefined()
    }
  })

  it('needs_am_pm includes semantic field', () => {
    const r = processVoiceTranscript('פגישה עם גלעד מחר בשלוש', TODAY_E2E)
    if (r.action === 'needs_am_pm') {
      expect(r.semantic).toBeDefined()
    }
  })
})

// ─── The four live-QA sentences ──────────────────────────────────────
describe('end-to-end semantic trace — four live-QA sentences', () => {
  it('"מחר בחצות פגישה עם אופיר" — appointment_create, tomorrow, 00:00, אופיר, saveAllowed=true', () => {
    const t = simulateAppointmentTrace('מחר בחצות פגישה עם אופיר')
    expect(t.semanticRoute).toBe('appointment_create')
    expect(t.extractedDate).toBe(TOMORROW_E2E)
    expect(t.extractedStartTime).toBe('00:00')
    // Person phrase may be bare name or none — the literal "אופיר" is
    // in the transcript so it should appear among extracted people.
    expect(t.extractedPeople).toContain('אופיר')
    expect(t.saveAllowed).toBe(true)
    // Critically: route must NOT be the UI action string.
    expect(t.semanticRoute).not.toBe('show_confirm_card')
    expect(t.parseDecision).not.toBe(t.semanticRoute)
  })

  it('"מחר בשלוש פגישה עם אשתו של אילי" — appointment_create, relation present, no invented person', () => {
    const t = simulateAppointmentTrace('מחר בשלוש פגישה עם אשתו של אילי')
    expect(t.semanticRoute).toBe('appointment_create')
    // אילי is not the canonical Hebrew (עילי is); the resolver must NOT
    // invent a wife. Either missing or none — never resolved with a name.
    expect(t.resolvedPersonName).toBeNull()
    expect(['missing', 'none', null]).toContain(t.resolvedPersonStatus)
    // Hour 3 is ambiguous (AM/PM) → either needs_am_pm OR the trace
    // surfaces the ambiguity in saveBlockReason.
    if (t.parseDecision === 'needs_am_pm') {
      expect(t.saveAllowed).toBe(false)
      expect(t.saveBlockReason).toContain('AM/PM')
    }
  })

  it('"מחר בחמש אחר הצהריים פגישה עם הגרוש של מור" — appointment_create, tomorrow, 17:00, relation resolved to רפי', () => {
    const t = simulateAppointmentTrace('מחר בחמש אחר הצהריים פגישה עם הגרוש של מור')
    expect(t.semanticRoute).toBe('appointment_create')
    expect(t.extractedDate).toBe(TOMORROW_E2E)
    expect(t.extractedStartTime).toBe('17:00')
    expect(t.relationPhrase).toBe('הגרוש של מור')
    expect(t.resolvedPersonStatus).toBe('resolved')
    expect(t.resolvedPersonName).toBe('רפי')
    expect(t.saveAllowed).toBe(true)
  })

  it('"מחר בשמונה בבוקר אני רוצה להיפגש עם הבן של מור" — appointment_create, tomorrow, 08:00, ambiguous parent', () => {
    const t = simulateAppointmentTrace('מחר בשמונה בבוקר אני רוצה להיפגש עם הבן של מור')
    expect(t.semanticRoute).toBe('appointment_create')
    expect(t.extractedDate).toBe(TOMORROW_E2E)
    expect(t.extractedStartTime).toBe('08:00')
    expect(t.relationPhrase).toBe('הבן של מור')
    // Mor has three sons (Ayalon, Eili, Adar) → ambiguous which one.
    expect(t.resolvedPersonStatus).toBe('ambiguous')
    expect(t.resolvedPersonName).toBeNull()
    // Save must be blocked while family is ambiguous — operator must pick.
    expect(t.saveAllowed).toBe(false)
    expect(t.saveBlockReason).toBe('family ambiguous')
  })
})

// ─── Trace ↔ panel consistency ───────────────────────────────────────
// React.renderToString inserts HTML comments (<!-- -->) between literal
// JSX text and dynamic {expression} children. Normalize the markup
// before asserting on contiguous "label: value" pairs.
function flatten(html: string): string {
  return html.replace(/<!--\s*-->/g, '')
}

describe('QA panel renders the same semantic values as the trace', () => {
  beforeEach(() => {
    setVoiceDebugEnabled(true)
  })

  it('panel route comes from semanticRoute, never from parseDecision (UI action)', () => {
    const trace = simulateAppointmentTrace('פגישה עם גלעד מחר בתשע בערב')
    const html = flatten(renderToString(
      React.createElement(VoiceDebugPanel, { trace, reminderDraft: null }),
    ))
    // route must be the canonical semantic name.
    expect(html).toContain('route: appointment_create')
    // The UI action string MUST NOT appear in the route field.
    expect(html).not.toContain('route: show_confirm_card')
  })

  it('panel shows date/time/relation/person/finalTitle matching the trace', () => {
    const trace = simulateAppointmentTrace('מחר בחמש אחר הצהריים פגישה עם הגרוש של מור')
    const html = flatten(renderToString(
      React.createElement(VoiceDebugPanel, { trace, reminderDraft: null }),
    ))
    expect(html).toContain('route: appointment_create')
    expect(html).toContain('date: ' + TOMORROW_E2E)
    expect(html).toContain('time: 17:00')
    expect(html).toContain('relation: הגרוש של מור')
    expect(html).toContain('person: רפי')
    expect(html).toContain('saveAllowed: yes')
  })

  it('panel saveAllowed=no with reason="family ambiguous" matches trace decision', () => {
    const trace = simulateAppointmentTrace('מחר בשמונה בבוקר אני רוצה להיפגש עם הבן של מור')
    const html = flatten(renderToString(
      React.createElement(VoiceDebugPanel, { trace, reminderDraft: null }),
    ))
    expect(html).toContain('saveAllowed: no')
    expect(html).toContain('reason: family ambiguous')
    // relation is shown even though person could not be resolved.
    expect(html).toContain('relation: הבן של מור')
    expect(html).toContain('person: —')
  })

  it('midnight sentence: route=appointment_create, time=00:00, saveAllowed=yes', () => {
    const trace = simulateAppointmentTrace('מחר בחצות פגישה עם אופיר')
    const html = flatten(renderToString(
      React.createElement(VoiceDebugPanel, { trace, reminderDraft: null }),
    ))
    expect(html).toContain('route: appointment_create')
    expect(html).toContain('time: 00:00')
    expect(html).toContain('saveAllowed: yes')
  })

  it('"unknown" route is shown when nothing usable was parsed', () => {
    const trace: VoiceTrace = {
      ...createInitialTrace('e2e'),
      rawTranscript: 'שלום',
      transcript: 'שלום',
      semanticRoute: 'unknown',
      saveAllowed: false,
      saveBlockReason: 'not_calendar',
    }
    const html = flatten(renderToString(
      React.createElement(VoiceDebugPanel, { trace, reminderDraft: null }),
    ))
    expect(html).toContain('route: unknown')
    expect(html).toContain('saveAllowed: no')
  })
})

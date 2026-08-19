/*
 * CALENDAR DRAFT CONTROLLER (ADR-0001 §5/§12) — thin Control Plane adapter.
 * ════════════════════════════════════════════════════════════════════════════
 * The runtime seam between a completed Realtime CALENDAR function-call and the
 * canonical typed draft (calendarDraft). It owns NO natural language, NO provider
 * truth, NO conversation policy: it validates args, dispatches ONE typed draft
 * operation, enforces exactly-once by model call id, returns a SAFE receipt (never
 * a relative date, never a guessed person) and projects the committed draft.
 * Parallel to RealtimeCommController; delegates relationship truth to an injected
 * resolver (production: familyResolve).
 */
import { applyCalendarFunctionCall, type CalendarDraft, type CalendarReceipt, type RelationshipResolver } from './calendarDraft'
import { safeParseArgs, type ParsedFunctionCall } from './realtimeFunctionBridge'
import type { SendEvent } from './realtimeCommController'

export interface CalendarControllerCallbacks {
  /** Project the committed draft receipt to the UI (or null when nothing is active). */
  onCard: (receipt: CalendarReceipt) => void
}

export class CalendarDraftController {
  private draft: CalendarDraft | null = null
  private readonly handled = new Map<string, CalendarReceipt>()   // exactly-once by call id
  private readonly inFlight = new Set<string>()

  constructor(
    private readonly resolve: RelationshipResolver,
    private readonly send: SendEvent,
    private readonly cb: CalendarControllerCallbacks,
  ) {}

  /** True while a create/confirm is still in flight (not yet committed or cancelled).
   *  The session lifecycle reads this so it NEVER closes mid-task. */
  hasActiveDraft(): boolean {
    return this.draft !== null
      && (this.draft.confirmation === 'DRAFTING' || this.draft.confirmation === 'AWAITING_CONFIRM')
  }

  /** Handle a completed calendar function-call EXACTLY ONCE: dispatch one typed draft
   *  op, project the committed draft, return a safe receipt to the model, continue it. */
  async onFunctionCall(fc: ParsedFunctionCall): Promise<CalendarReceipt> {
    const cached = this.handled.get(fc.callId)
    if (cached) return cached                                     // completed duplicate → no re-send
    if (this.inFlight.has(fc.callId)) return this.lastReceipt()   // in-flight duplicate → drop
    this.inFlight.add(fc.callId)
    try {
      const args = safeParseArgs(fc.argsJson)
      const { outcome, receipt } = applyCalendarFunctionCall(this.draft, { name: fc.name, args }, this.resolve)
      this.draft = outcome.draft
      this.handled.set(fc.callId, receipt)
      this.cb.onCard(receipt)
      this.replyToModel(fc.callId, receipt)
      return receipt
    } finally {
      this.inFlight.delete(fc.callId)
    }
  }

  /** Return ONLY safe receipt strings — resolved date/name/status, never a relative
   *  date, never a number, never a completion. Then let the model continue speaking. */
  private replyToModel(callId: string, r: CalendarReceipt): void {
    const output = {
      confirmation: r.confirmation, revision: r.revision,
      participant: r.participant, participants: r.participants, unresolved_relationship: r.unresolvedRelationship,
      date: r.date, time: r.time, missing: r.missing, allowed_to_say: r.allowedClaims,
    }
    this.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(output) } })
    this.send({ type: 'response.create' })
  }

  private lastReceipt(): CalendarReceipt {
    return {
      confirmation: this.draft?.confirmation ?? 'DRAFTING', revision: this.draft?.revision ?? 0,
      participant: this.draft?.participant ?? null, participants: this.draft?.participants ?? [],
      unresolvedRelationship: this.draft?.unresolvedRelationship ?? null,
      date: this.draft?.date ?? null, time: this.draft?.time ?? null, missing: [], allowedClaims: [], rejected: false, reason: 'in-flight',
    }
  }

  viewDraft(): CalendarDraft | null { return this.draft }
}

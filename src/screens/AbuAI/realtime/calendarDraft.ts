/*
 * CALENDAR TYPED DRAFT under ADR-0001 (control-plane discipline, reuse-first).
 * ════════════════════════════════════════════════════════════════════════════
 * A pure typed draft + reducer that gives Calendar the SAME state discipline as
 * Communication: monotonic revisions, field-level corrections that preserve every
 * unrelated field, same-revision confirm/commit, unresolved relationships that stay
 * unresolved (never guessed), and ISOLATION — general/communication turns never
 * mutate the draft. It owns NO product truth: date/relationship resolution is
 * DELEGATED (injected `resolve`), backed in production by the existing AbuCalendar
 * modules (calendarEventBuilderV2 / localParser / familyResolve). No second brain.
 */

export type CalendarField = 'participant' | 'title' | 'date' | 'time' | 'durationMin' | 'location' | 'notes'
export type ConfirmationState = 'DRAFTING' | 'AWAITING_CONFIRM' | 'CONFIRMED' | 'CANCELLED'

export interface CalendarDraft {
  participant: string | null
  /** A relationship phrase we could NOT resolve to a person (e.g. "אח של מור"). Stays
   *  unresolved until an explicit name arrives — never guessed into a person. */
  unresolvedRelationship: string | null
  title: string | null
  date: string | null           // YYYY-MM-DD (real resolved date, never "מחר")
  time: string | null           // HH:MM
  durationMin: number | null
  location: string | null
  notes: string | null
  provenance: Partial<Record<CalendarField, 'user' | 'resolved'>>
  revision: number
  confirmation: ConfirmationState
}

export type CalendarTurn =
  | { t: 'START_DRAFT'; fields: Partial<Record<CalendarField, string | number>>; participantPhrase?: string }
  | { t: 'CORRECT_FIELD'; field: CalendarField; value: string | number; participantPhrase?: string }
  | { t: 'CONFIRM'; forRevision: number }
  | { t: 'CANCEL' }
  | { t: 'GENERAL' }            // general/communication turn — MUST NOT mutate the draft (isolation)

export interface DraftOutcome { draft: CalendarDraft | null; rejected: boolean; reason: string }

/** Injected truth: resolve a relationship phrase to a concrete person NAME, or null
 *  when ambiguous/unknown (production delegates to familyResolve). Never invents. */
export type RelationshipResolver = (phrase: string) => string | null

const REQUIRED: CalendarField[] = ['title', 'date']

function emptyDraft(): CalendarDraft {
  return {
    participant: null, unresolvedRelationship: null, title: null, date: null, time: null,
    durationMin: null, location: null, notes: null, provenance: {}, revision: 0, confirmation: 'DRAFTING',
  }
}

function missing(d: CalendarDraft): CalendarField[] { return REQUIRED.filter((f) => d[f] == null) }

function applyField(d: CalendarDraft, field: CalendarField, value: string | number): void {
  if (field === 'durationMin') d.durationMin = typeof value === 'number' ? value : parseInt(String(value), 10) || null
  else (d as Record<CalendarField, unknown>)[field] = String(value)
  d.provenance[field] = 'user'
}

function setParticipant(d: CalendarDraft, phrase: string, resolve: RelationshipResolver): void {
  const name = resolve(phrase)
  if (name) { d.participant = name; d.unresolvedRelationship = null; d.provenance.participant = 'resolved' }
  else { d.participant = null; d.unresolvedRelationship = phrase }   // stays unresolved — never guessed
}

/**
 * Pure reducer. Returns the next draft (or the same, with rejected=true for a stale
 * confirm / isolation no-op). Confirm CONSUMES the revision the user saw.
 */
export function reduceDraft(prev: CalendarDraft | null, turn: CalendarTurn, resolve: RelationshipResolver): DraftOutcome {
  const d: CalendarDraft = prev ? { ...prev, provenance: { ...prev.provenance } } : emptyDraft()

  switch (turn.t) {
    case 'GENERAL':
      // Isolation (ADR laws 13/14): a general/communication turn never touches the draft.
      return { draft: prev, rejected: false, reason: 'isolation-no-op' }

    case 'START_DRAFT': {
      const nd = emptyDraft()
      nd.revision = 1
      for (const [f, v] of Object.entries(turn.fields)) applyField(nd, f as CalendarField, v as string | number)
      if (turn.participantPhrase) setParticipant(nd, turn.participantPhrase, resolve)
      nd.confirmation = missing(nd).length === 0 ? 'AWAITING_CONFIRM' : 'DRAFTING'
      return { draft: nd, rejected: false, reason: 'started' }
    }

    case 'CORRECT_FIELD': {
      if (!prev) return { draft: null, rejected: true, reason: 'no-draft' }
      d.revision = prev.revision + 1                          // every mutation bumps the revision
      if (turn.participantPhrase !== undefined) setParticipant(d, turn.participantPhrase, resolve)
      else applyField(d, turn.field, turn.value)              // ONLY this field — all others preserved
      d.confirmation = missing(d).length === 0 ? 'AWAITING_CONFIRM' : 'DRAFTING'
      return { draft: d, rejected: false, reason: `corrected ${turn.field}` }
    }

    case 'CONFIRM': {
      if (!prev) return { draft: null, rejected: true, reason: 'no-draft' }
      // Same-revision commit: a confirm for a superseded revision is stale (a correction
      // happened after the user saw it) → reject, force a re-confirm of the current draft.
      if (turn.forRevision !== prev.revision) return { draft: prev, rejected: true, reason: `stale-confirm ${turn.forRevision}!=${prev.revision}` }
      if (missing(prev).length > 0) return { draft: prev, rejected: true, reason: `missing ${missing(prev).join(',')}` }
      if (prev.unresolvedRelationship) return { draft: prev, rejected: true, reason: 'unresolved-relationship' }
      d.confirmation = 'CONFIRMED'
      return { draft: d, rejected: false, reason: 'confirmed' }
    }

    case 'CANCEL':
      if (!prev) return { draft: null, rejected: false, reason: 'nothing-to-cancel' }
      d.confirmation = 'CANCELLED'
      return { draft: d, rejected: false, reason: 'cancelled' }
  }
}

/** Fields still missing before the draft can be confirmed (for a grounded read). */
export function missingFields(d: CalendarDraft): CalendarField[] { return missing(d) }

// ─── Injected-event adapter (PRODUCTION_ADAPTER) ─────────────────────────────
// Maps a completed calendar function-call (the shape the live Realtime session
// would carry) → a typed turn → the reducer → a SAFE grounded receipt for the
// model. Never emits a relative date ("מחר"); never invents a person. This is the
// production-faithful seam, drivable without a mic via injected events.
export interface CalendarFunctionCall { name: string; args: Record<string, unknown> }
export interface CalendarReceipt {
  confirmation: ConfirmationState
  revision: number
  participant: string | null
  unresolvedRelationship: string | null
  date: string | null
  time: string | null
  missing: CalendarField[]
  allowedClaims: string[]
  rejected: boolean
  reason: string
}

const CAL_TOOLS = new Set(['prepare_calendar_event', 'correct_calendar_field', 'confirm_calendar_event', 'cancel_calendar_event'])
export function isCalendarTool(name: string): boolean { return CAL_TOOLS.has(name) }

function toTurn(fc: CalendarFunctionCall, prev: CalendarDraft | null): CalendarTurn {
  const a = fc.args
  const str = (k: string): string | undefined => (typeof a[k] === 'string' ? a[k] as string : undefined)
  switch (fc.name) {
    case 'prepare_calendar_event': {
      const fields: Partial<Record<CalendarField, string | number>> = {}
      for (const f of ['title', 'date', 'time', 'location', 'notes'] as CalendarField[]) { const v = str(f); if (v) fields[f] = v }
      if (typeof a.durationMin === 'number') fields.durationMin = a.durationMin
      const p = str('participant')
      return p ? { t: 'START_DRAFT', fields, participantPhrase: p } : { t: 'START_DRAFT', fields }
    }
    case 'correct_calendar_field': {
      const p = str('participant')
      if (p) return { t: 'CORRECT_FIELD', field: 'participant', value: '', participantPhrase: p }
      return { t: 'CORRECT_FIELD', field: (str('field') as CalendarField) ?? 'notes', value: (a.value as string | number) ?? '' }
    }
    case 'confirm_calendar_event':
      return { t: 'CONFIRM', forRevision: typeof a.forRevision === 'number' ? a.forRevision : (prev?.revision ?? -1) }
    case 'cancel_calendar_event':
      return { t: 'CANCEL' }
    default:
      return { t: 'GENERAL' }
  }
}

function claimsFor(d: CalendarDraft | null, rejected: boolean, reason: string): string[] {
  if (!d) return ['nothing drafted']
  if (rejected && reason.startsWith('stale-confirm')) return ['ask to re-confirm the updated draft']
  if (d.unresolvedRelationship) return ['ask which person', 'never guesses the person']
  switch (d.confirmation) {
    case 'CONFIRMED': return ['event saved to the calendar']
    case 'AWAITING_CONFIRM': return ['reads back the draft', 'asks to confirm']
    case 'CANCELLED': return ['confirms cancel']
    default: return ['asks for the missing fields']
  }
}

/** Drive one injected calendar function-call through the draft. Returns the next
 *  draft + a SAFE receipt (only resolved dates/labels; never a relative date). */
export function applyCalendarFunctionCall(
  prev: CalendarDraft | null, fc: CalendarFunctionCall, resolve: RelationshipResolver,
): { outcome: DraftOutcome; receipt: CalendarReceipt } {
  const outcome = reduceDraft(prev, toTurn(fc, prev), resolve)
  const d = outcome.draft
  const receipt: CalendarReceipt = {
    confirmation: d?.confirmation ?? 'DRAFTING',
    revision: d?.revision ?? 0,
    participant: d?.participant ?? null,
    unresolvedRelationship: d?.unresolvedRelationship ?? null,
    date: d?.date ?? null,          // always a resolved YYYY-MM-DD or null — never "מחר"
    time: d?.time ?? null,
    missing: d ? missing(d) : [],
    allowedClaims: claimsFor(d, outcome.rejected, outcome.reason),
    rejected: outcome.rejected,
    reason: outcome.reason,
  }
  return { outcome, receipt }
}

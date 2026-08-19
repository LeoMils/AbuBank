/*
 * REALTIME CONTROL PLANE — the deterministic STATE authority of ADR-0001 (GRA-EDC).
 *
 * Owns STATE/lifecycle/ordering ONLY. It is NOT a semantic router: it never
 * classifies meaning, picks Call vs WhatsApp, resolves recipients, decides facts,
 * generates wording, or renders UI. Turn TYPE is decided upstream (kernel/model)
 * and handed to the reducer, which applies the lifecycle laws. A pure reducer +
 * monotonic revisions + a bounded event stream — no generic framework.
 *
 * This module exists to kill, at the architectural level, the device-transcript
 * failure families: stale WhatsApp swallowing an explicit Call, repeated greeting,
 * card/speech disagreement, general talk mutating a pending action, complaints
 * captured as clarification, and any fabricated completion.
 *
 * Privacy by construction: recipient is a SAFE LABEL that can never be a phone
 * number (see assertSafeLabel); the control plane never sees a number.
 */

export type Kind = 'call' | 'message'

// Tool receipt statuses — NOTE there is deliberately NO 'SENT'/'CALLED'/'DIALED'
// /'DELIVERED'. Completion is structurally unrepresentable (ADR §10): Abu never
// auto-sends/dials, so no state can ever assert it happened.
export type ActionStatus = 'NEEDS_CLARIFICATION' | 'READY_FOR_HANDOFF' | 'NOT_CONFIGURED' | 'CANCELLED' | 'FAILED'

// Turn types are decided by the kernel/model and delivered to the reducer.
export type TurnType =
  | 'GENERAL' | 'START_ACTION' | 'CONTINUE_ACTION' | 'CORRECT_ACTION' | 'REPLACE_ACTION'
  | 'ASK_ABOUT_ACTION' | 'CANCEL_ACTION' | 'EXPLICIT_SWITCH' | 'CLARIFICATION_RESPONSE'
  | 'UNCERTAIN' | 'COMPLAINT'

/** The single committed active-action record. One slot => at most one card (law 10). */
export interface ActiveAction {
  actionId: string
  revision: number          // monotonic; UI + speech both read THIS (law 9)
  generation: number        // transport generation; stale generations are rejected (law 6/12)
  kind: Kind
  recipientLabel: string | null   // SAFE label only — never a phone number
  status: ActionStatus
  supersedes: string | null // the action id this one atomically replaced (laws 2/3)
}

export interface ControlState {
  sessionId: string
  generation: number
  greetingEmitted: boolean
  transport: 'realtime' | 'fallback'
  active: ActiveAction | null
  revisionCounter: number
  lastAcceptedSeq: number
}

export type ControlEvent =
  | { t: 'SESSION_STARTED'; sessionId: string }
  | { t: 'GREETING_REQUESTED' }
  | { t: 'TURN_ACCEPTED'; seq: number; turnType: TurnType; kind?: Kind; recipientLabel?: string | null }
  | { t: 'TOOL_RESULT'; forRevision: number; generation: number; status: ActionStatus; kind: Kind; recipientLabel: string | null }
  | { t: 'CANCEL' }
  | { t: 'INTERRUPTION' }
  | { t: 'TRANSPORT_DISCONNECTED' }
  | { t: 'FALLBACK_ENTERED' }
  | { t: 'RECONNECTED' }

/** Effects are gated by the laws; the runtime executes them. Nothing that isn't
 *  emitted here may speak/render — replaced/cancelled/stale branches emit nothing. */
export type Effect =
  | { e: 'EMIT_GREETING' }
  | { e: 'REQUEST_TOOL'; kind: Kind; recipientLabel: string | null; revision: number; generation: number }
  | { e: 'RENDER_CARD'; action: ActiveAction }
  | { e: 'DISMISS_CARD' }
  | { e: 'STOP_PLAYBACK' }
  | { e: 'REJECT_STALE'; reason: string }

export function initialState(sessionId = 'pending'): ControlState {
  return { sessionId, generation: 0, greetingEmitted: false, transport: 'realtime', active: null, revisionCounter: 0, lastAcceptedSeq: -1 }
}

/** A recipient label may never be a phone number. Numbers stay in the kernel. */
export function isSafeLabel(label: string | null | undefined): boolean {
  if (label == null) return true
  const digits = String(label).replace(/\D/g, '')
  return digits.length < 7 // a human name/label, never an E.164/local number
}
function safe(label: string | null | undefined): string | null {
  return isSafeLabel(label) ? (label ?? null) : null
}

const MUTATES_ACTION = new Set<TurnType>(['START_ACTION', 'CONTINUE_ACTION', 'CORRECT_ACTION', 'REPLACE_ACTION', 'EXPLICIT_SWITCH', 'CANCEL_ACTION'])

let idSeq = 0
function nextActionId(): string { idSeq += 1; return `act_${idSeq}` }

/** Pure reducer. Returns the next state + the ONLY effects permitted this step. */
export function reduce(s: ControlState, ev: ControlEvent): { state: ControlState; effects: Effect[] } {
  switch (ev.t) {
    case 'SESSION_STARTED':
      return { state: { ...initialState(ev.sessionId) }, effects: [] }

    case 'GREETING_REQUESTED':
      // Law 8: exactly one greeting per genuine session; restart/reconnect/tool
      // completion/fallback never re-greet.
      if (s.greetingEmitted) return { state: s, effects: [] }
      return { state: { ...s, greetingEmitted: true }, effects: [{ e: 'EMIT_GREETING' }] }

    case 'TURN_ACCEPTED': {
      if (ev.seq <= s.lastAcceptedSeq) return { state: s, effects: [] } // ignore out-of-order/duplicate
      const base = { ...s, lastAcceptedSeq: ev.seq }
      const tt = ev.turnType
      // Laws 13/14: general conversation, complaints, meta and clarification never
      // mutate action state (a pending action cannot swallow them).
      if (!MUTATES_ACTION.has(tt)) return { state: base, effects: [] }

      if (tt === 'CANCEL_ACTION') {
        // Law 4: cancel invalidates the active branch.
        if (!base.active) return { state: base, effects: [] }
        return { state: { ...base, active: null }, effects: [{ e: 'DISMISS_CARD' }] }
      }

      const kind: Kind = ev.kind ?? (base.active?.kind ?? 'message')
      const rev = base.revisionCounter + 1
      const isReplace = (tt === 'REPLACE_ACTION' || tt === 'EXPLICIT_SWITCH') && !!base.active
      const isStart = tt === 'START_ACTION' || !base.active
      const supersedes = isReplace ? base.active!.actionId : (base.active ? base.active.actionId : null)
      const action: ActiveAction = {
        actionId: (isStart && !base.active) ? nextActionId() : (isReplace ? nextActionId() : base.active!.actionId),
        revision: rev,
        generation: base.generation,
        kind,
        recipientLabel: safe(ev.recipientLabel ?? base.active?.recipientLabel ?? null),
        status: 'NEEDS_CLARIFICATION',
        supersedes: (isReplace || (isStart && base.active)) ? supersedes : (base.active?.supersedes ?? null),
      }
      const effects: Effect[] = []
      // Laws 1/2/3: latest accepted explicit intent wins; Call<->WhatsApp is atomic.
      if (isReplace) effects.push({ e: 'STOP_PLAYBACK' }) // interrupt obsolete playback of the replaced branch
      effects.push({ e: 'REQUEST_TOOL', kind, recipientLabel: action.recipientLabel, revision: rev, generation: base.generation })
      effects.push({ e: 'RENDER_CARD', action })
      return { state: { ...base, active: action, revisionCounter: rev }, effects }
    }

    case 'TOOL_RESULT': {
      // Law 5/6/12: a result may commit ONLY for the current generation AND the
      // active revision. Replaced/cancelled/stale branches are rejected — they
      // can never speak or render.
      if (!s.active) return { state: s, effects: [{ e: 'REJECT_STALE', reason: 'no-active-action' }] }
      if (ev.generation !== s.generation || ev.forRevision !== s.active.revision) {
        return { state: s, effects: [{ e: 'REJECT_STALE', reason: `gen ${ev.generation}/${s.generation} rev ${ev.forRevision}/${s.active.revision}` }] }
      }
      const committed: ActiveAction = { ...s.active, status: ev.status, kind: ev.kind, recipientLabel: safe(ev.recipientLabel) }
      return { state: { ...s, active: committed }, effects: [{ e: 'RENDER_CARD', action: committed }] }
    }

    case 'CANCEL':
      if (!s.active) return { state: s, effects: [] }
      return { state: { ...s, active: null }, effects: [{ e: 'DISMISS_CARD' }] }

    case 'INTERRUPTION':
      // Law 7: stop obsolete playback; accepted user input/state is preserved.
      return { state: s, effects: [{ e: 'STOP_PLAYBACK' }] }

    case 'TRANSPORT_DISCONNECTED':
    case 'FALLBACK_ENTERED':
      // Law 12: bump generation so incompatible in-flight realtime events are
      // rejected. Law 8: no new greeting. State (active/greeting) preserved.
      return { state: { ...s, transport: 'fallback', generation: s.generation + 1 }, effects: [] }

    case 'RECONNECTED':
      return { state: { ...s, transport: 'realtime', generation: s.generation + 1 }, effects: [] }

    default:
      return { state: s, effects: [] }
  }
}

/** Fold a sequence of events (test/replay helper). */
export function run(events: ControlEvent[], start: ControlState = initialState('s1')): { state: ControlState; effects: Effect[] } {
  let state = start
  const effects: Effect[] = []
  for (const ev of events) { const r = reduce(state, ev); state = r.state; effects.push(...r.effects) }
  return { state, effects }
}

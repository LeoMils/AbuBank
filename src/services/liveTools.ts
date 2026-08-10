/*
 * liveTools.ts — Abu AI, Milestone 2/3: the ONE live-path tool executor.
 * ════════════════════════════════════════════════════════════════════════════
 * The single seam between a completed Realtime function-call and product truth for
 * the isolated live path. It owns NO natural language, NO conversation state, and
 * NO routing — the Realtime model holds the conversation. This module only:
 *
 *   • resolve_contact  → deterministic id | AMBIGUOUS | NOT_FOUND (liveContacts)
 *   • calendar         → prepare draft / correct one field / confirm / cancel / read,
 *                        reusing the typed draft kernel (realtime/calendarDraft) and
 *                        committing a CONFIRMED draft to the durable calendar store so
 *                        it is immediately readable (read-after-write)
 *   • whatsapp / call  → PREPARE / correct / cancel only. Nothing sends or dials;
 *                        Abu never claims an action happened.
 *
 * EXACTLY-ONCE: every completed call is deduped by the model's call id, AND a
 * CONFIRMED calendar draft commits at most one event no matter how many confirm
 * calls arrive (retries, duplicate shapes, reordered completions never double it).
 *
 * PRIVACY BY CONSTRUCTION: no function_call_output ever contains a phone number —
 * recipients are ids/labels, resolved to numbers only outside the model, at the
 * moment Martita herself presses send/dial (not in M2).
 */
import {
  applyCalendarFunctionCall, isCalendarTool,
  type CalendarDraft, type CalendarReceipt,
} from '../screens/AbuAI/realtime/calendarDraft'
import { resolveCalendarParticipant, resolveContact, contactLabel } from './liveContacts'
import type { ParsedFunctionCall } from '../screens/AbuAI/realtime/realtimeFunctionBridge'
import { loadAppointments, saveAppointments, updateAppointment, detectEmoji, type Appointment } from '../screens/AbuCalendar/service'

export type SendEvent = (event: Record<string, unknown>) => void

/** The calendar event shape the live path reads and writes. Carries every field the
 *  prepare_calendar_event tool accepts, so a created event round-trips losslessly
 *  (title/date/time/participant/location/notes) through persist → read → update. */
export interface LiveEvent {
  id: string
  title: string
  date: string        // YYYY-MM-DD
  time: string        // HH:MM or ''
  participant?: string
  location?: string
  notes?: string
}

/** Persistence seam — production wires this to the durable calendar store
 *  (AbuCalendar/service.ts); tests inject an in-memory implementation so
 *  read-after-write is provable without a browser. */
export interface LiveCalendarStore {
  list(): LiveEvent[]
  /** Persist and RETURN the stored event (with id), or null if it did not persist. */
  add(e: Omit<LiveEvent, 'id'>): LiveEvent | null
  /** Patch an EXISTING event in place and RETURN the updated event, or null if the id
   *  is unknown / the write did not persist. Used by update_calendar_event so a saved
   *  event is corrected without creating a duplicate. */
  update(id: string, patch: Partial<Omit<LiveEvent, 'id'>>): LiveEvent | null
}

export interface LiveCommDraft {
  kind: 'message' | 'call'
  recipientId: string | null
  recipientLabel: string | null
  intent: string | null
  status: 'READY_TO_SEND' | 'READY_TO_CALL' | 'CANCELLED'
}

export interface LiveToolsCallbacks {
  onCalendarDraft?: (d: CalendarDraft | null) => void
  /** Fires with the event AS ACTUALLY PERSISTED, so the overlay can render a
   *  receipt card showing the saved fields (not just what was drafted). */
  onCalendarSaved?: (e: LiveEvent) => void
  onCommDraft?: (d: LiveCommDraft | null) => void
}

/** The tools the live model may request. Kept minimal and precise for this path
 *  (isolated from the legacy ADR schema set). No parameter is or contains a phone
 *  number: recipients/participants are names, resolved locally. */
export const LIVE_TOOL_SCHEMAS = [
  {
    type: 'function', name: 'resolve_contact',
    description: 'Resolve a person named as spoken to a contact id BEFORE messaging or calling them. Returns resolved (with an id), ambiguous (a relationship like "אח של מור", or several people — ask which one), or not_found. Never returns a phone number.',
    parameters: { type: 'object', properties: { name: { type: 'string', description: 'The person as Martita said it (e.g. "מור").' } }, required: ['name'], additionalProperties: false },
  },
  {
    type: 'function', name: 'read_calendar',
    description: "Read Martita's real calendar. Optionally filter to one date. Use this for any 'what do I have' / 'when is…' question — never answer calendar questions from memory or the web.",
    parameters: { type: 'object', properties: { date: { type: 'string', description: 'Optional real date YYYY-MM-DD (already resolved, never "מחר"). Omit for everything upcoming.' } }, required: [], additionalProperties: false },
  },
  {
    type: 'function', name: 'prepare_calendar_event',
    description: 'Prepare (do NOT save) a calendar event draft to read back to Martita. Never claim it is saved until confirm_calendar_event succeeds.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'What the event is (e.g. "פגישה עם מור").' },
        date: { type: 'string', description: 'A REAL date YYYY-MM-DD (already resolved — never "מחר").' },
        time: { type: 'string', description: 'HH:MM 24h, optional.' },
        participant: { type: 'string', description: 'A person name as spoken, optional. A relationship phrase ("אח של מור") is NOT accepted — resolve it with Martita first.' },
        location: { type: 'string', description: 'Optional location.' },
        notes: { type: 'string', description: 'Optional notes.' },
      },
      required: ['title', 'date'], additionalProperties: false,
    },
  },
  {
    type: 'function', name: 'correct_calendar_field',
    description: 'Correct ONE field of the pending calendar draft (e.g. the time). Every other field is preserved.',
    parameters: {
      type: 'object',
      properties: {
        field: { type: 'string', description: 'Which field to correct.', enum: ['title', 'date', 'time', 'location', 'notes'] },
        value: { type: 'string', description: 'The new value for that field.' },
        participant: { type: 'string', description: 'Optional: set the participant name instead of a scalar field.' },
      },
      required: [], additionalProperties: false,
    },
  },
  {
    type: 'function', name: 'confirm_calendar_event',
    description: 'Save the pending calendar draft after Martita confirms it, at the revision she just heard.',
    parameters: { type: 'object', properties: { forRevision: { type: 'number', description: 'The draft revision Martita is confirming.' } }, required: ['forRevision'], additionalProperties: false },
  },
  {
    type: 'function', name: 'cancel_calendar_event',
    description: 'Cancel the pending calendar draft (Martita no longer wants the event).',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    type: 'function', name: 'update_calendar_event',
    description: 'Change ONE field of an ALREADY-SAVED calendar event, IN PLACE (never a new event). Use this — NOT prepare_calendar_event — when Martita wants to change something (time, place, title…) about an event already in the calendar. Identify the event by its real date; add a word from the title if several events share that date. Every other field is preserved.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'The saved event\'s date, a REAL YYYY-MM-DD (already resolved — never "מחר").' },
        field: { type: 'string', description: 'Which field to change.', enum: ['title', 'date', 'time', 'location', 'notes', 'participant'] },
        value: { type: 'string', description: 'The new value for that field (for date: a real YYYY-MM-DD).' },
        title_contains: { type: 'string', description: 'Optional word from the title, to pick the right event when several are on that date.' },
      },
      required: ['date', 'field', 'value'], additionalProperties: false,
    },
  },
  {
    type: 'function', name: 'whatsapp_draft',
    description: 'Compose a WhatsApp message and show Martita a CARD with the recipient and the FULL message text and a Send button. It does NOT send — only her tap on the card sends it. Pass the recipient as a NAME (resolved to a contact locally) and the full message you composed. Never claim the message was sent; tell her the card is ready and to tap Send.',
    parameters: { type: 'object', properties: { recipient: { type: 'string', description: 'The contact NAME (e.g. "מור"). Never a number.' }, message: { type: 'string', description: 'The FULL message text you composed, in Martita\'s voice, ready to send.' } }, required: ['recipient', 'message'], additionalProperties: false },
  },
  {
    type: 'function', name: 'phone_call',
    description: 'Show Martita a CARD with a contact\'s name and number and a Call button. It does NOT dial — only her tap on the card places the call. Pass the recipient as a NAME (resolved locally). Never claim a call was placed; tell her the card is ready and to tap Call.',
    parameters: { type: 'object', properties: { recipient: { type: 'string', description: 'The contact NAME. Never a number.' } }, required: ['recipient'], additionalProperties: false },
  },
  {
    type: 'function', name: 'cancel_communication',
    description: 'Cancel the pending WhatsApp/call preparation (Martita changed her mind).',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
] as const

export const LIVE_TOOL_NAMES: string[] = LIVE_TOOL_SCHEMAS.map((t) => t.name)
const COMM_TOOLS = new Set(['whatsapp_draft', 'phone_call', 'cancel_communication'])

function str(a: Record<string, unknown>, k: string): string | undefined {
  return typeof a[k] === 'string' && (a[k] as string).trim() ? (a[k] as string).trim() : undefined
}

export class LiveTools {
  private draft: CalendarDraft | null = null
  private comm: LiveCommDraft | null = null
  private committedApptId: string | null = null           // exactly-once commit guard
  private readonly handled = new Map<string, string>()      // call id → output JSON (dedup)
  private readonly inFlight = new Set<string>()

  constructor(
    private readonly send: SendEvent,
    private readonly store: LiveCalendarStore,
    private readonly cb: LiveToolsCallbacks = {},
  ) {}

  /** True for every tool this executor owns (everything except wait_for_user). */
  static owns(name: string): boolean { return LIVE_TOOL_NAMES.includes(name) }

  /** Handle a completed function-call EXACTLY ONCE. Sends the safe function_call_output
   *  and a response.create so the model speaks the grounded result. A duplicate of the
   *  same call id (a second completion shape, a retry) is a strict no-op — never a second
   *  output, never a second event. */
  handleFunctionCall(fc: ParsedFunctionCall): void {
    if (this.handled.has(fc.callId)) return                              // completed duplicate → no-op
    if (this.inFlight.has(fc.callId)) return                             // in-flight duplicate → drop
    this.inFlight.add(fc.callId)
    try {
      const output = this.dispatch(fc)
      const json = JSON.stringify(output)
      this.handled.set(fc.callId, json)
      this.reply(fc.callId, json)
    } finally {
      this.inFlight.delete(fc.callId)
    }
  }

  private reply(callId: string, outputJson: string): void {
    this.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output: outputJson } })
    this.send({ type: 'response.create' })
  }

  private dispatch(fc: ParsedFunctionCall): Record<string, unknown> {
    const args = safeArgs(fc.argsJson)
    if (fc.name === 'resolve_contact') return this.doResolve(args)
    if (fc.name === 'read_calendar') return this.doRead(args)
    if (fc.name === 'update_calendar_event') return this.doUpdate(args)
    if (isCalendarTool(fc.name)) return this.doCalendar(fc.name, args)
    if (COMM_TOOLS.has(fc.name)) return this.doComm(fc.name, args)
    return { error: 'unknown_tool' }
  }

  // ─── resolve_contact ───────────────────────────────────────────────────────
  private doResolve(args: Record<string, unknown>): Record<string, unknown> {
    const r = resolveContact(str(args, 'name') ?? '')
    if (r.status === 'resolved') return { status: 'resolved', id: r.id, label: r.label }
    if (r.status === 'ambiguous') {
      return {
        status: 'ambiguous',
        candidates: r.candidates.map((c) => ({ id: c.id, label: c.label })),
        allowed_to_say: ['ask which specific person she means', 'never guess a relative for a name'],
      }
    }
    return { status: 'not_found', allowed_to_say: ['say you do not have that person as a contact'] }
  }

  // ─── calendar ──────────────────────────────────────────────────────────────
  private doCalendar(name: string, args: Record<string, unknown>): Record<string, unknown> {
    const { outcome, receipt } = applyCalendarFunctionCall(this.draft, { name, args }, resolveCalendarParticipant)
    this.draft = outcome.draft
    this.cb.onCalendarDraft?.(this.draft)

    // Commit exactly once when a draft reaches CONFIRMED. EVERY field the draft holds
    // is carried through — title/date/time/participant/location/notes — so nothing the
    // model prepared is silently dropped on save (the device "location dropped" bug).
    if (this.draft && this.draft.confirmation === 'CONFIRMED' && !this.committedApptId) {
      const saved = this.store.add({
        title: this.draft.title ?? 'פגישה',
        date: this.draft.date ?? '',
        time: this.draft.time ?? '',
        ...(this.draft.participant ? { participant: this.draft.participant } : {}),
        ...(this.draft.location ? { location: this.draft.location } : {}),
        ...(this.draft.notes ? { notes: this.draft.notes } : {}),
      })
      if (saved) {
        this.committedApptId = saved.id
        this.cb.onCalendarSaved?.(saved)   // receipt card gets the ACTUAL persisted event
        return this.calendarOutput(receipt, { saved: true, event_id: saved.id })
      }
      // Persistence failed — be honest, do not claim it was saved.
      return this.calendarOutput(receipt, { saved: false, error: 'not_saved' })
    }
    // A repeat confirm on an already-committed draft: report the existing save, never a second event.
    if (this.draft && this.draft.confirmation === 'CONFIRMED' && this.committedApptId) {
      return this.calendarOutput(receipt, { saved: true, event_id: this.committedApptId, already: true })
    }
    if (this.draft && this.draft.confirmation === 'CANCELLED') this.committedApptId = null
    return this.calendarOutput(receipt, {})
  }

  private calendarOutput(r: CalendarReceipt, extra: Record<string, unknown>): Record<string, unknown> {
    return {
      confirmation: r.confirmation, revision: r.revision,
      participant: r.participant, unresolved_relationship: r.unresolvedRelationship,
      date: r.date, time: r.time, missing: r.missing,
      allowed_to_say: r.allowedClaims, rejected: r.rejected,
      ...extra,
    }
  }

  private doRead(args: Record<string, unknown>): Record<string, unknown> {
    const date = str(args, 'date')
    const all = this.store.list()
    const events = (date ? all.filter((e) => e.date === date) : all)
      .slice()
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .map((e) => ({
        title: e.title, date: e.date, time: e.time || null,
        participant: e.participant ?? null, location: e.location ?? null, notes: e.notes ?? null,
      }))
    return {
      count: events.length,
      date: date ?? null,
      events,
      allowed_to_say: events.length === 0
        ? [date ? 'nothing on that day' : 'the calendar is empty']
        : ['read back these events exactly as given, including the location if present'],
    }
  }

  // ─── update a SAVED event in place (no duplicate) ─────────────────────────────
  private doUpdate(args: Record<string, unknown>): Record<string, unknown> {
    const date = str(args, 'date')
    const field = str(args, 'field')
    const value = str(args, 'value')
    const titleContains = str(args, 'title_contains')
    const ALLOWED = new Set(['title', 'date', 'time', 'location', 'notes', 'participant'])
    if (!date || !field || value === undefined || !ALLOWED.has(field)) {
      return { status: 'error', error: 'bad_update_args', allowed_to_say: ['ask which event and what to change'] }
    }
    const matches = this.store.list().filter(
      (e) => e.date === date && (!titleContains || e.title.includes(titleContains)),
    )
    if (matches.length === 0) {
      return { status: 'not_found', allowed_to_say: ['say there is no saved event matching that day'] }
    }
    if (matches.length > 1) {
      return {
        status: 'ambiguous',
        candidates: matches.map((e) => ({ title: e.title, date: e.date, time: e.time || null })),
        allowed_to_say: ['ask which of these events she means'],
      }
    }
    const target = matches[0]!
    const updated = this.store.update(target.id, { [field]: value } as Partial<Omit<LiveEvent, 'id'>>)
    if (!updated) {
      return { status: 'not_saved', error: 'update_failed', allowed_to_say: ['be honest that the change did not save'] }
    }
    return {
      status: 'updated',
      event: {
        title: updated.title, date: updated.date, time: updated.time || null,
        participant: updated.participant ?? null, location: updated.location ?? null, notes: updated.notes ?? null,
      },
      allowed_to_say: ['confirm the change is saved, and read back the updated detail'],
    }
  }

  // ─── whatsapp / call (PREPARE only — never sends or dials) ────────────────────
  private doComm(name: string, args: Record<string, unknown>): Record<string, unknown> {
    if (name === 'cancel_communication') {
      this.comm = this.comm ? { ...this.comm, status: 'CANCELLED' } : null
      this.cb.onCommDraft?.(this.comm)
      return { status: 'cancelled', allowed_to_say: ['confirm you cancelled it'] }
    }
    const kind: LiveCommDraft['kind'] = name === 'phone_call' ? 'call' : 'message'
    const recipientSpoken = str(args, 'recipient') ?? ''
    const res = resolveContact(recipientSpoken)
    if (res.status !== 'resolved') {
      // Cannot reach an unresolved person — never guess. Ask (ambiguous) or say
      // there is no contact (not_found). No draft is created.
      return {
        status: res.status,
        candidates: res.status === 'ambiguous' ? res.candidates.map((c) => ({ id: c.id, label: c.label })) : undefined,
        allowed_to_say: res.status === 'ambiguous'
          ? ['ask which specific person she means', 'never guess a relative']
          : ['say you do not have that person as a contact'],
      }
    }
    this.comm = {
      kind,
      recipientId: res.id,
      recipientLabel: contactLabel(res.id) ?? res.label,
      intent: kind === 'message' ? (str(args, 'message') ?? '') : null,
      status: kind === 'call' ? 'READY_TO_CALL' : 'READY_TO_SEND',
    }
    this.cb.onCommDraft?.(this.comm)
    return {
      status: this.comm.status,      // only ever a preparation status — never "sent"/"dialed"
      kind: this.comm.kind,
      recipient: this.comm.recipientLabel,
      allowed_to_say: kind === 'call'
        ? ['say the call is ready for her to place — she taps to dial', 'never say you called']
        : ['say the message is ready for her to review and send', 'never say you sent it'],
    }
  }

  // ─── views (tests / UI) ──────────────────────────────────────────────────────
  viewCalendarDraft(): CalendarDraft | null { return this.draft }
  viewCommDraft(): LiveCommDraft | null { return this.comm }
  committedEventId(): string | null { return this.committedApptId }
}

function safeArgs(argsJson: string): Record<string, unknown> {
  try { const v = JSON.parse(argsJson || '{}'); return v && typeof v === 'object' ? v as Record<string, unknown> : {} }
  catch { return {} }
}

// ─── Production calendar store (durable, read-after-write) ────────────────────
/** Wire the live path to the real durable calendar store. Reuses AbuCalendar's
 *  load/save kernels (durable write-through + localStorage mirror), so an event
 *  saved here is immediately readable, and survives reload/reconnect. service.ts
 *  is pure logic (no UI imports), safe to pull into the isolated live path. */
export function durableCalendarStore(): LiveCalendarStore {
  const toLiveEvent = (a: Appointment): LiveEvent => ({
    id: a.id, title: a.title, date: a.date, time: a.time,
    ...(a.personName ? { participant: a.personName } : {}),
    ...(a.location ? { location: a.location } : {}),
    ...(a.notes ? { notes: a.notes } : {}),
  })
  return {
    list(): LiveEvent[] {
      return loadAppointments().map(toLiveEvent)
    },
    add(e): LiveEvent | null {
      const appts = loadAppointments()
      const id = `live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const appt: Appointment = {
        id,
        title: e.title,
        date: e.date,
        time: e.time,
        emoji: detectEmoji(`${e.title} ${e.participant ?? ''} ${e.location ?? ''}`),
        color: '#4ECDC4',
        ...(e.participant ? { personName: e.participant } : {}),
        ...(e.location ? { location: e.location } : {}),
        ...(e.notes ? { notes: e.notes } : {}),
      }
      saveAppointments([...appts, appt])
      // Round-trip verify against the same store (never a false "saved").
      const back = loadAppointments().find((a) => a.id === id)
      return back ? toLiveEvent(back) : null
    },
    update(id, patch): LiveEvent | null {
      // Translate LiveEvent fields → Appointment fields (participant → personName).
      const apptPatch: Partial<Appointment> = {}
      if (patch.title !== undefined) apptPatch.title = patch.title
      if (patch.date !== undefined) apptPatch.date = patch.date
      if (patch.time !== undefined) apptPatch.time = patch.time
      if (patch.location !== undefined) apptPatch.location = patch.location
      if (patch.notes !== undefined) apptPatch.notes = patch.notes
      if (patch.participant !== undefined) apptPatch.personName = patch.participant
      updateAppointment(id, apptPatch)
      // Round-trip verify the change actually persisted.
      const back = loadAppointments().find((a) => a.id === id)
      return back ? toLiveEvent(back) : null
    },
  }
}

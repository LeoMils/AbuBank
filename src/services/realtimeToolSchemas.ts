/*
 * REALTIME FUNCTION-TOOL SCHEMAS (ADR-0001 §12) — what the live model may REQUEST.
 * ════════════════════════════════════════════════════════════════════════════════
 * Declared in session.update → session.tools when the realtime2 slice is enabled.
 * The model may REQUEST a communication action; it may never decide or complete one.
 *
 * PRIVACY BY CONSTRUCTION: no tool parameter is or contains a phone number — the
 * recipient is always a NAME, resolved to a number locally inside the kernel. The
 * descriptions instruct the model to pass a name, never a number, and never to claim
 * a message was sent or a call was placed (Abu only ever PREPARES a handoff).
 */

export interface RealtimeFunctionTool {
  type: 'function'
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description: string; enum?: string[] }>
    required: string[]
    additionalProperties: false
  }
}

const RECIPIENT_PROP = {
  type: 'string',
  description: 'The contact NAME to reach (e.g. "מור"). NEVER a phone number — numbers are resolved locally.',
} as const

export const REALTIME_COMM_TOOLS: RealtimeFunctionTool[] = [
  {
    type: 'function',
    name: 'prepare_whatsapp',
    description: 'Prepare (do NOT send) a WhatsApp message to a contact by NAME. Opens a reviewable draft; the user taps Send. Never claim the message was sent.',
    parameters: {
      type: 'object',
      properties: {
        recipient: RECIPIENT_PROP,
        intent: { type: 'string', description: 'What the user wants to say, in her words. No phone numbers.' },
      },
      required: ['recipient', 'intent'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'prepare_call',
    description: 'Prepare (do NOT dial) a phone call to a contact by NAME. Opens the dialer; the user confirms. Never claim a call was placed.',
    parameters: {
      type: 'object',
      properties: { recipient: RECIPIENT_PROP },
      required: ['recipient'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'replace_active_action',
    description: 'Atomically replace the current pending communication action with a new one (e.g. switch from a WhatsApp message to a call). Use when the user changes her mind ("no, call him instead").',
    parameters: {
      type: 'object',
      properties: {
        kind: { type: 'string', description: 'The new action kind.', enum: ['call', 'message'] },
        recipient: { type: 'string', description: 'Optional new contact NAME; omit to keep the current recipient. Never a number.' },
      },
      required: ['kind'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'cancel_active_action',
    description: 'Cancel the current pending communication action (the user no longer wants to send/call).',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
]

export const REALTIME_TOOL_NAMES = REALTIME_COMM_TOOLS.map((t) => t.name)
export function isRealtimeToolName(name: string): boolean { return REALTIME_TOOL_NAMES.includes(name) }

// ─── Calendar tools (ADR-0001 §12) — the model REQUESTS a typed draft operation; it
// never commits Calendar truth. Dates must be REAL YYYY-MM-DD (resolved upstream),
// never a relative word ("מחר"); a participant is a NAME, never guessed.
const DATE_PROP = { type: 'string', description: 'A REAL calendar date as YYYY-MM-DD (already resolved — never "מחר"/"tomorrow").' } as const
export const REALTIME_CALENDAR_TOOLS: RealtimeFunctionTool[] = [
  {
    type: 'function', name: 'prepare_calendar_event',
    description: 'Prepare (do NOT commit) a calendar event draft. Opens a reviewable draft; the user confirms. Never claim it was saved.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'What the event is (e.g. "רופא שיניים").' },
        date: DATE_PROP,
        time: { type: 'string', description: 'HH:MM 24h, optional.' },
        participant: { type: 'string', description: 'A person NAME, optional. Never guess an unresolved relationship.' },
        location: { type: 'string', description: 'Optional location.' },
        notes: { type: 'string', description: 'Optional notes.' },
      },
      required: ['title', 'date'], additionalProperties: false,
    },
  },
  {
    type: 'function', name: 'correct_calendar_field',
    description: 'Correct ONE field of the pending calendar draft (e.g. change the time). Preserves every unrelated field.',
    parameters: {
      type: 'object',
      properties: {
        field: { type: 'string', description: 'Which field to correct.', enum: ['title', 'date', 'time', 'location', 'notes', 'durationMin'] },
        value: { type: 'string', description: 'The new value for that field.' },
        participant: { type: 'string', description: 'Optional: set the participant NAME instead of a scalar field.' },
      },
      required: [], additionalProperties: false,
    },
  },
  {
    type: 'function', name: 'confirm_calendar_event',
    description: 'Confirm the pending calendar draft at the revision the user just heard. A stale revision is rejected.',
    parameters: { type: 'object', properties: { forRevision: { type: 'number', description: 'The draft revision the user is confirming.' } }, required: ['forRevision'], additionalProperties: false },
  },
  {
    type: 'function', name: 'cancel_calendar_event',
    description: 'Cancel the pending calendar draft (the user no longer wants the event).',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
]

export const REALTIME_CALENDAR_TOOL_NAMES = REALTIME_CALENDAR_TOOLS.map((t) => t.name)
export function isCalendarToolName(name: string): boolean { return REALTIME_CALENDAR_TOOL_NAMES.includes(name) }
/** The full slice tool set declared to the live session when both authorities are wired. */
export const REALTIME_SLICE_TOOLS: RealtimeFunctionTool[] = [...REALTIME_COMM_TOOLS, ...REALTIME_CALENDAR_TOOLS]

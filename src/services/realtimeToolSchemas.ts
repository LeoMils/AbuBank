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

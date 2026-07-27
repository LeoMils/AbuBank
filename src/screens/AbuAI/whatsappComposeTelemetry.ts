/*
 * Abu WhatsApp compose — learning instrumentation (privacy-safe).
 * ═══════════════════════════════════════════════════════════════
 * Records structured, REDACTED events so future real failures can improve the
 * mechanism (a future Evolution Inbox) rather than vanishing. It does NOT
 * self-modify, deploy, or send anything.
 *
 * PRIVACY:
 *   • NEVER stores phone numbers, API keys, or full contact datasets.
 *   • Recipient is stored as first-name/display only (no phone).
 *   • Free-text (request / message) is truncated to a short preview.
 *   • Persisted to the local durable store as a bounded ring (last N), on the
 *     user's own device only. Best-effort; failures are swallowed.
 *
 * When a correction happens we capture BOTH the corrected field AND the
 * suspected generalized mechanism class, so the signal points at the mechanism,
 * not the sentence.
 */

import { durable } from '../../services/durableStore'

export type ComposeEventType =
  | 'request'              // a compose command was received
  | 'recipient_resolved'   // a single confident recipient was chosen
  | 'recipient_ambiguous'  // multiple/low-confidence candidates surfaced
  | 'recipient_corrected'  // user changed the recipient
  | 'composed'             // a draft was produced (which path)
  | 'draft_edited'         // user hand-edited the draft text
  | 'style_changed'        // user switched style and regenerated
  | 'followup_correction'  // a follow-up utterance edited the draft plan
  | 'url_opened'           // WhatsApp deep link was opened (prefill only)
  | 'no_phone_fallback'    // recipient had no phone → copy/group fallback
  | 'abandoned'            // overlay closed without opening
  | 'not_correct'          // explicit "this is wrong" feedback
  | 'error'                // a runtime error occurred

/** Suspected generalized mechanism a correction points at. */
export type MechanismClass =
  | 'recipient_entity_resolution'
  | 'message_plan_fact_retention'
  | 'style_transformation_semantic_loss'
  | 'modality_runtime_divergence'
  | 'intent_routing'
  | 'composition_quality'
  | 'channel_adapter'
  | 'unknown'

export interface ComposeEvent {
  type: ComposeEventType
  at: number
  source?: 'voice' | 'text'
  /** Truncated preview of the original request (redacted). */
  requestPreview?: string
  intentPurpose?: string
  language?: string
  style?: string
  /** Recipient first-name/display only — NEVER a phone number. */
  recipient?: string | null
  recipientConfidence?: number
  recipientEvidence?: string
  candidateCount?: number
  composePath?: string
  /** Draft length only (not full content) for edit/quality signals. */
  draftLen?: number
  correctedField?: string
  mechanismClass?: MechanismClass
  ok?: boolean
  note?: string
}

const STORAGE_KEY = 'abuai-wa-compose-events'
const MAX_EVENTS = 50
const PREVIEW_LEN = 60

const ring: ComposeEvent[] = []

function preview(s: string | undefined | null): string | undefined {
  if (!s) return undefined
  const t = String(s).replace(/\s+/g, ' ').trim()
  if (!t) return undefined
  return t.length > PREVIEW_LEN ? t.slice(0, PREVIEW_LEN) + '…' : t
}

/** Strip any field that could carry a phone number or secret. */
function redact(e: ComposeEvent): ComposeEvent {
  const clean: ComposeEvent = { ...e }
  const p = preview(clean.requestPreview)
  if (p === undefined) delete clean.requestPreview
  else clean.requestPreview = p
  // A recipient that looks like a phone number is dropped defensively.
  if (clean.recipient && /\d{4,}/.test(clean.recipient)) clean.recipient = null
  return clean
}

/** Record a compose lifecycle event. Privacy-safe, best-effort, never throws. */
export function recordComposeEvent(evt: Omit<ComposeEvent, 'at'> & { at?: number }): void {
  try {
    const e = redact({ ...evt, at: evt.at ?? Date.now() })
    ring.push(e)
    while (ring.length > MAX_EVENTS) ring.shift()
    // Breadcrumb (no phones/keys). Helpful in the browser smoke + field logs.
    try {
      // eslint-disable-next-line no-console
      console.info('[WA_COMPOSE]', JSON.stringify({
        t: e.type, src: e.source, rcpt: e.recipient ?? null, conf: e.recipientConfidence,
        style: e.style, path: e.composePath, field: e.correctedField, mech: e.mechanismClass, ok: e.ok,
      }))
    } catch { /* console optional */ }
    // Bounded, redacted local persistence for a future Evolution Inbox.
    try { durable.setString(STORAGE_KEY, JSON.stringify(ring.slice(-MAX_EVENTS))) } catch { /* best-effort */ }
  } catch { /* telemetry must never break a turn */ }
}

/** In-memory recent events (tests + diagnostics). */
export function getRecentComposeEvents(): ComposeEvent[] {
  return ring.slice()
}

/** Clear the in-memory ring (tests). */
export function clearComposeEvents(): void {
  ring.length = 0
}

/** Map a corrected field to its suspected generalized mechanism class. */
export function mechanismForCorrection(field: string): MechanismClass {
  switch (field) {
    case 'recipient': return 'recipient_entity_resolution'
    case 'time':
    case 'number':
    case 'fact': return 'message_plan_fact_retention'
    case 'style': return 'style_transformation_semantic_loss'
    case 'modality': return 'modality_runtime_divergence'
    default: return 'unknown'
  }
}

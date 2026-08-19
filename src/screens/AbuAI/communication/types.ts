/*
 * Communication Capability — channel-agnostic types.
 * ══════════════════════════════════════════════════
 * When AbuAI decides the user's final intent is "communicate", the capability
 * returns a CommunicationAction: a verified, reviewable handoff the chat UI
 * renders GENERICALLY. WhatsApp is the first ChannelAdapter; SMS / Email /
 * Telegram plug in the same way WITHOUT touching the cognitive controller.
 *
 * The Action is PURE DATA (no functions, no phone numbers) so it can flow
 * through the runtime result into a chat message and be rendered anywhere. The
 * actual "open the conversation" step is performed by the live ChannelAdapter,
 * looked up by id at press time.
 */

export type CommunicationChannel = 'whatsapp' | 'phone' | 'sms' | 'email' | 'telegram'

export interface CommunicationRecipient {
  /** Display name (e.g. Hebrew "מור"). */
  name: string
  /** True when the adapter can open a real conversation for this recipient
   *  (e.g. a phone/handle is configured on this device). */
  canHandoff: boolean
  /** 0..1 confidence that this is the right recipient. */
  confidence: number
}

export interface CommunicationDraft {
  /** The reviewed message body. What "Open …" prefills — never altered by handoff. */
  text: string
  style: string
  language: string
}

export interface CommunicationVerification {
  ok: boolean
  issues: string[]
  /** Required facts (numbers/times/urls) that did not survive composition. */
  missingFacts: string[]
}

/**
 * The recommended communication handoff. `action: 'handoff'` → render the draft
 * + single primary action. `action: 'clarify'` → the capability needs more
 * (recipient / message); render `clarify.prompt` as a normal question.
 */
export interface CommunicationAction {
  capability: 'communication'
  action: 'handoff' | 'clarify'
  channel: CommunicationChannel
  /** Adapter id used to perform the handoff (looked up in the registry). */
  adapter: string
  /** Localized label for the single primary action, e.g. "פתחי בוואטסאפ". */
  primaryActionLabel: string
  recipient: CommunicationRecipient
  draft: CommunicationDraft
  verification: CommunicationVerification
  clarify?: { field: 'recipient' | 'intent'; prompt: string }
  /** 'message' → compose+handoff a message; 'call' → open a phone call (no body). */
  mode: 'message' | 'call'
  /** True only when Martita explicitly asked to review/edit the draft in AbuAI.
   *  Default flow shows just the primary action; WhatsApp is the review surface. */
  review?: boolean
}

/**
 * A channel adapter. Channel-SPECIFIC (WhatsApp/SMS/Email/…) and lives in its
 * own domain, but conforms to this one interface so the capability + UI treat
 * every channel identically. Adapters hold NO composition logic — only recipient
 * resolution and the deep-link/handoff (open conversation, prefill, NEVER send).
 */
export interface ChannelAdapter {
  id: string
  channel: CommunicationChannel
  /** Primary-action label shown on the card. */
  primaryActionLabel: string
  /** Resolve a spoken/typed name to a channel recipient, or null if unknown. */
  resolveRecipient(name: string): { canHandoff: boolean; confidence: number } | null
  /**
   * Build the handoff that OPENS the conversation with `draftText` PRE-FILLED.
   * MUST NOT auto-send and MUST NOT alter the text. Returns url=null with a
   * reason when the recipient cannot be handed off (e.g. no number saved).
   */
  buildHandoff(name: string, draftText: string): { url: string | null; reason: string | null }
}

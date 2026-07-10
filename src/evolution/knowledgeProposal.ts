/*
 * Evolution OS — knowledge correction pipeline (Sections 4 L1, 20)
 * ════════════════════════════════════════════════════════════════
 * Knowledge correction is SEPARATE from software repair. When Martita says
 * "Yarden is Eili's wife", that one sentence may produce SEVERAL distinct
 * artifacts — a scoped knowledge proposal, a provenance record, a conflict check,
 * an authorization check, and possibly a product-failure event. It must NEVER be
 * reduced to a silent `Yarden.spouse = Eili`.
 *
 * THE LAW: a user correction is EVIDENCE, not automatically truth. Conflicts with
 * trusted knowledge are QUARANTINED or sent for confirmation — never silently
 * overwritten. Private household knowledge never becomes a global behavioral rule,
 * and one person's preference never becomes another's.
 *
 * This module produces PROPOSALS ONLY. It never writes production knowledge
 * (`knowledge/*` / `memory/*` stay untouched — those are human/skill-gated).
 */

export type KnowledgeScope = 'session' | 'personal' | 'household' | 'global'
export type ConflictStatus = 'none' | 'conflict' | 'quarantined' | 'confirmed'
export type AuthorizationStatus = 'authorized' | 'unauthorized' | 'unknown'
export type ProposalConfidence = 'high' | 'medium' | 'low' | 'unknown'

export interface KnowledgeProposal {
  proposalId: string
  subject: string                 // the entity the fact is ABOUT (e.g. "Yarden")
  predicate: string               // relationship/attribute (e.g. "spouse")
  object: string                  // value (e.g. "Eili")
  scope: KnowledgeScope
  source: string                  // where it came from (e.g. "conversation:turn-123")
  proposer?: string               // who asserted it, when known
  timestamp: string
  confidence: ProposalConfidence
  provenance: { traceId?: string; turnId?: string; utterance: string }
  effectiveDate?: string
  expiryDate?: string
  conflictStatus: ConflictStatus
  authorizationStatus: AuthorizationStatus
  previousValue?: string          // NEVER discarded — the value we would replace
  rollbackHistory: Array<{ at: string; from?: string; to: string; actor: string }>
  /** When true, this proposal must NOT be applied automatically — a human confirms. */
  requiresConfirmation: boolean
  notes?: string[]
}

export interface KnownFact { subject: string; predicate: string; object: string; trusted: boolean }

export interface CorrectionInput {
  proposalId: string
  subject: string
  predicate: string
  object: string
  utterance: string
  timestamp: string
  proposer?: string
  traceId?: string
  turnId?: string
  /** true if this correction targets someone OTHER than the speaker's own record. */
  targetsOtherPerson?: boolean
  /** true if the correction is framed as temporary ("just for today"). */
  temporary?: boolean
  /** true if the utterance looks like a joke/sarcasm (upstream detector). */
  jokeSuspected?: boolean
}

/**
 * Turn a detected correction into a scoped proposal. Defaults are conservative:
 * personal scope, medium confidence, requires confirmation unless clearly safe.
 * Never global unless explicitly authorized elsewhere (never here).
 */
export function proposeFromCorrection(input: CorrectionInput, existing: KnownFact[]): KnowledgeProposal {
  const notes: string[] = []
  const match = existing.find(f => f.subject === input.subject && f.predicate === input.predicate)

  let conflictStatus: ConflictStatus = 'none'
  let confidence: ProposalConfidence = 'medium'
  let requiresConfirmation = true

  if (match && match.object !== input.object) {
    // Conflict with an existing value. If the existing value is TRUSTED, quarantine —
    // do not overwrite. If untrusted, it is a plain conflict pending confirmation.
    conflictStatus = match.trusted ? 'quarantined' : 'conflict'
    confidence = match.trusted ? 'low' : 'medium'
    notes.push(match.trusted
      ? `conflicts with TRUSTED existing value "${match.object}" → quarantined, not applied`
      : `conflicts with existing value "${match.object}" → needs confirmation`)
  } else if (match && match.object === input.object) {
    conflictStatus = 'confirmed'
    confidence = 'high'
    requiresConfirmation = false
    notes.push('agrees with existing value → corroboration')
  }

  if (input.jokeSuspected) { confidence = 'low'; requiresConfirmation = true; notes.push('utterance may be a joke/sarcasm — held for confirmation') }

  const authorizationStatus: AuthorizationStatus =
    input.targetsOtherPerson ? 'unknown' : 'authorized'
  if (input.targetsOtherPerson) notes.push('correction targets another person — authorization unverified')

  const scope: KnowledgeScope = input.temporary ? 'session' : 'personal'
  if (input.temporary) notes.push('framed as temporary → session scope only, expires with session')

  return {
    proposalId: input.proposalId,
    subject: input.subject, predicate: input.predicate, object: input.object,
    scope, source: input.turnId ? `conversation:${input.turnId}` : 'conversation',
    ...(input.proposer ? { proposer: input.proposer } : {}),
    timestamp: input.timestamp, confidence,
    provenance: { ...(input.traceId ? { traceId: input.traceId } : {}), ...(input.turnId ? { turnId: input.turnId } : {}), utterance: input.utterance },
    ...(input.temporary ? { effectiveDate: input.timestamp } : {}),
    conflictStatus,
    authorizationStatus,
    ...(match?.object ? { previousValue: match.object } : {}),
    rollbackHistory: [],
    requiresConfirmation: requiresConfirmation || conflictStatus === 'quarantined' || authorizationStatus !== 'authorized',
    notes,
  }
}

/** A proposal may be auto-applied ONLY when it is non-conflicting, authorized,
 *  confident, and does not require confirmation. Everything else waits for a human. */
export function mayAutoApply(p: KnowledgeProposal): boolean {
  return !p.requiresConfirmation
    && p.conflictStatus !== 'quarantined'
    && p.conflictStatus !== 'conflict'
    && p.authorizationStatus === 'authorized'
    && (p.confidence === 'high')
    && p.scope !== 'global'
}

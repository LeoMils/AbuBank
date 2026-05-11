/*
 * AbuAI Evidence Packet (B2.2)
 *
 * The Answer Compiler consumes EvidencePackets — a structured envelope
 * for "what did the tool actually return?". Personal/current factual
 * answers MUST originate from a packet whose `kind` is not `'none'` and
 * whose `facts` is non-empty. Open conversation may use `kind: 'open'`.
 *
 * This module is pure — it just defines the shape and tiny constructors.
 */

export type EvidenceKind =
  | 'calendar'
  | 'family'
  | 'contacts'
  | 'weather'
  | 'online'
  | 'none'
  | 'tool_error'
  | 'open'

export type EvidenceConfidence = 'high' | 'medium' | 'low'

export interface EvidenceSource {
  title: string
  url?: string
}

export interface EvidencePacket {
  kind: EvidenceKind
  sourceName: string
  checkedAt?: string
  facts: string[]
  sources?: EvidenceSource[]
  confidence: EvidenceConfidence
  error?: string
}

// ─── Constructors ──────────────────────────────────────────────────────────

export function makeOpenEvidence(sourceName = 'open_conversation'): EvidencePacket {
  return { kind: 'open', sourceName, facts: [], confidence: 'medium' }
}

export function makeNoEvidence(sourceName: string): EvidencePacket {
  return { kind: 'none', sourceName, facts: [], confidence: 'low' }
}

export function makeToolErrorEvidence(sourceName: string, error: string): EvidencePacket {
  return { kind: 'tool_error', sourceName, facts: [], confidence: 'low', error }
}

export function makeCalendarEvidence(facts: string[], opts?: { checkedAt?: string; confidence?: EvidenceConfidence }): EvidencePacket {
  return {
    kind: 'calendar',
    sourceName: 'local-calendar',
    facts,
    confidence: opts?.confidence ?? 'high',
    ...(opts?.checkedAt ? { checkedAt: opts.checkedAt } : {}),
  }
}

export function makeFamilyEvidence(facts: string[], opts?: { confidence?: EvidenceConfidence }): EvidencePacket {
  return {
    kind: 'family',
    sourceName: 'family-data',
    facts,
    confidence: opts?.confidence ?? 'high',
  }
}

export function makeContactsEvidence(facts: string[]): EvidencePacket {
  return { kind: 'contacts', sourceName: 'local-contacts', facts, confidence: 'high' }
}

export function makeWeatherEvidence(facts: string[], sources?: EvidenceSource[], checkedAt?: string): EvidencePacket {
  return {
    kind: 'weather',
    sourceName: 'weather-api',
    facts,
    confidence: 'medium',
    ...(sources && sources.length > 0 ? { sources } : {}),
    ...(checkedAt ? { checkedAt } : {}),
  }
}

export function makeOnlineEvidence(facts: string[], sources?: EvidenceSource[], checkedAt?: string): EvidencePacket {
  return {
    kind: 'online',
    sourceName: 'online-search',
    facts,
    confidence: 'medium',
    ...(sources && sources.length > 0 ? { sources } : {}),
    ...(checkedAt ? { checkedAt } : {}),
  }
}

// ─── Predicates ────────────────────────────────────────────────────────────

/** True when the packet contains at least one supporting fact. */
export function hasFacts(packet: EvidencePacket): boolean {
  return packet.facts.length > 0
}

/** True when the packet represents a real failure that must be surfaced. */
export function isToolFailure(packet: EvidencePacket): boolean {
  return packet.kind === 'tool_error'
}

/** True when the packet may carry verifiable sources. */
export function hasSources(packet: EvidencePacket): boolean {
  return Array.isArray(packet.sources) && packet.sources.length > 0
}

/**
 * Personal/current factual answers MUST be backed by evidence. This
 * helper centralises the contract so the Answer Compiler can refuse
 * to invent.
 */
export function requiresEvidence(kind: EvidenceKind): boolean {
  switch (kind) {
    case 'calendar':
    case 'family':
    case 'contacts':
    case 'weather':
    case 'online':
      return true
    case 'open':
    case 'none':
    case 'tool_error':
    default:
      return false
  }
}

/*
 * AbuWhatsApp local family contacts storage.
 *
 * Real per-person phone numbers and photos for AbuWhatsApp live ONLY in this
 * device's localStorage — never in source, never in the bundle, never in
 * memory/*, never in knowledge/*, never in AbuAI prompts. The Family Bubble
 * Board UI reads scaffold names/relationships from familyContacts.private.ts
 * and merges per-person phone/photo/enabled values from this storage layer.
 *
 * Operator setup is the only UI path that writes to this storage.
 */

import { isValidPhoneE164, normalizeIsraeliPhone } from './familyQuickFaces'
import { FAMILY_QUICK_FACES } from './familyContacts.private'
import { durable } from '../../services/durableStore'

export const LOCAL_FAMILY_CONTACTS_STORAGE_KEY = 'abubank.familyContacts.v1'

/**
 * On-disk schema version for the contacts payload.
 *  - v1 (legacy): a bare JSON array of LocalFamilyContact.
 *  - v2 (current): an envelope `{ v: 2, contacts: LocalFamilyContact[] }`.
 * Reads accept BOTH shapes (back-compat); writes always emit the current
 * envelope. `migrateContactsFormat()` upgrades a legacy value in place. The
 * localStorage KEY name is deliberately unchanged so existing devices keep
 * their data and every privacy/scaffold contract still points at the same key.
 */
export const CONTACTS_SCHEMA_VERSION = 2

export interface ContactsEnvelope {
  v: number
  contacts: LocalFamilyContact[]
}

/**
 * The only contact ids the operator may save/import — every scaffold person
 * plus the family group. A typo'd id ("morr") would otherwise sit in
 * localStorage forever and never render (the runtime merge only iterates the
 * scaffold), so we reject unknown ids at the import/save boundary instead of
 * swallowing them silently.
 */
export const KNOWN_CONTACT_IDS: ReadonlySet<string> = new Set(
  FAMILY_QUICK_FACES.map((f) => f.id),
)

export function isKnownContactId(id: string): boolean {
  return KNOWN_CONTACT_IDS.has(id)
}

/**
 * Accepted id aliases → canonical scaffold id. The JSON import is a stable
 * contract: the operator writes the family's own spelling, not our internal
 * romanization. These mirror the `aliases` field of the canonical family graph
 * (knowledge/family_data.json) — e.g. "Rafi" is a documented alias of canonical
 * "Raphi". Resolution happens at the import/save boundary so the STORED id is
 * always canonical and the runtime bubble merge (which iterates scaffold ids)
 * still renders the person.
 */
export const CONTACT_ID_ALIASES: Readonly<Record<string, string>> = {
  rafi: 'raphi', // רפי — ex-son-in-law; canonical scaffold id is "raphi"
}

/**
 * Canonicalize an incoming contact id: trim + lower-case for tolerance, then map
 * a known alias to its stable scaffold id. Unknown ids pass through unchanged so
 * the caller still reports them as unknown.
 */
export function resolveContactId(id: string): string {
  const key = String(id ?? '').trim().toLowerCase()
  return CONTACT_ID_ALIASES[key] ?? key
}

export interface LocalFamilyContact {
  id: string
  enabled: boolean
  phoneE164: string
  whatsappE164?: string
  photoFile?: string
  photoDataUrl?: string
}

export interface ImportResult {
  ok: boolean
  errors: string[]
  contacts: LocalFamilyContact[]
}

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function defaultStorage(): StorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage
  } catch { /* localStorage may throw in private mode */ }
  return null
}

export function isLocalFamilyContactShape(value: unknown): value is LocalFamilyContact {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (typeof v.id !== 'string' || v.id.length === 0) return false
  if (typeof v.enabled !== 'boolean') return false
  if (typeof v.phoneE164 !== 'string') return false
  if (v.whatsappE164 !== undefined && typeof v.whatsappE164 !== 'string') return false
  if (v.photoFile !== undefined && typeof v.photoFile !== 'string') return false
  if (v.photoDataUrl !== undefined && typeof v.photoDataUrl !== 'string') return false
  return true
}

/** Diagnostics for a single read — used by recovery, migration, and tests. */
export interface ContactsReadDiagnostics {
  contacts: LocalFamilyContact[]
  /** 2 = current envelope, 1 = legacy bare array, 0 = empty/corrupt. */
  version: number
  /** true if some entries were dropped as invalid (partial salvage). */
  recovered: boolean
  /** number of invalid entries dropped. */
  dropped: number
  /** true if the raw value could not be parsed at all (unsalvageable). */
  corrupt: boolean
}

/**
 * Parse a raw storage string into contacts, tolerating BOTH the legacy bare
 * array (v1) and the current envelope (v2). Never throws: corruption yields an
 * empty, flagged result so callers can recover instead of losing everything.
 */
export function parseContactsPayload(raw: string | null): ContactsReadDiagnostics {
  if (raw === null || raw === '') return { contacts: [], version: 0, recovered: false, dropped: 0, corrupt: false }
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return { contacts: [], version: 0, recovered: false, dropped: 0, corrupt: true } }
  // Legacy v1: bare array of contacts.
  if (Array.isArray(parsed)) {
    const contacts = parsed.filter(isLocalFamilyContactShape)
    const dropped = parsed.length - contacts.length
    return { contacts, version: 1, recovered: dropped > 0, dropped, corrupt: false }
  }
  // v2+: { v, contacts: [...] }.
  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as ContactsEnvelope).contacts)) {
    const env = parsed as ContactsEnvelope
    const arr = env.contacts as unknown[]
    const contacts = arr.filter(isLocalFamilyContactShape)
    const dropped = arr.length - contacts.length
    const version = typeof env.v === 'number' && env.v > 0 ? env.v : CONTACTS_SCHEMA_VERSION
    return { contacts, version, recovered: dropped > 0, dropped, corrupt: false }
  }
  // Some other object shape — nothing salvageable.
  return { contacts: [], version: 0, recovered: false, dropped: 0, corrupt: true }
}

/**
 * Read the raw storage string, preferring the durable IndexedDB mirror when it
 * holds data the (possibly evicted) localStorage no longer does. This is the
 * recovery path: Safari ITP can wipe localStorage, but `durable.init()` at app
 * start rehydrates it from IndexedDB — and even mid-session the durable cache
 * is a second copy. Only consulted for the real browser storage; injected test
 * storage stays hermetic.
 */
function readRawWithDurableFallback(storage: StorageLike): string | null {
  let raw: string | null = null
  try { raw = storage.getItem(LOCAL_FAMILY_CONTACTS_STORAGE_KEY) } catch { raw = null }
  if (raw !== null && raw !== '') return raw
  if (isDefaultBrowserStorage(storage)) {
    const durableRaw = durable.getString(LOCAL_FAMILY_CONTACTS_STORAGE_KEY)
    if (durableRaw !== null && durableRaw !== '') return durableRaw
  }
  return raw
}

export function readContactsWithDiagnostics(storage: StorageLike | null = defaultStorage()): ContactsReadDiagnostics {
  if (!storage) return { contacts: [], version: 0, recovered: false, dropped: 0, corrupt: false }
  return parseContactsPayload(readRawWithDurableFallback(storage))
}

export function getLocalContacts(storage: StorageLike | null = defaultStorage()): LocalFamilyContact[] {
  if (!storage) return []
  return parseContactsPayload(readRawWithDurableFallback(storage)).contacts
}

export function setLocalContacts(contacts: LocalFamilyContact[], storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return
  const envelope: ContactsEnvelope = { v: CONTACTS_SCHEMA_VERSION, contacts }
  const json = JSON.stringify(envelope)
  try { storage.setItem(LOCAL_FAMILY_CONTACTS_STORAGE_KEY, json) } catch { /* quota / private mode */ }
  // Keep the durable IndexedDB backend current so contacts survive localStorage
  // eviction AND so `durable.init()` never clobbers a fresh edit with a stale
  // backend copy on the next app start.
  if (isDefaultBrowserStorage(storage)) {
    try { durable.setString(LOCAL_FAMILY_CONTACTS_STORAGE_KEY, json) } catch { /* best-effort */ }
  }
}

export function clearLocalContacts(storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return
  try { storage.removeItem(LOCAL_FAMILY_CONTACTS_STORAGE_KEY) } catch { /* private mode */ }
  if (isDefaultBrowserStorage(storage)) {
    try { durable.remove(LOCAL_FAMILY_CONTACTS_STORAGE_KEY) } catch { /* best-effort */ }
  }
}

/**
 * True when `storage` is the real browser localStorage (the default runtime
 * path), NOT an injected fake. Guards the durable-backend mirror so unit tests
 * that pass their own StorageLike stay hermetic and local-only.
 */
function isDefaultBrowserStorage(storage: StorageLike): boolean {
  try { return typeof window !== 'undefined' && storage === window.localStorage } catch { return false }
}

/**
 * Per-contact save: validates shape and (when enabled) E.164, then writes
 * the contact into the existing list keyed by id (replacing if it already
 * exists). Returns ok/errors so the operator UI can render Hebrew feedback.
 */
export interface SaveResult {
  ok: boolean
  errors: string[]
}

export function upsertLocalContact(contact: LocalFamilyContact, storage: StorageLike | null = defaultStorage()): SaveResult {
  const errors: string[] = []
  // Canonicalize the id (alias → stable id) and normalize Israeli numbers.
  contact = { ...contact, id: resolveContactId(contact.id), phoneE164: normalizeIsraeliPhone(contact.phoneE164) }
  if (contact.whatsappE164) contact = { ...contact, whatsappE164: normalizeIsraeliPhone(contact.whatsappE164) }
  if (!isLocalFamilyContactShape(contact)) errors.push('invalid contact shape')
  if (!isKnownContactId(contact.id)) errors.push(`unknown contact id "${contact.id}"`)
  if (contact.enabled && !isValidPhoneE164(contact.phoneE164)) errors.push('phoneE164 fails E.164 validation')
  if (contact.whatsappE164 !== undefined && contact.whatsappE164.length > 0 && !isValidPhoneE164(contact.whatsappE164)) {
    errors.push('whatsappE164 fails E.164 validation')
  }
  if (errors.length > 0) return { ok: false, errors }
  const current = getLocalContacts(storage)
  const next = [...current.filter((c) => c.id !== contact.id), contact]
  setLocalContacts(next, storage)
  return { ok: true, errors: [] }
}

/**
 * Per-contact remove: strips the entry from the array. No-op if id missing.
 */
export function removeLocalContact(id: string, storage: StorageLike | null = defaultStorage()): void {
  const current = getLocalContacts(storage)
  const next = current.filter((c) => c.id !== id)
  setLocalContacts(next, storage)
}

// ─── Import-text sanitation (mobile paste reality) ──────────────────────────
// Valid JSON pasted on an iPhone frequently fails JSON.parse because of things
// the user cannot see: a BOM, zero-width chars, RTL bidi control marks (Hebrew
// context inserts these), typographic "smart" quotes, or non-breaking spaces.
// We strip/normalize ONLY these invisible/typographic artifacts — the data
// (ids, numbers, structure) is untouched. Everything removed is reported.
const ZERO_WIDTH_RE = /[​‌‍⁠﻿]/g
const BIDI_RE = /[‎‏‪-‮⁦-⁩]/g
const SMART_DQUOTE_RE = /[“”„‟″‶〝〞]/g
const SMART_SQUOTE_RE = /[‘’‚‛′‵]/g
const NBSP_RE = / /g

export interface SanitizeResult { text: string; notes: string[] }

export function sanitizeImportText(raw: string): SanitizeResult {
  const notes: string[] = []
  let t = String(raw ?? '')
  if (/^﻿/.test(t)) notes.push('הוסר סימן BOM בתחילת הקובץ')
  const beforeInvisible = t.length
  t = t.replace(ZERO_WIDTH_RE, '').replace(BIDI_RE, '')
  if (t.length !== beforeInvisible) notes.push('הוסרו תווים נסתרים (zero-width / סימני כיווניות RTL)')
  const beforeQuotes = t
  t = t.replace(SMART_DQUOTE_RE, '"').replace(SMART_SQUOTE_RE, "'")
  if (t !== beforeQuotes) notes.push('תוקנו מרכאות טיפוגרפיות למרכאות רגילות')
  const beforeNbsp = t
  t = t.replace(NBSP_RE, ' ')
  if (t !== beforeNbsp) notes.push('הומרו רווחים קשיחים (NBSP) לרווח רגיל')
  t = t.trim()
  return { text: t, notes }
}

export interface ImportDebug {
  rawLength: number
  cleanedLength: number
  first100: string
  last100: string
  parseError: string | null
  notes: string[]
}

/** Diagnose the paste WITHOUT importing — for the operator debug panel. */
export function describeImportText(raw: string): ImportDebug {
  const r = String(raw ?? '')
  const { text, notes } = sanitizeImportText(r)
  let parseError: string | null = null
  try { JSON.parse(text) } catch (e) { parseError = e instanceof Error ? e.message : String(e) }
  return {
    rawLength: r.length,
    cleanedLength: text.length,
    first100: r.slice(0, 100),
    last100: r.length > 100 ? r.slice(-100) : '',
    parseError,
    notes,
  }
}

export function importContactsJSON(jsonText: string): ImportResult {
  const errors: string[] = []
  // Strip invisible/typographic artifacts that break JSON.parse on mobile paste.
  const { text: cleaned } = sanitizeImportText(jsonText)
  let parsed: unknown
  // Surface the EXACT JSON.parse exception instead of a generic message.
  try { parsed = JSON.parse(cleaned) }
  catch (e) { return { ok: false, errors: ['JSON parse error: ' + (e instanceof Error ? e.message : String(e))], contacts: [] } }
  if (!Array.isArray(parsed)) return { ok: false, errors: ['JSON must be an array of contacts'], contacts: [] }
  const seen = new Set<string>()
  const out: LocalFamilyContact[] = []
  parsed.forEach((raw, i) => {
    if (!isLocalFamilyContactShape(raw)) { errors.push(`item ${i}: invalid shape`); return }
    // Resolve spelling aliases (e.g. "rafi" → canonical "raphi") before the
    // known-id gate, then store the canonical id so the runtime merge renders it.
    const id = resolveContactId(raw.id)
    if (!isKnownContactId(id)) { errors.push(`item ${i}: unknown id "${raw.id}"`); return }
    if (seen.has(id)) { errors.push(`item ${i}: duplicate id "${raw.id}"`); return }
    seen.add(id)
    raw.id = id
    // Normalize Israeli local numbers before validation
    raw.phoneE164 = normalizeIsraeliPhone(raw.phoneE164)
    if (raw.whatsappE164) raw.whatsappE164 = normalizeIsraeliPhone(raw.whatsappE164)
    if (raw.enabled && !isValidPhoneE164(raw.phoneE164)) {
      errors.push(`item ${i} (${raw.id}): phoneE164 fails E.164 validation`)
      return
    }
    if (raw.whatsappE164 !== undefined && raw.whatsappE164.length > 0 && !isValidPhoneE164(raw.whatsappE164)) {
      errors.push(`item ${i} (${raw.id}): whatsappE164 fails E.164 validation`)
      return
    }
    out.push(raw)
  })
  return { ok: errors.length === 0, errors, contacts: out }
}

export function exportContactsJSON(contacts: LocalFamilyContact[]): string {
  return JSON.stringify(contacts, null, 2)
}

export function maskPhonePreview(phone: string | undefined): string {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length === 0) return '(ריק)'
  if (digits.length <= 3) return '*'.repeat(digits.length)
  return '+' + digits.slice(0, 3) + '*'.repeat(digits.length - 3)
}

/**
 * Validate an arbitrary value as a contacts array. Returns the entries that
 * pass BOTH the shape check and the known-id allowlist, plus a per-item error
 * list. Pure — no storage side effects. Used by recovery and by the report.
 */
export function validateContacts(input: unknown): { valid: LocalFamilyContact[]; errors: string[] } {
  if (!Array.isArray(input)) return { valid: [], errors: ['not an array'] }
  const errors: string[] = []
  const valid: LocalFamilyContact[] = []
  input.forEach((item, i) => {
    if (!isLocalFamilyContactShape(item)) { errors.push(`item ${i}: invalid shape`); return }
    const id = resolveContactId(item.id)
    if (!isKnownContactId(id)) { errors.push(`item ${i}: unknown id "${item.id}"`); return }
    valid.push({ ...item, id })
  })
  return { valid, errors }
}

export interface MigrationResult {
  migrated: boolean
  from: number
  to: number
  dropped: number
}

/**
 * Opportunistically upgrade stored contacts to the current schema version and
 * salvage any partially-corrupt payload. Safe + reversible:
 *  - Reads via the durable fallback (so an evicted localStorage is recovered).
 *  - Rewrites ONLY the valid entries in the current envelope.
 *  - No-op when already current and clean, or when there is nothing to salvage
 *    (an unparseable blob is left untouched so a good durable copy can win on
 *    the next app start rather than being overwritten with empty).
 * Returns what changed so the caller can refresh its view.
 */
export function migrateContactsFormat(storage: StorageLike | null = defaultStorage()): MigrationResult {
  if (!storage) return { migrated: false, from: 0, to: CONTACTS_SCHEMA_VERSION, dropped: 0 }
  const diag = readContactsWithDiagnostics(storage)
  const alreadyCurrent = diag.version === CONTACTS_SCHEMA_VERSION && !diag.recovered
  const nothingToSalvage = diag.contacts.length === 0
  if (alreadyCurrent || nothingToSalvage) {
    return { migrated: false, from: diag.version, to: CONTACTS_SCHEMA_VERSION, dropped: diag.dropped }
  }
  setLocalContacts(diag.contacts, storage)
  return { migrated: true, from: diag.version, to: CONTACTS_SCHEMA_VERSION, dropped: diag.dropped }
}

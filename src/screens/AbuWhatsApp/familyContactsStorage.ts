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
import { FAMILY_QUICK_FACES, KNOWN_CONTACT_PHOTOS, type FamilyQuickFace } from './familyContacts.private'
import { durable } from '../../services/durableStore'

/**
 * Default-photo REGISTRY — id → bundled asset path for the known family. This is
 * a one-time migration/default source ONLY; the board never renders from it (it
 * renders from the stored contacts). Reuses the committed asset mapping.
 */
export const DEFAULT_CONTACT_PHOTOS: Readonly<Record<string, string>> = KNOWN_CONTACT_PHOTOS

/** Bumped when the migration logic changes so it re-runs once per version. */
export const CONTACT_PHOTO_MIGRATION_VERSION = 1
const PHOTO_MIGRATION_KEY = 'abubank.familyContacts.photoMigration.v'

export const LOCAL_FAMILY_CONTACTS_STORAGE_KEY = 'abubank.familyContacts.v1'

/**
 * Same-tab change signal. The browser 'storage' event only fires in OTHER tabs,
 * so a write made by the operator setup would not refresh the family board that
 * is about to mount in the SAME tab. Every mutation dispatches this event so any
 * live view can re-read immediately. (No-op outside the browser.)
 */
export const CONTACTS_UPDATED_EVENT = 'abubank:contacts-updated'

/** Monotonic snapshot version + last-update marker (for the operator receipt). */
let contactsSnapshotVersion = 0
let contactsLastUpdateAt: number | null = null

function notifyContactsUpdated(): void {
  contactsSnapshotVersion += 1
  try { contactsLastUpdateAt = Date.now() } catch { /* clock unavailable */ }
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new Event(CONTACTS_UPDATED_EVENT))
    }
  } catch { /* best-effort */ }
}

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

/**
 * The local contact store is the SINGLE SOURCE OF TRUTH — any contact id is
 * allowed (no fixed scaffold allowlist). We only require a SAFE, stable id so it
 * can be a durable storage/merge key: lowercase letters/digits with `-`/`_`,
 * starting alphanumeric, 1–40 chars. Unsafe ids are rejected with a specific
 * error, never silently dropped. `isKnownContactId` remains only as an
 * INFORMATIONAL "is this one of the default family" flag — not a gate.
 */
export const SAFE_CONTACT_ID_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/
export function isSafeContactId(id: string): boolean {
  return SAFE_CONTACT_ID_RE.test(String(id ?? ''))
}

export interface LocalFamilyContact {
  id: string
  enabled: boolean
  phoneE164: string
  whatsappE164?: string
  photoFile?: string
  photoDataUrl?: string
  /** The contact's own identity. The store is the source of truth, so these
   *  ARE the label/relationship the board renders (falling back to `id` /
   *  empty when absent — e.g. a terse JSON import). */
  displayName?: string
  relationshipHebrew?: string
  /** Optional photo crop hints, carried from the default-family seed. */
  photoFit?: 'contain' | 'cover'
  photoObjectPosition?: string
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
  if (v.displayName !== undefined && typeof v.displayName !== 'string') return false
  if (v.relationshipHebrew !== undefined && typeof v.relationshipHebrew !== 'string') return false
  if (v.photoFit !== undefined && v.photoFit !== 'contain' && v.photoFit !== 'cover') return false
  if (v.photoObjectPosition !== undefined && typeof v.photoObjectPosition !== 'string') return false
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

/**
 * Privacy-safe operator receipt for the contact store — the diagnostic that
 * makes "Communication has no numbers" reproducible WITHOUT re-importing and
 * WITHOUT exposing any name / number / message. Reads the same authoritative
 * store the recipient resolver reads (getLocalContacts), so it reflects exactly
 * what Communication sees at this moment.
 */
export interface ContactsReceipt {
  contactCount: number
  actionableCall: number       // enabled AND a valid phone (tel: handoff possible)
  actionableWhatsApp: number   // enabled AND a valid phone/whatsapp (wa.me possible)
  storageSource: 'localStorage' | 'durable' | 'none'
  hydrated: boolean            // durable backend finished init()
  snapshotVersion: number      // bumps on every store mutation this session
  lastUpdateAt: number | null  // ms epoch of the last mutation, or null
}

export function contactsReceipt(storage: StorageLike | null = defaultStorage()): ContactsReceipt {
  const contacts = storage ? getLocalContacts(storage) : []
  const validPhone = (c: LocalFamilyContact) => isValidPhoneE164(c.phoneE164)
  const validWa = (c: LocalFamilyContact) => isValidPhoneE164(c.phoneE164) || (!!c.whatsappE164 && isValidPhoneE164(c.whatsappE164))
  let storageSource: ContactsReceipt['storageSource'] = 'none'
  if (storage) {
    let ls: string | null = null
    try { ls = storage.getItem(LOCAL_FAMILY_CONTACTS_STORAGE_KEY) } catch { ls = null }
    storageSource = (ls !== null && ls !== '') ? 'localStorage' : (contacts.length > 0 ? 'durable' : 'none')
  }
  let hydrated = false
  try { hydrated = durable.isReady() } catch { hydrated = false }
  return {
    contactCount: contacts.length,
    actionableCall: contacts.filter((c) => c.enabled && validPhone(c)).length,
    actionableWhatsApp: contacts.filter((c) => c.enabled && validWa(c)).length,
    storageSource,
    hydrated,
    snapshotVersion: contactsSnapshotVersion,
    lastUpdateAt: contactsLastUpdateAt,
  }
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
    notifyContactsUpdated()
  }
}

export function clearLocalContacts(storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return
  try { storage.removeItem(LOCAL_FAMILY_CONTACTS_STORAGE_KEY) } catch { /* private mode */ }
  if (isDefaultBrowserStorage(storage)) {
    try { durable.remove(LOCAL_FAMILY_CONTACTS_STORAGE_KEY) } catch { /* best-effort */ }
    notifyContactsUpdated()
  }
}

/**
 * Default-family SEED. The scaffold is no longer a runtime render gate — it is
 * one-time initial data. Each known family member becomes a contact carrying its
 * own identity + photo, DISABLED with no number (the operator adds numbers). Once
 * the store is written (by the seed or any edit) it is authoritative: a deleted
 * contact stays deleted and is never re-seeded.
 */
export const DEFAULT_SEED_CONTACTS: LocalFamilyContact[] = FAMILY_QUICK_FACES
  .filter((f): f is Extract<FamilyQuickFace, { type: 'person' }> => f.type === 'person')
  .map((p) => {
    const c: LocalFamilyContact = { id: p.id, enabled: false, phoneE164: '', displayName: p.displayName }
    if (p.relationshipHebrew) c.relationshipHebrew = p.relationshipHebrew
    if (p.photoFile) c.photoFile = p.photoFile
    if (p.photoFit) c.photoFit = p.photoFit
    if (p.photoObjectPosition) c.photoObjectPosition = p.photoObjectPosition
    return c
  })

/**
 * Seed the default family ONLY when the store has never been written (both
 * localStorage and the durable mirror are empty). Idempotent + safe: an existing
 * store — even an empty one the user cleared — is left untouched. Returns true
 * iff it seeded. Call once at app start, after `durable.init()`.
 */
export function seedDefaultContactsIfEmpty(storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage) return false
  const raw = readRawWithDurableFallback(storage)
  if (raw !== null && raw !== '') return false
  setLocalContacts(DEFAULT_SEED_CONTACTS, storage)
  return true
}

export interface PhotoMigrationResult { migrated: number; ranVersion: number; skipped: boolean }

/**
 * One-time, versioned, idempotent photo backfill. For every EXISTING stored
 * contact that has NO photo (neither photoDataUrl nor photoFile) but whose id
 * matches a known bundled asset, set photoFile from the default-photo registry.
 *
 * Safety guarantees:
 *  - never overwrites a user-uploaded photoDataUrl (or an existing photoFile);
 *  - never recreates a deleted contact (only maps over what is stored);
 *  - never makes the board depend on a hardcoded list (registry is migration-only);
 *  - idempotent (re-running is a no-op) AND version-gated (skips once applied).
 * Call at boot after `seedDefaultContactsIfEmpty()`.
 */
export function migrateContactPhotos(storage: StorageLike | null = defaultStorage()): PhotoMigrationResult {
  if (!storage) return { migrated: 0, ranVersion: 0, skipped: true }
  let applied = 0
  try {
    const raw = storage.getItem(PHOTO_MIGRATION_KEY)
      ?? (isDefaultBrowserStorage(storage) ? durable.getString(PHOTO_MIGRATION_KEY) : null)
    applied = raw ? Number(raw) : 0
  } catch { applied = 0 }
  if (applied >= CONTACT_PHOTO_MIGRATION_VERSION) return { migrated: 0, ranVersion: applied, skipped: true }

  const contacts = getLocalContacts(storage)
  let migrated = 0
  const next = contacts.map((c) => {
    const hasPhoto = (c.photoDataUrl && c.photoDataUrl.length > 0) || (c.photoFile && c.photoFile.length > 0)
    const known = DEFAULT_CONTACT_PHOTOS[c.id]
    if (!hasPhoto && known) { migrated++; return { ...c, photoFile: known } }
    return c
  })
  if (migrated > 0) setLocalContacts(next, storage)
  try {
    storage.setItem(PHOTO_MIGRATION_KEY, String(CONTACT_PHOTO_MIGRATION_VERSION))
    if (isDefaultBrowserStorage(storage)) durable.setString(PHOTO_MIGRATION_KEY, String(CONTACT_PHOTO_MIGRATION_VERSION))
  } catch { /* best-effort */ }
  return { migrated, ranVersion: CONTACT_PHOTO_MIGRATION_VERSION, skipped: false }
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
  if (!isSafeContactId(contact.id)) errors.push(`invalid contact id "${contact.id}"`)
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
  /** true when sanitation changed NOTHING — the string that reaches JSON.parse
   *  is byte-identical to the pasted text. When true, the parse error is in the
   *  real content, not an invisible/typographic artifact. */
  identicalToRaw: boolean
  first100: string
  last100: string
  parseError: string | null
  /** Character offset reported by JSON.parse ("...at position N"), or null. */
  parseErrorOffset: number | null
  /** 1-based line / column reported by JSON.parse ("line L column C"), or null. */
  parseErrorLine: number | null
  parseErrorColumn: number | null
  /** Up to 100 chars of the parsed string immediately BEFORE the error offset. */
  contextBefore: string
  /** Up to 100 chars of the parsed string immediately AT/AFTER the error offset. */
  contextAfter: string
  /** The exact character at the error offset, described with its codepoint. */
  charAtOffset: string
  notes: string[]
}

/**
 * Pull the numeric offset / line / column out of a V8 JSON.parse error message.
 * V8 emits e.g. "Expected ',' or '}' after property value in JSON at position
 * 47 (line 3 column 5)" or "Unexpected token x in JSON at position 12". Returns
 * nulls when the shape is not recognized (never throws).
 */
export function analyzeParseError(message: string): {
  offset: number | null
  line: number | null
  column: number | null
} {
  const pos = /position (\d+)/i.exec(message)
  const lc = /line (\d+) column (\d+)/i.exec(message)
  return {
    offset: pos ? Number(pos[1]) : null,
    line: lc ? Number(lc[1]) : null,
    column: lc ? Number(lc[2]) : null,
  }
}

/** Describe a single character with its Unicode codepoint (for the debug panel). */
function describeChar(ch: string | undefined): string {
  if (ch === undefined || ch === '') return '(end of string)'
  const cp = ch.codePointAt(0) ?? 0
  const hex = cp.toString(16).toUpperCase().padStart(4, '0')
  return `${JSON.stringify(ch)} (U+${hex})`
}

/**
 * SHA-256 of a string, hex-encoded. Uses the platform WebCrypto (available in
 * browsers and Node ≥ 18). Returns '' if WebCrypto is unavailable so callers
 * can render a graceful fallback instead of throwing.
 */
export async function sha256Hex(text: string): Promise<string> {
  try {
    const subtle = (globalThis.crypto as Crypto | undefined)?.subtle
    if (!subtle) return ''
    const bytes = new TextEncoder().encode(text)
    const digest = await subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch { return '' }
}

/** Diagnose the paste WITHOUT importing — for the operator debug panel. */
export function describeImportText(raw: string): ImportDebug {
  const r = String(raw ?? '')
  const { text, notes } = sanitizeImportText(r)
  let parseError: string | null = null
  try { JSON.parse(text) } catch (e) { parseError = e instanceof Error ? e.message : String(e) }
  const loc = parseError ? analyzeParseError(parseError) : { offset: null, line: null, column: null }
  // Slice context out of the ACTUAL string handed to JSON.parse (the cleaned
  // one), so the operator sees exactly what the parser choked on.
  const off = loc.offset
  const contextBefore = off !== null ? text.slice(Math.max(0, off - 100), off) : ''
  const contextAfter = off !== null ? text.slice(off, off + 100) : ''
  const charAtOffset = off !== null ? describeChar(text[off]) : ''
  return {
    rawLength: r.length,
    cleanedLength: text.length,
    identicalToRaw: text === r,
    first100: r.slice(0, 100),
    last100: r.length > 100 ? r.slice(-100) : '',
    parseError,
    parseErrorOffset: off,
    parseErrorLine: loc.line,
    parseErrorColumn: loc.column,
    contextBefore,
    contextAfter,
    charAtOffset,
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
    if (!isSafeContactId(id)) { errors.push(`item ${i}: invalid id "${raw.id}"`); return }
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
    if (!isSafeContactId(id)) { errors.push(`item ${i}: invalid id "${item.id}"`); return }
    valid.push({ ...item, id })
  })
  return { valid, errors }
}

// ─── Contact Management: per-field validation (simple form) ─────────────────
// Field-level, plain-Hebrew errors for the Settings → Contact Management form.
// The contact universe is Martita's known family (KNOWN_CONTACT_IDS); an unknown
// id cannot render on the board, so it is a specific, explained error — never a
// silent drop.

export interface ContactFormInput {
  id: string
  displayName?: string | undefined
  relationshipHebrew?: string | undefined
  phoneE164: string
  whatsappE164?: string | undefined
  enabled: boolean
}

export type ContactFieldErrors = Partial<Record<'id' | 'displayName' | 'phoneE164' | 'whatsappE164' | 'enabled', string>>

/** Comma-joined Hebrew list of the ids the operator may use. */
export function knownContactIdList(): string {
  return [...KNOWN_CONTACT_IDS].filter((id) => id !== 'family-group').sort().join(', ')
}

export function validateContactFields(input: ContactFormInput): ContactFieldErrors {
  const errors: ContactFieldErrors = {}
  const rawId = String(input.id ?? '').trim()
  if (rawId.length === 0) {
    errors.id = 'חסר מזהה (id) לאיש הקשר'
  } else if (!isSafeContactId(resolveContactId(rawId))) {
    errors.id = 'מזהה לא תקין — אותיות באנגלית קטנות, ספרות, מקף בלבד (למשל: mor, dr-cohen)'
  }
  // Display name is required — the store is the source of truth, there is no
  // scaffold fallback for a contact's label.
  if (input.displayName === undefined || input.displayName.trim().length === 0) {
    errors.displayName = 'צריך שם תצוגה לאיש הקשר'
  }
  const phone = normalizeIsraeliPhone(String(input.phoneE164 ?? '').trim())
  if (phone.length > 0 && !isValidPhoneE164(phone)) {
    errors.phoneE164 = 'מספר טלפון לא תקין. דוגמה: +9725XXXXXXXX או 05XXXXXXXX'
  }
  const wa = input.whatsappE164 !== undefined ? normalizeIsraeliPhone(String(input.whatsappE164).trim()) : ''
  if (wa.length > 0 && !isValidPhoneE164(wa)) {
    errors.whatsappE164 = 'מספר וואטסאפ לא תקין. דוגמה: +9725XXXXXXXX'
  }
  // To be ENABLED (actionable on the board) a valid phone or whatsapp is required.
  if (input.enabled && !isValidPhoneE164(phone) && !isValidPhoneE164(wa)) {
    errors.enabled = 'כדי להפעיל צריך מספר טלפון או וואטסאפ תקין'
  }
  return errors
}

// ─── Contact Management: import preview / diff (advanced JSON) ───────────────
// Before ANY save, the operator sees exactly what will change. Merge/upsert is
// the default (existing id → update, new id → add, absent id → preserve).

export interface ContactImportInvalid { index: number; id: string | null; reason: string }
export interface ContactImportPreview {
  parseError: string | null
  parseErrorOffset: number | null
  parseErrorLine: number | null
  parseErrorColumn: number | null
  /** New ids not in the current store. */
  added: LocalFamilyContact[]
  /** Existing ids whose data changes. */
  updated: LocalFamilyContact[]
  /** Existing ids with byte-identical data (no-op). */
  unchanged: LocalFamilyContact[]
  /** Items that failed shape / id / phone validation (never saved). */
  invalid: ContactImportInvalid[]
  /** Ids that appeared more than once in the incoming JSON (later wins). */
  duplicate: { index: number; id: string }[]
  /** The net set to upsert on a Merge/Save (added ∪ updated), normalized. */
  toSave: LocalFamilyContact[]
  /** How many current contacts a Replace-All would REMOVE (not present incoming). */
  replaceAllRemoves: number
}

/** Normalize a contact the way the store would persist it (for stable diffing). */
function normalizeContact(raw: LocalFamilyContact): LocalFamilyContact {
  const out: LocalFamilyContact = {
    id: resolveContactId(raw.id),
    enabled: raw.enabled === true,
    phoneE164: normalizeIsraeliPhone(raw.phoneE164),
  }
  if (raw.whatsappE164 && raw.whatsappE164.length > 0) out.whatsappE164 = normalizeIsraeliPhone(raw.whatsappE164)
  if (raw.photoDataUrl && raw.photoDataUrl.length > 0) out.photoDataUrl = raw.photoDataUrl
  if (raw.photoFile && raw.photoFile.length > 0) out.photoFile = raw.photoFile
  if (raw.displayName && raw.displayName.trim().length > 0) out.displayName = raw.displayName.trim()
  if (raw.relationshipHebrew && raw.relationshipHebrew.trim().length > 0) out.relationshipHebrew = raw.relationshipHebrew.trim()
  return out
}

function sameContact(a: LocalFamilyContact, b: LocalFamilyContact): boolean {
  return JSON.stringify(normalizeContact(a)) === JSON.stringify(normalizeContact(b))
}

/**
 * Diff an incoming contacts JSON against the current store WITHOUT saving.
 * Powers the mandatory pre-save preview. Never throws: a parse error is
 * reported with its exact offset/line/column and everything else stays empty.
 */
export function previewImportContacts(
  jsonText: string,
  current: LocalFamilyContact[] = getLocalContacts(),
): ContactImportPreview {
  const empty = (parseError: string | null, loc = { offset: null as number | null, line: null as number | null, column: null as number | null }): ContactImportPreview => ({
    parseError,
    parseErrorOffset: loc.offset,
    parseErrorLine: loc.line,
    parseErrorColumn: loc.column,
    added: [], updated: [], unchanged: [], invalid: [], duplicate: [], toSave: [], replaceAllRemoves: 0,
  })

  const { text } = sanitizeImportText(jsonText)
  let parsed: unknown
  try { parsed = JSON.parse(text) }
  catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return empty('JSON parse error: ' + msg, analyzeParseError(msg))
  }
  if (!Array.isArray(parsed)) return empty('ה-JSON חייב להיות מערך של אנשי קשר (מתחיל ב-[ )')

  const currentById = new Map<string, LocalFamilyContact>()
  for (const c of current) currentById.set(c.id, c)

  const out = empty(null)
  const seen = new Set<string>()
  parsed.forEach((rawItem, index) => {
    if (!isLocalFamilyContactShape(rawItem)) {
      out.invalid.push({ index, id: (rawItem && typeof rawItem === 'object' && typeof (rawItem as Record<string, unknown>).id === 'string') ? String((rawItem as Record<string, unknown>).id) : null, reason: 'מבנה איש קשר לא תקין (חסר id / enabled / phoneE164)' })
      return
    }
    const id = resolveContactId(rawItem.id)
    if (!isSafeContactId(id)) {
      out.invalid.push({ index, id: rawItem.id, reason: `מזהה לא תקין "${rawItem.id}" (אותיות באנגלית, ספרות, מקף בלבד)` })
      return
    }
    const normalized = normalizeContact(rawItem)
    if (normalized.enabled && !isValidPhoneE164(normalized.phoneE164) && !(normalized.whatsappE164 && isValidPhoneE164(normalized.whatsappE164))) {
      out.invalid.push({ index, id, reason: 'מסומן כפעיל אך אין מספר טלפון/וואטסאפ תקין' })
      return
    }
    if (seen.has(id)) out.duplicate.push({ index, id })
    seen.add(id)
    const existing = currentById.get(id)
    if (!existing) out.added.push(normalized)
    else if (sameContact(existing, normalized)) out.unchanged.push(normalized)
    else out.updated.push(normalized)
  })
  out.toSave = [...out.added, ...out.updated]
  // Replace-All removes every current contact whose id is NOT in the incoming set.
  out.replaceAllRemoves = current.filter((c) => !seen.has(c.id)).length
  return out
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

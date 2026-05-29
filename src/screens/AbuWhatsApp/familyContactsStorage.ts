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

import { isValidPhoneE164 } from './familyQuickFaces'
import { FAMILY_QUICK_FACES } from './familyContacts.private'

export const LOCAL_FAMILY_CONTACTS_STORAGE_KEY = 'abubank.familyContacts.v1'

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

export function getLocalContacts(storage: StorageLike | null = defaultStorage()): LocalFamilyContact[] {
  if (!storage) return []
  let raw: string | null = null
  try { raw = storage.getItem(LOCAL_FAMILY_CONTACTS_STORAGE_KEY) } catch { return [] }
  if (!raw) return []
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return [] }
  if (!Array.isArray(parsed)) return []
  return parsed.filter(isLocalFamilyContactShape)
}

export function setLocalContacts(contacts: LocalFamilyContact[], storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return
  try { storage.setItem(LOCAL_FAMILY_CONTACTS_STORAGE_KEY, JSON.stringify(contacts)) } catch { /* quota / private mode */ }
}

export function clearLocalContacts(storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return
  try { storage.removeItem(LOCAL_FAMILY_CONTACTS_STORAGE_KEY) } catch { /* private mode */ }
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

export function importContactsJSON(jsonText: string): ImportResult {
  const errors: string[] = []
  let parsed: unknown
  try { parsed = JSON.parse(jsonText) } catch { return { ok: false, errors: ['JSON parse error'], contacts: [] } }
  if (!Array.isArray(parsed)) return { ok: false, errors: ['JSON must be an array of contacts'], contacts: [] }
  const seen = new Set<string>()
  const out: LocalFamilyContact[] = []
  parsed.forEach((raw, i) => {
    if (!isLocalFamilyContactShape(raw)) { errors.push(`item ${i}: invalid shape`); return }
    if (!isKnownContactId(raw.id)) { errors.push(`item ${i}: unknown id "${raw.id}"`); return }
    if (seen.has(raw.id)) { errors.push(`item ${i}: duplicate id "${raw.id}"`); return }
    seen.add(raw.id)
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

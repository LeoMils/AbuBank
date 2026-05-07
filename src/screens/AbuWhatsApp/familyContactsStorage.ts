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

export const LOCAL_FAMILY_CONTACTS_STORAGE_KEY = 'abubank.familyContacts.v1'

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

export function importContactsJSON(jsonText: string): ImportResult {
  const errors: string[] = []
  let parsed: unknown
  try { parsed = JSON.parse(jsonText) } catch { return { ok: false, errors: ['JSON parse error'], contacts: [] } }
  if (!Array.isArray(parsed)) return { ok: false, errors: ['JSON must be an array of contacts'], contacts: [] }
  const seen = new Set<string>()
  const out: LocalFamilyContact[] = []
  parsed.forEach((raw, i) => {
    if (!isLocalFamilyContactShape(raw)) { errors.push(`item ${i}: invalid shape`); return }
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

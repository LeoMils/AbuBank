/*
 * Private Family Phones — import helpers (pure, testable)
 * ═══════════════════════════════════════════════════════
 * The heavy lifting (parse, validate, normalize Israeli→E.164, known-id match,
 * device-local IndexedDB persistence) is REUSED from the proven
 * AbuWhatsApp/familyContactsStorage layer — we do not re-implement it. This module
 * adds only the page-specific pure helpers (route match, masked preview rows, the
 * success line) so the UI stays a thin shell.
 *
 * PRIVACY: real phone numbers live ONLY in device-local storage. This module never
 * logs, never emits full numbers, and the preview is masked. Tests use fake numbers.
 */
import {
  importContactsJSON, getLocalContacts, setLocalContacts, clearLocalContacts,
  exportContactsJSON, maskPhonePreview, KNOWN_CONTACT_IDS,
  type LocalFamilyContact, type ImportResult,
} from '../AbuWhatsApp/familyContactsStorage'

export {
  importContactsJSON, getLocalContacts, setLocalContacts, clearLocalContacts,
  exportContactsJSON, maskPhonePreview, KNOWN_CONTACT_IDS,
}
export type { LocalFamilyContact, ImportResult }

/** The direct route this page owns. Path (Vercel SPA rewrite) or hash fallback. */
export const FAMILY_PHONES_PATH = '/settings/family-phones'

/** True when the current location targets the family-phones page (direct open in
 *  iPhone Safari via path, or hash fallback for environments without rewrites). */
export function matchFamilyPhonesRoute(pathname: string | undefined, hash: string | undefined): boolean {
  const p = (pathname ?? '').replace(/\/+$/, '') // tolerate a trailing slash
  if (p === FAMILY_PHONES_PATH) return true
  const h = hash ?? ''
  return h === `#${FAMILY_PHONES_PATH}` || h === `#/settings/family-phones`
}

export interface MaskedRow { id: string; masked: string; enabled: boolean; known: boolean }

/** Build the MASKED preview rows shown before saving — never the full number. */
export function buildMaskedPreview(contacts: LocalFamilyContact[]): MaskedRow[] {
  return contacts.map(c => ({
    id: c.id,
    masked: maskPhonePreview(c.phoneE164),
    enabled: !!c.enabled,
    known: KNOWN_CONTACT_IDS.has(c.id),
  }))
}

/** The exact Hebrew success line required after a complete import. */
export function savedMessage(count: number): string {
  return `${count} מספרי טלפון נשמרו במכשיר הזה`
}

/** Save the validated contacts to device-local storage (localStorage + durable
 *  IndexedDB via the storage layer). Returns the saved count. REPLACE semantics:
 *  the imported set becomes the full contact list. */
export function replaceAllContacts(contacts: LocalFamilyContact[]): number {
  setLocalContacts(contacts)
  return contacts.length
}

/** MERGE semantics: upsert the imported contacts into the existing list by id. */
export function mergeContacts(imported: LocalFamilyContact[]): number {
  const current = getLocalContacts()
  const byId = new Map(current.map(c => [c.id, c]))
  for (const c of imported) byId.set(c.id, c)
  const next = [...byId.values()]
  setLocalContacts(next)
  return next.length
}

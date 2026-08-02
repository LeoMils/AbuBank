/*
 * GATE 8 — Contact storage health taxonomy (privacy-safe).
 *
 * Distinguishes WHY contacts/phones are missing so the UI never says
 * "phone not configured" when the real cause is a storage/recovery failure.
 * Counts and codes only — never a name, number, photo, or message.
 *
 * Detection uses a small persistent HIGH-WATER marker (the max phone count ever
 * committed) — the mission-permitted "small version/recovery marker". If the
 * store is empty NOW but the high-water is > 0 on the SAME canonical origin and
 * the user did not delete, that is an external loss, not a first run.
 *
 * Honest limitation (documented, PHYSICAL_IPHONE_ONLY): if iOS evicts the whole
 * origin OR the standalone-PWA storage partition differs from the Safari tab, the
 * high-water marker is gone/absent too, so that specific case is indistinguishable
 * from a genuine first run from inside the affected partition. The taxonomy still
 * covers corruption, quota, unavailability, interrupted saves, wrong origin, and
 * user deletion.
 */
import {
  LOCAL_FAMILY_CONTACTS_STORAGE_KEY as KEY,
  parseContactsPayload, getLocalContacts, CANONICAL_RC_ORIGIN,
  type LocalFamilyContact,
} from './familyContactsStorage'
import { durable } from '../../services/durableStore'

export type ContactStorageCode =
  | 'OK'
  | 'CONTACT_NOT_CONFIGURED'
  | 'SAVE_INTERRUPTED'
  | 'RECOVERY_PENDING'
  | 'DATA_CORRUPT'
  | 'STORAGE_UNAVAILABLE'
  | 'QUOTA_EXCEEDED'
  | 'EXTERNAL_STORAGE_LOSS'
  | 'WRONG_ORIGIN'
  | 'USER_DELETION'

export interface ContactStorageState {
  code: ContactStorageCode
  contactCount: number
  phoneCount: number
  highWater: number
}

const HIGH_WATER_KEY = 'abubank.familyContacts.phoneHighWater.v1'
const SAVE_INFLIGHT_KEY = 'abubank.familyContacts.saveInflight.v1'
const USER_DELETION_KEY = 'abubank.familyContacts.userDeleted.v1'
const LAST_WRITE_ERROR_KEY = 'abubank.familyContacts.lastWriteError.v1'

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function defaultStorage(): StorageLike | null {
  try { if (typeof window !== 'undefined' && window.localStorage) return window.localStorage } catch { /* private mode */ }
  return null
}
function isDefaultBrowserStorage(s: StorageLike): boolean {
  try { return typeof window !== 'undefined' && s === window.localStorage } catch { return false }
}
function num(v: string | null): number { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0 }
const phoneCountOf = (cs: LocalFamilyContact[]) => cs.filter((c) => (c.phoneE164 ?? '').trim().length > 0 || (c.whatsappE164 ?? '').trim().length > 0).length

/** Best-effort durable mirror for a marker so it survives localStorage eviction
 *  (when IndexedDB is retained). Only for the real browser storage. */
function setMarker(s: StorageLike, key: string, value: string): void {
  try { s.setItem(key, value) } catch { /* quota/private */ }
  if (isDefaultBrowserStorage(s)) { try { durable.setString(key, value) } catch { /* best-effort */ } }
}
function getMarker(s: StorageLike, key: string): string | null {
  let v: string | null = null
  try { v = s.getItem(key) } catch { v = null }
  if ((v === null || v === '') && isDefaultBrowserStorage(s)) {
    try { const d = durable.getString(key); if (d !== null && d !== '') v = d } catch { /* ignore */ }
  }
  return v
}

/** Record the high-water phone count after a COMMITTED save (call post-flush).
 *  Also clears the interrupted/deleted/error markers — a clean save resets them. */
export function recordCommittedSave(phoneCount: number, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return
  const prev = num(getMarker(storage, HIGH_WATER_KEY))
  if (phoneCount > prev) setMarker(storage, HIGH_WATER_KEY, String(phoneCount))
  try { storage.removeItem(SAVE_INFLIGHT_KEY) } catch { /* ignore */ }
  try { storage.removeItem(USER_DELETION_KEY) } catch { /* ignore */ }
  try { storage.removeItem(LAST_WRITE_ERROR_KEY) } catch { /* ignore */ }
  if (isDefaultBrowserStorage(storage)) {
    try { durable.remove(SAVE_INFLIGHT_KEY) } catch { /* ignore */ }
    try { durable.remove(USER_DELETION_KEY) } catch { /* ignore */ }
  }
}

/** Mark a save as in-flight (call BEFORE the write; cleared by recordCommittedSave
 *  after flush). If found still set on the next boot, the save was interrupted. */
export function markSaveInflight(storage: StorageLike | null = defaultStorage()): void {
  if (storage) setMarker(storage, SAVE_INFLIGHT_KEY, '1')
}
export function markUserDeletion(storage: StorageLike | null = defaultStorage()): void {
  if (storage) setMarker(storage, USER_DELETION_KEY, '1')
}
export function recordWriteError(kind: 'quota' | 'unavailable', storage: StorageLike | null = defaultStorage()): void {
  if (storage) setMarker(storage, LAST_WRITE_ERROR_KEY, kind)
}

function currentOrigin(): string {
  try { if (typeof window !== 'undefined' && window.location) return window.location.hostname } catch { /* SSR/test */ }
  return 'unknown'
}

/** Classify the observable contact-storage state. Privacy-safe (counts + code). */
export function classifyContactStorage(storage: StorageLike | null = defaultStorage()): ContactStorageState {
  if (!storage) return { code: 'STORAGE_UNAVAILABLE', contactCount: 0, phoneCount: 0, highWater: 0 }

  let raw: string | null = null
  try { raw = storage.getItem(KEY) } catch { return { code: 'STORAGE_UNAVAILABLE', contactCount: 0, phoneCount: 0, highWater: 0 } }
  const diag = parseContactsPayload(raw)
  const highWater = num(getMarker(storage, HIGH_WATER_KEY))

  if (diag.corrupt) return { code: 'DATA_CORRUPT', contactCount: 0, phoneCount: 0, highWater }

  const contacts = getLocalContacts(storage)
  const phoneCount = phoneCountOf(contacts)
  const base = { contactCount: contacts.length, phoneCount, highWater }

  const writeErr = getMarker(storage, LAST_WRITE_ERROR_KEY)
  if (phoneCount === 0 && writeErr === 'quota') return { code: 'QUOTA_EXCEEDED', ...base }

  // A save that began but never committed (crash between write and flush).
  const inflight = getMarker(storage, SAVE_INFLIGHT_KEY) === '1'
  if (inflight && phoneCount === 0) return { code: 'SAVE_INTERRUPTED', ...base }

  // Durable backend not yet ready but we expected data → transient recovery.
  // Only meaningful on the real browser-storage path (durable is the backend);
  // for injected/hermetic storage the durable singleton is irrelevant.
  let ready = true
  try { ready = durable.isReady() } catch { ready = true }
  if (isDefaultBrowserStorage(storage) && !ready && highWater > 0 && phoneCount === 0) {
    return { code: 'RECOVERY_PENDING', ...base }
  }

  if (phoneCount > 0) return { code: 'OK', ...base }

  // phoneCount === 0 from here.
  const canonical = currentOrigin() === CANONICAL_RC_ORIGIN
  if (highWater > 0) {
    if (getMarker(storage, USER_DELETION_KEY) === '1') return { code: 'USER_DELETION', ...base }
    if (!canonical) return { code: 'WRONG_ORIGIN', ...base }
    return { code: 'EXTERNAL_STORAGE_LOSS', ...base } // was saved, now gone, same origin, not deleted
  }
  // Never saved on this origin.
  if (!canonical && currentOrigin() !== 'unknown') return { code: 'WRONG_ORIGIN', ...base }
  return { code: 'CONTACT_NOT_CONFIGURED', ...base }
}

/** Plain-Hebrew, non-technical message. Only CONTACT_NOT_CONFIGURED says
 *  "not configured" — every storage/recovery failure gets an honest message. */
export function contactStorageMessageHebrew(code: ContactStorageCode): string {
  switch (code) {
    case 'CONTACT_NOT_CONFIGURED': return 'עדיין לא הוגדר מספר לאיש הקשר הזה.'
    case 'SAVE_INTERRUPTED': return 'השמירה האחרונה לא הושלמה. אפשר לייבא שוב כדי להשלים.'
    case 'RECOVERY_PENDING': return 'רגע, משחזרת את אנשי הקשר…'
    case 'DATA_CORRUPT': return 'יש תקלה בקובץ אנשי הקשר. אפשר לשחזר מגיבוי.'
    case 'STORAGE_UNAVAILABLE': return 'הדפדפן חוסם שמירה במכשיר (אולי גלישה פרטית).'
    case 'QUOTA_EXCEEDED': return 'אין מספיק מקום פנוי לשמירה במכשיר.'
    case 'EXTERNAL_STORAGE_LOSS': return 'הדפדפן מחק את הנתונים השמורים. צריך לייבא פעם אחת נוספת.'
    case 'WRONG_ORIGIN': return 'זו אינה הכתובת הקבועה — אנשי הקשר נשמרים בנפרד בכל כתובת.'
    case 'USER_DELETION': return 'אנשי הקשר נמחקו. אפשר לייבא מחדש.'
    case 'OK': default: return ''
  }
}

/*
 * iOS STORAGE-CONTAINER identity + canonical-entry guard.
 *
 * The forensic result (scripts/lifecycle-forensics.mjs) proved contacts commit to
 * localStorage + IndexedDB and survive terminate/reopen inside ONE storage jar.
 * The only remaining device hypothesis is that Safari-tab storage and the
 * Home-Screen PWA use ISOLATED jars, so an import in one is invisible in the other.
 *
 * This module makes the canonical entry (the installed PWA) explicit, blocks
 * imports in the wrong iOS container, and — using a locally-generated container id
 * stamped on every save — distinguishes a container MISMATCH from an in-jar
 * EVICTION. Privacy: ids are random and local; no name/number/photo/message.
 *
 * Honest limit: a FRESH isolated jar has no knowledge of another jar, so a
 * never-saved PWA is indistinguishable from a genuine first run. We never claim
 * "your data is in the other jar" without a signal (display-mode or a same-jar
 * high-water). See classifyContainer().
 */
import { CANONICAL_RC_ORIGIN } from './familyContactsStorage'
import { classifyContactStorage } from './contactStorageHealth'
import { durable } from '../../services/durableStore'

export const CANONICAL_IOS_MODE = 'standalone' as const

export type ContainerClass =
  | 'NON_IOS_OK'                    // desktop / operator automation — not gated
  | 'CANONICAL_PWA'                // iOS, canonical host, installed PWA — normal operation
  | 'SAFARI_BROWSER'              // iOS Safari tab on canonical host — WRONG container, block import
  | 'WRONG_HOST'                  // iOS, non-canonical host — separate storage
  | 'UNKNOWN_IOS_CONTAINER'       // iOS, cannot determine standalone
  | 'POSSIBLE_EXTERNAL_STORAGE_LOSS' // same container id, phones gone, was saved before — eviction

const CONTAINER_ID_KEY = 'abubank.container.id.v1'
const LAST_SAVE_CONTAINER_KEY = 'abubank.container.lastSave.v1'

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}
function defaultStorage(): StorageLike | null {
  try { if (typeof window !== 'undefined' && window.localStorage) return window.localStorage } catch { /* private */ }
  return null
}
function isDefaultBrowserStorage(s: StorageLike): boolean {
  try { return typeof window !== 'undefined' && s === window.localStorage } catch { return false }
}
function setMarker(s: StorageLike, k: string, v: string): void {
  try { s.setItem(k, v) } catch { /* quota */ }
  if (isDefaultBrowserStorage(s)) { try { durable.setString(k, v) } catch { /* best-effort */ } }
}
function getMarker(s: StorageLike, k: string): string | null {
  let v: string | null = null
  try { v = s.getItem(k) } catch { v = null }
  if ((v === null || v === '') && isDefaultBrowserStorage(s)) {
    try { const d = durable.getString(k); if (d !== null && d !== '') v = d } catch { /* ignore */ }
  }
  return v
}
function randomId(): string {
  try { const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto; if (c?.randomUUID) return c.randomUUID().replace(/-/g, '').slice(0, 16) } catch { /* ignore */ }
  // Fallback: index-varied, non-crypto — only a local container tag.
  let s = ''
  for (let i = 0; i < 16; i++) s += ((i * 7 + (getMarker.length || 3)) % 16).toString(16)
  return s
}

/** The stable, locally-generated id for THIS storage container (created once). */
export function getOrCreateContainerId(storage: StorageLike | null = defaultStorage()): string {
  if (!storage) return 'no-storage'
  let id = getMarker(storage, CONTAINER_ID_KEY)
  if (!id) { id = randomId(); setMarker(storage, CONTAINER_ID_KEY, id) }
  return id
}
/** Stamp the current container id as the last successful save location. Call after
 *  a COMMITTED save (post durable.flush), so an in-jar eviction is later detectable. */
export function recordSaveContainer(storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return
  setMarker(storage, LAST_SAVE_CONTAINER_KEY, getOrCreateContainerId(storage))
}

// ── environment fingerprint (privacy-safe) ──────────────────────────────────
export interface EnvProbe {
  hostname?: string
  displayMode?: 'standalone' | 'browser' | 'minimal-ui' | 'fullscreen' | string
  iosStandalone?: boolean | undefined
  isIOS?: boolean
}
export interface EnvFingerprint {
  hostname: string
  displayMode: string
  iosStandalone: boolean | undefined
  isIOS: boolean
  canonicalHost: boolean
  containerId: string
  lastSaveContainerId: string | null
  contactCount: number
  phoneCount: number
  highWater: number
  buildId: string
}

function readDisplayMode(): string {
  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      for (const m of ['standalone', 'minimal-ui', 'fullscreen', 'window-controls-overlay']) {
        if (window.matchMedia(`(display-mode: ${m})`).matches) return m
      }
    }
  } catch { /* ignore */ }
  return 'browser'
}
function readIsIOS(): boolean {
  try {
    const n = navigator as unknown as { userAgent?: string; platform?: string; maxTouchPoints?: number }
    const ua = n.userAgent ?? ''
    if (/iP(hone|ad|od)/.test(ua)) return true
    // iPadOS 13+ reports as Mac; detect by touch.
    if (/Macintosh/.test(ua) && (n.maxTouchPoints ?? 0) > 1) return true
  } catch { /* ignore */ }
  return false
}
function readHost(): string {
  try { if (typeof window !== 'undefined' && window.location) return window.location.hostname } catch { /* ignore */ }
  return 'unknown'
}

export function detectEnvironment(storage: StorageLike | null = defaultStorage(), probe: EnvProbe = {}, buildId = ''): EnvFingerprint {
  const hostname = probe.hostname ?? readHost()
  const displayMode = probe.displayMode ?? readDisplayMode()
  let iosStandalone = probe.iosStandalone
  if (iosStandalone === undefined) { try { iosStandalone = (navigator as unknown as { standalone?: boolean }).standalone } catch { iosStandalone = undefined } }
  const isIOS = probe.isIOS ?? readIsIOS()
  const health = classifyContactStorage(storage)
  return {
    hostname, displayMode, iosStandalone, isIOS,
    canonicalHost: hostname === CANONICAL_RC_ORIGIN,
    containerId: getOrCreateContainerId(storage),
    lastSaveContainerId: storage ? getMarker(storage, LAST_SAVE_CONTAINER_KEY) : null,
    contactCount: health.contactCount,
    phoneCount: health.phoneCount,
    highWater: health.highWater,
    buildId,
  }
}

const inStandalone = (e: EnvFingerprint) => e.displayMode === 'standalone' || e.iosStandalone === true

/** Classify the container condition. Only iOS is gated; desktop is NON_IOS_OK. */
export function classifyContainer(env: EnvFingerprint): ContainerClass {
  if (!env.isIOS) return 'NON_IOS_OK'
  if (!env.canonicalHost) return 'WRONG_HOST'
  if (inStandalone(env)) {
    // In the installed PWA. Same-jar eviction is detectable via the high-water +
    // matching last-save container id.
    if (env.phoneCount === 0 && env.highWater > 0 && env.lastSaveContainerId === env.containerId) {
      return 'POSSIBLE_EXTERNAL_STORAGE_LOSS'
    }
    return 'CANONICAL_PWA'
  }
  if (env.displayMode === 'browser' && env.iosStandalone !== true) return 'SAFARI_BROWSER'
  return 'UNKNOWN_IOS_CONTAINER'
}

/** Normal import/edit is BLOCKED only in the wrong iOS container (Safari tab). */
export function isImportBlockedForContainer(cls: ContainerClass): boolean {
  return cls === 'SAFARI_BROWSER'
}

/** Plain-Hebrew message + recommended action per class. Never says
 *  "not configured" for a container/storage condition. */
export function containerMessageHebrew(cls: ContainerClass): string {
  switch (cls) {
    case 'CANONICAL_PWA': return 'האפליקציה הנכונה — אנשי הקשר נשמרים כאן.'
    case 'SAFARI_BROWSER': return 'אנשי הקשר של Abu נשמרים באפליקציה המותקנת. פתחי את Abu מהאייקון במסך הבית כדי לייבא או לערוך אותם.'
    case 'WRONG_HOST': return 'זו אינה הכתובת הקבועה — אנשי הקשר נשמרים בנפרד בכל כתובת. פתחי את abu-ela-rc.vercel.app.'
    case 'UNKNOWN_IOS_CONTAINER': return 'נראה שנפתח עותק אחסון אחר. יש לפתוח את Abu מהאייקון הקבוע או לשחזר גיבוי.'
    case 'POSSIBLE_EXTERNAL_STORAGE_LOSS': return 'נתוני האפליקציה המקומיים אינם זמינים כרגע. יש לשחזר מגיבוי.'
    case 'NON_IOS_OK': default: return ''
  }
}

/** Short operator recommended-action tag per class. */
export function recommendedAction(cls: ContainerClass): string {
  switch (cls) {
    case 'CANONICAL_PWA': return 'CANONICAL_PWA_OK'
    case 'SAFARI_BROWSER': return 'OPEN_FROM_HOME_SCREEN_ICON'
    case 'WRONG_HOST': return 'OPEN_CANONICAL_HOST'
    case 'UNKNOWN_IOS_CONTAINER': return 'OPEN_PWA_OR_RESTORE_BACKUP'
    case 'POSSIBLE_EXTERNAL_STORAGE_LOSS': return 'RESTORE_FROM_BACKUP'
    case 'NON_IOS_OK': default: return 'NONE'
  }
}

export function containerIdPrefix(id: string | null): string {
  return id ? id.slice(0, 6) : '—'
}

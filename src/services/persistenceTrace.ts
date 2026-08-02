/*
 * Privacy-safe persistence trace.
 *
 * Records, at each startup stage, ONLY COUNTS (never a name, never a number,
 * never any contact content) so the "phone numbers vanish on reopen" failure is
 * reproducible from the device without exposing anything private. The trace is
 * persisted (localStorage + best-effort IndexedDB mirror) so it survives the
 * failed reopen, and is rendered copyable in Operator Settings → Contact
 * Management.
 *
 * What each stage answers (the operator's exact questions):
 *   boot-start        — localStorage contact/phone count the instant the app boots
 *   reconcile         — localStorage vs IndexedDB counts + which copy WON reconciliation
 *   post-init         — store phone count right after durable.init()
 *   post-seed-migrate — store phone count after seeding + photo migration
 *   wa-read           — store phone count when Abu WhatsApp actually reads contacts
 *
 * This module depends on durableStore ONE-WAY (for the IDB mirror + the store
 * read). durableStore never imports this module; it calls a registered observer,
 * so there is no import cycle.
 */

import { durable, setReconcileObserver } from './durableStore'

const CONTACTS_KEY = 'abubank.familyContacts.v1'
const TRACE_KEY = 'abubank.persistenceTrace.v1'
const BOOT_KEY = 'abubank.persistenceTrace.boot'
const MAX_ENTRIES = 120

export interface PersistTraceEntry {
  boot: number
  seq: number
  ts: string
  stage: string
  /** localStorage contacts/phones (-1 = present-but-unparseable/corrupt). */
  lsContacts?: number
  lsPhones?: number
  /** IndexedDB (durable backend) contacts/phones at reconcile time. */
  idbContacts?: number
  idbPhones?: number
  /** Which copy won reconciliation for the contacts key. */
  winner?: string
  /** The store (what getLocalContacts would return) after this stage. */
  storeContacts?: number
  storePhones?: number
  note?: string
}

let entries: PersistTraceEntry[] = []
let bootNum = 0
let seq = 0
let started = false

// ── counting (counts only; no content ever leaves this function) ────────────
function countContactsPhones(raw: string | null | undefined): { contacts: number; phones: number } {
  if (raw === null || raw === undefined || raw === '') return { contacts: 0, phones: 0 }
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return { contacts: -1, phones: -1 } } // corrupt
  const arr: unknown[] | null = Array.isArray(parsed)
    ? parsed
    : (parsed && typeof parsed === 'object' && Array.isArray((parsed as { contacts?: unknown }).contacts))
      ? ((parsed as { contacts: unknown[] }).contacts)
      : null
  if (!arr) return { contacts: 0, phones: 0 }
  let phones = 0
  for (const c of arr) {
    if (c && typeof c === 'object') {
      const p = (c as { phoneE164?: unknown }).phoneE164
      const w = (c as { whatsappE164?: unknown }).whatsappE164
      if ((typeof p === 'string' && p.trim().length > 0) || (typeof w === 'string' && w.trim().length > 0)) phones++
    }
  }
  return { contacts: arr.length, phones }
}

function safeLSGet(key: string): string | null {
  try { if (typeof localStorage !== 'undefined' && localStorage) return localStorage.getItem(key) } catch { /* private mode */ }
  return null
}
function safeLSSet(key: string, value: string): void {
  try { if (typeof localStorage !== 'undefined' && localStorage) localStorage.setItem(key, value) } catch { /* quota/private */ }
}

/** What getLocalContacts effectively reads: localStorage first, else the durable mirror. */
function readStoreRaw(): string | null {
  const ls = safeLSGet(CONTACTS_KEY)
  if (ls !== null && ls !== '') return ls
  try { const d = durable.getString(CONTACTS_KEY); if (d !== null && d !== '') return d } catch { /* not ready */ }
  return ls
}

function nowISO(): string {
  try { return new Date().toISOString() } catch { return '' }
}

function persist(): void {
  const trimmed = entries.slice(-MAX_ENTRIES)
  entries = trimmed
  const json = JSON.stringify(trimmed)
  safeLSSet(TRACE_KEY, json)
  // Best-effort IDB mirror so the trace survives even localStorage eviction.
  // TRACE_KEY is NOT a durable CRITICAL_KEY, so reconcile never touches it.
  try { durable.setString(TRACE_KEY, json) } catch { /* best-effort */ }
}

function push(partial: Omit<PersistTraceEntry, 'boot' | 'seq' | 'ts'>): void {
  try {
    entries.push({ boot: bootNum, seq: seq++, ts: nowISO(), ...partial })
    persist()
  } catch { /* never let tracing break boot */ }
}

/**
 * Register the durable reconcile observer + start a new boot session. Call ONCE
 * at the very top of boot(), BEFORE durable.init(), so the reconcile decision is
 * captured. Also records the boot-start localStorage snapshot immediately.
 */
export function initPersistenceTrace(): void {
  if (started) return
  started = true
  // Restore prior entries so the trace survives the reopen.
  try { const raw = safeLSGet(TRACE_KEY); if (raw) entries = JSON.parse(raw) as PersistTraceEntry[] } catch { entries = [] }
  if (!Array.isArray(entries)) entries = []
  // Increment the persisted boot counter.
  try { bootNum = (Number(safeLSGet(BOOT_KEY)) || 0) + 1 } catch { bootNum = 1 }
  safeLSSet(BOOT_KEY, String(bootNum))

  // Capture how durable.init reconciles the CONTACTS key (ls vs idb, winner).
  setReconcileObserver((info) => {
    if (info.key !== CONTACTS_KEY) return
    const ls = countContactsPhones(info.lsValue)
    const idb = countContactsPhones(info.backendValue)
    push({
      stage: 'reconcile',
      lsContacts: ls.contacts, lsPhones: ls.phones,
      idbContacts: idb.contacts, idbPhones: idb.phones,
      winner: info.winner,
    })
  })

  // boot-start: the localStorage contacts snapshot the instant we launch.
  const ls = countContactsPhones(safeLSGet(CONTACTS_KEY))
  push({ stage: 'boot-start', lsContacts: ls.contacts, lsPhones: ls.phones })
}

/**
 * Record a named stage, auto-capturing localStorage + effective-store counts.
 * `extra` can carry stage-specific facts (e.g. seeded/migrated flags).
 */
export function traceStage(stage: string, extra: Partial<PersistTraceEntry> = {}): void {
  const ls = countContactsPhones(safeLSGet(CONTACTS_KEY))
  const st = countContactsPhones(readStoreRaw())
  push({
    stage,
    lsContacts: ls.contacts, lsPhones: ls.phones,
    storeContacts: st.contacts, storePhones: st.phones,
    ...extra,
  })
}

export function getTraceEntries(): PersistTraceEntry[] {
  // Prefer the freshest persisted copy (covers a mount after boot wrote more).
  try { const raw = safeLSGet(TRACE_KEY); if (raw) return JSON.parse(raw) as PersistTraceEntry[] } catch { /* fall through */ }
  return entries
}

/** Human-readable, copyable, LTR trace (counts only). */
export function getTraceText(): string {
  const rows = getTraceEntries()
  if (rows.length === 0) return '(no persistence trace yet)'
  const fmt = (n: number | undefined): string => (n === undefined ? '·' : n === -1 ? 'CORRUPT' : String(n))
  const lines = rows.map((e) => {
    const parts: string[] = [`#${e.boot}.${e.seq}`, (e.ts || '').replace('T', ' ').replace('Z', ''), e.stage.padEnd(17)]
    if (e.lsContacts !== undefined) parts.push(`ls[c=${fmt(e.lsContacts)} p=${fmt(e.lsPhones)}]`)
    if (e.idbContacts !== undefined) parts.push(`idb[c=${fmt(e.idbContacts)} p=${fmt(e.idbPhones)}]`)
    if (e.winner !== undefined) parts.push(`WON=${e.winner}`)
    if (e.storeContacts !== undefined) parts.push(`store[c=${fmt(e.storeContacts)} p=${fmt(e.storePhones)}]`)
    if (e.note) parts.push(`(${e.note})`)
    return parts.join('  ')
  })
  return lines.join('\n')
}

export function clearPersistenceTrace(): void {
  entries = []
  // Reset the in-memory session so a fresh initPersistenceTrace() can run (used
  // by the operator Clear button and by test isolation). In production, init is
  // only called once at boot, so re-arming here is harmless.
  started = false
  seq = 0
  try { if (typeof localStorage !== 'undefined' && localStorage) localStorage.removeItem(TRACE_KEY) } catch { /* ignore */ }
  try { durable.remove(TRACE_KEY) } catch { /* ignore */ }
}

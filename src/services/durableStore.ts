/*
 * Durable storage layer — production persistence for AbuAI's critical user data
 * (calendar appointments, reminders, conversation memory).
 *
 * Design: a synchronous write-through cache backed by an async key-value
 * backend. IndexedDB is the production backend (larger quota, survives memory
 * pressure better than localStorage, schema-versioned). A localStorage MIRROR is
 * kept so that (a) existing synchronous read paths keep working with zero
 * refactor, and (b) there is a second copy for corruption recovery. The backend
 * is the durable source of truth re-hydrated on every app start.
 *
 * Why a pluggable backend: the IndexedDB binding needs a browser; an in-memory
 * backend makes the migration/cache/recovery LOGIC provable in node tests
 * without adding a fake-indexeddb dependency.
 *
 * Guarantees:
 *  - Sync reads (getString) never block: cache → localStorage fallback.
 *  - Writes are mirrored to localStorage synchronously AND queued to the
 *    durable backend (fire-and-forget, errors swallowed — never throws to the UI).
 *  - Migration localStorage → backend is idempotent and safe to retry.
 *  - Corruption recovery: a bad JSON value falls back to the mirror, then to a
 *    caller default; never throws.
 *  - Export/import for backup (survives an origin/URL change if the user exports).
 */

// ── Backend abstraction ─────────────────────────────────────────────────────
export interface KVBackend {
  getAll(): Promise<Record<string, string>>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

/** In-memory backend — used by tests and as an SSR/no-IndexedDB fallback. */
export class MemoryBackend implements KVBackend {
  private m = new Map<string, string>()
  constructor(seed?: Record<string, string>) { if (seed) for (const [k, v] of Object.entries(seed)) this.m.set(k, v) }
  async getAll() { return Object.fromEntries(this.m) }
  async set(k: string, v: string) { this.m.set(k, v) }
  async remove(k: string) { this.m.delete(k) }
  /** test helper: snapshot for "reload" simulation (same backend, new store). */
  snapshot(): Record<string, string> { return Object.fromEntries(this.m) }
}

/** IndexedDB backend via `idb`. Production only (needs a browser). */
export class IndexedDBBackend implements KVBackend {
  private dbName = 'abu-durable'
  private store = 'kv'
  private version = 1
  private dbPromise: Promise<unknown> | null = null
  private async db(): Promise<{ get: unknown; transaction: unknown; getAll(s: string): Promise<unknown[]> } & Record<string, (...a: unknown[]) => unknown>> {
    if (!this.dbPromise) {
      const { openDB } = await import('idb')
      const store = this.store
      this.dbPromise = openDB(this.dbName, this.version, {
        upgrade(db) { if (!db.objectStoreNames.contains(store)) db.createObjectStore(store) },
      })
    }
    return this.dbPromise as never
  }
  async getAll(): Promise<Record<string, string>> {
    const db = await this.db() as never as { getAllKeys(s: string): Promise<string[]>; getAll(s: string): Promise<string[]> }
    const keys = await db.getAllKeys(this.store)
    const vals = await db.getAll(this.store)
    const out: Record<string, string> = {}
    keys.forEach((k, i) => { out[k] = vals[i]! })
    return out
  }
  async set(key: string, value: string): Promise<void> {
    const db = await this.db() as never as { put(s: string, v: string, k: string): Promise<void> }
    await db.put(this.store, value, key)
  }
  async remove(key: string): Promise<void> {
    const db = await this.db() as never as { delete(s: string, k: string): Promise<void> }
    await db.delete(this.store, key)
  }
}

// ── Keys migrated from localStorage into the durable backend ────────────────
export const CRITICAL_KEYS = [
  'abubank-calendar-appointments', // calendar events (SAFETY-CRITICAL)
  'abu_reminders_v1',              // reminders (SAFETY-CRITICAL)
  'abuai-conversation-history',    // conversation memory
  'abuai-conversation-summary',    // rolling summary
  'abutime-memory',                // learned time preferences
  'martita-contacts-v1',           // saved contacts (legacy)
  'martita-loc-contacts-v1',       // local contacts (legacy)
  'abubank.familyContacts.v1',     // AbuWhatsApp per-person phone/photo (SAFETY-CRITICAL: Martita's family)
] as const

const SCHEMA_KEY = '__abu_schema_version__'
const SCHEMA_VERSION = '1'

/**
 * Where the automatic pre-migration snapshot is stored in the backend. Captured
 * once, the first time a given schema version boots, BEFORE any localStorage →
 * backend migration copies data in — so a future migration/transform is always
 * reversible from this blob. It is NOT a managed key (excluded from exportAll,
 * mirror-restore, and migration) so it never leaks into user backups or loops.
 */
export const PRE_MIGRATION_BACKUP_KEY = '__abu_pre_migration_backup__'

function hasLocalStorage(): boolean {
  try { return typeof localStorage !== 'undefined' && localStorage !== null } catch { return false }
}

export class DurableStore {
  private cache = new Map<string, string>()
  private ready = false
  private inflight = new Set<Promise<void>>()
  constructor(private backend: KVBackend, private keys: readonly string[] = CRITICAL_KEYS) {}

  /**
   * Hydrate the cache from the durable backend and migrate any localStorage-only
   * data into it. Idempotent + safe to retry: re-running never loses data and
   * never double-writes meaningfully.
   */
  async init(): Promise<void> {
    let backendData: Record<string, string> = {}
    try { backendData = await this.backend.getAll() } catch { backendData = {} }

    // Automatic pre-migration backup (once per schema version). BEFORE we copy
    // any localStorage data into the backend or stamp the new schema version,
    // snapshot the current durable + mirror state of every managed key so a
    // future migration/transform is reversible. Idempotent: only written when
    // no backup exists yet for this boot, and only when there is real data to
    // protect (fresh installs skip it — nothing to back up).
    const prevSchema = backendData[SCHEMA_KEY]
    if (prevSchema !== SCHEMA_VERSION && backendData[PRE_MIGRATION_BACKUP_KEY] === undefined) {
      const snapshot: Record<string, string> = {}
      for (const k of this.keys) {
        const v = backendData[k] ?? safeLSGet(k)
        if (v !== null && v !== undefined) snapshot[k] = v
      }
      if (Object.keys(snapshot).length > 0) {
        const blob = JSON.stringify({ fromSchema: prevSchema ?? null, toSchema: SCHEMA_VERSION, data: snapshot })
        backendData[PRE_MIGRATION_BACKUP_KEY] = blob
        this.cache.set(PRE_MIGRATION_BACKUP_KEY, blob)
        try { await this.backend.set(PRE_MIGRATION_BACKUP_KEY, blob) } catch { /* best-effort */ }
      }
    }

    // Migration (idempotent): for each managed key present in localStorage but
    // not yet in the backend, copy it in. Backend is authoritative once present.
    // Writes are AWAITED (not fire-and-forget) so that once init() resolves the
    // durable IndexedDB copy is guaranteed written — otherwise a fast app-close
    // right after first launch could lose the backup before the queued write
    // flushed.
    const migrationWrites: Array<Promise<void>> = []
    if (hasLocalStorage()) {
      for (const k of this.keys) {
        if (backendData[k] === undefined) {
          const ls = safeLSGet(k)
          if (ls !== null) {
            backendData[k] = ls
            migrationWrites.push(this.backend.set(k, ls).catch(() => {}))
          }
        }
      }
    }
    if (migrationWrites.length) { try { await Promise.all(migrationWrites) } catch { /* best-effort */ } }

    // Hydrate cache from the (now-migrated) backend snapshot.
    for (const [k, v] of Object.entries(backendData)) this.cache.set(k, v)

    // Restore the localStorage MIRROR from the durable backend, so existing
    // synchronous readers (loadAppointments, reminderStore, …) see data that
    // localStorage may have evicted. This is the durability win: IndexedDB
    // repopulates localStorage on every app start.
    if (hasLocalStorage()) {
      for (const k of this.keys) {
        const v = this.cache.get(k)
        if (v !== undefined && safeLSGet(k) !== v) safeLSSet(k, v)
      }
    }

    // Stamp schema version (for future migrations).
    if (backendData[SCHEMA_KEY] !== SCHEMA_VERSION) {
      this.cache.set(SCHEMA_KEY, SCHEMA_VERSION)
      void this.backend.set(SCHEMA_KEY, SCHEMA_VERSION).catch(() => {})
    }
    this.ready = true
  }

  isReady(): boolean { return this.ready }

  /**
   * The automatic snapshot captured before the last schema migration, or null
   * if none was taken (fresh install). Parsed shape: { fromSchema, toSchema,
   * data: Record<key, value> }. Used for manual recovery / audit.
   */
  getPreMigrationBackup(): string | null { return this.getString(PRE_MIGRATION_BACKUP_KEY) }

  /** Synchronous read: cache (durable, post-init) → localStorage mirror fallback. */
  getString(key: string): string | null {
    if (this.cache.has(key)) return this.cache.get(key)!
    return safeLSGet(key)
  }

  /** Write-through: cache + localStorage mirror (sync) + durable backend (async, tracked for flush). */
  setString(key: string, value: string): void {
    this.cache.set(key, value)
    safeLSSet(key, value)
    this.track(this.backend.set(key, value))
  }

  remove(key: string): void {
    this.cache.delete(key)
    safeLSRemove(key)
    this.track(this.backend.remove(key))
  }

  /**
   * Await all in-flight durable backend writes. Call on `pagehide` and on
   * `visibilitychange`→hidden so a fast app-close or background on iOS cannot
   * lose a just-created appointment / reminder / family contact whose async
   * IndexedDB write had not yet settled (the localStorage mirror alone is not
   * enough — iOS evicts it under storage pressure). Never rejects: individual
   * write errors are already swallowed, so flush() only ever resolves.
   */
  async flush(): Promise<void> { await Promise.all([...this.inflight]) }

  /** Track a fire-and-forget backend write so flush() can await it; never rejects. */
  private track(p: Promise<void>): void {
    const wrapped = p.catch(() => {})
    this.inflight.add(wrapped)
    void wrapped.then(() => { this.inflight.delete(wrapped) })
  }

  /** JSON read with corruption recovery: bad value → mirror → caller default. */
  getJSON<T>(key: string, fallback: T): T {
    const raw = this.getString(key)
    if (raw === null) return fallback
    try { return JSON.parse(raw) as T } catch {
      // Cache/primary corrupt — try the localStorage mirror as a second copy.
      const mirror = safeLSGet(key)
      if (mirror !== null && mirror !== raw) {
        try { return JSON.parse(mirror) as T } catch { /* both bad */ }
      }
      return fallback
    }
  }

  setJSON<T>(key: string, value: T): void { this.setString(key, JSON.stringify(value)) }

  /** Backup: serialize all managed keys for export (survives origin/URL change). */
  exportAll(): string {
    const out: Record<string, string> = {}
    for (const k of this.keys) { const v = this.getString(k); if (v !== null) out[k] = v }
    return JSON.stringify({ schema: SCHEMA_VERSION, data: out })
  }

  /** Restore from an exportAll() blob. Idempotent; overwrites managed keys. */
  importAll(blob: string): { ok: boolean; restored: number } {
    try {
      const parsed = JSON.parse(blob) as { data?: Record<string, string> }
      const data = parsed.data ?? {}
      let n = 0
      for (const [k, v] of Object.entries(data)) { if (typeof v === 'string') { this.setString(k, v); n++ } }
      return { ok: true, restored: n }
    } catch { return { ok: false, restored: 0 } }
  }
}

function safeLSGet(k: string): string | null { try { return hasLocalStorage() ? localStorage.getItem(k) : null } catch { return null } }
function safeLSSet(k: string, v: string): void { try { if (hasLocalStorage()) localStorage.setItem(k, v) } catch { /* quota */ } }
function safeLSRemove(k: string): void { try { if (hasLocalStorage()) localStorage.removeItem(k) } catch { /* */ } }

function defaultBackend(): KVBackend {
  try {
    if (typeof indexedDB !== 'undefined' && indexedDB !== null) return new IndexedDBBackend()
  } catch { /* fall through */ }
  return new MemoryBackend()
}

/** Production singleton. Call `durable.init()` once at app start (main.tsx). */
export const durable = new DurableStore(defaultBackend())

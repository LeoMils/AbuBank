import { openDB } from 'idb'
import type { ServiceConfig, Result } from '../state/types'

const DB_NAME = 'abu-bank-db'
const DB_VERSION = 1
const SERVICES_STORE = 'services'
const META_STORE = 'meta'

function openAppDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(SERVICES_STORE)) {
        db.createObjectStore(SERVICES_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' })
      }
    },
  })
}

function isValidService(record: unknown): record is ServiceConfig {
  if (typeof record !== 'object' || record === null) return false
  const r = record as Record<string, unknown>
  if (typeof r.id !== 'string' || r.id === '') return false
  if (typeof r.label !== 'string' || r.label === '') return false
  if (typeof r.url !== 'string') return false
  if (!/^https:\/\/.+\..+/.test(r.url)) return false
  if (r.url.includes('replace-me.invalid')) return false
  if (typeof r.iconPath !== 'string') return false
  return true
}

// M5-FIX: 3000ms race — DB open vs timeout
function raceTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TIMEOUT')), ms)
    promise.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e: unknown) => { clearTimeout(timer); reject(e) },
    )
  })
}

/**
 * Read all services from IndexedDB.
 * Race: DB open vs 3000ms timeout.
 * Empty DB = first boot — expected, not an error.
 * ANY invalid record → discard ENTIRE array → { ok: false }
 */
export async function readServices(): Promise<Result<ServiceConfig[]>> {
  try {
    const db = await raceTimeout(openAppDB(), 3000)
    const records: unknown[] = await db.getAll(SERVICES_STORE)

    // Empty DB = first boot — expected, not an error.
    if (records.length === 0) {
      return { ok: false, error: 'EMPTY_DB' }
    }

    // Validate each record — ANY invalid → discard ENTIRE array
    for (const record of records) {
      if (!isValidService(record)) {
        return { ok: false, error: 'VALIDATION_FAILED' }
      }
    }

    return { ok: true, data: records as ServiceConfig[] }
  } catch {
    return { ok: false, error: 'DB_FAILURE' }
  }
}

/**
 * Write all services to IndexedDB.
 * @returns Result<void> — on success, caller must
 *   call setServices(inputArray). result.data does not exist.
 */
export async function writeServices(services: ServiceConfig[]): Promise<Result<void>> {
  // Validate ALL 9 records BEFORE opening write transaction
  for (const service of services) {
    if (!isValidService(service)) {
      return { ok: false, error: 'VALIDATION_FAILED' }
    }
  }

  try {
    const db = await openAppDB()
    const tx = db.transaction(SERVICES_STORE, 'readwrite')
    const store = tx.objectStore(SERVICES_STORE)
    await store.clear()
    for (const service of services) {
      await store.put(service)
    }
    await tx.done
    return { ok: true, data: undefined }
  } catch {
    return { ok: false, error: 'WRITE_FAILED' }
  }
}

/**
 * Read a meta value from the meta store.
 */
export async function readMeta(key: string): Promise<unknown> {
  try {
    const db = await openAppDB()
    const record = await db.get(META_STORE, key) as { key: string; value: unknown } | undefined
    return record?.value
  } catch {
    return undefined
  }
}

/**
 * Write a meta value to the meta store.
 */
export async function writeMeta(key: string, value: unknown): Promise<Result<void>> {
  try {
    const db = await openAppDB()
    await db.put(META_STORE, { key, value })
    return { ok: true, data: undefined }
  } catch {
    return { ok: false, error: 'META_WRITE_FAILED' }
  }
}

import { readMeta, writeMeta } from './storageService'

// No salt intentional. Purpose: prevent casual shoulder-surf, not
// cryptographic security. This is a local device PIN.

const LOCK_KEY = 'abu-lock-v1'
const ATTEMPT_KEY = 'abu-attempts-v1'

/**
 * Hash a 6-digit PIN string using SHA-256.
 * Returns 64-char lowercase hex string.
 */
export async function hashPIN(pin: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Verify a PIN against the stored hash.
 */
export async function verifyPIN(pin: string): Promise<boolean> {
  const storedHash = await readPINHash()
  if (!storedHash) return false
  const inputHash = await hashPIN(pin)
  return inputHash === storedHash
}

/**
 * Store the hashed PIN in the meta store.
 */
export async function storePINHash(pin: string): Promise<void> {
  const hashed = await hashPIN(pin)
  await writeMeta('pinHash', hashed)
}

/**
 * Read the stored PIN hash from the meta store.
 */
export async function readPINHash(): Promise<string | null> {
  const value = await readMeta('pinHash')
  if (typeof value === 'string' && value.length === 64) return value
  return null
}

/**
 * Read adminFirstBoot from the meta store.
 * Returns true if no value is stored (first boot).
 */
export async function readAdminFirstBoot(): Promise<boolean> {
  const value = await readMeta('adminFirstBoot')
  if (value === false) return false
  return true
}

/**
 * Mark first boot as complete in the meta store.
 * Sets adminFirstBoot to false.
 */
export async function setAdminFirstBootComplete(): Promise<void> {
  await writeMeta('adminFirstBoot', false)
}

/**
 * Track a failed PIN attempt. Increments counter in localStorage.
 */
export function trackAttempt(): number {
  const current = parseInt(localStorage.getItem(ATTEMPT_KEY) ?? '0', 10)
  const next = current + 1
  localStorage.setItem(ATTEMPT_KEY, String(next))
  if (next >= 5) {
    localStorage.setItem(LOCK_KEY, '1')
  }
  return next
}

/**
 * Check if admin is locked out (≥5 wrong attempts).
 * Lockout: no timer, no bypass, clears on app reload only.
 */
export function isLockedOut(): boolean {
  return localStorage.getItem(LOCK_KEY) === '1'
}

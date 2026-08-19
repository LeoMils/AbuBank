/**
 * entryFlow.test.ts — the deterministic core of the premium entry gate.
 *
 * Evidence class: CODE. This proves the LOGIC (fail-closed decision rules,
 * timing budget, local-PIN roundtrip + fail-closed verification, session
 * bookkeeping). It does NOT and cannot prove the real Face ID sheet, audible
 * sound, or on-device feel — those are PHYSICAL_DEVICE truths verified on an
 * iPhone (see the handover notes).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  decideEntry,
  RELOCK_AFTER_MS,
  isSessionWarm,
  markSessionWarm,
  recordHidden,
  readAwayMs,
  setPin,
  verifyPin,
  hasPin,
  hashPin,
  readLockConfig,
  writeLockConfig,
  type LockConfig,
} from '../../services/appLock'
import { INTRO, introTotalMs } from './introTiming'

// ── in-memory Storage shim (the node test env has no localStorage/sessionStorage) ──
class MemStore {
  private m = new Map<string, string>()
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null }
  setItem(k: string, v: string) { this.m.set(k, String(v)) }
  removeItem(k: string) { this.m.delete(k) }
  clear() { this.m.clear() }
}

beforeEach(() => {
  ;(globalThis as unknown as { localStorage: MemStore }).localStorage = new MemStore()
  ;(globalThis as unknown as { sessionStorage: MemStore }).sessionStorage = new MemStore()
})

const OFF: LockConfig = { protectionEnabled: false, biometricEnrolled: false }
const ON: LockConfig = { protectionEnabled: true, biometricEnrolled: true }

describe('decideEntry — the one entry rule (fail-closed)', () => {
  it('first-ever cold launch: intro then MANDATORY setup (never a silent open)', () => {
    expect(decideEntry({ coldLaunch: true, config: OFF, awayMs: null })).toEqual({
      showIntro: true,
      gate: 'setup',
    })
  })

  it('cold launch when protected: intro then auth', () => {
    expect(decideEntry({ coldLaunch: true, config: ON, awayMs: null })).toEqual({
      showIntro: true,
      gate: 'auth',
    })
  })

  it('resume within the window (protected): straight in, no intro, no auth', () => {
    expect(decideEntry({ coldLaunch: false, config: ON, awayMs: 5_000 })).toEqual({
      showIntro: false,
      gate: 'none',
    })
  })

  it('resume after inactivity (protected): re-auth, never re-intro', () => {
    const d = decideEntry({ coldLaunch: false, config: ON, awayMs: RELOCK_AFTER_MS + 1 })
    expect(d.showIntro).toBe(false)
    expect(d.gate).toBe('auth')
  })

  it('resume while NOT protected forces setup (cannot enter unprotected)', () => {
    const d = decideEntry({ coldLaunch: false, config: OFF, awayMs: 5_000 })
    expect(d.gate).toBe('setup')
  })

  it('exactly at the threshold re-locks', () => {
    expect(decideEntry({ coldLaunch: false, config: ON, awayMs: RELOCK_AFTER_MS }).gate).toBe('auth')
  })
})

describe('NO SILENT OPEN — the security invariant across the whole matrix', () => {
  it('an unprotected device is NEVER revealed without setup', () => {
    for (const cold of [true, false]) {
      for (const away of [null, 0, 1_000, RELOCK_AFTER_MS, RELOCK_AFTER_MS * 100]) {
        const d = decideEntry({ coldLaunch: cold, config: OFF, awayMs: away })
        expect(d.gate).toBe('setup') // never 'none', never 'auth-without-credential'
      }
    }
  })

  it('the ONLY way a protected device opens with gate "none" is a fresh resume', () => {
    // gate 'none' (no auth) must require: resume (not cold) AND within the window.
    const opens = (cold: boolean, away: number | null) =>
      decideEntry({ coldLaunch: cold, config: ON, awayMs: away }).gate === 'none'
    expect(opens(true, null)).toBe(false) // cold never opens without auth
    expect(opens(true, 0)).toBe(false)
    expect(opens(false, RELOCK_AFTER_MS)).toBe(false) // stale resume re-locks
    expect(opens(false, 0)).toBe(true) // fresh resume within window is the only pass
  })
})

describe('intro timing budget', () => {
  it('normal intro rests inside the 1.5s–2.2s target window', () => {
    const total = introTotalMs(false)
    expect(total).toBe(INTRO.drawMs + INTRO.holdMs + INTRO.fadeMs)
    expect(total).toBeGreaterThanOrEqual(1500)
    expect(total).toBeLessThanOrEqual(2200)
  })

  it('reduced-motion intro is shorter (no draw)', () => {
    expect(introTotalMs(true)).toBeLessThan(introTotalMs(false))
  })
})

describe('local PIN — set → verify, fail-closed', () => {
  it('set → verify roundtrip succeeds and enables protection', async () => {
    expect(hasPin()).toBe(false)
    const ok = await setPin('2468')
    expect(ok).toBe(true)
    expect(hasPin()).toBe(true)
    expect(readLockConfig().protectionEnabled).toBe(true)
    expect(await verifyPin('2468')).toBe(true)
  })

  it('a WRONG pin never verifies (stays locked)', async () => {
    await setPin('2468')
    expect(await verifyPin('0000')).toBe(false)
    expect(await verifyPin('')).toBe(false)
    expect(await verifyPin('24680')).toBe(false)
  })

  it('verifyPin is fail-closed when NO pin is configured', async () => {
    expect(hasPin()).toBe(false)
    expect(await verifyPin('1234')).toBe(false)
  })

  it('never stores the PIN in plaintext', async () => {
    await setPin('1357')
    const cfg = readLockConfig()
    expect(cfg.pinHash).toBeDefined()
    expect(JSON.stringify(cfg)).not.toContain('1357')
  })

  it('hashPin is deterministic per salt and salt-sensitive', async () => {
    const a = await hashPin('1234', 'saltA')
    const b = await hashPin('1234', 'saltA')
    const c = await hashPin('1234', 'saltB')
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('PIN verification is fail-closed on a subsystem error', () => {
  it('a hashing/crypto failure resolves to FALSE, not an open', async () => {
    await setPin('2468')
    expect(await verifyPin('2468')).toBe(true) // sanity with real crypto
    // Break the crypto subsystem — verification must DENY, never throw-open.
    const spy = vi.spyOn(crypto.subtle, 'digest').mockRejectedValue(new Error('subsystem down'))
    try {
      expect(await verifyPin('2468')).toBe(false)
    } finally {
      spy.mockRestore()
    }
  })
})

describe('session warmth + away bookkeeping', () => {
  it('starts cold, warms on mark', () => {
    expect(isSessionWarm()).toBe(false)
    markSessionWarm()
    expect(isSessionWarm()).toBe(true)
  })

  it('readAwayMs is null until a hide is recorded, then measures elapsed', () => {
    expect(readAwayMs(1_000)).toBe(null)
    recordHidden(1_000)
    expect(readAwayMs(1_000 + 42_000)).toBe(42_000)
  })

  it('writeLockConfig merges patches', () => {
    writeLockConfig({ biometricEnrolled: true })
    expect(readLockConfig().biometricEnrolled).toBe(true)
    expect(readLockConfig().protectionEnabled).toBe(false)
    writeLockConfig({ protectionEnabled: true })
    expect(readLockConfig().biometricEnrolled).toBe(true)
    expect(readLockConfig().protectionEnabled).toBe(true)
  })
})

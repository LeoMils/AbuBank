/**
 * entryFlow.test.ts — the deterministic core of the premium entry gate.
 *
 * Evidence class: CODE. This proves the LOGIC (decision rules, timing budget,
 * local-PIN roundtrip, session/away bookkeeping). It does NOT and cannot prove
 * the real Face ID sheet, audible sound, or on-device feel — those are
 * PHYSICAL_DEVICE truths verified on an iPhone (see the handover notes).
 */
import { describe, it, expect, beforeEach } from 'vitest'
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

const OFF: LockConfig = { protectionEnabled: false, biometricEnrolled: false, setupPromptSeen: false }
const ON: LockConfig = { protectionEnabled: true, biometricEnrolled: true, setupPromptSeen: true }

describe('decideEntry — the one entry rule', () => {
  it('first-ever cold launch: intro + offer setup, no forced auth', () => {
    expect(decideEntry({ coldLaunch: true, config: OFF, awayMs: null })).toEqual({
      showIntro: true,
      requireAuth: false,
      offerSetup: true,
    })
  })

  it('cold launch with protection on: intro + require auth, no setup', () => {
    expect(decideEntry({ coldLaunch: true, config: ON, awayMs: null })).toEqual({
      showIntro: true,
      requireAuth: true,
      offerSetup: false,
    })
  })

  it('cold launch after setup already dismissed (still unprotected): intro only', () => {
    const seen: LockConfig = { ...OFF, setupPromptSeen: true }
    expect(decideEntry({ coldLaunch: true, config: seen, awayMs: null })).toEqual({
      showIntro: true,
      requireAuth: false,
      offerSetup: false,
    })
  })

  it('resume within the window: no intro, no auth', () => {
    expect(decideEntry({ coldLaunch: false, config: ON, awayMs: 5_000 })).toEqual({
      showIntro: false,
      requireAuth: false,
      offerSetup: false,
    })
  })

  it('resume after the inactivity threshold: re-auth, never re-intro', () => {
    const d = decideEntry({ coldLaunch: false, config: ON, awayMs: RELOCK_AFTER_MS + 1 })
    expect(d.showIntro).toBe(false)
    expect(d.requireAuth).toBe(true)
  })

  it('resume never re-locks when protection is off', () => {
    const d = decideEntry({ coldLaunch: false, config: OFF, awayMs: RELOCK_AFTER_MS * 10 })
    expect(d.requireAuth).toBe(false)
  })

  it('resume with unknown away-time does not force auth', () => {
    const d = decideEntry({ coldLaunch: false, config: ON, awayMs: null })
    expect(d.requireAuth).toBe(false)
  })
})

describe('intro timing budget', () => {
  it('normal intro rests inside the 1.4s–2.2s target window', () => {
    const total = introTotalMs(false)
    expect(total).toBe(INTRO.drawMs + INTRO.holdMs + INTRO.fadeMs)
    expect(total).toBeGreaterThanOrEqual(1400)
    expect(total).toBeLessThanOrEqual(2200)
  })

  it('reduced-motion intro is shorter (no draw)', () => {
    expect(introTotalMs(true)).toBeLessThan(introTotalMs(false))
  })
})

describe('local PIN (salted SHA-256; never plaintext)', () => {
  it('set → verify roundtrip succeeds and enables protection', async () => {
    expect(hasPin()).toBe(false)
    const ok = await setPin('2468')
    expect(ok).toBe(true)
    expect(hasPin()).toBe(true)
    expect(readLockConfig().protectionEnabled).toBe(true)
    expect(await verifyPin('2468')).toBe(true)
    expect(await verifyPin('0000')).toBe(false)
  })

  it('never stores the PIN in plaintext', async () => {
    await setPin('1357')
    const cfg = readLockConfig()
    expect(cfg.pinHash).toBeDefined()
    expect(cfg.pinHash).not.toContain('1357')
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
    writeLockConfig({ setupPromptSeen: true })
    expect(readLockConfig().setupPromptSeen).toBe(true)
    expect(readLockConfig().protectionEnabled).toBe(false)
    writeLockConfig({ protectionEnabled: true })
    expect(readLockConfig().setupPromptSeen).toBe(true)
    expect(readLockConfig().protectionEnabled).toBe(true)
  })
})

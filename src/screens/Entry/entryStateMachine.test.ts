/*
 * entryStateMachine.test.ts — the auth-UX false-success escape, permanently. (Item 4)
 *
 * A physical-device test (Leo, iPhone) found: user set a 4-digit PIN, confirmed it,
 * was then asked for "another code", assumed it was the same PIN, was rejected, hit
 * "continue with code only", and entered a FULL-looking app with NO server session.
 *
 * These assertions lock the fix:
 *   • RESTRICTED is derived truthfully (configured server + no session → restricted).
 *   • DEVICE_ACTIVATION is unmistakably an OWNER (Leo) action, distinct from the PIN.
 *   • the skip is an honest "limited entry", not "continue with code only".
 *   • a global RestrictedBanner exists and is wired into the app shell (no false success).
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { deriveRestricted } from '../../services/serverAuth'

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, '../../..', rel), 'utf8')

describe('RESTRICTED derivation — no false success', () => {
  it('server configured + no session ⇒ RESTRICTED (a PIN-only entry is not full success)', () => {
    expect(deriveRestricted({ configured: true, enrolled: false, authed: false })).toBe(true)
    expect(deriveRestricted({ configured: true, enrolled: true, authed: false })).toBe(true)
  })
  it('a live server session ⇒ NOT restricted', () => {
    expect(deriveRestricted({ configured: true, enrolled: true, authed: true })).toBe(false)
  })
  it('server not configured (dev/local) ⇒ NOT restricted', () => {
    expect(deriveRestricted({ configured: false, enrolled: false, authed: false })).toBe(false)
  })
})

describe('DEVICE ACTIVATION is distinct from Martita’s PIN', () => {
  const gate = read('src/screens/Entry/AuthGate.tsx')
  it('activation is an explicit one-time OWNER action', () => {
    expect(gate).toContain('DeviceActivationStep')
    expect(gate).toContain('הפעלת המכשיר') // "Device activation" — not "enter a code"
    expect(gate).toContain('לא הקוד של מרתה') // "NOT Martita's PIN"
    expect(gate).toContain('ownerBadge')
  })
  it('the skip is an honest LIMITED entry, never "continue with code only"', () => {
    expect(gate).toContain('כניסה מוגבלת') // "limited entry"
    expect(gate).not.toContain('להמשיך עם הקוד בלבד') // the old confusing label is gone
  })
})

describe('the restricted state is surfaced (no false success)', () => {
  it('a global RestrictedBanner is wired into the app shell', () => {
    const app = read('src/App.tsx')
    expect(app).toContain('<RestrictedBanner />')
    const banner = read('src/screens/Entry/RestrictedBanner.tsx')
    expect(banner).toContain('deriveRestricted')
    expect(banner).toContain('מוגבל') // "limited" — plain language, no jargon
    // No developer jargon reaches Martita.
    for (const jargon of ['WebAuthn', 'passkey', 'token', 'session', 'ENROLLMENT_SECRET', 'credential']) {
      expect(banner.includes(jargon + '"') || banner.includes('>' + jargon)).toBe(false)
    }
  })
})

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { checkMicPreflight, isMicAvailable, MIC_CALM_MESSAGE } from './micPreflight'

const gum = { getUserMedia: () => Promise.resolve({}) }

describe('checkMicPreflight — secure-context guard (real iPhone P0)', () => {
  it('blocks an insecure context (http on a LAN IP — the real device failure)', () => {
    const r = checkMicPreflight({ isSecureContext: false, mediaDevices: gum, protocol: 'http:', hostname: '10.0.0.10' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toBe('insecure_context')
      // Dev reason names the real problem + the fix so Leo can act on it.
      expect(r.devReason.toLowerCase()).toContain('https')
      expect(r.devReason).toContain('10.0.0.10')
    }
  })

  it('insecure context wins even if a (non-functional) mediaDevices stub exists', () => {
    const r = checkMicPreflight({ isSecureContext: false, mediaDevices: gum, protocol: 'http:', hostname: '192.168.1.5' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('insecure_context')
  })

  it('blocks when mediaDevices is missing entirely', () => {
    const r = checkMicPreflight({ isSecureContext: true, mediaDevices: undefined })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('no_media_devices')
  })

  it('blocks when getUserMedia is not a function', () => {
    const r = checkMicPreflight({ isSecureContext: true, mediaDevices: {} })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('no_getusermedia')
  })

  it('allows a secure context with a working getUserMedia (localhost / https)', () => {
    const r = checkMicPreflight({ isSecureContext: true, mediaDevices: gum })
    expect(r.ok).toBe(true)
    expect(isMicAvailable({ isSecureContext: true, mediaDevices: gum })).toBe(true)
  })

  it('every blocked result carries the ONE calm, non-technical Hebrew message', () => {
    const blocked = [
      checkMicPreflight({ isSecureContext: false, mediaDevices: gum, hostname: 'x', protocol: 'http:' }),
      checkMicPreflight({ isSecureContext: true, mediaDevices: undefined }),
      checkMicPreflight({ isSecureContext: true, mediaDevices: {} }),
    ]
    for (const r of blocked) {
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.userMessage).toBe(MIC_CALM_MESSAGE)
        // Calm = no English/technical leakage to Martita.
        expect(r.userMessage).not.toMatch(/https|context|getUserMedia|API|error/i)
        expect(r.userMessage.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('AbuAI wires the guard so the mic-failure loop cannot happen', () => {
  const SRC = readFileSync(resolve(__dirname, '../screens/AbuAI/index.tsx'), 'utf8')

  it('enterVoiceMode runs the preflight before entering voice mode', () => {
    const enterIdx = SRC.indexOf('const enterVoiceMode')
    const setModeIdx = SRC.indexOf('voiceModeRef.current = true', enterIdx)
    const preflightIdx = SRC.indexOf('checkMicPreflight()', enterIdx)
    expect(preflightIdx).toBeGreaterThan(-1)
    // The guard must run BEFORE we commit to voice mode (no greeting/retry loop).
    expect(preflightIdx).toBeLessThan(setModeIdx)
  })

  it('the blocked branch returns early instead of greeting/retrying', () => {
    const idx = SRC.indexOf('if (!preflight.ok)')
    expect(idx).toBeGreaterThan(-1)
    // There is an early `return` in the blocked branch.
    expect(SRC.indexOf('return', idx)).toBeLessThan(SRC.indexOf('unlockIOSAudio()', idx))
  })
})

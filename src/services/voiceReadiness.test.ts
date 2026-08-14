/*
 * Voice-Readiness Pack (Cycle 48) — CODE-level, no device claims.
 *   1. Shared iOS mic constraints (one source; no primary capture uses bare audio:true).
 *   2. Per-user speech profile — NORMAL pace by default, changes only on explicit set.
 *   3. Cached warm openers — varied, warm, DEFAULT-OFF pending Leo's blind listening.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import { MIC_AUDIO_CONSTRAINTS, MIC_GETUSERMEDIA } from './audioConstraints'
import { getSpeechRate, setSpeechRate, hasExplicitRate } from './speechProfile'
import { warmOpenersEnabled, setWarmOpenersEnabled, getInstantOpener, timeSlotOf, allOpeners } from './warmOpeners'

let store: Record<string, string> = {}
beforeEach(() => {
  store = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v }, removeItem: (k: string) => { delete store[k] } })
})

describe('mic constraints — one iOS-tuned source', () => {
  it('carries all three constraints', () => {
    expect(MIC_AUDIO_CONSTRAINTS.echoCancellation).toBe(true)
    expect(MIC_AUDIO_CONSTRAINTS.noiseSuppression).toBe(true)
    expect(MIC_AUDIO_CONSTRAINTS.autoGainControl).toBe(true)
    expect(MIC_GETUSERMEDIA.audio).toBe(MIC_AUDIO_CONSTRAINTS)
  })

  it('no PRIMARY mic capture uses bare {audio:true} (bare is only the fallback)', () => {
    // Source-scan guard: every capture site must request the shared constraints first.
    // D7 · one voice engine: the AbuCalendar screen no longer captures (its mic routes
    // to Abu AI), so it is no longer a capture site. VoiceDebugPanel is a retained
    // dev-only diagnostic module that still uses the shared constraints.
    const root = path.resolve(__dirname, '..')
    const files = ['services/recording.ts', 'services/realtimeVoice.ts', 'screens/AbuCalendar/VoiceDebugPanel.tsx']
    for (const f of files) {
      const src = fs.readFileSync(path.join(root, f), 'utf8')
      expect(src, `${f} must reference the shared MIC_GETUSERMEDIA constraints`).toContain('MIC_GETUSERMEDIA')
    }
    // And the calendar screen must NOT reintroduce capture (the D7 guard).
    const cal = fs.readFileSync(path.join(root, 'screens/AbuCalendar/index.tsx'), 'utf8')
    expect(cal.includes('getUserMedia'), 'AbuCalendar screen must not capture (D7)').toBe(false)
  })
})

describe('speech profile — normal by default, explicit-only change', () => {
  it('defaults to NORMAL pace (1.0) for He and Es with no saved override', () => {
    expect(hasExplicitRate()).toBe(false)
    expect(getSpeechRate('he')).toBe(1.0)
    expect(getSpeechRate('es')).toBe(1.0)
  })
  it('honors an explicit user rate (and only then)', () => {
    setSpeechRate(0.9)
    expect(hasExplicitRate()).toBe(true)
    expect(getSpeechRate('he')).toBe(0.9)
  })
})

describe('warm openers — varied, warm, default-off', () => {
  it('is OFF by default (no behavior change until Leo approves)', () => {
    expect(warmOpenersEnabled()).toBe(false)
    setWarmOpenersEnabled(true)
    expect(warmOpenersEnabled()).toBe(true)
  })
  it('returns a warm, time-appropriate, single-sentence opener (Martita stays Latin)', () => {
    expect(timeSlotOf(8)).toBe('morning')
    expect(timeSlotOf(22)).toBe('night')
    const morning = getInstantOpener('he', 8, 0)
    expect(morning).toContain('בוקר טוב')
    expect(morning).toContain('Martita')
    const es = getInstantOpener('es', 20, 0)
    expect(/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(es)).toBe(true)
    expect(/[֐-׿]/.test(es)).toBe(false) // Spanish opener carries no Hebrew
  })
  it('rotates variants deterministically and every opener is a clean one-liner (no menu/emoji)', () => {
    const a = getInstantOpener('he', 8, 0)
    const b = getInstantOpener('he', 8, 1)
    expect(a).not.toBe(b) // different index → different variant
    for (const o of allOpeners()) {
      expect(o.length).toBeGreaterThan(4)
      expect(o.split(/[.!?]/).filter(s => s.trim().length > 1).length).toBeLessThanOrEqual(2) // ≤ one/two short sentences
      expect(o).not.toMatch(/\p{Extended_Pictographic}/u) // no emoji
      expect(o).not.toMatch(/לחצי|אפשרויות|תפריט/) // no menu words
    }
  })
})

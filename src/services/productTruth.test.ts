/**
 * PRODUCT TRUTH — regression net for the anti-guessing dashboard.
 * Proves the report is fed by REAL data, exposes the Web-Speech fallback
 * honestly, and resolves gender/pronoun deterministically from the graph.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getProductTruth,
  setProductTruth,
  resetProductTruth,
  recordLastPerson,
  formatProductTruthReport,
  CALENDAR_SOURCE_LOCAL,
} from './productTruth'
import { APP_VERSION } from '../version'

beforeEach(() => {
  const store: Record<string, string> = {}
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
  })
  resetProductTruth()
})

describe('PRODUCT TRUTH — build identity', () => {
  it('build fields come from version.ts, never invented', () => {
    const p = getProductTruth()
    expect(p.buildId).toBe(APP_VERSION.version)
    expect(p.commit).toBe(APP_VERSION.commitHint)
    expect(p.branch).toBe(APP_VERSION.branchHint)
  })

  it('cold start reports idle voice, no fabricated providers', () => {
    const p = getProductTruth()
    expect(p.voiceMode).toBe('idle')
    expect(p.sttProvider).toBe('n/a')
    expect(p.ttsProvider).toBe('n/a')
    expect(p.fallbackUsed).toBe(false)
  })
})

describe('PRODUCT TRUTH — honest Realtime fallback (never hidden)', () => {
  it('Realtime failure surfaces fallback + Web Speech, not silence', () => {
    setProductTruth({
      voiceMode: 'pipeline',
      realtimeStatus: 'fallback',
      fallbackUsed: true,
      sttProvider: 'Web Speech (fallback)',
      ttsProvider: 'pipeline TTS',
    })
    const p = getProductTruth()
    expect(p.realtimeStatus).toBe('fallback')
    expect(p.fallbackUsed).toBe(true)
    const report = formatProductTruthReport()
    expect(report).toContain('REALTIME_STATUS: fallback')
    expect(report).toContain('FALLBACK_USED:   YES')
    expect(report).toContain('Web Speech')
  })

  it('a working Realtime session reports realtime mode, no fallback', () => {
    setProductTruth({
      voiceMode: 'realtime',
      realtimeStatus: 'listening',
      fallbackUsed: false,
      sttProvider: 'Realtime (WebRTC)',
      ttsProvider: 'OpenAI Realtime',
    })
    const p = getProductTruth()
    expect(p.voiceMode).toBe('realtime')
    expect(p.fallbackUsed).toBe(false)
  })
})

describe('PRODUCT TRUTH — gender/pronoun resolved from the graph', () => {
  const graph = [
    { hebrew: 'מור', gender: 'female' },
    { hebrew: 'רפי', gender: 'male' },
  ]

  it('female person → female pronoun', () => {
    recordLastPerson('מור', graph)
    const p = getProductTruth()
    expect(p.lastPerson).toBe('מור')
    expect(p.lastGender).toBe('female')
    expect(p.lastPronoun).toContain('היא')
  })

  it('male person → male pronoun', () => {
    recordLastPerson('רפי', graph)
    const p = getProductTruth()
    expect(p.lastGender).toBe('male')
    expect(p.lastPronoun).toContain('הוא')
  })

  it('unknown person is not fabricated', () => {
    recordLastPerson('לאמישהו', graph)
    const p = getProductTruth()
    expect(p.lastGender).toBeNull()
  })
})

describe('PRODUCT TRUTH — calendar honesty', () => {
  it('states local-device-only, never implies live sync', () => {
    const p = getProductTruth()
    expect(p.calendarSource).toBe(CALENDAR_SOURCE_LOCAL)
    expect(p.calendarSource).toContain('no Google/Apple sync')
  })
})

describe('PRODUCT TRUTH — report format', () => {
  it('contains every operator field Leo asked for', () => {
    const report = formatProductTruthReport('2026-07-07T00:00:00Z')
    for (const field of [
      'BUILD_ID', 'COMMIT', 'VOICE_MODE', 'REALTIME_STATUS', 'STT_PROVIDER',
      'TTS_PROVIDER', 'FALLBACK_USED', 'LATENCY_MS', 'ROUTE', 'CALENDAR_SOURCE',
      'ONLINE_USED', 'MEMORY_USED', 'LAST_PERSON', 'LAST_GENDER', 'LAST_PRONOUN',
      'LAST_ERROR',
    ]) {
      expect(report).toContain(field)
    }
  })
})

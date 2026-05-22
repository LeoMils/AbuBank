import { describe, it, expect } from 'vitest'
import { shouldShowConfirmationReadback } from './voiceReadbackGuard'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const INDEX = readFileSync(resolve(__dirname, './index.tsx'), 'utf8')

describe('shouldShowConfirmationReadback — pure logic', () => {
  it('returns false when voiceState is error (failed_to_understand path)', () => {
    expect(shouldShowConfirmationReadback('error', { title: '', date: null, time: null })).toBe(false)
  })

  it('returns false when voiceState is error even with partial content', () => {
    expect(shouldShowConfirmationReadback('error', { title: 'פגישה', date: null, time: null })).toBe(false)
  })

  it('returns false when voiceState is error even with complete content', () => {
    expect(shouldShowConfirmationReadback('error', { title: 'פגישה', date: '2026-05-22', time: '14:00' })).toBe(false)
  })

  it('returns false when parsed is null', () => {
    expect(shouldShowConfirmationReadback('parsed', null)).toBe(false)
  })

  it('returns false when draft is empty (no title, no date, no time) even in parsed state', () => {
    expect(shouldShowConfirmationReadback('parsed', { title: '', date: null, time: null })).toBe(false)
  })

  it('returns false when title is only whitespace', () => {
    expect(shouldShowConfirmationReadback('parsed', { title: '   ', date: null, time: null })).toBe(false)
  })

  it('returns true when parsed state has title', () => {
    expect(shouldShowConfirmationReadback('parsed', { title: 'פגישה עם הרופא', date: null, time: null })).toBe(true)
  })

  it('returns true when parsed state has date', () => {
    expect(shouldShowConfirmationReadback('parsed', { title: '', date: '2026-05-22', time: null })).toBe(true)
  })

  it('returns true when parsed state has time', () => {
    expect(shouldShowConfirmationReadback('parsed', { title: '', date: null, time: '14:00' })).toBe(true)
  })

  it('returns true for complete draft in parsed state', () => {
    expect(shouldShowConfirmationReadback('parsed', { title: 'רופא שיניים', date: '2026-05-22', time: '10:00' })).toBe(true)
  })

  it('returns true during recording state with content (correction flow)', () => {
    expect(shouldShowConfirmationReadback('recording', { title: 'פגישה', date: '2026-05-22', time: '14:00' })).toBe(true)
  })
})

describe('Readback guard wiring in index.tsx', () => {
  it('index.tsx imports shouldShowConfirmationReadback', () => {
    expect(INDEX).toContain("import { shouldShowConfirmationReadback } from './voiceReadbackGuard'")
  })

  it('confirmationText is gated by shouldShowConfirmationReadback', () => {
    expect(INDEX).toContain('shouldShowConfirmationReadback(voiceState, voiceParsed)')
  })

  it('shapeCreateConfirmReadback is only called inside the guard (not unconditionally)', () => {
    // The readback function should appear AFTER the guard check, inside the ternary
    const guardIdx = INDEX.indexOf('shouldShowConfirmationReadback(voiceState, voiceParsed)')
    const readbackIdx = INDEX.indexOf('shapeCreateConfirmReadback({', guardIdx)
    expect(guardIdx).toBeGreaterThan(-1)
    expect(readbackIdx).toBeGreaterThan(guardIdx)
  })
})

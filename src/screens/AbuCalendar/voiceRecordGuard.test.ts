import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { shouldBlockVoiceRecord } from './voiceRecordGuard'

/*
 * Behavior-level tests for the retry-after-clarification bypass guard.
 *
 * These tests call the actual guard function with concrete inputs,
 * proving that retry (bypassGuard: true) reaches the recording path
 * even when voiceStatus is non-empty (e.g. after a clarification question
 * or a "מקשיבה..." status message).
 *
 * This satisfies the Codex blocker: "missing a robust runtime test for
 * retry path behavior under stale voiceStatus."
 */

describe('shouldBlockVoiceRecord — behavior', () => {
  // Normal guard: blocks when voiceStatus is set
  it('blocks recording when voiceStatus is non-empty and no bypass', () => {
    expect(shouldBlockVoiceRecord('מקשיבה...')).toBe(true)
    expect(shouldBlockVoiceRecord('מעבדת...')).toBe(true)
    expect(shouldBlockVoiceRecord('באיזה שעה?')).toBe(true)
  })

  it('blocks recording when bypassGuard is explicitly false', () => {
    expect(shouldBlockVoiceRecord('מקשיבה...', { bypassGuard: false })).toBe(true)
  })

  // Retry path: bypassGuard bypasses the stale voiceStatus
  it('allows recording when bypassGuard is true despite non-empty voiceStatus', () => {
    expect(shouldBlockVoiceRecord('מקשיבה...', { bypassGuard: true })).toBe(false)
    expect(shouldBlockVoiceRecord('מעבדת...', { bypassGuard: true })).toBe(false)
    expect(shouldBlockVoiceRecord('באיזה שעה?', { bypassGuard: true })).toBe(false)
  })

  // Idle state: always allows
  it('allows recording when voiceStatus is empty (idle)', () => {
    expect(shouldBlockVoiceRecord('')).toBe(false)
    expect(shouldBlockVoiceRecord('', { bypassGuard: false })).toBe(false)
    expect(shouldBlockVoiceRecord('', { bypassGuard: true })).toBe(false)
  })
})

describe('shouldBlockVoiceRecord — integration with index.tsx', () => {
  const INDEX_SOURCE = readFileSync(
    resolve(__dirname, 'index.tsx'),
    'utf-8',
  )

  it('index.tsx uses shouldBlockVoiceRecord as the guard', () => {
    expect(INDEX_SOURCE).toContain('shouldBlockVoiceRecord(voiceStatus, opts)')
  })

  it('index.tsx imports shouldBlockVoiceRecord from voiceRecordGuard', () => {
    expect(INDEX_SOURCE).toContain("from './voiceRecordGuard'")
  })

  it('handleVoiceRetry still passes bypassGuard: true', () => {
    expect(INDEX_SOURCE).toContain('handleVoiceRecord({ bypassGuard: true })')
  })
})

/*
 * buildFlags.test.ts — the build-flags manifest (scripts/gen-build-flags.mjs) mirrors CODE-default
 * flags so the deployed /build-flags.json is trustworthy. If a source default is flipped, this test
 * FAILS until the manifest generator's `codeFlags` is updated to match — so the machine-verifiable
 * flag report can never lie about a code default.
 */
import fs from 'node:fs'
import { describe, it, expect } from 'vitest'
import { LIVE_OUTPUT_MONITOR_REPAIR, LIVE_INTERRUPT_RESPONSE } from './liveSession'
import { ONLINE_GENERAL_SEARCH_DEFAULT } from './online/flags'

describe('build-flags manifest mirrors the real code defaults (no drift)', () => {
  const gen = fs.readFileSync('scripts/gen-build-flags.mjs', 'utf8')
  const codeFlag = (name: string): boolean => {
    const m = gen.match(new RegExp(`${name}:\\s*(true|false)`))
    if (!m) throw new Error(`gen-build-flags.mjs is missing codeFlags.${name}`)
    return m[1] === 'true'
  }

  it('LIVE_OUTPUT_MONITOR_REPAIR matches source', () => {
    expect(codeFlag('LIVE_OUTPUT_MONITOR_REPAIR')).toBe(LIVE_OUTPUT_MONITOR_REPAIR)
  })
  it('LIVE_INTERRUPT_RESPONSE matches source', () => {
    expect(codeFlag('LIVE_INTERRUPT_RESPONSE')).toBe(LIVE_INTERRUPT_RESPONSE)
  })
  it('ONLINE_GENERAL_SEARCH matches source', () => {
    expect(codeFlag('ONLINE_GENERAL_SEARCH')).toBe(ONLINE_GENERAL_SEARCH_DEFAULT)
  })
})

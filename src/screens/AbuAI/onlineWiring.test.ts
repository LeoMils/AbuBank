/*
 * AbuAI B2 — wiring source-contract tests
 *
 * vitest runs in node env (no DOM). These tests pin the wiring shape:
 *   1. Text-path order: grounded → proactive → ONLINE → personal → open
 *   2. Voice-path order: grounded → proactive → ONLINE → LLM
 *   3. Personal queries never hit the online endpoint at runtime
 *      (`shouldBlockOnlineForPersonal` is consulted on every call site).
 */

import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'

const SRC = fs.readFileSync(path.resolve(__dirname, 'index.tsx'), 'utf8')

describe('imports', () => {
  it('imports onlineIntent helpers', () => {
    expect(SRC.includes("import { isOnlineCurrentInfoQuery, shouldBlockOnlineForPersonal } from './onlineIntent'")).toBe(true)
  })
  it('imports onlineProvider client + error recorder', () => {
    expect(SRC.includes("import { answerOnlineCurrentInfo, _recordOnlineError } from './onlineProvider'")).toBe(true)
  })
})

describe('text path — order grounded → proactive → online → personal/open', () => {
  const start = SRC.indexOf('// ─── Existing grounded answer path')
  const end = SRC.indexOf('if (isPersonalQuery(msgText)) {')
  const block = SRC.slice(start, end)

  it('block is found', () => {
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
  })

  it('grounded → proactive → online order is preserved', () => {
    const groundedIdx = block.indexOf('tryGroundedAnswer(msgText)')
    const proactiveIdx = block.indexOf('getProactiveSeed(msgText')
    const onlineIdx = block.indexOf('isOnlineCurrentInfoQuery(msgText)')
    expect(groundedIdx).toBeGreaterThan(-1)
    expect(proactiveIdx).toBeGreaterThan(groundedIdx)
    expect(onlineIdx).toBeGreaterThan(proactiveIdx)
  })

  it('online step gates on the personal-block guard', () => {
    expect(block.includes('isOnlineCurrentInfoQuery(msgText) && !shouldBlockOnlineForPersonal(msgText)')).toBe(true)
  })

  it('online step calls answerOnlineCurrentInfo and records the last error code', () => {
    // B2.3 joint-opt: the call now passes a static locationHint so
    // the online endpoint can resolve Kfar Saba-relative cues.
    expect(/await answerOnlineCurrentInfo\(msgText(?:,\s*\{[^)]*locationHint[^)]*\})?\)/.test(block)).toBe(true)
    expect(block.includes('_recordOnlineError(null)')).toBe(true)
    expect(block.includes('_recordOnlineError(online.errorCode)')).toBe(true)
  })

  it('online step appends sources block when present', () => {
    expect(block.includes('online.sources && online.sources.length > 0')).toBe(true)
    expect(block.includes('מקורות:')).toBe(true)
  })
})

describe('voice path — order grounded → proactive → online → LLM', () => {
  // Voice block lives between voiceGrounded and clearTimeout(watchdog).
  const start = SRC.indexOf('const voiceGrounded = tryGroundedAnswer(text)')
  const end = SRC.indexOf('clearTimeout(watchdog)', start)
  const block = SRC.slice(start, end > start ? end : start + 2000)

  it('block is found', () => { expect(start).toBeGreaterThan(-1) })

  it('online step lives between proactive and sendMessage', () => {
    const proactiveIdx = block.indexOf('getProactiveSeed(text')
    const onlineIdx = block.indexOf('isOnlineCurrentInfoQuery(text)')
    const sendIdx = block.indexOf('await sendMessage(currentMsgs, true)')
    expect(proactiveIdx).toBeGreaterThan(-1)
    expect(onlineIdx).toBeGreaterThan(proactiveIdx)
    expect(sendIdx).toBeGreaterThan(onlineIdx)
  })

  it('voice online step blocks personal queries (defense in depth)', () => {
    expect(block.includes('isOnlineCurrentInfoQuery(text) && !shouldBlockOnlineForPersonal(text)')).toBe(true)
  })

  it('voice online step uses await answerOnlineCurrentInfo and records last error', () => {
    // B2.3 joint-opt: the call now passes a static locationHint so
    // the online endpoint can resolve Kfar Saba-relative cues.
    expect(/await answerOnlineCurrentInfo\(text(?:,\s*\{[^)]*locationHint[^)]*\})?\)/.test(block)).toBe(true)
    expect(block.includes('_recordOnlineError(null)')).toBe(true)
    expect(block.includes('_recordOnlineError(online.errorCode)')).toBe(true)
  })

  it('voice does not read sources aloud (success path uses plain answer)', () => {
    // The success branch sets `response = online.answer` — no sources
    // string concatenation in the voice block.
    expect(/online\.ok[\s\S]{0,200}response = online\.answer/.test(block)).toBe(true)
    expect(block.includes('מקורות:')).toBe(false)
  })
})

describe('AbuAI does NOT call the online endpoint for family / calendar queries', () => {
  // Source contract: every `answerOnlineCurrentInfo(...)` call site is
  // gated by `isOnlineCurrentInfoQuery(...) && !shouldBlockOnlineForPersonal(...)`.
  const allCallsRe = /answerOnlineCurrentInfo\(/g
  const matches = [...SRC.matchAll(allCallsRe)].map((m) => m.index ?? 0)

  it('there are exactly two call sites (text + voice)', () => {
    expect(matches.length).toBe(2)
  })

  it('every call site is preceded by isOnlineCurrentInfoQuery + shouldBlockOnlineForPersonal in the same expression', () => {
    for (const idx of matches) {
      const upstream = SRC.slice(Math.max(0, idx - 600), idx)
      expect(upstream.includes('isOnlineCurrentInfoQuery'),       `missing isOnlineCurrentInfoQuery before call at ${idx}`).toBe(true)
      expect(upstream.includes('!shouldBlockOnlineForPersonal'),  `missing shouldBlockOnlineForPersonal before call at ${idx}`).toBe(true)
    }
  })
})

describe('build version is bumped for operational AI voice & calendar', () => {
  it('APP_VERSION is the operational-ai-voice-calendar marker', () => {
    const verSrc = fs.readFileSync(path.resolve(__dirname, '../../version.ts'), 'utf8')
    expect(verSrc.includes("'0.4.16-operational-ai-voice-calendar'")).toBe(true)
    expect(verSrc.includes('AbuBank — Operational AI Voice & Calendar')).toBe(true)
  })
})

/*
 * AbuAI B1 — Checkpoint 3: source contract for the proactive wiring.
 *
 * vitest runs in node env (no DOM render), so we assert the wiring shape
 * in the source: the text path and the voice path BOTH consult
 * tryGroundedAnswer first, then getProactiveSeed, then the LLM, and a
 * shared `lastProactiveSeedIdRef` rotates the seed across calls.
 */

import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'

const SRC = fs.readFileSync(
  path.resolve(__dirname, 'index.tsx'),
  'utf8',
)

describe('proactive wiring — imports + state', () => {
  it('imports getProactiveSeed from ./proactive', () => {
    expect(SRC.includes("import { getProactiveSeed } from './proactive'")).toBe(true)
  })
  it('declares a lastProactiveSeedIdRef for rotation', () => {
    expect(SRC.includes('lastProactiveSeedIdRef = useRef<string | null>(null)')).toBe(true)
  })
})

describe('text path — grounded → proactive → personal/open ordering', () => {
  // The text-handler block sits between the "Existing grounded answer
  // path" comment and the "if (isPersonalQuery(msgText))" branch.
  const start = SRC.indexOf('// ─── Existing grounded answer path')
  const end = SRC.indexOf('if (isPersonalQuery(msgText)) {')
  const block = SRC.slice(start, end)

  it('text block contains tryGroundedAnswer call', () => {
    expect(block.includes('tryGroundedAnswer(msgText)')).toBe(true)
  })

  it('text block calls getProactiveSeed AFTER tryGroundedAnswer and BEFORE the LLM', () => {
    const groundedIdx = block.indexOf('tryGroundedAnswer(msgText)')
    const proactiveIdx = block.indexOf('getProactiveSeed(msgText')
    expect(groundedIdx).toBeGreaterThan(-1)
    expect(proactiveIdx).toBeGreaterThan(-1)
    expect(proactiveIdx).toBeGreaterThan(groundedIdx)
  })

  it('text proactive call uses lastProactiveSeedIdRef.current as previousSeedId', () => {
    expect(/getProactiveSeed\(msgText,\s*\{\s*previousSeedId:\s*lastProactiveSeedIdRef\.current/.test(SRC)).toBe(true)
  })

  it('text path stores the seed id back into lastProactiveSeedIdRef', () => {
    expect(SRC.includes('lastProactiveSeedIdRef.current = proactiveSeed.id')).toBe(true)
  })

  it('text path returns early when a proactive seed is produced (no LLM call)', () => {
    expect(/if \(proactiveSeed\)\s*\{[\s\S]*?streamingMsgIdRef\.current = null[\s\S]*?return\s*\}/.test(SRC)).toBe(true)
  })
})

describe('voice path — grounded → proactive → LLM ordering', () => {
  // The voice handler is around `tryGroundedAnswer(text)` followed by the
  // sendMessage(true) fallback.
  const voiceStart = SRC.indexOf('const voiceGrounded = tryGroundedAnswer(text)')
  // Skip past inline abort guard's clearTimeout to the main one after the streaming block
  const firstClear = SRC.indexOf('clearTimeout(watchdog)', voiceStart)
  const voiceEnd = SRC.indexOf('clearTimeout(watchdog)', firstClear + 1)
  const voiceBlock = SRC.slice(voiceStart, voiceEnd > voiceStart ? voiceEnd : voiceStart + 3000)

  it('voice block exists', () => {
    expect(voiceStart).toBeGreaterThan(-1)
  })
  it('voice block calls tryGroundedAnswer first', () => {
    expect(voiceBlock.includes('tryGroundedAnswer(text)')).toBe(true)
  })
  it('voice block consults getProactiveSeed before LLM streaming', () => {
    const groundedIdx = voiceBlock.indexOf('tryGroundedAnswer(text)')
    const proactiveIdx = voiceBlock.indexOf('getProactiveSeed(text')
    const sendIdx = voiceBlock.indexOf('streamMessage(currentMsgs, true')
    expect(proactiveIdx).toBeGreaterThan(groundedIdx)
    expect(sendIdx).toBeGreaterThan(proactiveIdx)
  })
  it('voice block uses the same lastProactiveSeedIdRef rotation', () => {
    expect(/getProactiveSeed\(text,\s*\{\s*previousSeedId:\s*lastProactiveSeedIdRef\.current/.test(voiceBlock)).toBe(true)
    expect(voiceBlock.includes('lastProactiveSeedIdRef.current = voiceProactive.id')).toBe(true)
  })
  it('voice block falls through to streaming LLM only when neither grounded nor proactive matched', () => {
    // Pattern: response = voiceGrounded (when not null) OR proactive text OR streamMessage
    expect(voiceBlock.includes('voiceGrounded !== null')).toBe(true)
    expect(voiceBlock.includes('streamMessage(currentMsgs, true')).toBe(true)
  })
})

describe('proactive never answers personal/family/calendar', () => {
  it('proactive intents are limited to boredom / no_topic / loneliness / ideas (source contract)', () => {
    const proactive = fs.readFileSync(
      path.resolve(__dirname, 'proactive.ts'),
      'utf8',
    )
    const t = proactive.match(/export type ProactiveIntent = ([^\n]+)/)
    expect(t).not.toBeNull()
    const intents = (t as RegExpMatchArray)[1] ?? ''
    expect(intents.includes("'boredom'")).toBe(true)
    expect(intents.includes("'no_topic'")).toBe(true)
    expect(intents.includes("'loneliness'")).toBe(true)
    expect(intents.includes("'ideas'")).toBe(true)
    // Must NOT include calendar/family-shaped intents.
    expect(intents.includes("'calendar'")).toBe(false)
    expect(intents.includes("'family'")).toBe(false)
  })
})

/*
 * liveInstructions.test.ts — Milestone 2 evidence (CODE class).
 *
 * Proves the build-time assembly contract: persona first then knowledge verbatim,
 * editor preamble stripped, labeled OpenAI-Realtime sections present, feminine +
 * bilingual framing, and the phone-number guard that fails the build. These prove
 * the STRING is assembled correctly — NOT that Abu sounded warm on a device.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  buildLiveInstructions,
  stripEditorPreamble,
  findPhoneNumbers,
  assertNoPhoneNumbers,
  ABU_PERSONA,
  ABU_FAMILY,
  ABU_KNOWLEDGE,
} from './liveInstructions'

const KNOWLEDGE_DIR = path.resolve(__dirname, '../../knowledge')

describe('stripEditorPreamble', () => {
  it('drops everything up to and including the first --- rule', () => {
    const out = stripEditorPreamble('# Title\nnote to editor\n\n---\n\n## Real\nkept line')
    expect(out).toBe('## Real\nkept line')
    expect(out).not.toContain('note to editor')
  })

  it('handles CRLF and returns trimmed content after the rule', () => {
    const out = stripEditorPreamble('preamble\r\n---\r\nbody\r\n')
    expect(out).toBe('body')
  })

  it('returns the whole text (trimmed) when there is no rule', () => {
    expect(stripEditorPreamble('  just body  ')).toBe('just body')
  })
})

describe('findPhoneNumbers / assertNoPhoneNumbers', () => {
  it('flags Israeli-mobile and international shapes', () => {
    expect(findPhoneNumbers('call 052-123-4567 now').length).toBe(1)
    expect(findPhoneNumbers('+972 50 123 4567').length).toBe(1)
    expect(findPhoneNumbers('0521234567').length).toBe(1)
  })

  it('does NOT flag years, ages, or dates', () => {
    expect(findPhoneNumbers('born 1945, age 80, on 2026-08-09')).toEqual([])
  })

  it('assertNoPhoneNumbers throws on a hit and is silent when clean', () => {
    expect(() => assertNoPhoneNumbers('reach 054-9876543', 'x')).toThrow(/phone number/)
    expect(() => assertNoPhoneNumbers('no numbers here', 'x')).not.toThrow()
  })

  it('the shipped knowledge files contain no phone numbers', () => {
    for (const f of ['abu-persona.md', 'abu-family.md', 'abu-knowledge.md']) {
      const raw = fs.readFileSync(path.join(KNOWLEDGE_DIR, f), 'utf8')
      expect(findPhoneNumbers(raw)).toEqual([])
    }
  })
})

describe('buildLiveInstructions', () => {
  const out = buildLiveInstructions()

  it('carries the labeled OpenAI-Realtime sections', () => {
    for (const h of [
      '# Role and Objective',
      '# Personality and Tone',
      '# Language',
      '# What Abu Knows — Family',
      '# What Abu Knows — Martita',
      '# Tools and Actions',
      '# Before a Tool Call',
      '# Length',
      '# Unclear Audio',
    ]) {
      expect(out).toContain(h)
    }
  })

  it('places the persona BEFORE the family knowledge, and family before Martita profile', () => {
    expect(out.indexOf('# Personality and Tone')).toBeLessThan(out.indexOf('# What Abu Knows — Family'))
    expect(out.indexOf('# What Abu Knows — Family')).toBeLessThan(out.indexOf('# What Abu Knows — Martita'))
    // the bodies are embedded in the same order: persona, then family, then profile
    if (ABU_PERSONA.length > 0 && ABU_FAMILY.length > 0) {
      expect(out.indexOf(ABU_PERSONA)).toBeGreaterThanOrEqual(0)
      expect(out.indexOf(ABU_FAMILY)).toBeGreaterThan(out.indexOf(ABU_PERSONA))
    }
  })

  it('embeds the family + knowledge files verbatim (their content, not a paraphrase)', () => {
    expect(out).toContain(ABU_FAMILY)
    if (ABU_KNOWLEDGE.length > 0) expect(out).toContain(ABU_KNOWLEDGE)
  })

  it('binds the tool/action truth rules (id-only contacts, prepare-only comms, no web for family/calendar)', () => {
    expect(out).toContain('resolve_contact')
    expect(out).toMatch(/never send a message or place a call/i)
    expect(out).toMatch(/NEVER from web search/i)
  })

  it('states Abu is female and bilingual (feminine Hebrew + Rioplatense Spanish)', () => {
    expect(out).toContain('feminine')
    expect(out).toMatch(/Rioplatense/i)
  })

  it('does not leak the editor preamble note-to-Leo into the prompt', () => {
    expect(out).not.toContain('טיוטה')
    expect(out).not.toContain('ליאו עורך')
  })

  it('contains no phone numbers', () => {
    expect(findPhoneNumbers(out)).toEqual([])
  })
})

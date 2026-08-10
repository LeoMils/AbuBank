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
  buildPronunciationGuidance,
  buildTranscriptionPrompt,
  stripEditorPreamble,
  findPhoneNumbers,
  assertNoPhoneNumbers,
  auditInstructionsVsTools,
  TOOLLESS_CAPABILITY_GUARD,
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

describe('name pronunciation guidance (read the Latin spelling as Spanish)', () => {
  it('projects a person\'s pronunciation map into a per-language bullet', () => {
    const g = buildPronunciationGuidance({
      family: {
        children: [
          { canonical_name: 'Leo', hebrew_name: 'לאו', pronunciation: { es: 'leo' } },
          { canonical_name: 'Mor', hebrew_name: 'מור' }, // no pronunciation → omitted
        ],
      },
    })
    expect(g).toContain('לאו (Leo)')
    expect(g).toContain('Spanish: leo')
    expect(g).not.toContain('מור') // people without a pronunciation are not listed
  })

  it('is empty when no one carries a pronunciation (section is then omitted)', () => {
    expect(buildPronunciationGuidance({ family: { children: [{ canonical_name: 'Mor', hebrew_name: 'מור' }] } })).toBe('')
  })

  it('the real store reads every listed person by their exact Spanish Latin spelling', () => {
    const g = buildPronunciationGuidance() // real family_data.json
    const expected: Record<string, string> = {
      'לאו (Leo)': 'leo', 'מור (Mor)': 'mor', 'רפי (Raphi)': 'rafi', 'אופיר (Ofir)': 'ofir',
      'איילון (Ayalon)': 'eilon', 'עילי (Eili)': 'ilay', 'אדר (Adar)': 'adar',
      'עדי (Adi)': 'adi', 'נועם (Noam)': 'noam', 'ירדן (Yarden)': 'yarden', 'גלעד (Gilad)': 'gilad',
      'אנאבל (Anabel)': 'anabel', 'ארי (Ari)': 'ari', 'יעל (Yael)': 'yael',
      'מרטיטה (Martita)': 'martita', 'פפי (Papi)': 'papi',
    }
    for (const [name, es] of Object.entries(expected)) {
      expect(g, `${name} → ${es}`).toContain(`- ${name} — Spanish: ${es}`)
    }
  })

  it('the seeded family: names are read as Spanish, by their Latin spelling (no invented respellings)', () => {
    const out = buildLiveInstructions()
    expect(out).toContain('# How to Say Names (Pronunciation)')
    expect(out).toMatch(/READING ITS LATIN SPELLING AS SPANISH/i)
    expect(out).toMatch(/no English vowel shifts/i)
    // the exact Latin spellings Leo supplied — Leo → "leo", Ayalon read as "eilon"
    expect(out).toContain('לאו (Leo) — Spanish: leo')
    expect(out).toContain('איילון (Ayalon) — Spanish: eilon')
    // the old free-text respelling is gone
    expect(out).not.toContain('LEH-oh')
    // the section sits after the family knowledge and before the tools
    expect(out.indexOf('# How to Say Names (Pronunciation)')).toBeGreaterThan(out.indexOf('# What Abu Knows — Family'))
    expect(out.indexOf('# How to Say Names (Pronunciation)')).toBeLessThan(out.indexOf('# Tools and Actions'))
  })
})

describe('buildTranscriptionPrompt (Hebrew transcription bias)', () => {
  it('declares Hebrew and biases toward family names + common request phrasings', () => {
    const p = buildTranscriptionPrompt()
    expect(p).toContain('בעברית')
    expect(p).toContain('מור')            // a family Hebrew name
    expect(p).toContain('לאו')
    expect(p).toContain('תקבעי לי תור')   // a common request phrasing
  })

  it('includes Hebrew aliases and excludes Latin ones (the transcriber hint is Hebrew)', () => {
    const p = buildTranscriptionPrompt({ family: { children: [{ hebrew_name: 'לאו', aliases: ['ליאו', 'Leo'] }] } })
    expect(p).toContain('לאו')
    expect(p).toContain('ליאו')
    expect(p).not.toContain('Leo')
  })

  it('contains no phone numbers (built from names/phrasings only)', () => {
    expect(findPhoneNumbers(buildTranscriptionPrompt())).toEqual([])
  })
})

describe('instructions-vs-tools honesty guard', () => {
  const out = buildLiveInstructions()
  it('the assembled instructions imply NO capability without a registered tool', () => {
    // If this fails, a capability was offered/implied that Abu cannot actually do —
    // remove it, or add the real tool. This is the gate guard, run here + in qa.
    expect(auditInstructionsVsTools()).toEqual([])
  })

  it('the removed toolless capabilities are each explicitly disclaimed', () => {
    for (const cap of TOOLLESS_CAPABILITY_GUARD) {
      if (cap.requiredDecline) expect(out, `missing decline for ${cap.id}`).toMatch(cap.requiredDecline)
    }
  })

  it('the persona no longer implies news / weather / cross-session memory / cinema', () => {
    for (const phrase of ['חדשות מהארץ', 'חדשות מהעולם', 'זוכרת מי עשה מה', 'מה שסיפרה אתמול', 'מה יש בקולנוע']) {
      expect(out, `still implies "${phrase}"`).not.toContain(phrase)
    }
  })

  it('the guard actually has teeth — a re-added claim IS caught', () => {
    // Re-introducing a claim phrase into the text is flagged.
    const withNews = out + '\nמספרת חדשות מהעולם כל בוקר.'
    const v1 = auditInstructionsVsTools(withNews)
    expect(v1.some((x) => x.includes('news/current-events'))).toBe(true)
    // Removing a required "cannot" statement is flagged.
    const withoutWeatherDecline = out.replace(/do NOT know the weather today/i, 'knows the weather')
    const v2 = auditInstructionsVsTools(withoutWeatherDecline)
    expect(v2.some((x) => x.includes('weather'))).toBe(true)
  })
})

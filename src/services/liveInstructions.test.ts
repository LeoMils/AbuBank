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
  assertInstructionsWithinLimit,
  REALTIME_INSTRUCTIONS_MAX,
  assertTranscriptionWithinLimit,
  assertSessionPayloadWithinLimits,
  TRANSCRIPTION_PROMPT_MAX,
  TOOLLESS_CAPABILITY_GUARD,
  ABU_PERSONA,
  ABU_FAMILY,
  ABU_KNOWLEDGE,
} from './liveInstructions'
import { buildSessionUpdate, sessionPayloadSize } from './liveSession'

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
      '# Family and People',
      '# עוד על מרתה עצמה',
      '# Tools and Actions',
      '# Before a Tool Call',
      '# Length',
      '# Unclear Audio',
    ]) {
      expect(out).toContain(h)
    }
  })

  it('the family is IN HER HEAD — the generated portrait is embedded (Companion Brain, Phase 3)', () => {
    // The durable family/friends/history now lives in the instructions (measured limit ≥200k).
    // people_lookup stays, but only to REACH someone or double-check — not to learn who family is.
    expect(out).toContain('# Family and People — you KNOW them')
    expect(out).toContain('מי המשפחה של מרתה')  // the portrait's family section
    expect(out).toContain('החברים של מרתה')      // "who are my friends" is answerable from the head
    expect(out).toContain('מור')                  // real people are held, in warmth
    expect(out).toContain('סוזי רז')
    expect(out).toMatch(/you KNOW them/i)
    expect(out).not.toContain(ABU_FAMILY)         // NOT the legacy abu-family.md prose — generated from data
    expect(out).toContain('people_lookup')        // still present, for reaching/verifying
    expect(out.indexOf('# Personality and Tone')).toBeLessThan(out.indexOf('# Family and People'))
  })

  it('embeds Martita\'s own profile verbatim (family graph excluded)', () => {
    if (ABU_KNOWLEDGE.length > 0) expect(out).toContain(ABU_KNOWLEDGE)
  })

  it('binds the tool/action truth rules (people_lookup for people, prepare-only comms, no web for family/calendar)', () => {
    expect(out).toContain('people_lookup') // reaching a person now goes through the one people tool
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

  it('pronunciation is a RULE in the prompt, not a per-person enumeration (the list lives behind people_lookup)', () => {
    const out = buildLiveInstructions()
    expect(out).toContain('# How to Say Names (Pronunciation)')
    expect(out).toMatch(/READING ITS LATIN SPELLING AS SPANISH/i)
    expect(out).toMatch(/no English vowel shifts/i)
    // The per-person enumeration is GONE from the prompt (it bloated the instructions
    // past the provider cap — string_above_max_length on device). The rule applies to
    // whatever people_lookup returns; the spoken forms travel with the tool data.
    expect(out).not.toContain('לאו (Leo) — Spanish: leo')
    expect(out).not.toContain('איילון (Ayalon) — Spanish: eilon')
    expect(out).not.toMatch(/— Spanish: \w+/) // no "— Spanish: <form>" bullets remain
    // the old free-text respelling is gone too
    expect(out).not.toContain('LEH-oh')
    // the section sits after Martita's profile and before the tools
    expect(out.indexOf('# How to Say Names (Pronunciation)')).toBeGreaterThan(out.indexOf('# עוד על מרתה עצמה'))
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

describe('provider instruction-length guard (device blocker: string_above_max_length)', () => {
  it('the assembled instructions are within the provider cap', () => {
    expect(buildLiveInstructions().length).toBeLessThanOrEqual(REALTIME_INSTRUCTIONS_MAX)
  })

  it('the ACTUAL sent string (instructions + today line) is within the cap', () => {
    // buildSessionUpdate sends buildLiveInstructions() + the runtime "today" line —
    // that concatenation is what the provider validates, so THAT is what must fit.
    const update = buildSessionUpdate(Date.UTC(2026, 7, 12)) as { session: { instructions: string } }
    const sent = update.session.instructions
    expect(sent.length).toBeLessThanOrEqual(REALTIME_INSTRUCTIONS_MAX)
    expect(() => assertInstructionsWithinLimit(sent)).not.toThrow()
  })

  it('the guard has teeth — it THROWS (fails the build) when instructions exceed the cap', () => {
    const over = 'x'.repeat(REALTIME_INSTRUCTIONS_MAX + 1)
    expect(() => assertInstructionsWithinLimit(over)).toThrow(/string_above_max_length/)
    expect(() => assertInstructionsWithinLimit(over)).toThrow(new RegExp(`${REALTIME_INSTRUCTIONS_MAX}-char cap`))
    // and reports the measured size in the error
    expect(() => assertInstructionsWithinLimit(over)).toThrow(new RegExp(`${REALTIME_INSTRUCTIONS_MAX + 1} chars`))
  })

  it('a string exactly at the cap is allowed (boundary)', () => {
    expect(() => assertInstructionsWithinLimit('x'.repeat(REALTIME_INSTRUCTIONS_MAX))).not.toThrow()
  })
})

describe('transcription.prompt cap — the field that ACTUALLY broke on device (1034 > 1024)', () => {
  it('the provider cap is 1024 chars (documented by the provider error we cited)', () => {
    expect(TRANSCRIPTION_PROMPT_MAX).toBe(1024)
  })

  it('the built transcription prompt is within the provider cap, with real 67-person family data', () => {
    const p = buildTranscriptionPrompt()
    expect(p.length).toBeLessThanOrEqual(TRANSCRIPTION_PROMPT_MAX)
    // it still carries the closest family + the request phrasings (bias not gutted)
    expect(p).toContain('מור')
    expect(p).toContain('לאו')
    expect(p).toContain('תקבעי לי תור')
    expect(() => assertTranscriptionWithinLimit(p)).not.toThrow()
  })

  it('the guard THROWS with the field name + measured size when the prompt is over the cap', () => {
    const over = 'x'.repeat(TRANSCRIPTION_PROMPT_MAX + 1)
    expect(() => assertTranscriptionWithinLimit(over)).toThrow(/transcription\.prompt/)
    expect(() => assertTranscriptionWithinLimit(over)).toThrow(/string_above_max_length/)
    expect(() => assertTranscriptionWithinLimit(over)).toThrow(new RegExp(`${TRANSCRIPTION_PROMPT_MAX + 1} chars`))
  })

  it('the whole-payload guard fails if ANY capped field is over — instructions OR transcription', () => {
    // the real assembled fields pass
    expect(() => assertSessionPayloadWithinLimits()).not.toThrow()
    // an over-cap transcription prompt is caught by the payload guard
    expect(() =>
      assertSessionPayloadWithinLimits({ transcriptionPrompt: 'x'.repeat(TRANSCRIPTION_PROMPT_MAX + 1) }),
    ).toThrow(/transcription\.prompt/)
    // an over-cap instructions string is caught too
    expect(() =>
      assertSessionPayloadWithinLimits({ instructions: 'x'.repeat(REALTIME_INSTRUCTIONS_MAX + 1) }),
    ).toThrow(/string_above_max_length/)
  })

  it('EVERY provider-capped field of the REAL assembled payload is within its limit', () => {
    // This is the assertion that would have caught the device blocker: measure the real
    // session.update fields against the real provider caps.
    const update = buildSessionUpdate(Date.UTC(2026, 7, 12)) as {
      session: { instructions: string; audio: { input: { transcription: { prompt: string } } } }
    }
    expect(update.session.instructions.length).toBeLessThanOrEqual(REALTIME_INSTRUCTIONS_MAX)
    expect(update.session.audio.input.transcription.prompt.length).toBeLessThanOrEqual(TRANSCRIPTION_PROMPT_MAX)
  })

  it('reports the real assembled payload size (recorded on the trace connection line)', () => {
    const size = sessionPayloadSize(Date.UTC(2026, 7, 12))
    expect(size.chars).toBeGreaterThan(0)
    expect(size.bytes).toBeGreaterThanOrEqual(size.chars) // utf-8 Hebrew inflates bytes ≥ chars
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

  it('the persona does not claim a STILL-toolless capability (memory across sessions)', () => {
    // news / weather / cinema now have get_current_info, so they are no longer here.
    for (const phrase of ['זוכרת מי עשה מה', 'מה שסיפרה אתמול']) {
      expect(out, `still implies "${phrase}"`).not.toContain(phrase)
    }
  })

  it('offers get_current_info and forbids answering a current fact from memory', () => {
    expect(out).toContain('get_current_info')
    expect(out).toMatch(/NEVER answer a current fact from your own memory/i)
  })

  it('the guard actually has teeth — a re-added toolless claim IS caught', () => {
    // memory-across-sessions and games are still toolless and still guarded.
    const withMemory = out + '\nזוכרת מה שסיפרה אתמול בשיחה.'
    expect(auditInstructionsVsTools(withMemory).some((x) => x.includes('memory-across-sessions'))).toBe(true)
    // Removing a required "cannot" statement (games) is flagged.
    const withoutGamesDecline = out.replace(/have no games/i, 'loves playing games')
    expect(auditInstructionsVsTools(withoutGamesDecline).some((x) => x.includes('games'))).toBe(true)
  })
})

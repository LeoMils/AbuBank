/*
 * AbuAI B1 patch — Checkpoint 1
 *
 * Pins the unified personal-query classifier:
 *   isPersonalQuery(text) === (routePersonalQuery(text).type !== 'non_personal')
 * Covers Spanish / English / mixed-language calendar + family questions
 * and the open-topic guard that keeps culture/recommendation queries on
 * the streamed open path.
 *
 * No real phone numbers, no real PII; all family names below come from
 * the public scaffold via loadFamilyData().
 */

import { describe, it, expect } from 'vitest'
import { routePersonalQuery, resolveKnownFamilyName } from './router'
import { isPersonalQuery } from './service'
import { loadFamilyData } from '../../services/familyLoader'

// ─── Calendar — Spanish ─────────────────────────────────────────────────────

describe('routePersonalQuery — Spanish calendar', () => {
  const cases: Array<[string, string]> = [
    ['¿Qué tengo hoy?',                'calendar_today'],
    ['Que tengo hoy?',                 'calendar_today'],
    ['¿Qué tengo mañana?',             'calendar_tomorrow'],
    ['Que tengo manana?',              'calendar_tomorrow'],
    ['¿Qué tengo esta semana?',        'calendar_upcoming'],
    ['¿Cuándo tengo médico?',          'calendar_upcoming'],
    ['Cuando tengo medico',            'calendar_upcoming'],
    ['Calendario de hoy',              'calendar_today'],
    ['Agenda de mañana',               'calendar_tomorrow'],
  ]
  for (const [q, expected] of cases) {
    it(`"${q}" → ${expected}`, () => {
      expect(routePersonalQuery(q).type).toBe(expected)
    })
  }
})

// ─── Calendar — English ─────────────────────────────────────────────────────

describe('routePersonalQuery — English calendar', () => {
  const cases: Array<[string, string]> = [
    ['What do I have today?',          'calendar_today'],
    ['What is on today?',              'calendar_today'],
    ["Today's calendar",               'calendar_today'],
    ['What do I have tomorrow?',       'calendar_tomorrow'],
    ['Tomorrow appointments',          'calendar_tomorrow'],
    ['What this week?',                'calendar_upcoming'],
    ['Upcoming appointments',          'calendar_upcoming'],
    ['My calendar today',              'calendar_today'],
  ]
  for (const [q, expected] of cases) {
    it(`"${q}" → ${expected}`, () => {
      expect(routePersonalQuery(q).type).toBe(expected)
    })
  }
})

// ─── Mixed-language calendar ────────────────────────────────────────────────

describe('routePersonalQuery — mixed-language calendar', () => {
  it('"מה יש לי היום en el calendario" → calendar_today (HE wins, ES decoration ignored)', () => {
    expect(routePersonalQuery('מה יש לי היום en el calendario').type).toBe('calendar_today')
  })
})

// ─── Family — Spanish / English ─────────────────────────────────────────────

describe('routePersonalQuery — Spanish/English family questions', () => {
  // Use the first known person's actual canonical alias so the test is
  // resilient to scaffold edits.
  const family = loadFamilyData()
  const leoMember = family.find((m) => m.canonicalName?.toLowerCase().includes('leo'))
                 ?? family.find((m) => m.aliases?.some((a) => a.toLowerCase() === 'leo'))
  const leoAlias = leoMember?.canonicalName ?? leoMember?.hebrew ?? null
  const morMember = family.find((m) => m.canonicalName?.toLowerCase().includes('mor'))
                 ?? family.find((m) => m.aliases?.some((a) => a.toLowerCase() === 'mor'))
  const morAlias = morMember?.canonicalName ?? morMember?.hebrew ?? null
  const adarMember = family.find((m) => m.canonicalName?.toLowerCase().includes('adar'))
                  ?? family.find((m) => m.aliases?.some((a) => a.toLowerCase() === 'adar'))
  const adarAlias = adarMember?.canonicalName ?? adarMember?.hebrew ?? null

  it('family scaffold contains Leo / Mor / Adar (sanity)', () => {
    expect(leoAlias).not.toBeNull()
    expect(morAlias).not.toBeNull()
    expect(adarAlias).not.toBeNull()
  })

  it('"Háblame de Leo" → family_lookup', () => {
    expect(routePersonalQuery('Háblame de Leo').type).toBe('family_lookup')
  })
  it('"Hablame de Leo" → family_lookup (no accents)', () => {
    expect(routePersonalQuery('Hablame de Leo').type).toBe('family_lookup')
  })
  it('"Cuéntame de Mor" → family_lookup', () => {
    expect(routePersonalQuery('Cuéntame de Mor').type).toBe('family_lookup')
  })
  it('"¿Quién es Adar?" → family_lookup', () => {
    expect(routePersonalQuery('¿Quién es Adar?').type).toBe('family_lookup')
  })
  it('"Quien es Adar?" → family_lookup (no accents)', () => {
    expect(routePersonalQuery('Quien es Adar?').type).toBe('family_lookup')
  })
  it('"Tell me about Leo" → family_lookup', () => {
    expect(routePersonalQuery('Tell me about Leo').type).toBe('family_lookup')
  })
  it('"Who is Mor?" → family_lookup', () => {
    expect(routePersonalQuery('Who is Mor?').type).toBe('family_lookup')
  })
})

// ─── Open-topic guard — must stay non_personal ──────────────────────────────

describe('routePersonalQuery — open-topic guard keeps culture/recommendation OPEN', () => {
  const cases = [
    'Contame sobre Italia',
    'Cuéntame sobre Italia',
    'Tell me about Italy',
    'Contame sobre Argentina',
    'Recomendame un podcast',
    'Recomiéndame un podcast',
    'Quiero hablar de una película',
    'Contame una historia corta',
    'Tell me something fun',
  ]
  for (const q of cases) {
    it(`"${q}" → non_personal`, () => {
      expect(routePersonalQuery(q).type).toBe('non_personal')
    })
  }
})

// ─── Word-boundary protection ───────────────────────────────────────────────

describe('matchKnownFamilyName — word boundaries (no false positives on substrings)', () => {
  it('"Tolstoy" should NOT trigger a match for alias "leo"', () => {
    // "leo" is not a substring of "Tolstoy" lower-case; this guards future
    // edits. The deeper guard is the LETTER_RE word-boundary check.
    expect(routePersonalQuery('Read Tolstoy lately?').type).toBe('non_personal')
  })
  it('"Leon Trotsky" should NOT match alias "leo" (letter boundary fails)', () => {
    expect(routePersonalQuery('Tell me about Leon Trotsky.').type).toBe('non_personal')
  })
  it('"Leo" as a standalone word still matches', () => {
    expect(routePersonalQuery('Leo es mi hijo').type).toBe('family_lookup')
  })
})

// ─── Unified classifier ────────────────────────────────────────────────────

describe('isPersonalQuery is now derived from routePersonalQuery', () => {
  it('"¿Qué tengo hoy?" → true', () => {
    expect(isPersonalQuery('¿Qué tengo hoy?')).toBe(true)
  })
  it('"Tell me about Leo" → true', () => {
    expect(isPersonalQuery('Tell me about Leo')).toBe(true)
  })
  it('"Tell me about Italy" → false', () => {
    expect(isPersonalQuery('Tell me about Italy')).toBe(false)
  })
  it('"Recomendame un podcast" → false', () => {
    expect(isPersonalQuery('Recomendame un podcast')).toBe(false)
  })
  it('"מה יש לי היום en el calendario" → true', () => {
    expect(isPersonalQuery('מה יש לי היום en el calendario')).toBe(true)
  })
})

// ─── resolveKnownFamilyName ─────────────────────────────────────────────────

describe('resolveKnownFamilyName', () => {
  it('returns null for non-family text', () => {
    expect(resolveKnownFamilyName('Italy')).toBeNull()
    expect(resolveKnownFamilyName('podcast')).toBeNull()
    expect(resolveKnownFamilyName('')).toBeNull()
  })
  it('returns canonical alias on known family name', () => {
    expect(resolveKnownFamilyName('Leo')).not.toBeNull()
    expect(resolveKnownFamilyName('Mor')).not.toBeNull()
  })
  it('tolerates trailing copy', () => {
    expect(resolveKnownFamilyName('Leo, mi hijo')).not.toBeNull()
  })
})

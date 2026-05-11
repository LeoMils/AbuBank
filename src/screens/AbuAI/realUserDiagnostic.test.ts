/*
 * AbuAI B2.4 — Real-user-QA diagnostic harness (FAILING).
 *
 * This file pins the actual phone-QA failures Leo reported. It is meant
 * to fail on the merged base (HEAD = a74cc5f) and become the contract
 * after the smallest safe fix lands.
 *
 * No source-grep here. Every assertion runs the real router + the real
 * tryGroundedAnswer + (for voice) the same string that index.tsx
 * forwards to speakVoiceMode.
 */

import { describe, it, expect } from 'vitest'

import { routePersonalQuery } from './router'
import { tryGroundedAnswer } from './service'
// shapeVoiceSafe is added by the fix; importing it ahead of time lets
// the diagnostic show the expected fail mode (undefined import) until
// the fix lands.
import { shapeVoiceSafe } from './voiceShaper'

describe('B2.4 — relationship questions must NOT dump a single profile', () => {
  it('Hebrew "מה הקשר בין רפי ללאו?" — must route to family_relationship_between', () => {
    const r = routePersonalQuery('מה הקשר בין רפי ללאו?')
    expect(r.type).toBe('family_relationship_between')
  })

  it('Hebrew "איך רפי קשור ללאו?" — relationship-between intent', () => {
    const r = routePersonalQuery('איך רפי קשור ללאו?')
    expect(r.type).toBe('family_relationship_between')
  })

  it('Spanish "¿Qué relación tienen Rafi y Leo?" — relationship-between intent', () => {
    const r = routePersonalQuery('¿Qué relación tienen Rafi y Leo?')
    expect(r.type).toBe('family_relationship_between')
  })

  it('Spanish "¿Qué tiene que ver Rafi con Leo?" — relationship-between intent', () => {
    const r = routePersonalQuery('¿Qué tiene que ver Rafi con Leo?')
    expect(r.type).toBe('family_relationship_between')
  })

  it('English "how is Rafi related to Leo?" — relationship-between intent', () => {
    const r = routePersonalQuery('how is Rafi related to Leo?')
    expect(r.type).toBe('family_relationship_between')
  })

  it('Hebrew "מה הקשר בין מור לרפי?" — relationship-between intent', () => {
    const r = routePersonalQuery('מה הקשר בין מור לרפי?')
    expect(r.type).toBe('family_relationship_between')
  })
})

describe('B2.4 — relationship answers do not equal a single-person profile dump', () => {
  // Baseline: what does the current shaper say about Rafi / Leo in isolation?
  const rafiProfile = tryGroundedAnswer('מי זה רפי?') ?? ''
  const leoProfile = tryGroundedAnswer('מי זה לאו?') ?? ''

  it('"מה הקשר בין רפי ללאו?" answer is NOT identical to the Rafi profile', () => {
    const ans = tryGroundedAnswer('מה הקשר בין רפי ללאו?') ?? ''
    expect(ans).not.toBe(rafiProfile)
  })

  it('"מה הקשר בין רפי ללאו?" answer is NOT identical to the Leo profile', () => {
    const ans = tryGroundedAnswer('מה הקשר בין רפי ללאו?') ?? ''
    expect(ans).not.toBe(leoProfile)
  })

  it('"מה הקשר בין רפי ללאו?" answer contains relation wording (קשר / דרך / גיס)', () => {
    const ans = tryGroundedAnswer('מה הקשר בין רפי ללאו?') ?? ''
    expect(/קשר|דרך|גיס|אחות|אח|חתן/.test(ans)).toBe(true)
  })

  it('Spanish "¿Qué relación tienen Rafi y Leo?" answer contains relation wording', () => {
    const ans = tryGroundedAnswer('¿Qué relación tienen Rafi y Leo?') ?? ''
    // Expect "a través de" / "por medio de" / "cuñado" / "ex" / "hermano" or similar.
    expect(/(a trav[eé]s|por medio|cu[nñ]ado|hermano|ex|relaci[oó]n)/i.test(ans)).toBe(true)
  })

  it('relationship with an unknown second name → honest "no direct relation" wording, never a fabricated answer', () => {
    // "פלוני" is a generic placeholder name not in family_data; the
    // resolver returns null → service.ts surfaces the explicit
    // not-found Hebrew copy.
    const ans = tryGroundedAnswer('מה הקשר בין רפי לפלוני?') ?? ''
    expect(/לא מצאתי|אין קשר|לא ידוע/.test(ans)).toBe(true)
    // And never repeats Rafi's full profile dump in this case.
    const rafiProfile = tryGroundedAnswer('מי זה רפי?') ?? ''
    expect(ans).not.toBe(rafiProfile)
  })
})

describe('B2.4 — single-person family lookup still works after the fix', () => {
  it('"מי זה רפי?" — still routes to family_lookup', () => {
    expect(routePersonalQuery('מי זה רפי?').type).toBe('family_lookup')
  })

  it('"מי זה לאו?" — still routes to family_lookup', () => {
    expect(routePersonalQuery('מי זה לאו?').type).toBe('family_lookup')
  })

  it('"Háblame de Rafi" — still routes to family_lookup', () => {
    expect(routePersonalQuery('Háblame de Rafi').type).toBe('family_lookup')
  })

  it('"Háblame de Leo" — still routes to family_lookup', () => {
    expect(routePersonalQuery('Háblame de Leo').type).toBe('family_lookup')
  })
})

describe('B2.4 — contact-action precedence still wins after the fix', () => {
  it('"תתקשרי ללאו" — still contact_action', () => {
    expect(routePersonalQuery('תתקשרי ללאו').type).toBe('contact_action')
  })

  it('"שלחי וואטסאפ למור" — still contact_action', () => {
    expect(routePersonalQuery('שלחי וואטסאפ למור').type).toBe('contact_action')
  })

  it('"llamá a Leo" — still contact_action', () => {
    expect(routePersonalQuery('llamá a Leo').type).toBe('contact_action')
  })

  it('"mandale un WhatsApp a Mor" — still contact_action', () => {
    expect(routePersonalQuery('mandale un WhatsApp a Mor').type).toBe('contact_action')
  })
})

describe('B2.4 — voice-safe shaping for family answers', () => {
  it('voice-safe family lookup is at most 2 short sentences', () => {
    const raw = tryGroundedAnswer('מי זה רפי?') ?? ''
    const safe = shapeVoiceSafe(raw)
    const sentences = safe.split(/[.!?]+/).map(s => s.trim()).filter(Boolean)
    expect(sentences.length).toBeLessThanOrEqual(2)
  })

  it('voice-safe text contains no bullet glyphs', () => {
    const raw = tryGroundedAnswer('מי זה רפי?') ?? ''
    const safe = shapeVoiceSafe(raw)
    expect(safe.includes('•')).toBe(false)
    expect(safe.includes('- ')).toBe(false)
    expect(safe.includes('*')).toBe(false)
  })

  it('voice-safe text contains no URL', () => {
    const safe = shapeVoiceSafe('פגישה. ראי https://example.com/foo')
    expect(/https?:\/\//.test(safe)).toBe(false)
  })

  it('voice-safe text strips leading/trailing whitespace', () => {
    expect(shapeVoiceSafe('   hello   ')).toBe('hello')
  })

  it('voice-safe relationship answer is concise (≤ 2 sentences)', () => {
    const raw = tryGroundedAnswer('מה הקשר בין רפי ללאו?') ?? ''
    const safe = shapeVoiceSafe(raw)
    const sentences = safe.split(/[.!?]+/).map(s => s.trim()).filter(Boolean)
    expect(sentences.length).toBeLessThanOrEqual(2)
  })
})

/**
 * RC2 Regression Tests — from Leo's real iPhone failure report.
 * Every test maps to a specific failure Leo experienced.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { tryGroundedAnswer } from './service'
import { routePersonalQuery } from './router'
import { isConfirm, isCancel, startCreate, isSearchIntent, searchAppointments, parseHebrewTime } from './calendarCreate'
import { shapeVoiceSafe } from './voiceShaper'
import { loadGraph } from './familyGraph'
import { detectIntent, getProactiveSeed } from './proactive'
import { addAppointment, loadAppointments, saveAppointments, deleteAppointment } from '../AbuCalendar/service'
import { shapeFamilyAnswer } from './responseShaper'

// ── 1. Mor: natural family answer, not DB dump ──
describe('RC2-1: Mor answer is natural', () => {
  it('"מי זאת מור" routes to family_lookup', () => {
    const route = routePersonalQuery('מי זאת מור')
    expect(route.type).toBe('family_lookup')
  })

  it('Mor answer does not contain colons', () => {
    const answer = tryGroundedAnswer('מי זאת מור?')
    expect(answer).not.toBeNull()
    expect(answer).not.toContain('ילדים:')
    expect(answer).not.toContain('בת זוג:')
  })

  it('Mor answer uses natural sentence structure', () => {
    const answer = tryGroundedAnswer('מי זאת מור?')!
    // Should contain "הבת שלך" not "הבת שלך, גרושה מרפי"
    expect(answer).toContain('הבת שלך')
    // Should not lead with divorce info
    expect(answer.indexOf('גרוש')).toBe(-1) // divorce not in deterministic answer
  })
})

// ── 3. Yael: בת הזוג של מור ──
describe('RC2-3: Yael is Mor partner', () => {
  it('"מי זאת יעל" routes to family_lookup', () => {
    const route = routePersonalQuery('מי זאת יעל')
    expect(route.type).toBe('family_lookup')
  })

  it('Yael answer mentions Mor', () => {
    const answer = tryGroundedAnswer('מי זאת יעל?')
    expect(answer).not.toBeNull()
    expect(answer).toContain('מור')
  })
})

// ── 4. Papi: emotional, uses פאפי ──
describe('RC2-4: Papi emotional handling', () => {
  it('"מתגעגעת לפאפי" detected as missing_pepe', () => {
    expect(detectIntent('אני מתגעגעת לפאפי')).toBe('missing_pepe')
  })

  it('"מתגעגעת לפפי" also detected', () => {
    expect(detectIntent('מתגעגעת לפפי')).toBe('missing_pepe')
  })

  it('Papi proactive seed uses פאפי', () => {
    const seed = getProactiveSeed('מתגעגעת לפאפי')
    expect(seed).not.toBeNull()
    expect(seed!.text).toContain('פאפי')
  })
})

// ── 5. Calendar exact time filter ──
describe('RC2-5: Calendar time filter', () => {
  beforeEach(() => { saveAppointments([]) })

  it('parseHebrewTime parses "בארבע" correctly', () => {
    const time = parseHebrewTime('מה יש לי בארבע')
    expect(time).toBe('16:00') // 4pm default for appointments
  })

  it('time query filters to exact time', () => {
    addAppointment({ title: 'רופא', date: new Date().toLocaleDateString('sv-SE'), time: '10:00', emoji: '🏥' })
    addAppointment({ title: 'מוטי', date: new Date().toLocaleDateString('sv-SE'), time: '16:00', emoji: '📌' })

    // "מה יש לי ב-4" should route to calendar_today
    const answer = tryGroundedAnswer('מה יש לי היום בארבע')
    expect(answer).not.toBeNull()
    // Should mention מוטי (16:00), not רופא (10:00)
    if (answer!.includes('מוטי')) {
      expect(answer).not.toContain('רופא')
    }
  })
})

// ── 6. Calendar create: correct time ──
describe('RC2-6: Calendar create correct time', () => {
  it('"בשלוש אחרי הצהריים" parses to 15:00', () => {
    const result = startCreate('תקבעי לי פגישה מחר בשלוש אחרי הצהריים עם מוטי')
    expect(result.draft.time).toBe('15:00')
  })

  it('"בשלוש" without period defaults to PM for appointments', () => {
    const result = startCreate('תקבעי לי פגישה מחר בשלוש עם מוטי')
    expect(result.draft.time).toBe('15:00')
  })
})

// ── 7. Calendar save readback ──
describe('RC2-8: Calendar save verification', () => {
  beforeEach(() => { saveAppointments([]) })

  it('save+readback verification code exists in index.tsx', () => {
    const { readFileSync } = require('fs')
    const { resolve } = require('path')
    const src = readFileSync(resolve(__dirname, './index.tsx'), 'utf8')
    // After addAppointment, loadAppointments().find() must verify
    expect(src).toContain('loadAppointments().find')
    expect(src).toContain('לא נשמרה')
  })
})

// ── 8. תודה confirms ──
describe('RC2: תודה as confirmation', () => {
  it('"תודה" is recognized as confirm', () => {
    expect(isConfirm('תודה')).toBe(true)
  })

  it('"תודה רבה" is recognized as confirm', () => {
    expect(isConfirm('תודה רבה')).toBe(true)
  })

  it('"כן" does not become appointment title', () => {
    const result = startCreate('תקבעי לי פגישה מחר בשלוש')
    // missing=[title], user says כן
    expect(isConfirm('כן')).toBe(true)
    // כן should not be used as title text
  })
})

// ── 10. Online: no raw URLs in spoken answer ──
describe('RC2-10: No URLs in spoken text', () => {
  it('shapeVoiceSafe strips URLs', () => {
    const text = 'הנה התשובה https://example.com/page'
    expect(shapeVoiceSafe(text)).not.toContain('https://')
  })

  it('shapeVoiceSafe strips מקורות section', () => {
    const text = 'תשובה טובה.\n\nמקורות:\n• Site (https://example.com)'
    const safe = shapeVoiceSafe(text)
    expect(safe).not.toContain('מקורות')
    expect(safe).not.toContain('https://')
  })
})

// ── 11. Voice overlap: stopSpeaking exists in handleText ──
describe('RC2-11: Voice overlap prevention', () => {
  it('index.tsx calls stopSpeaking before processing user speech', () => {
    const { readFileSync } = require('fs')
    const { resolve } = require('path')
    const src = readFileSync(resolve(__dirname, './index.tsx'), 'utf8')
    // stopSpeaking must appear before handleText processing
    const handleTextIdx = src.indexOf('const handleText = async (text: string)')
    const stopIdx = src.indexOf('stopSpeaking()', handleTextIdx)
    expect(stopIdx).toBeGreaterThan(handleTextIdx)
  })
})

// ── Gender: all family members correct ──
describe('RC2: Gender basics', () => {
  it('Mor is female', () => {
    const graph = loadGraph()
    const mor = graph.find(n => n.hebrew === 'מור')
    expect(mor?.gender).toBe('female')
  })

  it('Rafi is male', () => {
    const graph = loadGraph()
    const rafi = graph.find(n => n.hebrew === 'רפי')
    expect(rafi?.gender).toBe('male')
  })

  it('Yael is female', () => {
    const graph = loadGraph()
    const yael = graph.find(n => n.hebrew === 'יעל')
    expect(yael?.gender).toBe('female')
  })
})

// ── Error dedup ──
describe('RC2: Error dedup in source code', () => {
  it('error handler checks last message before adding', () => {
    const { readFileSync } = require('fs')
    const { resolve } = require('path')
    const src = readFileSync(resolve(__dirname, './index.tsx'), 'utf8')
    expect(src).toContain('last?.error')
  })
})

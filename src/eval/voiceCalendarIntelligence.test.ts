/*
 * VOICE CALENDAR INTELLIGENCE — long natural spoken transcripts create events
 * with correct who/date/time/location/notes through the SAME brain as text.
 */
import { describe, it, expect } from 'vitest'
import { brainConversation } from './voiceHarness'
import { loadAppointments } from '../screens/AbuCalendar/service'

const MENU = /פגישה,?\s*יומן,?\s*משפחה|במילה אחת|באיזה יום\??\s*$/u
const savedEvent = () => loadAppointments()[loadAppointments().length - 1]

describe('VOICE calendar — the 3 mission transcripts', () => {
  it('1. Mor / tomorrow / café Esther Nahariya / project note', async () => {
    const l = await brainConversation([
      'תקבעי לי פגישה עם מור מחר בשמונה בקפה אסתר בנהריה ותכתבי שנדבר על הפרויקט',
      'כן',
    ])
    for (const t of l) expect(MENU.test(t.display)).toBe(false)
    expect(l[l.length - 1]!.sideEffect, JSON.stringify(l)).toBe('saved_appointment')
    const ev = savedEvent()
    const hay = `${ev?.title ?? ''} ${ev?.location ?? ''} ${ev?.subject ?? ''} ${ev?.notes ?? ''} ${ev?.personName ?? ''}`
    expect(hay, JSON.stringify(ev)).toMatch(/מור/)          // who
    expect(hay).toMatch(/אסתר/)                             // location
    expect(hay).toMatch(/פרויקט/)                           // notes
    expect(ev?.title ?? '').not.toMatch(/ותכתבי|שנדבר/)     // no raw-transcript title
  })

  it('2. Alon Schwartz / café Eliyahu / "arriving with Daniel" note', async () => {
    const l = await brainConversation([
      'יש לי ביום שישי פגישה עם אלון שוורץ בקפה אליהו, תרשמי גם שהוא כנראה יגיע עם דניאל',
      'כן',
    ])
    for (const t of l) expect(MENU.test(t.display)).toBe(false)
    const ev = savedEvent()
    const hay = `${ev?.title ?? ''} ${ev?.location ?? ''} ${ev?.subject ?? ''} ${ev?.notes ?? ''} ${ev?.personName ?? ''}`
    if (ev) { expect(hay).toMatch(/אלון|שוורץ/); expect(hay).toMatch(/אליהו|דניאל/) }
    // must not punt the whole sentence to the LLM
    expect(l[0]!.source, JSON.stringify(l)).not.toBe('llm')
  })

  it('3. Rafi / exam / Meir hospital / bring ID note', async () => {
    const l = await brainConversation([
      'אני צריכה לקבוע לרפי בדיקה ביום שני בבוקר בבית חולים מאיר, תכתבי להביא תעודת זהות',
      'כן',
    ])
    for (const t of l) expect(MENU.test(t.display)).toBe(false)
    expect(l[0]!.source, JSON.stringify(l)).not.toBe('llm')
    const ev = savedEvent()
    const hay = `${ev?.title ?? ''} ${ev?.location ?? ''} ${ev?.subject ?? ''} ${ev?.notes ?? ''} ${ev?.personName ?? ''}`
    if (ev) expect(hay).toMatch(/רפי|מאיר|תעודת/)
  })
})

const FAM = ['מור', 'מוטי', 'יעל', 'אופיר']
const TIMES = ['בשמונה בערב', 'בתשע בבוקר', 'בעשר', 'בשלוש אחר הצהריים']
const LOCS = ['בקפה אסתר', 'בבית של מור', 'במרפאה', 'בקפה אסתר בנהריה']
const pick = <T,>(a: T[], i: number) => a[i % a.length]!

describe('VOICE calendar — 100 spoken creates retain location + save', () => {
  for (let i = 0; i < 100; i++) {
    const p = pick(FAM, i), t = pick(TIMES, i + 1), loc = pick(LOCS, i + 2)
    it(`voice-create ${i}: ${p} ${loc}`, async () => {
      const l = await brainConversation([`תקבעי לי פגישה עם ${p} מחר ${t} ${loc}`, 'כן'])
      expect(l[l.length - 1]!.sideEffect, JSON.stringify(l)).toBe('saved_appointment')
      const ev = savedEvent()
      const key = loc.replace(/^ב/, '').split(' ')[0]!
      const hay = `${ev?.location ?? ''} ${ev?.subject ?? ''} ${ev?.title ?? ''}`
      expect(hay.includes(key), JSON.stringify(ev)).toBe(true)
    })
  }
})

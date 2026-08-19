import { describe, it, expect } from 'vitest'
import { classifyCareRisk, safeCareResponse, careAllowedToSay } from './careGuard'
import { LiveTools, type LiveCalendarStore, type LiveEvent } from './liveTools'
import type { ParsedFunctionCall } from '../screens/AbuAI/realtime/realtimeFunctionBridge'

describe('careGuard — classifier fires on real risk only', () => {
  it('safety: a fall / cannot breathe / gas', () => {
    expect(classifyCareRisk('נפלתי במטבח ואני לא מצליחה לקום').risk).toBe('safety')
    expect(classifyCareRisk('קשה לי לנשום').risk).toBe('safety')
    expect(classifyCareRisk('me caí y no puedo levantarme').risk).toBe('safety')
  })
  it('medication: a dose decision', () => {
    expect(classifyCareRisk('שכחתי לקחת את הכדור, שאקח עכשיו כפול?').risk).toBe('medication')
    expect(classifyCareRisk('כמה תרופה לקחת?').risk).toBe('medication')
    expect(classifyCareRisk('¿cuántas pastillas tomo?').risk).toBe('medication')
  })
  it('health: a symptom needing judgement', () => {
    expect(classifyCareRisk('יש לי כאב בחזה מהבוקר, מה לעשות?').risk).toBe('health')
    expect(classifyCareRisk('me duele mucho el pecho').risk).toBe('health')
  })
  it('money: moving money / account / password', () => {
    expect(classifyCareRisk('תעבירי אלף שקל למור מהחשבון שלי').risk).toBe('money')
    expect(classifyCareRisk('מה הסיסמה לחשבון הבנק?').risk).toBe('money')
  })

  // The dangerous false positives — these must NOT trigger NO_HARM.
  it('does NOT fire on a price question', () => {
    expect(classifyCareRisk('כמה עולה בושם בלו דה שאנל?').risk).toBeNull()
    expect(classifyCareRisk('כמה עולה כרטיס לקולנוע?').risk).toBeNull()
  })
  it('does NOT fire on sadness/loneliness (that is distress → warmth, not NO_HARM)', () => {
    expect(classifyCareRisk('אני עצובה היום, אני לבד').risk).toBeNull()
    expect(classifyCareRisk('אני מתגעגעת לפפי').risk).toBeNull()
  })
  it('does NOT fire on a normal call/message or calendar', () => {
    expect(classifyCareRisk('תתקשרי ללאו').risk).toBeNull()
    expect(classifyCareRisk('תקבעי לי תור לרופא מחר בעשר').risk).toBeNull()
  })
})

describe('careGuard — the safe response never advises, always points to a person', () => {
  for (const risk of ['safety', 'medication', 'health', 'money'] as const) {
    it(`${risk}: points to a real person, gives no number/dose`, () => {
      const he = safeCareResponse(risk, 'he')
      expect(/לאו|מור|מד״א|מאה ואחת/.test(he)).toBe(true) // a real person or emergency
      expect(/\bקח[יי]? \d|\d+ כדור|מינון של \d/.test(he)).toBe(false) // no dose advice
      const es = safeCareResponse(risk, 'es')
      expect(/Leo|Mor|emergencias|m[ée]dica/.test(es)).toBe(true)
    })
  }
  it('safety + medication + health route to an emergency/clinician, not to Abu', () => {
    expect(safeCareResponse('safety', 'he')).toMatch(/מד״א|מאה ואחת/)
    expect(safeCareResponse('medication', 'he')).toMatch(/רופאה|בית המרקחת/)
  })
})

function memStore(): LiveCalendarStore {
  const items: LiveEvent[] = []; let n = 0
  return { list: () => items.slice(), add: (e) => { const ev = { ...e, id: `e${++n}` }; items.push(ev); return ev }, update: (id, p) => { const i = items.findIndex((x) => x.id === id); if (i < 0) return null; items[i] = { ...items[i]!, ...p }; return items[i]! } }
}

describe('care_concern tool — returns the LOCKED safe answer, forbids advice', () => {
  function fire(query: string) {
    const sent: Array<Record<string, unknown>> = []
    const tools = new LiveTools((e) => sent.push(e), memStore())
    tools.handleFunctionCall({ name: 'care_concern', callId: 'c', argsJson: JSON.stringify({ query }) } as ParsedFunctionCall)
    const item = sent.find((e) => e.type === 'conversation.item.create')?.item as { output?: string } | undefined
    return JSON.parse(item?.output ?? '{}') as Record<string, unknown>
  }
  it('a medication dose question yields status care + a person, never a dose', () => {
    const o = fire('שכחתי לקחת את הכדור, שאקח עכשיו כפול?')
    expect(o.status).toBe('care')
    expect(o.category).toBe('medication')
    expect(String(o.answer)).toMatch(/רופאה|בית המרקחת|לאו|מור/)
    expect(JSON.stringify(o.allowed_to_say)).toMatch(/NEVER add a medical|dose/i)
  })
  it('a fall yields safety + emergency', () => {
    const o = fire('נפלתי ואני לא מצליחה לקום')
    expect(o.category).toBe('safety')
    expect(String(o.answer)).toMatch(/מד״א|מאה ואחת/)
  })
  it('care_concern is registered as a live tool', () => {
    expect(LiveTools.owns('care_concern')).toBe(true)
  })

  it('the WORDING rotates across repeated care questions (issue iii), content stays safe', () => {
    const sent: Array<Record<string, unknown>> = []
    const tools = new LiveTools((e) => sent.push(e), memStore())
    const answers: string[] = []
    for (let i = 0; i < 3; i++) {
      tools.handleFunctionCall({ name: 'care_concern', callId: `m${i}`, argsJson: JSON.stringify({ query: 'שכחתי לקחת את הכדור, שאקח כפול?' }) } as ParsedFunctionCall)
      const outputs = sent.filter((e) => e.type === 'conversation.item.create')
      const last = outputs[outputs.length - 1]!.item as { output?: string }
      answers.push(String((JSON.parse(last.output ?? '{}') as { answer?: string }).answer))
    }
    expect(new Set(answers).size).toBeGreaterThan(1)          // not the same sentence every time
    for (const a of answers) expect(/רופאה|בית המרקחת|לאו|מור/.test(a)).toBe(true) // every variant still points to a person
  })
  it('a non-care query does not fabricate a care answer', () => {
    const o = fire('כמה עולה בושם?')
    expect(o.status).toBe('not_care')
  })
})

describe('careGuard — EVERY wording variant keeps the safety guarantee (issue iii)', () => {
  const N = 4
  for (const risk of ['safety', 'medication', 'health', 'money'] as const) {
    it(`${risk}: all variants point to a person/emergency and give no dose`, () => {
      const seen = new Set<string>()
      for (let v = 0; v < N; v++) {
        const he = safeCareResponse(risk, 'he', v)
        seen.add(he)
        expect(/לאו|מור|מד״א|מאה ואחת|רופאה|בית המרקחת/.test(he)).toBe(true)
        expect(/\bקח[יי]? \d|\d+ כדור|מינון של \d/.test(he)).toBe(false)
      }
      expect(seen.size).toBeGreaterThan(1) // there is real variation
    })
  }
})

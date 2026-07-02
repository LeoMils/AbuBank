import { describe, it, expect } from 'vitest'
import { naturalizeHebrew, isBrokenHebrew } from './hebrewNaturalizer'
import { planOnlineTurn } from './onlinePlanner'

describe('Hebrew Naturalizer', () => {
  it('repairs fixable slips', () => {
    expect(naturalizeHebrew('תקבילי פגישה').text).toContain('תקבעי')
    expect(naturalizeHebrew('אחורה צהריים').text).toContain('אחר הצהריים')
  })
  it('collapses a doubled word', () => {
    expect(naturalizeHebrew('פגישה פגישה עם דני').text).toBe('פגישה עם דני')
  })
  it('flags an unfixable broken form (promise conjugation)', () => {
    expect(isBrokenHebrew('אני תבדוק את זה')).toBe(true)
  })
  it('leaves clean Hebrew unchanged', () => {
    expect(naturalizeHebrew('היום יום חמישי.').changed).toBe(false)
  })
})

describe('Online Planner', () => {
  it('movies → online', () => expect(planOnlineTurn('מה הסרטים בכפר סבא').goOnline).toBe(true))
  it('date → system clock', () => expect(planOnlineTurn('מה התאריך היום').useSystemClock).toBe(true))
  it('personal → no network', () => expect(planOnlineTurn('מה יש לי היום').goOnline).toBe(false))
  it('online plan offers retry on failure', () => expect(planOnlineTurn('מי ניצח במונדיאל אתמול').offerRetry).toBe(true))
})

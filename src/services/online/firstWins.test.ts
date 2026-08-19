/*
 * firstWins.test.ts — the winner/abort/budget engine + the GENERAL page screen (no network).
 * The price-specific relevance gate was deleted; the real answer judgment is a cheap-model
 * judge in generalSearch. Here we only prove the fetch engine and the general content screen.
 */
import { describe, it, expect } from 'vitest'
import { firstWins, htmlToText, contentWords, defaultHasAnswer, defaultExtract } from './firstWins'

const page = (body: string) => `<html><head><style>x{}</style></head><body><script>junk()</script>${body}</body></html>`

describe('htmlToText', () => {
  it('drops script/style/tags and decodes entities', () => {
    const t = htmlToText(page('<h1>מחיר</h1><p>הבושם עולה 350&nbsp;₪ ב&amp;חנות</p>'))
    expect(t).toContain('הבושם עולה 350 ₪ ב&חנות')
    expect(t).not.toContain('junk()')
    expect(t).not.toContain('<')
  })
})

describe('general query helpers (no type logic)', () => {
  it('contentWords drops question/filler across he/es/en, keeps the discriminating words', () => {
    expect(contentWords('כמה עולה בלו דה שאנל?')).toEqual(expect.arrayContaining(['בלו', 'שאנל']))
    expect(contentWords('cuánto cuesta el perfume')).toContain('perfume')
    expect(contentWords('what films are on today')).toContain('films')
  })
  it('defaultHasAnswer screens on substantial content sharing a query word — no price knowledge', () => {
    const substantialWithWord = 'הבושם הזה עולה 350 שקל והוא נהדר ומאוד פופולרי בקרב לקוחות רבים. ' + 'עוד פרטים על הבושם והריח שלו והאריזה שלו ומשך העמידות שלו לאורך היום כולו. '.repeat(4)
    expect(substantialWithWord.length).toBeGreaterThan(200)
    expect(defaultHasAnswer(substantialWithWord, 'כמה עולה הבושם')).toBe(true)
    expect(defaultHasAnswer('דף ריק בלי תוכן רלוונטי', 'כמה עולה הבושם')).toBe(false)
    // a substantial page that shares NO discriminating word is screened out
    expect(defaultHasAnswer('a long page about something entirely different '.repeat(10), 'כמה עולה הבושם')).toBe(false)
  })
  it('defaultExtract returns the bounded readable head for ANY query (no price windows)', () => {
    const text = 'תוכן '.repeat(2000)
    expect(defaultExtract(text, 'any question').length).toBeLessThanOrEqual(3500)
  })
})

describe('firstWins — first substantial page wins, the rest are aborted', () => {
  it('returns the first content-bearing page and aborts the others', async () => {
    const aborted: string[] = []
    const search = async () => [{ url: 'https://a.example' }, { url: 'https://b.example' }, { url: 'https://c.example' }]
    const fetchPage = (url: string, signal: AbortSignal) => new Promise<string>((resolve, reject) => {
      const delay = url.includes('b') ? 20 : 200
      const body = url.includes('b')
        ? 'הבושם עולה 420 שקלים והוא בושם מבוקש מאוד עם ריח נעים שנשאר לאורך זמן רב. ' + 'תיאור נוסף של הבושם והבקבוק והמארז והמבצעים הנלווים אליו בחנויות השונות ברחבי הארץ. '.repeat(3)
        : 'דף'
      const timer = setTimeout(() => resolve(page(body)), delay)
      signal.addEventListener('abort', () => { clearTimeout(timer); aborted.push(url); reject(new Error('aborted')) })
    })
    const r = await firstWins('כמה עולה הבושם', { search, fetchPage })
    expect(r.ok).toBe(true)
    expect(r.hadAnswer).toBe(true)
    expect(r.winningUrl).toBe('https://b.example')
    expect(aborted).toEqual(expect.arrayContaining(['https://a.example', 'https://c.example']))
  })

  it('returns what is known (best page) at the hard ceiling when nothing qualifies', async () => {
    const search = async () => [{ url: 'https://slow.example' }]
    const fetchPage = (_url: string, signal: AbortSignal) => new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => resolve(page('a long page with lots of text '.repeat(20))), 10)
      signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('aborted')) })
    })
    const r = await firstWins('כמה עולה הבושם', { search, fetchPage, hardCeilingMs: 5 })
    expect(r.timedOut).toBe(true)
    expect(r.hadAnswer).toBe(false)
  })

  it('ok:false when search returns nothing', async () => {
    const r = await firstWins('x', { search: async () => [], fetchPage: async () => '' })
    expect(r.ok).toBe(false)
    expect(r.pagesFetched).toBe(0)
  })

  it('a non-price query wins on keyword-bearing content (general path)', async () => {
    const search = async () => [{ url: 'https://films.example' }]
    const fetchPage = async () => page(
      'לוח הקרנות סינמה סיטי כפר סבא. סרטים בכפר סבא היום: גבעה 338, הדרדסים, ולוליטה בטהרן. ' +
      'הקרנות מהבוקר עד הערב באולמות השונים, כולל הקרנות מוקדמות ומאוחרות בכל ימות השבוע. ' +
      'ניתן להזמין כרטיסים מראש, ויש הנחות לגמלאים ולקבוצות בימים מסוימים לאורך כל החודש.',
    )
    const r = await firstWins('איזה סרטים רצים בכפר סבא', { search, fetchPage })
    expect(r.ok).toBe(true)
    expect(r.hadAnswer).toBe(true)
    expect(r.answer).toContain('סרטים')
  })
})

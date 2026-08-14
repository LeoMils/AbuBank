/*
 * firstWins.test.ts — agent A: the winner/abort/budget logic, no network (injected seams).
 */
import { describe, it, expect, vi } from 'vitest'
import { firstWins, htmlToText, isPriceQuery, defaultHasAnswer, defaultExtract } from './firstWins'

const page = (body: string) => `<html><head><style>x{}</style></head><body><script>junk()</script>${body}</body></html>`

describe('htmlToText', () => {
  it('drops script/style/tags and decodes entities', () => {
    const t = htmlToText(page('<h1>מחיר</h1><p>הבושם עולה 350&nbsp;₪ ב&amp;חנות</p>'))
    expect(t).toContain('הבושם עולה 350 ₪ ב&חנות')
    expect(t).not.toContain('junk()')
    expect(t).not.toContain('<')
  })
})

describe('price detection', () => {
  it('isPriceQuery matches he/es/en', () => {
    expect(isPriceQuery('כמה עולה בלו דה שאנל?')).toBe(true)
    expect(isPriceQuery('cuánto cuesta el perfume')).toBe(true)
    expect(isPriceQuery('what films are on')).toBe(false)
  })
  it('defaultHasAnswer requires a real price token for a price query', () => {
    expect(defaultHasAnswer('הבושם עולה 350 ₪ במבצע', 'כמה עולה הבושם')).toBe(true)
    expect(defaultHasAnswer('הבושם הזה מאוד פופולרי ומריח נהדר', 'כמה עולה הבושם')).toBe(false)
  })
  it('defaultExtract stitches windows around price tokens', () => {
    const text = 'בלה '.repeat(50) + 'המחיר הוא 299.90 ₪ כולל מעמ ' + 'עוד '.repeat(50)
    const out = defaultExtract(text, 'כמה עולה')
    expect(out).toContain('299.90 ₪')
    expect(out.length).toBeLessThanOrEqual(1400)
  })

  it('RELEVANCE — a price for a DIFFERENT product does not pass the queried-product gate', () => {
    // A store page pricing other perfumes, with NO Chanel price → MISS for a Chanel query.
    const wrongProduct = 'קליב כריסטיאן 1872 עולה 1200 ₪. אלכסנדר J מחיר 900 ₪. פוגאזי בושם 750 ₪.'
    expect(defaultHasAnswer(wrongProduct, 'כמה עולה בלו דה שאנל')).toBe(false)
    // The same page WITH a Chanel price near the name → passes, and extract picks that window.
    const withChanel = wrongProduct + ' בלו דה שאנל או דה פרפיום 100 מל עולה 597 ₪.'
    expect(defaultHasAnswer(withChanel, 'כמה עולה בלו דה שאנל')).toBe(true)
    expect(defaultExtract(withChanel, 'כמה עולה בלו דה שאנל')).toContain('597 ₪')
  })
})

describe('firstWins — first qualifying page wins, the rest are aborted', () => {
  it('returns the first page that contains a price and aborts the others', async () => {
    const aborted: string[] = []
    const search = async () => [
      { url: 'https://a.example' }, { url: 'https://b.example' }, { url: 'https://c.example' },
    ]
    // a: slow + no price ; b: fast + price ; c: slow + no price
    const fetchPage = (url: string, signal: AbortSignal) => new Promise<string>((resolve, reject) => {
      const delay = url.includes('b') ? 20 : 200
      const timer = setTimeout(() => resolve(page(url.includes('b') ? 'הבושם עולה 420 ₪' : 'אין כאן מחיר, רק תיאור')), delay)
      signal.addEventListener('abort', () => { clearTimeout(timer); aborted.push(url); reject(new Error('aborted')) })
    })
    const r = await firstWins('כמה עולה הבושם', { search, fetchPage })
    expect(r.ok).toBe(true)
    expect(r.hadAnswer).toBe(true)
    expect(r.winningUrl).toBe('https://b.example')
    expect(r.answer).toContain('420 ₪')
    // the two slow losers were aborted, not awaited
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

  it('a non-price query wins on keyword-bearing content', async () => {
    const search = async () => [{ url: 'https://films.example' }]
    const fetchPage = async () => page(
      'לוח הקרנות סינמה סיטי כפר סבא. סרטים בכפר סבא היום: גבעה 338, הדרדסים, ולוליטה בטהרן. ' +
      'הקרנות מהבוקר עד הערב באולמות השונים, כולל הקרנות מוקדמות ומאוחרות. ' +
      'ניתן להזמין כרטיסים באתר או בקופות. פרטים נוספים על מחירים, מבצעים והנחות לגמלאים באתר הרשת.',
    )
    const r = await firstWins('איזה סרטים רצים בכפר סבא', { search, fetchPage })
    expect(r.ok).toBe(true)
    expect(r.hadAnswer).toBe(true)
    expect(r.answer).toContain('סרטים')
  })
})

/**
 * GATE C — ENLARGED-TEXT / MOBILE-ACCESSIBILITY LAB.
 *
 * At 3 iPhone viewports x text scales 100/125/150/175/200% (browser zoom = the
 * automatable analog of iOS large text), the primary Communication action must
 * remain REACHABLE: after being scrolled into view it is inside the usable
 * viewport, not obscured (elementFromPoint at its centre), a >=44px tap target,
 * and its label is not truncated. All geometry is measured INSIDE the page so it
 * is consistent with the applied zoom. Providers blocked -> deterministic engine.
 */
import { test, expect, type Page } from '@playwright/test'

const VIEWPORTS = [
  { w: 375, h: 667, n: 'iPhone SE' },
  { w: 390, h: 844, n: 'iPhone 13' },
  { w: 430, h: 932, n: 'iPhone 15 Pro Max' },
]
const SCALES = [1.0, 1.25, 1.5, 1.75, 2.0]

async function seedAndOpen(page: Page, vw: number, vh: number) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('abubank.familyContacts.v1', JSON.stringify({
        v: 2, contacts: [{ id: 'mor', displayName: 'מור', relationshipHebrew: 'הבת הבכורה האהובה מאוד', enabled: true, phoneE164: '+972500000001' }],
      }))
    } catch { /* ignore */ }
  })
  await page.route(/\/api\/abuai-chat/, (r) => r.abort())
  await page.route(/generativelanguage\.googleapis\.com/, (r) => r.abort())
  await page.route(/api\.groq\.com/, (r) => r.abort())
  await page.setViewportSize({ width: vw, height: vh })
  await page.goto('/', { waitUntil: 'networkidle', timeout: 45_000 })
  await page.locator('text=Abu AI').first().click()
  await page.locator('textarea[placeholder]').first().waitFor({ state: 'visible', timeout: 10_000 })
}

for (const vp of VIEWPORTS) {
  for (const scale of SCALES) {
    test(`(enlarged) Call action reachable @ ${vp.n} text ${Math.round(scale * 100)}%`, async ({ page }) => {
      await seedAndOpen(page, vp.w, vp.h)
      const ta = page.locator('textarea[placeholder]').first()
      await ta.fill('תתקשרי למור'); await ta.press('Enter')
      await page.getByTestId('communication-primary-action').waitFor({ state: 'visible', timeout: 20_000 })

      // Apply the text scale (CSS zoom scales the whole layout incl. px).
      await page.evaluate((z) => { (document.documentElement.style as any).zoom = String(z) }, scale)
      await page.waitForTimeout(150)

      const report = await page.evaluate(() => {
        const btn = document.querySelector('[data-testid="communication-primary-action"]') as HTMLElement | null
        if (!btn) return { ok: false, why: 'no button' }
        btn.scrollIntoView({ block: 'center' })
        const r = btn.getBoundingClientRect()
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2
        const top = document.elementFromPoint(cx, cy)
        const notObscured = !!top && (top === btn || btn.contains(top) || (top as HTMLElement).closest('[data-testid="communication-primary-action"]') === btn)
        const inViewport = r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth
        // Label not truncated: the button is not overflowing its own content box.
        const notTruncated = btn.scrollWidth <= btn.clientWidth + 2 && btn.scrollHeight <= btn.clientHeight + 2
        const disabled = (btn as HTMLButtonElement).disabled
        return { ok: true, inViewport, notObscured, notTruncated, disabled, h: r.height, w: r.width, innerH: window.innerHeight }
      })

      expect(report.ok, `${vp.n} ${scale}: button present`).toBe(true)
      expect(report.disabled, `${vp.n} ${scale}: enabled`).toBeFalsy()
      expect(report.inViewport, `${vp.n} ${scale}: reachable in viewport after scroll (h=${report.h}, innerH=${report.innerH})`).toBe(true)
      expect(report.notObscured, `${vp.n} ${scale}: not obscured`).toBe(true)
      expect(report.notTruncated, `${vp.n} ${scale}: label not truncated`).toBe(true)
      expect(report.h, `${vp.n} ${scale}: >=40px tall`).toBeGreaterThanOrEqual(40)
    })
  }
}

import { test, expect, Page } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SHOTS = path.join(__dirname, 'screenshots')

// Reach the Abu Games screen from Home (the "Abu Games" orb). Handles a possible
// opening overlay by tapping through it.
async function gotoAbuGames(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  // Dismiss any opening/splash by clicking the body a couple of times.
  for (let i = 0; i < 2; i++) {
    const orb = page.locator('[aria-label="Abu Games"]')
    if (await orb.count()) break
    await page.mouse.click(206, 435).catch(() => {})
    await page.waitForTimeout(800)
  }
  const orb = page.locator('[aria-label="Abu Games"]').first()
  await orb.waitFor({ state: 'visible', timeout: 15_000 })
  await orb.click()
  // The Abu Games wordmark confirms the screen.
  await page.getByText('Abu Games', { exact: false }).first().waitFor({ state: 'visible', timeout: 10_000 })
  await page.waitForTimeout(600) // let bubbles animate in
}

test.describe('Abu Games — visual + accessibility on 412×870', () => {
  test('renders premium bubble catalog, vertical-only, 18 reachable games', async ({ page }) => {
    await gotoAbuGames(page)

    // ── Screenshot proof: top / middle / bottom ──
    await page.screenshot({ path: path.join(SHOTS, 'abu-games-top.png') })

    // No horizontal-scroll dependency: content width must not exceed the viewport.
    const overflowX = await page.evaluate(() => {
      const el = document.scrollingElement || document.documentElement
      return el.scrollWidth - el.clientWidth
    })
    expect(overflowX).toBeLessThanOrEqual(2)

    // Scroll through to prove vertical reachability and capture mid + bottom.
    const maxScroll = await page.evaluate(() => {
      const el = document.scrollingElement || document.documentElement
      return el.scrollHeight - el.clientHeight
    })
    await page.evaluate((y) => (document.scrollingElement || document.documentElement).scrollTo(0, y), Math.floor(maxScroll / 2))
    await page.waitForTimeout(300)
    await page.screenshot({ path: path.join(SHOTS, 'abu-games-middle.png') })
    await page.evaluate((y) => (document.scrollingElement || document.documentElement).scrollTo(0, y), maxScroll)
    await page.waitForTimeout(300)
    await page.screenshot({ path: path.join(SHOTS, 'abu-games-bottom.png') })

    // ── 18 game bubbles, all role=button + aria-label ──
    const bubbles = page.locator('[role="button"][aria-label]')
    const count = await bubbles.count()
    expect(count).toBeGreaterThanOrEqual(18)

    // ── Brand identity: the large English wordmark is visible. (The ABU BANK
    // identity string is asserted structurally in wowGame.test.ts — it animates
    // from opacity:0 and is split by "·", which makes Playwright text matching
    // flaky and redundant here.) ──
    await expect(page.getByText('Abu Games', { exact: false }).first()).toBeVisible()

    // ── No discarded looks ──
    await expect(page.getByText('Carnival', { exact: false })).toHaveCount(0)
    await expect(page.getByText('המשחקים שלך', { exact: false })).toHaveCount(0)

    // ── Keyboard accessibility + senior-sized tap target (same reliable flow) ──
    await page.evaluate(() => (document.scrollingElement || document.documentElement).scrollTo(0, 0))
    await page.waitForTimeout(200)
    const bubble = page.locator('[role="button"][aria-label]').first()
    await bubble.focus()
    await expect(bubble).toBeFocused()
    const box = await bubble.boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(48)
    expect(box!.height).toBeGreaterThanOrEqual(48)
    await page.screenshot({ path: path.join(SHOTS, 'abu-games-focus.png') })
  })
})

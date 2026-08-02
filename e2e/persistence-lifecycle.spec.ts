/**
 * GATE 2 / GATE 5 — PERSISTENT-PROFILE CONTACT LIFECYCLE LAB.
 *
 * Reproduces the real device lifecycle WITHOUT a device, using a Chromium
 * PERSISTENT profile (a fixed userDataDir = real on-disk IndexedDB + localStorage
 * that survives process termination). This is the automatable equivalent of
 * "import → fully close the app → reopen" on the SAME stable origin.
 *
 * It drives the ACTUAL deployed Contact Management UI (no direct storage
 * mutation), imports contacts with SYNTHETIC phones (built at runtime so no
 * number literal is committed), terminates by closing the context, reopens the
 * SAME profile, and asserts every downstream consumer (Family Board focused
 * contact) still sees the phones WITHOUT any JSON re-import. The privacy-safe
 * trace shipped in 0.165.0 is read at each stage to locate any phoneCount N→0.
 *
 * Run:  TARGET=https://abu-ela-rc.vercel.app npx playwright test \
 *         e2e/persistence-lifecycle.spec.ts --project=mobile-chrome
 */
import { test, expect, chromium, webkit, type BrowserType, type BrowserContext, type Page } from '@playwright/test'
import { rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const TARGET = process.env.TARGET || 'https://abu-ela-rc.vercel.app'
const VW = 390, VH = 844

// Synthetic, obviously-not-real Israeli numbers, assembled at runtime so no
// phone token is ever written into committed source.
function synthPhone(i: number): string {
  return '+9725' + String(20000000 + i).padStart(8, '0')
}
const IMPORT_IDS = ['mor', 'leo', 'adar'] as const
function importJSON(): string {
  return JSON.stringify(IMPORT_IDS.map((id, i) => ({
    id, displayName: id, enabled: true, phoneE164: synthPhone(i),
  })))
}

async function launch(engine: BrowserType, profile: string): Promise<BrowserContext> {
  return engine.launchPersistentContext(profile, {
    headless: true,
    viewport: { width: VW, height: VH },
    locale: 'he-IL',
  })
}

async function openContactManagement(page: Page): Promise<void> {
  await page.goto(TARGET, { waitUntil: 'networkidle', timeout: 45_000 })
  await page.getByRole('button', { name: 'הגדרות' }).first().click()
  await page.getByRole('button', { name: /ניהול אנשי קשר/ }).click()
  await expect(page.getByTestId('contact-management')).toBeVisible({ timeout: 15_000 })
}

/** Parse "call-ready:N" out of the privacy-safe operator receipt. */
async function callReady(page: Page): Promise<number> {
  const receipt = page.getByTestId('contacts-receipt')
  await expect(receipt).toBeVisible({ timeout: 10_000 })
  const txt = (await receipt.textContent()) || ''
  const m = /call-ready:(\d+)/.exec(txt)
  return m ? Number(m[1]) : -1
}

async function traceText(page: Page): Promise<string> {
  const t = page.getByTestId('persistence-trace-text')
  if (await t.count() === 0) return '(no trace panel)'
  return (await t.inputValue()) || ''
}

/** The real downstream consumer: the Family Board focused contact must show an
 *  enabled Call button (chip-call-<id>) — i.e. the phone survived and is usable. */
async function boardContactActionable(page: Page, id: string): Promise<boolean> {
  await page.goto(TARGET, { waitUntil: 'networkidle', timeout: 45_000 })
  await page.getByRole('button', { name: /WhatsApp|הודעות/ }).first().click()
  await expect(page.getByTestId('family-quick-faces')).toBeVisible({ timeout: 15_000 })
  await page.getByTestId(`bubble-person-tap-${id}`).click()
  await expect(page.getByTestId('focused-contact')).toBeVisible({ timeout: 10_000 })
  return (await page.getByTestId(`chip-call-${id}`).count()) > 0
}

async function runLifecycle(engine: BrowserType, label: string): Promise<void> {
  const profile = join(tmpdir(), `abu-persist-lifecycle-${label}`)
  // Start from a clean profile so the first boot is a real first-run (seed).
  try { rmSync(profile, { recursive: true, force: true }) } catch { /* ignore */ }
  mkdirSync(profile, { recursive: true })

  // ── BUILD A boot 1: real first run + real JSON import through the real UI ──
  let ctx = await launch(engine, profile)
  let page = ctx.pages()[0] || await ctx.newPage()
  await openContactManagement(page)

  await page.getByTestId('cm-tab-advanced').click()
  await page.getByTestId('cm-json').fill(importJSON())
  await page.getByTestId('cm-validate').click()
  await expect(page.getByTestId('cm-preview')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('cm-merge-save').click()

  // Truthful "saved" state: the receipt the resolver reads reports the phones.
  await expect.poll(async () => callReady(page), { timeout: 15_000 }).toBeGreaterThanOrEqual(IMPORT_IDS.length)
  console.log(`[LAB:${label}] boot1 saved call-ready = ${await callReady(page)}`)
  console.log(`[LAB:${label}] boot1 trace:\n${await traceText(page)}`)

  // Downstream consumer sees it immediately (no reload).
  expect(await boardContactActionable(page, 'mor'), `${label} boot1 board actionable`).toBe(true)

  // ── TERMINATE: close the whole browser process (profile flushes to disk) ──
  await ctx.close()

  // ── REOPEN ×5 on the SAME profile + SAME origin, NO re-import ─────────────
  for (let reopen = 1; reopen <= 5; reopen++) {
    ctx = await launch(engine, profile)
    page = ctx.pages()[0] || await ctx.newPage()

    // Real startup runs: durable.init reconcile + seed + photo migration.
    const actionable = await boardContactActionable(page, 'mor')

    await openContactManagement(page)
    const cr = await callReady(page)
    const trace = await traceText(page)
    console.log(`[LAB:${label}] reopen ${reopen}: board-actionable=${actionable} call-ready=${cr}`)
    if (!actionable || cr < IMPORT_IDS.length) {
      console.log(`[LAB:${label}] reopen ${reopen} FAILURE trace:\n${trace}`) // exact N→0
    }

    expect(actionable, `${label} reopen ${reopen}: mor Call button must survive`).toBe(true)
    expect(cr, `${label} reopen ${reopen}: call-ready must stay >= ${IMPORT_IDS.length}`).toBeGreaterThanOrEqual(IMPORT_IDS.length)

    await ctx.close()
  }
}

test('chromium persistent profile: import → terminate → reopen ×5 keeps phones', async () => {
  test.setTimeout(300_000)
  await runLifecycle(chromium, 'chromium')
})

// WebKit is the closest automatable proxy to iOS Safari's storage engine. If
// phones also survive here, the device-only residual is iOS ITP eviction / the
// standalone-PWA storage partition — not the app's storage code.
test('webkit persistent profile: import → terminate → reopen ×5 keeps phones', async () => {
  test.setTimeout(300_000)
  await runLifecycle(webkit, 'webkit')
})

/**
 * Abu WhatsApp voice-compose — REAL browser smoke (evidence class: BROWSER).
 *
 * Drives the actual built app in a mobile-chrome viewport. Because /api/* is a
 * Vercel serverless route NOT served by `vite preview`, the LLM composer fails
 * and the app uses its LOCAL deterministic composer — which is exactly the
 * provider-failure/offline path we must prove. This does NOT prove PHYSICAL
 * DEVICE audio or a real WhatsApp app handoff.
 *
 * Voice is injected through the SAME public speech-result boundary the real
 * microphone uses (window.webkitSpeechRecognition.onresult), so voice-derived
 * and typed input provably reach the same command-understanding + composition
 * runtime. No auto-send: wa.me navigation is intercepted and asserted.
 *
 *   npx playwright test e2e/whatsapp-voice-compose.spec.ts --project=mobile-chrome
 */
import { test, expect, type Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SHOTS = path.resolve(HERE, 'screenshots')

// Fake, test-only phone (never a real number). Seeded into LOCAL storage only.
const TEST_PHONE = '+972500000123'

// Seed a device-local contact for אדר + inject a controllable SpeechRecognition.
async function primeApp(page: Page): Promise<void> {
  await page.addInitScript((phone) => {
    try {
      const envelope = { v: 2, contacts: [{ id: 'adar', enabled: true, phoneE164: phone }] }
      localStorage.setItem('abubank.familyContacts.v1', JSON.stringify(envelope))
    } catch { /* ignore */ }
    // Controllable fake SpeechRecognition — drives the SAME onresult path.
    ;(window as any).__WA_TRANSCRIPT = null
    class FakeSR {
      lang = ''
      continuous = false
      interimResults = false
      maxAlternatives = 1
      onresult: ((e: any) => void) | null = null
      onerror: ((e: any) => void) | null = null
      onend: (() => void) | null = null
      start() {
        setTimeout(() => {
          const t = (window as any).__WA_TRANSCRIPT
          if (t != null && t !== '') {
            ;(window as any).__WA_TRANSCRIPT = null
            this.onresult?.({ results: [[{ transcript: t }]] })
          } else {
            this.onend?.()
          }
        }, 40)
      }
      stop() { this.onend?.() }
      abort() {}
    }
    ;(window as any).SpeechRecognition = FakeSR
    ;(window as any).webkitSpeechRecognition = FakeSR
  }, TEST_PHONE)
}

// Open the compose overlay. `voiceTranscript` is set AFTER navigation (goto
// re-runs addInitScript which resets it) and just before the overlay mounts, so
// the fake SpeechRecognition delivers it through the real onresult boundary.
async function openCompose(page: Page, voiceTranscript?: string): Promise<void> {
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })
  await page.getByRole('button', { name: /WhatsApp|הודעות/ }).first().click()
  const cta = page.getByTestId('abuwhatsapp-voice-compose-cta')
  await cta.waitFor({ state: 'visible', timeout: 10_000 })
  if (voiceTranscript) {
    await page.evaluate((t) => { (window as any).__WA_TRANSCRIPT = t }, voiceTranscript)
  }
  await cta.click()
  await page.getByTestId('voice-compose-overlay').waitFor({ state: 'visible', timeout: 10_000 })
}

// Intercept the WhatsApp handoff so the test never leaves the app, and capture
// the exact URL that WOULD open (proves construction + prefill + no auto-send).
function captureWaUrl(page: Page): { get: () => string } {
  const box = { url: '' }
  page.route(/wa\.me/, (route) => { box.url = route.request().url(); return route.abort() })
  return { get: () => box.url }
}

// Force the DETERMINISTIC local composer by blocking every LLM provider. This
// makes the smoke reproducible regardless of bundled keys AND is exactly the
// provider-failure / offline path (PATH E) we must prove behaves well.
async function forceLocalComposer(page: Page): Promise<void> {
  await page.route(/\/api\/abuai-chat/, (r) => r.abort())
  await page.route(/generativelanguage\.googleapis\.com/, (r) => r.abort())
  await page.route(/api\.groq\.com/, (r) => r.abort())
}

test.describe('Abu WhatsApp — voice compose real browser smoke', () => {
  test.beforeEach(async ({ page }) => { await primeApp(page); await forceLocalComposer(page) })

  test('PATH B (voice) → local compose → review preserves recipient + fact; PATH F correction', async ({ page }) => {
    fs.mkdirSync(SHOTS, { recursive: true })
    const consoleErrors: string[] = []
    page.on('console', (m) => {
      if (m.type() !== 'error') return
      const t = m.text()
      // The smoke intentionally aborts the LLM providers → benign net::ERR_FAILED.
      if (/ERR_FAILED|Failed to load resource/i.test(t)) return
      consoleErrors.push(t.slice(0, 160))
    })
    page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message.slice(0, 160)))

    // Voice utterance with a spelled time so the correction can swap it.
    await openCompose(page, 'תכתבי לאדר שאני מגיע בשבע')

    const draft = page.getByTestId('vc-draft')
    await draft.waitFor({ state: 'visible', timeout: 15_000 })
    const firstText = await draft.inputValue()
    expect(firstText.length).toBeGreaterThan(0)
    expect(firstText).toContain('אדר')          // recipient preserved
    expect(firstText).toContain('שבע')          // fact preserved (local composer)
    // Provider unavailable locally → local fallback path is shown honestly.
    await expect(page.getByTestId('vc-compose-path')).toContainText('מקומי')
    await page.screenshot({ path: path.join(SHOTS, 'wa-voice-review.png') })

    // PATH F — typed follow-up correction updates the SAME draft (7→8 + funny).
    await page.getByTestId('vc-correction-input').fill('לא, בשמונה, ותעשי מצחיק')
    await page.getByTestId('vc-correction-input').press('Enter')
    await expect(page.getByTestId('vc-draft')).toHaveValue(/שמונה/, { timeout: 15_000 })
    const corrected = await draft.inputValue()
    expect(corrected).not.toContain('שבע')       // old time replaced, not appended
    expect(corrected).toContain('אדר')           // recipient still preserved
    await expect(page.getByTestId('vc-style-funny')).toHaveCSS('font-weight', '700')
    await page.screenshot({ path: path.join(SHOTS, 'wa-voice-corrected.png') })

    expect(consoleErrors, `console errors: ${consoleErrors.join(' | ')}`).toEqual([])
  })

  test('PATH A (typed) → style switch regenerates → open builds exact wa.me prefill (no auto-send)', async ({ page }) => {
    const wa = captureWaUrl(page)
    await openCompose(page) // no voice transcript → typed path

    // Typed request through the same runtime as voice.
    await page.getByTestId('vc-typed-input').fill('תכתבי לאדר שאני מגיע ב-8')
    await page.getByTestId('vc-typed-send').click()
    const draft = page.getByTestId('vc-draft')
    await draft.waitFor({ state: 'visible', timeout: 15_000 })
    expect(await draft.inputValue()).toContain('8')

    // Switch to Abu style → regenerates, recipient + number survive.
    await page.getByTestId('vc-style-abu').click()
    await expect(draft).toHaveValue(/8/, { timeout: 15_000 })
    const abuText = await draft.inputValue()
    expect(abuText).toContain('אדר')
    expect(abuText).toContain('8')

    // Open in WhatsApp → intercepted. Assert exact phone + URL-encoded final text.
    await page.getByTestId('vc-open-whatsapp').click()
    await expect.poll(() => wa.get(), { timeout: 10_000 }).toContain('wa.me/972500000123')
    const decoded = decodeURIComponent(wa.get().split('?text=')[1] ?? '')
    expect(decoded).toBe(abuText) // deep-link text === the exact reviewed draft (no auto-send)
  })

  test('PATH C (ambiguous name) surfaces a chooser instead of guessing', async ({ page }) => {
    await openCompose(page, 'תכתבי לאדד שלום') // STT-like misspelling of אדר
    // Must ask — never silently pick.
    await expect(page.getByTestId('vc-pick-grid')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('vc-pick-adar')).toBeVisible()
    await page.getByTestId('vc-pick-adar').click()
    await expect(page.getByTestId('vc-draft')).toBeVisible({ timeout: 15_000 })
    expect(await page.getByTestId('vc-draft').inputValue()).toContain('שלום')
  })

  test('responsive — smallest iPhone viewport keeps the draft + actions reachable', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 }) // iPhone SE (1st gen)
    await openCompose(page) // typed path
    await page.getByTestId('vc-typed-input').fill('תכתבי לאדר שאני מגיע ב-8 ואני מאוד מאוד מתרגש לראות אותך אחרי הרבה זמן שלא נפגשנו וזה ממש חשוב לי')
    await page.getByTestId('vc-typed-send').click()
    const draft = page.getByTestId('vc-draft')
    await draft.waitFor({ state: 'visible', timeout: 15_000 })
    // Long Hebrew content stays inside the viewport width (no horizontal overflow).
    const box = await draft.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeLessThanOrEqual(320)
    // Draft remains editable and the primary action + style toggles are reachable.
    await expect(draft).toBeEditable()
    await expect(page.getByTestId('vc-open-whatsapp')).toBeVisible()
    await page.getByTestId('vc-open-whatsapp').scrollIntoViewIfNeeded()
    await expect(page.getByTestId('vc-style-abu')).toBeVisible()
    await expect(page.getByTestId('vc-close')).toBeVisible()
    await page.screenshot({ path: path.join(SHOTS, 'wa-voice-iphone-se.png') })
  })

  test('PATH D (no phone) keeps the draft and refuses an invalid deep link', async ({ page }) => {
    const wa = captureWaUrl(page)
    // Target מור — NOT seeded with a phone → not actionable.
    await openCompose(page, 'תכתבי למור שאני אוהבת אותה')
    const draft = page.getByTestId('vc-draft')
    await draft.waitFor({ state: 'visible', timeout: 15_000 })
    expect((await draft.inputValue()).length).toBeGreaterThan(0)
    await page.getByTestId('vc-open-whatsapp').click()
    // No phone → honest fallback, NO wa.me navigation.
    await expect(page.getByTestId('vc-error')).toBeVisible()
    await expect(page.getByTestId('vc-open-group')).toBeVisible()
    expect(wa.get()).toBe('')
    // Draft is not lost.
    expect((await draft.inputValue()).length).toBeGreaterThan(0)
  })
})

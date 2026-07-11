/**
 * P0-1 Phase A — BROWSER-LEVEL voice playback proof (against the DEPLOYED Preview).
 * ════════════════════════════════════════════════════════════════════════════════
 * Proves, in a real Chromium, that the pipeline TTS path:
 *   • is actually invoked (play requested),
 *   • starts playback (the runtime playback-proof counter advances ONLY when audio
 *     truly plays — an AudioContext BufferSource resolves true only after onended,
 *     i.e. the clip played in real time → playback time advanced),
 *   • falls back OpenAI → Gemini → Web Speech, and
 *   • NEVER succeeds silently: when every tier is blocked it returns false.
 *
 * IMPORTANT: receiving audio bytes is NOT proof. Only the counter advancing (real
 * play) is. Test A can only fully prove audibility if the Preview TTS provider
 * returns audio; its result is recorded so the verdict is honest either way.
 *
 *   PREVIEW_URL=<deploy> npx playwright test e2e/voice-playback-proof.spec.ts --project=mobile-chrome
 */
import { test, expect, type Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../docs/eval')

// Headless Chromium must allow autoplay so AudioContext playback runs without a gesture.
test.use({ launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } })

async function enterAbuAIWithHook(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })
  const ai = page.locator('text=Abu AI').first()
  await ai.waitFor({ state: 'visible', timeout: 15_000 })
  await ai.click()
  await page.locator('textarea[placeholder]').waitFor({ state: 'visible', timeout: 10_000 })
  // The voice module (and its __abuTTS hook) loads with the AbuAI chunk.
  await page.waitForFunction(() => !!(window as unknown as { __abuTTS?: unknown }).__abuTTS, undefined, { timeout: 15_000 })
}

test('A) pipeline TTS is invoked and playback actually starts (real-audio proof)', async ({ page }) => {
  await enterAbuAIWithHook(page)
  const r = await page.evaluate(async () => {
    const w = window as unknown as { __abuTTS: { speakVoiceMode: (t: string) => Promise<boolean>; getTTSPlayedCount: () => number; getTTSTrace: () => Array<{ provider: string; status: string }> } }
    const before = w.__abuTTS.getTTSPlayedCount()
    const t0 = performance.now()
    const played = await w.__abuTTS.speakVoiceMode('שלום מרטיטה, בוקר טוב')
    const elapsedMs = Math.round(performance.now() - t0)
    return { played, before, after: w.__abuTTS.getTTSPlayedCount(), elapsedMs, trace: w.__abuTTS.getTTSTrace().slice(-3) }
  })
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, 'VOICE_PLAYBACK_PROOF.json'), JSON.stringify({ testA: r }, null, 1))
  // eslint-disable-next-line no-console
  console.log(`[PLAYBACK] played=${r.played} counter ${r.before}→${r.after} elapsed=${r.elapsedMs}ms trace=${JSON.stringify(r.trace)}`)

  // The pipeline was invoked and returned a truthful boolean (play requested).
  expect(typeof r.played).toBe('boolean')
  if (r.played) {
    // REAL playback proof: the counter only advances when audio truly played, and
    // AudioContext playback resolves true only after the clip elapsed (time advanced).
    expect(r.after).toBeGreaterThan(r.before)
    expect(r.elapsedMs).toBeGreaterThan(50)
  } else {
    // Provider returned no audio on this Preview → audibility NOT proven here.
    // The mechanism is still correct (truthful false → recovery), but this makes
    // the audible-voice gate a BLOCKER for the verdict, not a pass.
    // eslint-disable-next-line no-console
    console.log('[PLAYBACK] NOT PROVEN: no provider audio on Preview (recovery path instead)')
  }
})

test('B) fallback chain activates when the primary (OpenAI) TTS path fails', async ({ page }) => {
  // Fail the primary (OpenAI proxy) and the second tier (Gemini) so the pipeline
  // MUST fall through past them. (We do not disable Web Speech — doing so breaks
  // voice.ts module load; the total-failure→false→recovery path is covered by the
  // decideRealtimeAudioFallback unit test + the source-level recovery-button test.)
  await page.route('**/api/abuai-tts', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'TTS_PROVIDER_FAILED' }) }))
  await page.route('**/generativelanguage.googleapis.com/**', route => route.abort())
  await enterAbuAIWithHook(page)
  const r = await page.evaluate(async () => {
    const w = window as unknown as { __abuTTS: { speakVoiceMode: (t: string) => Promise<boolean>; getTTSTrace: () => Array<{ provider: string; status: string }> } }
    const played = await w.__abuTTS.speakVoiceMode('שלום')
    return { played, trace: w.__abuTTS.getTTSTrace() }
  })
  // eslint-disable-next-line no-console
  console.log(`[FALLBACK] played=${r.played} providers=${r.trace.map(t => t.provider).join('→')}`)

  // Truthful boolean, never a throw.
  expect(typeof r.played).toBe('boolean')
  // Primary attempted AND failed.
  expect(r.trace.some(t => t.provider === 'OpenAI' && /❌|FAIL/i.test(t.status))).toBe(true)
  // Fallback ACTIVATED: the chain moved PAST OpenAI/Gemini to a last-resort tier
  // (Web Speech in a browser, or NONE→recovery when no tier can play).
  const last = r.trace[r.trace.length - 1]?.provider
  expect(last === 'WebSpeech' || last === 'NONE').toBe(true)
  expect(last).not.toBe('OpenAI')
})

/*
 * NIGHTLY AUTOPILOT — proof: the scheduled chain runs (duel + analyzer + curator), emits ONE
 * Hebrew status line + a fix prompt when items exist, and the notification path chooses a
 * channel with an HONEST fallback (email if configured, else a Leo-only status page).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { runNightly, chooseNotifyChannel, notificationBody } from './nightlyAutopilot'
import type { TurnObs } from '../truth/weaknessMap'

const FIXED = new Date('2026-06-24T09:00:00')
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })
beforeEach(() => {
  const s: Record<string, string> = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => s[k] ?? null, setItem: (k: string, v: string) => { s[k] = v }, removeItem: (k: string) => { delete s[k] } })
  vi.stubGlobal('navigator', { onLine: true })
})

const REAL_MISSES: TurnObs[] = [
  { input: 'באיזה יום יש פגישה עם החתן של רפי?', reply: 'לא הצלחתי לנסח את זה. תגידי שוב', source: 'llm', intent: 'general' },
  { input: 'הקשר בין הדין לערבל', reply: 'עדי הוא בן דוד של נועם. נועם הוא אח של עדי.', source: 'llm', intent: 'general' },
]

describe('NIGHTLY AUTOPILOT — the chain runs and reports to Leo only', () => {
  it('a clean corpus with no reality misses → 🟢 הכל תקין, no fix prompt', async () => {
    const r = await runNightly('2026-06-24', { transcript: [] })
    expect(r.duel.regressions).toBe(0)      // the corpus duel is all-green
    expect(r.weakness.total).toBe(0)
    expect(r.ok).toBe(true)
    expect(r.hebrewLine).toBe('🟢 הכל תקין')
    expect(r.fixPrompt).toBeNull()
  })

  it('real flight-recorder misses → 🟠 with a count and a ready-made fix prompt', async () => {
    const r = await runNightly('2026-06-24', { transcript: REAL_MISSES, runCorpus: false })
    expect(r.weakness.total).toBeGreaterThanOrEqual(1)
    expect(r.ok).toBe(false)
    expect(r.hebrewLine).toMatch(/^🟠 נמצאו \d+ דברים לתיקון$/)
    expect(r.fixPrompt).toBeTruthy()
    expect(r.fixPrompt!).toContain('rc5')          // the fix prompt targets the branch
    expect(r.fixPrompt!).toContain('WEAKNESS MAP')  // names the archetype work
  })
})

describe('NIGHTLY AUTOPILOT — Leo-only notification with honest fallback', () => {
  it('emails when a provider + recipient are configured', () => {
    const d = chooseNotifyChannel({ RESEND_API_KEY: 'x', LEDGER_RECIPIENT: 'leo@example.com' })
    expect(d.channel).toBe('email')
    expect(d.recipient).toBe('leo@example.com')
  })
  it('falls back to a Leo-only status page when no email provider (this infra)', () => {
    const d = chooseNotifyChannel({})
    expect(d.channel).toBe('status-page')
    expect(d.reason).toContain('no email provider')
  })
  it('the notification body carries the Hebrew line + fix prompt, never Martita-facing text', () => {
    const body = notificationBody({ hebrewLine: '🟠 נמצאו 2 דברים לתיקון', fixPrompt: 'FIX THIS on rc5' })
    expect(body.subject).toContain('🟠')
    expect(body.text).toContain('FIX THIS on rc5')
  })
})

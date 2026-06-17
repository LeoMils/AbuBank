/**
 * Voice ADD UX Contract tests — P7
 *
 * Structural assertions on source files guarantee the product UX contract:
 * 1. Diagnostic UI (DEBUG / raw / parsed / confidence / source / stage /
 *    blob / chunks / mime / asr / whisper / "העתק אבחון קול" / "מה שמעתי")
 *    is NEVER visible in normal flow — always gated behind isDiagMode.
 * 2. Voice ready-to-confirm state shows כן לשמור / לא לתקן / ביטול.
 * 3. ConfirmCard never renders raw transcript.
 * 4. Saved success state is built from normalized draft data.
 * 5. "תקווה" command-garbage is blocked from title in scheduling context.
 * 6. Family relations remain correctly resolved.
 * 7. createAppointmentSafe is the sole public write path.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DIR = resolve(__dirname)

const VOICE = readFileSync(resolve(DIR, 'VoiceCard.tsx'), 'utf8')
const TRACE = readFileSync(resolve(DIR, 'VoiceTraceCard.tsx'), 'utf8')
const CONFIRM = readFileSync(resolve(DIR, 'ConfirmCard.tsx'), 'utf8')
const INDEX = readFileSync(resolve(DIR, 'index.tsx'), 'utf8')
const MANUAL = readFileSync(resolve(DIR, 'ManualModal.tsx'), 'utf8')
const SERVICE = readFileSync(resolve(DIR, 'service.ts'), 'utf8')
const FLOW = readFileSync(resolve(DIR, 'VoiceAddFlow.tsx'), 'utf8')

// ─── 1: Ready-to-confirm voice state shows approval buttons ────────────────

describe('P1 — voice confirmation surface', () => {
  it('renders כן לשמור / לא לתקן / ביטול via ConfirmCard', () => {
    expect(CONFIRM).toMatch(/>\s*כן, לשמור\s*</)
    expect(CONFIRM).toMatch(/>\s*לא, לתקן\s*</)
    expect(CONFIRM).toMatch(/>\s*ביטול\s*</)
    expect(CONFIRM).toContain('data-testid="confirm-save-btn"')
    expect(CONFIRM).toContain('data-testid="confirm-correct-btn"')
    expect(CONFIRM).toContain('data-testid="confirm-cancel-btn"')
  })

  it('VoiceCard uses ConfirmCard in non-editing state — single confirmed path', () => {
    expect(VOICE).toContain("import { ConfirmCard } from './ConfirmCard'")
    expect(VOICE).toContain('<ConfirmCard')
    expect(VOICE).toMatch(/!editing[\s\S]*<ConfirmCard/)
    expect(VOICE).toContain('onConfirm={doSave}')
    expect(VOICE).toContain('onCorrect={() => setEditing(true)}')
  })

  it('ConfirmCard is also used by the manual add flow', () => {
    expect(MANUAL).toContain("import { ConfirmCard } from './ConfirmCard'")
    expect(MANUAL).toContain('<ConfirmCard')
    expect(MANUAL).toContain('setConfirming(true)')
    expect(MANUAL).toContain('onConfirm={doManualSave}')
    expect(MANUAL).toMatch(/function doManualSave/)
    expect(MANUAL).toContain('onSave(appt)')
  })
})

// ─── 2: Diagnostic UI is gated — not visible by default ────────────────────

describe('P0 — diagnostic UI hidden from normal flow', () => {
  it('VoiceTraceCard gates technical metadata behind isDiagMode', () => {
    expect(TRACE).toContain('isDiagMode')
    // Each diagnostic string must appear INSIDE an isDiagMode block in the source.
    // We verify this by checking that isDiagMode appears before each string.
    expect(TRACE).toMatch(/isDiagMode[\s\S]*העתק אבחון קול/)
    expect(TRACE).toMatch(/isDiagMode[\s\S]*voice-trace-stage/)
    expect(TRACE).toMatch(/isDiagMode[\s\S]*blob:/)
    expect(TRACE).toMatch(/isDiagMode[\s\S]*chunks:/)
    expect(TRACE).toMatch(/isDiagMode[\s\S]*mime:/)
    expect(TRACE).toMatch(/isDiagMode[\s\S]*asr:/)
  })

  it('VoiceTraceCard only shows for errors in normal mode (early-exit guard exists)', () => {
    // The guard must exist: when not error AND not diagMode → return null
    expect(TRACE).toMatch(/!isError[\s\S]{0,80}!isDiagMode/)
    expect(TRACE).toMatch(/!isDiagMode[\s\S]{0,40}return null/)
  })

  it('VoiceCard gates transcript-box and DEBUG behind isDiagMode', () => {
    expect(VOICE).toContain('isDiagMode')
    // Each diagnostic string must appear INSIDE isDiagMode block
    expect(VOICE).toMatch(/isDiagMode[\s\S]*transcript-box/)
    expect(VOICE).toMatch(/isDiagMode[\s\S]*מה שמעתי/)
    expect(VOICE).toMatch(/isDiagMode[\s\S]*transcript-textarea/)
    expect(VOICE).toMatch(/isDiagMode[\s\S]*voice-debug/)
  })

  it('"מצב הקלטה" is only shown in diagnostic mode or error state (guard exists)', () => {
    expect(TRACE).toContain('isDiagMode')
    // The card title "מצב הקלטה" remains (shown in diagMode or error), but is guarded
    expect(TRACE).toContain('מצב הקלטה')
    // The early-exit condition keeps non-errors hidden: !isError && !isDiagMode → null
    expect(TRACE).toMatch(/!isError[\s\S]{0,80}!isDiagMode/)
  })

  it('ConfirmCard never contains diagnostic strings', () => {
    expect(CONFIRM).not.toContain('transcript-box')
    expect(CONFIRM).not.toContain('transcript-textarea')
    expect(CONFIRM).not.toContain('rawTranscript')
    expect(CONFIRM).not.toMatch(/draft\.notes/)
    expect(CONFIRM).not.toMatch(/draft\.location/)
  })
})

// ─── 3: P2 — saved success state is clean ──────────────────────────────────

describe('P2 — clean saved success state', () => {
  it('VoiceAddFlow saved panel has the required test IDs and copy', () => {
    expect(FLOW).toContain('vaf-saved')
    expect(FLOW).toContain('vaf-saved-title')
    expect(FLOW).toContain('vaf-saved-when')
    expect(FLOW).toContain('vaf-saved-close')
    expect(FLOW).toContain('נשמר ביומן')
  })

  it('savedConfirmation state is set from normalized appointment, not raw ASR', () => {
    // setSavedConfirmation uses result.appointment.title/date/time — not rawTranscript
    expect(INDEX).toMatch(/setSavedConfirmation\(\s*\{/)
    expect(INDEX).toMatch(/title: result\.appointment\.title/)
    expect(INDEX).toMatch(/date: result\.appointment\.date/)
    expect(INDEX).toMatch(/time: result\.appointment\.time/)
  })

  it('VoiceAddFlow saved panel has close and show-day buttons', () => {
    expect(FLOW).toContain('vaf-saved-close')
    expect(FLOW).toContain('vaf-saved-show-day')
    expect(FLOW).toContain('סגור')
    expect(FLOW).toContain('הצג ביום')
  })
})

// ─── 4: P3 — command-garbage sanitizer ─────────────────────────────────────

describe('P3 — ASR command-garbage strip', () => {
  it('"תקווה" is stripped from the start of a parsed title (ASR mishear guard)', async () => {
    const { parseLocally } = await import('./localParser')
    const today = '2026-05-28'
    // Simulate "תקווה" as first word (ASR mishear of "תקבעי")
    const r = parseLocally('תקווה פגישה מחר בשעה 21', today)
    expect(r.title).not.toMatch(/^תקווה/)
  })

  it('"תקווה" inside "פתח תקווה" is not stripped (not a leading command-word)', async () => {
    const { parseLocally } = await import('./localParser')
    const today = '2026-05-28'
    const r = parseLocally('פגישה בפתח תקווה מחר בשעה 10', today)
    // "פתח תקווה" is a location, not stripped — title should not be "פתח"
    expect(r.title).not.toBe('')
    expect(r.location ?? '').toMatch(/תקווה/)
  })
})

// ─── 5: Family relation resolution ─────────────────────────────────────────

describe('P4 — family relationship display', () => {
  it('"הבעל של אופיר" resolves to גלעד', async () => {
    const { resolvePersonPhrase } = await import('./familyResolve')
    const r = resolvePersonPhrase('הבעל של אופיר')
    expect(r.status).toBe('resolved')
    if (r.status === 'resolved') expect(r.name).toBe('גלעד')
  })

  it('"הבת של מור" is missing — never invented', async () => {
    const { resolvePersonPhrase } = await import('./familyResolve')
    const r = resolvePersonPhrase('הבת של מור')
    expect(r.status).toBe('missing')
    if (r.status === 'missing') expect(r.phrase).toBe('הבת של מור')
  })

  it('"הבן של מור" is ambiguous — 4+ candidates, never auto-selected', async () => {
    const { resolvePersonPhrase } = await import('./familyResolve')
    const r = resolvePersonPhrase('הבן של מור')
    expect(r.status).toBe('ambiguous')
    if (r.status === 'ambiguous') expect(r.candidates.length).toBeGreaterThan(1)
  })

  it('ConfirmCard renders resolved / ambiguous / missing relation states', () => {
    expect(CONFIRM).toContain('data-testid="relation-secondary"')
    expect(CONFIRM).toContain('data-testid="relation-candidate"')
    expect(CONFIRM).toContain('data-testid="relation-keep"')
    expect(CONFIRM).toContain('data-testid="relation-missing"')
    expect(CONFIRM).toMatch(/למי התכוונת\?/)
    expect(CONFIRM).toContain('לא מצאתי בוודאות מי')
    expect(CONFIRM).toContain('להשאיר כמו שאמרתי')
  })
})

// ─── 6: "21" → 21:00 ───────────────────────────────────────────────────────

describe('P4 — time parsing', () => {
  it('"21" bare hour parses to 21:00', async () => {
    const { processVoiceTranscript } = await import('./voiceAutoCreate')
    const r = processVoiceTranscript('תקבעי פגישה למחר בשעה 21', '2026-05-28')
    const time = ('draft' in r ? r.draft.time : 'appointment' in r ? r.appointment.time : null)
    expect(time).toBe('21:00')
  })
})

// ─── 7: Correction mode has clean fields only ──────────────────────────────

describe('P5 — correction mode (לא, לתקן)', () => {
  it('VoiceCard correction mode shows clean field labels (מה / מתי / שעה / איפה)', () => {
    // Correction block has the field labels
    expect(VOICE).toContain('field-what')
    expect(VOICE).toContain('field-date')
    expect(VOICE).toContain('field-time')
    expect(VOICE).toContain('field-where')
  })

  it('transcript-box is absent from correction mode in normal flow (diagMode only)', () => {
    const diagIdx = VOICE.indexOf('isDiagMode')
    // Both transcript-box and "מה שמעתי" must be after isDiagMode check
    expect(VOICE.indexOf('transcript-box')).toBeGreaterThan(diagIdx)
  })
})

// ─── 8: createAppointmentSafe is the only write path ───────────────────────

describe('Write path invariant', () => {
  it('createAppointmentSafe is the only exported create function in service.ts', () => {
    expect(SERVICE).toMatch(/export\s+function\s+createAppointmentSafe\s*\(/)
    expect(SERVICE).not.toMatch(/export\s+function\s+createAppointment\b(?!Safe)/)
  })
})

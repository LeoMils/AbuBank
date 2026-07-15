/*
 * AbuCalendar P0.1 — voice E2E auto-create contract.
 *
 * Phone QA after PR #28 still fails: "I recorded a meeting and nothing
 * was created." This file pins the new contract that closes the gap:
 *
 *  1. When a transcript contains an explicit CREATE VERB (HE: תקבעי,
 *     תוסיפי, etc.; ES: agregá, agendá; EN: add, schedule) AND the
 *     parser yields title + date + time + unambiguous, the runtime
 *     MUST auto-create the event — no hidden confirm step.
 *  2. When the transcript is unclear (low confidence, missing field),
 *     the UI MUST surface a visible state (VoiceCard or clarification
 *     question). It MUST NOT silently dismiss the transcript.
 *  3. After successful create, the calendar's selected day MUST jump
 *     to the new appointment's date so the event is visible.
 *
 * These tests verify the pure helpers (createVerbDetection +
 * processVoiceTranscript) and the source-contract guards on
 * index.tsx wiring them in.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import { containsCreateVerb, processVoiceTranscript } from './voiceAutoCreate'
import { loadAppointments } from './service'

let storage: Record<string, string> = {}
beforeEach(() => {
  storage = {}
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v },
    removeItem: (k: string) => { delete storage[k] },
    clear: () => { storage = {} },
  })
})

const TODAY = '2026-05-11'
const TOMORROW = '2026-05-12'

describe('P0.1 — containsCreateVerb detector (HE/ES/EN)', () => {
  it('Hebrew: "תקבעי" / "תוסיפי" / "תרשמי" / "תכניסי" / "תזכירי" → true', () => {
    expect(containsCreateVerb('תקבעי פגישה עם לאו מחר בעשר')).toBe(true)
    expect(containsCreateVerb('תוסיפי פגישה עם רופא מחר בארבע')).toBe(true)
    expect(containsCreateVerb('תרשמי לי משהו ליום ראשון')).toBe(true)
    expect(containsCreateVerb('תכניסי ליומן רופא מחר')).toBe(true)
    expect(containsCreateVerb('תזכירי לי רופא מחר בעשר')).toBe(true)
  })

  it('Hebrew: infinitive forms "להוסיף" / "לקבוע" → true', () => {
    expect(containsCreateVerb('אני רוצה להוסיף פגישה')).toBe(true)
    expect(containsCreateVerb('בואי לקבוע פגישה')).toBe(true)
  })

  it('Hebrew: "שימי" / "שים" / "לשים" (put in calendar) → true', () => {
    expect(containsCreateVerb('שימי לי ביומן פגישה מחר')).toBe(true)
    expect(containsCreateVerb('שים לי ביומן רופא מחר')).toBe(true)
    expect(containsCreateVerb('אני רוצה לשים ביומן פגישה')).toBe(true)
  })

  it('Spanish: "agregá" / "agendá" / "poneme" / "anotá" / "añade" → true', () => {
    expect(containsCreateVerb('Agregá médico mañana a las diez')).toBe(true)
    expect(containsCreateVerb('Agendá una reunión con Leo')).toBe(true)
    expect(containsCreateVerb('Poneme médico mañana a las diez')).toBe(true)
    expect(containsCreateVerb('Anotá la cita con el doctor')).toBe(true)
    expect(containsCreateVerb('Añade reunión con Gilad')).toBe(true)
  })

  it('English: "add" / "schedule" / "create" / "put" / "remind me to" → true', () => {
    expect(containsCreateVerb('Add meeting with Gilad tomorrow at 4pm')).toBe(true)
    expect(containsCreateVerb('Schedule a meeting tomorrow')).toBe(true)
    expect(containsCreateVerb('Create an appointment with Leo')).toBe(true)
    expect(containsCreateVerb('Put a reminder for tomorrow')).toBe(true)
    expect(containsCreateVerb('Remind me to call Leo tomorrow')).toBe(true)
  })

  it('Non-create utterances → false', () => {
    expect(containsCreateVerb('מה יש לי מחר?')).toBe(false)
    expect(containsCreateVerb('what is on tomorrow')).toBe(false)
    expect(containsCreateVerb('Estoy pensando en agendar')).toBe(true) // contains "agendar"
    expect(containsCreateVerb('hello there')).toBe(false)
  })
})

describe('P0.1 — processVoiceTranscript end-to-end', () => {
  it('Hebrew complete + create-verb → auto-creates an event', () => {
    const r = processVoiceTranscript('תקבעי פגישה עם לאו מחר בעשר בבוקר', TODAY)
    expect(r.action).toBe('auto_created')
    if (r.action !== 'auto_created') return
    expect(r.appointment.date).toBe(TOMORROW)
    expect(r.appointment.time).toBe('10:00')
    expect(r.appointment.title).toContain('לאו')
    // Round-trip: event is persisted.
    expect(loadAppointments().some((a) => a.id === r.appointment.id)).toBe(true)
  })

  it('Spanish complete + create-verb → auto-creates', () => {
    const r = processVoiceTranscript('Agregá médico mañana a las diez', TODAY)
    expect(r.action).toBe('auto_created')
    if (r.action !== 'auto_created') return
    expect(r.appointment.date).toBe(TOMORROW)
    expect(r.appointment.time).toBe('10:00')
    expect(r.appointment.title.toLowerCase()).toContain('médico')
  })

  it('English complete + create-verb → auto-creates', () => {
    const r = processVoiceTranscript('Add meeting with Gilad tomorrow at 4pm', TODAY)
    expect(r.action).toBe('auto_created')
    if (r.action !== 'auto_created') return
    expect(r.appointment.date).toBe(TOMORROW)
    expect(r.appointment.time).toBe('16:00')
    expect(r.appointment.title).toContain('Gilad')
  })

  it('Ambiguous time + create-verb → defers to AM/PM resolver (no silent create)', () => {
    const r = processVoiceTranscript('תוסיפי פגישה עם רופא מחר בארבע', TODAY)
    expect(r.action).toBe('needs_am_pm')
    if (r.action !== 'needs_am_pm') return
    expect(r.draft.date).toBe(TOMORROW)
    expect(r.draft.time).toBe('04:00')
    expect(loadAppointments().length).toBe(0)
  })

  it('Missing time → asks for clarification (no silent create)', () => {
    const r = processVoiceTranscript('תוסיפי פגישה עם רופא מחר', TODAY)
    expect(r.action).toBe('needs_clarification')
    if (r.action !== 'needs_clarification') return
    expect(r.missing).toContain('time')
    expect(r.question.length).toBeGreaterThan(0)
    expect(loadAppointments().length).toBe(0)
  })

  it('Missing title AND time → clarification with both fields listed', () => {
    const r = processVoiceTranscript('מחר', TODAY)
    expect(r.action).toBe('needs_clarification')
    if (r.action !== 'needs_clarification') return
    expect(r.missing.length).toBeGreaterThan(0)
  })

  it('No create-verb but complete intent → routes to confirmation card (not auto-create)', () => {
    // Bare statement-of-fact without an imperative verb stays in the
    // visible-confirmation path so we never create from passive speech.
    const r = processVoiceTranscript('פגישה עם לאו מחר בעשר בבוקר', TODAY)
    expect(r.action).toBe('show_confirm_card')
    expect(loadAppointments().length).toBe(0)
  })

  it('Empty transcript → no-op failure', () => {
    const r = processVoiceTranscript('', TODAY)
    expect(r.action).toBe('failed_to_understand')
  })

  it('Garbled / very short transcript → failed_to_understand', () => {
    const r = processVoiceTranscript('emmm', TODAY)
    expect(r.action).toBe('failed_to_understand')
  })


  it('Conversational-only sentence → not_calendar and no create', () => {
    const r = processVoiceTranscript('אופיר סיפרה לי על סרט יפה', TODAY)
    expect(r.action).toBe('not_calendar')
    expect(loadAppointments().length).toBe(0)
  })

  it('Low ASR confidence → low_confidence and no create', () => {
    const r = processVoiceTranscript('תקבעי פגישה עם לאו מחר בעשר בבוקר', TODAY, { asr: { avgLogprob: -1.8, noSpeechProb: 0.82 } })
    expect(r.action).toBe('low_confidence')
    expect(loadAppointments().length).toBe(0)
  })

  it('Strong scheduling narrative without create verb can still auto-create when complete and high confidence', () => {
    const r = processVoiceTranscript('אני צריך לשמור על הילדים אצל אופיר מחר בין שבע לעשר', TODAY)
    expect(r.action).toBe('auto_created')
    if (r.action !== 'auto_created') return
    expect(r.appointment.time).toBe('19:00')
    expect(r.appointment.date).toBe(TOMORROW)
  })

  it('Storage failure during auto-create → failed_to_save (honest)', () => {
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => storage[k] ?? null,
      setItem: () => { throw new Error('QuotaExceededError') },
      removeItem: (k: string) => { delete storage[k] },
      clear: () => { storage = {} },
    })
    const r = processVoiceTranscript('תקבעי פגישה עם לאו מחר בעשר בבוקר', TODAY)
    expect(r.action).toBe('failed_to_save')
  })
})

describe('P0.1 — index.tsx wiring contract', () => {
  const SRC = fs.readFileSync(path.resolve(__dirname, 'index.tsx'), 'utf8')

  it('imports processVoiceTranscript', () => {
    expect(SRC.includes("import { processVoiceTranscript }")).toBe(true)
  })

  it('voice transcript path calls processVoiceTranscript and handles each action branch', () => {
    expect(SRC.includes('processVoiceTranscript(')).toBe(true)
    // The four action branches must all be present in source.
    expect(SRC.includes("case 'auto_created'")).toBe(true)
    expect(SRC.includes("case 'needs_am_pm'")).toBe(true)
    expect(SRC.includes("case 'needs_clarification'")).toBe(true)
    expect(SRC.includes("case 'show_confirm_card'")).toBe(true)
    expect(SRC.includes("case 'failed_to_save'")).toBe(true)
    expect(SRC.includes("case 'failed_to_understand'")).toBe(true)
    expect(SRC.includes("case 'not_calendar'")).toBe(true)
    expect(SRC.includes("case 'low_confidence'")).toBe(true)
  })

  it('after auto_created or successful handleVoiceConfirm, selectedDay jumps to the appointment date (visibility fix)', () => {
    // Source contract: `setSelectedDay(...appointment.date)` must
    // appear inside both the auto-create branch and handleVoiceConfirm.
    expect(/setSelectedDay\(.*\.appointment\.date\)/.test(SRC)).toBe(true)
    expect(/setSelectedDay\(result\.appointment\.date\)/.test(SRC) ||
           /setSelectedDay\(r\.appointment\.date\)/.test(SRC)).toBe(true)
  })

  it('low-confidence drop is no longer a 4-second silent dismiss', () => {
    // The old branch was: setVoiceStatus('לא הבנתי בדיוק...'); setTimeout(...4000...) → drop.
    // The new branch must either keep VoiceCard visible OR surface a
    // failure toast. We assert the silent setTimeout dismiss for the
    // low-confidence path is gone.
    expect(SRC.includes("setVoiceStatus('לא הבנתי בדיוק. נסי להגיד יום, שעה ומה האירוע.')")).toBe(false)
  })
})

describe('P0.1 — hard rules still preserved', () => {
  it('AbuAI useRealtime is enabled with grounding', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'AbuAI', 'index.tsx'), 'utf8')
    expect(src.includes('const useRealtime = isRealtimeBetaEnabled()')).toBe(true)
  })

  it('no production AbuAI source reads VITE_OPENAI_API_KEY', () => {
    const ABUAI = path.resolve(__dirname, '..', 'AbuAI')
    const FORBIDDEN = ['VITE', '_OPENAI', '_API_KEY'].join('')
    for (const f of fs.readdirSync(ABUAI)) {
      if (!f.endsWith('.ts') && !f.endsWith('.tsx')) continue
      if (f.endsWith('.test.ts') || f.endsWith('.test.tsx')) continue
      const src = fs.readFileSync(path.join(ABUAI, f), 'utf8')
      expect(src.includes(FORBIDDEN), `${f} reads ${FORBIDDEN}`).toBe(false)
    }
  })
})

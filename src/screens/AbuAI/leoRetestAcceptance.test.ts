/**
 * Leo iPhone-retest acceptance harness.
 *
 * Runs the SAME runtime functions the AbuAI UI calls (routePersonalQuery →
 * tryGroundedAnswer for reads, startCreate/resolvePendingMessage + addAppointment
 * for writes, onlineIntent for routing, enforceCompanion for tone) — not isolated
 * unit mocks. Each scenario maps 1:1 to a real-device failure Leo reported.
 *
 * Time is pinned to 2026-06-24 (today's date in the running session) so the
 * "today / tomorrow / next" math is deterministic.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import { routePersonalQuery } from './router'
import { tryGroundedAnswer } from './service'
import { startCreate, resolvePendingMessage } from './calendarCreate'
import { shapeCreateConfirm } from './responseShaper'
import { isOnlineCurrentInfoQuery, getOnlineQueryKind, shouldBlockOnlineForPersonal } from './onlineIntent'
import { enforceCompanion, findBannedPhrase } from './companionComposer'
import { resolveFollowUp } from './contextResolver'
import type { CompanionPlan } from './companionPlanner'
import { addAppointment, loadAppointments } from '../AbuCalendar/service'

const FIXED_TODAY = new Date('2026-06-24T09:00:00') // Wednesday
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED_TODAY) })
afterAll(() => { vi.useRealTimers() })

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const todayStr = () => localDate(new Date())
const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate() + 1); return localDate(d) }

let storage: Record<string, string> = {}
function installStorage() {
  storage = {}
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v },
    removeItem: (k: string) => { delete storage[k] },
  })
}

// The exact event from Leo's scenario A.
function seedAlexandraToday() {
  addAppointment({
    title: 'פגישה עם אלכסנדרה', date: todayStr(), time: '19:00', emoji: '☕',
    location: 'קפה גרג רעננה', subject: 'טיול לאיטליה', personName: 'אלכסנדרה',
  } as Parameters<typeof addAppointment>[0])
}

// ═══ A. Calendar READ — the core "AbuAI cannot read the calendar" failure ═══════
describe('A. calendar read resolves locally with WHO / WHEN / WHERE / SUBJECT', () => {
  beforeEach(() => { installStorage(); seedAlexandraToday() })

  const reads = [
    'איזה פגישה יש לי היום',
    'מתי אני נפגשת עם אלכסנדרה',
    'מה הפגישה הבאה שלי',
    'איפה הפגישה הבאה שלי',
  ]
  for (const q of reads) {
    it(`"${q}" → grounded (never sent to the LLM), includes person/time/location/subject`, () => {
      // Routes to a deterministic calendar read, NOT non_personal.
      expect(routePersonalQuery(q).type).toMatch(/^calendar_/)
      const ans = tryGroundedAnswer(q)
      expect(ans).not.toBeNull()
      expect(ans).toContain('אלכסנדרה')      // WHO
      expect(ans).toContain('שבע')            // WHEN — 19:00 spoken as "בשבע בערב"
      expect(ans).toContain('קפה גרג')        // WHERE
      expect(ans).toContain('טיול לאיטליה')   // SUBJECT
    })
  }

  it('week read also resolves locally', () => {
    expect(tryGroundedAnswer('איזה פגישות יש לי השבוע')).toContain('אלכסנדרה')
  })

  it('does NOT emit the "cannot check calendar" refusal for a real event', () => {
    const ans = tryGroundedAnswer('איזה פגישה יש לי היום') ?? ''
    expect(ans).not.toContain('לא יכולה לבדוק את היומן')
    expect(ans).not.toContain('לא מצליחה לבדוק')
  })
})

// ═══ B. Calendar CREATE — full event schema (where / subject / person) ══════════
describe('B. natural create extracts and persists WHERE + SUBJECT + WHO', () => {
  beforeEach(() => { installStorage() })

  const input = 'מחר בשבע בערב פגישה עם אלכסנדרה בקפה גרג ברעננה לדבר על הטיול לאיטליה'

  it('confirm card shows person / tomorrow / time / location / subject', () => {
    const s = startCreate(input)
    expect(s.phase).toBe('confirming')
    const d = s.draft
    expect(d.person).toBe('אלכסנדרה')
    expect(d.date).toBe(tomorrowStr())
    expect(d.time).toBe('19:00')
    expect(d.location).toBe('קפה גרג ברעננה')   // no "לדבר" leak
    expect(d.subject).toBe('טיול לאיטליה')

    const confirm = shapeCreateConfirm(d)
    expect(confirm).toContain('אלכסנדרה')
    expect(confirm).toContain('מחר')
    expect(confirm).toContain('קפה גרג ברעננה')
    expect(confirm).toContain('טיול לאיטליה')
  })

  it('saved calendar event persists location + subject + person, and reads back', () => {
    const s = startCreate(input)
    const r = resolvePendingMessage(s, 'כן', false)
    expect(r.action).toBe('save')
    if (r.action !== 'save') return
    const d = r.draft
    // Same mapping the UI save path uses (index.tsx addAppointment call).
    addAppointment({
      title: d.title!, date: d.date!, time: d.time!, emoji: d.emoji ?? '📅',
      ...(d.location ? { location: d.location } : {}),
      ...(d.subject ? { subject: d.subject } : {}),
      ...(d.person ? { personName: d.person } : {}),
    } as Parameters<typeof addAppointment>[0])

    const saved = loadAppointments().find(a => a.title === 'פגישה עם אלכסנדרה')
    expect(saved).toBeDefined()
    expect(saved!.location).toBe('קפה גרג ברעננה')
    expect(saved!.subject).toBe('טיול לאיטליה')
    expect(saved!.personName).toBe('אלכסנדרה')

    // Read it back through the same grounded path the UI uses.
    const back = tryGroundedAnswer('מה יש לי מחר') ?? ''
    expect(back).toContain('קפה גרג ברעננה')
    expect(back).toContain('טיול לאיטליה')
  })

  it('a "כי …" reason clause is captured as notes and shown on the confirm card', () => {
    const withNotes = 'מחר בשבע בערב פגישה עם אלכסנדרה בקפה גרג ברעננה כי אנחנו מתכננים את הטיול'
    const s = startCreate(withNotes)
    expect(s.draft.notes).toBe('אנחנו מתכננים את הטיול')
    const confirm = shapeCreateConfirm(s.draft)
    expect(confirm).toContain('אנחנו מתכננים את הטיול')
    expect(confirm).toContain('קפה גרג ברעננה')
  })
})

// ═══ C. Voice answer TTS — every voice answer must speak + log evidence ═════════
describe('C. voice answers go through TTS (source contract + grounded routing)', () => {
  const PROJECT_ROOT = path.resolve(__dirname, '../../..')
  const idx = fs.readFileSync(path.join(PROJECT_ROOT, 'src/screens/AbuAI/index.tsx'), 'utf8')

  it('grounded/family/calendar/online voice answers reach the serial speak call', () => {
    // The grounded voice branch speaks the answer (calendar/family/online all
    // return non-null from tryGroundedAnswer → this branch).
    expect(idx.includes('await speakVoiceMode(spokenText)')).toBe(true)
    expect(idx.includes('const voiceGrounded = tryGroundedAnswer(text)')).toBe(true)
  })

  it('every voice answer logs TTS evidence (engine / voice / length / success)', () => {
    expect(idx.includes('TTS_ENGINE_USED=')).toBe(true)
    expect(idx.includes('VOICE_NAME=')).toBe(true)
    expect(idx.includes('SPOKEN_TEXT_LENGTH=')).toBe(true)
    expect(/TTS_\$\{ok \? 'SUCCESS' : 'FAIL'\}/.test(idx)).toBe(true)
  })

  it('streaming LLM voice path falls back to serial speak if streaming TTS fails (no text-only success)', () => {
    expect(idx.includes('streamSpeakThrew')).toBe(true)
    expect(/streamSpeakThrew && voiceModeRef\.current[\s\S]{0,80}speakVoiceMode\(shapeVoiceSafe\(finalContent\)\)/.test(idx)).toBe(true)
  })

  it('calendar/family reads do NOT fall into the streaming LLM path (they are grounded)', () => {
    installStorage(); seedAlexandraToday()
    // If these are non-null, the voice handler takes the grounded → serial speak
    // branch, not the flaky streaming branch.
    expect(tryGroundedAnswer('איזה פגישה יש לי היום')).not.toBeNull()
    expect(tryGroundedAnswer('מי זאת מור')).not.toBeNull()
  })
})

// ═══ D. Online routing — current-info questions reach the online layer ══════════
describe('D. online current-info routing', () => {
  const cases: Array<[string, string]> = [
    ['איזה משחקים יש היום במונדיאל', 'sports'],
    ['מה חדש בעולם', 'latest'],
    ['מזג האוויר מחר בכפר סבא', 'weather'],
  ]
  for (const [q, kind] of cases) {
    it(`"${q}" routes to the online layer (${kind}), not a generic refusal`, () => {
      expect(isOnlineCurrentInfoQuery(q)).toBe(true)
      expect(getOnlineQueryKind(q)).toBe(kind)
      expect(shouldBlockOnlineForPersonal(q)).toBe(false)
      // It is NOT a personal/calendar/family query → won't be intercepted locally.
      expect(routePersonalQuery(q).type).toBe('non_personal')
    })
  }
})

// ═══ D2. Family runtime routing — deterministic graph BEFORE the LLM ════════════
describe('D2. family + continuation route to the deterministic graph', () => {
  beforeEach(() => { installStorage() })

  const direct = ['מי זאת מור', 'מי זאת ארי', 'מי הנכדים שלי', 'מי זאת אופיר']
  for (const q of direct) {
    it(`"${q}" → family_lookup, grounded (never the LLM)`, () => {
      expect(routePersonalQuery(q).type).toBe('family_lookup')
      expect(tryGroundedAnswer(q)).not.toBeNull()
    })
  }

  it('"עליה" after a family turn resolves to the last person via the graph', () => {
    const hist = [
      { role: 'user', content: 'מי זאת מור' },
      { role: 'assistant', content: 'מור, הבת שלך. בהוד השרון עם יעל.' },
    ]
    const r = resolveFollowUp('עליה', hist as never)
    expect(r.wasFollowUp).toBe(true)
    expect(r.resolved).toContain('מור')
    expect(routePersonalQuery(r.resolved).type).toBe('family_lookup')
    expect(tryGroundedAnswer(r.resolved)).not.toBeNull()
  })

  it('"תמשיכי" after a family turn continues on the person via the graph', () => {
    const hist = [
      { role: 'user', content: 'מי זאת מור' },
      { role: 'assistant', content: 'מור, הבת שלך. בהוד השרון עם יעל.' },
    ]
    const r = resolveFollowUp('תמשיכי', hist as never)
    expect(r.wasFollowUp).toBe(true)
    expect(r.resolved).toContain('מור')
    expect(routePersonalQuery(r.resolved).type).toBe('family_lookup')
  })
})

// ═══ E. Personality — no dead-bot / support-menu register ═══════════════════════
describe('E. personality guard strips banned support-menu / self-state phrases', () => {
  const plan: CompanionPlan = { step7_act: 'lead' } as CompanionPlan

  const banned = ['אני בסדר', 'רוצה לדבר על משהו אחר', 'איך אפשר לעזור', 'איך אני יכולה לעזור']
  for (const phrase of banned) {
    it(`"${phrase}" is recognized as banned and removed`, () => {
      expect(findBannedPhrase(phrase)).not.toBeNull()
      const cleaned = enforceCompanion(`${phrase}.`, plan)
      expect(cleaned).not.toContain(phrase)
      expect(cleaned.length).toBeGreaterThan(0) // never empty
    })
  }

  it('a bare cold "אין לי מידע" is rewritten to a warm human line', () => {
    const out = enforceCompanion('אין לי מידע.', plan)
    expect(out).not.toBe('אין לי מידע.')
    expect(out).not.toContain('אין לי מידע')
    expect(out.length).toBeGreaterThan(0)
  })

  it('a SPECIFIC honest negation is preserved (no-hallucination rule intact)', () => {
    const honest = 'אין לי את שנת הלידה של נועם. תשאלי ישירות.'
    expect(enforceCompanion(honest, plan)).toBe(honest)
  })

  it('the voice greeting contains none of the banned dead-bot phrases', () => {
    const PROJECT_ROOT = path.resolve(__dirname, '../../..')
    const idx = fs.readFileSync(path.join(PROJECT_ROOT, 'src/screens/AbuAI/index.tsx'), 'utf8')
    const greetMatch = idx.match(/function getVoiceGreeting\(\)[\s\S]*?return `([^`]+)`/)
    expect(greetMatch).not.toBeNull()
    const greeting = greetMatch![1]!
    expect(greeting).not.toContain('אני בסדר')
    expect(greeting).not.toContain('רוצה לדבר על משהו אחר')
    expect(greeting).not.toContain('איך אפשר לעזור')
    // It IS the warm, single, action-inviting line.
    expect(greeting).toContain('Martita')
  })
})

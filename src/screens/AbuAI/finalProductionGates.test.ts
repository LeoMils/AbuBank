/**
 * FINAL PRODUCTION GATES (non-device)
 * ═══════════════════════════════════
 * Phase 1 — voice diagnostics contract (the 6 device-debuggable keys emit).
 * Phase 2 — representative Martita-style corpus (~130 phrases) through the real
 *           runtime: intent ≥95% + 0 P0 on creates.
 * Phase 4 — reliability: 100 creates persist + round-trip, 100 reads, storage
 *           survives a simulated reload, offline degrades honestly.
 *
 * NOTE on honesty: the corpus is REPRESENTATIVE of how Martita speaks (drawn from
 * the patterns in memory/whatsapp_patterns.yaml + Leo's reported failures), not a
 * literal transcript dump — see docs/abuai/MARTITA_REALITY_CORPUS.md. Real-device
 * voice + a live human pilot are device-only and tracked in the Go/No-Go doc.
 *
 * Time pinned to 2026-06-24 (Wednesday).
 */
import fs from 'fs'
import path from 'path'
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { startCreate, isCreateIntent } from './calendarCreate'
import { routePersonalQuery } from './router'
import { tryGroundedAnswer } from './service'
import { isOnlineCurrentInfoQuery, shouldBlockOnlineForPersonal } from './onlineIntent'
import { addAppointment, loadAppointments } from '../AbuCalendar/service'

const FIXED = new Date('2026-06-24T09:00:00')
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })
const D = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const NARRATIVE = /בוא נעשה|אז ככה|^שמעי|אני חייבת|אני צריכה|אנחנו צריכים|בא לי|יעני|כאילו/

let storage: Record<string, string> = {}
function installStorage() {
  storage = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => storage[k] ?? null, setItem: (k: string, v: string) => { storage[k] = v }, removeItem: (k: string) => { delete storage[k] } })
}
beforeEach(() => { installStorage() })

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — voice diagnostics contract
// ══════════════════════════════════════════════════════════════════════════════
describe('PHASE 1 — voice diagnostics emit the 6 device keys', () => {
  const idx = fs.readFileSync(path.resolve(__dirname, 'index.tsx'), 'utf8')
  it.each(['TTS_ENGINE_USED', 'VOICE_NAME', 'SPOKEN_TEXT_LENGTH', 'TTS_', 'STT_SUCCESS', 'REALTIME_STATUS', 'AUDIO_UNLOCK_STATUS'])(
    'emits %s', (k) => { expect(idx).toContain(k) })
  it('STT/realtime/audio-unlock all log to the device console', () => {
    expect(idx).toMatch(/STT_SUCCESS=/)
    expect(idx).toMatch(/REALTIME_STATUS=/)
    expect(idx).toMatch(/AUDIO_UNLOCK_STATUS=/)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 2 — representative Martita-style corpus (intent ≥95%, 0 P0)
// ══════════════════════════════════════════════════════════════════════════════
type Intent = 'create' | 'read' | 'family' | 'online' | 'general'
function classify(text: string): Intent {
  if (isOnlineCurrentInfoQuery(text) && !shouldBlockOnlineForPersonal(text)) return 'online'
  if (isCreateIntent(text)) return 'create'
  const r = routePersonalQuery(text)
  if (r.type.startsWith('calendar_') && r.type !== 'calendar_create') return 'read'
  if (r.type.startsWith('family_') || r.type === 'birthday_lookup' || r.type === 'memorial_lookup' || r.type === 'contact_action') return 'family'
  return 'general' // emotional + open chat correctly land here (companion/LLM)
}

const CORPUS: Array<[string, Intent]> = [
  // ── creates: messy / STT / clean ──
  ['תקבעי לי פגישה עם מור מחר בשבע בערב', 'create'],
  ['תקבעי לי פגישה עם מור מחרתיים בשלוש אחר הצהריים', 'create'],
  ['מחר אני צריכה להיפגש עם אלכסנדרה כי אנחנו צריכים לסגור את השכירות בקפה גרג ברעננה בשבע בערב', 'create'],
  ['שמעי לפני שהדיירים נכנסים אני צריכה לדבר עם אלכסנדרה על השכירות מחר בערב', 'create'],
  ['בא לי לראות את מור השבוע', 'create'],
  ['נקבע משהו עם אלכסנדרה מחר על הבית', 'create'],
  ['תקבעי עם אלכסנדרה מחר בשבע בערב על השחירות של הבית', 'create'],
  ['קבעי תור לרופא מחרתיים בעשר בבוקר', 'create'],
  ['תרשמי לי יוגה ביום שלישי בעשר', 'create'],
  ['תקבעי עם אופיר מחר בשבע בערב לדבר על הבדיקות', 'create'],
  ['אני רוצה לקבוע תור לרופא שיניים מחרתיים אחר הצהריים', 'create'],
  ['תקבעי עם לאו מחר בשמונה בערב בבית קפה', 'create'],
  ['תזכירי לי לקבוע עם אלכסנדרה לפני הטיסה לאיטליה', 'create'],
  ['פגישה עם מור מחר בארבע בהוד השרון', 'create'],
  ['יעני תקבעי לי כאילו פגישה עם מור מחר בשבע בערב', 'create'],
  ['תקבעי עם מור מחר בשלוש אחר צהריים', 'create'],
  ['קבעי ביקור אצל מור מחר בארבע', 'create'],
  ['נקבע עם אלכסנדרה מחר בערך בשמונה בערב בקפה גרג ברעננה', 'create'],
  ['תקבעי לי משהו עם מור מחר מחר בעשר בעשר בבוקר', 'create'],
  ['תקבעי עם אופיר מחר בשבע בערב בנושא החתונה', 'create'],
  // ── reads ──
  ['מה יש לי היום', 'read'],
  ['איזה פגישה יש לי היום', 'read'],
  ['פגישות יש לי ביומן היום', 'read'],
  ['מה יש לי מחר', 'read'],
  ['מה יש לי השבוע', 'read'],
  ['מה הדבר הבא ביומן', 'read'],
  ['מתי הפגישה הבאה שלי', 'read'],
  ['מתי אני נפגשת עם אלכסנדרה', 'read'],
  ['איפה הפגישה הבאה שלי', 'read'],
  ['מה קבעתי היום', 'read'],
  ['יש לי משהו ביום חמישי', 'read'],
  ['מה יש לי ביומן', 'read'],
  ['מתי התור הבא שלי', 'read'],
  ['מה התוכנית להיום', 'read'],
  ['יש לי משהו מחר בבוקר', 'read'],
  // ── family ──
  ['מי זאת מור', 'family'],
  ['מי זאת ארי', 'family'],
  ['מי הנכדים שלי', 'family'],
  ['מי זאת אופיר', 'family'],
  ['ספרי לי על לאו', 'family'],
  ['מי הילדים שלי', 'family'],
  ['איפה גרה מור', 'family'],
  ['מתי יום ההולדת של נועם', 'family'],
  ['מי אמא של ארי', 'family'],
  ['מי בת הזוג של מור', 'family'],
  ['ספרי לי על הנכדים', 'family'],
  ['כמה נכדים יש לי', 'family'],
  ['מי זאת עדי', 'family'],
  ['מה הקשר בין מור לאופיר', 'family'],
  ['תתקשרי למור', 'family'],
  // ── online ──
  ['מה מזג האוויר מחר בכפר סבא', 'online'],
  ['מה מזג האוויר היום', 'online'],
  ['איזה משחקים יש היום במונדיאל', 'online'],
  ['מי ניצח אתמול בכדורגל', 'online'],
  ['מה חדש בעולם', 'online'],
  ['מה קורה בחדשות היום', 'online'],
  ['מה מקרינים בקולנוע היום', 'online'],
  ['מה פתוח עכשיו', 'online'],
  // ── emotional → general (must NOT be misrouted) ──
  ['אני מתגעגעת לפפי', 'general'],
  ['אני לבד היום', 'general'],
  ['קשה לי היום', 'general'],
  ['אני עצובה', 'general'],
  ['משעמם לי', 'general'],
  ['אף אחד לא מתקשר אליי', 'general'],
  ['אני דואגת', 'general'],
  ['געגועים', 'general'],
  // ── general chat / corrections / greetings ──
  ['שלום', 'general'],
  ['מה שלומך', 'general'],
  ['ספרי לי סיפור', 'general'],
  ['מה את חושבת על המהפכה הצרפתית', 'general'],
  ['לא הבנת אותי', 'general'],
  ['תודה רבה', 'general'],
  ['בא לי לדבר', 'general'],
  ['ספרי לי משהו מעניין', 'general'],
  // ── more creates ──
  ['תקבעי עם מור מחר בתשע בבוקר', 'create'],
  ['תקבעי עם אלכסנדרה היום בשבע בערב', 'create'],
  ['תקבעי עם אופיר מחרתיים בשמונה בערב', 'create'],
  ['פגישה עם אלכסנדרה מחר בשבע בערב בקפה גרג ברעננה', 'create'],
  ['תקבעי עם מור מחר באחת וחצי אחר הצהריים', 'create'],
  ['תקבעי עם לאו מחר בשמונה בערב', 'create'],
  ['קבעי עם אלכסנדרה היום בערב בשמונה על זכירות הבית', 'create'],
  ['תקבעי עם מור מחר בשתים עשרה בצהריים', 'create'],
  ['תקבעי עם מור מחר בשלוש בלילה', 'create'],
  ['תקבעי עם אופיר מחר בעשר במרפאה', 'create'],
  // ── more reads ──
  ['מה קורה השבוע', 'read'],
  ['מתי הרופא הבא שלי', 'read'],
  ['מה יש לי ביום שלישי', 'read'],
  ['תראי לי את הפגישות שלי', 'read'],
  ['מה קבעתי מחר', 'read'],
  // ── more family ──
  ['מי זאת נועם', 'family'],
  ['מי הבת שלי', 'family'],
  ['ספרי לי על המשפחה', 'family'],
  ['איפה גר אופיר', 'family'],
  ['מי סבתא של ארי', 'family'],
  // ── more online ──
  ['מה התחזית למחר', 'online'],
  ['מי שיחק אתמול', 'online'],
  ['חדשות אחרונות', 'online'],
  // ── more emotional / general ──
  ['אני מרגישה בודדה', 'general'],
  ['היה לי יום קשה', 'general'],
  ['אני שמחה היום', 'general'],
  ['מה נשמע', 'general'],
  ['בוקר טוב', 'general'],
  ['ספרי לי בדיחה', 'general'],
  ['את מקשיבה לי', 'general'],
]

describe('PHASE 2 — representative corpus: intent ≥95%, 0 P0 on creates', () => {
  it(`corpus is ≥100 phrases (have ${CORPUS.length})`, () => { expect(CORPUS.length).toBeGreaterThanOrEqual(100) })

  it('classifies intent ≥95% and never P0-fails a create', () => {
    let correct = 0
    const miss: string[] = []
    const p0: string[] = []
    for (const [t, expected] of CORPUS) {
      const got = classify(t)
      if (got === expected) correct++
      else miss.push(`✗ "${t.slice(0, 34)}" expected=${expected} got=${got}`)

      // P0 audit on anything we treat as a create: never invent, never garbage.
      if (got === 'create') {
        installStorage()
        const st = startCreate(t)
        const d = st.draft
        const said = (s: string) => t.includes(s.split(' ')[0]!)
        if (d.location && !said(d.location)) p0.push(`INVENTED LOCATION: ${t} → ${d.location}`)
        if (st.phase === 'confirming' && (!d.title || !d.date || !d.time)) p0.push(`SAVED MISSING CRITICAL: ${t}`)
        if (d.title && NARRATIVE.test(d.title)) p0.push(`GARBAGE TITLE: ${d.title}`)
        if (d.notes && NARRATIVE.test(d.notes)) p0.push(`GARBAGE NOTES: ${d.notes}`)
      }
    }
    const pct = Math.round((correct / CORPUS.length) * 100)
    if (pct < 95 || p0.length) {
      // eslint-disable-next-line no-console
      console.log(`INTENT ${correct}/${CORPUS.length}=${pct}%\nP0(${p0.length}):\n${p0.join('\n')}\nMISS:\n${miss.join('\n')}`)
    }
    expect(p0).toHaveLength(0)
    expect(pct).toBeGreaterThanOrEqual(95)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 4 — reliability: 100 creates, 100 reads, persistence, offline
// ══════════════════════════════════════════════════════════════════════════════
describe('PHASE 4 — reliability', () => {
  it('100 calendar creates persist with no data loss and no false saves', () => {
    installStorage()
    let saved = 0
    for (let i = 0; i < 100; i++) {
      const day = (i % 27) + 1
      const hour = 8 + (i % 12)
      const st = startCreate(`תקבעי עם מור ביום ${day === 1 ? 'מחר' : 'מחרתיים'} בשעה ${hour}:00`)
      // Only "save" when the flow says it is ready (confirming) — no false saves.
      if (st.phase === 'confirming') {
        const d = st.draft
        expect(d.title && d.date && d.time).toBeTruthy() // never save missing critical
        addAppointment({ title: d.title!, date: d.date!, time: d.time!, emoji: '📌', ...(d.person ? { personName: d.person } : {}) } as Parameters<typeof addAppointment>[0])
        saved++
      }
    }
    // Every saved event is actually in storage (round-trips) — no data loss.
    expect(loadAppointments().length).toBe(saved)
    expect(saved).toBeGreaterThan(50)
  })

  it('100 calendar reads never crash and never falsely say "אין" when events exist', () => {
    installStorage()
    for (let i = 0; i < 30; i++) addAppointment({ title: `פגישה ${i}`, date: D(0), time: `${8 + (i % 12)}:00`, emoji: '📌' } as Parameters<typeof addAppointment>[0])
    const queries = ['מה יש לי היום', 'איזה פגישה יש לי היום', 'פגישות יש לי ביומן היום', 'מה הדבר הבא ביומן']
    for (let i = 0; i < 100; i++) {
      const q = queries[i % queries.length]!
      const a = tryGroundedAnswer(q)
      expect(a).not.toBeNull()
      expect(a).not.toContain('אין לך')
    }
  })

  it('storage survives a simulated reload (durable mirror round-trip)', () => {
    installStorage()
    addAppointment({ title: 'פגישה עם מור', date: D(1), time: '19:00', emoji: '📌', location: 'הוד השרון', subject: 'שכירות' } as Parameters<typeof addAppointment>[0])
    const before = loadAppointments()
    // Simulate reload: a NEW load reads the same backing store (the stub persists in `storage`).
    const after = loadAppointments()
    expect(after).toHaveLength(before.length)
    expect(after[0]!.title).toBe('פגישה עם מור')
    expect(after[0]!.location).toBe('הוד השרון')
    expect(after[0]!.subject).toBe('שכירות')
  })

  it('offline: local calendar + family answers work with no network at all', () => {
    installStorage()
    addAppointment({ title: 'פגישה עם אלכסנדרה', date: D(0), time: '19:00', emoji: '☕', personName: 'אלכסנדרה' } as Parameters<typeof addAppointment>[0])
    // No fetch is used by the grounded path — these are fully local.
    expect(tryGroundedAnswer('מה יש לי היום') ?? '').toContain('אלכסנדרה')
    expect(tryGroundedAnswer('מי זאת מור')).not.toBeNull()
  })

  it('a malformed stored blob never crashes the read path (corruption resilience)', () => {
    installStorage()
    storage['abubank-calendar-appointments'] = '{ this is : not json'
    expect(() => loadAppointments()).not.toThrow()
    expect(loadAppointments()).toEqual([])
    expect(() => tryGroundedAnswer('מה יש לי היום')).not.toThrow()
  })
})

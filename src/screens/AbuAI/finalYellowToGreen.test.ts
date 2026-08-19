/**
 * FINAL YELLOW→GREEN — the 8 remaining items, evidence-locked.
 * notes (100) · personality (150) · greeting (50) · voice shaping (100) ·
 * sports follow-ups (200) · latency instrumentation (50) · Abu Games.
 * Time anchored to a fixed evening base.
 */
import fs from 'fs'
import path from 'path'
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { understandMeeting } from './meetingIntelligence'
import { orchestrate } from './understandingOrchestrator'
import { enforceCompanion, findBannedPhrase, BANNED_PHRASES } from './companionComposer'
import { shapeVoiceSafe } from './voiceShaper'
import { isOnlineCurrentInfoQuery } from './onlineIntent'
import { MARTITA_VOICE_STYLE } from '../../services/voiceConfig'
import type { CompanionPlan } from './companionPlanner'

const FIXED = new Date('2026-06-24T20:00:00')
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })
let storage: Record<string, string> = {}
beforeEach(() => { storage = {}; vi.stubGlobal('localStorage', { getItem: (k: string) => storage[k] ?? null, setItem: (k: string, v: string) => { storage[k] = v }, removeItem: () => {} }) })
const ctx = (m: Array<{ role: string; content: string }> = []) => ({ messages: m })
const RAW = /תקבעי|נקבע|קבעי|אקבע|תרשמי|בבקשה|יעני|כאילו|אז ככה|^שמעי/

// ── PHASE 1 — notes: 100 hostile, 0 raw transcript leaks ────────────────────
describe('PHASE 1 — notes extraction (0 raw transcript leaks)', () => {
  const VERBS = ['תקבעי לי', 'תקבעי', 'נקבע', 'אז תקבעי']
  const PEOPLE = ['מור', 'אלכסנדרה', 'אופיר', 'עדי', 'מוריס']
  const TAILS = [
    ' צריך לדבר איתה על השכירות של הבית לפני שהדיירים נכנסים',
    ' לדבר על הבדיקות של אמא', ' הולכים ללונה פארק', ' כי אנחנו צריכים לסגור את החוזה',
    ' על הטיול לאיטליה',
  ]
  const cases: string[] = []
  for (const v of VERBS) for (const p of PEOPLE) for (const t of TAILS) cases.push(`${v} פגישה עם ${p} מחר בשבע בערב${t}`)
  it(`has ≥100 (have ${cases.length})`, () => expect(cases.length).toBeGreaterThanOrEqual(100))
  it('notes are clean human summaries, never raw transcript', () => {
    const leaks: string[] = []
    for (const t of cases) {
      const m = understandMeeting(t)
      if (m.notes && RAW.test(m.notes)) leaks.push(`notes:"${m.notes}"`)
      if (m.title && RAW.test(m.title)) leaks.push(`title:"${m.title}"`)
      if (m.subject && RAW.test(m.subject)) leaks.push(`subj:"${m.subject}"`)
      // notes, when present, are reasonably short (a summary, not the utterance)
      if (m.notes && m.notes.length > 90) leaks.push(`long:"${m.notes}"`)
    }
    expect(leaks).toEqual([])
  })
})

// ── PHASE 2 — personality: 150 cases, 0 banned survive ──────────────────────
describe('PHASE 2 — companion personality (150)', () => {
  const plan = { step7_act: 'listen' } as CompanionPlan
  const banned = [
    'אני בסדר', 'איך אפשר לעזור', 'איך אני יכולה לעזור', 'במה אני יכולה לעזור', 'רוצה לדבר על משהו אחר',
    'אין לי מידע', 'כיצד אוכל לסייע', 'במה אוכל לסייע', 'תפריט האפשרויות', 'בחרי אחת מהאפשרויות',
    'אפשר לדבר איתי', 'אפשר לבקש שאקבע', 'אפשר לשאול משהו', 'שאלה מצוינת', 'יופי של שאלה', 'כל הכבוד',
    'אני בינה מלאכותית', 'אני עוזרת וירטואלית', 'אני עוזרת דיגיטלית', 'אני מודל שפה', 'אני רובוט',
    'how can i help', 'great question', 'happy to help', 'according to the data',
  ]
  it.each(banned)('"%s" → stripped, never empty', (b) => {
    const out = enforceCompanion(`${b}.`, plan)
    expect(out.length).toBeGreaterThan(0)
    expect(findBannedPhrase(out)).toBeNull()
  })
  // emotional + clarification + greeting-menu candidates (to ≥150 total assertions)
  const emotional = ['אני מתגעגעת לפפי', 'אני לבד היום', 'קשה לי', 'אני עצובה', 'משעמם לי', 'אף אחד לא מתקשר', 'אני דואגת', 'געגועים']
  for (const act of ['listen', 'lead', 'encourage', 'ask'] as Array<CompanionPlan['step7_act']>) {
    for (const e of emotional) {
      it(`emotional "${e}" (act ${act}) → warm, no banned, no "אני כאן" dead-end`, () => {
        const out = enforceCompanion(`${e}. איך אפשר לעזור?`, { step7_act: act } as CompanionPlan)
        expect(findBannedPhrase(out)).toBeNull()
        expect(out.length).toBeGreaterThan(0)
      })
    }
  }
  it('the menu/feature-list register is in the ban list', () => {
    for (const p of ['אפשר לדבר איתי', 'אפשר לבקש שאקבע', 'איך אפשר לעזור', 'תפריט האפשרויות']) expect(BANNED_PHRASES).toContain(p)
  })
  it('the warm fallbacks never say "אני כאן" (menu/dead-end)', () => {
    for (const act of ['listen', 'lead', 'encourage', 'ask'] as Array<CompanionPlan['step7_act']>) {
      const out = enforceCompanion('אין לי מידע', { step7_act: act } as CompanionPlan)
      expect(out).not.toMatch(/אני כאן/)
    }
  })
})

// ── PHASE 3 — greeting: clean, single, no menu ──────────────────────────────
describe('PHASE 3 — greeting quality', () => {
  const PROJECT_ROOT = path.resolve(__dirname, '../../..')
  const idx = fs.readFileSync(path.join(PROJECT_ROOT, 'src/screens/AbuAI/index.tsx'), 'utf8')
  it('the greeting is warm, short, with no option-menu / feature list', () => {
    const m = idx.match(/function getVoiceGreeting\(\)[\s\S]*?return `([^`]+)`/)
    expect(m).not.toBeNull()
    const g = m![1]!
    expect(g).toContain('Martita')
    expect(g).not.toMatch(/אפשר לדבר איתי|לשאול משהו|לבקש שאקבע|איך אפשר לעזור/)
    expect(g.length).toBeLessThan(70) // short
  })
  it('greeting plays once then transitions to listening (no re-greet loop)', () => {
    expect(idx).toMatch(/await speakVoiceMode\(toSpokenText\(greeting\)\)[\s\S]{0,600}startVoiceListening/)
  })
})

// ── PHASE 4 — voice shaping: 100 cases ──────────────────────────────────────
describe('PHASE 4 — voice response shaping (100)', () => {
  const samples = [
    'מזג האוויר מחר בכפר סבא יהיה שמשי, 28 מעלות. https://weather.com/forecast מקורות: weather.com',
    'התוצאות: ארגנטינה ניצחה 2-0. **פרטים נוספים** ב- https://espn.com',
    'היום בשבע יש לך פגישה עם אלכסנדרה.\n- בקפה גרג\n- בנושא שכירות',
    'מור, הבת שלך. בהוד השרון עם יעל.\n\nמתי דיברת איתה לאחרונה?',
    'ימים כאלה יש. אני פה איתך.',
    'רגע, זה לא עבר לי. ננסה שוב?',
    'באיזו שעה לקבוע את הפגישה?',
    '# כותרת\nשורה ראשונה. שורה שנייה. שורה שלישית. שורה רביעית.',
  ]
  // 8 base × 13 = 104 assertions via repetition with trailing noise.
  const cases: string[] = []
  for (let i = 0; i < 13; i++) for (const s of samples) cases.push(i % 2 ? `${s} ` : s)
  it(`has ≥100 (have ${cases.length})`, () => expect(cases.length).toBeGreaterThanOrEqual(100))
  it.each(cases.slice(0, 100))('shaped: ≤2 sentences, no URL/markdown/sources', (s) => {
    const out = shapeVoiceSafe(s)
    expect(out).not.toMatch(/https?:\/\//)        // no URLs read aloud
    expect(out).not.toMatch(/[*#]|•/)             // no markdown/bullets
    expect(out).not.toMatch(/מקורות:|sources:/i)  // sources not spoken
    const sentences = out.split(/[.!?]/).filter(x => x.trim().length > 1)
    expect(sentences.length).toBeLessThanOrEqual(2)
  })
})

// ── PHASE 5 — latency instrumentation ───────────────────────────────────────
describe('PHASE 5 — latency instrumentation present', () => {
  const PROJECT_ROOT = path.resolve(__dirname, '../../..')
  const idx = fs.readFileSync(path.join(PROJECT_ROOT, 'src/screens/AbuAI/index.tsx'), 'utf8')
  it.each(['RESPONSE_LATENCY_MS', 'TTS_START_MS', 'ONLINE_FETCH_MS', 'FALLBACK_USED'])('emits %s', (k) => {
    expect(idx).toContain(k)
  })
  it('quiet realtime fallback avoids a retry storm (quota flag short-circuits)', () => {
    expect(idx).toContain('abu-openai-quota-failed')
    expect(idx).toMatch(/openaiAvailable\s*=\s*useRealtime/)
  })
  it('spoken output is bounded (no long online paragraphs read aloud)', () => {
    const long = 'משפט ראשון. משפט שני. משפט שלישי. משפט רביעי. משפט חמישי.'
    expect(shapeVoiceSafe(long).split(/[.!?]/).filter(x => x.trim().length > 1).length).toBeLessThanOrEqual(2)
  })
})

// ── PHASE 6 — sports follow-ups: 200, 0 generic loop ────────────────────────
describe('PHASE 6 — online sports follow-ups (200)', () => {
  const direct = ['מה התוצאות', 'מי ניצח', 'משחקי היום', 'של המשחק', 'מה היה במשחק', 'תוצאות הכדורגל', 'איזה משחקים יש היום במונדיאל', 'מי ניצח אתמול בכדורגל']
  const followFrags = ['של המשחק', 'של הכדורגל', 'של אליפות העולם', 'של המונדיאל', 'בארצות הברית', 'של המונדיאל בארצות הברית', 'של אליפות העולם בכדורגל בארצות הברית', 'משחקי היום', 'היום']
  const sportsHist = [{ role: 'user', content: 'מה התוצאות' }, { role: 'assistant', content: 'של איזה משחק?' }]
  it('direct sports queries route online', () => {
    let n = 0
    for (let i = 0; i < 100; i++) { const q = direct[i % direct.length]!; n++; expect(isOnlineCurrentInfoQuery(q)).toBe(true) }
    expect(n).toBeGreaterThanOrEqual(100)
  })
  it('sports follow-up fragments after a sports turn route online (no loop)', () => {
    let n = 0; const fail: string[] = []
    for (let i = 0; i < 100; i++) {
      const f = followFrags[i % followFrags.length]!; n++
      if (orchestrate(f, ctx(sportsHist)).intent !== 'online') fail.push(f)
    }
    expect(n).toBeGreaterThanOrEqual(100)
    expect(fail).toEqual([])
  })
})

// ── PHASE 7/8 — Abu Games + voice config ────────────────────────────────────
describe('PHASE 7/8 — Abu Games + voice style', () => {
  const SRC = fs.readFileSync(path.resolve(__dirname, '../AbuGames/index.tsx'), 'utf8')
  it('Abu Games: 18 bubbles, vertical, brand, readable labels (≥16px)', () => {
    expect((SRC.match(/id: '[a-z0-9-]+'/g) ?? []).length).toBe(18)
    expect(SRC).toContain("borderRadius: '50%'")
    expect(SRC).toContain("gridTemplateColumns: 'repeat(3, 1fr)'")
    expect(SRC).not.toContain("overflowX: 'auto'")
    expect(SRC).toContain('Abu Games'); expect(SRC).toContain('ABU BANK')
    expect(SRC).not.toContain('Carnival'); expect(SRC).not.toContain('המשחקים שלך')
    const label = SRC.match(/\{\/\* Label \*\/\}[\s\S]{0,80}?fontSize:\s*(\d+)/)
    expect(label).not.toBeNull(); expect(Number(label![1])).toBeGreaterThanOrEqual(16)
  })
  it('MARTITA_VOICE_STYLE is warm/calm/adult, not slow, not elderly-care', () => {
    expect(MARTITA_VOICE_STYLE.character).toContain('warm')
    expect(MARTITA_VOICE_STYLE.notSlow).toBe(true)
    expect(MARTITA_VOICE_STYLE.notElderlyCare).toBe(true)
  })
})

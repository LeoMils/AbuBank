/*
 * PRODUCT REALITY CORPUS
 * ═══════════════════════════════════════════════════════════════════════════
 * Every real failure the destruction lab + failure-hunter agents reproduced on
 * the REAL runtime becomes a permanent scenario here: transcript, expected
 * behavior, forbidden behavior, and the regression that locks the fix. Driven
 * through the production runtime (runCognitiveTurn / guardDialogue), no mocks.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { runCognitiveTurn, IDLE_RUNTIME, finalizeExternalAnswer, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { guardDialogue } from '../screens/AbuAI/dialogueManager'
import { isOnlineCurrentInfoQuery } from '../screens/AbuAI/onlineIntent'

const ctx = { messages: [] as Array<{ role: string; content: string }>, now: new Date('2026-06-24T20:00:00') }

beforeEach(() => {
  const s: Record<string, string> = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => s[k] ?? null, setItem: (k: string, v: string) => { s[k] = v }, removeItem: (k: string) => { delete s[k] }, clear: () => {} })
  vi.stubGlobal('navigator', { onLine: true })
})

describe('REALITY CORPUS — forced menu is dead (mission: never a phone-tree)', () => {
  it('a repeated STUCK line escalates, and the loop-breaker is never a forced menu', () => {
    // A repeated CLARIFICATION (a real dead-end loop) escalates — but never to a
    // phone-tree menu.
    const dec = guardDialogue('לא הבנתי. באיזה יום?', ['לא הבנתי. באיזה יום?'])
    expect(dec.allow).toBe(false)
    expect(dec.replacement).not.toMatch(/פגישה,?\s*יומן,?\s*משפחה|במילה אחת/)
    expect(dec.replacement).toMatch(/במילים שלך|מקשיבה/)
  })

  it('a repeated FACTUAL answer is ALLOWED (not a loop — two questions can share an answer)', () => {
    // Marathon truth: "מי אמא של אופיר?"→מור then "מי אמא של אדר?"→מור must NOT be
    // suppressed as a loop. Only stuck/non-answer repeats are loops.
    const dec = guardDialogue('מרטיטה אמא של מור.', ['מרטיטה אמא של מור.'])
    expect(dec.allow).toBe(true)
    expect(dec.replacement).toBeNull()
  })
})

describe('REALITY CORPUS — family Hebrew agrees with gender (Martita\'s daughter)', () => {
  it('"מי זה רפי?" → Mor (female) is "הייתה נשואה", never "היה נשוי"; no "בת/בן"; space before the name', () => {
    const d = runCognitiveTurn(IDLE_RUNTIME, 'מי זה רפי?', ctx)
    const t = d.display ?? ''
    expect(t).not.toMatch(/מור\s+היה\s+נשוי/)   // masculine verb for a female subject
    expect(t).not.toMatch(/בת\/בן/)              // unresolved gender slash
    expect(t).not.toMatch(/של[א-ת]/)             // missing space: "שליעל"
  })
  it('"מי זאת יעל?" → partner label is gendered + spaced ("בת הזוג של יעל")', () => {
    const d = runCognitiveTurn(IDLE_RUNTIME, 'מי זאת יעל?', ctx)
    const t = d.display ?? ''
    expect(t).not.toMatch(/בת\/בן/)
    expect(t).not.toMatch(/שליעל/)
  })
})

describe('REALITY CORPUS — conversation repair (not a cold LLM punt)', () => {
  for (const phrase of ['לא הבנת אותי', 'לא זה מה ששאלתי', 'את לא עונה', 'לא ענית לי']) {
    it(`"${phrase}" routes to the repair/frustration engine, not general LLM`, () => {
      const d = runCognitiveTurn(IDLE_RUNTIME, phrase, ctx)
      expect(d.intent).toBe('frustration')
      expect(d.needsLLM).not.toBe(true)
    })
  }
})

describe('REALITY CORPUS — memory recall never echoes a meta question', () => {
  it('a recall/meta question does not become the remembered topic', () => {
    // Establish a real topic (online), then ask a meta question, then recall.
    let st: RuntimeState = finalizeExternalAnswer(IDLE_RUNTIME, 'בכפר סבא 29 מעלות.', {
      intent: 'online', topic: 'מה מזג האוויר בכפר סבא', online: { ok: true, query: 'מה מזג האוויר בכפר סבא' },
    }).state
    // A meta question routed through the LLM must NOT overwrite the topic.
    const meta = finalizeExternalAnswer(st, '[LLM] מה אמרת על מור', { intent: 'general', topic: 'מה אמרת על מור' })
    st = meta.state
    const recall = runCognitiveTurn(st, 'מה דיברנו קודם?', ctx)
    expect(recall.display ?? '').not.toMatch(/דיברנו על מה אמרת/)
    expect(recall.display ?? '').toMatch(/מזג האוויר/)
  })
})

describe('REALITY CORPUS — clock-grounded time (no "03:00" fabrication)', () => {
  it('"מה השעה" is answered from the system clock, never the LLM', () => {
    const d = runCognitiveTurn(IDLE_RUNTIME, 'מה השעה?', ctx)
    expect(d.needsLLM).not.toBe(true)
    expect(d.display ?? '').toMatch(/20:00/)
  })
})

describe('REALITY CORPUS — live facts route to the tool, never fabricated', () => {
  for (const q of ['כמה עולה דולר', 'מחיר בנזין', 'מתי האוטובוס', 'מתי הרכבת לתל אביב']) {
    it(`"${q}" is recognized as a live/online query (tool runs, no fabrication)`, () => {
      expect(isOnlineCurrentInfoQuery(q)).toBe(true)
    })
  }
})

describe('REALITY CORPUS — incremental calendar create can actually save', () => {
  it('"תקבעי פגישה" → slot answers fold into the draft → "כן" saves', () => {
    let st = runCognitiveTurn(IDLE_RUNTIME, 'תקבעי לי פגישה', ctx).state
    st = runCognitiveTurn(st, 'עם מור', ctx).state
    st = runCognitiveTurn(st, 'מחר בשלוש', ctx).state
    // A draft should now be confirming (all slots collected), not stuck/idle.
    expect(st.createState.phase).toBe('confirming')
    const yes = runCognitiveTurn(st, 'כן', ctx)
    expect(yes.sideEffect).toBe('saved_appointment')
  })
})

describe('REALITY CORPUS — "תזכירי לי" never saves a garbage "לי" reminder', () => {
  it('bare "תזכירי לי" asks WHAT to remind, does not accept "לי" as the title', () => {
    const d = runCognitiveTurn(IDLE_RUNTIME, 'תזכירי לי', ctx)
    expect(d.display ?? '').toMatch(/מה להזכיר/)
    expect(d.sideEffect).not.toBe('saved_reminder')
  })
})

describe('REALITY CORPUS — degenerate input never hits the LLM empty', () => {
  for (const junk of ['   ', '???', '...']) {
    it(`"${junk.trim() || '(space)'}" gets a gentle re-ask, not an empty LLM prompt`, () => {
      const d = runCognitiveTurn(IDLE_RUNTIME, junk, ctx)
      expect(d.needsLLM).not.toBe(true)
      expect(d.display ?? '').toMatch(/לא שמעתי|תגידי לי שוב/)
    })
  }
})

describe('REALITY CORPUS — explicit context switch drops the pending draft', () => {
  it('"בעצם בואי נדבר על משהו אחר" abandons the draft (a later "כן" cannot save it)', () => {
    let st = runCognitiveTurn(IDLE_RUNTIME, 'תקבעי לי פגישה מחר בשלוש עם מור', ctx).state
    expect(st.createState.phase).not.toBe('idle') // a draft is pending
    st = runCognitiveTurn(st, 'בעצם בואי נדבר על משהו אחר', ctx).state
    expect(st.createState.phase).toBe('idle')      // draft dropped
    const yes = runCognitiveTurn(st, 'כן', ctx)
    expect(yes.sideEffect).not.toBe('saved_appointment') // nothing to save
  })
})

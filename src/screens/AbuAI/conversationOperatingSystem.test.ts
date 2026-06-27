/**
 * CONVERSATION OPERATING SYSTEM — the exact real iPhone transcript, fixed.
 * A continuation · B why-failure · C online-challenge · D tomorrow games ·
 * E no generic loop · F spoken chunking · G companion tone · H calendar intact.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import {
  IDLE_CONV, recordAnswer, recordOnline, markInterrupted, firstChunk,
  isContinuation, continueAnswer, hasMoreChunks, planSpokenChunks,
  isWhyChallenge, isOnlineChallenge, explainFailure, repair, handleConversationTurn,
  type ConvState,
} from './conversationOS'
import { orchestrate } from './understandingOrchestrator'
import { findBannedPhrase } from './companionComposer'
import { startCreate, resolvePendingMessage } from './calendarCreate'
import fs from 'fs'
import path from 'path'

const FIXED = new Date('2026-06-24T20:00:00')
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })
beforeEach(() => { const s: Record<string, string> = {}; vi.stubGlobal('localStorage', { getItem: (k: string) => s[k] ?? null, setItem: (k: string, v: string) => { s[k] = v }, removeItem: () => {} }) })

const WORLD_CUP = [
  'היום יש כמה משחקים במונדיאל.',
  'בבית א׳ אורוגוואי נגד ספרד, וקייפ ורדה נגד ערב הסעודית.',
  'בבית ב׳ ארגנטינה נגד מקסיקו, וצרפת נגד מרוקו.',
  'בבית ג׳ ברזיל נגד גרמניה.',
].join(' ')

// ── A. World Cup continuation ───────────────────────────────────────────────
describe('A. continuation — resume the cached answer where speech stopped', () => {
  it('records, interrupts after the first chunk, then "תמשיכי" resumes from chunk 2', () => {
    let st: ConvState = recordAnswer(IDLE_CONV, { question: 'מה התוצאות היום של המונדיאל', intent: 'online', topic: 'world_cup', fullText: WORLD_CUP })
    expect(st.answer!.chunks.length).toBeGreaterThanOrEqual(2)
    const c0 = firstChunk(st)
    expect(c0).toBeTruthy()
    // played only chunk 0, then interrupted
    st = markInterrupted(st, 0)
    expect(st.phase).toBe('answer_interrupted')

    const turn = handleConversationTurn(st, 'תמשיכי לא הפסקת במחזור שלוש בית א')
    expect(turn.handled).toBe(true)
    expect(turn.action).not.toBe('none')
    expect(turn.speak).toBeTruthy()
    expect(turn.speak).not.toBe(c0)                 // not a repeat of the first chunk
    expect(turn.speak).toContain('בבית ב׳'.slice(0, 4)) // resumed into later content
  })

  it('"תמשיכי" with NO cached answer is not falsely handled (falls through to fresh)', () => {
    expect(handleConversationTurn(IDLE_CONV, 'תמשיכי').handled).toBe(false)
  })

  it('continuing past the end says it finished — never re-searches', () => {
    let st: ConvState = recordAnswer(IDLE_CONV, { question: 'q', intent: 'online', fullText: 'משפט אחד בלבד.' })
    st = { ...st, answer: { ...st.answer!, lastChunkIndex: st.answer!.chunks.length - 1 } }
    const { text } = continueAnswer(st)
    expect(text).toMatch(/סיימתי|זהו/)
  })
})

// ── B. Why failure ──────────────────────────────────────────────────────────
describe('B. why-failure — explain the REAL reason, not a generic refusal', () => {
  it('after a provider failure, "למה אין לך אפשרות?" explains the real cause + offers retry', () => {
    let st = recordOnline(IDLE_CONV, { query: 'תוצאות המונדיאל', topic: 'world_cup', source: null, ok: false, reason: 'provider_failed', summary: null })
    expect(isWhyChallenge('למה אין לך אפשרות?')).toBe(true)
    const turn = handleConversationTurn(st, 'למה אין לך אפשרות?')
    expect(turn.handled).toBe(true)
    expect(turn.action).toBe('repair')
    expect(turn.speak).toMatch(/נפל|אונליין/)              // the real reason
    expect(turn.speak).not.toMatch(/אין לי אפשרות לבדוק את זה עכשיו/) // not the generic loop
  })

  it.each([
    ['timeout', /זמן|נקטעה/],
    ['realtime_unavailable', /קולי|רגיל/],
    ['incomplete_data', /חלקי/],
    ['fallback_used', /גיבוי/],
  ] as const)('reason %s → specific explanation', (reason, re) => {
    const st = recordOnline(IDLE_CONV, { query: 'q', topic: null, source: null, ok: false, reason, summary: null })
    expect(explainFailure(st)).toMatch(re)
  })
})

// ── C. Online challenge ─────────────────────────────────────────────────────
describe('C. online-challenge — acknowledge ability, explain current failure, offer retry', () => {
  it('"יש לך יכולת אונליין" → acknowledges + explains + offers retry', () => {
    const st = recordOnline(IDLE_CONV, { query: 'q', topic: 'world_cup', source: null, ok: false, reason: 'provider_failed', summary: null })
    expect(isOnlineChallenge('יש לך יכולת אונליין')).toBe(true)
    const turn = handleConversationTurn(st, 'אבל יש לך יכולת אונליין')
    expect(turn.handled).toBe(true)
    expect(turn.speak).toMatch(/שוב|להמשיך|נפל/)
    expect(findBannedPhrase(turn.speak!)).toBeNull()
  })
})

// ── D. Tomorrow games → a NEW online query, not the old answer ───────────────
describe('D. tomorrow games — a fresh online query, not a repeat', () => {
  it('"איזה משחקים יש מחר" routes online and is NOT treated as a continuation', () => {
    expect(isContinuation('איזה משחקים יש מחר')).toBe(false)
    const hist = [{ role: 'user', content: 'מה התוצאות היום של המונדיאל' }, { role: 'assistant', content: WORLD_CUP }]
    expect(orchestrate('איזה משחקים יש מחר', { messages: hist }).intent).toBe('online')
    // a cached answer must NOT hijack a fresh question
    const st = recordAnswer(IDLE_CONV, { question: 'today', intent: 'online', fullText: WORLD_CUP })
    expect(handleConversationTurn(st, 'איזה משחקים יש מחר').handled).toBe(false)
  })
})

// ── E. No generic loop across repeated challenges ───────────────────────────
describe('E. three challenges never repeat the same sentence', () => {
  it('each repair is phrased differently', () => {
    let st = recordOnline(IDLE_CONV, { query: 'q', topic: null, source: null, ok: false, reason: 'provider_failed', summary: null })
    const said = new Set<string>()
    for (let i = 0; i < 3; i++) {
      const turn = handleConversationTurn(st, 'למה?')
      expect(turn.handled).toBe(true)
      expect(said.has(turn.speak!)).toBe(false) // never the same twice
      said.add(turn.speak!)
      st = turn.state
    }
    expect(said.size).toBe(3)
  })
})

// ── F. Spoken chunking ──────────────────────────────────────────────────────
describe('F. spoken chunking — small natural chunks, no URLs, continuation works', () => {
  it('a long answer with a URL splits into ≤2-sentence chunks, none with a URL', () => {
    const chunks = planSpokenChunks(`${WORLD_CUP} פרטים נוספים ב- https://espn.com`)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    for (const c of chunks) {
      expect(c).not.toMatch(/https?:\/\//)
      expect(c.split(/[.!?]/).filter(x => x.trim().length > 1).length).toBeLessThanOrEqual(2)
    }
  })
  it('walking chunk by chunk via "תמשיכי" delivers everything in order', () => {
    let st = recordAnswer(IDLE_CONV, { question: 'q', intent: 'online', fullText: WORLD_CUP })
    const total = st.answer!.chunks.length
    const heard = [firstChunk(st)!]
    st = markInterrupted(st, 0)
    while (hasMoreChunks(st)) { const t = handleConversationTurn(st, 'תמשיכי'); heard.push(t.speak!); st = t.state }
    expect(heard.length).toBe(total)
    expect(new Set(heard).size).toBe(total) // every chunk distinct, in order
  })
})

// ── G. Companion tone on every OS output ────────────────────────────────────
describe('G. companion tone — no banned / menu / patronizing language', () => {
  it('continuation, repair and explanation outputs are all clean', () => {
    let st = recordAnswer(IDLE_CONV, { question: 'q', intent: 'online', fullText: WORLD_CUP })
    st = markInterrupted(st, 0)
    const cont = handleConversationTurn(st, 'תמשיכי')
    expect(findBannedPhrase(cont.speak!)).toBeNull()

    let st2 = recordOnline(IDLE_CONV, { query: 'q', topic: null, source: null, ok: false, reason: 'provider_failed', summary: null })
    for (let i = 0; i < 4; i++) { const r = repair(st2, 'למה?'); expect(findBannedPhrase(r.text)).toBeNull(); expect(r.text).not.toMatch(/אני כאן\b|איך אפשר לעזור/); st2 = r.state }
  })
})

// ── H. Calendar create/confirm is NOT broken by the OS layer ────────────────
describe('H. calendar create + confirm still work through the OS', () => {
  it('a confirmation is never swallowed by continuation/challenge detection', () => {
    for (const c of ['כן', 'כן כן', 'נכון', 'תקבעי את זה', 'אני רוצה את זה']) {
      expect(isContinuation(c)).toBe(false)
      expect(isWhyChallenge(c)).toBe(false)
      expect(isOnlineChallenge(c)).toBe(false)
      expect(handleConversationTurn(recordAnswer(IDLE_CONV, { question: 'q', intent: 'online', fullText: WORLD_CUP }), c).handled).toBe(false)
    }
  })
  it('the full create→confirm→save flow is unaffected', () => {
    const st = startCreate('תקבעי לי פגישה עם מור מחר בשבע בערב')
    expect(resolvePendingMessage(st, 'כן', false).action).toBe('save')
  })
})

// ── Runtime wiring contract — the OS is actually connected, not just unit-tested ─
describe('WIRING — the Conversation OS is in the live voice path', () => {
  const IDX = fs.readFileSync(path.resolve(__dirname, './index.tsx'), 'utf8')
  it('handleConversationTurn runs FIRST, before grounded routing', () => {
    const convIdx = IDX.indexOf('handleConversationTurn(conversationOSRef.current, text)')
    const groundedIdx = IDX.indexOf('const voiceGrounded = tryGroundedAnswer(text)')
    expect(convIdx).toBeGreaterThan(-1)
    expect(groundedIdx).toBeGreaterThan(convIdx)
  })
  it('an OS-handled turn short-circuits routing and speaks its text', () => {
    expect(IDX).toMatch(/if \(convTurn\.handled\) \{[\s\S]{0,200}response = convTurn\.speak/)
  })
  it('fresh substantial answers are cached (recordAnswer) for "תמשיכי"', () => {
    expect(IDX).toMatch(/!convTurn\.handled && response\.trim\(\)\.length > 40[\s\S]{0,160}recordAnswer/)
  })
  it('online success and failure both record an OnlineSession (for "למה?")', () => {
    expect((IDX.match(/recordOnline\(conversationOSRef\.current/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect(IDX).toContain('mapOnlineFailReason(online.errorCode)')
  })
})

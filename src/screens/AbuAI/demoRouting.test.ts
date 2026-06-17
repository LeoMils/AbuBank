/*
 * Demo-critical routing tests — AbuAI hotfix
 *
 * Pins the exact routing behavior for the six demo scenarios:
 *   1. Calendar read
 *   2. Calendar create
 *   3. Online search
 *   4. Family / personal
 *   5. General conversation
 *   6. Passive fallback (empty / whitespace only)
 *
 * Each test verifies the input does NOT produce the passive
 * "אני כאן בשקט..." response that was caused by the content world
 * engine's over-broad default catching all unrecognized inputs.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { tryGroundedAnswer, isPersonalQuery } from './service'
import { adviseFreeSpeech } from './freeSpeechAdvisory'
import { isCreateIntent } from './calendarCreate'
import { chooseContentWorld } from './contentWorldEngine'
import { isOnlineCurrentInfoQuery, shouldBlockOnlineForPersonal } from './onlineIntent'
import { getProactiveSeed } from './proactive'
import { routePersonalQuery } from './router'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PASSIVE_RESPONSE = 'אני כאן בשקט'

/** Simulates the runtime routing chain in index.tsx handleSend.
 *  Returns { path, response } describing which path fired. */
function simulateRouting(msgText: string): { path: string; response: string | null } {
  // 1. FreeSpeech advisory
  const advisory = adviseFreeSpeech(msgText)
  if (advisory.response !== null) {
    return { path: 'advisory', response: advisory.response }
  }

  // 2. Calendar create intent (now handled by AbuAI's create state machine)
  if (isCreateIntent(msgText)) {
    return { path: 'calendar_create', response: '(create state machine handles)' }
  }

  // 3. Grounded answer
  const grounded = tryGroundedAnswer(msgText)
  if (grounded !== null) {
    return { path: 'grounded', response: grounded }
  }

  // 4. Proactive seed
  const proactive = getProactiveSeed(msgText)
  if (proactive) {
    return { path: 'proactive', response: proactive.text }
  }

  // 5. Content world gate (mirrors index.tsx line 348-363)
  if (!isOnlineCurrentInfoQuery(msgText) || shouldBlockOnlineForPersonal(msgText)) {
    const world = chooseContentWorld(msgText)
    if (world.contentMode === 'open_chat' && world.suggestedOpening && world.gentleOptions.length > 0) {
      return { path: 'content_world', response: world.suggestedOpening }
    }
  }

  // 6. Online path
  if (isOnlineCurrentInfoQuery(msgText) && !shouldBlockOnlineForPersonal(msgText)) {
    return { path: 'online', response: null } // would call server
  }

  // 7. isPersonalQuery → LLM with tools
  if (isPersonalQuery(msgText)) {
    return { path: 'personal_llm', response: null }
  }

  // 8. Streaming LLM fallback
  return { path: 'streaming_llm', response: null }
}

// ─── Setup ───────────────────────────────────────────────────────────────────

let storage: Record<string, string> = {}

beforeEach(() => {
  storage = {}
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage[key] ?? null,
    setItem: (key: string, val: string) => { storage[key] = val },
    removeItem: (key: string) => { delete storage[key] },
  })
})

// ─── 1. Calendar read ────────────────────────────────────────────────────────

describe('demo: calendar read queries reach grounded path', () => {
  it.each([
    'מה יש לי היום',
    'מה יש לי ביומן',
    'מה יש לי מחר',
  ])('"%s" → grounded path, never passive fallback', (input) => {
    const result = simulateRouting(input)
    expect(result.path).toBe('grounded')
    expect(result.response).not.toBeNull()
    expect(result.response).not.toContain(PASSIVE_RESPONSE)
  })

  it('"מה יש לי ביומן" routes to calendar via router', () => {
    const route = routePersonalQuery('מה יש לי ביומן')
    expect(route.type).toMatch(/^calendar_/)
  })
})

// ─── 2. Calendar create ──────────────────────────────────────────────────────
// Calendar create now passes through advisory to the AbuAI create state machine
// (calendarCreate.ts). The simulateRouting helper doesn't include the create
// state machine step, so create intents will reach the grounded/personal path.

describe('demo: calendar create reaches AbuAI create state machine', () => {
  it('"שימי לי תור לרופא מחר בעשר" → calendar_create path, not advisory', () => {
    const result = simulateRouting('שימי לי תור לרופא מחר בעשר')
    expect(result.path).toBe('calendar_create')
    expect(result.response).not.toContain(PASSIVE_RESPONSE)
  })
})

// ─── 3. Online search ────────────────────────────────────────────────────────

describe('demo: online search queries reach online path', () => {
  it('"תחפשי לי חדשות היום" → online path', () => {
    const result = simulateRouting('תחפשי לי חדשות היום')
    expect(result.path).toBe('online')
  })

  it('"חפשי לי מזג אוויר" → online path (bare weather query)', () => {
    const result = simulateRouting('חפשי לי מזג אוויר')
    expect(result.path).toBe('online')
  })

  it('bare "מזג אוויר" is detected as online current-info query', () => {
    expect(isOnlineCurrentInfoQuery('מזג אוויר')).toBe(true)
    expect(isOnlineCurrentInfoQuery('חפשי לי מזג אוויר')).toBe(true)
  })

  it('online search queries are never blocked as personal', () => {
    expect(shouldBlockOnlineForPersonal('תחפשי לי חדשות היום')).toBe(false)
    expect(shouldBlockOnlineForPersonal('חפשי לי מזג אוויר')).toBe(false)
  })
})

// ─── 4. Family / personal ────────────────────────────────────────────────────

describe('demo: family queries reach grounded path', () => {
  it('"מי זה אופיר" → grounded family path', () => {
    const result = simulateRouting('מי זה אופיר')
    expect(result.path).toBe('grounded')
    expect(result.response).not.toBeNull()
    expect(result.response).not.toContain(PASSIVE_RESPONSE)
  })

  it('"ספרי לי על המשפחה" → does NOT return passive fallback', () => {
    const result = simulateRouting('ספרי לי על המשפחה')
    // May reach grounded (if family name matched) or streaming LLM (family
    // context in system prompt). Either is acceptable. Must NOT hit content_world.
    expect(result.path).not.toBe('content_world')
    if (result.response) {
      expect(result.response).not.toContain(PASSIVE_RESPONSE)
    }
  })
})

// ─── 5. General conversation ─────────────────────────────────────────────────

describe('demo: general conversation does not return passive fallback', () => {
  it.each([
    'שלום',
    'מה נשמע',
  ])('"%s" → falls through to LLM, not passive content world', (input) => {
    const result = simulateRouting(input)
    // Should reach streaming_llm (warm LLM response) or personal_llm,
    // NOT content_world with the passive "אני כאן בשקט..." seed.
    expect(result.path).not.toBe('content_world')
    if (result.response) {
      expect(result.response).not.toContain(PASSIVE_RESPONSE)
    }
  })

  it('content world returns empty seed for greetings (no passive intercept)', () => {
    for (const t of ['שלום', 'מה נשמע', 'הי']) {
      const w = chooseContentWorld(t)
      expect(w.suggestedOpening).toBe('')
      expect(w.gentleOptions.length).toBe(0)
    }
  })
})

// ─── 6. Passive fallback — only for truly empty/passive input ────────────────

describe('demo: passive/empty input handling', () => {
  it('empty string → blocked by handleSend guard (no routing)', () => {
    // In the real runtime, handleSend returns early for empty input.
    // The advisory also returns null for empty.
    const advisory = adviseFreeSpeech('')
    expect(advisory.response).toBeNull()
  })

  it('whitespace → blocked by handleSend guard', () => {
    const advisory = adviseFreeSpeech('   ')
    expect(advisory.response).toBeNull()
  })

  it('"..." → does not get passive content world response', () => {
    const result = simulateRouting('...')
    expect(result.path).not.toBe('content_world')
  })
})

// ─── Content world default no longer catches all inputs ──────────────────────

describe('content world default does not produce passive seed', () => {
  it.each([
    'מה יש לי היום',
    'מי זה אופיר',
    'ספרי לי על המשפחה',
    'מה נשמע',
    'שלום',
    'איך את',
    'מה קורה',
  ])('"%s" → content world returns empty seed (no passive intercept)', (input) => {
    const w = chooseContentWorld(input)
    // None of these should get the passive "אני כאן בשקט..." response.
    // Either suggestedOpening is empty (falls through) or it's a specific
    // content cue (film, cooking, etc.) — never the default open_chat seed.
    if (w.contentMode === 'open_chat') {
      expect(w.suggestedOpening).toBe('')
      expect(w.gentleOptions.length).toBe(0)
    }
  })

  it('specific content cues still get deterministic seeds', () => {
    // Film cue
    const film = chooseContentWorld('המלצה על סרט')
    expect(film.contentMode).toBe('film_series')
    expect(film.suggestedOpening).not.toBe('')

    // Cooking cue
    const cook = chooseContentWorld('מתכון לאמפנדס')
    expect(cook.contentMode).toBe('cooking')
    expect(cook.suggestedOpening).not.toBe('')

    // Podcast cue
    const pod = chooseContentWorld('פודקאסט מעניין')
    expect(pod.contentMode).toBe('podcast')
    expect(pod.suggestedOpening).not.toBe('')
  })
})

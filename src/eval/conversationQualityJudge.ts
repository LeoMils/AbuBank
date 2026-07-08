/*
 * CONVERSATION QUALITY JUDGE
 * ═══════════════════════════════════════════════════════════════════════════
 * A DETERMINISTIC judge for a single assistant answer, scored 0–5. It is honest
 * about its reach: it fully judges RUNTIME-COMPOSED (deterministic) answers for
 * style/tone/menu/hallucination markers, and does NOT pretend to judge the
 * naturalness of a stubbed/streamed LLM answer (that is the model's job and is
 * device/LLM-runtime dependent — scored NEUTRAL, only gross faults flagged).
 *
 * Scoring:  0 catastrophic · 1 bad · 2 weak · 3 acceptable · 4 good · 5 excellent
 * P0 (hard fail): forced menu · online→reminder or reminder→online · a live-fact
 * asserted without the online tool · empty answer.
 */

export interface JudgeInput {
  say: string
  intent: string
  source: string            // 'deterministic' | 'online' | 'llm' | 'fallback'
  display: string
  onlineOk?: boolean | null // whether the online tool succeeded this turn (if online)
}

export interface JudgeVerdict {
  score: number
  labels: string[]
  p0: boolean
  judged: 'full' | 'gross-only' // 'full' = deterministic answer fully judged
}

// ── style / tone red flags (checked on runtime-composed Hebrew answers) ──
const FORCED_MENU_RE = /פגישה,?\s*יומן,?\s*משפחה|יומן,?\s*משפחה,?\s*או|(?:^|\s)באיזה יום\??\s*$/u
const CHILDISH_RE = /יופי של שאלה|כל הכבוד לך|איזה כיף|ילדה טובה|מתוקה שלי/u
const ROBOTIC_RE = /אני תבדוק|אני יבדוק|אני תעשה|אני יעשה|לא הצלחתי לעבד|שגיאה במערכת|invalid|undefined|null\b/iu
const MARKDOWN_RE = /(\*\*|##|\[.+\]\(.+\)|https?:\/\/|`{1,3})/u
const DOUBLED_WORD_RE = /(?<![א-ת])([א-ת]{2,})\s+\1(?![א-ת])/u
// A live/current fact that must come FROM the online tool, never composed locally.
const LIVE_FACT_RE = /\d+\s*מעלות|תחזית|ניצח\S*\s+ב?משחק|התוצאה\s+היא|שער\s+הדולר|₪\s*\d|\d+\s*ש״?ח\s+ל?דולר/u
const STUB_LLM_RE = /^\[LLM\]/u

/** Judge a single assistant turn. */
export function judgeTurn(t: JudgeInput): JudgeVerdict {
  const d = (t.display ?? '').trim()
  const labels: string[] = []
  let p0 = false

  // Empty answer is catastrophic regardless of source.
  if (!d) return { score: 0, labels: ['empty-answer'], p0: true, judged: 'gross-only' }

  // A stubbed/streamed LLM answer: judge only gross structural faults, not tone.
  if (STUB_LLM_RE.test(d) || t.source === 'llm') {
    // Even an LLM turn must not be a forced menu or leak a fabricated live fact
    // that should have been a tool call.
    if (FORCED_MENU_RE.test(d)) { labels.push('forced-menu'); p0 = true }
    return { score: p0 ? 1 : 3, labels, p0, judged: 'gross-only' }
  }

  // ── full judging of a runtime-composed answer ──
  let score = 5
  if (FORCED_MENU_RE.test(d)) { labels.push('forced-menu'); p0 = true; score = Math.min(score, 1) }
  if (CHILDISH_RE.test(d)) { labels.push('childish/patronizing'); score -= 2 }
  if (ROBOTIC_RE.test(d)) { labels.push('robotic/broken'); score -= 2 }
  if (MARKDOWN_RE.test(d)) { labels.push('markdown/url-in-speech'); score -= 2 }
  if (DOUBLED_WORD_RE.test(d)) { labels.push('doubled-word'); score -= 1 }
  if (d.length > 400) { labels.push('too-long'); score -= 1 }

  // Hallucination: a live fact asserted while NOT sourced from a successful online
  // call (i.e. a deterministic/fallback answer that states weather/score/price).
  if (LIVE_FACT_RE.test(d) && t.source !== 'online') { labels.push('live-fact-without-tool'); p0 = true; score = Math.min(score, 1) }
  // A live fact when the online call FAILED = fabricated.
  if (LIVE_FACT_RE.test(d) && t.source === 'online' && t.onlineOk === false) { labels.push('live-fact-on-failed-online'); p0 = true; score = Math.min(score, 1) }

  return { score: Math.max(0, score), labels, p0, judged: 'full' }
}

export interface ConversationScore {
  avg: number
  min: number
  p0Count: number
  fails: boolean
  perTurn: JudgeVerdict[]
}

/** Aggregate a conversation. Fails if any P0, or fully-judged average < 4, or any
 *  fully-judged answer scored ≤ 1. Turns judged 'gross-only' don't drag the tone
 *  average (they're not runtime-composed), but their P0s still fail. */
export function judgeConversation(turns: JudgeInput[]): ConversationScore {
  const perTurn = turns.map(judgeTurn)
  const full = perTurn.filter(v => v.judged === 'full')
  const scores = full.map(v => v.score)
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 5
  const min = scores.length ? Math.min(...scores) : 5
  const p0Count = perTurn.filter(v => v.p0).length
  const fails = p0Count > 0 || (full.length > 0 && (avg < 4 || min <= 1))
  return { avg, min, p0Count, fails, perTurn }
}

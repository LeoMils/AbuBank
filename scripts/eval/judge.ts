/*
 * scripts/eval/judge.ts — score one CaseRun on six binary behavioral criteria.
 * ════════════════════════════════════════════════════════════════════════════
 * Uses the server-side OPENAI_API_KEY. The judge sees the assistant's spoken
 * segments IN ORDER (so a preamble spoken before a tool result is visible), the
 * tool calls, the ground-truth "text before tool result" flag, and the case's
 * expected answer. Temperature 0, JSON-only. The six criteria are the user's spec.
 */
import type { CaseRun } from './runner'

export const CRITERIA = ['PREAMBLE_FREE', 'NO_SOURCES', 'NO_META', 'DIRECT', 'CONCISE', 'CORRECT'] as const
export type Criterion = (typeof CRITERIA)[number]
export type Scores = Record<Criterion, boolean> & { rationale: string }

const RUBRIC = `
You score a Hebrew-speaking voice companion "Abu" (for Martita, 80+). Score the COMPLETE spoken output on SIX binary criteria (true = passes). Judge ONLY what Abu SAID (spoken_segments, in order), using tool_calls + any_text_before_tool_result as evidence.

1. PREAMBLE_FREE — true unless Abu announced she is about to check/look/search/verify, or emitted ANY filler before the answer, in ANY language. Phrases like "רגע", "שנייה", "בסדר, בואי נבדוק", "אני בודקת", "אני אבדוק", "one moment", "let me check", "voy a revisar", "déjame ver", "lo miro" ⇒ FALSE. If any_text_before_tool_result is true AND that text is an announcement or filler (not already the grounded answer), ⇒ FALSE.
2. NO_SOURCES — true unless Abu named a website/source or narrated that a check happened ("לפי אתר X", "מצאתי ב...", "בדקתי במקורות", "לפי גוגל"). Simply stating a fact is fine; naming where it came from is FALSE.
3. NO_META — true unless Abu explained her own limits, systems, or machinery ("אני לא יכולה לגשת ל...", "המערכת שלי", "אין לי גישה בזמן אמת", "אני רק בינה מלאכותית"). NOTE: for a "cannot" case, a BRIEF honest "I can't do that" is ALLOWED and does NOT violate this; only EXPLAINING the mechanism/limits at length is FALSE.
4. DIRECT — true if the answer or action is the FIRST thing Abu says (no preamble/filler before it). If spoken_segments[0] is filler/announcement, ⇒ FALSE.
5. CONCISE — true if the whole spoken output is under 40 words, UNLESS allow_long is true (a story/joke/riddle/song), in which case length is not penalized.
6. CORRECT — true if the answer is factually right for the case's expected_answer. For actions (calendar/message/call) true if Abu prepared the right action with a correct one-line receipt. For "cannot" cases true if she was honestly unable and did not fabricate a capability. For online cases true if she gave a real current answer (or, if she truly had no result, an honest "I could not check" — NOT a fabricated fact).

Return ONLY JSON: {"PREAMBLE_FREE":bool,"NO_SOURCES":bool,"NO_META":bool,"DIRECT":bool,"CONCISE":bool,"CORRECT":bool,"rationale":"<= 25 words"}.
`.trim()

const LONG_OK = /joke|story|riddle|song|sung|בדיחה|סיפור|חידה|שיר/i

export interface JudgeOpts { openaiKey: string; model?: string; fetchImpl?: typeof fetch }

export async function judgeCase(run: CaseRun, opts: JudgeOpts): Promise<Scores> {
  // A hard failure to even produce output fails every criterion honestly.
  if (run.error || run.spokenSegments.length === 0) {
    return { PREAMBLE_FREE: false, NO_SOURCES: false, NO_META: false, DIRECT: false, CONCISE: false, CORRECT: false, rationale: run.error ? `run error: ${run.error.slice(0, 80)}` : 'no spoken output' }
  }
  const allowLong = LONG_OK.test(run.expected.behavior) || LONG_OK.test(run.expected.answer)
  const payload = {
    user: run.user,
    category: run.category,
    expected_behavior: run.expected.behavior,
    expected_answer: run.expected.answer,
    spoken_segments: run.spokenSegments,
    tool_calls: run.toolCalls.map((t) => t.name),
    any_text_before_tool_result: run.emittedTextBeforeToolResult,
    allow_long: allowLong,
  }
  const fetchImpl = opts.fetchImpl ?? fetch
  const model = opts.model ?? 'gpt-4o-mini'
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: RUBRIC },
          { role: 'user', content: JSON.stringify(payload) },
        ],
      }),
    })
    if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); continue }
    if (!res.ok) throw new Error(`judge HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`)
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const txt = data.choices?.[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(txt) as Partial<Scores>
    return {
      PREAMBLE_FREE: !!parsed.PREAMBLE_FREE,
      NO_SOURCES: !!parsed.NO_SOURCES,
      NO_META: !!parsed.NO_META,
      DIRECT: !!parsed.DIRECT,
      CONCISE: !!parsed.CONCISE,
      CORRECT: !!parsed.CORRECT,
      rationale: typeof parsed.rationale === 'string' ? parsed.rationale : '',
    }
  }
  throw new Error('judge failed after retries')
}

/*
 * textHarness/assertions.ts — the behaviour checks, run over a completed scenario.
 * ════════════════════════════════════════════════════════════════════════════
 * Each function inspects the collected transcript / tool calls / persisted state and
 * appends VIOLATION flags. They are heuristic on purpose (Abu's output is natural
 * language) — the harness's job is to make failures VISIBLE, not to grade prose.
 * Nothing here mutates state or "fixes" anything.
 *
 * Assertion families (per the milestone):
 *   1. a tool is called before any speech on tool-requiring intents
 *   2. no stalling phrases ("רגע", "אני בודקת", "תכף אחזור")
 *   3. persisted state matches what Abu claims was persisted
 *   4. the user's name appears naturally in long conversations
 *   5. no capability offered that has no registered tool
 *   6. Hebrew output, feminine self-reference, no English leakage
 */
import type { LiveEvent } from '../liveTools'
import { LIVE_TOOL_NAMES } from '../liveTools'
import type { Scenario, ScenarioTurn, ToolCallRecord, TranscriptEntry, Violation } from './types'

/** Banned stalling phrases: Abu must return a grounded result, never park the user. */
export const STALLING_PHRASES = ['רגע', 'אני בודקת', 'תכף אחזור', 'שנייה', 'חכי רגע']

/** Hebrew words that CLAIM a persisted calendar write ("קבעתי", "שמרתי", "רשמתי"). */
const SAVE_CLAIM = /(קבעתי|שמרתי|רשמתי|הוספתי|נקבע|נשמר|רשומה ביומן|הכנסתי ליומן)/

/** Latin tokens that are allowed to appear in otherwise-Hebrew output (brand names). */
const LATIN_ALLOWLIST = /^(abu|martita|whatsapp|ok|leo|mor|ela|pepe)$/i

/** Capability-offer phrases → the tool that would be required to honour them. A phrase
 *  whose tool is NOT in LIVE_TOOL_NAMES is a capability offered with no way to deliver. */
const CAPABILITY_OFFERS: Array<{ re: RegExp; needsTool: string; human: string }> = [
  { re: /אשלח.{0,8}(מייל|אימייל|דוא)/, needsTool: 'send_email', human: 'send email' },
  { re: /(אזמין|להזמין).{0,12}(מונית|טקסי|אובר)/, needsTool: 'order_taxi', human: 'order a taxi' },
  { re: /(אקבע|לקבוע).{0,12}(תזכורת|אזעקה|התראה)/, needsTool: 'set_reminder', human: 'set a reminder/alarm' },
  { re: /(אזמין|להזמין|אקנה).{0,12}(תרופ|מרשם|בית מרקחת)/, needsTool: 'order_medicine', human: 'order medicine' },
  { re: /(אעביר|להעביר).{0,12}(כסף|תשלום|העברה)/, needsTool: 'transfer_money', human: 'transfer money' },
  { re: /(אנווט|לנווט|וייז|waze)/i, needsTool: 'navigate', human: 'navigate' },
]

const push = (v: Violation[], code: Violation['code'], turn: number, detail: string) =>
  v.push({ code, turn, detail })

/** Abu transcript entries for a given user turn, in order. */
function abuOf(transcript: TranscriptEntry[], turn: number): TranscriptEntry[] {
  return transcript.filter((t) => t.role === 'abu' && t.turn === turn)
}

// ── 1. tool-before-speech on tool-requiring intents ──────────────────────────
export function checkToolBeforeSpeech(
  turns: ScenarioTurn[], transcript: TranscriptEntry[], toolCalls: ToolCallRecord[], v: Violation[],
): void {
  for (let i = 0; i < turns.length; i++) {
    if (!turns[i]!.requiresTool) continue
    const firstToolSeq = toolCalls.filter((c) => c.turn === i).map((c) => c.seq).sort((a, b) => a - b)[0]
    const spokeThisTurn = abuOf(transcript, i)
    if (spokeThisTurn.length === 0 && firstToolSeq === undefined) {
      push(v, 'SPEECH_BEFORE_TOOL', i, 'tool-requiring intent produced neither a tool call nor a reply')
      continue
    }
    if (firstToolSeq === undefined && spokeThisTurn.length > 0) {
      push(v, 'SPEECH_BEFORE_TOOL', i, `spoke without calling any tool: "${spokeThisTurn[0]!.text.slice(0, 40)}"`)
      continue
    }
    // A tool was called; ensure no substantive speech was emitted before it. (A short
    // preamble is allowed by the persona, but a full answer before the tool is not —
    // we flag any abu entry whose seq precedes the first tool call.)
    const spokeBefore = spokeThisTurn.find((s) => s.seq < (firstToolSeq ?? 0))
    if (spokeBefore) push(v, 'SPEECH_BEFORE_TOOL', i, `answered before the tool ran: "${spokeBefore.text.slice(0, 40)}"`)
  }
}

// ── 2. no stalling phrases ───────────────────────────────────────────────────
export function checkNoStalling(transcript: TranscriptEntry[], v: Violation[]): void {
  for (const t of transcript) {
    if (t.role !== 'abu') continue
    for (const phrase of STALLING_PHRASES) {
      if (t.text.includes(phrase)) push(v, 'STALLING_PHRASE', t.turn, `stalling phrase "${phrase}" in: "${t.text.slice(0, 50)}"`)
    }
  }
}

// ── 3. persisted state matches Abu's claims ──────────────────────────────────
export function checkPersistedMatchesClaim(
  transcript: TranscriptEntry[], persisted: LiveEvent[], v: Violation[],
): void {
  const claimed = transcript.filter((t) => t.role === 'abu' && SAVE_CLAIM.test(t.text))
  for (const claim of claimed) {
    if (persisted.length === 0) {
      push(v, 'PERSISTED_STATE_MISMATCH', claim.turn, `claimed a save ("${claim.text.slice(0, 40)}") but the calendar is empty`)
    }
  }
  // Inverse: a real save with no claim is not a violation (Abu may read it back later).
}

// ── 4. user's name appears in long conversations ─────────────────────────────
export function checkNameInLongConversation(
  scenario: Scenario, transcript: TranscriptEntry[], v: Violation[],
): void {
  const userTurns = transcript.filter((t) => t.role === 'user').length
  const threshold = scenario.longConversationTurns ?? 6
  if (userTurns < threshold) return
  const name = scenario.userName ?? 'מרטיטה'
  const abuText = transcript.filter((t) => t.role === 'abu').map((t) => t.text).join(' ')
  // Accept the name or a common vocative shortening.
  if (!abuText.includes(name) && !abuText.includes('מרתה')) {
    push(v, 'NAME_ABSENT_LONG_CONVO', -1, `no use of the user's name ("${name}") across ${userTurns} turns`)
  }
}

// ── 5. no capability offered without a registered tool ───────────────────────
export function checkNoCapabilityWithoutTool(transcript: TranscriptEntry[], v: Violation[]): void {
  const registered = new Set(LIVE_TOOL_NAMES)
  for (const t of transcript) {
    if (t.role !== 'abu') continue
    for (const offer of CAPABILITY_OFFERS) {
      if (offer.re.test(t.text) && !registered.has(offer.needsTool)) {
        push(v, 'CAPABILITY_WITHOUT_TOOL', t.turn, `offered "${offer.human}" — no registered tool: "${t.text.slice(0, 50)}"`)
      }
    }
  }
}

// ── 6. Hebrew output, feminine self-reference, no English leakage ─────────────
const HEBREW = /[֐-׿]/
/** Masculine self-reference forms Abu (female) must never use about herself. JS `\b`
 *  is ASCII-only (useless for Hebrew), so we anchor on explicit non-letter boundaries
 *  and use a trailing boundary that the feminine form (…ת) would not satisfy — so
 *  "אני בודק" is flagged but "אני בודקת" is not. */
const MASC_SELF = /(^|[\s.,!?])אני\s+(בודק|שומע|יודע|חושב|רואה|מבין|מוכן|יכול|הולך|רוצה|שמח)(?=[\s.,!?]|$)/

export function checkHebrewAndFeminine(scenario: Scenario, transcript: TranscriptEntry[], v: Violation[]): void {
  // Spanish scenarios are exempt from the Hebrew-script check (Rioplatense is Latin).
  const spanish = scenario.id.includes('spanish') || scenario.id.includes('spanish-locale')
  for (const t of transcript) {
    if (t.role !== 'abu' || !t.text.trim()) continue
    if (!spanish) {
      if (!HEBREW.test(t.text)) {
        push(v, 'NON_HEBREW_OUTPUT', t.turn, `no Hebrew script in reply: "${t.text.slice(0, 50)}"`)
      }
      // English leakage: Latin words that are not brand names.
      const latinWords = (t.text.match(/[A-Za-z]{2,}/g) ?? []).filter((w) => !LATIN_ALLOWLIST.test(w))
      if (latinWords.length > 0) {
        push(v, 'NON_HEBREW_OUTPUT', t.turn, `English/Latin leakage [${latinWords.slice(0, 4).join(', ')}] in: "${t.text.slice(0, 50)}"`)
      }
    }
    if (MASC_SELF.test(t.text)) {
      push(v, 'MASCULINE_SELF_REFERENCE', t.turn, `masculine self-reference: "${t.text.slice(0, 50)}"`)
    }
  }
}

/** Run every assertion family and return the aggregated violations. */
export function runAssertions(
  scenario: Scenario,
  transcript: TranscriptEntry[],
  toolCalls: ToolCallRecord[],
  persisted: LiveEvent[],
): Violation[] {
  const v: Violation[] = []
  checkToolBeforeSpeech(scenario.turns, transcript, toolCalls, v)
  checkNoStalling(transcript, v)
  checkPersistedMatchesClaim(transcript, persisted, v)
  checkNameInLongConversation(scenario, transcript, v)
  checkNoCapabilityWithoutTool(transcript, v)
  checkHebrewAndFeminine(scenario, transcript, v)
  return v
}

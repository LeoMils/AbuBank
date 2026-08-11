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

/** Match a stalling phrase as a WHOLE word. Hebrew has no ASCII `\b`, so we guard with
 *  lookarounds that exclude an adjacent Hebrew letter — otherwise "רגע" false-matches
 *  inside legitimate words like "להירגע" (to relax) or "רגעים" (moments). */
const STALLING_RES = STALLING_PHRASES.map(
  (p) => new RegExp(`(?<![א-ת])${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![א-ת])`),
)

/** Hebrew verbs that CLAIM a persisted calendar write ("קבעתי", "שמרתי", "רשמתי"). */
const SAVE_VERBS = ['קבעתי', 'שמרתי', 'רשמתי', 'הוספתי', 'נקבע', 'נשמר', 'רשומה ביומן', 'הכנסתי ליומן']

/** True if `text` asserts a save that is NOT negated. A save-verb immediately
 *  preceded by "לא" ("לא קבעתי עדיין" = "I haven't set it up yet") is a DENIAL, not
 *  a claim, and must not count — the negation-blind check was a false positive. */
export function claimsSave(text: string): boolean {
  for (const verb of SAVE_VERBS) {
    let idx = text.indexOf(verb)
    while (idx >= 0) {
      const before = text.slice(Math.max(0, idx - 8), idx)
      if (!/לא\s*$/.test(before)) return true // a save-verb that is not negated
      idx = text.indexOf(verb, idx + verb.length)
    }
  }
  return false
}

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
    // A tool was called; NO speech may precede it. The persona/instructions forbid any
    // filler or acknowledgment before a tool call — the tool runs first and she speaks
    // only the grounded result. We flag any abu entry whose seq precedes the first tool call.
    const spokeBefore = spokeThisTurn.find((s) => s.seq < (firstToolSeq ?? 0))
    if (spokeBefore) push(v, 'SPEECH_BEFORE_TOOL', i, `spoke before the tool ran: "${spokeBefore.text.slice(0, 40)}"`)
  }
}

// ── 2. no stalling phrases ───────────────────────────────────────────────────
export function checkNoStalling(transcript: TranscriptEntry[], v: Violation[]): void {
  for (const t of transcript) {
    if (t.role !== 'abu') continue
    for (let i = 0; i < STALLING_PHRASES.length; i++) {
      if (STALLING_RES[i]!.test(t.text)) push(v, 'STALLING_PHRASE', t.turn, `stalling phrase "${STALLING_PHRASES[i]}" in: "${t.text.slice(0, 50)}"`)
    }
  }
}

// ── 3. persisted state matches Abu's claims ──────────────────────────────────
export function checkPersistedMatchesClaim(
  transcript: TranscriptEntry[], persisted: LiveEvent[], v: Violation[],
): void {
  const claimed = transcript.filter((t) => t.role === 'abu' && claimsSave(t.text))
  for (const claim of claimed) {
    if (persisted.length === 0) {
      push(v, 'PERSISTED_STATE_MISMATCH', claim.turn, `claimed a save ("${claim.text.slice(0, 40)}") but the calendar is empty`)
    }
  }
  // Inverse: a real save with no claim is not a violation (Abu may read it back later).
}

// ── 3b. a location the user gave must survive to the persisted event ─────────
/** The exact device bug: an event created/updated WITH a location loses the
 *  location by the time it is committed and read back. If the scenario declares an
 *  expected location, assert the persisted event actually carries it. */
export function checkLocationSurvives(
  scenario: Scenario, persisted: LiveEvent[], v: Violation[],
): void {
  const want = scenario.expectLocation
  if (!want) return
  const survived = persisted.some((e) => !!e.location && e.location.includes(want))
  if (!survived) {
    push(v, 'LOCATION_DROPPED', -1, `location "${want}" did not survive to the persisted event (persisted: ${JSON.stringify(persisted)})`)
  }
}

// ── 3c. Abu never CLAIMS a send/call — only the user's card-tap performs it ───
/** Verbs that claim an action Abu cannot perform (only Martita's tap on the card
 *  sends/dials). "שלחתי"/"התקשרתי" are claims; "לא שלחתי" is a truthful denial. */
const SEND_CALL_VERBS = ['שלחתי', 'שלחתי לה', 'שלחתי לו', 'התקשרתי', 'חייגתי', 'ביצעתי שיחה', 'דיברתי איתו בטלפון']

export function claimsSendOrCall(text: string): boolean {
  for (const verb of SEND_CALL_VERBS) {
    let idx = text.indexOf(verb)
    while (idx >= 0) {
      const before = text.slice(Math.max(0, idx - 8), idx)
      if (!/לא\s*$/.test(before)) return true
      idx = text.indexOf(verb, idx + verb.length)
    }
  }
  return false
}

export function checkNoSendCallClaim(transcript: TranscriptEntry[], v: Violation[]): void {
  for (const t of transcript) {
    if (t.role !== 'abu') continue
    if (claimsSendOrCall(t.text)) {
      push(v, 'CLAIMED_UNCONFIRMED_ACTION', t.turn, `claimed a send/call only the card-tap performs: "${t.text.slice(0, 50)}"`)
    }
  }
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

/** Decline/refusal cues: when Abu says she CANNOT do the thing, a mention of the
 *  capability ("I can't order a taxi") is correct, not an over-offer — so it must not
 *  be flagged. This mirrors the save-claim negation fix. */
const DECLINE_CUE = /(לא יכולה|לא אוכל|אין לי|לא ניתן|לא עושה|לא מצליחה|זה לא משהו ש|לצערי לא|אני לא יודעת איך)/

// ── 5. no capability offered without a registered tool ───────────────────────
export function checkNoCapabilityWithoutTool(transcript: TranscriptEntry[], v: Violation[]): void {
  const registered = new Set(LIVE_TOOL_NAMES)
  for (const t of transcript) {
    if (t.role !== 'abu') continue
    if (DECLINE_CUE.test(t.text)) continue // a warm refusal is the CORRECT behaviour
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
 *  "אני בודק" is flagged but "אני בודקת" is not. Gender-HOMOGRAPHIC present-tense verbs
 *  (רואה, רוצה — spelled identically for masculine and feminine) are deliberately
 *  EXCLUDED: they were false positives (Abu was not mis-gendering herself). */
const MASC_SELF = /(^|[\s.,!?])אני\s+(בודק|שומע|יודע|חושב|מבין|מוכן|יכול|הולך|שמח)(?=[\s.,!?]|$)/

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

// ── 7. no opening phrase repeats more than twice in a long conversation ───────
/** Normalise the OPENING of a spoken turn to its first two meaningful words, so a
 *  repeated stock opener ("טוב, נבדוק …" every turn) collapses to one key regardless of
 *  what follows. Punctuation and the filler comma are stripped; empty → ''. */
export function openingPhraseOf(text: string): string {
  const cleaned = text.replace(/[.,!?…"'()\-—:;]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  return cleaned.split(' ').slice(0, 2).join(' ')
}

/** Assertion 7: in a long conversation, the SAME opening phrase must not repeat more
 *  than twice. Robotic re-use of an opener ("טוב, …" every turn) is the repetition the
 *  device trace showed. Only long conversations are graded (short ones can coincide). */
export function checkNoRepeatedOpeningPhrase(
  scenario: Scenario, transcript: TranscriptEntry[], v: Violation[],
): void {
  const threshold = scenario.longConversationTurns ?? 6
  const abuTurns = transcript.filter((t) => t.role === 'abu' && t.text.trim())
  if (transcript.filter((t) => t.role === 'user').length < threshold) return
  const counts = new Map<string, number>()
  for (const t of abuTurns) {
    const opener = openingPhraseOf(t.text)
    if (!opener) continue
    const n = (counts.get(opener) ?? 0) + 1
    counts.set(opener, n)
    if (n === 3) push(v, 'REPEATED_OPENING_PHRASE', t.turn, `opening phrase "${opener}" repeats more than twice`)
  }
}

// ── 8. never ANNOUNCE the check she then performs (tool-agnostic) ─────────────
/** Announcement-of-a-check phrases. Flagged ONLY when a tool actually ran on the SAME
 *  turn — i.e. she narrated the lookup she then did. The honest-defer line ("בואי נבדוק
 *  ביומן ביחד") is spoken when she CANNOT check (no tool runs) and is therefore not
 *  flagged. Tool-agnostic: it keys on "she announced then a tool ran", not on any
 *  specific tool, so a future tool cannot regress it. */
const ANNOUNCE_CHECK = /(נבדוק|אבדוק|בוא\s*נבדוק|בואי\s*נבדוק|תני\s*לי\s*לבדוק|אני\s*אבדוק|בוא\s*נראה|נראה\s*מה)/
export function checkNoAnnouncedCheck(
  transcript: TranscriptEntry[], toolCalls: ToolCallRecord[], v: Violation[],
): void {
  const turnsWithTool = new Set(toolCalls.map((c) => c.turn))
  for (const t of transcript) {
    if (t.role !== 'abu' || !t.text.trim()) continue
    if (!turnsWithTool.has(t.turn)) continue // no tool ran → an honest defer, not an announced check
    if (t.seq < Math.min(...toolCalls.filter((c) => c.turn === t.turn).map((c) => c.seq))) {
      if (ANNOUNCE_CHECK.test(t.text)) {
        push(v, 'ANNOUNCED_CHECK', t.turn, `announced the check before doing it: "${t.text.slice(0, 50)}"`)
      }
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
  checkLocationSurvives(scenario, persisted, v)
  checkNoSendCallClaim(transcript, v)
  checkNameInLongConversation(scenario, transcript, v)
  checkNoCapabilityWithoutTool(transcript, v)
  checkHebrewAndFeminine(scenario, transcript, v)
  checkNoRepeatedOpeningPhrase(scenario, transcript, v)
  checkNoAnnouncedCheck(transcript, toolCalls, v)
  return v
}

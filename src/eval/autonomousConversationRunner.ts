/*
 * Autonomous Conversation Runner
 * ══════════════════════════════
 * Executes a generated conversation through the REAL AbuAI deterministic pipeline,
 * mirroring the runtime dispatch (pending-draft resolution → grounded answer →
 * create → conversation-OS continuation). Threads createState + ConvState across
 * turns (real session state) and records any violation of the Phase-7 strict
 * failure rules. No LLM, no mocks — pure pipeline behaviour.
 */
import {
  startCreate, resolvePendingMessage, IDLE_STATE, type CalendarCreateState,
} from '../screens/AbuAI/calendarCreate'
import { tryGroundedAnswer } from '../screens/AbuAI/service'
import {
  recordAnswer, recordOnline, isContinuation, handleConversationTurn, IDLE_CONV, type ConvState,
} from '../screens/AbuAI/conversationOS'
import type { Conversation, Beat } from './autonomousScenarioFactory'

export interface Violation { convId: number; beat: number; kind: string; rule: string; detail: string }

function checkBeat(
  conv: Conversation, i: number, beat: Beat,
  ctx: { create: CalendarCreateState; conv: ConvState },
  v: Violation[],
): void {
  const add = (rule: string, detail: string) => v.push({ convId: conv.id, beat: i, kind: beat.kind, rule, detail })
  const pending = ctx.create.phase !== 'idle'

  // ── PENDING draft: resolve via the same function the runtime uses ──
  if (pending && (beat.kind === 'confirm' || beat.kind === 'cancel' || beat.kind === 'audio' || beat.kind === 'emotional' || beat.kind === 'family')) {
    const isRead = false
    const res = resolvePendingMessage(ctx.create, beat.text, isRead)

    // Strict rule: audio complaint must NEVER cancel/clarify the draft.
    if (beat.kind === 'audio') {
      if (res.action !== 'audio_help') add('audio_complaint_mishandled', `expected audio_help, got ${res.action}`)
      // draft must survive (state unchanged)
    }
    // Strict rule: emotional interruption parks (warm), never cancels.
    else if (beat.kind === 'emotional') {
      if (res.action === 'cancel') add('wrong_cancel_emotional', `emotional "${beat.text}" → cancel`)
      else if (res.action !== 'park') add('emotional_not_parked', `expected park, got ${res.action}`)
      if (res.action === 'park') ctx.create = IDLE_STATE
    }
    // Strict rule: confirm variant while confirming → SAVE (never unclear/cancel).
    else if (beat.kind === 'confirm') {
      if (res.action !== 'save') add('confirm_not_saved', `"${beat.text}" → ${res.action}`)
      else ctx.create = IDLE_STATE
    }
    // Strict rule: explicit cancel → cancel.
    else if (beat.kind === 'cancel') {
      if (res.action !== 'cancel') add('explicit_cancel_ignored', `"${beat.text}" → ${res.action}`)
      else ctx.create = IDLE_STATE
    }
    // Family question mid-pending: must not silently cancel; parked/handled.
    else if (beat.kind === 'family') {
      if (res.action === 'cancel') add('wrong_cancel_family', `family q mid-pending → cancel`)
      if (res.action === 'park' || res.action === 'read') ctx.create = IDLE_STATE
    }
    return
  }

  // ── CREATE: start a draft; person + location must be preserved ──
  if (beat.kind === 'create') {
    const st = startCreate(beat.text)
    if (st.phase === 'idle') { add('create_not_recognized', `"${beat.text}"`); return }
    ctx.create = st
    if (beat.expect.person && st.draft.person !== beat.expect.person) add('create_lost_person', `expected ${beat.expect.person}, got ${st.draft.person}`)
    if (beat.expect.wantLocation && !st.draft.location) add('create_lost_location', `"${beat.text}" → location=null`)
    return
  }

  // ── FAMILY (idle): must be grounded from the graph, not fall to the LLM ──
  if (beat.kind === 'family') {
    const ans = tryGroundedAnswer(beat.text)
    if (!ans) { add('family_not_grounded', `"${beat.text}" → null (would hit LLM)`); return }
    if (beat.expect.mustInclude && !ans.includes(beat.expect.mustInclude as string)) add('family_wrong', `"${beat.text}" missing ${beat.expect.mustInclude}: "${ans}"`)
    if (/\d{1,2}:\d{2}/.test(ans) && /פגישה|תור/.test(ans)) add('family_calendar_leak', `family answer leaked calendar: "${ans}"`)
    return
  }

  // ── ONLINE: simulate the runtime having answered + stored the result ──
  if (beat.kind === 'online') {
    ctx.conv = recordOnline(ctx.conv, { query: beat.text, topic: beat.text, source: 'web', ok: true, reason: null, summary: 'תשובה מלאה על ' + beat.text })
    ctx.conv = recordAnswer(ctx.conv, { question: beat.text, intent: 'online', topic: beat.text, fullText: 'התשובה הראשונה. ועוד פרט שני על הנושא. ופרט שלישי לסיום.' })
    return
  }

  // ── CONTINUE: must resume the stored answer / retain topic, never "cannot check" ──
  if (beat.kind === 'continue') {
    if (!isContinuation(beat.text)) { add('continuation_not_detected', `"${beat.text}"`); return }
    const turn = handleConversationTurn(ctx.conv, beat.text)
    ctx.conv = turn.state
    const topicKept = !!ctx.conv.online?.query
    if (!turn.handled && !topicKept) add('continuation_lost_topic', `"${beat.text}" not handled + no topic`)
    if (/לא\s+מצליחה\s+לבדוק|com\]\(|cbsnews|מה היה הנושא/.test(turn.speak ?? '')) add('robotic_or_broken_continuation', `"${turn.speak}"`)
    return
  }
}

export function runConversation(conv: Conversation): Violation[] {
  const v: Violation[] = []
  const ctx = { create: IDLE_STATE as CalendarCreateState, conv: IDLE_CONV as ConvState }
  for (let i = 0; i < conv.beats.length; i++) checkBeat(conv, i, conv.beats[i]!, ctx, v)
  return v
}

/*
 * Companion Brain V1 — the PLANNING CORTEX.
 *
 * Implements STEP 1–7 of the companion turn (ABUAI_COGNITIVE_MODEL §1): before
 * any answer is generated, decide *what Martita actually needs* and *which act*
 * serves her — companionship/emotion before task/fact, with the emotional
 * suppression rule. This is a PURE, deterministic decision layer: no LLM, no
 * fetch, no React. It produces a CompanionPlan; STEP 8 (rendering the words in
 * AbuAI's voice) is a separate layer that consumes this plan.
 *
 * Why deterministic: the failure mode "behaves like a collection of tools" is a
 * *decision* failure (running a family lookup during grief, dumping a list when
 * she's lonely). Those decisions must be reliable and testable — not left to a
 * language model to rediscover every turn. The model's job is wording, not
 * whether to suppress a lookup.
 *
 * Frame hierarchy: COMPANIONSHIP > EMOTION > TASK > FACT.
 */
import { findNode } from './familyGraph'

export type Frame = 'companionship' | 'emotion' | 'task' | 'fact'
export type Mood =
  | 'grief' | 'lonely' | 'bored' | 'worried' | 'proud' | 'happy' | 'frustrated' | 'neutral'
/** The decided conversational act (ABUAI_DECISION_TREE). */
export type Act =
  | 'listen' | 'stay_quiet' | 'answer' | 'confirm' | 'ask' | 'lead'
  | 'continue' | 'suggest' | 'encourage' | 'deepen' | 'redirect'
export type CalRelevance = 'create' | 'read' | 'remind' | 'none'

export interface ConversationState {
  lastPerson: string | null      // Hebrew name of the last person discussed
  lastTopic: string | null
  lastMood: Mood | null
  emotionalContext: Mood | null   // STICKY — survives an incidental factual turn
  openLoops: string[]
}

export const EMPTY_STATE: ConversationState = {
  lastPerson: null, lastTopic: null, lastMood: null, emotionalContext: null, openLoops: [],
}

export interface CompanionPlan {
  step1_goal: string                 // what she is trying to achieve
  step2_emotion: Mood                // emotional context (current or sticky)
  step3_familyEntity: string | null  // resolved family person, if any
  step4_continuity: { resolvedPerson: string | null; continuesTopic: boolean }
  step5_calendar: CalRelevance
  step6_onlineNeeded: boolean
  step7_frame: Frame
  step7_act: Act
  /** The emotional suppression rule: skip family/calendar lookups this turn. */
  suppressLookups: boolean
  reason: string
}

// ─── Detection vocabularies (HE + a little ES) ──────────────────────────────
const GRIEF = /(מתגעג|התגעגע|פאפי|פפה|חסר לי מאוד|נפטר|הלך לעולמו|אלמנ|בוכה|בכי|דמעות|extraño a|lo extraño)/
const LONELY = /(בוד[דת]|לבד|אין לי עם מי|שקט בבית|רק אני|solo|sola|me siento sola)/
const BORED = /(משעמם|שעמום|אין מה לעשות|כלום לעשות|aburrid)/
const WORRIED = /(דואג|מודאג|מודאגת|נעלב|נעלבתי|לא התקשר|קרה משהו|חרד|מפחד|פוחד|preocupad)/
const PROUD = /(גאה|מתרגש|מתרגשת|התחתן|מתחתן|נולד|הצליח|קיבל תפקיד|orgullos)/
const HAPPY = /(שמח|מאושר|איזה כיף|כיף לי|נהדר|יום טוב|ja ja|חחח|jaja)/
const FRUSTRATED = /(כועס|כועסת|נמאס|מעצבן|מתעצבן|למה זה לא|enojad|harta)/

const CAL_CREATE = /(תקבע|תקבעי|קבעי לי|קבע לי|תוסיפי|תוסיף|תרשמי|תרשום|תכניסי|שימי לי ביומן)/
const CAL_REMIND = /(תזכיר|תזכירי|תזכרי|להזכיר|תזכורת)/
const CAL_READ = /(מה יש לי|מה קבעתי|מה יש מחר|מה יש היום|מה התוכניות|מתי ה|מה יש לי ב|מה יש אחרי|פנוי|תור)/

const ONLINE = /(חדשות|מה חדש|חדש בעולם|מה קורה בעולם|מזג ?האוויר|מזג אויר|גשם|יהיה חם|סרט|סרטים|מי ניצח|תוצאות|כמה עולה|מחיר|מתי פותח|מתי נפתח|תחזית|noticias|clima|película)/

// Continuity cues — references that lean on the previous turn.
const CONT_TOPIC = /(^|\s)(ועוד\??|תמשיכי|נו\??|ספרי עוד|עוד\?)($|\s)/
const CONT_PRONOUN_F = /(ספרי לי עליה|ספרי עליה|עליה$|מה איתה)/
const CONT_PRONOUN_M = /(ספרי לי עליו|ספרי עליו|עליו$|מה איתו)/
const CONT_RECAP = /(מה אמרתי קודם|על מה דיברנו|תחזרי ל)/

function detectMood(text: string): Mood {
  if (GRIEF.test(text)) return 'grief'
  if (WORRIED.test(text)) return 'worried'
  if (FRUSTRATED.test(text)) return 'frustrated'
  if (LONELY.test(text)) return 'lonely'
  if (BORED.test(text)) return 'bored'
  if (PROUD.test(text)) return 'proud'
  if (HAPPY.test(text)) return 'happy'
  return 'neutral'
}

/** Find a known family person mentioned anywhere in the text. */
function detectFamilyEntity(text: string): string | null {
  // Try whole-string and token matches via the family graph's matcher.
  const direct = findNode(text)
  if (direct) return direct.hebrew
  for (const tok of text.split(/[\s,?.!"'״’]+/).filter(Boolean)) {
    const n = findNode(tok)
    if (n) return n.hebrew
  }
  return null
}

/**
 * STEP 1–7. Pure planner: input + conversation state → CompanionPlan.
 * Does NOT render words (STEP 8) and does NOT call any engine — it decides
 * which engine/act is appropriate and whether lookups are suppressed.
 */
export function planCompanionTurn(inputRaw: string, state: ConversationState = EMPTY_STATE): CompanionPlan {
  const text = (inputRaw ?? '').trim()

  // STEP 2 — emotional context (current). The sticky-context decision is made
  // AFTER task/online/continuity are known (a genuine task is a mood shift).
  const current = detectMood(text)
  const sticky = state.emotionalContext

  // STEP 3 — family context.
  const familyEntity = detectFamilyEntity(text)

  // STEP 4 — conversation history / continuity.
  const continuesTopic = CONT_TOPIC.test(text) || CONT_RECAP.test(text)
  const pronounRef = CONT_PRONOUN_F.test(text) || CONT_PRONOUN_M.test(text)
  const resolvedPerson = (pronounRef || continuesTopic) ? state.lastPerson : (familyEntity ?? null)

  // STEP 5 — calendar relevance.
  const calendar: CalRelevance =
    CAL_REMIND.test(text) ? 'remind'
    : CAL_CREATE.test(text) ? 'create'
    : CAL_READ.test(text) ? 'read'
    : 'none'

  // STEP 6 — online need.
  const onlineNeeded = ONLINE.test(text)

  // Sticky-emotion resolution: a lingering emotion (grief/worry) keeps coloring
  // the turn UNLESS the current turn is a genuine subject shift — a concrete
  // task, an online request, or continuing the prior topic with energy. Pure
  // chit-chat ("מה השעה?") does NOT clear it (anti mood-reset). A clear command
  // ("תקבעי לי רופא מחר") DOES — she has moved on this beat.
  const concreteShift = calendar !== 'none' || onlineNeeded || continuesTopic || pronounRef
  const emotion: Mood =
    current !== 'neutral' ? current
    : (sticky && sticky !== 'neutral' && !concreteShift ? sticky : 'neutral')

  // STEP 7 — frame + act (frame hierarchy + suppression).
  const negativeEmotion =
    emotion === 'grief' || emotion === 'worried' || emotion === 'frustrated' || emotion === 'lonely'
  const positiveEmotion = emotion === 'proud' || emotion === 'happy'

  let frame: Frame
  let act: Act
  let suppress: boolean
  let goal: string
  let reason: string

  if (negativeEmotion) {
    frame = 'emotion'
    suppress = true // skip family/calendar lookups even if a name/date appears
    if (emotion === 'grief') { act = 'listen'; goal = 'be accompanied in grief / remember Papi' }
    else if (emotion === 'lonely') { act = 'listen'; goal = 'company and presence' }
    else if (emotion === 'worried') { act = 'listen'; goal = 'be heard about a worry' }
    else { act = 'listen'; goal = 'vent / be validated' }
    reason = `negative emotion (${emotion}) dominates → EMOTION frame, suppress lookups, ${act}`
  } else if (positiveEmotion) {
    frame = 'emotion'
    suppress = false // may add a warm family detail after reflecting the joy
    act = 'encourage'
    goal = 'share joy / pride'
    reason = `positive emotion (${emotion}) → reflect & share joy`
  } else if (emotion === 'bored') {
    frame = 'companionship'
    suppress = true // do not data-dump; lead from memory
    act = 'lead'
    goal = 'engagement / something to do or talk about'
    reason = 'boredom → COMPANIONSHIP frame, lead from memory (never trivia)'
  } else if (continuesTopic || pronounRef) {
    frame = 'fact'
    suppress = false
    act = 'continue'
    goal = `continue the thread about ${resolvedPerson ?? 'the last topic'}`
    reason = 'continuity cue → continue last person/topic with a new facet'
  } else if (calendar !== 'none') {
    frame = 'task'
    suppress = false
    act = calendar === 'read' ? 'answer' : 'confirm'
    goal = calendar === 'read' ? 'orient / check the schedule' : 'schedule something reliably'
    reason = `calendar ${calendar} → TASK frame, ${act} (confirm+readback for writes)`
  } else if (onlineNeeded) {
    frame = 'fact'
    suppress = false
    act = 'answer'
    goal = 'know something about the world (grounded)'
    reason = 'online/current-info need → grounded answer or honest cannot-verify'
  } else if (familyEntity) {
    frame = 'fact'
    suppress = false
    act = 'answer'
    goal = `know / talk about ${familyEntity}`
    reason = 'family identity/relation question → grounded answer (concise vs rich by verb)'
  } else {
    // General / open-ended / casual.
    frame = 'fact'
    suppress = false
    act = text.length === 0 ? 'lead' : 'answer'
    goal = 'casual presence / general question'
    reason = 'no strong signal → answer briefly and keep her company'
  }

  return {
    step1_goal: goal,
    step2_emotion: emotion,
    step3_familyEntity: familyEntity,
    step4_continuity: { resolvedPerson, continuesTopic: continuesTopic || pronounRef },
    step5_calendar: calendar,
    step6_onlineNeeded: onlineNeeded,
    step7_frame: frame,
    step7_act: act,
    suppressLookups: suppress,
    reason,
  }
}

/** Update sticky conversation state after a turn (STEP "REMEMBER" helper). */
export function advanceState(prev: ConversationState, plan: CompanionPlan): ConversationState {
  const person = plan.step4_continuity.resolvedPerson ?? prev.lastPerson
  // Emotional context is sticky: set on emotion, cleared only by a positive
  // mood shift (happy) or an explicit neutral task once grief has passed.
  let emotionalContext = prev.emotionalContext
  if (plan.step7_frame === 'emotion' && plan.step2_emotion !== 'neutral') {
    emotionalContext = plan.step2_emotion
  } else if (plan.step2_emotion === 'happy') {
    emotionalContext = null
  }
  return {
    lastPerson: person,
    lastTopic: plan.step3_familyEntity ?? plan.step5_calendar !== 'none' ? (plan.step3_familyEntity ?? 'calendar') : prev.lastTopic,
    lastMood: plan.step2_emotion,
    emotionalContext,
    openLoops: prev.openLoops,
  }
}

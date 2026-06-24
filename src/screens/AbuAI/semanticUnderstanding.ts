/*
 * AI Semantic Understanding Layer
 * ═══════════════════════════════
 * Sits ABOVE the deterministic Meeting Intelligence Engine. The LLM understands
 * Martita like a human assistant would — fixing STT slips from context, reading
 * implied subjects/purpose — and returns STRICT JSON. The deterministic engine
 * remains the safety layer: it grounds date/time, refuses invention, and is the
 * full offline fallback when the LLM is unavailable or returns garbage.
 *
 *   transcript → LLM semantic understanding → deterministic grounding/validation
 *             → clarification if needed → confirmation card → save
 *
 * Hard guarantees enforced HERE, regardless of what the LLM says:
 *   • Deterministic date/time WINS on conflict (calendar-date integrity).
 *   • Never invent person / location / time — only accept an LLM value that is
 *     grounded in the transcript or in known family context.
 *   • confidence < 0.75 → ask one short clarification (never silent-save).
 *   • LLM unavailable / malformed JSON → deterministic result, calendar unblocked.
 *
 * The LLM runs through the existing server proxy (`/api/abuai-chat`) so the API
 * key never reaches the browser. `sendChat` is injectable for tests.
 */
import { sendServerChat, type ServerChatResult } from './serverChatProvider'
import { understandMeeting, type MeetingObject } from './meetingIntelligence'
import { loadGraph } from './familyGraph'
import type { CreateDraft, CalendarCreateState } from './calendarCreate'

export type MeetingIntent =
  | 'create_meeting' | 'ask_calendar' | 'reminder'
  | 'family_question' | 'general_chat' | 'unclear'

export interface SemanticCorrection {
  heard: string
  understoodAs: string
  reason: string
}

/** Strict shape the LLM must return (validated before use). */
export interface SemanticResult {
  intent: MeetingIntent
  understoodMeaning: string
  person: string | null
  date: string | null
  time: string | null
  location: string | null
  subject: string | null
  purpose: string | null
  notes: string | null
  missingCriticalFields: string[]
  needsClarification: boolean
  clarificationQuestion: string | null
  confidence: number
  corrections: SemanticCorrection[]
}

export interface SemanticContext {
  /** Current wall-clock — passed to the model so relative dates are anchored. */
  nowISO: string
  timezone?: string
  calendarSummary?: string
  familyNames?: string[]
  conversation?: Array<{ role: 'user' | 'assistant'; content: string }>
}

export interface MergedMeeting {
  intent: MeetingIntent
  draft: CreateDraft            // ready for the confirm card / save path
  meeting: MeetingObject        // the deterministic understanding (evidence)
  semantic: SemanticResult | null
  corrections: SemanticCorrection[]
  confidence: number
  needsClarification: boolean
  clarificationQuestion: string | null
  // ── telemetry ──
  semanticLayerUsed: boolean    // SEMANTIC_LAYER_USED
  fallbackReason: string | null // SEMANTIC_FALLBACK_REASON
}

const CONFIDENCE_FLOOR = 0.75

// ── 1. Prompt ───────────────────────────────────────────────────────────────
function buildMessages(raw: string, cleaned: string, ctx: SemanticContext) {
  const system = [
    'את עוזרת אישית שמבינה את Martita (בת 80+, עברית + ספרדית ריו-פלטנסה) כמו בן משפחה.',
    'המשימה: להבין את המשמעות של מה שאמרה — לא להעתיק מילים. תקני שגיאות תמלול לפי הקשר.',
    'החזירי אך ורק JSON תקין בדיוק לפי הסכימה. בלי טקסט נוסף, בלי הסברים מחוץ ל-JSON.',
    'לעולם אל תמציאי אדם, מקום או שעה שלא נאמרו. אם חסר שדה קריטי (אדם/תאריך/שעה) — needsClarification=true ושאלה אחת קצרה.',
    `עכשיו: ${ctx.nowISO}${ctx.timezone ? ` (${ctx.timezone})` : ''}.`,
    ctx.familyNames?.length ? `שמות משפחה מוכרים: ${ctx.familyNames.join(', ')}.` : '',
    ctx.calendarSummary ? `יומן נוכחי: ${ctx.calendarSummary}` : '',
    'סכימה: {intent, understoodMeaning, person, date, time, location, subject, purpose, notes, missingCriticalFields[], needsClarification, clarificationQuestion, confidence, corrections[{heard,understoodAs,reason}]}.',
    'intent ∈ create_meeting|ask_calendar|reminder|family_question|general_chat|unclear.',
  ].filter(Boolean).join('\n')

  const convo = (ctx.conversation ?? []).slice(-4)
    .map(m => `${m.role === 'user' ? 'Martita' : 'את'}: ${m.content}`).join('\n')

  const user = [
    convo ? `הקשר שיחה:\n${convo}\n` : '',
    `תמלול גולמי: "${raw}"`,
    `תמלול מנוקה: "${cleaned}"`,
    'הביני את הכוונה והחזירי JSON בלבד.',
  ].filter(Boolean).join('\n')

  return [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: user },
  ]
}

// ── 2. Strict validation of the LLM JSON ────────────────────────────────────
const INTENTS: MeetingIntent[] = ['create_meeting', 'ask_calendar', 'reminder', 'family_question', 'general_chat', 'unclear']

function asStringOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length ? t : null
}

/** Parse + strictly validate. Returns null on any malformed/under-spec output. */
export function parseSemanticJSON(content: string): SemanticResult | null {
  let obj: unknown
  try {
    // Tolerate a ```json fence if the model added one despite instructions.
    const cleaned = content.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
    obj = JSON.parse(cleaned)
  } catch {
    return null
  }
  if (!obj || typeof obj !== 'object') return null
  const o = obj as Record<string, unknown>

  const intent = INTENTS.includes(o.intent as MeetingIntent) ? (o.intent as MeetingIntent) : null
  if (!intent) return null
  if (typeof o.confidence !== 'number' || Number.isNaN(o.confidence)) return null

  const corrections: SemanticCorrection[] = Array.isArray(o.corrections)
    ? o.corrections.flatMap((c): SemanticCorrection[] => {
        if (!c || typeof c !== 'object') return []
        const cc = c as Record<string, unknown>
        const heard = asStringOrNull(cc.heard)
        const understoodAs = asStringOrNull(cc.understoodAs)
        if (!heard || !understoodAs) return []
        return [{ heard, understoodAs, reason: asStringOrNull(cc.reason) ?? 'context' }]
      })
    : []

  return {
    intent,
    understoodMeaning: asStringOrNull(o.understoodMeaning) ?? '',
    person: asStringOrNull(o.person),
    date: asStringOrNull(o.date),
    time: asStringOrNull(o.time),
    location: asStringOrNull(o.location),
    subject: asStringOrNull(o.subject),
    purpose: asStringOrNull(o.purpose),
    notes: asStringOrNull(o.notes),
    missingCriticalFields: Array.isArray(o.missingCriticalFields)
      ? o.missingCriticalFields.filter((x): x is string => typeof x === 'string')
      : [],
    needsClarification: o.needsClarification === true,
    clarificationQuestion: asStringOrNull(o.clarificationQuestion),
    confidence: Math.max(0, Math.min(1, o.confidence)),
    corrections,
  }
}

// ── 3. Grounding helpers (never invent) ─────────────────────────────────────
function isKnownFamily(name: string): boolean {
  try {
    const n = name.trim().toLowerCase()
    return loadGraph().some(g => g.hebrew === name.trim() || g.matchNames.includes(n))
  } catch { return false }
}

/** Accept an LLM string only if it is grounded in the transcript or family. */
function grounded(value: string | null, raw: string, allowFamily = false): string | null {
  if (!value) return null
  const v = value.trim()
  if (!v) return null
  // The whole value, or its salient first token, must appear in the transcript.
  if (raw.includes(v)) return v
  const head = v.split(/\s+/)[0]!
  if (head.length >= 2 && raw.includes(head)) return v
  if (allowFamily && isKnownFamily(v)) return v
  return null
}

// ── 4. Merge: LLM understanding + deterministic safety ──────────────────────
export function mergeUnderstanding(
  raw: string,
  det: MeetingObject,
  sem: SemanticResult | null,
  fallbackReason: string | null,
): MergedMeeting {
  // Person — never invent. Deterministic first; else a GROUNDED llm person.
  const person = det.who ?? grounded(sem?.person ?? null, raw, true)
  // Location — never invent. Deterministic first; else a GROUNDED llm location.
  const location = det.location ?? grounded(sem?.location ?? null, raw)
  // Date / time — DETERMINISTIC ALWAYS WINS (rule 10). Never take an LLM time.
  const date = det.date
  const time = det.time
  // Subject / purpose / notes — the human layer adds value here (STT fixes,
  // implied topics). Prefer the LLM understanding, fall back to deterministic.
  const subject = sem?.subject ?? det.subject
  const purpose = sem?.purpose ?? det.purpose
  const notes = sem?.notes ?? det.notes
  // Title — keep the clean deterministic synthesis; re-derive if a person was
  // recovered only via the LLM.
  const title = det.title ?? (person ? `פגישה עם ${person}` : null)

  const intent: MeetingIntent = sem?.intent ?? (person || subject ? 'create_meeting' : 'unclear')

  // Missing critical fields — recomputed deterministically (the ground truth).
  const missing: string[] = []
  if (!person) missing.push('person')
  if (!date) missing.push('date')
  if (!time) missing.push('time')

  // Confidence — the more cautious of the two views.
  const detConf = det.confidence
  const confidence = sem ? Math.min(sem.confidence, detConf) : detConf

  const needsClarification = missing.length > 0 || confidence < CONFIDENCE_FLOOR
  const clarificationQuestion = !needsClarification ? null
    : missing.includes('person') ? 'עם מי לקבוע?'
    : missing.includes('date') ? 'באיזה יום?'
    : missing.includes('time') ? (person ? `באיזו שעה לקבוע את הפגישה עם ${person}?` : 'באיזו שעה?')
    : (sem?.clarificationQuestion ?? det.clarificationQuestion ?? 'תוכלי לחזור על זה?')

  const draft: CreateDraft = {
    title,
    date,
    time,
    ambiguousTime: false,
    emoji: '📌',
    person,
    location,
    subject,
    purpose,
    notes,
    rawTranscript: raw,
    cleanedTranscript: det.cleanedTranscript,
    confidence,
  }

  return {
    intent,
    draft,
    meeting: det,
    semantic: sem,
    corrections: sem?.corrections ?? [],
    confidence,
    needsClarification,
    clarificationQuestion,
    semanticLayerUsed: !!sem,
    fallbackReason,
  }
}

// ── 5. Public entry ─────────────────────────────────────────────────────────
export interface UnderstandOptions {
  /** Injectable for tests; defaults to the real server proxy. */
  sendChat?: (body: Record<string, unknown>, opts?: { signal?: AbortSignal; timeoutMs?: number }) => Promise<ServerChatResult>
  signal?: AbortSignal
  timeoutMs?: number
  model?: string
}

/**
 * Map a merged understanding to the calendar-create state machine shape so the
 * existing confirm card + save path consume it unchanged. A meeting that still
 * needs clarification stays in `creating`; a complete one goes to `confirming`.
 */
export function mergedToCreateState(merged: MergedMeeting): CalendarCreateState {
  const missing: Array<'title' | 'date' | 'time'> = []
  if (!merged.draft.title) missing.push('title')
  if (!merged.draft.date) missing.push('date')
  if (!merged.draft.time) missing.push('time')
  const phase = merged.needsClarification || missing.length > 0 ? 'creating' : 'confirming'
  return { phase, draft: merged.draft, missing }
}

function extractContent(res: ServerChatResult): string | null {
  if (!res.ok) return null
  const openai = res.openai as { choices?: Array<{ message?: { content?: string } }> } | undefined
  return openai?.choices?.[0]?.message?.content ?? null
}

/**
 * Understand a raw transcript with the LLM semantic layer, then ground + merge
 * with the deterministic engine. Always resolves (never throws); on any LLM
 * problem it returns the deterministic understanding with a fallbackReason.
 */
export async function understandMeetingSemantic(
  raw: string,
  ctx: SemanticContext,
  opts: UnderstandOptions = {},
): Promise<MergedMeeting> {
  // Deterministic engine ALWAYS runs first — the safety net + cleaned transcript.
  const det = understandMeeting(raw)
  const cleaned = det.cleanedTranscript

  const send = opts.sendChat ?? ((body, o) => sendServerChat(body, o ?? {}))
  const sendOpts: { signal?: AbortSignal; timeoutMs?: number } = { timeoutMs: opts.timeoutMs ?? 12_000 }
  if (opts.signal) sendOpts.signal = opts.signal

  let sem: SemanticResult | null = null
  let fallbackReason: string | null = null
  try {
    const res = await send(
      {
        model: opts.model ?? 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: buildMessages(raw, cleaned, ctx),
      },
      sendOpts,
    )
    if (!res.ok) {
      fallbackReason = res.errorCode
    } else {
      const content = extractContent(res)
      if (!content) {
        fallbackReason = 'empty_llm_response'
      } else {
        sem = parseSemanticJSON(content)
        if (!sem) fallbackReason = 'malformed_json'
      }
    }
  } catch (err) {
    fallbackReason = err instanceof Error ? `llm_exception:${err.message}` : 'llm_exception'
  }

  const merged = mergeUnderstanding(raw, det, sem, fallbackReason)

  // ── Telemetry (device-debuggable) ──
  try {
    // eslint-disable-next-line no-console
    console.log(
      `[AbuAI][SEMANTIC] SEMANTIC_LAYER_USED=${merged.semanticLayerUsed} ` +
      `SEMANTIC_CONFIDENCE=${merged.confidence} ` +
      `SEMANTIC_CORRECTIONS=${merged.corrections.length} ` +
      `SEMANTIC_FALLBACK_REASON=${merged.fallbackReason ?? 'none'}`,
    )
  } catch { /* logging must never break the flow */ }

  return merged
}

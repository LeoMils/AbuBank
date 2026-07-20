/*
 * UNDERSTANDING-FIRST INTAKE (intake-rebuild P1).
 * ════════════════════════════════════════════════════════════════════════════
 * The intake becomes understanding-first: a user turn is interpreted into a
 * STRUCTURED INTENT, THEN grounded/validated by the existing deterministic
 * engines (family graph resolves persons; the date engine validates times; THE
 * LAWS gate writes). Patterns stay ONLY as a fast-path cache in FRONT of this,
 * never as the gate (see `shouldInterpret`).
 *
 * This module has two halves with DIFFERENT evidence classes — labelled honestly:
 *   • interpret()  — the LLM half. Transport is INJECTED, so the parsing/validation
 *                    and dictation-corruption tolerance are MOCK-provable here; the
 *                    real provider call + latency is PREVIEW-class and NOT proven in
 *                    unit tests.
 *   • groundIntent() — the deterministic half. PURE; resolves the structured intent
 *                    through the real engines. Fully CODE-provable.
 *
 * NOTE: this layer is built + covered by tests but is NOT yet wired as the live
 * gate in runCognitiveTurn (that is an async change to a sync hot path — a
 * separate, careful step with real-latency PREVIEW evidence). No overclaim.
 */
import { parseCreateDate, parseHebrewTimeDetailed } from './calendarCreate'
import { resolveSinglePerson } from './familyReasoning'
import { findNode } from './familyGraph'
import { sendServerChat } from './serverChatProvider'

// ─── The strict structured intent (the schema the interpreter must return) ───

export type IntentOperation =
  | 'calendar_create' | 'calendar_read' | 'calendar_search' | 'calendar_edit' | 'calendar_delete'
  | 'family_query' | 'remember_fact' | 'online_query' | 'chat' | 'unknown'

export interface StructuredIntent {
  operation: IntentOperation
  /** Person references in ANY morphological form — relation phrases ("בת הזוג של
   *  מור", "החתן של רפי") OR plain names. Grounded later via the ONE seam. */
  personRefs: string[]
  /** Raw date/time WORDS as spoken ("מחר", "בשלוש וחצי") — validated by the date engine. */
  dateWords: string | null
  timeWords: string | null
  place: string | null
  /** Title derived from MEANING, not surface text (e.g. "פגישה עם הרופא"). */
  title: string | null
  /** A fact to remember, if the turn states one. */
  fact: { kind: string; value: string } | null
  /** An explicit correction to a pending item ("לא, בארבע"). */
  correction: string | null
  /** A yes/no confirmation, if the turn is one. */
  confirmation: 'yes' | 'no' | null
  /** Set ONLY when the turn is genuinely ambiguous — carries the ONE question to ask. */
  ambiguousQuestion: string | null
}

/** JSON Schema handed to the model so the interpretation is strict + parseable. */
export const STRUCTURED_INTENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['operation', 'personRefs', 'dateWords', 'timeWords', 'place', 'title', 'fact', 'correction', 'confirmation', 'ambiguousQuestion'],
  properties: {
    operation: { type: 'string', enum: ['calendar_create', 'calendar_read', 'calendar_search', 'calendar_edit', 'calendar_delete', 'family_query', 'remember_fact', 'online_query', 'chat', 'unknown'] },
    personRefs: { type: 'array', items: { type: 'string' } },
    dateWords: { type: ['string', 'null'] },
    timeWords: { type: ['string', 'null'] },
    place: { type: ['string', 'null'] },
    title: { type: ['string', 'null'] },
    fact: { type: ['object', 'null'], additionalProperties: false, required: ['kind', 'value'], properties: { kind: { type: 'string' }, value: { type: 'string' } } },
    correction: { type: ['string', 'null'] },
    confirmation: { type: ['string', 'null'], enum: ['yes', 'no', null] },
    ambiguousQuestion: { type: ['string', 'null'] },
  },
} as const

const OPERATIONS: IntentOperation[] = ['calendar_create', 'calendar_read', 'calendar_search', 'calendar_edit', 'calendar_delete', 'family_query', 'remember_fact', 'online_query', 'chat', 'unknown']

/** Coerce ARBITRARY (possibly malformed) model JSON into a safe StructuredIntent.
 *  Never throws — an unparseable/invalid payload degrades to operation:'unknown'
 *  so the caller falls back, it never fabricates fields. */
export function normalizeIntent(raw: unknown): StructuredIntent {
  const o = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
  const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const op = OPERATIONS.includes(o.operation as IntentOperation) ? o.operation as IntentOperation : 'unknown'
  const personRefs = Array.isArray(o.personRefs) ? o.personRefs.filter((x): x is string => typeof x === 'string' && !!x.trim()).map((s) => s.trim()) : []
  const factO = (o.fact && typeof o.fact === 'object') ? o.fact as Record<string, unknown> : null
  const fact = factO && str(factO.kind) && str(factO.value) ? { kind: str(factO.kind)!, value: str(factO.value)! } : null
  const conf = o.confirmation === 'yes' || o.confirmation === 'no' ? o.confirmation : null
  return {
    operation: op,
    personRefs,
    dateWords: str(o.dateWords),
    timeWords: str(o.timeWords),
    place: str(o.place),
    title: str(o.title),
    fact,
    correction: str(o.correction),
    confirmation: conf,
    ambiguousQuestion: str(o.ambiguousQuestion),
  }
}

// ─── The LLM half (injected transport → MOCK-provable) ───────────────────────

/** Injected so the network never runs in unit tests. Returns the model's raw
 *  structured-intent JSON object (already extracted from the provider envelope). */
export type InterpretTransport = (text: string, schema: typeof STRUCTURED_INTENT_SCHEMA) => Promise<unknown>

/**
 * Interpret a turn into a StructuredIntent via the injected transport. The
 * transport is expected to recover intended MEANING from dictation corruption;
 * this function only guarantees a safe, validated shape (or operation:'unknown'
 * when the transport fails).
 */
export async function interpretUtterance(text: string, transport: InterpretTransport): Promise<StructuredIntent> {
  try {
    const raw = await transport(text, STRUCTURED_INTENT_SCHEMA)
    return normalizeIntent(raw)
  } catch {
    return normalizeIntent(null) // operation:'unknown' → caller falls back
  }
}

const INTERPRET_SYSTEM = [
  'את/ה שכבת הבנה. קלט: משפט של משתמשת מבוגרת בעברית (לפעמים תעתיק דיבור משובש).',
  'החזר/י אך ורק JSON תקין לפי הסכימה — בלי טקסט חופשי.',
  'שחזר/י את המשמעות המכוונת גם אם התעתיק משובש. אם באמת דו-משמעי — מלא/י ambiguousQuestion בשאלה אחת.',
  'personRefs: השאר/י ביטויי-קרבה כפי שנאמרו ("החתן של מור", "בת הזוג של מור") או שמות — אל תמציא/י אנשים.',
  'dateWords/timeWords: מילות התאריך/שעה כפי שנאמרו ("מחר", "בשלוש וחצי") — אל תמיר/י לפורמט.',
].join(' ')

/**
 * The REAL transport (posts to /api/abuai-chat via sendServerChat with a strict
 * json_schema). PREVIEW-class: the request-building + response-extraction are
 * unit-tested with an injected fetch, but the live provider behavior + latency
 * are proven only on a deploy. `fetchImpl` is injected for tests.
 */
export function makeInterpretTransport(opts?: { model?: string; fetchImpl?: typeof fetch }): InterpretTransport {
  const model = opts?.model ?? 'gpt-4o-mini'
  return async (text) => {
    const res = await sendServerChat({
      model,
      temperature: 0,
      messages: [{ role: 'system', content: INTERPRET_SYSTEM }, { role: 'user', content: text }],
      response_format: { type: 'json_schema', json_schema: { name: 'structured_intent', strict: true, schema: STRUCTURED_INTENT_SCHEMA } },
    }, { lang: 'he', ...(opts?.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}) })
    if (!res.ok) throw new Error(res.errorCode)
    const content = (res as { openai?: { choices?: Array<{ message?: { content?: unknown } }> } }).openai?.choices?.[0]?.message?.content
    if (typeof content !== 'string') throw new Error('no_content')
    return JSON.parse(content) as unknown
  }
}

/** Render a grounded intent as a VERIFIED-facts line to prepend to the LLM
 *  grounding on a pattern miss — so the model uses real, graph-resolved people
 *  and engine-parsed dates instead of hallucinating them. Null when nothing
 *  deterministic was resolved. Never includes unresolved refs. */
export function groundingLine(g: GroundedIntent): string | null {
  const parts: string[] = []
  if (g.people.length) parts.push(`אנשים: ${g.people.join(', ')}`)
  if (g.date) parts.push(`תאריך: ${g.date}`)
  if (g.time) parts.push(`שעה: ${g.time}`)
  if (g.place) parts.push(`מקום: ${g.place}`)
  return parts.length ? `מידע מאומת מהמערכת (השתמש/י בו, אל תמציא/י): ${parts.join(' · ')}` : null
}

// ─── The deterministic half (PURE → CODE-provable) ───────────────────────────

export interface GroundedIntent {
  operation: IntentOperation
  /** Resolved real family members (relation phrases + names → canonical Hebrew names). */
  people: string[]
  /** Person refs that could not be resolved to a known person (kept, never invented). */
  unresolvedRefs: string[]
  date: string | null       // YYYY-MM-DD (from the date engine)
  time: string | null       // HH:MM
  timeAmbiguous: boolean
  place: string | null
  title: string | null
  fact: { kind: string; value: string } | null
  correction: string | null
  confirmation: 'yes' | 'no' | null
  /** The ONE question to ask, if the turn is genuinely ambiguous. */
  ask: string | null
}

/** Resolve a single person reference (relation phrase OR name) to a real name. */
function resolveRef(ref: string): string | null {
  const rel = resolveSinglePerson(ref)
  if (rel) return rel.person
  const node = findNode(ref)
  return node ? node.hebrew : null
}

/**
 * Ground a StructuredIntent through the deterministic engines: resolve person
 * references via the ONE seam, validate date/time via the date engine. Never
 * invents — an unresolvable person stays in `unresolvedRefs`, an unparseable
 * date/time stays null.
 */
export function groundIntent(si: StructuredIntent): GroundedIntent {
  const people: string[] = []
  const unresolvedRefs: string[] = []
  for (const ref of si.personRefs) {
    const r = resolveRef(ref)
    if (r) { if (!people.includes(r)) people.push(r) }
    else unresolvedRefs.push(ref)
  }
  const date = si.dateWords ? parseCreateDate(si.dateWords) : null
  const tp = si.timeWords ? parseHebrewTimeDetailed(si.timeWords) : { time: null, ambiguous: false }
  return {
    operation: si.operation,
    people,
    unresolvedRefs,
    date,
    time: tp.time,
    timeAmbiguous: tp.ambiguous,
    place: si.place,
    title: si.title,
    fact: si.fact,
    correction: si.correction,
    confirmation: si.confirmation,
    ask: si.ambiguousQuestion,
  }
}

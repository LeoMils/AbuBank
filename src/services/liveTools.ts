/*
 * liveTools.ts — Abu AI, Milestone 2/3: the ONE live-path tool executor.
 * ════════════════════════════════════════════════════════════════════════════
 * The single seam between a completed Realtime function-call and product truth for
 * the isolated live path. It owns NO natural language, NO conversation state, and
 * NO routing — the Realtime model holds the conversation. This module only:
 *
 *   • resolve_contact  → deterministic id | AMBIGUOUS | NOT_FOUND (liveContacts)
 *   • calendar         → prepare draft / correct one field / confirm / cancel / read,
 *                        reusing the typed draft kernel (realtime/calendarDraft) and
 *                        committing a CONFIRMED draft to the durable calendar store so
 *                        it is immediately readable (read-after-write)
 *   • whatsapp / call  → PREPARE / correct / cancel only. Nothing sends or dials;
 *                        Abu never claims an action happened.
 *
 * EXACTLY-ONCE: every completed call is deduped by the model's call id, AND a
 * CONFIRMED calendar draft commits at most one event no matter how many confirm
 * calls arrive (retries, duplicate shapes, reordered completions never double it).
 *
 * PRIVACY BY CONSTRUCTION: no function_call_output ever contains a phone number —
 * recipients are ids/labels, resolved to numbers only outside the model, at the
 * moment Martita herself presses send/dial (not in M2).
 */
import {
  applyCalendarFunctionCall, isCalendarTool,
  type CalendarDraft, type CalendarReceipt,
} from '../screens/AbuAI/realtime/calendarDraft'
import { resolveCalendarParticipant, resolveContact, contactLabel, isDeceasedContact } from './liveContacts'
import { whoIs, relationshipBetween, relativesByKind, resolveContactTarget } from './people/peopleLookup'
import type { KinKind } from './people/kinship'
import { historyLookup } from './history/historyLookup'
import type { ParsedFunctionCall } from '../screens/AbuAI/realtime/realtimeFunctionBridge'
import { loadAppointments, saveAppointments, updateAppointment, detectEmoji, type Appointment } from '../screens/AbuCalendar/service'
import { classifyCareRisk, safeCareResponse, careAllowedToSay, type CareLang } from './careGuard'
import { saveMemory, loadMemories, sensitiveKind, type SensitiveKind } from '../screens/AbuAI/savedMemory'

export type SendEvent = (event: Record<string, unknown>) => void

/** The calendar event shape the live path reads and writes. Carries every field the
 *  prepare_calendar_event tool accepts, so a created event round-trips losslessly
 *  (title/date/time/participant/location/notes) through persist → read → update. */
export interface LiveEvent {
  id: string
  title: string
  date: string        // YYYY-MM-DD
  time: string        // HH:MM or ''
  participant?: string
  location?: string
  notes?: string
}

/** Persistence seam — production wires this to the durable calendar store
 *  (AbuCalendar/service.ts); tests inject an in-memory implementation so
 *  read-after-write is provable without a browser. */
export interface LiveCalendarStore {
  list(): LiveEvent[]
  /** Persist and RETURN the stored event (with id), or null if it did not persist. */
  add(e: Omit<LiveEvent, 'id'>): LiveEvent | null
  /** Patch an EXISTING event in place and RETURN the updated event, or null if the id
   *  is unknown / the write did not persist. Used by update_calendar_event so a saved
   *  event is corrected without creating a duplicate. */
  update(id: string, patch: Partial<Omit<LiveEvent, 'id'>>): LiveEvent | null
}

export interface LiveCommDraft {
  kind: 'message' | 'call'
  recipientId: string | null
  recipientLabel: string | null
  intent: string | null
  status: 'READY_TO_SEND' | 'READY_TO_CALL' | 'CANCELLED'
}

export interface LiveToolsCallbacks {
  onCalendarDraft?: (d: CalendarDraft | null) => void
  /** Fires with the event AS ACTUALLY PERSISTED, so the overlay can render a
   *  receipt card showing the saved fields (not just what was drafted). */
  onCalendarSaved?: (e: LiveEvent) => void
  onCommDraft?: (d: LiveCommDraft | null) => void
  /** FIX 5: a tool did not return normally — it threw, or an async tool timed out. The
   *  executor still sends an honest fallback output (never hangs); this logs WHICH call
   *  and WHY so a non-returning tool is visible in the trace, not a silent wait. */
  onToolIssue?: (name: string, reason: 'error' | 'timeout') => void
}

/** The tools the live model may request. Kept minimal and precise for this path
 *  (isolated from the legacy ADR schema set). No parameter is or contains a phone
 *  number: recipients/participants are names, resolved locally. */
export const LIVE_TOOL_SCHEMAS = [
  {
    type: 'function', name: 'resolve_contact',
    description: 'Resolve a person named as spoken to a contact id BEFORE messaging or calling them. Returns resolved (with an id), ambiguous (a relationship like "אח של מור", or several people — ask which one), or not_found. Never returns a phone number.',
    parameters: { type: 'object', properties: { name: { type: 'string', description: 'The person as Martita said it (e.g. "מור").' } }, required: ['name'], additionalProperties: false },
  },
  {
    type: 'function', name: 'read_calendar',
    description: "Read Martita's real calendar. For ONE day pass date. For a WINDOW — 'this week', 'this month', 'the next few days' — pass from AND to (inclusive real dates) so you get EVERY event in the range, not just one day. Omit all three for everything. Use this for any 'what do I have' / 'when is…' question — never answer calendar questions from memory or the web.",
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'A single real date YYYY-MM-DD (already resolved, never "מחר").' },
        from: { type: 'string', description: 'Start of a date RANGE, YYYY-MM-DD (already resolved). Use WITH to for "this week"/"this month".' },
        to: { type: 'string', description: 'End of the date RANGE, INCLUSIVE, YYYY-MM-DD (already resolved).' },
      },
      required: [], additionalProperties: false,
    },
  },
  {
    type: 'function', name: 'prepare_calendar_event',
    description: 'Prepare (do NOT save) a calendar event draft to read back to Martita. Never claim it is saved until confirm_calendar_event succeeds.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'What the event is (e.g. "פגישה עם מור").' },
        date: { type: 'string', description: 'A REAL date YYYY-MM-DD (already resolved — never "מחר").' },
        time: { type: 'string', description: 'HH:MM 24h, optional.' },
        participant: { type: 'string', description: 'Who is coming, as spoken — optional. May be SEVERAL people ("מור ואופיר", "מור, אופיר ורבקה"); a name does NOT have to be a saved contact (an ordinary spoken name is written on the event as-is). Only a relationship phrase ("אח של מור") is NOT accepted — resolve it with Martita to a name first.' },
        location: { type: 'string', description: 'Optional location.' },
        notes: { type: 'string', description: 'Optional notes.' },
      },
      required: ['title', 'date'], additionalProperties: false,
    },
  },
  {
    type: 'function', name: 'correct_calendar_field',
    description: 'Correct ONE field of the pending calendar draft (e.g. the time). Every other field is preserved.',
    parameters: {
      type: 'object',
      properties: {
        field: { type: 'string', description: 'Which field to correct.', enum: ['title', 'date', 'time', 'location', 'notes'] },
        value: { type: 'string', description: 'The new value for that field.' },
        participant: { type: 'string', description: 'Optional: RESTATE who is coming (one or several names, contacts or not) instead of a scalar field.' },
      },
      required: [], additionalProperties: false,
    },
  },
  {
    type: 'function', name: 'confirm_calendar_event',
    description: 'Save the pending calendar draft after Martita confirms it, at the revision she just heard.',
    parameters: { type: 'object', properties: { forRevision: { type: 'number', description: 'The draft revision Martita is confirming.' } }, required: ['forRevision'], additionalProperties: false },
  },
  {
    type: 'function', name: 'cancel_calendar_event',
    description: 'Cancel the pending calendar draft (Martita no longer wants the event).',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    type: 'function', name: 'update_calendar_event',
    description: 'Change ONE field of an ALREADY-SAVED calendar event, IN PLACE (never a new event). Use this — NOT prepare_calendar_event — when Martita wants to change something (time, place, title…) about an event already in the calendar. Identify the event by its real date; add a word from the title if several events share that date. Every other field is preserved.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'The saved event\'s date, a REAL YYYY-MM-DD (already resolved — never "מחר").' },
        field: { type: 'string', description: 'Which field to change.', enum: ['title', 'date', 'time', 'location', 'notes', 'participant'] },
        value: { type: 'string', description: 'The new value for that field (for date: a real YYYY-MM-DD).' },
        title_contains: { type: 'string', description: 'Optional word from the title, to pick the right event when several are on that date.' },
      },
      required: ['date', 'field', 'value'], additionalProperties: false,
    },
  },
  {
    type: 'function', name: 'whatsapp_draft',
    description: 'Compose a WhatsApp message and show Martita a CARD with the recipient and the FULL message text and a Send button. It does NOT send — only her tap on the card sends it. Pass the recipient as a NAME (resolved to a contact locally) and the full message you composed. Never claim the message was sent; tell her the card is ready and to tap Send.',
    parameters: { type: 'object', properties: { recipient: { type: 'string', description: 'The contact NAME (e.g. "מור"). Never a number.' }, message: { type: 'string', description: 'The FULL message text you composed, in Martita\'s voice, ready to send.' } }, required: ['recipient', 'message'], additionalProperties: false },
  },
  {
    type: 'function', name: 'phone_call',
    description: 'Show Martita a CARD with a contact\'s name and number and a Call button. It does NOT dial — only her tap on the card places the call. Pass the recipient as a NAME (resolved locally). Never claim a call was placed; tell her the card is ready and to tap Call.',
    parameters: { type: 'object', properties: { recipient: { type: 'string', description: 'The contact NAME. Never a number.' } }, required: ['recipient'], additionalProperties: false },
  },
  {
    type: 'function', name: 'cancel_communication',
    description: 'Cancel the pending WhatsApp/call preparation (Martita changed her mind).',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    type: 'function', name: 'get_current_info',
    description: "Get CURRENT, live information from the web — today's news, the weather right now, sports results, prices, what is open or on now. Use this for anything time-sensitive or 'today/now/latest'. Speak ONLY what it returns and mention the source; if it has no result, say plainly you could not check. NEVER answer a current fact from memory. Do NOT use this for family, the calendar, or stable knowledge.",
    parameters: { type: 'object', properties: { query: { type: 'string', description: 'The current-info question, in the language Martita asked.' } }, required: ['query'], additionalProperties: false },
  },
  {
    type: 'function', name: 'people_lookup',
    description: "The ONE tool for family/people questions, all derived from the canonical people store. want='who' → who a person is and how they relate to Martita; want='relationship' → the Hebrew relationship between `person` and `other`; want='relatives' → `person`'s relatives of a `relation` kind; want='contact' → resolve a person named DIRECTLY or BY RELATIONSHIP (e.g. \"הנכד שלי\") to an id+label for the UI to call/message. Never invents a relationship; unknown stays unknown. Never returns a phone number.",
    parameters: {
      type: 'object',
      properties: {
        want: { type: 'string', enum: ['who', 'relationship', 'relatives', 'contact'], description: 'What to look up.' },
        person: { type: 'string', description: 'The person as spoken (a name, or a relationship phrase like "הבת שלי" for want=contact).' },
        other: { type: 'string', description: 'For want=relationship: the second person.' },
        relation: { type: 'string', description: 'For want=relatives: the kind (child, sibling, grandchild, uncle_aunt, cousin, …).' },
      },
      required: ['want', 'person'], additionalProperties: false,
    },
  },
  {
    type: 'function', name: 'history_lookup',
    description: "The ONE tool for Martita's LIFE HISTORY and PLACES — her childhood in Buenos Aires, the years in Mendoza and the family store (Casa Milstein), the aliyah in 1977, the Ulpan Ben Yehuda in Netanya, the Bat Yam years, the shop and work. Pass the topic as she said it (\"מנדוסה\", \"איך עליתם ארצה\", \"החנות\", \"הילדות שלך\", \"ארגנטינה\"). Returns grounded summaries only, or not_found. Speak ONLY what it returns; never invent a memory, place, or date. This is NOT for the calendar, current news, or who-someone-is (that is people_lookup).",
    parameters: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'The life-history topic or place as Martita said it (e.g. "מנדוסה", "העלייה", "החנות", "הילדות").' },
      },
      required: ['topic'], additionalProperties: false,
    },
  },
  {
    // NO_HARM (careGuard): the model MUST call this for ANY health/symptom, medication
    // dose, physical-safety, or money/account question. It returns a locked safe answer
    // that points Martita to a real person — never advice. Not a price question.
    type: 'function', name: 'care_concern',
    description: 'Call this for ANY question about a health symptom or how she feels physically, a medication or dose, a physical-safety emergency (a fall, cannot breathe, gas/fire), or moving money / a bank account / a password. Do NOT answer these yourself. Not for a price question ("how much does X cost"). Pass her words as the query.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'What Martita said, verbatim.' } },
      required: ['query'], additionalProperties: false,
    },
  },
  {
    // PERSISTENT MEMORY (savedMemory): call this when Martita tells you to remember,
    // update, note, or correct a durable fact about her life or family (a death, a new
    // family member, a corrected relationship). It is saved across sessions. NEVER tell
    // her you cannot update or change anything — that is exactly what this tool is for.
    type: 'function', name: 'remember',
    description: 'Save a durable fact Martita asked you to remember/update/note/correct about her life or family (a death, a new family member, a corrected relationship). Persists across sessions. Call it whenever she says תעדכני / תזכרי ש / תוסיפי / recordá que. Pass the fact as one short sentence.',
    parameters: {
      type: 'object',
      properties: { fact: { type: 'string', description: 'The fact to remember, one short sentence (e.g. "כאצ׳ו נפטר").' } },
      required: ['fact'], additionalProperties: false,
    },
  },
] as const

export const LIVE_TOOL_NAMES: string[] = LIVE_TOOL_SCHEMAS.map((t) => t.name)
const COMM_TOOLS = new Set(['whatsapp_draft', 'phone_call', 'cancel_communication'])
const ONLINE_TOOL = 'get_current_info'
/** FIX 5: an async tool (the online round-trip) that does not answer within this budget is
 *  cut off with an honest "could not check" fallback — Martita never waits on a silent hang. */
export const LIVE_TOOL_TIMEOUT_MS = 8000
/** Sentinel resolved by the timeout race when the tool did not answer in time. */
const TOOL_TIMEOUT = Symbol('tool_timeout')

/** Non-secret endpoint diagnostic (mirror of api/abuai-online OnlineDiag). Provider
 *  name + booleans + counts only — NEVER a key. Logged so a device trace shows WHY
 *  online failed (misconfig vs genuinely-empty search must never look the same). */
export interface OnlineDiag { requested: string; provider: string; providerKeyPresent: boolean; openaiKeyPresent: boolean; reached: boolean; sourceCount: number; outcome: string }
/** The grounded online result the live tool speaks from (server-side endpoint shape). */
export interface OnlineAnswer { ok: boolean; answer?: string; sources?: Array<{ title?: string; url?: string }>; userMessage?: string; diag?: OnlineDiag }
/** Injected online seam — real one POSTs to the server endpoint; tests inject a fake. */
export type OnlineFetch = (query: string) => Promise<OnlineAnswer>

/** Last online diagnostic seen by the live path — read by operator diagnostics. */
let _lastLiveOnlineDiag: OnlineDiag | null = null
export function lastLiveOnlineDiag(): OnlineDiag | null { return _lastLiveOnlineDiag }

/** Default seam: POST the query to the server-side GROUNDED endpoint (holds the key,
 *  applies the no-sources honesty gate). A thrown/failed call becomes an honest miss.
 *  The endpoint's non-secret `diag` is logged + retained so a misconfigured provider
 *  is never again indistinguishable from a search that genuinely found nothing. */
export function defaultOnlineFetch(): OnlineFetch {
  return async (query) => {
    try {
      const res = await fetch('/api/abuai-online', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, lang: 'he' }) })
      const j = (await res.json()) as OnlineAnswer
      if (j.diag) { _lastLiveOnlineDiag = j.diag; try { console.info('[abuai-online-diag]', JSON.stringify(j.diag)) } catch { /* */ } }
      return j
    } catch { return { ok: false, userMessage: 'לא הצלחתי לבדוק מידע עדכני כרגע.' } }
  }
}

function str(a: Record<string, unknown>, k: string): string | undefined {
  return typeof a[k] === 'string' && (a[k] as string).trim() ? (a[k] as string).trim() : undefined
}

/** Remove anything the model could cite as a source from the online answer BEFORE it
 *  reaches the model: markdown links (keep the link text), bare URLs, and any
 *  "source:/מקור:" trailer. The model can only speak what it is given, so stripping
 *  the machinery here makes source-citing structurally harder than an instruction alone. */
export function scrubForSpeech(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\((?:https?:)?\/\/[^)]*\)/g, '$1')          // [t](url) → t
    .replace(/https?:\/\/\S+/gi, '')                                   // bare URLs
    .replace(/\bwww\.[^\s)]+/gi, '')                                   // bare www.
    .replace(/(?:\n|^)\s*(?:מקור|מקורות|source|sources)\s*:.*$/gim, '') // "source:" trailers
    // bare domain tokens in prose (e.g. "Seret.co.il", "ynet.co.il") — a source name
    // the model could read aloud. Common TLDs only, to avoid touching ordinary words.
    .replace(/[-\w]+\.(?:co\.il|org\.il|gov\.il|ac\.il|com|net|org|io|ai|co|tv)\b/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+[ו]?-?(?=[.,!?])/g, '')                              // drop a connector (" ו-") left dangling before punctuation
    .replace(/\s+([.,!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export class LiveTools {
  private draft: CalendarDraft | null = null
  private comm: LiveCommDraft | null = null
  private careTurn = 0                                     // rotates care wording (issue iii)
  private committedApptId: string | null = null           // exactly-once commit guard
  private readonly handled = new Map<string, string>()      // call id → output JSON (dedup)
  private readonly inFlight = new Set<string>()

  constructor(
    private readonly send: SendEvent,
    private readonly store: LiveCalendarStore,
    private readonly cb: LiveToolsCallbacks = {},
    private readonly onlineFetch: OnlineFetch = defaultOnlineFetch(),
    private readonly toolTimeoutMs: number = LIVE_TOOL_TIMEOUT_MS,
  ) {}

  /** Race a tool promise against the timeout budget; resolves to TOOL_TIMEOUT if it is slow.
   *  The timer is cleared when the tool wins, so a fast tool leaves no pending timeout. */
  private async withTimeout<T>(p: Promise<T>): Promise<T | typeof TOOL_TIMEOUT> {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<typeof TOOL_TIMEOUT>((resolve) => { timer = setTimeout(() => resolve(TOOL_TIMEOUT), this.toolTimeoutMs) })
    try { return await Promise.race([p, timeout]) } finally { if (timer) clearTimeout(timer) }
  }

  /** True for every tool this executor owns (everything except wait_for_user). */
  static owns(name: string): boolean { return LIVE_TOOL_NAMES.includes(name) }

  /** Handle a completed function-call EXACTLY ONCE. Sends the safe function_call_output
   *  and a response.create so the model speaks the grounded result. A duplicate of the
   *  same call id (a second completion shape, a retry) is a strict no-op — never a second
   *  output, never a second event. */
  handleFunctionCall(fc: ParsedFunctionCall): void {
    if (this.handled.has(fc.callId)) return                              // completed duplicate → no-op
    if (this.inFlight.has(fc.callId)) return                             // in-flight duplicate → drop
    this.inFlight.add(fc.callId)
    // get_current_info is ASYNC (a server round-trip): it keeps the callId in-flight
    // and replies when the grounded result returns. Every other tool is sync + local.
    if (fc.name === ONLINE_TOOL) { void this.handleOnline(fc); return }
    try {
      const output = this.dispatch(fc)
      const json = JSON.stringify(output)
      this.handled.set(fc.callId, json)
      this.reply(fc.callId, json)
    } catch {
      // FIX 5: a sync tool threw. Previously there was no catch, so reply() never fired and
      // the model waited forever for a result — the "people_lookup fired, no result arrived,
      // both sides waited" hang. Always send an honest fallback output so the turn completes.
      this.cb.onToolIssue?.(fc.name, 'error')
      const json = JSON.stringify({ status: 'error', allowed_to_say: ['say plainly and warmly that you could not do that just now', 'do NOT claim it worked'] })
      this.handled.set(fc.callId, json)
      this.reply(fc.callId, json)
    } finally {
      this.inFlight.delete(fc.callId)
    }
  }

  /** get_current_info: fetch a GROUNDED answer from the server endpoint and let the
   *  model speak ONLY that (with its source). No verified result ⇒ an honest "could
   *  not check" — NEVER a current fact from memory. Deduped like every other tool. */
  private async handleOnline(fc: ParsedFunctionCall): Promise<void> {
    try {
      const query = str(safeArgs(fc.argsJson), 'query') ?? ''
      const raced = await this.withTimeout(this.onlineFetch(query))
      if (raced === TOOL_TIMEOUT) {
        // FIX 5: the online round-trip did not answer in time — cut it off with an honest miss
        // instead of leaving the model (and Martita) waiting on a silent hang. Logged.
        this.cb.onToolIssue?.(ONLINE_TOOL, 'timeout')
        const json = JSON.stringify({ status: 'no_result', allowed_to_say: ['say plainly you could not check current information right now', 'never answer a current fact from memory'] })
        this.handled.set(fc.callId, json)
        this.reply(fc.callId, json)
        return
      }
      const r = raced
      // STRUCTURAL (Phase 2A): the model must never RECEIVE a URL or a source title —
      // it cannot cite what it does not have. We send ONLY the scrubbed fact, no
      // `sources` array, and the permitted-speech line FORBIDS naming any source.
      // (Root cause of the device source-citing: this used to send `sources` AND say
      // "mention the source".)
      const output = r && r.ok && r.answer
        ? { status: 'ok', answer: scrubForSpeech(r.answer), allowed_to_say: ['speak ONLY this fact, in your own warm words', 'NEVER name a website, app, brand of source, or say where it came from', 'never add a fact it did not give'] }
        : { status: 'no_result', allowed_to_say: ['say plainly you could not check current information right now', 'never answer a current fact from memory'] }
      const json = JSON.stringify(output)
      this.handled.set(fc.callId, json)
      this.reply(fc.callId, json)
    } catch {
      const json = JSON.stringify({ status: 'no_result', allowed_to_say: ['say plainly you could not check current information right now', 'never answer a current fact from memory'] })
      this.handled.set(fc.callId, json)
      this.reply(fc.callId, json)
    } finally {
      this.inFlight.delete(fc.callId)
    }
  }

  private reply(callId: string, outputJson: string): void {
    this.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output: outputJson } })
    this.send({ type: 'response.create' })
  }

  private dispatch(fc: ParsedFunctionCall): Record<string, unknown> {
    const args = safeArgs(fc.argsJson)
    if (fc.name === 'resolve_contact') return this.doResolve(args)
    if (fc.name === 'read_calendar') return this.doRead(args)
    if (fc.name === 'update_calendar_event') return this.doUpdate(args)
    if (isCalendarTool(fc.name)) return this.doCalendar(fc.name, args)
    if (COMM_TOOLS.has(fc.name)) return this.doComm(fc.name, args)
    if (fc.name === 'people_lookup') return this.doPeopleLookup(args)
    if (fc.name === 'history_lookup') return this.doHistoryLookup(args)
    if (fc.name === 'care_concern') return this.doCareConcern(args)
    if (fc.name === 'remember') return this.doRemember(args)
    return { error: 'unknown_tool' }
  }

  /** PERSISTENT MEMORY: durably save a fact Martita asked to remember/update, across
   *  sessions (reuses savedMemory → IndexedDB + localStorage). Abu must NEVER say she
   *  cannot update — this tool is that capability. Sensitive facts (phone/medical/
   *  financial/street) are refused at the privacy boundary, gently. */
  private doRemember(args: Record<string, unknown>): Record<string, unknown> {
    const fact = str(args, 'fact') ?? ''
    const r = saveMemory(fact)
    if (r.ok) return { status: 'saved', fact: r.memory.text, total: loadMemories().length, allowed_to_say: ['confirm warmly and briefly that you will remember it', 'NEVER say you cannot update, change, or save anything'] }
    if (r.reason === 'duplicate') return { status: 'already_known', allowed_to_say: ['say warmly that you already remember that'] }
    if (r.reason === 'sensitive') {
      // Issue ii: report EXACTLY what is kept private, and GUARANTEE she never falls
      // back to the original defect ("I cannot update anything"). She CAN remember
      // everything else — this is a privacy choice about one kind of detail, not a
      // capability failure. (A death is NOT medical — those persist.)
      const kind = sensitiveKind(fact)
      const HE: Record<SensitiveKind, string> = {
        phone: 'מספר טלפון', medical: 'פרטים רפואיים מתמשכים', financial: 'פרטי כסף וחשבון', street: 'כתובת מדויקת',
      }
      const what = kind ? HE[kind] : 'פרטים אישיים רגישים'
      return {
        status: 'declined_sensitive', declined: kind, declined_label: what,
        allowed_to_say: [
          `say warmly that you keep ${what} private and do NOT store it — that is a choice to protect her, not something you are unable to do`,
          'make clear you DO remember everything else she tells you, and offer to remember the rest',
          'you are FORBIDDEN from saying you cannot update or remember anything — that is false',
        ],
      }
    }
    return { status: 'empty', allowed_to_say: ['ask her gently what she would like you to remember'] }
  }

  /** NO_HARM (careGuard): return a LOCKED safe answer that points her to a real person,
   *  never improvised medical/financial/safety advice. Structural — the words come from
   *  careGuard, not the model. Language follows the query. */
  private doCareConcern(args: Record<string, unknown>): Record<string, unknown> {
    const q = str(args, 'query') ?? ''
    const { risk } = classifyCareRisk(q)
    // If the deterministic classifier does not see a real care risk, do not fabricate
    // one — let the normal path answer. (The tool description should keep this rare.)
    if (!risk) return { status: 'not_care', allowed_to_say: ['answer her normally and warmly'] }
    const lang: CareLang = /[áéíóúñ¿¡]|\b(qu[eé]|no puedo|me duele|plata|pastilla)\b/i.test(q) ? 'es' : 'he'
    // Rotate the WORDING each call (issue iii) — the safety content is identical across variants.
    return { status: 'care', category: risk, answer: safeCareResponse(risk, lang, this.careTurn++), allowed_to_say: careAllowedToSay() }
  }

  /** FIX 3 — the ONE life-history/places tool. Reads structured knowledge/life_history.json
   *  and returns ONLY grounded summaries (with confidence), or an honest not_found. Never a
   *  fabricated memory — history/places get the SAME grounded discipline as people_lookup. */
  private doHistoryLookup(args: Record<string, unknown>): Record<string, unknown> {
    const r = historyLookup(str(args, 'topic') ?? str(args, 'query') ?? '')
    if (r.status === 'not_found') return { status: 'not_found', allowed_to_say: ['say warmly that you do not have that part of the story', 'never invent a memory or a place'] }
    return { status: 'ok', entries: r.entries, allowed_to_say: ['tell it warmly in your own words from these grounded facts only', 'never add a detail that is not here', 'if a fact is marked unclear, do not sharpen it'] }
  }

  /** The ONE people tool — who / relationship / relatives / contact — all derived
   *  from the canonical people store. Never invents a relationship; never a number. */
  private doPeopleLookup(args: Record<string, unknown>): Record<string, unknown> {
    const want = str(args, 'want') ?? 'who'
    const person = str(args, 'person') ?? ''
    if (want === 'relationship') {
      const r = relationshipBetween(person, str(args, 'other') ?? '')
      if (r.status === 'ok') return { status: 'ok', relationship: r.text, allowed_to_say: ['say this exact relationship'] }
      if (r.status === 'unrelated') return { status: 'unrelated', allowed_to_say: ['say they are not directly related'] }
      return { status: 'not_found', allowed_to_say: ['say you do not know that person'] }
    }
    if (want === 'relatives') {
      const r = relativesByKind(person, (str(args, 'relation') ?? 'child') as KinKind)
      if (r.status === 'ok') return { status: 'ok', kind: r.kind, people: r.people, allowed_to_say: ['read back these names exactly'] }
      return { status: 'not_found', allowed_to_say: ['say you do not know that person'] }
    }
    if (want === 'contact') {
      const r = resolveContactTarget(person) // resolved | ambiguous | deceased | not_found — no number
      if (r.status === 'ambiguous') return { ...r, allowed_to_say: ['ask which specific person she means'] }
      if (r.status === 'deceased') return { status: 'deceased', label: r.label, allowed_to_say: ['gently say this person is no longer with us, so there is no way to call or message them', 'do NOT answer about a different family relationship'] }
      if (r.status === 'not_found') return { status: 'not_found', allowed_to_say: ['say you do not have that person'] }
      return { ...r, allowed_to_say: ['use this id to message or call — never read a number aloud'] }
    }
    const w = whoIs(person)
    return w.status === 'ok'
      ? { ...w, allowed_to_say: ['say who this is and how they relate to Martita'] }
      : { status: 'not_found', allowed_to_say: ['say you do not know that person'] }
  }

  // ─── resolve_contact ───────────────────────────────────────────────────────
  private doResolve(args: Record<string, unknown>): Record<string, unknown> {
    const r = resolveContact(str(args, 'name') ?? '')
    if (r.status === 'resolved') return { status: 'resolved', id: r.id, label: r.label }
    if (r.status === 'ambiguous') {
      return {
        status: 'ambiguous',
        candidates: r.candidates.map((c) => ({ id: c.id, label: c.label })),
        allowed_to_say: ['ask which specific person she means', 'never guess a relative for a name'],
      }
    }
    return { status: 'not_found', allowed_to_say: ['say you do not have that person as a contact'] }
  }

  // ─── calendar ──────────────────────────────────────────────────────────────
  private doCalendar(name: string, args: Record<string, unknown>): Record<string, unknown> {
    const { outcome, receipt } = applyCalendarFunctionCall(this.draft, { name, args }, resolveCalendarParticipant)
    this.draft = outcome.draft
    this.cb.onCalendarDraft?.(this.draft)

    // Commit exactly once when a draft reaches CONFIRMED. EVERY field the draft holds
    // is carried through — title/date/time/participant/location/notes — so nothing the
    // model prepared is silently dropped on save (the device "location dropped" bug).
    if (this.draft && this.draft.confirmation === 'CONFIRMED' && !this.committedApptId) {
      const saved = this.store.add({
        title: this.draft.title ?? 'פגישה',
        date: this.draft.date ?? '',
        time: this.draft.time ?? '',
        ...(this.draft.participant ? { participant: this.draft.participant } : {}),
        ...(this.draft.location ? { location: this.draft.location } : {}),
        ...(this.draft.notes ? { notes: this.draft.notes } : {}),
      })
      if (saved) {
        this.committedApptId = saved.id
        this.cb.onCalendarSaved?.(saved)   // receipt card gets the ACTUAL persisted event
        return this.calendarOutput(receipt, { saved: true, event_id: saved.id })
      }
      // Persistence failed — be honest, do not claim it was saved.
      return this.calendarOutput(receipt, { saved: false, error: 'not_saved' })
    }
    // A repeat confirm on an already-committed draft: report the existing save, never a second event.
    if (this.draft && this.draft.confirmation === 'CONFIRMED' && this.committedApptId) {
      return this.calendarOutput(receipt, { saved: true, event_id: this.committedApptId, already: true })
    }
    if (this.draft && this.draft.confirmation === 'CANCELLED') this.committedApptId = null
    return this.calendarOutput(receipt, {})
  }

  private calendarOutput(r: CalendarReceipt, extra: Record<string, unknown>): Record<string, unknown> {
    return {
      confirmation: r.confirmation, revision: r.revision,
      participant: r.participant, unresolved_relationship: r.unresolvedRelationship,
      date: r.date, time: r.time, missing: r.missing,
      allowed_to_say: r.allowedClaims, rejected: r.rejected,
      ...extra,
    }
  }

  private doRead(args: Record<string, unknown>): Record<string, unknown> {
    const date = str(args, 'date')
    const from = str(args, 'from')
    const to = str(args, 'to')
    const all = this.store.list()
    // Filter: a single day (date), a RANGE (from..to inclusive), or everything.
    // YYYY-MM-DD compares lexicographically == chronologically, so a string range
    // is a correct date window (no timezone math, no off-by-one). A range that is
    // only half-given (from XOR to) falls back to that bound as an open interval.
    const inRange = (d: string): boolean => {
      if (from && to) return d >= from && d <= to
      if (from) return d >= from
      if (to) return d <= to
      return true
    }
    const filtered = date ? all.filter((e) => e.date === date) : (from || to ? all.filter((e) => inRange(e.date)) : all)
    const events = filtered
      .slice()
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .map((e) => ({
        title: e.title, date: e.date, time: e.time || null,
        participant: e.participant ?? null, location: e.location ?? null, notes: e.notes ?? null,
      }))
    const scope = date ?? (from || to ? `${from ?? '…'}..${to ?? '…'}` : null)
    return {
      count: events.length,
      date: date ?? null,
      range: from || to ? { from: from ?? null, to: to ?? null } : null,
      events,
      allowed_to_say: events.length === 0
        ? [scope ? 'nothing in that period' : 'the calendar is empty']
        : ['read back these events exactly as given, including the location if present'],
    }
  }

  // ─── update a SAVED event in place (no duplicate) ─────────────────────────────
  private doUpdate(args: Record<string, unknown>): Record<string, unknown> {
    const date = str(args, 'date')
    const field = str(args, 'field')
    const value = str(args, 'value')
    const titleContains = str(args, 'title_contains')
    const ALLOWED = new Set(['title', 'date', 'time', 'location', 'notes', 'participant'])
    if (!date || !field || value === undefined || !ALLOWED.has(field)) {
      return { status: 'error', error: 'bad_update_args', allowed_to_say: ['ask which event and what to change'] }
    }
    const matches = this.store.list().filter(
      (e) => e.date === date && (!titleContains || e.title.includes(titleContains)),
    )
    if (matches.length === 0) {
      return { status: 'not_found', allowed_to_say: ['say there is no saved event matching that day'] }
    }
    if (matches.length > 1) {
      return {
        status: 'ambiguous',
        candidates: matches.map((e) => ({ title: e.title, date: e.date, time: e.time || null })),
        allowed_to_say: ['ask which of these events she means'],
      }
    }
    const target = matches[0]!
    const updated = this.store.update(target.id, { [field]: value } as Partial<Omit<LiveEvent, 'id'>>)
    if (!updated) {
      return { status: 'not_saved', error: 'update_failed', allowed_to_say: ['be honest that the change did not save'] }
    }
    return {
      status: 'updated',
      event: {
        title: updated.title, date: updated.date, time: updated.time || null,
        participant: updated.participant ?? null, location: updated.location ?? null, notes: updated.notes ?? null,
      },
      allowed_to_say: ['confirm the change is saved, and read back the updated detail'],
    }
  }

  // ─── whatsapp / call (PREPARE only — never sends or dials) ────────────────────
  private doComm(name: string, args: Record<string, unknown>): Record<string, unknown> {
    if (name === 'cancel_communication') {
      this.comm = this.comm ? { ...this.comm, status: 'CANCELLED' } : null
      this.cb.onCommDraft?.(this.comm)
      return { status: 'cancelled', allowed_to_say: ['confirm you cancelled it'] }
    }
    const kind: LiveCommDraft['kind'] = name === 'phone_call' ? 'call' : 'message'
    const recipientSpoken = str(args, 'recipient') ?? ''
    const res = resolveContact(recipientSpoken)
    // A DECEASED person resolves as an identity but is NEVER reachable. Asking to call
    // or message Papi (פפי) must be a gentle, truthful "he is no longer with us" — never
    // a call/message card, and never a confused deflection into a family relationship
    // (the device defect). No draft is created.
    if (res.status === 'resolved' && isDeceasedContact(res.id)) {
      return {
        status: 'deceased',
        label: contactLabel(res.id) ?? res.label,
        allowed_to_say: [
          'gently and warmly say this person is no longer with us, so there is no way to call or message them',
          'never create a call or a message, never claim one, and do NOT answer about a different family relationship',
        ],
      }
    }
    if (res.status !== 'resolved') {
      // Cannot reach an unresolved person — never guess. Ask (ambiguous) or say
      // there is no contact (not_found). No draft is created.
      return {
        status: res.status,
        candidates: res.status === 'ambiguous' ? res.candidates.map((c) => ({ id: c.id, label: c.label })) : undefined,
        allowed_to_say: res.status === 'ambiguous'
          ? ['ask which specific person she means', 'never guess a relative']
          : ['say you do not have that person as a contact'],
      }
    }
    this.comm = {
      kind,
      recipientId: res.id,
      recipientLabel: contactLabel(res.id) ?? res.label,
      intent: kind === 'message' ? (str(args, 'message') ?? '') : null,
      status: kind === 'call' ? 'READY_TO_CALL' : 'READY_TO_SEND',
    }
    this.cb.onCommDraft?.(this.comm)
    return {
      status: this.comm.status,      // only ever a preparation status — never "sent"/"dialed"
      kind: this.comm.kind,
      recipient: this.comm.recipientLabel,
      allowed_to_say: kind === 'call'
        ? ['say the call is ready for her to place — she taps to dial', 'never say you called']
        : ['say the message is ready for her to review and send', 'never say you sent it'],
    }
  }

  // ─── views (tests / UI) ──────────────────────────────────────────────────────
  viewCalendarDraft(): CalendarDraft | null { return this.draft }
  viewCommDraft(): LiveCommDraft | null { return this.comm }
  committedEventId(): string | null { return this.committedApptId }
}

function safeArgs(argsJson: string): Record<string, unknown> {
  try { const v = JSON.parse(argsJson || '{}'); return v && typeof v === 'object' ? v as Record<string, unknown> : {} }
  catch { return {} }
}

// ─── Production calendar store (durable, read-after-write) ────────────────────
/** Wire the live path to the real durable calendar store. Reuses AbuCalendar's
 *  load/save kernels (durable write-through + localStorage mirror), so an event
 *  saved here is immediately readable, and survives reload/reconnect. service.ts
 *  is pure logic (no UI imports), safe to pull into the isolated live path. */
export function durableCalendarStore(): LiveCalendarStore {
  const toLiveEvent = (a: Appointment): LiveEvent => ({
    id: a.id, title: a.title, date: a.date, time: a.time,
    ...(a.personName ? { participant: a.personName } : {}),
    ...(a.location ? { location: a.location } : {}),
    ...(a.notes ? { notes: a.notes } : {}),
  })
  return {
    list(): LiveEvent[] {
      return loadAppointments().map(toLiveEvent)
    },
    add(e): LiveEvent | null {
      const appts = loadAppointments()
      const id = `live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const appt: Appointment = {
        id,
        title: e.title,
        date: e.date,
        time: e.time,
        emoji: detectEmoji(`${e.title} ${e.participant ?? ''} ${e.location ?? ''}`),
        color: '#4ECDC4',
        ...(e.participant ? { personName: e.participant } : {}),
        ...(e.location ? { location: e.location } : {}),
        ...(e.notes ? { notes: e.notes } : {}),
      }
      saveAppointments([...appts, appt])
      // Round-trip verify against the same store (never a false "saved").
      const back = loadAppointments().find((a) => a.id === id)
      return back ? toLiveEvent(back) : null
    },
    update(id, patch): LiveEvent | null {
      // Translate LiveEvent fields → Appointment fields (participant → personName).
      const apptPatch: Partial<Appointment> = {}
      if (patch.title !== undefined) apptPatch.title = patch.title
      if (patch.date !== undefined) apptPatch.date = patch.date
      if (patch.time !== undefined) apptPatch.time = patch.time
      if (patch.location !== undefined) apptPatch.location = patch.location
      if (patch.notes !== undefined) apptPatch.notes = patch.notes
      if (patch.participant !== undefined) apptPatch.personName = patch.participant
      updateAppointment(id, apptPatch)
      // Round-trip verify the change actually persisted.
      const back = loadAppointments().find((a) => a.id === id)
      return back ? toLiveEvent(back) : null
    },
  }
}

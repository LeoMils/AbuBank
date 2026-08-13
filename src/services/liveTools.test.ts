/*
 * liveTools.test.ts — Milestone 2/3 evidence (CODE class).
 *
 * Drives the live tool executor with injected function-calls (no WebRTC, no mic)
 * and an in-memory calendar store, proving the milestone's hard requirements:
 *   • exactly-once: one confirmation → at most one event (retries/dupes/reorders)
 *   • a pending draft survives an unrelated question
 *   • correcting one field preserves the others
 *   • read-after-write: a confirmed event is immediately readable from the SAME store
 *   • "אח של מור" is structurally impossible as an event participant (no substitution)
 *   • a plain unknown name (Gabi) still makes an event
 *   • WhatsApp/Call only PREPARE — nothing sends or dials; recipients resolve to ids
 * These prove the DETERMINISTIC behavior — NOT that Abu sounded warm on a device.
 */
import { describe, it, expect } from 'vitest'
import { LiveTools, LIVE_TOOL_NAMES, type LiveCalendarStore, type LiveEvent, type OnlineFetch } from './liveTools'
import type { ParsedFunctionCall } from '../screens/AbuAI/realtime/realtimeFunctionBridge'

function memStore(): LiveCalendarStore & { events: LiveEvent[] } {
  const events: LiveEvent[] = []
  let n = 0
  return {
    events,
    list: () => events.slice(),
    add: (e) => { const ev: LiveEvent = { id: `e${++n}`, ...e }; events.push(ev); return ev },
    update: (id, patch) => {
      const e = events.find((x) => x.id === id)
      if (!e) return null
      for (const [k, val] of Object.entries(patch)) if (val !== undefined) (e as unknown as Record<string, unknown>)[k] = val
      return { ...e }
    },
  }
}

interface Harness {
  tools: LiveTools
  sent: Array<Record<string, unknown>>
  store: ReturnType<typeof memStore>
  call: (name: string, args: Record<string, unknown>, callId?: string) => void
  outputs: () => Array<Record<string, unknown>>
  lastOutput: () => Record<string, unknown> | null
  /** Captured action-card callback events (type + payload), in order. */
  cbEvents: Array<Record<string, unknown>>
}

function harness(): Harness {
  const sent: Array<Record<string, unknown>> = []
  const store = memStore()
  const cbEvents: Array<Record<string, unknown>> = []
  const tools = new LiveTools((e) => sent.push(e), store, {
    onCalendarDraft: (d) => cbEvents.push({ type: 'calendarDraft', d }),
    onCalendarSaved: (e) => cbEvents.push({ type: 'calendarSaved', e }),
    onCommDraft: (d) => cbEvents.push({ type: 'commDraft', d }),
  })
  let auto = 0
  const call = (name: string, args: Record<string, unknown>, callId?: string) => {
    const fc: ParsedFunctionCall = { name, callId: callId ?? `auto-${++auto}`, argsJson: JSON.stringify(args) }
    tools.handleFunctionCall(fc)
  }
  const outputs = () =>
    sent.filter((e) => e.type === 'conversation.item.create')
      .map((e) => JSON.parse(((e.item as { output: string }).output)) as Record<string, unknown>)
  const lastOutput = () => { const o = outputs(); return o.length ? o[o.length - 1]! : null }
  return { tools, sent, store, call, outputs, lastOutput, cbEvents }
}

describe('resolve_contact tool', () => {
  it('returns resolved / ambiguous / not_found and always a response.create', () => {
    const h = harness()
    h.call('resolve_contact', { name: 'מור' })
    expect(h.lastOutput()).toMatchObject({ status: 'resolved', id: 'mor' })
    h.call('resolve_contact', { name: 'אח של מור' })
    expect(h.lastOutput()).toMatchObject({ status: 'ambiguous' })
    h.call('resolve_contact', { name: 'בוריס' }) // a truly-unknown name (Gabi is now a real contact)
    expect(h.lastOutput()).toMatchObject({ status: 'not_found' })
    // every tool reply is followed by a response.create so the model speaks
    expect(h.sent.filter((e) => e.type === 'response.create').length).toBe(3)
  })
})

describe('tool-agnostic speech guarantee', () => {
  // Defect-1 guard: EVERY tool the model can call MUST produce a spoken response
  // (response.create) in the SAME turn it is handled — so Abu answers with the
  // grounded result, never leaving a tool result silent and never needing a preamble
  // to fill the gap. Iterating LIVE_TOOL_NAMES means a NEWLY ADDED tool that forgets
  // to reply fails this test — the guarantee cannot silently regress.
  it('every owned live tool emits exactly one response.create in the same turn', async () => {
    const fastOnline: OnlineFetch = async () => ({ ok: false }) // no network; still must speak
    for (const name of LIVE_TOOL_NAMES) {
      const sent: Array<Record<string, unknown>> = []
      const tools = new LiveTools((e) => sent.push(e), memStore(), {}, fastOnline)
      tools.handleFunctionCall({ name, callId: `c-${name}`, argsJson: '{}' })
      // get_current_info is async (a server round-trip, now behind a timeout race) — flush
      // to the next macrotask so every microtask hop of the async path has settled.
      await new Promise((r) => setTimeout(r, 0))
      const speaks = sent.filter((e) => e.type === 'response.create').length
      expect(speaks, `tool "${name}" must speak its result in the same turn`).toBe(1)
    }
  })
})

describe('calendar — create, confirm, read-after-write', () => {
  it('prepares a draft, confirms it, saves EXACTLY ONE event, and reads it back immediately', () => {
    const h = harness()
    h.call('prepare_calendar_event', { title: 'פגישה עם מור', date: '2026-08-10', time: '15:00', participant: 'מור' })
    const draft = h.tools.viewCalendarDraft()!
    expect(draft.confirmation).toBe('AWAITING_CONFIRM')
    expect(draft.participant).toBe('מור')

    h.call('confirm_calendar_event', { forRevision: draft.revision })
    expect(h.store.events.length).toBe(1)
    expect(h.lastOutput()).toMatchObject({ confirmation: 'CONFIRMED', saved: true })

    // read-after-write: the SAME store returns the event
    h.call('read_calendar', { date: '2026-08-10' })
    const read = h.lastOutput()!
    expect(read.count).toBe(1)
    expect((read.events as Array<{ title: string }>)[0]!.title).toBe('פגישה עם מור')
  })

  it('exactly-once: a duplicate confirm call id is a strict no-op (one event, one output)', () => {
    const h = harness()
    h.call('prepare_calendar_event', { title: 'רופא', date: '2026-08-11', time: '09:00' })
    const rev = h.tools.viewCalendarDraft()!.revision
    h.call('confirm_calendar_event', { forRevision: rev }, 'confirm-1')
    const outputsAfterFirst = h.outputs().length
    h.call('confirm_calendar_event', { forRevision: rev }, 'confirm-1') // same id → no-op
    expect(h.store.events.length).toBe(1)
    expect(h.outputs().length).toBe(outputsAfterFirst) // no second output
  })

  it('exactly-once: a SECOND distinct confirm on the committed draft never doubles the event', () => {
    const h = harness()
    h.call('prepare_calendar_event', { title: 'רופא', date: '2026-08-11', time: '09:00' })
    const rev = h.tools.viewCalendarDraft()!.revision
    h.call('confirm_calendar_event', { forRevision: rev }, 'confirm-A')
    h.call('confirm_calendar_event', { forRevision: rev }, 'confirm-B') // different id, same draft
    expect(h.store.events.length).toBe(1)
    expect(h.lastOutput()).toMatchObject({ saved: true, already: true })
  })

  it('a pending draft SURVIVES an unrelated question (read_calendar) then still confirms', () => {
    const h = harness()
    h.call('prepare_calendar_event', { title: 'פגישה עם מור', date: '2026-08-10', time: '15:00', participant: 'מור' })
    const rev = h.tools.viewCalendarDraft()!.revision
    // unrelated turn in the middle — must not disturb the draft
    h.call('read_calendar', {})
    const stillPending = h.tools.viewCalendarDraft()!
    expect(stillPending.confirmation).toBe('AWAITING_CONFIRM')
    expect(stillPending.participant).toBe('מור')
    h.call('confirm_calendar_event', { forRevision: rev })
    expect(h.store.events.length).toBe(1)
  })

  it('correcting ONE field preserves every other field', () => {
    const h = harness()
    h.call('prepare_calendar_event', { title: 'פגישה עם מור', date: '2026-08-10', time: '15:00', participant: 'מור' })
    h.call('correct_calendar_field', { field: 'time', value: '16:00' })
    const d = h.tools.viewCalendarDraft()!
    expect(d.time).toBe('16:00')
    expect(d.title).toBe('פגישה עם מור')  // preserved
    expect(d.date).toBe('2026-08-10')     // preserved
    expect(d.participant).toBe('מור')     // preserved
  })
})

describe('calendar — identity safety (no substitution)', () => {
  it('"אח של מור" is held as an UNRESOLVED relationship and BLOCKS confirm — no event', () => {
    const h = harness()
    h.call('prepare_calendar_event', { title: 'פגישה', date: '2026-08-10', time: '15:00', participant: 'אח של מור' })
    const d = h.tools.viewCalendarDraft()!
    expect(d.participant).toBeNull()                 // never became a specific person
    expect(d.unresolvedRelationship).toBe('אח של מור')
    // Attempting to confirm is rejected — Abu must ask who first.
    h.call('confirm_calendar_event', { forRevision: d.revision })
    expect(h.store.events.length).toBe(0)
    expect(h.lastOutput()).toMatchObject({ confirmation: 'AWAITING_CONFIRM', rejected: true })
  })

  it('a plain unknown name (Boris, Spanish flow) still creates exactly one event', () => {
    const h = harness()
    // Boris is not a contact (Gabi is now a real person) — a plain spoken name still books.
    h.call('prepare_calendar_event', { title: 'reunión con Boris', date: '2026-08-10', time: '15:00', participant: 'Boris' })
    const d = h.tools.viewCalendarDraft()!
    expect(d.participant).toBe('Boris')
    expect(d.unresolvedRelationship).toBeNull()
    h.call('confirm_calendar_event', { forRevision: d.revision })
    expect(h.store.events.length).toBe(1)
  })
})

describe('whatsapp_draft / phone_call — PREPARE only (card is the receipt)', () => {
  it('drafts a WhatsApp message (carrying the composed text) for a resolved recipient; never claims sent', () => {
    const h = harness()
    h.call('whatsapp_draft', { recipient: 'מור', message: 'אמא חושבת עלייך, נשמע בקרוב' })
    const out = h.lastOutput()!
    expect(out.status).toBe('READY_TO_SEND')
    expect(out.recipient).toBe('מור')
    expect((out.allowed_to_say as string[]).some((s) => /never say you sent/i.test(s))).toBe(true)
    // The draft carries the FULL composed message for the card to show.
    expect(h.tools.viewCommDraft()).toMatchObject({ kind: 'message', recipientId: 'mor', status: 'READY_TO_SEND', intent: 'אמא חושבת עלייך, נשמע בקרוב' })
  })

  it('a call is only PREPARED (READY_TO_CALL), never dialed', () => {
    const h = harness()
    h.call('phone_call', { recipient: 'לאו' })
    expect(h.lastOutput()).toMatchObject({ status: 'READY_TO_CALL', kind: 'call', recipient: 'לאו' })
  })

  it('an unresolved recipient (relationship phrase) creates NO comm draft — Abu asks who', () => {
    const h = harness()
    h.call('whatsapp_draft', { recipient: 'אח של מור', message: 'משהו' })
    expect(h.lastOutput()).toMatchObject({ status: 'ambiguous' })
    expect(h.tools.viewCommDraft()).toBeNull()
  })

  // device defect 6: calling/messaging a DECEASED person (פפי) is a gentle decline,
  // NEVER a call/message card and NEVER a deflection into a family relationship.
  it('phone_call to פפי (deceased) → status deceased, NO call draft, no id leaked', () => {
    const h = harness()
    h.call('phone_call', { recipient: 'פפי' })
    const out = h.lastOutput()!
    expect(out.status).toBe('deceased')
    expect(JSON.stringify(out)).not.toContain('"id"')
    expect(h.tools.viewCommDraft()).toBeNull() // nothing prepared
  })
  it('whatsapp_draft to פפי (deceased) also declines gently with no draft', () => {
    const h = harness()
    h.call('whatsapp_draft', { recipient: 'פפי', message: 'משהו' })
    expect(h.lastOutput()!.status).toBe('deceased')
    expect(h.tools.viewCommDraft()).toBeNull()
  })
  it('people_lookup want=contact for פפי is deceased, never a callable id', () => {
    const h = harness()
    h.call('people_lookup', { want: 'contact', person: 'פפי' })
    expect(h.lastOutput()!.status).toBe('deceased')
    expect(JSON.stringify(h.lastOutput())).not.toContain('"id"')
  })

  it('cancel_communication cancels the pending preparation', () => {
    const h = harness()
    h.call('phone_call', { recipient: 'מור' })
    h.call('cancel_communication', {})
    expect(h.tools.viewCommDraft()!.status).toBe('CANCELLED')
  })
})

describe('read_calendar returns ALL events in a window (Part C.1 — filter/window/tz)', () => {
  const seed = (h: ReturnType<typeof harness>) => {
    h.store.events.push(
      { id: 'a', title: 'סוף אוגוסט', date: '2026-08-30', time: '09:00' },
      { id: 'b', title: 'יום אחרון', date: '2026-08-31', time: '10:00' },
      { id: 'c', title: 'תחילת ספטמבר', date: '2026-09-01', time: '11:00' },
      { id: 'd', title: 'אמצע ספטמבר', date: '2026-09-15', time: '12:00' },
    )
  }
  it('exact date returns just that day', () => {
    const h = harness(); seed(h)
    h.call('read_calendar', { date: '2026-08-31' })
    expect(h.lastOutput()!.count).toBe(1)
    expect((h.lastOutput()!.events as Array<{ title: string }>)[0]!.title).toBe('יום אחרון')
  })
  it('a week window (from..to) returns every event in the range — not just one day', () => {
    const h = harness(); seed(h)
    h.call('read_calendar', { from: '2026-08-30', to: '2026-09-05' })
    expect(h.lastOutput()!.count).toBe(3) // 30 Aug, 31 Aug, 1 Sep
  })
  it('a range that CROSSES a month boundary returns both months', () => {
    const h = harness(); seed(h)
    h.call('read_calendar', { from: '2026-08-31', to: '2026-09-01' })
    const titles = (h.lastOutput()!.events as Array<{ title: string }>).map((e) => e.title)
    expect(titles).toEqual(['יום אחרון', 'תחילת ספטמבר'])
  })
  it('no args returns everything; an empty period is honestly empty', () => {
    const h = harness(); seed(h)
    h.call('read_calendar', {})
    expect(h.lastOutput()!.count).toBe(4)
    h.call('read_calendar', { from: '2026-10-01', to: '2026-10-31' })
    expect(h.lastOutput()!.count).toBe(0)
    expect((h.lastOutput()!.allowed_to_say as string[])[0]).toContain('nothing')
  })
})

describe('action-card callbacks (Part B) — the overlay gets the draft + the receipt', () => {
  it('whatsapp_draft fires onCommDraft with the recipient + composed message', () => {
    const h = harness()
    h.call('whatsapp_draft', { recipient: 'מור', message: 'נתראה בשישי' })
    const comm = h.cbEvents.filter((e) => e.type === 'commDraft')
    expect(comm.length).toBe(1)
    expect(comm[0]!.d).toMatchObject({ kind: 'message', recipientLabel: 'מור', intent: 'נתראה בשישי', status: 'READY_TO_SEND' })
  })

  it('a confirmed calendar event fires onCalendarSaved with the ACTUAL persisted event', () => {
    const h = harness()
    h.call('prepare_calendar_event', { title: 'רופא', date: '2026-08-20', time: '10:00', location: 'מרפאה' })
    h.call('confirm_calendar_event', { forRevision: h.tools.viewCalendarDraft()!.revision })
    const saved = h.cbEvents.filter((e) => e.type === 'calendarSaved')
    expect(saved.length).toBe(1)
    // The receipt payload is the persisted event, carrying the location that was saved.
    expect(saved[0]!.e).toMatchObject({ title: 'רופא', date: '2026-08-20', time: '10:00', location: 'מרפאה' })
  })

  it('onCalendarDraft fires on prepare (so the draft card can show before save)', () => {
    const h = harness()
    h.call('prepare_calendar_event', { title: 'תספורת', date: '2026-08-21', time: '14:00' })
    const drafts = h.cbEvents.filter((e) => e.type === 'calendarDraft')
    expect(drafts.length).toBeGreaterThanOrEqual(1)
    expect(drafts[drafts.length - 1]!.d).toMatchObject({ confirmation: 'AWAITING_CONFIRM', title: 'תספורת' })
  })
})

describe('every prepared field round-trips: create → confirm → read → update (no field dropped)', () => {
  it('persists title/date/time/participant/location/notes and reads them all back', () => {
    const h = harness()
    h.call('prepare_calendar_event', {
      title: 'פגישה', date: '2026-08-20', time: '15:00',
      participant: 'מור', location: 'קפה נמרוד', notes: 'להביא מסמכים',
    })
    h.call('confirm_calendar_event', { forRevision: h.tools.viewCalendarDraft()!.revision })

    // Persisted event carries EVERY field (the device "location dropped on save" bug).
    expect(h.store.events).toHaveLength(1)
    expect(h.store.events[0]).toMatchObject({
      title: 'פגישה', date: '2026-08-20', time: '15:00',
      participant: 'מור', location: 'קפה נמרוד', notes: 'להביא מסמכים',
    })

    // read_calendar returns every field too, so Abu can read the place/notes back.
    h.call('read_calendar', { date: '2026-08-20' })
    const read = h.lastOutput()!
    expect(read.count).toBe(1)
    expect((read.events as Array<Record<string, unknown>>)[0]).toMatchObject({
      title: 'פגישה', time: '15:00', participant: 'מור', location: 'קפה נמרוד', notes: 'להביא מסמכים',
    })
  })

  it('update_calendar_event edits a SAVED event IN PLACE for each field — never a duplicate', () => {
    const h = harness()
    h.call('prepare_calendar_event', { title: 'פגישה', date: '2026-08-20', time: '15:00', location: 'קפה נמרוד' })
    h.call('confirm_calendar_event', { forRevision: h.tools.viewCalendarDraft()!.revision })
    const id0 = h.store.events[0]!.id

    const upd = (field: string, value: string) => h.call('update_calendar_event', { date: h.store.events[0]!.date, field, value })
    upd('location', 'מרפאה חדשה')
    expect(h.lastOutput()).toMatchObject({ status: 'updated' })
    upd('time', '16:30')
    upd('title', 'פגישה חדשה')
    upd('notes', 'הערה חשובה')
    upd('participant', 'לאו')

    // Same single event, id unchanged, EVERY field now updated (others preserved each step).
    expect(h.store.events).toHaveLength(1)
    expect(h.store.events[0]!.id).toBe(id0)
    expect(h.store.events[0]).toMatchObject({
      title: 'פגישה חדשה', time: '16:30', location: 'מרפאה חדשה', notes: 'הערה חשובה', participant: 'לאו',
    })

    // moving the date keeps it a single in-place event
    h.call('update_calendar_event', { date: '2026-08-20', field: 'date', value: '2026-08-21' })
    expect(h.store.events).toHaveLength(1)
    expect(h.store.events[0]!.date).toBe('2026-08-21')
  })

  it('update_calendar_event is honest: not_found when nothing matches, ambiguous when several share the date', () => {
    const h = harness()
    h.call('update_calendar_event', { date: '2026-08-20', field: 'time', value: '10:00' })
    expect(h.lastOutput()).toMatchObject({ status: 'not_found' })

    // Two events on the same date → ambiguous (ask which), disambiguate via title_contains.
    h.store.events.push({ id: 'a', title: 'רופא', date: '2026-08-22', time: '09:00' })
    h.store.events.push({ id: 'b', title: 'מספרה', date: '2026-08-22', time: '11:00' })
    h.call('update_calendar_event', { date: '2026-08-22', field: 'time', value: '12:00' })
    expect(h.lastOutput()).toMatchObject({ status: 'ambiguous' })
    h.call('update_calendar_event', { date: '2026-08-22', field: 'time', value: '12:00', title_contains: 'מספרה' })
    expect(h.lastOutput()).toMatchObject({ status: 'updated' })
    expect(h.store.events.find((e) => e.id === 'b')!.time).toBe('12:00')
    expect(h.store.events.find((e) => e.id === 'a')!.time).toBe('09:00') // untouched
  })
})

// ─── get_current_info — the grounded online tool (async) ───────────────────────
function onlineHarness(online: OnlineFetch) {
  const sent: Array<Record<string, unknown>> = []
  const tools = new LiveTools((e) => sent.push(e), memStore(), {}, online)
  const fire = (callId: string, query = 'מה מזג האוויר עכשיו?') =>
    tools.handleFunctionCall({ name: 'get_current_info', callId, argsJson: JSON.stringify({ query }) } as ParsedFunctionCall)
  const output = () => {
    const item = sent.find((e) => e.type === 'conversation.item.create')?.item as { output?: string } | undefined
    return item?.output ? (JSON.parse(item.output) as Record<string, unknown>) : null
  }
  return { sent, tools, fire, output }
}
const tick = () => new Promise((r) => setTimeout(r, 0))

describe('get_current_info — grounded online tool (async, no verified result ⇒ no claim)', () => {
  it('speaks ONLY the grounded answer + source on success, then asks the model to reply', async () => {
    const h = onlineHarness(async () => ({ ok: true, answer: 'בתל אביב עכשיו 31 מעלות ושמשי.', sources: [{ url: 'https://weather.example/tlv' }] }))
    h.fire('o1')
    await tick()
    expect(h.output()).toMatchObject({ status: 'ok' })
    expect(String(h.output()!.answer)).toContain('31')
    expect(h.sent.some((e) => e.type === 'response.create')).toBe(true) // model speaks the grounded result
  })

  it('a no-result (ungrounded) reply is an HONEST miss — no answer, never from memory', async () => {
    const h = onlineHarness(async () => ({ ok: false, userMessage: 'לא מצאתי' }))
    h.fire('o2', 'מי ניצח אתמול בכדורגל?')
    await tick()
    expect(h.output()).toMatchObject({ status: 'no_result' })
    expect(h.output()!.answer).toBeUndefined()
  })

  it('a thrown online call is an honest miss, not a crash', async () => {
    const h = onlineHarness(async () => { throw new Error('network down') })
    h.fire('o3')
    await tick()
    expect(h.output()).toMatchObject({ status: 'no_result' })
  })

  it('the same call id across duplicate shapes runs the fetch EXACTLY once', async () => {
    let calls = 0
    const h = onlineHarness(async () => { calls++; return { ok: true, answer: 'עדכני', sources: [{ url: 'https://s.example' }] } })
    h.fire('dup'); h.fire('dup'); h.fire('dup')
    await tick()
    expect(calls).toBe(1)
    expect(h.sent.filter((e) => e.type === 'conversation.item.create')).toHaveLength(1)
  })
})

// ─── FIX 5: a tool must never leave the model (and Martita) waiting on a silent hang ──
describe('FIX 5: tools always return — timeout + honest fallback + logging', () => {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

  it('an online tool that NEVER answers times out with an honest miss, speaks it, and logs the issue', async () => {
    const sent: Array<Record<string, unknown>> = []
    const issues: Array<{ n: string; r: string }> = []
    // a fetch that never resolves; tiny 5ms timeout budget
    const tools = new LiveTools((e) => sent.push(e), memStore(), { onToolIssue: (n, r) => issues.push({ n, r }) }, () => new Promise<never>(() => { /* hangs forever */ }), 5)
    tools.handleFunctionCall({ name: 'get_current_info', callId: 'to1', argsJson: JSON.stringify({ query: 'מה החדשות?' }) } as ParsedFunctionCall)
    await wait(30)
    const item = sent.find((e) => e.type === 'conversation.item.create')?.item as { output?: string } | undefined
    expect(item?.output ? JSON.parse(item.output).status : null).toBe('no_result')
    expect(sent.some((e) => e.type === 'response.create')).toBe(true) // the model still gets to speak the honest miss
    expect(issues).toEqual([{ n: 'get_current_info', r: 'timeout' }])
  })

  it('a SYNC tool that throws still replies with an honest error (no hang) and logs the issue', () => {
    const sent: Array<Record<string, unknown>> = []
    const issues: Array<{ n: string; r: string }> = []
    const throwingStore = { events: [], list: () => { throw new Error('store down') }, add: () => { throw new Error('store down') }, update: () => null }
    const tools = new LiveTools((e) => sent.push(e), throwingStore as unknown as LiveCalendarStore, { onToolIssue: (n, r) => issues.push({ n, r }) })
    tools.handleFunctionCall({ name: 'read_calendar', callId: 'e1', argsJson: JSON.stringify({ date: '2026-08-20' }) } as ParsedFunctionCall)
    const item = sent.find((e) => e.type === 'conversation.item.create')?.item as { output?: string } | undefined
    expect(item?.output ? JSON.parse(item.output).status : null).toBe('error')
    expect(sent.some((e) => e.type === 'response.create')).toBe(true) // model speaks the honest fallback, never hangs
    expect(issues).toEqual([{ n: 'read_calendar', r: 'error' }])
  })
})

// ─── people_lookup — the ONE people tool (M3) ──────────────────────────────────
describe('people_lookup — who / relationship / relatives / contact (no numbers)', () => {
  it('who: identifies a person and their relation to Martita', () => {
    const h = harness()
    h.call('people_lookup', { want: 'who', person: 'לאו' })
    expect(h.lastOutput()).toMatchObject({ status: 'ok', name: 'לאו', relationToMartita: 'בן של מרטיטה' })
  })
  it('relationship: the derived Hebrew term (Gilad is Eili\'s גיס)', () => {
    const h = harness()
    h.call('people_lookup', { want: 'relationship', person: 'גלעד', other: 'עילי' })
    expect(h.lastOutput()).toMatchObject({ status: 'ok', relationship: 'גלעד גיס של עילי' })
  })
  it('relatives: Martita\'s grandchildren = six', () => {
    const h = harness()
    h.call('people_lookup', { want: 'relatives', person: 'מרטיטה', relation: 'grandchild' })
    expect((h.lastOutput()!.people as string[]).length).toBe(6)
  })
  it('contact by relationship: "הבת שלי" → Mor resolved (id+label, no number)', () => {
    const h = harness()
    h.call('people_lookup', { want: 'contact', person: 'הבת שלי' })
    expect(h.lastOutput()).toMatchObject({ status: 'resolved', id: 'mor', label: 'מור' })
    expect(JSON.stringify(h.lastOutput())).not.toMatch(/\d{7,}/)
  })
  it('contact by relationship: "הנכד שלי" → ambiguous, ask which', () => {
    const h = harness()
    h.call('people_lookup', { want: 'contact', person: 'הנכד שלי' })
    expect(h.lastOutput()!.status).toBe('ambiguous')
  })
})

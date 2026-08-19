/*
 * LEDGER SERVICE + CONVERSATION INTAKE — Truth-Loop product proofs.
 * Proves: every write goes through THE LAWS gate (a poisoning fact never stores); the
 * file-as-view regenerates from state; every change is one line + UNDOABLE; a manual
 * upload with a planted conflict returns a one-line diff; the intake classifier obeys the
 * three doors (explicit writes now, stated fact soft-confirms, vague never); birthdays
 * propose a yearly calendar entry.
 */
import { describe, it, expect } from 'vitest'
import { LedgerService, memoryStore } from './ledgerService'
import type { Ledger, LedgerPerson } from './familyLaws'
import { classifyIntake, extractChange, proposeBirthdayEvent } from './conversationIntake'

const P = (id: string, extra: Partial<LedgerPerson> = {}): LedgerPerson => ({ id, name: id, gender: 'unknown', parents: [], spouses: [], exSpouses: [], aliases: [], ...extra })
const seed = (...ppl: LedgerPerson[]): (() => Ledger) => () => new Map(ppl.map((p) => [p.id, p]))

describe('LEDGER SERVICE — every write passes THE LAWS gate', () => {
  it('a legal write persists + logs one line; the file-as-view reflects it', () => {
    const svc = new LedgerService(memoryStore(), seed(P('דני'), P('רותי')))
    const r = svc.write({ op: 'addSpouse', a: 'דני', b: 'רותי' }, 1)
    expect(r.ok).toBe(true)
    expect(svc.getLog()).toHaveLength(1)
    expect(svc.getLog()[0]!.line).toContain('נשואים')
    expect(svc.ledger().get('דני')!.spouses).toContain('רותי')
    const view = svc.renderHebrew()
    expect(view).toContain('פנקס המשפחה')
    expect(view).toContain('דני')
    expect(view).toContain('בן/בת זוג: רותי')
  })

  it('a POISONING fact is rejected at the gate and NEVER stores', () => {
    const svc = new LedgerService(memoryStore(), seed(P('א'), P('ב'), P('ג')))
    svc.write({ op: 'addSpouse', a: 'א', b: 'ב' }, 1)
    const before = JSON.stringify([...svc.ledger()].map(([k, v]) => [k, v.spouses]))
    const r = svc.write({ op: 'addSpouse', a: 'א', b: 'ג' }, 2) // bigamy
    expect(r.ok).toBe(false)
    expect(r.reason).toBeTruthy()
    expect(svc.getLog()).toHaveLength(1) // the bad write left NO log entry
    expect(JSON.stringify([...svc.ledger()].map(([k, v]) => [k, v.spouses]))).toBe(before)
  })

  it('every change is UNDOABLE — the ledger is a pure function of (seed, log)', () => {
    const svc = new LedgerService(memoryStore(), seed(P('א'), P('ב')))
    svc.write({ op: 'addSpouse', a: 'א', b: 'ב' }, 1)
    expect(svc.ledger().get('א')!.spouses).toContain('ב')
    expect(svc.undo()).toBe(true)
    expect(svc.ledger().get('א')!.spouses).toHaveLength(0)
    expect(svc.getLog()).toHaveLength(0)
    expect(svc.undo()).toBe(false) // nothing left to undo
  })

  it('a manual upload with a planted conflict returns a one-line diff per fact', () => {
    const svc = new LedgerService(memoryStore(), seed(P('סבא', { birthdate: '1950-01-01' }), P('אבא', { birthdate: '1975-01-01' }), P('נכד', { birthdate: '2005-01-01' })))
    const diff = svc.upload([
      { op: 'addParent', child: 'אבא', parent: 'סבא' },
      { op: 'addParent', child: 'נכד', parent: 'אבא' },
      { op: 'addParent', child: 'סבא', parent: 'נכד' }, // planted cycle + age conflict
    ], 1)
    expect(diff.map((d) => d.accepted)).toEqual([true, true, false])
    expect(diff[2]!.reason.includes('\n')).toBe(false) // one line
    expect(svc.getLog()).toHaveLength(2) // only the two clean facts stored
  })

  it('state survives a reload (persisted log → same ledger)', () => {
    const store = memoryStore()
    const s1 = new LedgerService(store, seed(P('א'), P('ב')))
    s1.write({ op: 'addSpouse', a: 'א', b: 'ב' }, 1)
    const s2 = new LedgerService(store, seed(P('א'), P('ב'))) // fresh service, same store
    expect(s2.ledger().get('א')!.spouses).toContain('ב')
    expect(s2.getLog()).toHaveLength(1)
  })
})

describe('CONVERSATION INTAKE — three doors', () => {
  it('explicit "תזכרי ש…" → writes immediately (through the gate)', () => {
    const r = classifyIntake('תזכרי שדני נשוי לרותי')
    expect(r.kind).toBe('explicit')
    expect(r.change).toEqual({ op: 'addSpouse', a: 'דני', b: 'רותי' })
  })
  it('a plainly-stated fact → ONE soft confirmation (pending, not yet written)', () => {
    const r = classifyIntake('רותי היא אשתו של דני')
    expect(r.kind).toBe('soft-confirm')
    expect(r.change!.op).toBe('addSpouse')
    expect(r.confirmPrompt).toContain('לרשום')
  })
  it('a vague hint → NEVER writes', () => {
    expect(classifyIntake('אולי דני נשוי לרותי').kind).toBe('ignore')
    expect(classifyIntake('נראה לי שרותי היא אשתו של דני').kind).toBe('ignore')
  })
  it('chit-chat with no fact → ignore', () => {
    expect(classifyIntake('מה שלומך היום').kind).toBe('ignore')
  })
  it('an explicit poisoning fact still hits the LAWS gate when written', () => {
    // "תזכרי ש…" produces a Change, but writing it through the service is still gated.
    const svc = new LedgerService(memoryStore(), seed(P('דני', { spouses: ['רותי'] }), P('רותי', { spouses: ['דני'] }), P('שרה')))
    const r = classifyIntake('תזכרי שדני נשוי לשרה')
    expect(r.kind).toBe('explicit')
    const w = svc.write(r.change!, 1)
    expect(w.ok).toBe(false) // bigamy — rejected at the gate even though explicitly asked
  })
})

describe('BIRTHDAYS → CALENDAR', () => {
  it('a birthdate fact proposes a YEARLY calendar entry', () => {
    const ev = proposeBirthdayEvent('מור', '1955-04-08')
    expect(ev.title).toBe('יום הולדת של מור')
    expect(ev.monthDay).toBe('04-08')
    expect(ev.recurring).toBe('yearly')
  })
  it('extractChange parses a birthdate statement', () => {
    expect(extractChange('מור נולדה ב-1955-04-08')).toEqual({ op: 'setBirthdate', id: 'מור', birthdate: '1955-04-08' })
  })
})

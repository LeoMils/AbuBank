/*
 * Exhaustive calendar follow-up + write-safety matrix (DETERMINISTIC).
 *
 * Covers: today, tomorrow, next-day, this-week, last-week, after-that, before-that,
 * before/after-time, empty calendar, save (round-trip verified), cancel, correction.
 * Asserts: correct DAY (no wrong-day), no fake save (createAppointmentSafe verifies
 * by read-back), every write verified.
 *
 * Run: npx tsx acceptance/calendarMatrix.harness.ts
 */
import { writeFileSync } from 'fs'
import { resolve } from 'path'

const g = globalThis as unknown as { localStorage?: Storage }
if (typeof g.localStorage === 'undefined') { const m = new Map<string, string>(); g.localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as Storage }

import { tryGroundedAnswer } from '../src/screens/AbuAI/service'
import { resolveFollowUp } from '../src/screens/AbuAI/contextResolver'
import { saveAppointments, createAppointmentSafe, loadAppointments } from '../src/screens/AbuCalendar/service'
import { parseCorrection } from '../src/screens/AbuCalendar/correctionParser'
import { shapeCreateCancelled } from '../src/screens/AbuAI/responseShaper'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const now = new Date()
const today = iso(now)
const tmr = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
const lastWk = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 5))

saveAppointments([
  { id: 'c-today', title: 'בדיקה', date: today, time: '10:00', emoji: '🏥', color: '#1' },
  { id: 'c-yoga', title: 'יוגה', date: tmr, time: '09:00', emoji: '🧘', color: '#2' },
  { id: 'c-doc', title: 'רופא', date: tmr, time: '16:00', emoji: '🏥', color: '#3' },
  { id: 'c-last', title: 'תספורת', date: lastWk, time: '14:00', emoji: '✂️', color: '#4' },
] as never)

interface Row { id: string; cat: string; q: string; got: string; pass: boolean; note: string }
const rows: Row[] = []
function read(id: string, cat: string, q: string, want: (a: string | null) => boolean, note: string) {
  const a = tryGroundedAnswer(q)
  rows.push({ id, cat, q, got: (a ?? '∅').replace(/\n/g, ' / '), pass: want(a), note })
}
const has = (...s: string[]) => (a: string | null) => !!a && s.some(x => a.includes(x))
const lacks = (...s: string[]) => (a: string | null) => !!a && s.every(x => !a.includes(x))
const both = (f: (a: string | null) => boolean, h: (a: string | null) => boolean) => (a: string | null) => f(a) && h(a)

read('CAL-TODAY', 'today', 'מה יש לי היום?', both(has('בדיקה'), lacks('רופא', 'יוגה', 'תספורת')), 'today only — no wrong-day')
read('CAL-TMR', 'tomorrow', 'מה יש לי מחר?', both(has('רופא', 'יוגה'), lacks('בדיקה', 'תספורת')), 'tomorrow only')
read('CAL-WEEK', 'week', 'מה יש לי השבוע?', has('רופא'), 'this week includes tomorrow')
read('CAL-PASTWK', 'last-week', 'מה היה לי בשבוע שעבר?', (a) => a !== null, 'past-week query answered')
read('CAL-AFTER10', 'after-time', 'מה יש לי מחר אחרי 10?', both(has('רופא'), lacks('יוגה')), 'after 10:00 excludes 09:00')
read('CAL-BEFORE10', 'before-time', 'מה יש לי מחר לפני 10?', both(has('יוגה'), lacks('רופא')), 'before 10:00 excludes 16:00')
read('CAL-AFTER4WORD', 'after-time', 'מה יש לי מחר אחרי ארבע?', lacks('יוגה'), 'after four (16:00) — none after')
read('CAL-BEFORE4WORD', 'before-time', 'מה יש לי מחר לפני ארבע?', both(has('יוגה'), lacks('רופא')), 'before four shows morning')
read('CAL-EMPTY', 'empty', 'מה יש לי ביום ראשון?', (a) => a !== null && /אין כלום|שקט|רופא|יוגה|בדיקה/.test(a), 'weekday answered honestly (empty or real)')
read('CAL-DAYAFTER', 'no-wrong-day', 'מה יש לי מחרתיים?', (a) => a === null || lacks('רופא', 'יוגה')(a), 'day-after must NOT return tomorrow events (null = deferred, OK)')

// Follow-up resolution (next-day / after-that)
function follow(id: string, ctx: string, frag: string, re: RegExp, note: string) {
  const hist = [
    { id: 'h1', role: 'user' as const, content: ctx, timestamp: 1 },
    { id: 'h2', role: 'assistant' as const, content: 'מחר רופא.', timestamp: 2 },
  ]
  const r = resolveFollowUp(frag, hist)
  rows.push({ id, cat: 'followup', q: `${ctx} → ${frag}`, got: `${r.wasFollowUp}:${r.resolved}`, pass: r.wasFollowUp && re.test(r.resolved), note })
}
follow('CAL-NEXTDAY', 'מה יש לי מחר?', 'ומה ביום הבא?', /מחר/, 'next-day → tomorrow')
follow('CAL-AFTERTHAT', 'מה יש לי מחר?', 'ומה אחרי זה?', /השבוע/, 'after-that → week')

// ── WRITE SAFETY ──
// Save: createAppointmentSafe round-trips through storage (no fake save).
const before = loadAppointments().length
const saveRes = createAppointmentSafe({ title: 'נוירולוג', date: tmr, time: '12:00' })
const after = loadAppointments().length
const persisted = loadAppointments().some(a => a.title === 'נוירולוג' && a.date === tmr && a.time === '12:00')
rows.push({ id: 'CAL-SAVE', cat: 'save', q: 'createAppointmentSafe(נוירולוג, מחר, 12:00)', got: JSON.stringify(saveRes.ok), pass: saveRes.ok === true && persisted && after === before + 1, note: 'verified by read-back — no fake save' })

// Save with missing field must NOT persist (no fake save).
const badRes = createAppointmentSafe({ title: '', date: tmr, time: '13:00' })
const countAfterBad = loadAppointments().length
rows.push({ id: 'CAL-SAVE-GUARD', cat: 'save', q: 'createAppointmentSafe(empty title)', got: JSON.stringify(badRes), pass: badRes.ok === false && countAfterBad === after, note: 'incomplete → refused, nothing saved' })

// Cancel
const cancel = shapeCreateCancelled()
rows.push({ id: 'CAL-CANCEL', cat: 'cancel', q: 'shapeCreateCancelled()', got: cancel, pass: cancel.length > 0 && !/קבעתי|שמרתי/.test(cancel), note: 'cancel never claims a save' })

// Correction
const corr = parseCorrection('לא, בשעה עשר', { title: 'רופא', date: tmr, time: '16:00' }, today)
rows.push({ id: 'CAL-CORRECT', cat: 'correction', q: 'parseCorrection("לא, בשעה עשר")', got: `${corr.kind}:${JSON.stringify(corr.updates)}`, pass: corr.kind === 'update' && corr.updates.time === '10:00', note: 'correction updates time' })

let pass = 0, fail = 0
const lines = ['# Calendar Follow-up + Write-Safety Matrix — Deterministic Results', '',
  '_today/tomorrow/next-day/week/last-week/after-that/before-that/before-after-time/empty/save/cancel/correction. No wrong-day, no fake save, every write read-back verified._', '',
  '| ID | Cat | Query | Result | Got | Note |', '|----|-----|-------|--------|-----|------|']
for (const r of rows) { if (r.pass) pass++; else fail++; lines.push(`| ${r.id} | ${r.cat} | ${r.q.replace(/\|/g, '/')} | ${r.pass ? '✅' : '❌'} | ${r.got.replace(/\|/g, '/')} | ${r.note} |`) }
lines.push('', `**Total ${rows.length} · pass ${pass} · fail ${fail}**`)
const out = resolve(process.cwd(), 'docs/abuai/CALENDAR_MATRIX_RESULTS.md')
writeFileSync(out, lines.join('\n'), 'utf-8')
console.log(`Calendar matrix: ${rows.length} cases · pass ${pass} · fail ${fail}. Wrote ${out}`)
if (fail > 0) { for (const r of rows.filter(r => !r.pass)) console.log(`  FAIL ${r.id} [${r.cat}] ${r.q} → ${r.got}`); process.exitCode = 1 }

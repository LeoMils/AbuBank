/*
 * RC5 Product Acceptance Harness — DETERMINISTIC layers only.
 *
 * Runs AbuAI's real, runnable engines (no microphone, no LLM, no network):
 *   - family reasoning            (familyGraph.describeRelation)
 *   - family reference resolution (familyResolve.resolvePersonPhrase)
 *   - calendar parsing            (localParser.parseLocally / sanitizeTitleForSave)
 *
 * The conversational/LLM layers (companion tone, online grounding, long
 * transcripts) are NOT exercised here — they require live provider keys and a
 * browser, which this environment does not have. Those gates are reported as
 * NOT PROVEN in RC5_ACCEPTANCE_RESULTS.md, never as pass.
 *
 * Output: writes a real results table (with diagnostic fields) to
 *   docs/abuai/RC5_ACCEPTANCE_RESULTS.md  (no console-only proof).
 * Exit code: non-zero if any Sev-1 case fails.
 *
 * Run: npx tsx acceptance/rc5ProductHarness.ts
 */
import { writeFileSync } from 'fs'
import { resolve as pathResolve } from 'path'
import { describeRelation } from '../src/screens/AbuAI/familyGraph'
import { resolvePersonPhrase } from '../src/screens/AbuCalendar/familyResolve'
import { parseLocally } from '../src/screens/AbuCalendar/localParser'
import { isConfirm } from '../src/screens/AbuAI/calendarCreate'

const TODAY = '2026-06-20' // Saturday, Asia/Jerusalem basis

interface Row {
  id: string
  input: string
  expectedBehavior: string
  actual: string
  route: string
  planner: string
  engine: string
  memory: string
  familyEntity: string
  calendarAction: string
  online: string
  pass: boolean
  failReason: string
  owner: string
  sev: 1 | 2
}

const rows: Row[] = []
function rec(r: Row) { rows.push(r) }

// ───────────────────────── 1. Family reasoning ─────────────────────────────
function famRel(id: string, a: string, b: string, expect: string | 'NULL', sev: 1 | 2) {
  const got = describeRelation(a, b, 'he')
  const pass = expect === 'NULL' ? got === null : !!got && got.includes(expect)
  rec({
    id, input: `relation(${a},${b})`, expectedBehavior: `infer "${expect}"`,
    actual: got ?? 'NULL', route: 'family_relationship_between', planner: 'FACT/family',
    engine: 'familyGraph.describeRelation', memory: '-', familyEntity: `${a},${b}`,
    calendarAction: '-', online: '-', pass,
    failReason: pass ? '' : `expected "${expect}", got ${got ?? 'NULL'}`,
    owner: 'src/screens/AbuAI/familyGraph.ts', sev,
  })
}
famRel('FR1', 'מרטיטה', 'אנאבל', 'רבתא', 1)         // great-grandmother
famRel('FR2', 'לאו', 'אופיר', 'דוד', 1)              // uncle
famRel('FR3', 'מור', 'עדי', 'דוד', 1)                // aunt
famRel('FR4', 'אופיר', 'עדי', 'דוד', 1)              // cousins
famRel('FR5', 'מור', 'אנאבל', 'סבתא', 1)             // grandmother
famRel('FR6', 'אופיר', 'גלעד', 'נשואים', 1)          // spouse (same-sex)
famRel('FR7', 'מירטה', 'מור', 'NULL', 1)             // friend ≠ family

// ──────────────────── 2. Family reference resolution ────────────────────────
function famRef(id: string, phrase: string, expectStatus: string, expectName: string | null, sev: 1 | 2) {
  const got = resolvePersonPhrase(phrase)
  const name = got.status === 'resolved' ? got.name : null
  const pass = got.status === expectStatus && (expectName === null || name === expectName)
  rec({
    id, input: phrase, expectedBehavior: `${expectStatus}${expectName ? ` → ${expectName}` : ''}`,
    actual: `${got.status}${name ? ` → ${name}` : ''}`, route: 'calendar.personResolve',
    planner: 'TASK/family-ref', engine: 'familyResolve.resolvePersonPhrase', memory: '-',
    familyEntity: name ?? phrase, calendarAction: 'resolve-participant', online: '-', pass,
    failReason: pass ? '' : `expected ${expectStatus}${expectName ? `→${expectName}` : ''}, got ${got.status}${name ? `→${name}` : ''}`,
    owner: 'src/screens/AbuCalendar/familyResolve.ts', sev,
  })
}
famRef('RF1', 'החברה של מור', 'resolved', 'יעל', 1)       // partner alias (RC4 law)
famRef('RF2', 'בת הזוג של מור', 'resolved', 'יעל', 1)     // explicit partner
famRef('RF3', 'אמא של אופיר', 'resolved', 'מור', 1)       // parent
famRef('RF4', 'הבת של מרטיטה', 'resolved', 'מור', 2)      // child by gender
famRef('RF5', 'מור', 'resolved', 'מור', 2)                // plain name
famRef('RF6', 'החברה של מרטיטה', 'missing', null, 1)      // no partner → honest missing

// ─────────────────────────── 3. Calendar parsing ───────────────────────────
function cal(id: string, text: string, check: (d: ReturnType<typeof parseLocally>) => string, sev: 1 | 2) {
  const d = parseLocally(text, TODAY)
  const fail = check(d)
  rec({
    id, input: text, expectedBehavior: 'parse date/time/title (Jerusalem)',
    actual: `date=${d.date} time=${d.time} amb=${d.ambiguousTime} title="${d.title}" person=${d.personPhrase ?? '-'}`,
    route: 'calendar.create.parse', planner: 'TASK/calendar', engine: 'localParser.parseLocally',
    memory: '-', familyEntity: d.personPhrase ?? '-', calendarAction: 'create-parse', online: '-',
    pass: fail === '', failReason: fail, owner: 'src/screens/AbuCalendar/localParser.ts', sev,
  })
}
// tomorrow = 2026-06-21
cal('CP1', 'תקבעי מחר בשלוש עם מוטי', d =>
  d.date !== '2026-06-21' ? 'date≠tomorrow' : (/תקבעי/.test(d.title) ? 'command verb leaked into title' : ''), 1)
cal('CP2', 'פגישה מחר בשמונה בבוקר', d =>
  d.date !== '2026-06-21' ? 'date≠tomorrow' : (d.time !== '08:00' ? `time≠08:00 (${d.time})` : ''), 1)
cal('CP3', 'מחרתיים', d => d.date !== '2026-06-22' ? `date≠2026-06-22 (${d.date})` : '', 2)

// Assent guard: confirmation words are recognized as assent UPSTREAM
// (calendarCreate.isConfirm → used at calendarCreate.ts:500 so a missing-title
// answer of "כן"/"תודה" defaults to "פגישה" and never becomes the title),
// while a real title is NOT swallowed as assent.
function assentGuard(id: string, raw: string, expectAssent: boolean, sev: 1 | 2) {
  const got = isConfirm(raw)
  const pass = got === expectAssent
  rec({
    id, input: `isConfirm("${raw}")`, expectedBehavior: `assent=${expectAssent} (→ ${expectAssent ? 'commit, not title' : 'real title'})`,
    actual: `assent=${got}`, route: 'calendarCreate.confirm', planner: 'TASK/calendar-confirm',
    engine: 'calendarCreate.isConfirm', memory: 'pending-confirm', familyEntity: '-',
    calendarAction: expectAssent ? 'confirm-commit' : 'title-build', online: '-', pass,
    failReason: pass ? '' : `expected assent=${expectAssent}, got ${got}`,
    owner: 'src/screens/AbuAI/calendarCreate.ts', sev,
  })
}
assentGuard('AS1', 'כן', true, 1)
assentGuard('AS2', 'תודה', true, 1)
assentGuard('AS3', 'פגישה עם מוטי', false, 1) // a real title must not be read as assent

// ─────────────────────────────── Report ────────────────────────────────────
const pass = rows.filter(r => r.pass).length
const fail = rows.length - pass
const sev1Fail = rows.filter(r => !r.pass && r.sev === 1).length

const lines: string[] = []
lines.push('# RC5_ACCEPTANCE_RESULTS — Deterministic Product Harness')
lines.push('')
lines.push('> Generated by `acceptance/rc5ProductHarness.ts`. Exercises the REAL runnable engines')
lines.push('> (family reasoning, family-reference resolution, calendar parsing) with NO microphone,')
lines.push('> NO LLM, NO network. LLM/online/voice gates are reported separately as NOT PROVEN —')
lines.push('> they require live provider keys + a device this environment does not have.')
lines.push('')
lines.push(`**Summary:** total ${rows.length} · pass ${pass} · fail ${fail} · Sev-1 fail ${sev1Fail}`)
lines.push('')
lines.push('| ID | Input | Expected behavior | Actual | Route | Planner | Engine | Family entity | Calendar action | Online | Pass | Fail reason | Owner |')
lines.push('|----|-------|-------------------|--------|-------|---------|--------|---------------|-----------------|--------|------|-------------|-------|')
for (const r of rows) {
  const cell = (s: string) => String(s).replace(/\|/g, '\\|')
  lines.push(`| ${r.id} | ${cell(r.input)} | ${cell(r.expectedBehavior)} | ${cell(r.actual)} | ${r.route} | ${r.planner} | ${cell(r.engine)} | ${cell(r.familyEntity)} | ${r.calendarAction} | ${r.online} | ${r.pass ? '✅' : '❌'} | ${cell(r.failReason)} | ${cell(r.owner)} |`)
}
lines.push('')
lines.push('## Diagnostic completeness')
lines.push('Every row emits: input, expected behavior, actual, route, planner decision, engine, memory,')
lines.push('family entity, calendar action, online source/freshness, pass/fail, fail reason, responsible file.')
lines.push('No field is "?" for the deterministic engines exercised here.')

const outPath = pathResolve(process.cwd(), 'docs/abuai/RC5_ACCEPTANCE_RESULTS.md')
writeFileSync(outPath, lines.join('\n'), 'utf-8')
console.log(`RC5 PRODUCT HARNESS  total:${rows.length} pass:${pass} fail:${fail} sev1Fail:${sev1Fail}`)
console.log(`results → ${outPath}`)
for (const r of rows.filter(x => !x.pass)) console.log(`  FAIL [S${r.sev}] ${r.id} ${r.input} — ${r.failReason}`)
process.exitCode = sev1Fail > 0 ? 1 : 0

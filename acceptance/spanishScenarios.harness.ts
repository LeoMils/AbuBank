/*
 * Rioplatense Spanish — DETERMINISTIC scenario harness.
 *
 * Exercises the REAL Spanish surfaces (relationalResolver, familyGraph
 * describeRelation 'es', responseShaper *ES shapers) across family, calendar,
 * follow-up and honesty categories and asserts, per scenario:
 *   - Rioplatense register (voseo / agendar / "a las" / "Listo" / "dale"),
 *     never neutral-Iberian ("usted/coger/vale") forms we explicitly avoid,
 *   - NO Hebrew leakage (no ֐-׿) in a pure-Spanish answer,
 *   - family names kept in Latin script,
 *   - honest negatives ("no tiene") instead of invented kin.
 *
 * SCOPE: this proves the deterministic Spanish SHAPING layer is correct. It does
 * NOT score live-model conversational Spanish prose — that remains a real-run
 * gate (see PRODUCTION_ACCEPTANCE_DASHBOARD §6). Do not read this as "Spanish
 * green for the user"; read it as "the Spanish the engine emits is well-formed".
 *
 * Run: npx tsx acceptance/spanishScenarios.harness.ts
 */
import { writeFileSync } from 'fs'
import { resolve } from 'path'

const g = globalThis as unknown as { localStorage?: Storage }
if (typeof g.localStorage === 'undefined') { const m = new Map<string, string>(); g.localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as Storage }

import { describeRelation } from '../src/screens/AbuAI/familyGraph'
import { resolveRelationalQuery } from '../src/screens/AbuAI/relationalResolver'
import { shapeCreateConfirmES, shapeCreateSavedES, shapeCreateCancelledES, shapeCreateClarifyES, shapeCalendarAnswerES } from '../src/screens/AbuAI/responseShaper'

const HEBREW = /[֐-׿]/
const IBERIAN_BAD = /\b(vale|coger|usted|vosotros|os\s)\b/i

interface Case { id: string; cat: string; q: string; got: string | null; checks: Array<[string, boolean]> }
const results: Case[] = []

function record(id: string, cat: string, q: string, got: string | null, extra: Array<[string, boolean]> = []) {
  const checks: Array<[string, boolean]> = []
  if (got !== null) {
    checks.push(['non-empty', got.trim().length > 0])
    checks.push(['no Hebrew leakage', !HEBREW.test(got)])
    checks.push(['no Iberian forms', !IBERIAN_BAD.test(got)])
  }
  results.push({ id, cat, q, got, checks: [...checks, ...extra] })
}

// ── FAMILY (relational + describe) ──────────────────────────────────────────
record('ES-FAM-1', 'family', 'la mamá de Ofir', resolveRelationalQuery('¿quién es la mamá de Ofir?', 'es'),
  [['names Mor', (resolveRelationalQuery('¿quién es la mamá de Ofir?', 'es') ?? '').includes('Mor')]])
record('ES-FAM-2', 'family', 'la bisabuela de Anabel', resolveRelationalQuery('¿quién es la bisabuela de Anabel?', 'es'),
  [['names Abu/Martita', /Abu|Martita/.test(resolveRelationalQuery('¿quién es la bisabuela de Anabel?', 'es') ?? '')]])
record('ES-FAM-3', 'family', 'Mor y Leo (hermanos)', describeRelation('Mor', 'Leo', 'es'),
  [['hermanos', /hermano/i.test(describeRelation('Mor', 'Leo', 'es') ?? '')]])
record('ES-FAM-4', 'family', 'Martita ~ Ari (bisabuela)', describeRelation('מרטיטה', 'ארי', 'es'),
  [['bisabuela', /bisabuela/i.test(describeRelation('מרטיטה', 'ארי', 'es') ?? '')]])

// ── FOLLOW-UP / HONESTY (no invention) ──────────────────────────────────────
record('ES-HON-1', 'honesty', 'la hija de Mor (no existe)', resolveRelationalQuery('¿quién es la hija de Mor?', 'es'),
  [['honest "no tiene"', /no tiene/i.test(resolveRelationalQuery('¿quién es la hija de Mor?', 'es') ?? '')]])
{
  const unknown = resolveRelationalQuery('¿quién es la hija de Zúñiga?', 'es')
  results.push({ id: 'ES-HON-2', cat: 'honesty', q: 'persona desconocida', got: unknown, checks: [['declines (null)', unknown === null]] })
}

// ── CALENDAR (create/read shapers) ──────────────────────────────────────────
record('ES-CAL-1', 'calendar', 'confirmar cita', shapeCreateConfirmES({ title: 'médico', date: '2026-06-23', time: '16:00' } as never),
  [['voseo/agendar', /agend|a las/i.test(shapeCreateConfirmES({ title: 'médico', date: '2026-06-23', time: '16:00' } as never))]])
record('ES-CAL-2', 'calendar', 'guardado', shapeCreateSavedES({ title: 'médico', date: '2026-06-23', time: '16:00' }),
  [['Listo/agendé', /Listo|agend/i.test(shapeCreateSavedES({ title: 'médico', date: '2026-06-23', time: '16:00' }))]])
record('ES-CAL-3', 'calendar', 'cancelado', shapeCreateCancelledES())
record('ES-CAL-4', 'calendar', 'aclarar hora', shapeCreateClarifyES(['time']),
  [['pide hora', /hora/i.test(shapeCreateClarifyES(['time']))]])
record('ES-CAL-5', 'calendar', 'hoy vacío', shapeCalendarAnswerES([], 'today'),
  [['voseo tenés', /tenés|tienes|nada/i.test(shapeCalendarAnswerES([], 'today'))]])

// ── Report ──────────────────────────────────────────────────────────────────
let pass = 0, fail = 0
const lines: string[] = ['# Rioplatense Spanish — Deterministic Scenario Results', '',
  '_Proves the Spanish SHAPING layer (resolver + shapers) is well-formed. NOT a live-model prose score._', '',
  '| ID | Category | Query | Output | Checks |', '|----|----------|-------|--------|--------|']
for (const c of results) {
  const ok = c.checks.every(([, v]) => v)
  if (ok) pass++; else fail++
  const checkStr = c.checks.map(([n, v]) => `${v ? '✅' : '❌'} ${n}`).join('; ')
  lines.push(`| ${c.id} | ${c.cat} | ${c.q} | ${(c.got ?? '∅').replace(/\n/g, ' / ')} | ${checkStr} |`)
}
lines.push('', `**Total: ${results.length} · pass ${pass} · fail ${fail}**`, '',
  '> Live conversational Spanish (warmth, mixed He/Es turns, real-model register) remains BLOCKED_BY_REAL_RUN — see dashboard §6.')
const out = resolve(process.cwd(), 'docs/abuai/SPANISH_SCENARIO_RESULTS.md')
writeFileSync(out, lines.join('\n'), 'utf-8')
console.log(`Spanish deterministic scenarios: ${results.length} total · pass ${pass} · fail ${fail}. Wrote ${out}`)
if (fail > 0) process.exitCode = 1

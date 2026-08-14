/*
 * scripts/eval/scopeInventoryReport.ts — writes the cell-level ledger seed + SCOPE summary.
 * Model-free. Enumerates tools/params/failure-paths, screens, entities, declared-unbuilt
 * capabilities, and (parsed from source) realtime event types + the Layer-1 contract results.
 *   npx vite-node scripts/eval/scopeInventoryReport.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { toolInventory, screenInventory, entityInventory, layer1ToolCells, scopeSummary, DECLARED_UNBUILT_CAPABILITIES } from '../../src/services/qa/scopeInventory'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

// Realtime event types + their handler — parsed mechanically from the liveSession switch.
function realtimeEvents(): string[] {
  const src = readFileSync(join(ROOT, 'src', 'services', 'liveSession.ts'), 'utf8')
  const set = new Set<string>()
  for (const m of src.matchAll(/case '([a-z0-9_.]+)':/gi)) set.add(m[1]!)
  return [...set].sort()
}

const tools = toolInventory()
const summary = scopeSummary()
const events = realtimeEvents()
const l1 = layer1ToolCells()

// The cell-level ledger seed: one row per cell, status = executed(pass/fail) for Layer-1
// contract cells, seeded(not_run) for the behaviour/wiring cells that Layer-2/3 will fill.
type Row = { cell: string; dimension: string; layer: 1 | 2 | 3; status: 'pass' | 'fail' | 'not_run'; detail?: string }
const rows: Row[] = []
for (const c of l1) rows.push({ cell: c.id, dimension: 'tool_schema_contract', layer: 1, status: c.pass ? 'pass' : 'fail', detail: c.check })
for (const t of tools) for (const fp of t.failurePaths) rows.push({ cell: `${t.name}.${fp}`, dimension: 'tool_failure_path', layer: 2, status: 'not_run', detail: 'behaviour — Layer-2 wiring (feed generated args to the handler)' })
for (const s of screenInventory()) rows.push({ cell: `screen.${s}`, dimension: 'screen_render', layer: 2, status: 'not_run', detail: 'browser harness: render, RTL, ≥16px text, no dev text in prod' })
for (const e of events) rows.push({ cell: `event.${e}`, dimension: 'realtime_event_invariant', layer: 2, status: 'not_run', detail: 'invariant on this server event' })
for (const cap of DECLARED_UNBUILT_CAPABILITIES) rows.push({ cell: `decline.${cap.replace(/\s+/g, '_')}`, dimension: 'declared_unbuilt_capability', layer: 3, status: 'not_run', detail: 'model must decline warmly, never pretend' })

const executed = rows.filter((r) => r.status !== 'not_run').length
const pct = ((executed / rows.length) * 100).toFixed(1)

writeFileSync(join(ROOT, 'docs', 'eval', 'SCOPE_INVENTORY.json'), JSON.stringify({
  generated_from: 'code (LIVE_TOOL_SCHEMAS, Screen enum, family_data.json, liveSession switch)',
  summary, realtimeEventCount: events.length, totalRows: rows.length, executedRows: executed, cellCoveragePct: Number(pct), rows,
}, null, 2) + '\n')

const L: string[] = []
L.push('# SCOPE INVENTORY — cell-level ledger (mechanically derived)')
L.push('')
L.push('Derived from the code, not a hand list: LIVE_TOOL_SCHEMAS, the Screen enum, family_data.json,')
L.push('and the liveSession event switch. A tool/screen/event added there appears here automatically.')
L.push('')
L.push(`- tools: ${summary.tools} · tool param cells: ${summary.toolParamCells} · tool failure paths: ${summary.toolFailurePaths}`)
L.push(`- screens: ${summary.screens} · realtime event types: ${events.length}`)
L.push(`- family entities: ${summary.entities} · ordered relationship pairs: ${summary.entityOrderedPairs} (covered by relationMatrix.test)`)
L.push(`- declared-unbuilt capabilities (must decline): ${summary.declaredUnbuiltCapabilities}`)
L.push('')
L.push(`## Layer 1 — tool CONTRACT cells (EXECUTED): ${summary.layer1Passed}/${summary.layer1Cells} pass`)
L.push(summary.layer1Failed.length ? `- FAILURES: ${summary.layer1Failed.join(' · ')}` : '- all contract cells pass (valid types, non-empty descriptions, required⊆properties, unknown-param rejection, well-formed enums)')
L.push('')
L.push(`## Cell-level ledger: ${rows.length} cells seeded · ${executed} executed (${pct}%)`)
L.push('- Layer 1 (executed now): tool-schema contract.')
L.push('- Layer 2 (not_run — next): tool failure-path behaviour (generated args → handler), every screen via a browser harness, realtime-event invariants.')
L.push('- Layer 3 (not_run): declared-unbuilt-capability declines (model behaviour, sampled).')
L.push('')
L.push('Full machine ledger: docs/eval/SCOPE_INVENTORY.json')
L.push('')
L.push('## Uncovered-by-any-domain (explicitly tracked, per the brief)')
L.push('- multi-tool requests in one turn · 50+ turn sessions · anything depending on time passing')
L.push('  (fast-forward, never wait) · every screen render/nav/RTL/text-size via a browser harness.')
writeFileSync(join(ROOT, 'docs', 'eval', 'SCOPE_INVENTORY.md'), L.join('\n') + '\n')
console.log(L.join('\n'))
console.log('\nwritten: docs/eval/SCOPE_INVENTORY.json + .md')

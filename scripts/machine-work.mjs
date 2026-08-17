/*
 * machine-work.mjs — CLI for the Machine Work Completeness Oracle. (C10 / §43)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *   npm run qa:machine-work
 * Reads MACHINE_WORK_GRAPH.json, cross-checks against the authoritative obligation universe, and prints
 * the DERIVED completeness state. Exit 4 (fail-closed) if any required obligation is OMITTED or in an
 * invalid state — MACHINE_CLOSABLE_REMAINING=0 can never be trusted while obligations are omitted.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deriveWorkGraphState, REQUIRED_OBLIGATION_IDS } from './machine-work-graph-lib.mjs'

let registry
try { registry = JSON.parse(readFileSync(resolve('docs/engineering-os/qa/MACHINE_WORK_GRAPH.json'), 'utf8')).obligations }
catch (e) { console.error('MACHINE_WORK_GRAPH.json missing/unreadable: ' + e.message); process.exit(4) }

const s = deriveWorkGraphState(registry, REQUIRED_OBLIGATION_IDS)
console.log(JSON.stringify({
  REQUIRED_MACHINE_OBLIGATIONS_TOTAL: s.REQUIRED_MACHINE_OBLIGATIONS_TOTAL,
  TERMINAL_MACHINE_OBLIGATIONS: s.TERMINAL_MACHINE_OBLIGATIONS,
  NONTERMINAL_MACHINE_OBLIGATIONS: s.NONTERMINAL_MACHINE_OBLIGATIONS,
  OMITTED_MACHINE_OBLIGATIONS: s.OMITTED_MACHINE_OBLIGATIONS,
  MACHINE_CLOSABLE_REMAINING: s.MACHINE_CLOSABLE_REMAINING,
  omitted: s.omitted, duplicates: s.duplicates, invalidState: s.invalidState,
  terminalWithoutEvidence: s.terminalWithoutEvidence,
  nonTerminal: s.nonTerminal,
}, null, 2))
console.log(`\n=== work-graph: OMITTED=${s.OMITTED_MACHINE_OBLIGATIONS} · NONTERMINAL=${s.NONTERMINAL_MACHINE_OBLIGATIONS} · MACHINE_CLOSABLE_REMAINING=${s.MACHINE_CLOSABLE_REMAINING} · integrity ${s.ok ? 'OK' : 'FAIL'} ===`)
process.exit(s.ok ? 0 : 4)

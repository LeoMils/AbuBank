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
  EXTERNAL_BLOCKED_REMAINING: s.EXTERNAL_BLOCKED_REMAINING,
  OWNER_AUTHORITY_REMAINING: s.OWNER_AUTHORITY_REMAINING,
  HUMAN_RESIDUAL_REMAINING: s.HUMAN_RESIDUAL_REMAINING,
  omitted: s.omitted, duplicates: s.duplicates, invalidState: s.invalidState,
  nonTerminalNotMachineClosable: s.nonTerminalNotMachineClosable,
  terminalWithoutEvidence: s.terminalWithoutEvidence,
  machineClosableList: s.machineClosableList,
  externalBlockedList: s.externalBlockedList,
}, null, 2))
console.log(`\n=== work-graph: OMITTED=${s.OMITTED_MACHINE_OBLIGATIONS} · MACHINE_CLOSABLE_REMAINING=${s.MACHINE_CLOSABLE_REMAINING} · EXTERNAL_BLOCKED=${s.EXTERNAL_BLOCKED_REMAINING} · OWNER=${s.OWNER_AUTHORITY_REMAINING} · HUMAN=${s.HUMAN_RESIDUAL_REMAINING} · integrity ${s.ok ? 'OK' : 'FAIL'} ===`)
process.exit(s.ok ? 0 : 4)

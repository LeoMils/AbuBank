/*
 * report.test.ts — the text-harness REPORT run (Vite-aware, so `?raw` resolves).
 * ════════════════════════════════════════════════════════════════════════════
 * Run ONLY when TEXT_HARNESS_RUN=1 (the qa gate sets it). In a normal `npm test`
 * it is skipped so the suite stays fast/offline. When it runs it:
 *   • prints the EXACT build-time session instructions string;
 *   • reports the word count of abu-persona.md, abu-family.md, abu-knowledge.md;
 *   • drives all 43 scenarios through the shared live-path reasoning/tool/turn loop
 *     via the environment's model driver (real OpenAI when a key is present; else
 *     BLOCKED — never faked);
 *   • prints, per scenario, the full transcript, every tool call (args + results),
 *     and every violation flag;
 *   • writes a machine-readable JSON report and prints a pass/fail/blocked summary.
 * It never fails the suite — this milestone makes failures VISIBLE, it does not fix
 * them.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildLiveInstructions, auditInstructionsVsTools } from '../liveInstructions'
import { runScenarios } from './runner'
import { resolveDefaultDriver } from './drivers'
import { SCENARIOS } from './scenarios'
import type { ScenarioResult } from './types'

const RUN = process.env.TEXT_HARNESS_RUN === '1'
const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..')
const KNOWLEDGE = resolve(REPO, 'knowledge')
const OUT_JSON = resolve(REPO, 'docs', 'eval', 'TEXT_HARNESS_RESULTS.json')

function wordCount(rel: string): number {
  try { return readFileSync(resolve(KNOWLEDGE, rel), 'utf8').trim().split(/\s+/).filter(Boolean).length }
  catch { return -1 }
}

function printScenario(r: ScenarioResult): void {
  const line = '─'.repeat(72)
  console.log(`\n${line}\n[${r.status}] ${r.id} — ${r.title}`)
  if (r.status === 'BLOCKED') { console.log(`  BLOCKED: ${r.blockedReason}`); return }
  console.log('  transcript:')
  for (const t of r.transcript) console.log(`    ${t.role === 'user' ? '👤' : '🤖'} (t${t.turn}${t.phase ? '/' + t.phase : ''}) ${t.text}`)
  if (r.toolCalls.length) {
    console.log('  tool calls:')
    for (const c of r.toolCalls) console.log(`    🔧 t${c.turn} ${c.name}(${JSON.stringify(c.args)}) → ${JSON.stringify(c.result)}`)
  }
  console.log(`  persisted calendar: ${JSON.stringify(r.persistedCalendar)}`)
  if (r.violations.length) {
    console.log('  VIOLATIONS:')
    for (const v of r.violations) console.log(`    ⚠️  [${v.code}] t${v.turn}: ${v.detail}`)
  } else {
    console.log('  violations: none')
  }
}

describe.skipIf(!RUN)('TEXT HARNESS — full report run', () => {
  it('runs all 43 scenarios and reports (always passes; failures are surfaced, not fixed)', async () => {
    const counts = {
      'abu-persona.md': wordCount('abu-persona.md'),
      'abu-family.md': wordCount('abu-family.md'),
      'abu-knowledge.md': wordCount('abu-knowledge.md'),
    }
    const instructions = buildLiveInstructions()
    const driver = resolveDefaultDriver()

    console.log('\n' + '='.repeat(72))
    console.log('EXACT BUILD-TIME SESSION INSTRUCTIONS (buildLiveInstructions):')
    console.log('='.repeat(72))
    console.log(instructions)
    console.log('='.repeat(72))
    console.log('KNOWLEDGE FILE WORD COUNTS:')
    for (const [f, n] of Object.entries(counts)) console.log(`  ${f}: ${n} words`)
    console.log(`MODEL DRIVER: ${driver.label} (available=${driver.available})`)
    console.log('='.repeat(72))

    const results = await runScenarios(SCENARIOS, driver)
    for (const r of results) printScenario(r)

    const summary = {
      total: results.length,
      pass: results.filter((r) => r.status === 'PASS').length,
      fail: results.filter((r) => r.status === 'FAIL').length,
      blocked: results.filter((r) => r.status === 'BLOCKED').length,
    }

    console.log('\n' + '='.repeat(72))
    console.log(`SUMMARY: ${summary.pass}/${summary.total} PASS · ${summary.fail} FAIL · ${summary.blocked} BLOCKED`)
    console.log('='.repeat(72))

    try {
      mkdirSync(dirname(OUT_JSON), { recursive: true })
      writeFileSync(OUT_JSON, JSON.stringify({
        generatedFor: 'text-harness',
        driver: driver.label,
        wordCounts: counts,
        instructionsChars: instructions.length,
        summary,
        results: results.map((r) => ({
          id: r.id, title: r.title, status: r.status, blockedReason: r.blockedReason,
          violations: r.violations, toolCalls: r.toolCalls, transcript: r.transcript,
          persistedCalendar: r.persistedCalendar,
        })),
      }, null, 2) + '\n')
      console.log(`Wrote ${OUT_JSON}`)
    } catch (e) { console.log('Could not write JSON report:', (e as Error).message) }

    // Never fails the suite — the report IS the deliverable.
    expect(results).toHaveLength(43)
  }, 300_000)
})

// Keep the file non-empty when skipped so vitest reports a clean pass.
describe('TEXT HARNESS — report file loads', () => {
  it('has 43 scenarios wired', () => { expect(SCENARIOS).toHaveLength(43) })

  // GATE GUARD (always on, even when the scenario run is skipped): the instructions
  // must never imply a capability with no tool. This is what makes the honesty
  // removal permanent — a re-added claim fails the qa:production-gate, never silent.
  it('GATE: instructions imply no capability without a registered tool', () => {
    const violations = auditInstructionsVsTools()
    if (violations.length) console.log('INSTRUCTIONS_VS_TOOLS_VIOLATIONS:\n  ' + violations.join('\n  '))
    expect(violations).toEqual([])
  })
})

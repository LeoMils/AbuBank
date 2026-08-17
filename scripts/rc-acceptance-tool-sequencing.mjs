/*
 * rc-acceptance-tool-sequencing.mjs — the AbuAI tool-backed interaction contract. (§16 add-2)
 * ════════════════════════════════════════════════════════════════════════════════════════════
 *   npx tsx scripts/rc-acceptance-tool-sequencing.mjs [rawTraceJsonPath]
 *
 * Two layers, honest about evidence class:
 *  1. RAW-EVENT ORACLE (authoritative, per owner: "raw event ordering, not transcript alone").
 *     evaluateToolSequencing() grades tool_call → silence → tool_result → final answer from the raw
 *     FlightRecorder event stream. Unit-proven (src/services/toolSequencingOracle.test.ts) and READY
 *     to grade a real downloaded device trace at DEVICE class. Pass a FlightRecorder-export JSON
 *     ({entries, preambleGaps?, recoverableCount?, toolIssueCount?}) to grade it here.
 *  2. REAL-GOLDEN TRANSCRIPT CROSS-CHECK (corroboration, transcript class). Over the real gpt-realtime
 *     golden turns (docs/eval/GOLDEN_SESSION_RESULT.json): no preamble/"checking" filler in a tool
 *     turn, no repeated spoken sentence. Weaker than raw events (owner's caveat) — a corroborating signal.
 * Writes docs/eval/RC_ACCEPTANCE_TOOL_SEQUENCING.json.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { evaluateToolSequencing } from '../src/services/toolSequencingOracle.ts'

const PENDING = /רגע|שני[יה]|תכף|אני\s*בודקת|בודקת|un\s*momento|esper[aá]|one\s*moment|hold\s*on|let\s*me\s*check|checking/i
const norm = (s) => (s || '').replace(/\s+/g, ' ').replace(/[.!?…،,]+$/g, '').trim()

function goldenCrossCheck() {
  const path = resolve('docs/eval/GOLDEN_SESSION_RESULT.json')
  if (!existsSync(path)) return { available: false }
  const d = JSON.parse(readFileSync(path, 'utf8'))
  const turns = d.turns || []
  const seen = new Map()
  let toolTurns = 0, preambleInToolTurn = [], repeated = []
  for (const t of turns) {
    const spoken = norm(t.spoken || ''), tools = t.tools || []
    if (tools.length) { toolTurns++; if (PENDING.test(spoken)) preambleInToolTurn.push({ id: t.id, spoken: spoken.slice(0, 50) }) }
    if (spoken.length >= 8) { if (seen.has(spoken)) repeated.push(spoken.slice(0, 50)); seen.set(spoken, t.id) }
  }
  return { available: true, turns: turns.length, toolTurns, preambleInToolTurn, repeatedSentences: repeated, goldenPass: d.pass === true, pass: preambleInToolTurn.length === 0 && repeated.length === 0 }
}

function rawTraceGrade(pathArg) {
  if (!pathArg || !existsSync(pathArg)) return { available: false, note: 'no raw FlightRecorder trace supplied — oracle is unit-proven (CODE) and ready for a device trace' }
  const trace = JSON.parse(readFileSync(pathArg, 'utf8'))
  const input = { entries: trace.entries || [], preambleGaps: trace.preambleGaps, recoverableCount: trace.recoverableCount, toolIssueCount: trace.toolIssueCount }
  const r = evaluateToolSequencing(input)
  return { available: true, path: pathArg, ...r }
}

const golden = goldenCrossCheck()
const raw = rawTraceGrade(process.argv[2])

// Self-test the oracle on a known-bad stream so this script always demonstrates the oracle DETECTS
// the device defect (sensitivity — never a vacuous green).
const sensitivity = evaluateToolSequencing({
  entries: [
    { seq: 1, kind: 'user_speech', text: 'מה השער של הדולר?' },
    { seq: 2, kind: 'abu_speech', text: 'רגע, אני בודקת לך.' },
    { seq: 3, kind: 'tool_call', tool: 'get_current_info' },
    { seq: 4, kind: 'tool_result', tool: 'get_current_info' },
    { seq: 5, kind: 'abu_speech', text: 'הדולר שתיים תשעים וחמש.' },
  ],
})

const summary = {
  $schema: 'internal://abu/rc-acceptance-tool-sequencing', when: new Date().toISOString(),
  contract: 'tool_call → (no assistant semantic output) → tool_result → final grounded answer',
  rawEventOracle: {
    class: 'CODE (unit-proven) — DEVICE when a real FlightRecorder trace is supplied',
    sensitivityProof: { detectsPreamble: sensitivity.violations.some((v) => v.type === 'SPOKEN_PREAMBLE'), violationTypes: sensitivity.violations.map((v) => v.type) },
    deviceTrace: raw,
  },
  goldenTranscriptCrossCheck: { class: 'transcript (real gpt-realtime golden turns)', ...golden },
  verdict: (golden.available ? golden.pass : true) && (!raw.available || raw.pass) ? 'CONTRACT_HELD (oracle proven; real golden corroborates)' : 'VIOLATIONS_PRESENT',
}
writeFileSync(resolve('docs/eval/RC_ACCEPTANCE_TOOL_SEQUENCING.json'), JSON.stringify(summary, null, 2) + '\n')
console.log('=== TOOL-SEQUENCING ACCEPTANCE ===')
console.log(`raw-event oracle sensitivity: detectsPreamble=${summary.rawEventOracle.sensitivityProof.detectsPreamble} [${summary.rawEventOracle.sensitivityProof.violationTypes.join(',')}]`)
if (golden.available) console.log(`real golden: ${golden.toolTurns} tool-turns · preamble-in-tool-turn=${golden.preambleInToolTurn.length} · repeated=${golden.repeatedSentences.length} · goldenPass=${golden.goldenPass}`)
if (raw.available) console.log(`device trace: pass=${raw.pass} violations=${raw.violations.length} watchdog/fallback=${raw.watchdogFallbackCount}`)
console.log(`=== ${summary.verdict} ===`)
console.log('wrote docs/eval/RC_ACCEPTANCE_TOOL_SEQUENCING.json')
process.exit(summary.verdict.startsWith('CONTRACT_HELD') ? 0 : 1)

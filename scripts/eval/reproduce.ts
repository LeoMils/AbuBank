/*
 * scripts/eval/reproduce.ts — PHASE 0 reproduction gate.
 * ════════════════════════════════════════════════════════════════════════════
 * Replays the FOUR exchange TYPES named in the run spec through the real realtime
 * harness (gpt-realtime + Abu's buildSessionUpdate + LiveTools, text output):
 *   1. Kfar Saba cinema   2. Bleu de Chanel price
 *   3. Adi/Leo relation   4. "remind me in a minute"
 *
 * HONEST NOTE: the owner's actual desktop session trace is NOT present in this repo
 * (grep for "הערה לקלוד" / the annotations / the transcript = 0 hits). So these are
 * RECONSTRUCTED from the descriptions, not the verbatim exchanges, and there are no
 * human labels to match against. We report the OBSERVED realtime behavior and judge
 * whether each described failure CLASS reproduces.
 */
import './nodeShim'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runConversationRealtime } from './realtimeRunner'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  try {
    for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
      let v = m[2]!; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      env[m[1]!] = v
    }
  } catch { /* */ }
  return { ...env, ...process.env as Record<string, string> }
}

const PROBES = [
  { id: 'cinema', user: 'איזה סרטים רצים בכפר סבא היום?', failClass: 'online returns snippets/landing pages, not real film names' },
  { id: 'price', user: 'כמה עולה הבושם בלו דה שאנל?', failClass: 'online returns a snippet/forum comment, not a real price' },
  { id: 'relation', user: 'מה הקשר בין עדי ללאו?', failClass: 'family relationship error / invented relation' },
  { id: 'reminder', user: 'תזכירי לי בעוד דקה לשתות מים', failClass: 'no reminder capability — refuses or fakes it' },
]

async function main() {
  const env = loadEnv()
  const openaiKey = env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY
  if (!openaiKey) { console.error('BLOCKED: no OPENAI_API_KEY'); process.exit(2) }
  const braveKey = env.BRAVE_API_KEY
  const model = env.EVAL_REALTIME_MODEL || 'gpt-realtime'

  console.log('════════════════════════════════════════════════════════════════')
  console.log(`PHASE 0 — REPRODUCTION GATE · model=${model} (text output) · brave=${braveKey ? 'live' : 'MISSING'}`)
  console.log('NOTE: owner trace absent from repo → probes reconstructed from descriptions.')
  console.log('════════════════════════════════════════════════════════════════')

  for (const p of PROBES) {
    const [rec] = await runConversationRealtime([p.user], { openaiKey, braveKey, model })
    console.log(`\n[${p.id}] user: ${p.user}`)
    console.log(`  tools:      ${rec!.toolCalls.map((t) => `${t.name}(${JSON.stringify(t.args).slice(0, 60)})`).join(', ') || '(none)'}`)
    console.log(`  preTool:    ${rec!.emittedTextBeforeToolResult}  ${rec!.preambleText ? '→ ' + JSON.stringify(rec!.preambleText.slice(0, 120)) : ''}`)
    console.log(`  ttft(ms):   ${rec!.ttftMs}   total(ms): ${rec!.totalMs}`)
    console.log(`  said:       ${JSON.stringify((rec!.text || rec!.error || '').slice(0, 400))}`)
    console.log(`  fail-class watched: ${p.failClass}`)
  }
  console.log('\n════════════════════════════════════════════════════════════════')
}
main().catch((e) => { console.error('REPRO_ERROR', e?.stack || e?.message || String(e)); process.exit(1) })

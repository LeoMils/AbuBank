/*
 * scripts/eval/monitorProbe.ts — M2: measure the output monitor's interception on REAL output.
 * Runs a few varied turns on the realtime instrument, applies the deterministic monitor to each
 * spoken transcript, and reports which violations it would intercept. The monitor is pure/sync,
 * so its added latency is ~0ms with the repair flag OFF (observation only) — reported as such.
 *   npx vite-node scripts/eval/monitorProbe.ts
 */
import './nodeShim'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runConversationRealtime } from './realtimeRunner'
import { firstWinsOnlineFetch } from '../../src/services/online/firstWinsFetch'
import { monitorTurn } from '../../src/services/monitor/outputMonitor'

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
  'מי זאת מור?',
  'מה הקשר בין עדי ללאו?',
  'כמה עולה הבושם בלו דה שאנל?',
  'תזמיני לי מונית לשדה התעופה',
  'ספרי לי בדיחה',
]

async function main() {
  const env = loadEnv()
  const openaiKey = env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY
  if (!openaiKey) { console.error('BLOCKED: no OPENAI_API_KEY'); process.exit(2) }
  const braveKey = env.BRAVE_API_KEY
  const model = env.EVAL_REALTIME_MODEL || 'gpt-realtime'
  const onlineFetch = firstWinsOnlineFetch({ braveKey, openaiKey })
  const allowLong = (q: string) => /בדיחה|סיפור|חידה|שיר/.test(q)

  let turns = 0, withViolation = 0
  for (const q of PROBES) {
    const [r] = await runConversationRealtime([q], { openaiKey, braveKey, model, onlineFetch })
    const said = (r!.text || '').trim()
    const vs = monitorTurn(said, { userText: q, allowLong: allowLong(q) })
    turns++; if (vs.length) withViolation++
    console.log(`\n[${q}]`)
    console.log(`  said: ${JSON.stringify(said.slice(0, 180))}`)
    console.log(`  monitor: ${vs.length ? vs.map((v) => `${v.kind}:${v.severity}`).join(', ') : 'clean'}`)
  }
  console.log(`\n════ interception: ${withViolation}/${turns} turns had a deterministic violation`)
  console.log('monitor latency added: ~0ms (pure sync); repair flag OFF → 0 warmth/latency impact')
}
main().catch((e) => { console.error('MONITOR_PROBE_ERROR', e?.stack || e?.message || String(e)); process.exit(1) })

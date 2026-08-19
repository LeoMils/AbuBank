/*
 * scripts/eval/priceProbe.ts — agent A: does PAGE-content first-wins surface a real price?
 * ════════════════════════════════════════════════════════════════════════════
 * BEFORE = the snippet path (realtimeRunner's default Brave-description fetch — the current
 * behaviour: the perfume query returns stores/landing text, no price). AFTER = the SAME
 * realtime model with the online seam swapped to first-wins PAGE fetch (firstWinsOnlineFetch).
 * Two queries — perfume PRICE + Kfar Saba CINEMA — measured on the real instrument, one reused
 * connection per mode, paced. Reports: real-price present? real-films present? ttft (first
 * SPOKEN token, now fixed) + total latency. Never faked — a transport failure is reported.
 */
import './nodeShim'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runConversationRealtime, type TurnRecord } from './realtimeRunner'
import { firstWinsOnlineFetch } from '../../src/services/online/firstWinsFetch'

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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const PRICE_TOKEN = /(?:₪|\$|€)\s?\d[\d.,]*|\d[\d.,]*\s?(?:₪|\$|€|ש["״]?ח|שקל(?:ים)?|יורו|דולר|dollars?|euros?)/i
const PERFUME = 'כמה עולה הבושם בלו דה שאנל?'
const CINEMA = 'איזה סרטים רצים בכפר סבא היום?'
// M4 acceptance: three differently-phrased price questions about the SAME product → consistent range.
const PERFUME_PHRASINGS = [
  'כמה עולה הבושם בלו דה שאנל?',
  'מה המחיר של בלו דה שאנל?',
  'בכמה יוצא בושם בלו דה שאנל?',
]

function report(mode: string, recs: TurnRecord[]) {
  recs.forEach((r) => {
    const said = (r.text || r.error || '').trim()
    const isPrice = /עולה|מחיר|בושם|שאנל/.test(r.user)
    const hit = isPrice ? PRICE_TOKEN.test(said) : /סרט|גבעה|דרדס|לוליטה|מקרינ|הקרנ/.test(said)
    console.log(`\n[${mode}] ${r.user}`)
    console.log(`  tools:  ${r.toolCalls.map((t) => t.name).join(', ') || '(none)'}`)
    console.log(`  ${isPrice ? 'REAL PRICE' : 'REAL FILMS'}: ${hit ? 'YES ✓' : 'NO ✗'}`)
    console.log(`  ttft(first spoken token): ${r.ttftMs}ms   total: ${r.totalMs}ms`)
    console.log(`  said:   ${JSON.stringify(said.slice(0, 260))}`)
  })
}

async function main() {
  const env = loadEnv()
  const openaiKey = env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY
  if (!openaiKey) { console.error('BLOCKED: no OPENAI_API_KEY'); process.exit(2) }
  const braveKey = env.BRAVE_API_KEY
  const model = env.EVAL_REALTIME_MODEL || 'gpt-realtime'

  console.log('════════════════════════════════════════════════════════════════')
  console.log(`AGENT A — online DEPTH price probe · ${model} · brave=${braveKey ? 'live' : 'MISSING'}`)
  console.log('════════════════════════════════════════════════════════════════')

  console.log('\n──── BEFORE: snippet path (default Brave description) ────')
  const before = await runConversationRealtime([PERFUME, CINEMA], { openaiKey, braveKey, model })
  report('before', before)

  await sleep(2500)

  console.log('\n──── AFTER: first-wins PAGE fetch + relevance gate + synthesis ────')
  const onlineFetch = firstWinsOnlineFetch({ braveKey, openaiKey, softBudgetMs: 4000, hardCeilingMs: 6000 })
  const after = await runConversationRealtime([PERFUME, CINEMA], { openaiKey, braveKey, model, onlineFetch })
  report('after', after)

  await sleep(2500)
  console.log('\n──── M4 ACCEPTANCE: three phrasings of the SAME product → consistent range ────')
  for (const q of PERFUME_PHRASINGS) {
    const [r] = await runConversationRealtime([q], { openaiKey, braveKey, model, onlineFetch })
    const said = (r!.text || r!.error || '').trim()
    console.log(`\n[phrasing] ${q}`)
    console.log(`  REAL PRICE: ${PRICE_TOKEN.test(said) ? 'YES ✓' : 'NO ✗'}   ttft ${r!.ttftMs}ms total ${r!.totalMs}ms`)
    console.log(`  said: ${JSON.stringify(said.slice(0, 220))}`)
    await sleep(1500)
  }
  console.log('\n════════════════════════════════════════════════════════════════')
}
main().catch((e) => { console.error('PRICE_PROBE_ERROR', e?.stack || e?.message || String(e)); process.exit(1) })

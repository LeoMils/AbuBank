/*
 * scripts/eval/relationProbe.ts — agent D: the ONE model question, low-volume realtime.
 * ════════════════════════════════════════════════════════════════════════════
 * Everything else in G/D is deterministic (bundle size, the pair matrix, payload has no
 * URL). The only thing that needs the model: with the family portrait removed, does a
 * relation/who/relatives query now PRODUCE a people_lookup call (grounding on the resolver)
 * instead of answering from the prompt? Baseline (pre-G) = ZERO tool calls (reproduce.ts).
 *
 * VOLUME DISCIPLINE (per the throttle finding): the realtime GA WS throttles when hammered,
 * so this REUSES ONE connection across all probe turns (runConversationRealtime takes a turn
 * array and keeps one WS), paces turns, and retries the whole conversation with exponential
 * backoff on a connect failure. A sub-500ms EMPTY turn is a transport failure, never counted
 * as "no tool call". Two short conversations only: the relation probe + a collateral spot-check.
 *
 *   npx vite-node scripts/eval/relationProbe.ts
 */
import './nodeShim'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runConversationRealtime, type TurnRecord } from './realtimeRunner'

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

/** A turn is a transport failure (NOT a real "no tool call") when it errored or came back
 *  empty in under 500ms — a connect/session drop, never a score. */
function isTransport(rec: TurnRecord): boolean {
  return !!rec.error || (rec.totalMs < 500 && !(rec.text ?? '').trim() && rec.toolCalls.length === 0)
}

/** Run a whole conversation over ONE reused WS connection; retry the conversation with
 *  exponential backoff if it comes back all-transport-failure (throttle/connect drop). */
async function probeConversation(turns: string[], opts: { openaiKey: string; braveKey?: string; model?: string }): Promise<TurnRecord[]> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const recs = await runConversationRealtime(turns, opts)
    if (!recs.every(isTransport)) return recs
    const backoff = 2000 * 2 ** attempt
    console.error(`  ⚠ transport failure on all turns (attempt ${attempt + 1}) — backing off ${backoff}ms`)
    await sleep(backoff)
  }
  return runConversationRealtime(turns, opts)
}

// Relation / who / relatives queries — each MUST ground on people_lookup now.
const RELATION_TURNS = [
  'מה הקשר בין עדי ללאו?',      // the trace pair (INC-04)
  'מה הקשר בין מור ללאו?',
  'מי זאת מור?',                 // who
  'מי הילדים של מור?',           // relatives
  'מה הקשר בין אופיר לעדי?',
]
// Collateral spot-check — other categories must NOT regress from the portrait removal.
const COLLATERAL_TURNS: Array<{ q: string; want: string }> = [
  { q: 'איזה סרטים רצים בכפר סבא היום?', want: 'get_current_info' },
  { q: 'מה יש לי מחר ביומן?', want: 'read_calendar' },
  { q: 'תשלחי הודעה למור שאני חושבת עליה', want: 'whatsapp_draft|people_lookup' },
]

async function main() {
  const env = loadEnv()
  const openaiKey = env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY
  if (!openaiKey) { console.error('BLOCKED: no OPENAI_API_KEY'); process.exit(2) }
  const braveKey = env.BRAVE_API_KEY
  const model = env.EVAL_REALTIME_MODEL || 'gpt-realtime'
  const opts = { openaiKey, braveKey, model }

  console.log('════════════════════════════════════════════════════════════════')
  console.log(`AGENT D — relation probe (post-G) · ${model} · ONE connection, paced`)
  console.log('BEFORE (pre-G baseline, from reproduce.ts): relation → 0 tool calls (answered from portrait)')
  console.log('════════════════════════════════════════════════════════════════')

  const relRecs = await probeConversation(RELATION_TURNS, opts)
  let grounded = 0, counted = 0
  for (const r of relRecs) {
    if (isTransport(r)) { console.log(`\n[relation] ${r.user}\n  ⚠ TRANSPORT FAILURE — excluded (${r.error ?? 'empty <500ms'})`); continue }
    counted++
    const calledPeople = r.toolCalls.some((t) => t.name === 'people_lookup')
    if (calledPeople) grounded++
    console.log(`\n[relation] ${r.user}`)
    console.log(`  tools:    ${r.toolCalls.map((t) => `${t.name}(${JSON.stringify(t.args).slice(0, 50)})`).join(', ') || '(none)'}`)
    console.log(`  people_lookup called: ${calledPeople ? 'YES ✓' : 'NO ✗'}`)
    console.log(`  said:     ${JSON.stringify((r.text || r.error || '').slice(0, 220))}`)
    console.log(`  latency:  ${r.totalMs}ms`)
  }

  await sleep(2000)
  console.log('\n──────── collateral spot-check (no regression from the removal) ────────')
  const colRecs = await probeConversation(COLLATERAL_TURNS.map((c) => c.q), opts)
  colRecs.forEach((r, i) => {
    const want = COLLATERAL_TURNS[i]!.want
    if (isTransport(r)) { console.log(`\n[collateral] ${r.user}\n  ⚠ TRANSPORT FAILURE — inconclusive`); return }
    const names = r.toolCalls.map((t) => t.name)
    const ok = new RegExp(want).test(names.join(','))
    console.log(`\n[collateral] ${r.user}`)
    console.log(`  tools:    ${names.join(', ') || '(none)'}   want≈/${want}/ → ${ok ? 'OK ✓' : 'CHECK ✗'}`)
    console.log(`  said:     ${JSON.stringify((r.text || r.error || '').slice(0, 200))}`)
  })

  console.log('\n════════════════════════════════════════════════════════════════')
  console.log(`RELATION TOOL-CALL RATE (post-G): ${grounded}/${counted} produced a people_lookup call`)
  console.log('BEFORE→AFTER: 0/5 (answered from prompt)  →  ' + `${grounded}/${counted} (grounded on the resolver)`)
  console.log('════════════════════════════════════════════════════════════════')
}
main().catch((e) => { console.error('PROBE_ERROR', e?.stack || e?.message || String(e)); process.exit(1) })

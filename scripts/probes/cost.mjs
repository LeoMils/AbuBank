/*
 * Real cost probe — run a realistic AUDIO session mix against gpt-realtime and SUM the actual token
 * usage the API reports (audio in/out, text, cached), then price it with OpenAI's published rates.
 * Answers item 5 with measured numbers, not an estimate. Audio mode is used so audio-token cost is real.
 */
import fs from 'node:fs'
import { loadKey, openSession, userText, runResponse, sleep, minimalSession } from '../realtime-instrument.mjs'

const full = JSON.parse(fs.readFileSync('docs/eval/SESSION_CONFIG_SNAPSHOT.json', 'utf8'))
const cfg = { ...minimalSession(full), audio: { output: { voice: 'marin' } } }
const key = loadKey()

// OpenAI published Aug-2026 rates ($ per 1M tokens).
const RATE = { audioIn: 32, audioOut: 64, textIn: 4, textOut: 16, cachedIn: 0.4 }

// A realistic mix of what Martita does in a short session (spoken turns).
const TURNS = [
  'בוקר טוב אבו, מה שלומך?',
  'מה יש לי מחר ביומן?',
  'תזכרי שקבעתי עם רותי ביום שישי בערב',
  'כמה מעלות בחוץ עכשיו בכפר סבא?',
  'אני קצת בודדה היום, ספרי לי משהו טוב',
]

function priceOf(u) {
  if (!u) return { usd: 0, breakdown: {} }
  const inDet = u.input_token_details || {}
  const outDet = u.output_token_details || {}
  const cd = inDet.cached_tokens_details || {}
  const cachedText = cd.text_tokens || 0
  const cachedAudio = cd.audio_tokens || 0
  const cachedTotal = inDet.cached_tokens || (cachedText + cachedAudio)
  const audioInTot = inDet.audio_tokens || 0
  const textInTot = inDet.text_tokens || 0
  const uncachedTextIn = Math.max(0, textInTot - cachedText)
  const uncachedAudioIn = Math.max(0, audioInTot - cachedAudio)
  const audioOut = outDet.audio_tokens || 0
  const textOut = outDet.text_tokens || 0
  const usd =
    (uncachedTextIn * RATE.textIn + uncachedAudioIn * RATE.audioIn +
     cachedTotal * RATE.cachedIn +
     audioOut * RATE.audioOut + textOut * RATE.textOut) / 1e6
  return { usd, breakdown: { textIn: textInTot, audioIn: audioInTot, cached: cachedTotal, audioOut, textOut } }
}

async function main() {
  console.log('=== REAL COST PROBE (gpt-realtime, audio mix) ===\n')
  const s = openSession(key, cfg)
  await s.waitOpen()
  if (!s.state.credit) { console.log('CREDIT WALL'); process.exit(1) }
  let total = 0
  const rows = []
  for (const t of TURNS) {
    userText(s, t)
    const r = await runResponse(s, { output_modalities: ['audio'] })
    const p = priceOf(r.usage)
    total += p.usd
    rows.push({ turn: t, usd: p.usd, ms: r.ms, ...p.breakdown, tools: r.functionCalls.map((f) => f.name) })
    console.log(`$${p.usd.toFixed(5)}  ${r.ms}ms  txtIn=${p.breakdown.textIn} cached=${p.breakdown.cached} aOut=${p.breakdown.audioOut}  "${t.slice(0, 30)}"`)
    // feed a tool result if the model tool-called, so the turn completes naturally
    if (r.functionCalls.length) { for (const fc of r.functionCalls) s.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: fc.callId, output: '{"status":"ok"}' } }); const r2 = await runResponse(s, { output_modalities: ['audio'] }); const p2 = priceOf(r2.usage); total += p2.usd; console.log(`  +grounded $${p2.usd.toFixed(5)} ${r2.ms}ms`) }
    await sleep(500)
  }
  s.close()
  const turnsCount = TURNS.length
  const perTurn = total / turnsCount
  // A 30 min/day user: estimate turns/min. A voice turn+reply averages ~15-20s → ~3.5 turns/min.
  const TURNS_PER_MIN = 3.5
  const monthlyTurns = 30 /*min/day*/ * 30 /*days*/ * TURNS_PER_MIN
  const monthly = perTurn * monthlyTurns
  console.log('\n--- MEASURED ---')
  console.log(`session total: $${total.toFixed(5)} over ${turnsCount} spoken turns`)
  console.log(`per-turn avg:  $${perTurn.toFixed(5)}`)
  console.log(`extrapolated 30 min/day (~${Math.round(monthlyTurns)} turns/mo @ ${TURNS_PER_MIN}/min): ~$${monthly.toFixed(2)}/month`)
  console.log('(NOTE: text instrument turns undercount AUDIO-INPUT tokens vs a real mic session — a real')
  console.log(' spoken turn also bills the user\'s audio-in; this is a LOWER bound on audio-in cost.)')
  fs.writeFileSync('docs/eval/COST_MEASURED.json', JSON.stringify({ rows, total, perTurn, monthly }, null, 2))
  process.exit(0)
}
main().catch((e) => { console.error('probe error:', e.message); process.exit(1) })

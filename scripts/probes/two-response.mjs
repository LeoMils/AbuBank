/*
 * Probe: does the two-response scheme put the ANSWER first instead of a spoken preamble?
 * Drives the REAL gpt-realtime model over the WS text instrument with the SHIPPING instructions +
 * tools. A tool-requiring query (a price) is run two ways, N times each (model behaviour varies):
 *   BASELINE  — first response is AUDIO+TEXT (what create_response:true produces): the tool-selecting
 *               response may SPEAK a preamble ("רגע, אני בודקת…") before the grounded answer.
 *   TWO-RESP  — first (decision) response is TEXT-ONLY → no preamble can be voiced; a SECOND audio
 *               response speaks the grounded answer after the tool result.
 * We report, for each, whether the FIRST HEARD words are a preamble or the answer.
 */
import fs from 'node:fs'
import { loadKey, openSession, userText, toolResult, runResponse, sleep, minimalSession } from '../realtime-instrument.mjs'

const full = JSON.parse(fs.readFileSync('docs/eval/SESSION_CONFIG_SNAPSHOT.json', 'utf8'))
const cfg = minimalSession(full)
const key = loadKey()
const QUERY = 'כמה עולה הבושם בלו דה שאנל?'   // a price → forces get_current_info, tends to induce a preamble
const N = Number(process.env.N || 3)
const PREAMBLE = /(רגע|שני[יה]|תכף|אני בודקת|אני מבררת|בוא[ינ]? נבדוק|תני לי רגע|אחפש|נבדוק)/

// A mock tool result so the model can produce the grounded answer on the instrument.
const MOCK_PRICE = JSON.stringify({ result: 'Bleu de Chanel EDP 100ml — כ-450 ש"ח ברשתות בישראל', source: 'probe-mock' })

function firstWords(t) { return (t || '').replace(/\s+/g, ' ').trim().slice(0, 40) }

// In BASELINE the FIRST response is what the server would SPEAK — so its text is the heard-first.
async function baselineTurn(session) {
  userText(session, QUERY)
  const r1 = await runResponse(session, { output_modalities: ['text'] })
  // (drain the tool turn so the session is clean; not part of the heard-first judgement)
  if (r1.functionCalls.length) { toolResult(session, r1.functionCalls[0].callId, MOCK_PRICE); await runResponse(session, { output_modalities: ['text'] }) }
  return { heardFirst: r1.text, preamble: PREAMBLE.test(r1.text), toolCalled: !!r1.functionCalls.length }
}

// In TWO-RESP the first (decision) response is TEXT-ONLY and NEVER voiced; the SECOND response is
// what gets spoken — so ITS text is the heard-first.
async function twoResponseTurn(session) {
  userText(session, QUERY)
  const decision = await runResponse(session, { output_modalities: ['text'] })
  if (decision.functionCalls.length) toolResult(session, decision.functionCalls[0].callId, MOCK_PRICE)
  const spoken = await runResponse(session, { output_modalities: ['text'] })
  return { decisionText: firstWords(decision.text), heardFirst: spoken.text, preamble: PREAMBLE.test(spoken.text), toolCalled: !!decision.functionCalls.length }
}

async function main() {
  console.log('=== TWO-RESPONSE PREAMBLE PROBE (real gpt-realtime, text instrument) ===')
  console.log('query:', QUERY, '· N=', N, '\n')
  const results = { baseline: [], twoResp: [] }

  for (let i = 0; i < N; i++) {
    const s = openSession(key, cfg)
    await s.waitOpen()
    if (!s.state.credit) { console.log('CREDIT WALL — aborting'); s.close(); process.exit(1) }
    const r = await baselineTurn(s)
    results.baseline.push(r)
    console.log(`BASELINE  #${i + 1}  preamble=${r.preamble}  tool=${r.toolCalled}  heardFirst="${firstWords(r.heardFirst)}"`)
    s.close()
    await sleep(700) // pace
  }
  console.log('')
  for (let i = 0; i < N; i++) {
    const s = openSession(key, cfg)
    await s.waitOpen()
    const r = await twoResponseTurn(s)
    results.twoResp.push(r)
    console.log(`TWO-RESP  #${i + 1}  preamble=${r.preamble}  tool=${r.toolCalled}  decisionText="${r.decisionText}"  heardFirst="${firstWords(r.heardFirst)}"`)
    s.close()
    await sleep(700)
  }

  const bp = results.baseline.filter((r) => r.preamble).length
  const tp = results.twoResp.filter((r) => r.preamble).length
  console.log('\n--- SUMMARY ---')
  console.log(`BASELINE spoken preamble: ${bp}/${N}`)
  console.log(`TWO-RESP spoken preamble: ${tp}/${N}  (decision response is always text-only → never voiced)`)
  console.log(`VERDICT: two-response ${tp < bp ? 'REDUCES' : tp === 0 ? 'ELIMINATES-or-none-seen' : 'does NOT reduce'} the spoken preamble on this run.`)
  fs.writeFileSync('docs/eval/TWO_RESPONSE_PROBE.json', JSON.stringify(results, null, 2))
  process.exit(0)
}
main().catch((e) => { console.error('probe error:', e.message); process.exit(1) })

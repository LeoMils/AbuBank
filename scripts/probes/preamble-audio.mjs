/*
 * Probe: does the preamble appear in AUDIO mode (it did NOT in text mode)? Request an AUDIO response
 * for a tool-requiring query and read the AUDIO TRANSCRIPT of the tool-selecting response. If the
 * model narrates "רגע, אני בודקת…" as audio before/with the tool call, the transcript shows it — that
 * is the ~4s preamble the owner heard. Then confirm TWO-RESPONSE (text-only decision) removes it.
 */
import fs from 'node:fs'
import { loadKey, openSession, userText, toolResult, runResponse, sleep, minimalSession } from '../realtime-instrument.mjs'

const full = JSON.parse(fs.readFileSync('docs/eval/SESSION_CONFIG_SNAPSHOT.json', 'utf8'))
const cfg = { ...minimalSession(full), audio: { output: { voice: 'marin' } } }
const key = loadKey()
const QUERY = 'כמה עולה הבושם בלו דה שאנל?'
const N = Number(process.env.N || 4)
const PREAMBLE = /(רגע|שני[יה]|תכף|אני בודקת|אני מבררת|בוא[ינ]? נבדוק|תני לי רגע|אחפש|נבדוק|אבדוק|כבר בודקת)/
const MOCK = JSON.stringify({ result: 'Bleu de Chanel EDP 100ml — כ-450 ש"ח', source: 'probe-mock' })
const first = (t) => (t || '').replace(/\s+/g, ' ').trim().slice(0, 50)

async function main() {
  console.log('=== PREAMBLE-IN-AUDIO PROBE (real gpt-realtime, AUDIO transcript) ===\nquery:', QUERY, '· N=', N, '\n')
  let basePre = 0, twoPre = 0
  const rows = []
  // BASELINE: the tool-selecting response is AUDIO+TEXT → its transcript is what Martita hears first.
  for (let i = 0; i < N; i++) {
    const s = openSession(key, cfg); await s.waitOpen()
    if (!s.state.credit) { console.log('CREDIT WALL'); process.exit(1) }
    userText(s, QUERY)
    const r1 = await runResponse(s, { output_modalities: ['audio', 'text'] })
    const pre = PREAMBLE.test(r1.text)
    if (pre) basePre++
    console.log(`BASELINE #${i + 1}  spokenPreamble=${pre}  tool=${!!r1.functionCalls.length}  firstHeard="${first(r1.text)}"`)
    rows.push({ mode: 'baseline', pre, tool: !!r1.functionCalls.length, heard: r1.text })
    s.close(); await sleep(800)
  }
  console.log('')
  // TWO-RESPONSE: decision is TEXT-ONLY (silent), answer is AUDIO.
  for (let i = 0; i < N; i++) {
    const s = openSession(key, cfg); await s.waitOpen()
    userText(s, QUERY)
    const decision = await runResponse(s, { output_modalities: ['text'] })
    if (decision.functionCalls.length) toolResult(s, decision.functionCalls[0].callId, MOCK)
    const spoken = await runResponse(s, { output_modalities: ['audio', 'text'] })
    const pre = PREAMBLE.test(spoken.text)
    if (pre) twoPre++
    console.log(`TWO-RESP #${i + 1}  spokenPreamble=${pre}  tool=${!!decision.functionCalls.length}  firstHeard="${first(spoken.text)}"`)
    rows.push({ mode: 'two', pre, tool: !!decision.functionCalls.length, heard: spoken.text })
    s.close(); await sleep(800)
  }
  console.log('\n--- SUMMARY ---')
  console.log(`BASELINE spoken preamble: ${basePre}/${N}`)
  console.log(`TWO-RESP spoken preamble: ${twoPre}/${N}`)
  console.log(`VERDICT: ${basePre > twoPre ? 'two-response REDUCES the spoken preamble' : basePre === 0 ? 'no preamble reproduced even in audio mode this run' : 'no reduction seen'}`)
  fs.writeFileSync('docs/eval/PREAMBLE_AUDIO_PROBE.json', JSON.stringify(rows, null, 2))
  process.exit(0)
}
main().catch((e) => { console.error('probe error:', e.message); process.exit(1) })

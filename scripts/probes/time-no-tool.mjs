// GATE: a TIME query must fire NO tool — it is answered from the injected session time, not the web.
import fs from 'node:fs'
import { loadKey, openSession, userText, sleep, minimalSession } from '../realtime-instrument.mjs'
const full = JSON.parse(fs.readFileSync('docs/eval/SESSION_CONFIG_SNAPSHOT.json', 'utf8'))
const cfg = minimalSession(full); const key = loadKey()
function turn(s) {
  return new Promise((r) => {
    const tools = []; let t = ''; let n = 0
    const off = s.on((m) => {
      switch (m.type) {
        case 'response.output_text.delta': case 'response.text.delta':
        case 'response.output_audio_transcript.delta': case 'response.audio_transcript.delta': t += m.delta || ''; break
        case 'response.function_call_arguments.done': tools.push(m.name); s.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: m.call_id, output: JSON.stringify({ status: 'ok', answer: 'בערך 22:00' }) } }); break
        case 'response.done': { const h = (m.response?.output || []).some((o) => o.type === 'function_call'); if (h && n < 3) { n++; s.send({ type: 'response.create', response: { output_modalities: ['text'] } }) } else { off(); r({ tools, t: t.trim() }) } break }
      }
    })
    s.send({ type: 'response.create', response: { output_modalities: ['text'] } })
  })
}
const s = openSession(key, cfg); await s.waitOpen(); await sleep(300)
if (!s.state.credit) { console.log('CREDIT WALL'); process.exit(2) }
let firedAny = false
for (const q of ['מה השעה עכשיו?', 'תגידי, מה השעה?', 'איזו שעה עכשיו בישראל?']) {
  userText(s, q); const r = await turn(s)
  const fired = r.tools.length > 0
  firedAny = firedAny || fired
  console.log(`${fired ? 'TOOL!' : 'ok  '} "${q}" tools=[${r.tools.join(',')}]  "${r.t.slice(0, 55)}"`)
  await sleep(800)
}
s.close()
console.log(`\n=== TIME fires NO tool: ${firedAny ? 'FAIL — a tool fired' : 'PASS — answered directly'} ===`)
process.exit(firedAny ? 1 : 0)

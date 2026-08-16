/*
 * known-contact-comm.mjs — FINDING #1: does the real model FIRE a comm tool for KNOWN contacts?
 * ════════════════════════════════════════════════════════════════════════════
 * The device transcript showed "תשלחי הודעה ליערון" / "ליעל" producing generic chat with NO TOOL
 * CALL. Yaron and Yael are BOTH real people in knowledge/family_data.json — so declining/chatting is
 * a DEFECT, not honest behaviour. Unlike scripts/probes/unknown-contact.mjs (which mocks not_found),
 * this probe mocks the contact as RESOLVED (the truth) and measures the tool-call RATE across message
 * and call phrasings for several known names, including the two that failed on device.
 *
 * A comm tool = people_lookup | resolve_contact | whatsapp_draft | phone_call. Firing ANY of them is
 * a route to the capability; firing NONE (pure chat) is the defect. Writes docs/eval/COMM_TOOL_RATE.json.
 */
import fs from 'node:fs'
import { loadKey, openSession, userText, sleep, minimalSession } from '../realtime-instrument.mjs'

const full = JSON.parse(fs.readFileSync('docs/eval/SESSION_CONFIG_SNAPSHOT.json', 'utf8'))
const cfg = minimalSession(full)
const key = loadKey()

const COMM_TOOLS = new Set(['people_lookup', 'resolve_contact', 'whatsapp_draft', 'phone_call'])
const SEND_CLAIM = /שלחתי|נשלח|התקשרתי|חייגתי|כבר שלחתי/ // must NEVER claim it did it

function mockComm(name, argsJson) {
  let args = {}; try { args = JSON.parse(argsJson || '{}') } catch {}
  const person = String(args.person || args.recipient || args.name || 'קשר')
  switch (name) {
    case 'people_lookup': case 'resolve_contact':
      return JSON.stringify({ status: 'resolved', id: 'known', label: person, allowed_to_say: ['use this id to message or call — never read a number aloud'] })
    case 'whatsapp_draft':
      return JSON.stringify({ status: 'READY_TO_SEND', kind: 'message', recipient: person, allowed_to_say: ['say the message is ready to review and send', 'never say you sent it'] })
    case 'phone_call':
      return JSON.stringify({ status: 'READY_TO_CALL', recipient: person, allowed_to_say: ['say the call is ready for her to start', 'never say you called'] })
    default:
      return JSON.stringify({ status: 'ok' })
  }
}

function runTurn(s) {
  return new Promise((res) => {
    const tools = []; let text = ''; let rounds = 0
    const off = s.on((m) => {
      switch (m.type) {
        case 'response.output_text.delta': case 'response.text.delta':
        case 'response.output_audio_transcript.delta': case 'response.audio_transcript.delta':
          text += m.delta || ''; break
        case 'response.function_call_arguments.done':
          tools.push(m.name)
          s.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: m.call_id, output: mockComm(m.name, m.arguments) } })
          break
        case 'response.done': {
          const had = (m.response?.output || []).some((o) => o.type === 'function_call')
          if (had && rounds < 4) { rounds++; s.send({ type: 'response.create', response: { output_modalities: ['text'] } }) }
          else { off(); res({ tools, text: text.trim() }) }
          break
        }
      }
    })
    s.send({ type: 'response.create', response: { output_modalities: ['text'] } })
  })
}

// message + call phrasings for KNOWN contacts, incl. the two that failed on device (Yaron, Yael)
const CASES = [
  { kind: 'message', name: 'יערון', say: 'תשלחי הודעה ליערון שאני אאחר בחצי שעה' },
  { kind: 'message', name: 'יעל', say: 'תשלחי הודעה ליעל שאני כבר מגיעה' },
  { kind: 'message', name: 'לאו', say: 'תשלחי הודעה ללאו שאני אוהבת אותו' },
  { kind: 'message', name: 'מור', say: 'תכתבי למור שאני אבשל מחר' },
  { kind: 'call', name: 'מור', say: 'תתקשרי בבקשה למור' },
  { kind: 'call', name: 'לאו', say: 'תחייגי ללאו' },
  { kind: 'call', name: 'יערון', say: 'תתקשרי ליערון' },
]

async function main() {
  const s = openSession(key, cfg)
  await s.waitOpen(); await sleep(300)
  if (!s.state.credit) { console.log('CREDIT WALL — aborting'); s.close(); process.exit(2) }
  const rows = []
  for (const c of CASES) {
    userText(s, c.say)
    const r = await runTurn(s)
    const fired = r.tools.some((t) => COMM_TOOLS.has(t))
    const falseClaim = SEND_CLAIM.test(r.text)
    rows.push({ ...c, tools: r.tools, fired, falseClaim, said: r.text.slice(0, 80) })
    console.log(`${fired ? 'FIRE' : 'MISS'} ${c.kind.padEnd(7)} ${c.name.padEnd(6)} tools=[${r.tools.join(',')}]${falseClaim ? ' ⚠FALSE_CLAIM' : ''}  "${r.text.slice(0, 60)}"`)
    if (s.state.lastError?.code === 'rate_limit_exceeded') { console.log('  (429 back-off 3s)'); await sleep(3000) }
    await sleep(900)
  }
  s.close()
  const fired = rows.filter((r) => r.fired).length
  const summary = { total: rows.length, fired, rate: +(fired / rows.length).toFixed(3), falseClaims: rows.filter((r) => r.falseClaim).length, rows }
  fs.writeFileSync('docs/eval/COMM_TOOL_RATE.json', JSON.stringify(summary, null, 2))
  console.log(`\n=== COMM TOOL-CALL RATE: ${fired}/${rows.length} (${(summary.rate * 100).toFixed(0)}%) · false-send-claims: ${summary.falseClaims} ===`)
  console.log('wrote docs/eval/COMM_TOOL_RATE.json')
  process.exit(0)
}
main().catch((e) => { console.error('probe error:', e.message); process.exit(1) })

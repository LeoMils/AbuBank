/* Diagnostic: one AUDIO response — dump event types + response.done status + transcript, to learn
 * the correct audio modality request and whether a preamble ever appears in the audio transcript. */
import fs from 'node:fs'
import { loadKey, openSession, userText, minimalSession } from '../realtime-instrument.mjs'

const full = JSON.parse(fs.readFileSync('docs/eval/SESSION_CONFIG_SNAPSHOT.json', 'utf8'))
const cfg = { ...minimalSession(full), audio: { output: { voice: 'marin' } } }
const key = loadKey()
const s = openSession(key, cfg)
let transcript = ''
const types = {}
s.on((m) => {
  types[m.type] = (types[m.type] || 0) + 1
  if (m.type === 'error') console.log('ERROR:', JSON.stringify(m.error))
  if (/audio_transcript\.delta$/.test(m.type)) transcript += m.delta || ''
  if (m.type === 'response.done') console.log('response.done status=', m.response?.status, 'details=', JSON.stringify(m.response?.status_details || {}), 'outputTypes=', (m.response?.output || []).map((o) => o.type + '/' + (o.content || []).map((c) => c.type).join('+')).join(','))
})
await s.waitOpen()
console.log('credit=', s.state.credit)
await new Promise((r) => setTimeout(r, 800))
userText(s, 'כמה עולה הבושם בלו דה שאנל?')
const REQ = process.env.MODES || 'audio'
s.send({ type: 'response.create', response: { output_modalities: REQ.split(',') } })
await new Promise((r) => setTimeout(r, 12000))
console.log('requested modalities:', REQ)
console.log('event types:', JSON.stringify(types))
console.log('AUDIO TRANSCRIPT:', JSON.stringify(transcript.slice(0, 200)))
s.close(); process.exit(0)

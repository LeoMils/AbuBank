/* Diagnostic: print EVERY server event for one text turn, to see what the session/response rejects. */
import fs from 'node:fs'
import { loadKey, openSession, userText } from '../realtime-instrument.mjs'

const cfg = JSON.parse(fs.readFileSync('docs/eval/SESSION_CONFIG_SNAPSHOT.json', 'utf8'))
const key = loadKey()
const s = openSession(key, cfg)
const seen = []
s.on((m) => {
  seen.push(m.type)
  if (m.type === 'error') console.log('ERROR:', JSON.stringify(m.error))
  if (m.type === 'session.updated') console.log('session.updated OK; output_modalities=', JSON.stringify(m.session?.output_modalities), 'audio.output=', JSON.stringify(m.session?.audio?.output))
  if (m.type === 'response.done') console.log('response.done status=', m.response?.status, 'details=', JSON.stringify(m.response?.status_details || {}), 'outputs=', (m.response?.output || []).map((o) => o.type).join(','))
})
await s.waitOpen()
console.log('opened. credit=', s.state.credit)
await new Promise((r) => setTimeout(r, 1200)) // let session.update settle
userText(s, 'כמה עולה הבושם בלו דה שאנל?')
s.send({ type: 'response.create', response: { output_modalities: ['text'] } })
await new Promise((r) => setTimeout(r, 9000))
console.log('\nEVENT SEQUENCE:', seen.join(' -> '))
s.close()
process.exit(0)

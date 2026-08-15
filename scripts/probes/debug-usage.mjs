import fs from 'node:fs'
import { loadKey, openSession, userText, minimalSession } from '../realtime-instrument.mjs'
const full = JSON.parse(fs.readFileSync('docs/eval/SESSION_CONFIG_SNAPSHOT.json','utf8'))
const cfg = { ...minimalSession(full), audio:{ output:{ voice:'marin' } } }
const s = openSession(loadKey(), cfg)
s.on((m)=>{ if(m.type==='response.done'){ console.log('status=',m.response?.status); console.log('USAGE=',JSON.stringify(m.response?.usage)); process.exit(0)} if(m.type==='error') console.log('ERR',JSON.stringify(m.error)) })
await s.waitOpen(); await new Promise(r=>setTimeout(r,600))
userText(s,'בוקר טוב אבו, מה שלומך?')
s.send({ type:'response.create', response:{ output_modalities:['audio'] } })
setTimeout(()=>{ console.log('TIMEOUT no response.done'); process.exit(1) }, 35000)

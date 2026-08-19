// Probe #2: does the model CALL people_lookup for an UNKNOWN contact, or skip the tool and chat?
import { loadKey, openSession, userText, sleep, minimalSession } from '../realtime-instrument.mjs'
import fs from 'node:fs'
const full = JSON.parse(fs.readFileSync('docs/eval/SESSION_CONFIG_SNAPSHOT.json','utf8'))
const cfg = minimalSession(full); const key = loadKey()
function runTurn(s){return new Promise((res)=>{const tools=[];let text='';let rounds=0;const off=s.on((m)=>{switch(m.type){
  case 'response.output_text.delta': case 'response.text.delta': case 'response.output_audio_transcript.delta': case 'response.audio_transcript.delta': text+=m.delta||'';break;
  case 'response.function_call_arguments.done': tools.push(m.name); s.send({type:'conversation.item.create',item:{type:'function_call_output',call_id:m.call_id,output:JSON.stringify({status:'not_found'})}});break;
  case 'response.done':{const had=(m.response?.output||[]).some(o=>o.type==='function_call'); if(had&&rounds<3){rounds++;s.send({type:'response.create',response:{output_modalities:['text']}});}else{off();res({tools,text:text.trim()});}break;}}});
  s.send({type:'response.create',response:{output_modalities:['text']}});})}
const CASES=['תשלחי הודעה ליערון שאני אאחר','תשלחי הודעה ליעל שאני מגיעה','תשלחי הודעה ללאו שאני אאחר']
const s=openSession(key,cfg); await s.waitOpen(); await sleep(300)
if(!s.state.credit){console.log('CREDIT WALL');process.exit(2)}
for(const c of CASES){userText(s,c);const r=await runTurn(s);console.log(`"${c.slice(0,28)}" → tools=[${r.tools.join(',')}]  said="${r.text.slice(0,70)}"`);await sleep(800)}
s.close();process.exit(0)

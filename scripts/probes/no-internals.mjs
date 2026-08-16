import fs from 'node:fs'
import { loadKey, openSession, userText, sleep, minimalSession } from '../realtime-instrument.mjs'
const full = JSON.parse(fs.readFileSync('docs/eval/SESSION_CONFIG_SNAPSHOT.json','utf8'))
const cfg = minimalSession(full); const key = loadKey()
function turn(s){return new Promise(r=>{let t='';let n=0;const off=s.on(m=>{switch(m.type){
 case 'response.output_text.delta':case 'response.text.delta':case 'response.output_audio_transcript.delta':case 'response.audio_transcript.delta':t+=m.delta||'';break;
 case 'response.done':{const h=(m.response?.output||[]).some(o=>o.type==='function_call');if(h&&n<3){n++;s.send({type:'response.create',response:{output_modalities:['text']}})}else{off();r(t.trim())}break}}});
 s.send({type:'response.create',response:{output_modalities:['text']}})})}
const s=openSession(key,cfg);await s.waitOpen();await sleep(300)
if(!s.state.credit){console.log('CREDIT WALL');process.exit(2)}
userText(s,'תגידי, למה כתוב על המסך חושבת? מה זה אומר?');const r=await turn(s)
const INTERNALS=/מערכת|טכני|סטטוס|מצב של האפליקציה|התוכנה|האלגוריתם|מראה ש|אינדיקציה|סימן טכני|the system|technical|status indicator/i
console.log('answer:',r)
console.log('explains internals:', INTERNALS.test(r))
console.log('words:', r.split(/\s+/).length)
s.close();process.exit(0)

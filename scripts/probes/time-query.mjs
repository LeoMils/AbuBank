import fs from 'node:fs'
import { loadKey, openSession, userText, sleep, minimalSession } from '../realtime-instrument.mjs'
const full = JSON.parse(fs.readFileSync('docs/eval/SESSION_CONFIG_SNAPSHOT.json','utf8'))
const cfg = minimalSession(full); const key = loadKey()
function mock(name){if(name==='get_current_info')return JSON.stringify({status:'ok',answer:'השעה עכשיו בערך 22:40',allowed_to_say:['speak ONLY this fact warmly']});return JSON.stringify({status:'ok'})}
function turn(s){return new Promise(r=>{const tools=[];let t='';let n=0;const off=s.on(m=>{switch(m.type){
 case 'response.output_text.delta':case 'response.text.delta':case 'response.output_audio_transcript.delta':case 'response.audio_transcript.delta':t+=m.delta||'';break;
 case 'response.function_call_arguments.done':tools.push(m.name);s.send({type:'conversation.item.create',item:{type:'function_call_output',call_id:m.call_id,output:mock(m.name)}});break;
 case 'response.done':{const h=(m.response?.output||[]).some(o=>o.type==='function_call');if(h&&n<4){n++;s.send({type:'response.create',response:{output_modalities:['text']}})}else{off();r({tools,t:t.trim()})}break}}});
 s.send({type:'response.create',response:{output_modalities:['text']}})})}
const s=openSession(key,cfg);await s.waitOpen();await sleep(300)
if(!s.state.credit){console.log('CREDIT WALL');process.exit(2)}
// two phrasings of a time query
for(const q of ['מה השעה עכשיו?','תגידי, מה השעה?']){userText(s,q);const r=await turn(s);console.log((r.tools.includes('get_current_info')?'FIRE':'MISS')+' "'+q+'" tools=['+r.tools.join(',')+'] "'+r.t.slice(0,45)+'"');await sleep(900)}
s.close();process.exit(0)

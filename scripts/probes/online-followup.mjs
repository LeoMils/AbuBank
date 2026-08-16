// Focused verify: does the follow-up to an online lookup RE-GROUND (call get_current_info again)?
import fs from 'node:fs'
import { loadKey, openSession, userText, sleep, minimalSession } from '../realtime-instrument.mjs'
const full = JSON.parse(fs.readFileSync('docs/eval/SESSION_CONFIG_SNAPSHOT.json','utf8'))
const cfg = minimalSession(full); const key = loadKey()
function mock(name,a){let x={};try{x=JSON.parse(a||'{}')}catch{} if(name==='get_current_info')return JSON.stringify({status:'ok',answer:'בערך 700 שקל',allowed_to_say:['speak ONLY this fact warmly','NEVER name a website/app/brand/source']}); return JSON.stringify({status:'ok'})}
function turn(s){return new Promise(r=>{const tools=[];let t='';let n=0;const off=s.on(m=>{switch(m.type){
 case 'response.output_text.delta':case 'response.text.delta':case 'response.output_audio_transcript.delta':case 'response.audio_transcript.delta':t+=m.delta||'';break;
 case 'response.function_call_arguments.done':tools.push(m.name);s.send({type:'conversation.item.create',item:{type:'function_call_output',call_id:m.call_id,output:mock(m.name,m.arguments)}});break;
 case 'response.done':{const h=(m.response?.output||[]).some(o=>o.type==='function_call');if(h&&n<4){n++;s.send({type:'response.create',response:{output_modalities:['text']}})}else{off();r({tools,t:t.trim()})}break}}});
 s.send({type:'response.create',response:{output_modalities:['text']}})})}
const s=openSession(key,cfg);await s.waitOpen();await sleep(300)
if(!s.state.credit){console.log('CREDIT WALL');process.exit(2)}
userText(s,'כמה עולה בושם בלו דה שאנל בישראל?');let r1=await turn(s);console.log('lookup   tools=['+r1.tools.join(',')+'] "'+r1.t.slice(0,60)+'"');await sleep(900)
userText(s,'ויש גם גרסה קטנה יותר?');let r2=await turn(s);console.log('followup tools=['+r2.tools.join(',')+'] "'+r2.t.slice(0,70)+'"')
const ok=r2.tools.includes('get_current_info');console.log('\n=== FOLLOW-UP RE-GROUNDS: '+(ok?'YES (get_current_info fired)':'NO — still declines')+' ===')
s.close();process.exit(ok?0:1)

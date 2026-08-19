/* 5x stability of the two borderline golden turns: spanish_back (time→tool) + online_followup (re-ground). */
import fs from 'node:fs'
import { loadKey, openSession, userText, sleep, minimalSession } from '../realtime-instrument.mjs'
const full = JSON.parse(fs.readFileSync('docs/eval/SESSION_CONFIG_SNAPSHOT.json','utf8'))
const cfg = minimalSession(full); const key = loadKey()
function mock(name){if(name==='get_current_info')return JSON.stringify({status:'ok',answer:'בערך 700 שקל',allowed_to_say:['speak ONLY this fact warmly']});return JSON.stringify({status:'ok'})}
function turn(s){return new Promise(r=>{const tools=[];let t='';let n=0;const off=s.on(m=>{switch(m.type){
 case 'response.output_text.delta':case 'response.text.delta':case 'response.output_audio_transcript.delta':case 'response.audio_transcript.delta':t+=m.delta||'';break;
 case 'response.function_call_arguments.done':tools.push(m.name);s.send({type:'conversation.item.create',item:{type:'function_call_output',call_id:m.call_id,output:mock(m.name)}});break;
 case 'response.done':{const h=(m.response?.output||[]).some(o=>o.type==='function_call');if(h&&n<4){n++;s.send({type:'response.create',response:{output_modalities:['text']}})}else{off();r({tools,t:t.trim()})}break}}});
 s.send({type:'response.create',response:{output_modalities:['text']}})})}
const N=5, res={spanish_back:[],online_followup:[]}
for(let i=0;i<N;i++){
  // online_followup arc: lookup then followup
  const s1=openSession(key,cfg);await s1.waitOpen();await sleep(300)
  if(!s1.state.credit){console.log('CREDIT WALL');process.exit(2)}
  userText(s1,'כמה עולה בושם בלו דה שאנל בישראל?');await turn(s1);await sleep(600)
  userText(s1,'ויש גם גרסה קטנה יותר?');const f=await turn(s1);const fp=f.tools.includes('get_current_info');res.online_followup.push(fp)
  s1.close();await sleep(600)
  // spanish_back arc: spanish turn then back-to-hebrew time question
  const s2=openSession(key,cfg);await s2.waitOpen();await sleep(300)
  userText(s2,'¿Vos cómo estás, querida?');await turn(s2);await sleep(600)
  userText(s2,'טוב, בוא נחזור לעברית. מה השעה עכשיו?');const b=await turn(s2);const bp=b.tools.length>0;res.spanish_back.push(bp)
  s2.close();await sleep(600)
  console.log(`run ${i+1}/${N}: online_followup=${res.online_followup[i]?'PASS':'FAIL'}  spanish_back=${res.spanish_back[i]?'PASS':'FAIL'}`)
}
const rate=a=>`${a.filter(Boolean).length}/${a.length}`
const summary={online_followup:rate(res.online_followup),spanish_back:rate(res.spanish_back),raw:res}
fs.writeFileSync('docs/eval/BORDERLINE_STABILITY.json',JSON.stringify(summary,null,2))
console.log(`\n=== STABILITY  online_followup ${summary.online_followup}   spanish_back ${summary.spanish_back} ===`)

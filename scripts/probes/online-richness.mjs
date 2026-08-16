/* E1: does the model ENRICH a film query and speak a FULLER answer (not one line)? */
import fs from 'node:fs'
import { loadKey, openSession, userText, sleep, minimalSession } from '../realtime-instrument.mjs'
const full = JSON.parse(fs.readFileSync('docs/eval/SESSION_CONFIG_SNAPSHOT.json','utf8'))
const cfg = minimalSession(full); const key = loadKey()
let lastQuery=''
function mock(name,a){let x={};try{x=JSON.parse(a||'{}')}catch{} if(name==='get_current_info'){lastQuery=x.query||'';return JSON.stringify({status:'ok',answer:'"האודיסאה" הוא סרט הרפתקאות אפי בבימוי כריסטופר נולאן, עיבוד לפואמה של הומרוס. מככבים בו מאט דיימון בתפקיד אודיסאוס, אן האת\'אווי, טום הולנד וזנדאיה. הסרט עוקב אחרי מסעו הארוך של אודיסאוס הביתה מטרויה, דרך סכנות, מפלצות ואלים. צולם ברובו בטכנולוגיית IMAX ומיועד לצאת לקולנוע.',allowed_to_say:['speak a warm fuller answer from this','NEVER name a website/app/brand/source']})} return JSON.stringify({status:'ok'})}
function turn(s){return new Promise(r=>{const tools=[];let t='';let n=0;const off=s.on(m=>{switch(m.type){
 case 'response.output_text.delta':case 'response.text.delta':case 'response.output_audio_transcript.delta':case 'response.audio_transcript.delta':t+=m.delta||'';break;
 case 'response.function_call_arguments.done':tools.push(m.name);s.send({type:'conversation.item.create',item:{type:'function_call_output',call_id:m.call_id,output:mock(m.name,m.arguments)}});break;
 case 'response.done':{const h=(m.response?.output||[]).some(o=>o.type==='function_call');if(h&&n<4){n++;s.send({type:'response.create',response:{output_modalities:['text']}})}else{off();r({tools,t:t.trim()})}break}}});
 s.send({type:'response.create',response:{output_modalities:['text']}})})}
const s=openSession(key,cfg);await s.waitOpen();await sleep(300)
if(!s.state.credit){console.log('CREDIT WALL');process.exit(2)}
userText(s,'ספרי לי על הסרט האודיסאה שיוצא עכשיו');const r=await turn(s)
const sents=r.t.split(/[.!?]/).filter(w=>w.trim().length>3).length
const enriched=/שחקן|מככב|במאי|נולאן|על מה|עלילה|מספר|actor|star|plot|cast|about/i.test(lastQuery)
console.log('tool:',r.tools.join(','))
console.log('model query:', lastQuery)
console.log('query enriched (asks plot/cast/etc):', enriched)
console.log('answer sentences:', sents)
console.log('answer:', r.t)
console.log('\n=== RICH: tool fired='+(r.tools.includes('get_current_info'))+' sentences>=2='+(sents>=2)+' ===')
s.close();process.exit(0)

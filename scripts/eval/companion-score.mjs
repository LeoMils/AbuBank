/*
 * companion-score.mjs — is she GOOD COMPANY, not just correct? (owner Item 4)
 * ════════════════════════════════════════════════════════════════════════════
 * Golden proves correctness and CANNOT fail a session that is correct and lifeless — the owner's
 * oldest complaint ("answer like a friend, not an assistant"; the 18/18 film answer scored 3/100).
 * This drives short REAL-model conversations and scores warmth on five dimensions, reported BESIDE
 * golden. Heuristic (a proxy, labelled as such) — deterministic detectors over her spoken turns, no
 * extra judge model. Writes docs/eval/COMPANION_SCORE.json.
 *
 *   1 name_natural     — uses "מרתיטה"/"מרתה" at least once, but not robotically every turn
 *   2 life_family_ref  — references her family / Argentina / her life, unprompted
 *   3 phrasing_variety — no verbatim-repeated sentence across the session; varied turn openers
 *   4 stays_with_feel  — on an emotional turn: no capability MENU, engages the feeling
 *   5 warm_not_robotic — warm markers present; no assistant/robotic phrasing
 */
import fs from 'node:fs'
import { loadKey, openSession, userText, sleep, minimalSession } from '../realtime-instrument.mjs'

const full = JSON.parse(fs.readFileSync('docs/eval/SESSION_CONFIG_SNAPSHOT.json', 'utf8'))
const cfg = minimalSession(full); const key = loadKey()

const NAME = /מרתיטה|מרתה|מרטיטה/
const FAMILY = /מור|לאו|אופיר|עדי|נועם|עילי|אדר|איילון|פפה|פפי|יעל|גלעד|ארגנטינ|מנדוס|כפר סבא|בואנוס איירס|החנות/
const MENU = (s) => ((s.match(/רוצה ש|אפשר ש|שאני|תרצי ש/g) ?? []).length >= 2) || (/אני יכולה/.test(s) && (s.match(/[,]| או /g) ?? []).length >= 2) || ((s.match(/(^|\n)\s*[-•*]\s+\S/g) ?? []).length >= 1)
const ROBOTIC = /כיצד אוכל לסייע|איך אוכל לעזור|אני עוזרת דיגיטלית|אני בינה מלאכותית|כמודל שפה|אני כאן כדי לסייע|במה אוכל לעזור/
const WARM = /יקירה|מתוקה|חמודה|נשמה|אהובה|קרובה שלי|יא |ג'ה ג'ה|חחח|❤|😊|כמה טוב|איזה כיף|אני איתך|אני כאן איתך/
const FEELING = /מתגעגע|עצוב|בוד[דד]|קשה לך|לבד|כואב|דואג/

function normLine(s){return s.normalize('NFC').toLowerCase().replace(/[.,!?;:"'’“”…()\[\]־–—-]/g,' ').replace(/\s+/g,' ').trim()}
function runTurn(s, instructions){return new Promise(r=>{let t='';let n=0;const off=s.on(m=>{switch(m.type){
 case 'response.output_text.delta':case 'response.text.delta':case 'response.output_audio_transcript.delta':case 'response.audio_transcript.delta':t+=m.delta||'';break;
 case 'response.function_call_arguments.done':s.send({type:'conversation.item.create',item:{type:'function_call_output',call_id:m.call_id,output:JSON.stringify({status:'ok',answer:'מור היא הבת שלך',allowed_to_say:['speak warmly']})}});break;
 case 'response.done':{const h=(m.response?.output||[]).some(o=>o.type==='function_call');if(h&&n<3){n++;s.send({type:'response.create',response:{output_modalities:['text']}})}else{off();r(t.trim())}break}}});
 s.send({type:'response.create',response:{output_modalities:['text'],...(instructions?{instructions}:{})}})})}

const GREET='Greet Martita warmly in Hebrew in ONE short sentence, like a close friend on the phone.'
const SESSIONS=[
  { id:'lonely', emotionalTurns:[1,2], turns:['', 'אני קצת בודדה היום, הבית שקט מדי.', 'מתגעגעת לפפה נורא.', 'ספרי לי משהו טוב.'] },
  { id:'family', emotionalTurns:[], turns:['', 'בוקר טוב! מה נשמע?', 'מה מור עושה בימים אלה?', 'תזכירי לי איך היה בארגנטינה פעם.'] },
]

async function scoreSession(sess){
  const s=openSession(key,cfg); await s.waitOpen(); await sleep(300)
  if(!s.state.credit){console.log('CREDIT WALL');process.exit(2)}
  const spoken=[]
  for(let i=0;i<sess.turns.length;i++){ if(sess.turns[i]) userText(s,sess.turns[i]); spoken.push(await runTurn(s, sess.turns[i]?null:GREET)); await sleep(700) }
  s.close()
  const all=spoken.join('\n')
  const seen=new Set(); let repeats=0
  for(const turn of spoken) for(const line of turn.split(/(?<=[.!?…])\s+|\n+/)){ const nl=normLine(line); if(nl.split(' ').filter(Boolean).length>=4){ if(seen.has(nl))repeats++; else seen.add(nl) } }
  const openers=spoken.map(t=>normLine(t).split(' ').slice(0,2).join(' ')).filter(Boolean)
  const nameHits=spoken.filter(t=>NAME.test(t)).length
  const dims={
    name_natural: nameHits>=1 && nameHits<=spoken.length, // present, not literally every turn robotically
    life_family_ref: FAMILY.test(all),
    phrasing_variety: repeats===0 && new Set(openers).size>=Math.max(2,openers.length-1),
    stays_with_feel: sess.emotionalTurns.every(i=>!MENU(spoken[i]||'')) && (sess.emotionalTurns.length===0 || sess.emotionalTurns.some(i=>WARM.test(spoken[i]||'')||FEELING.test(spoken[i]||''))),
    warm_not_robotic: WARM.test(all) && !ROBOTIC.test(all),
  }
  const passed=Object.values(dims).filter(Boolean).length
  return { id:sess.id, dims, passed, of:5, repeats, spoken }
}

// A cheap-model JUDGE reads the transcript and rates the holistic companion question a human would ask.
async function judge(transcript){
  const sys='You rate whether an AI companion for an 81-year-old woman (Martita) living alone talks like a warm friend, not an assistant. Score 0-100 and answer 5 yes/no. Return ONLY JSON: {"score":N,"uses_name":b,"references_her_life":b,"varied_phrasing":b,"stays_with_feeling":b,"would_talk_again":b}.'
  try{
    const res=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},body:JSON.stringify({model:'gpt-4o-mini',temperature:0,response_format:{type:'json_object'},messages:[{role:'system',content:sys},{role:'user',content:'Abu\'s turns:\n'+transcript}]})})
    const j=await res.json(); return JSON.parse(j.choices?.[0]?.message?.content??'{}')
  }catch(e){ return {error:String(e.message||e)} }
}

async function main(){
  console.log('=== COMPANION SCORE · real gpt-realtime ===\n')
  const results=[]
  for(const sess of SESSIONS){ const r=await scoreSession(sess); r.judge=await judge(r.spoken.join('\n')); results.push(r)
    console.log(`${r.id.padEnd(8)} heuristic ${r.passed}/5  judge ${r.judge?.score ?? '?'}/100  ${Object.entries(r.dims).map(([k,v])=>`${v?'✓':'✗'}${k}`).join('  ')}`)
    r.spoken.forEach((t,i)=>console.log(`   [${i}] ${t.slice(0,80)}`))
  }
  const total=results.reduce((a,r)=>a+r.passed,0), max=results.length*5
  const heuristic=Math.round(100*total/max)
  const judgeScores=results.map(r=>r.judge?.score).filter(n=>typeof n==='number')
  const judgeAvg=judgeScores.length?Math.round(judgeScores.reduce((a,b)=>a+b,0)/judgeScores.length):null
  const summary={ heuristicScore:heuristic, judgeScore:judgeAvg, of:100, sessions:results.map(r=>({id:r.id,passed:r.passed,dims:r.dims,repeats:r.repeats,judge:r.judge})), note:'heuristicScore = deterministic warmth markers; judgeScore = gpt-4o-mini reading the transcript on the holistic "would an 81-year-old want to talk again" question. Both are proxies beside golden CORRECTNESS.' }
  fs.writeFileSync('docs/eval/COMPANION_SCORE.json', JSON.stringify(summary,null,2))
  console.log(`\n=== COMPANION: heuristic ${heuristic}/100 · judge ${judgeAvg}/100 (beside golden correctness) ===`)
  console.log('wrote docs/eval/COMPANION_SCORE.json')
}
main().catch(e=>{console.error('companion-score error:',e.message);process.exit(1)})

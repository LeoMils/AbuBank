(async()=>{
const _b=Uint8Array.from(atob(window.SIGAL_DATA_GZ),c=>c.charCodeAt(0));
const _ds=new DecompressionStream('gzip');
const _txt=await new Response(new Blob([_b]).stream().pipeThrough(_ds)).text();
const D=JSON.parse(_txt);
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s??'').toLowerCase().normalize('NFKD').replace(/[\u0591-\u05C7]/g,'').replace(/[״"'’`.,:;!?()[\]{}\/\\|+_=–—-]/g,' ').replace(/\s+/g,' ').trim();
const uniq=a=>[...new Set(a.filter(Boolean))];
const store={get:k=>{try{return localStorage.getItem(k)}catch{return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch{}}};
let lastPrompt='';

function showView(name){
 $$('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+name));
 $$('.tab,.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
 window.scrollTo({top:0,behavior:'smooth'});
}
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));

const examples=[
 'יש לי תוכנית של משרד. אני רוצה פורטפוליו מלא ללקוח והדמיות מפורטות, בלי לשנות גאומטריה.',
 'תני לי 3 חלופות לסלון באותה מצלמה, עם גוונים וחומרים שונים.',
 'יש לי תוכנית תקרה וטבלת גופים. אני רוצה תאורה טכנית + כתב כמויות + QA.',
 'מטבח: נגרות, מכשירים, תאורה, חומרים, הדמיה וכתב כמויות.',
 'ריצוף וחיפויים לכל הבית: כמויות, פחת, קודים וטבלת הזמנה.'
];
$('#examples').innerHTML=examples.map(x=>`<button class="chip" data-q="${esc(x)}">${esc(x)}</button>`).join('');
$('#examples').addEventListener('click',e=>{let b=e.target.closest('[data-q]');if(!b)return;$('#request').value=b.dataset.q;buildPlan()});

const quick=[
 ['⌂','לתכנן חלל','חלופות, העמדה, ריהוט','תני לי תכנון מלא לחלל עם 3 חלופות ו-trade-offs.'],
 ['◐','הדמיה','יום/לילה, חומרים, מצלמה','אני רוצה סט הדמיות מפורט, נאמן לגאומטריה, כולל יום/לילה ופרטי חומר.'],
 ['✦','תאורה','קונספט, RCP, גופים, BOQ','אני רוצה תכנון תאורה מלא: קונספט, תאורה טכנית, RCP, schedule וכתב כמויות.'],
 ['Σ','כמויות','ריצוף, חיפויים, תאורה, נגרות','אני רוצה כתב כמויות audit-ready עם Formula, Unit, Source, Assumptions, Missing Data ו-Confidence.'],
 ['▤','לקוח','פורטפוליו, Board, החלטות','אני רוצה פורטפוליו מלא ללקוח: narrative, תוכניות, חתכים, הדמיות, חומרים ו-decision boards.'],
 ['✓','ביצוע / QA','פרטים, אתר, revisions','אני רוצה QA מלא לחבילת הביצוע: conflicts, missing data, revisions, site issues ו-professional review.']
];
$('#quickActions').innerHTML=quick.map(x=>`<button class="action" data-q="${esc(x[3])}"><span class="ico">${x[0]}</span><span><b>${x[1]}</b><small>${x[2]}</small></span></button>`).join('');
$('#quickActions').addEventListener('click',e=>{let b=e.target.closest('[data-q]');if(!b)return;$('#request').value=b.dataset.q;buildPlan()});

function expandQuery(q){
 let a=[norm(q)];
 for(const [k,vals] of Object.entries(D.synonyms||{})){
  if(norm(q).includes(norm(k))) a.push(...vals.map(norm));
 }
 return a.join(' ');
}
function score(q,text){
 const nq=expandQuery(q), nt=norm(text); if(!nq||!nt)return 0;
 let s=0; for(const t of uniq(nq.split(' ')).filter(x=>x.length>1)){
  if(nt===t)s+=20; else if(nt.includes(t))s+=4;
 }
 return s;
}
function detectMany(ruleList,q){
 let nq=norm(q),hits=[];
 for(const [name,keys] of ruleList){
  let s=0;keys.forEach(k=>{if(nq.includes(norm(k)))s+=5});
  if(s)hits.push({name,s});
 }
 return hits.sort((a,b)=>b.s-a.s).map(x=>x.name);
}
function detectTop(ruleList,q){const x=detectMany(ruleList,q);return x[0]||null}
function inferUploads(q,intents,room){
 let a=[];const add=x=>{if(!a.includes(x))a.push(x)};
 add('המקור הכי עדכני: תוכנית / PDF / תמונה / מודל / טבלה');
 if(room)add('חומר שמכסה את '+room);
 if(intents.some(x=>x.includes('תכנון'))){add('בריף / צרכים / אילוצים');add('מידות מאומתות')}
 if(intents.some(x=>x.includes('הדמיה'))){add('רנדר/צילום/מודל בסיס');add('רפרנסים, חומרים ומה אסור לשנות')}
 if(intents.some(x=>x.includes('תאורה'))){add('תוכנית + RCP');add('Fixture legend / schedule אם יש')}
 if(intents.some(x=>x.includes('כמויות'))){add('תוכנית ממודדת / קנה מידה');add('Schedule / Excel / Codes / Revision')}
 if(intents.some(x=>x.includes('נגרות'))){add('פריסות/חתכים/מידות');add('מפרטי מכשירים/פרזול')}
 if(intents.some(x=>x.includes('אתר'))){add('תמונות אתר מתוארכות');add('שרטוט/פרט מאושר להשוואה')}
 return a.slice(0,8);
}
function missingQuestions(q,intents){
 let nq=norm(q),a=[];const add=x=>{if(!a.includes(x))a.push(x)};
 if(!/תוכנית|pdf|צילום|תמונה|מודל|excel|טבלה|קובץ|dwg|revit/.test(nq))add('איזה מקור אמת קיים כרגע — תוכנית, PDF, תמונה, מודל או טבלה?');
 if(!/לא להזיז|לא לשנות|לשמור|שמר|preserve|נעול/.test(nq))add('מה אסור לשנות? למשל פתחים, תשתיות, קירות, נגרות קיימת או תקציב.');
 if(intents.some(x=>x.includes('כמויות'))&&!/מידה|קנה מידה|scale|ממדים/.test(nq))add('האם יש תוכנית ממודדת/קנה מידה וקודי גמר מאושרים?');
 if(intents.some(x=>x.includes('הדמיה'))&&!/רפרנס|reference|חומר|material|סגנון|style/.test(nq))add('האם יש רפרנסים/חומרים או שפת עיצוב מאושרת?');
 return a.slice(0,4);
}
function inferSteps(intents){
 let s=['קבעי Source of Truth וגרסה','נעלי את מה שאסור לשנות'];
 const add=x=>s.push(x);
 if(intents.some(x=>x.includes('תכנון')))add('Audit קצר → 3 חלופות → Furniture Fit → trade-offs');
 if(intents.some(x=>x.includes('חומרים')))add('אותה מצלמה/חשיפה → material/colorways → השוואה');
 if(intents.some(x=>x.includes('תאורה')))add('Concept → RCP/Technical → Fixture schedule → Controls → QA');
 if(intents.some(x=>x.includes('הדמיה')))add('Geometry/Camera lock → Base render → Day/Night/Details');
 if(intents.some(x=>x.includes('נגרות')))add('Layout → Elevations/Sections → Interfaces → Schedule/BOQ');
 if(intents.some(x=>x.includes('גינה')))add('Sun/Privacy/Wind → zoning → hardscape/planting → lighting');
 if(intents.some(x=>x.includes('כמויות')))add('Map codes → Net → deductions → waste בנפרד → cross-check');
 if(intents.some(x=>x.includes('פרזנטציה')))add('Normalize → 3–5 הבדלים → Decision Board → Decision Log');
 if(intents.some(x=>x.includes('אתר')))add('Photo→Issue → compare to approved source → owner/date → closeout');
 if(s.length===2)add('בצעי סבב ראשון קטן ומוגדר לפני הרחבה');
 add('סיימי ב-QA, Missing Data ו-Professional Review');
 return s;
}
function deliverables(intents){
 let a=[];const add=x=>{if(!a.includes(x))a.push(x)};
 if(intents.some(x=>x.includes('תכנון'))){add('Plan Audit');add('3 חלופות + trade-offs');add('Furniture Fit')}
 if(intents.some(x=>x.includes('הדמיה'))){add('Render Pack');add('Day / Night / Detail views');add('Geometry fidelity check')}
 if(intents.some(x=>x.includes('תאורה'))){add('Lighting concept');add('RCP / technical logic');add('Fixture schedule')}
 if(intents.some(x=>x.includes('כמויות'))){add('BOQ audit-ready');add('Formula / Unit / Source / Waste');add('Missing Data + Confidence')}
 if(intents.some(x=>x.includes('נגרות'))){add('Joinery layouts');add('Elevations / Sections');add('Schedule / interfaces')}
 if(intents.some(x=>x.includes('פרזנטציה'))){add('Client portfolio');add('Decision boards');add('Narrative + approvals')}
 if(intents.some(x=>x.includes('אתר'))){add('Issue / Snag list');add('Evidence + owner + date')}
 if(!a.length){add('תוצר מקצועי לפי המשימה');add('רשימת החלטות');add('QA')}
 return a.slice(0,8);
}
function queryControls(q){
 let nq=norm(q),x=['/sourceoftruth','/missingdata','/qa'];const add=v=>{if(!x.includes(v))x.push(v)};
 if(/לא להזיז|לא לשנות|לשמור|שמר|preserve/.test(nq))add('/preserve');
 if(/תשתית|תשתיות|אינסטלציה|מים|ביוב|wet/.test(nq))add('/wetareaslock');
 if(/מידות|מימדים|dimension/.test(nq))add('/dimensionlock');
 if(/פתחים|חלונות|דלתות|opening/.test(nq))add('/openinglock');
 if(/עמודים|קורות|קונסטרוקציה|structure/.test(nq))add('/structurelock');
 if(/אותה מצלמה|same camera|samecamera/.test(nq))add('/samecamera');
 return x;
}
function bestRecipes(q,intents){
 return D.stacks.map(x=>({...x,_s:score(q+' '+intents.join(' '),Object.values(x).join(' '))})).filter(x=>x._s>0).sort((a,b)=>b._s-a._s).slice(0,3);
}
function mergedStack(q,intents){
 let parts=[...queryControls(q)];
 for(const r of bestRecipes(q,intents).slice(0,2)){
  String(r.stack||'').split(/\s+/).forEach(x=>{if(x.startsWith('/')&&!parts.includes(x))parts.push(x)});
 }
 return parts.slice(0,18).join(' ');
}
function universalPrompt(q,room,intents,uploads){
 return `את/ה צוות אדריכלות ועיצוב פנים בכיר העובד עם SIGAL ZABUROF.

הבקשה שלי: ${q}

SOURCE OF TRUTH
השתמש/י רק בקבצים שאעלה כמקור עובדתי. לפני ביצוע, אמור/י בדיוק אילו קבצים חסרים.

PRESERVE
אל תשנה/י גאומטריה, מידות, פתחים, קונסטרוקציה, תשתיות או החלטות קיימות אלא אם ביקשתי במפורש.

WORKFLOW
1. פרש/י את המשימה וסווג/י אותה.
2. רשום/י אילו Inputs נדרשים.
3. בצע/י את המשימה בשלבים ולא בקפיצה לתוצאה.
4. אם יש חלופות, הצג/י trade-offs ולא רק אפשרות יפה.
5. אם יש חישובים/כמויות, הצג/י Formula, Unit, Source, Assumptions, Missing Data ו-Confidence.
6. סיים/י ב-QA ובמה שחייב בדיקה מקצועית.

CONTEXT DETECTED
תחום: ${intents.length?intents.join(' + '):'לזיהוי'}
חלל/Scope: ${room||'לזיהוי'}

INPUTS שכדאי להעלות:
- ${uploads.join('\n- ')}

התחל/י בהודעה קצרה: “הבנתי את המשימה כך: …; כדי להתחיל חסר לי: …”`;
}
function buildPlan(){
 const q=$('#request').value.trim(); if(!q){toast('כתבי קודם מה את רוצה לעשות');$('#request').focus();return}
 const intents=detectMany(D.intentRules,q),room=detectTop(D.roomRules,q),uploads=inferUploads(q,intents,room),missing=missingQuestions(q,intents),steps=inferSteps(intents),outs=deliverables(intents),stack=mergedStack(q,intents),prompt=universalPrompt(q,room,intents,uploads),recipes=bestRecipes(q,intents);
 lastPrompt=prompt;
 const intentLabel=intents.length?intents.join(' · '):'משימה כללית';
 $('#result').innerHTML=`<article class="result-card">
  <header class="result-head"><div><h2>הבנתי: ${esc(intentLabel)}</h2><p>Scope: ${esc(room||'לא זוהה — ChatGPT יזהה מהמקורות')} · נבנה מסלול עבודה מותאם.</p></div><span class="badge">מוכן להתחלה</span></header>
  <div class="result-body">
   ${missing.length?`<div class="missing"><b>כדי לדייק לפני שמתחילים:</b><ul>${missing.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}
   <div class="stage-grid">
    <div class="stage"><div class="num">1</div><h3>מה להעלות</h3><ul>${uploads.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
    <div class="stage"><div class="num">2</div><h3>מה נעשה</h3><ol>${steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></div>
    <div class="stage"><div class="num">3</div><h3>מה תקבלי</h3><ul>${outs.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
   </div>
   <div class="cta-bar">
    <span class="hint">השלב הבא: העתיקי את הפרומפט ואז פתחי ChatGPT.</span>
    <button class="secondary" id="copyPromptBtn">העתיקי Prompt</button>
    <a class="direct-link" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">פתחי ChatGPT ↗</a>
    <span class="copy-ok" id="copyOk">הועתק ✓</span>
   </div>
   <div class="details">
    <details><summary>PRO · הראי את ה-Slash Stack</summary><div><div class="code">${esc(stack)}</div>${recipes.length?`<p style="font-size:11px;color:var(--muted)">Recipes קרובים: ${recipes.map(r=>esc(r.title)).join(' · ')}</p>`:''}</div></details>
    <details><summary>PRO · הראי את הפרומפט המלא</summary><div><div class="prompt" id="promptText">${esc(prompt)}</div></div></details>
    <details><summary>QA · מה חייב בדיקה מקצועית</summary><div><ul style="font-size:12px"><li>גאומטריה, מידות ופתחים מול מקור מאושר.</li><li>קונסטרוקציה, MEP, אש, נגישות וקוד מול יועצים/תקנים.</li><li>כמויות רק עם מקור, נוסחה, יחידה ו-Missing Data.</li><li>הדמיה אינה הוכחת buildability.</li></ul></div></details>
   </div>
  </div></article>`;
 $('#result').classList.add('show');
 $('#copyPromptBtn').addEventListener('click',()=>copyText(prompt,true));
 $('#result').scrollIntoView({behavior:'smooth',block:'start'});
}
$('#build').addEventListener('click',buildPlan);
$('#request').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();buildPlan()}});

async function copyText(text,show=false){
 let ok=false;
 try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);ok=true}}catch{}
 if(!ok){
  const ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();
  try{ok=document.execCommand('copy')}catch{}document.body.removeChild(ta);
 }
 if(show){let el=$('#copyOk');if(el){el.style.display='inline';setTimeout(()=>el.style.display='none',2200)}}
 toast(ok?'הועתק ✓':'לא הצלחתי להעתיק אוטומטית — פתחי PRO והעתיקי ידנית');
}
function toast(t){const x=$('#toast');x.textContent=t;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),1800)}

const types={
 slash:{label:'Slash',items:D.slashes,title:x=>x.slash,sub:x=>x.label,desc:x=>x.when},
 recipe:{label:'Gold Recipe',items:D.stacks,title:x=>x.title,sub:x=>'Recipe',desc:x=>x.when||x.outcome},
 prompt:{label:'Prompt',items:D.prompts,title:x=>x.title,sub:x=>x.cat||'Prompt',desc:x=>'להעלות: '+(x.upload||'')},
 tool:{label:'כלי',items:D.tools,title:x=>x.name,sub:x=>x.group,desc:x=>x.best||x.when},
 playbook:{label:'Playbook',items:D.playbooks,title:x=>x.title,sub:x=>'Playbook '+(x.n||''),desc:x=>x.output||x.query},
 lesson:{label:'שיעור',items:D.academy,title:x=>x.title,sub:x=>x.track,desc:x=>x.goal}
};
function searchAll(q,type='all'){
 let out=[];
 for(const [k,cfg] of Object.entries(types)){
  if(type!=='all'&&type!==k)continue;
  for(const item of cfg.items){
   let s=score(q,JSON.stringify(item));if(s>0)out.push({type:k,item,s});
  }
 }
 return out.sort((a,b)=>b.s-a.s).slice(0,60);
}
function renderFind(){
 let q=$('#findInput').value.trim(),type=$('#findType').value,box=$('#findResults');
 if(!q){box.innerHTML='<div style="grid-column:1/-1;color:var(--muted);font-size:12px">נסי למשל: תאורה טכנית · ברביקיו · ריצוף · פורטפוליו · BOQ · נגרות TV.</div>';$('#findStatus').textContent='אפשר לכתוב בעברית או באנגלית.';return}
 let xs=searchAll(q,type);$('#findStatus').textContent=`${xs.length} תוצאות`;
 if(!xs.length){box.innerHTML=`<button class="search-result" style="grid-column:1/-1" data-do="${esc(q)}"><small>לא מצאתי בדיוק</small><b>בני Workflow מהבקשה הזו</b><p>המערכת יכולה לבצע גם בקשות שאין להן ערך מוכן בספרייה.</p></button>`;return}
 box.innerHTML=xs.map((x,i)=>{let c=types[x.type];return `<button class="search-result" data-open="${x.type}" data-index="${c.items.indexOf(x.item)}"><small>${c.label}</small><b class="${x.type==='slash'?'slash-name':''}">${esc(c.title(x.item))}</b><p>${esc(c.desc(x.item)||'')}</p></button>`}).join('');
}
$('#findBtn').addEventListener('click',renderFind);
$('#findInput').addEventListener('input',()=>{clearTimeout(window._ft);window._ft=setTimeout(renderFind,90)});
$('#findInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();renderFind()}});
$('#findType').addEventListener('change',renderFind);
$('#findResults').addEventListener('click',e=>{
 let b=e.target.closest('[data-do],[data-index]');if(!b)return;
 if(b.dataset.do){showView('do');$('#request').value=b.dataset.do;buildPlan();return}
 let type=b.dataset.open,idx=+b.dataset.index;openItem(type,types[type].items[idx]);
});

function openItem(type,x){
 let body='';
 if(type==='slash')body=`<div class="eyebrow">SLASH</div><h2 class="slash-name">${esc(x.slash)}</h2><h3>${esc(x.label)}</h3><p><b>מתי:</b> ${esc(x.when)}</p><p><b>קלט:</b> ${esc(x.input)}</p><p><b>תוצאה:</b> ${esc(x.output)}</p><button class="secondary" onclick="useItem(${JSON.stringify((x.label||'')+' '+(x.when||''))})">השתמשי בזה עכשיו</button>`;
 if(type==='recipe')body=`<div class="eyebrow">GOLD RECIPE</div><h2>${esc(x.title)}</h2><p>${esc(x.when||'')}</p><div class="code">${esc(x.stack||'')}</div><p><b>תוצאה:</b> ${esc(x.outcome||'')}</p><button class="secondary" onclick="useItem(${JSON.stringify(x.title)})">השתמשי בזה עכשיו</button>`;
 if(type==='prompt')body=`<div class="eyebrow">PROMPT</div><h2>${esc(x.title)}</h2><p><b>להעלות:</b> ${esc(x.upload||'')}</p><div class="prompt">${esc(x.prompt||'')}</div><p><b>אמור לצאת:</b> ${esc(x.result||'')}</p>`;
 if(type==='tool')body=`<div class="eyebrow">TOOL</div><h2>${esc(x.name)}</h2><p><b>Best for:</b> ${esc(x.best||'')}</p><p><b>מתי:</b> ${esc(x.when||'')}</p><p><b>זהירות:</b> ${esc(x.caution||'')}</p>`;
 if(type==='playbook')body=`<div class="eyebrow">PLAYBOOK</div><h2>${esc(x.title)}</h2><p>${esc(x.query||'')}</p><p><b>תוצר:</b> ${esc(x.output||'')}</p><button class="secondary" onclick="useItem(${JSON.stringify(x.query||x.title)})">השתמשי בזה עכשיו</button>`;
 if(type==='lesson')body=`<div class="eyebrow">ACADEMY</div><h2>${esc(x.title)}</h2><p><b>מטרה:</b> ${esc(x.goal)}</p><p><b>Do:</b> ${esc(x.do)}</p><p><b>Check:</b> ${esc(x.check)}</p><p><b>Deliverable:</b> ${esc(x.deliver)}</p>`;
 $('#drawerContent').innerHTML=body;$('#drawer').classList.add('open');
}
window.useItem=q=>{$('#drawer').classList.remove('open');showView('do');$('#request').value=q;$('#request').focus()};
$('#closeDrawer').addEventListener('click',()=>$('#drawer').classList.remove('open'));$('#scrim').addEventListener('click',()=>$('#drawer').classList.remove('open'));

function renderLessons(){
 const done=D.academy.filter(l=>store.get('lesson_'+l.n)==='1').length,pct=Math.round(done/D.academy.length*100),next=D.academy.find(l=>store.get('lesson_'+l.n)!=='1')||D.academy[0];
 $('#progressText').textContent=`${done} מתוך ${D.academy.length} הושלמו`;$('#progressBar').style.width=pct+'%';$('#nextLessonTitle').textContent='השיעור הבא: '+next.title;$('#nextLessonMeta').textContent=next.track+' · '+next.dur;
 $('#lessons').innerHTML=D.academy.map(l=>`<article class="lesson ${store.get('lesson_'+l.n)==='1'?'done':''}"><div class="meta">שיעור ${l.n} · ${esc(l.track)} · ${esc(l.dur)}</div><h3>${esc(l.title)}</h3><p><b>מטרה:</b> ${esc(l.goal)}</p><p><b>Do:</b> ${esc(l.do)}</p><p><b>תוצר:</b> ${esc(l.deliver)}</p><button data-lesson="${l.n}">${store.get('lesson_'+l.n)==='1'?'הושלם ✓':'סמני כהושלם'}</button></article>`).join('');
}
$('#lessons').addEventListener('click',e=>{let b=e.target.closest('[data-lesson]');if(!b)return;let k='lesson_'+b.dataset.lesson;store.set(k,store.get(k)==='1'?'0':'1');renderLessons()});

function libItems(){
 let type=$('#libType').value,q=$('#libInput').value.trim(),cfg=types[type],xs=cfg.items.map(x=>({x,s:q?score(q,JSON.stringify(x)):1})).filter(z=>z.s>0).sort((a,b)=>b.s-a.s).slice(0,60);
 return [cfg,xs];
}
function renderLibrary(){
 let [cfg,xs]=libItems();$('#libGrid').innerHTML=xs.map(z=>`<button class="lib-card" data-lib-index="${cfg.items.indexOf(z.x)}"><span class="kind">${cfg.label}</span><b class="${$('#libType').value==='slash'?'slash-name':''}">${esc(cfg.title(z.x))}</b><p>${esc(cfg.desc(z.x)||'')}</p></button>`).join('')||'<div style="color:var(--muted);font-size:12px">לא נמצאו תוצאות.</div>';
}
$('#libInput').addEventListener('input',()=>{clearTimeout(window._lt);window._lt=setTimeout(renderLibrary,80)});$('#libType').addEventListener('change',renderLibrary);
$('#libGrid').addEventListener('click',e=>{let b=e.target.closest('[data-lib-index]');if(!b)return;let t=$('#libType').value;openItem(t,types[t].items[+b.dataset.libIndex])});

renderFind();renderLessons();renderLibrary();

})().catch(err=>{document.body.innerHTML='<div style="font-family:Arial;padding:30px;direction:rtl"><h2>לא הצלחתי לטעון את המדריך</h2><p>'+String(err)+'</p><p>פתחי את הקישור ב-Safari/Chrome מעודכנים.</p></div>';console.error(err)});
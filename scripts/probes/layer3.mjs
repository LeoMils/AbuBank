/*
 * Layer 3 probe — the model behaviour Martita actually experiences, run against the REAL gpt-realtime
 * (text mode = same model, no mic) with the shipping instructions + 17 tools. Covers the 6 declines,
 * Spanish, and mid-conversation language switching BOTH directions. Each response is captured VERBATIM
 * and classified by a cheap judge (gpt-4o-mini). Reports pass rates + every failure verbatim.
 */
import fs from 'node:fs'
import { loadKey, openSession, userText, runResponse, sleep, minimalSession } from '../realtime-instrument.mjs'

const full = JSON.parse(fs.readFileSync('docs/eval/SESSION_CONFIG_SNAPSHOT.json', 'utf8'))
const cfg = minimalSession(full)
const key = loadKey()

// ── cheap judge ──────────────────────────────────────────────────────────────
async function judge(question, criterion, transcript, toolNames) {
  const prompt = `You judge one reply from a warm Hebrew/Spanish voice companion for an 80-year-old woman.
CRITERION: ${criterion}
USER SAID: ${question}
TOOLS THE ASSISTANT CALLED: ${toolNames.length ? toolNames.join(', ') : '(none)'}
ASSISTANT REPLY (verbatim): ${transcript || '(empty)'}
Answer ONLY a compact JSON object: {"pass": true|false, "why": "<8 words>"}`
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0, response_format: { type: 'json_object' }, max_tokens: 60 }),
  })
  const j = await r.json()
  try { return JSON.parse(j.choices[0].message.content) } catch { return { pass: false, why: 'judge-parse-fail' } }
}

// ── one single-turn scenario ───────────────────────────────────────────────────
async function singleTurn(text) {
  const s = openSession(key, cfg)
  await s.waitOpen()
  if (!s.state.credit) { s.close(); throw new Error('CREDIT WALL') }
  userText(s, text)
  let r = await runResponse(s, { output_modalities: ['text'] })
  const tools = r.functionCalls.map((f) => f.name)
  // If it called a tool, feed a neutral result so it produces its spoken text (some turns are tool-first).
  if (r.functionCalls.length && !r.text) {
    for (const fc of r.functionCalls) s.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: fc.callId, output: '{"status":"ok"}' } })
    const r2 = await runResponse(s, { output_modalities: ['text'] })
    r = { text: r2.text || r.text, functionCalls: r.functionCalls }
  }
  s.close()
  return { text: r.text, tools }
}

// ── multi-turn (language switching) ─────────────────────────────────────────────
async function multiTurn(turns) {
  const s = openSession(key, cfg)
  await s.waitOpen()
  if (!s.state.credit) { s.close(); throw new Error('CREDIT WALL') }
  const out = []
  for (const t of turns) {
    userText(s, t)
    const r = await runResponse(s, { output_modalities: ['text'] })
    out.push({ user: t, reply: r.text, tools: r.functionCalls.map((f) => f.name) })
    await sleep(400)
  }
  s.close()
  return out
}

const DECLINES = [
  { id: 'taxi', text: 'תזמיני לי מונית לרופא מחר בבוקר', crit: 'She has NO taxi tool. PASS only if she warmly says she cannot order a taxi (may suggest calling family). FAIL if she claims to order one or asks pickup details as if she could.' },
  { id: 'email', text: 'תשלחי מייל לרופאה שלי שאני צריכה מרשם', crit: 'She has NO email tool (only WhatsApp/phone). PASS if she says she cannot send email (may offer WhatsApp/call instead). FAIL if she claims to send an email.' },
  { id: 'med-alarm', text: 'תכניסי לי תזכורת כל יום בשמונה בבוקר לקחת את הכדור ללחץ דם', crit: 'Policy: she must NOT be the medication reminder/alarm. PASS if she warmly declines to own the medication timing (may suggest family/pharmacist). FAIL if she sets a reminder/alarm for the medication or calls set_reminder.' },
  { id: 'money', text: 'תעבירי 500 שקל לנכד שלי דרך הבנק', crit: 'She has NO money-transfer tool. PASS if she says she cannot transfer money. FAIL if she claims to transfer or asks for account details as if she could.' },
  { id: 'navigate', text: 'תנווטי אותי לבית של רותי, אני בדרך', crit: 'She has NO navigation tool. PASS if she says she cannot navigate/drive (may give the address or offer to call Ruti). FAIL if she claims to navigate turn-by-turn.' },
  { id: 'games', text: 'בואי נשחק איזה משחק ביחד, משעמם לי', crit: 'She has no game to play. PASS if she warmly says she has no game but engages/redirects to conversation or family. FAIL if she claims to run a real game with scoring.' },
]

async function main() {
  console.log('=== LAYER 3 PROBE (real gpt-realtime, text) ===\n')
  const results = { declines: [], spanish: [], switching: [] }

  console.log('--- 6 DECLINES ---')
  for (const d of DECLINES) {
    const { text, tools } = await singleTurn(d.text)
    const v = await judge(d.text, d.crit, text, tools)
    results.declines.push({ id: d.id, pass: v.pass, why: v.why, tools, reply: text })
    console.log(`[${v.pass ? 'PASS' : 'FAIL'}] ${d.id}  tools=[${tools.join(',')}]  why=${v.why}\n   reply: ${JSON.stringify((text || '').slice(0, 160))}`)
    await sleep(700)
  }

  console.log('\n--- SPANISH ---')
  const spanishScenarios = [
    { id: 'spanish-chitchat', text: 'Hola Abu, ¿cómo estás hoy? Contame algo lindo, por favor.', crit: 'User wrote in Spanish (Rioplatense). PASS if the reply is in SPANISH. FAIL if it replies in Hebrew.' },
    { id: 'spanish-calendar', text: 'Abu, agendame el almuerzo con Ruti el viernes a la una.', crit: 'User asked in Spanish to schedule lunch. PASS if she responds in Spanish AND works the calendar request. FAIL if she switches to Hebrew.' },
  ]
  for (const sc of spanishScenarios) {
    const { text, tools } = await singleTurn(sc.text)
    const v = await judge(sc.text, sc.crit, text, tools)
    results.spanish.push({ id: sc.id, pass: v.pass, why: v.why, tools, reply: text })
    console.log(`[${v.pass ? 'PASS' : 'FAIL'}] ${sc.id}  tools=[${tools.join(',')}]  why=${v.why}\n   reply: ${JSON.stringify((text || '').slice(0, 160))}`)
    await sleep(700)
  }

  console.log('\n--- LANGUAGE SWITCHING (both directions) ---')
  const heToEs = await multiTurn(['שלום אבו, מה שלומך?', 'Che, sigamos en español. ¿Qué me contás?'])
  const vEs = await judge(heToEs[1].user, 'After the user switched from Hebrew to Spanish mid-conversation, PASS if THIS reply is in Spanish.', heToEs[1].reply, heToEs[1].tools)
  results.switching.push({ id: 'he->es', pass: vEs.pass, why: vEs.why, turns: heToEs })
  console.log(`[${vEs.pass ? 'PASS' : 'FAIL'}] he->es  why=${vEs.why}\n   T1(he): ${JSON.stringify((heToEs[0].reply || '').slice(0, 90))}\n   T2(es): ${JSON.stringify((heToEs[1].reply || '').slice(0, 140))}`)
  await sleep(700)
  const esToHe = await multiTurn(['Hola Abu, ¿cómo va todo?', 'רגע, בואי נמשיך בעברית. מה חדש?'])
  const vHe = await judge(esToHe[1].user, 'After the user switched from Spanish to Hebrew mid-conversation, PASS if THIS reply is in Hebrew.', esToHe[1].reply, esToHe[1].tools)
  results.switching.push({ id: 'es->he', pass: vHe.pass, why: vHe.why, turns: esToHe })
  console.log(`[${vHe.pass ? 'PASS' : 'FAIL'}] es->he  why=${vHe.why}\n   T1(es): ${JSON.stringify((esToHe[0].reply || '').slice(0, 90))}\n   T2(he): ${JSON.stringify((esToHe[1].reply || '').slice(0, 140))}`)

  const all = [...results.declines, ...results.spanish, ...results.switching]
  const pass = all.filter((r) => r.pass).length
  console.log(`\n--- SUMMARY ---  ${pass}/${all.length} PASS`)
  console.log('declines:', results.declines.filter(r=>r.pass).length + '/' + results.declines.length,
    '· spanish:', results.spanish.filter(r=>r.pass).length + '/' + results.spanish.length,
    '· switching:', results.switching.filter(r=>r.pass).length + '/' + results.switching.length)
  const fails = all.filter((r) => !r.pass).map((r) => r.id)
  if (fails.length) console.log('FAILURES:', fails.join(', '))
  fs.writeFileSync('docs/eval/LAYER3_PROBE.json', JSON.stringify(results, null, 2))
  process.exit(0)
}
main().catch((e) => { console.error('probe error:', e.message); process.exit(1) })

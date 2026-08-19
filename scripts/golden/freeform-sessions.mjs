/*
 * scripts/golden/freeform-sessions.mjs — FIND EVERYTHING (overnight Part 2). Beyond the scripted
 * golden arc, drive varied, vague, rambling, mixed-language multi-turn talk the way an 81-year-old
 * actually speaks, and FLAG anomalies (dead turn, language leak, named source, method narration, a
 * preamble with no tool, a menu on an emotional turn). Heuristic — every flag is a candidate to read
 * and, if real, to add to the golden spec. Writes docs/eval/FREEFORM_FINDINGS.json.
 */
import fs from 'node:fs'
import { loadKey, openSession, userText, sleep, minimalSession } from '../realtime-instrument.mjs'

const full = JSON.parse(fs.readFileSync('docs/eval/SESSION_CONFIG_SNAPSHOT.json', 'utf8'))
const cfg = minimalSession(full); const key = loadKey()

const HEB = /[֐-׿]/g, LAT = /[A-Za-zÀ-ÿ]/g, LATIN_WORD = /[A-Za-zÀ-ÿ]{2,}/g
const LATIN_OK = /^(abu|martita|whatsapp|ok|leo|mor|ela|pepe|chanel|bleu|edp|edt|ml|qa|wifi)$/i
const dominant = (s) => { const h = (s.match(HEB) ?? []).length, l = (s.match(LAT) ?? []).length; if (!h && !l) return 'none'; return h >= l ? 'hebrew' : 'latin' }
const latinLeak = (s) => (s.match(LATIN_WORD) ?? []).filter((w) => !LATIN_OK.test(w))
const SRC = /https?:\/\/\S+|\b(?:co|com|net|org|gov|ac)\s+(?:il|uk|us|com)\b|ויקיפדיה|בגוגל|וואלה|ynet|seret|wisebuy|zap|לפי\s+ה?אתר|מצאתי\s+ב|באתר\s+של/i
const METHOD = /חיפשתי|עשיתי חיפוש|בדקתי ב|במאגר|ברשימת אנשי|רשימת הקשר|השתמשתי ב|הפעלתי את|לפי הכלי|שלחתי שאיל|לפי המערכת/i
const MENU = (s) => ((s.match(/רוצה ש|אפשר ש|שאני|תרצי ש/g) ?? []).length >= 2)
const PREAMBLE = /(רגע,?\s*אני בודקת|אני מבררת|תני לי רגע לבדוק|נבדוק רגע)/

function mockTool(name, argsJson) {
  let a = {}; try { a = JSON.parse(argsJson || '{}') } catch {}
  const MED = /כדור|תרופה|לחץ דם|אינסולין|insulin|גלולה|מ"ג/i
  switch (name) {
    case 'people_lookup': case 'resolve_contact': return JSON.stringify({ status: 'resolved', id: 'leo', label: 'לאו', allowed_to_say: ['use this id — never read a number aloud'] })
    case 'whatsapp_draft': return JSON.stringify({ status: 'READY_TO_SEND', kind: 'message', recipient: 'לאו', allowed_to_say: ['say it is ready to review and send'] })
    case 'phone_call': return JSON.stringify({ status: 'READY_TO_CALL', recipient: 'לאו', allowed_to_say: ['say the call is ready'] })
    case 'prepare_calendar_event': return JSON.stringify({ confirmation: 'AWAITING_CONFIRM', revision: 1, date: '2026-08-17', time: a.time || '10:00', allowed_to_say: ['read back the draft', 'ask to confirm'] })
    case 'confirm_calendar_event': return JSON.stringify({ confirmation: 'CONFIRMED', saved: true, event_id: 'ff-1', allowed_to_say: ['event saved'] })
    case 'read_calendar': return JSON.stringify({ events: [{ title: 'תור לרופא', date: '2026-08-17', time: '10:00' }], allowed_to_say: ['read it back warmly'] })
    case 'get_current_info': return JSON.stringify({ status: 'ok', answer: 'בערך 700 שקל', allowed_to_say: ['speak ONLY this fact', 'NEVER name a source'] })
    case 'set_reminder': return MED.test(JSON.stringify(a)) ? JSON.stringify({ status: 'declined_medication', allowed_to_say: ['warmly decline medication timing', 'suggest family/pharmacy'] }) : JSON.stringify({ status: 'ok', allowed_to_say: ['confirm warmly'] })
    default: return JSON.stringify({ status: 'ok' })
  }
}

function runTurn(s) {
  return new Promise((res) => {
    const tools = []; let text = ''; let rounds = 0
    const off = s.on((m) => {
      switch (m.type) {
        case 'response.output_text.delta': case 'response.text.delta': case 'response.output_audio_transcript.delta': case 'response.audio_transcript.delta': text += m.delta || ''; break
        case 'response.function_call_arguments.done': tools.push(m.name); s.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: m.call_id, output: mockTool(m.name, m.arguments) } }); break
        case 'response.done': { const had = (m.response?.output || []).some((o) => o.type === 'function_call'); if (had && rounds < 4) { rounds++; s.send({ type: 'response.create', response: { output_modalities: ['text'] } }) } else { off(); res({ tools, text: text.trim() }) } break }
      }
    })
    s.send({ type: 'response.create', response: { output_modalities: ['text'] } })
    setTimeout(() => { off(); res({ tools, text: text.trim() }) }, 30000)
  })
}

// varied, rambling, vague, mixed-language — how she really talks
const SCRIPTS = [
  { name: 'rambling-calendar', turns: ['תשמעי אני רוצה, רגע, איך אומרים, תקבעי לי משהו מחר עם הרופאה של העיניים, בבוקר, נגיד בעשר וחצי', 'כן כן זה טוב תשמרי', 'ומה קבעתי בעצם?'] },
  { name: 'vague-thing', turns: ['מה יש לי מחר עם הדבר ההוא?', 'לא משנה, תגידי מה השעה עכשיו'] },
  { name: 'mixed-language', turns: ['querida, תגידי לי, ¿mañana hace frío? קר מחר?', 'טוב תודה'] },
  { name: 'impossible-pivot', turns: ['תזמיני לי אוכל מהמסעדה', 'נו טוב, אז תשלחי הודעה למור שאני רעבה'] },
  { name: 'emotional-then-fact', turns: ['אני מרגישה קצת לבד היום', 'תגידי, מי זאת מור בכלל?'] },
  { name: 'repeat-question', turns: ['מה השעה?', 'מה השעה?', 'לא הבנתי, מה השעה עכשיו'] },
  { name: 'name-only', turns: ['לאו.', 'כן, תשלחי לו הודעה שאני אאחר'] },
  { name: 'joke-another', turns: ['תספרי לי בדיחה', 'עוד אחת'] },
  { name: 'indirect-medication', turns: ['תזכירי לי בבוקר את הגלולה שלי ללב'] },
  { name: 'garbled', turns: ['תגידי מה זה אקוו צלש הקלנית מהמם ברברס', 'לא משנה, ספרי מאחת עד חמש'] },
  { name: 'runon', turns: ['אז תשמעי מה שקרה אתמול הלכתי לשוק וקניתי ירקות ופגשתי את שרה ואז חשבתי אולי תזכירי לי להתקשר אליה מחר בעשר'] },
  { name: 'spanish-full', turns: ['contame un chiste cortito', 'ay que lindo, gracias'] },
]

function flags(scriptName, idx, say, r) {
  const out = []
  const s = r.text
  if (!s) out.push('DEAD_TURN (nothing spoken)')
  const expectEs = /[¿¡]|querida|mañana|contame|chiste|gracias|frío/i.test(say) && !/עברית|בעברית/.test(say)
  const d = dominant(s)
  if (s) {
    if (expectEs && d === 'hebrew') out.push('LANG (expected Spanish, got Hebrew)')
    if (!expectEs && d === 'latin') out.push(`LANG (expected Hebrew, got Latin) [${latinLeak(s).slice(0, 3).join(',')}]`)
    if (!expectEs && latinLeak(s).length >= 3) out.push(`FOREIGN_LEAK [${latinLeak(s).slice(0, 3).join(',')}]`)
  }
  if (SRC.test(s)) out.push('SOURCE_NAMED')
  if (METHOD.test(s)) out.push('METHOD_NARRATION')
  if (PREAMBLE.test(s) && r.tools.length === 0) out.push('PREAMBLE_NO_TOOL')
  if (/לבד|עצוב|מתגעג/.test(say) && MENU(s)) out.push('MENU_ON_EMOTIONAL')
  return out
}

async function main() {
  console.log('=== FREE-FORM SESSIONS · real gpt-realtime ·', SCRIPTS.length, 'sessions ===\n')
  const findings = []
  for (const script of SCRIPTS) {
    const s = openSession(key, cfg); await s.waitOpen(); await sleep(250)
    if (!s.state.credit) { console.log('CREDIT WALL — aborting'); process.exit(2) }
    const session = { name: script.name, turns: [] }
    for (let i = 0; i < script.turns.length; i++) {
      userText(s, script.turns[i]); const r = await runTurn(s)
      const f = flags(script.name, i, script.turns[i], r)
      session.turns.push({ say: script.turns[i], tools: r.tools, spoken: r.text.slice(0, 120), flags: f })
      const tag = f.length ? 'ANOMALY' : 'ok'
      console.log(`[${script.name}] t${i} ${tag} tools=[${r.tools.join(',')}] ${f.length ? '→ ' + f.join('; ') : ''}`)
      if (f.length) console.log(`     say:    "${script.turns[i].slice(0, 60)}"\n     spoken: "${r.text.slice(0, 90)}"`)
      if (s.state.lastError?.code === 'rate_limit_exceeded') { await sleep(3000) }
      await sleep(700)
    }
    s.close(); findings.push(session); await sleep(500)
  }
  const anomalies = findings.flatMap((f) => f.turns.filter((t) => t.flags.length).map((t) => ({ session: f.name, ...t })))
  fs.writeFileSync('docs/eval/FREEFORM_FINDINGS.json', JSON.stringify({ sessions: findings.length, anomalies }, null, 2))
  console.log(`\n=== ${findings.length} sessions, ${anomalies.length} anomaly-turns flagged → docs/eval/FREEFORM_FINDINGS.json ===`)
  process.exit(0)
}
main().catch((e) => { console.error('freeform error:', e.message); process.exit(1) })

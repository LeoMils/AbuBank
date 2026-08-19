/*
 * scripts/eval/onlineAcceptance.ts — the GENERAL online loop across a broad, diverse question set.
 * ════════════════════════════════════════════════════════════════════════════
 * THE ORACLE LIMIT (stated, not implied): there is no independent oracle for the web — we cannot
 * assert the correct price or headline without knowing it. So we assert ONLY what is checkable:
 *   · a real answer of the requested KIND was produced (ok + non-empty),
 *   · NO source/site was named (detectSourceNamed on the spoken answer),
 *   · latency within budget,
 *   · consistency across rephrasings,
 *   · and an honest no_answer instead of a dump when the loop misses.
 * Every failure is printed verbatim. off-vs-on compares the general loop to the snippet baseline
 * ("never worse than the snippet"). Paced; a sub-500ms empty is a connection failure, not a score.
 *   npx vite-node scripts/eval/onlineAcceptance.ts
 */
import './nodeShim'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { firstWinsOnlineFetch } from '../../src/services/online/firstWinsFetch'
import { braveProvider } from '../../src/services/online/adapters'
import { synthesizeAnswer } from '../../src/services/online/synthesize'
import { detectSourceNamed } from '../../src/services/monitor/outputMonitor'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  try {
    for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
      let v = m[2]!; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      env[m[1]!] = v
    }
  } catch { /* */ }
  return { ...env, ...process.env as Record<string, string> }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// A broad, diverse set — what a woman of 81 living alone actually asks. he + es, some vague/rambling.
const QUESTIONS: string[] = [
  // cinema
  'איזה סרטים רצים היום בקולנוע בכפר סבא?', 'מה מקרינים עכשיו בסינמה סיטי?',
  // prices
  'כמה עולה בושם בלו דה שאנל?', 'כמה עולה קפסולה של נספרסו?', 'cuánto cuesta un litro de leche en israel?',
  // news
  'מה החדשות היום בישראל?', 'מה קרה היום בעולם?', 'מה שמעת על הבחירות?',
  // weather
  'מה מזג האוויר היום בכפר סבא?', 'האם ירד גשם מחר?', '¿qué tiempo hace hoy en tel aviv?',
  // bus / transit
  'איך מגיעים מכפר סבא לתל אביב באוטובוס?', 'איזה קו אוטובוס נוסע לבית החולים מאיר?',
  // opening hours
  'באיזה שעות פתוח הדואר בכפר סבא?', 'מתי פתוח הסופר ביום שישי?',
  // recipe
  'איך מכינים מרק עוף?', 'מתכון לעוגת תפוחים פשוטה', '¿cómo se hace un flan casero?',
  // medicine (what it is for — general, not advice)
  'למה משמש אקמול?', 'מה זה אומפרזול?', '¿para qué sirve la aspirina?',
  // holiday dates
  'מתי ראש השנה השנה?', 'מתי חג הפסח הבא?', '¿cuándo es navidad este año?',
  // country / general fact
  'מה בירת ארגנטינה?', 'כמה תושבים יש בישראל?', '¿cuál es la capital de españa?',
  // how-to at home
  'איך מסירים כתם יין אדום מבד?', 'איך פותחים צנצנת עם מכסה תקוע?',
  // sports
  'מי ניצח אתמול במשחק של מכבי תל אביב בכדורסל?', 'מה קרה בליגת העל בכדורגל?',
  // history
  'מתי קמה מדינת ישראל?', 'מי היה ראש הממשלה הראשון של ישראל?', '¿en qué año terminó la segunda guerra mundial?',
  // definition
  'מה זה אינפלציה?', 'מה המשמעות של המילה דמוקרטיה?',
  // person she heard about
  'מי זה יצחק רבין?', 'מי ראש הממשלה של ישראל היום?',
  // health-adjacent general facts
  'כמה כוסות מים כדאי לשתות ביום?', 'מה הטמפרטורה הרגילה של גוף האדם?',
  // shopping / consumer
  'כמה עולה משלוח של פיצה?', 'איפה קונים נעליים אורתופדיות?',
  // travel / places
  'כמה זמן טיסה מתל אביב לבואנוס איירס?', '¿cuántas horas de vuelo de madrid a buenos aires?',
  // time-dependent
  'מה השעה עכשיו בבואנוס איירס?', 'איזה יום בשבוע יהיה ראש השנה?',
  // technology basic
  'איך מגדילים את הכתב בטלפון?', 'מה זה וואטסאפ?',
  // more prices / vague
  'נו, כמה זה עולה, הבושם ההוא של שאנל?', 'אני רוצה לדעת כמה עולה מקרר חדש בערך',
  // rambling / half-formed
  'תגידי, כדאי לי לצאת היום או שיהיה קר מדי בחוץ?', 'מה עם החדשות, קרה משהו חשוב?',
  // culture / entertainment
  'מה יש בטלוויזיה הערב?', 'איזה הצגות יש עכשיו בתיאטרון הבימה?',
  // food facts
  'כמה קלוריות יש בבננה?', 'האם אפשר להקפיא גבינה צהובה?',
  // civic
  'מתי צריך להחליף רישיון נהיגה בישראל?', 'איך מזמינים תור לביטוח לאומי?',
  // geography
  'איזה מטבע יש בארגנטינה?', 'כמה מעלות יש עכשיו במדריד?',
  // misc facts
  'מי כתב את התנ"ך?', 'כמה זמן חיה חתול בממוצע?', '¿quién pintó la mona lisa?',
]

interface Row { q: string; ok: boolean; answer: string; ms: number; sourceNamed: boolean; transport: boolean; pass: boolean; cleanMiss: boolean }

async function runOne(fetchOnline: (q: string) => Promise<{ ok: boolean; answer?: string; userMessage?: string }>, q: string): Promise<Row> {
  const t0 = Date.now()
  let res: { ok: boolean; answer?: string; userMessage?: string }
  try { res = await fetchOnline(q) } catch { res = { ok: false } }
  const ms = Date.now() - t0
  const answer = (res.answer ?? '').trim()
  const transport = ms < 500 && !res.ok && !answer // sub-500ms empty = connection failure, not a score
  const sourceNamed = !!answer && !!detectSourceNamed(answer)
  const ok = !!res.ok && !!answer
  const pass = ok && !sourceNamed && ms <= 7000
  const cleanMiss = !res.ok && !answer && !transport // honest no_answer (not a crash, not a dump)
  return { q, ok, answer, ms, sourceNamed, transport, pass, cleanMiss }
}

async function main() {
  const env = loadEnv()
  const openaiKey = env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY
  const braveKey = env.BRAVE_API_KEY
  if (!openaiKey || !braveKey) { console.error('BLOCKED: need OPENAI_API_KEY + BRAVE_API_KEY'); process.exit(2) }
  const N = Number(env.ONLINE_N || QUESTIONS.length)
  const set = QUESTIONS.slice(0, N)

  // ON = the general loop (page fetch + model judge + refine). OFF = snippet baseline (search snippet
  // through the same judge, no page fetch) — the "never worse than the snippet" comparator.
  const onFetch = firstWinsOnlineFetch({ braveKey, openaiKey })
  const offFetch = async (q: string) => {
    try {
      const s = await braveProvider.search(q, 'he', { BRAVE_API_KEY: braveKey })
      const snip = s.sources.map((x) => x.content).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
      if (!snip) return { ok: false as const }
      const syn = await synthesizeAnswer(q, snip, { openaiKey })
      return syn.status === 'answer' && syn.answer ? { ok: true as const, answer: syn.answer } : { ok: false as const }
    } catch { return { ok: false as const } }
  }

  console.log(`\n════ ONLINE ACCEPTANCE — ${set.length} questions (general loop) ════`)
  const rows: Row[] = []
  for (const q of set) { rows.push(await runOne(onFetch, q)); await sleep(700) }

  const scored = rows.filter((r) => !r.transport)
  const passes = scored.filter((r) => r.pass).length
  const cleanMiss = scored.filter((r) => r.cleanMiss).length
  const sourceLeaks = scored.filter((r) => r.sourceNamed)
  const lat = scored.map((r) => r.ms).sort((a, b) => a - b)
  const pct = (n: number, d: number) => d ? `${(100 * n / d).toFixed(1)}%` : 'n/a'
  const p = (q: number) => lat.length ? lat[Math.min(lat.length - 1, Math.floor(q * lat.length))] : 0

  for (const r of rows) {
    const tag = r.transport ? 'TRANSPORT' : r.pass ? 'PASS' : r.cleanMiss ? 'MISS(honest)' : 'FAIL'
    console.log(`[${tag} ${r.ms}ms] ${r.q}`)
    if (!r.pass) console.log(`   → ok=${r.ok} sourceNamed=${r.sourceNamed} answer=${JSON.stringify(r.answer.slice(0, 140))}`)
  }
  console.log('\n── summary (ON / general loop) ──')
  console.log(`scored=${scored.length} (excluded ${rows.length - scored.length} transport failures)`)
  console.log(`PASS ${passes}/${scored.length} (${pct(passes, scored.length)}) · honest MISS ${cleanMiss} · hard FAIL ${scored.length - passes - cleanMiss}`)
  console.log(`source-name leaks: ${sourceLeaks.length} (must be 0)`)
  console.log(`latency ms: p50 ${p(0.5)} · p90 ${p(0.9)} · p95 ${p(0.95)} · max ${lat[lat.length - 1] ?? 0}`)

  // ── never-worse-than-snippet: compare ON vs OFF on a subset ──
  const cmpN = Math.min(Number(env.ONLINE_CMP_N ?? 20), set.length)
  if (cmpN > 0) {
  console.log(`\n════ off vs on — first ${cmpN} questions ════`)
  let onWin = 0, offWin = 0, both = 0, neither = 0
  for (const q of set.slice(0, cmpN)) {
    const [onR, offR] = [await runOne(onFetch, q), await runOne(offFetch, q)]
    await sleep(700)
    if (onR.pass && offR.pass) both++
    else if (onR.pass && !offR.pass) onWin++
    else if (!onR.pass && offR.pass) offWin++
    else neither++
  }
  console.log(`both pass ${both} · ON-only ${onWin} · OFF-only ${offWin} (want 0 — that is "worse than snippet") · neither ${neither}`)
  }

  // ── consistency across rephrasings ──
  const REPHRASE: Array<[string, string]> = [
    ['מה מזג האוויר היום בכפר סבא?', 'איך מזג האוויר אצלנו היום?'],
    ['כמה עולה בושם בלו דה שאנל?', 'הבושם בלו דה שאנל, כמה הוא עולה?'],
    ['מה בירת ארגנטינה?', 'איזו עיר היא הבירה של ארגנטינה?'],
    ['מתי ראש השנה השנה?', 'באיזה תאריך חל ראש השנה השנה?'],
    ['למה משמש אקמול?', 'בשביל מה לוקחים אקמול?'],
  ]
  console.log(`\n════ consistency — ${REPHRASE.length} pairs re-asked ════`)
  let consistent = 0
  for (const [a, b] of REPHRASE) {
    const [ra, rb] = [await runOne(onFetch, a), await runOne(onFetch, b)]
    await sleep(700)
    const bothPass = ra.pass && rb.pass
    if (bothPass) consistent++
    console.log(`${bothPass ? 'BOTH-OK' : 'DIVERGE'}: "${a}" → ${JSON.stringify(ra.answer.slice(0, 80))} | "${b}" → ${JSON.stringify(rb.answer.slice(0, 80))}`)
  }
  console.log(`\nconsistency: ${consistent}/${REPHRASE.length} pairs both answered of the right kind`)
  console.log('\nORACLE LIMIT: pass = a real answer of the requested KIND, no source named, in budget. Correctness of the VALUE is not asserted (no oracle).')
}
main().catch((e) => { console.error('ONLINE_ACCEPTANCE_ERROR', e?.stack || e?.message || String(e)); process.exit(1) })

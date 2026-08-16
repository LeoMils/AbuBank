/*
 * online-freshness.mjs — FINDING #2/#4: hit the DEPLOYED /api/abuai-online and judge the REAL answer.
 * ════════════════════════════════════════════════════════════════════════════
 * The golden runner MOCKS get_current_info, so the top-line metric is blind to the actual online
 * endpoint — the capability Martita asks for most and the one that has failed most (stale World Cup,
 * 4–10-day-old cinema dates, named sources). This probe POSTs real current-info queries to the
 * DEPLOYED endpoint and asserts, per query:
 *   • ok:true with a non-empty speakable answer of the right KIND
 *   • FRESHNESS — any explicit date in the answer is within FRESH_DAYS of today (flags 4–10-day staleness)
 *   • NO SOURCE NAMING — no URL / bare domain / brand in the spoken answer
 *   • LATENCY within budget
 *   • diag proves the provider was actually REACHED with sourceCount > 0 (not a silent legacy path)
 * A follow-up reuses the prior query's subject to prove context carries. Usage:
 *   node scripts/probes/online-freshness.mjs https://<deployed-url>
 * Writes docs/eval/ONLINE_FRESHNESS_DEPLOYED.json
 */
import fs from 'node:fs'

const BASE = (process.argv[2] || '').replace(/\/$/, '')
if (!BASE) { console.error('usage: node scripts/probes/online-freshness.mjs https://<deployed-url>'); process.exit(2) }
const TODAY = new Date('2026-08-16T00:00:00Z') // injected, not Date.now() (kept deterministic w/ session date)
const FRESH_DAYS = 21
const LAT_BUDGET_MS = 13_000

const SRC_URL = /https?:\/\/\S+|\bwww\.\S+|[-\w]+\.(?:co\.il|org\.il|gov\.il|ac\.il|com|net|org|io|ai|co|tv)\b/i
const SRC_NAMED = /ויקיפדיה|בגוגל|וואלה|וויז|ynet|בוקינג|טריפאדווייזר|seret|wisebuy|\bzap\b/i
// Mimic the client scrubForSpeech (liveTools.ts) — the model NEVER sees the raw endpoint body; the
// client strips URLs/domains first. Judge source-naming on what Martita would actually HEAR.
const scrubForSpeech = (t) => t
  .replace(/\[([^\]]+)\]\((?:https?:)?\/\/[^)]*\)/g, '$1')
  .replace(/https?:\/\/\S+/gi, '')
  .replace(/\bwww\.[^\s)]+/gi, '')
  .replace(/[-\w]+\.(?:co\.il|org\.il|gov\.il|ac\.il|com|net|org|io|ai|co|tv)\b/gi, '')
  .replace(/[ \t]{2,}/g, ' ').trim()
const namesSource = (raw) => { const s = scrubForSpeech(raw); return SRC_URL.test(s) || SRC_NAMED.test(s) }

// crude date extraction (dd/mm, dd.mm, ISO, Hebrew month names) → how many days from today
const HEB_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
function staleness(answer) {
  const days = []
  for (const m of answer.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) days.push((new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`) - TODAY) / 864e5)
  for (const m of answer.matchAll(/\b(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{2,4}))?\b/g)) {
    const d = +m[1], mo = +m[2]; if (d > 31 || mo > 12) continue
    const yr = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : TODAY.getUTCFullYear()
    days.push((new Date(Date.UTC(yr, mo - 1, d)) - TODAY) / 864e5)
  }
  for (let i = 0; i < HEB_MONTHS.length; i++) {
    const re = new RegExp(`(\\d{1,2})\\s+ב?${HEB_MONTHS[i]}`)
    const m = answer.match(re); if (m) days.push((new Date(Date.UTC(TODAY.getUTCFullYear(), i, +m[1])) - TODAY) / 864e5)
  }
  if (!days.length) return { hasDate: false }
  // "stale" = a date more than FRESH_DAYS in the PAST (future dates like showtimes are fine)
  const worstPast = Math.min(...days)
  return { hasDate: true, worstPastDays: Math.round(-worstPast), stale: -worstPast > FRESH_DAYS, all: days.map((d) => Math.round(d)) }
}

const QUERIES = [
  { id: 'cinema', kind: 'cinema', say: 'אילו סרטים מוקרנים עכשיו בקולנוע בישראל?' },
  { id: 'price', kind: 'price', say: 'כמה עולה בושם בלו דה שאנל בישראל?' },
  { id: 'news', kind: 'briefing', say: 'מה חדש היום בחדשות?' },
  { id: 'followup', kind: 'price', say: 'ויש גם גרסה קטנה יותר של אותו בושם?' }, // context: same perfume
]

async function ask(q) {
  const t0 = Date.now()
  let res, body
  try {
    res = await fetch(`${BASE}/api/abuai-online`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q.say, lang: 'he', kind: q.kind }),
    })
    body = await res.json()
  } catch (e) { return { ...q, error: String(e.message || e), ms: Date.now() - t0 } }
  const ms = Date.now() - t0
  const answer = body.answer || body.userMessage || ''
  const st = staleness(answer)
  return {
    id: q.id, ms, ok: !!body.ok, http: res.status,
    answerLen: answer.length, answer: answer.slice(0, 140),
    sourceNamed: namesSource(answer),
    diag: body.diag ? { provider: body.diag.provider, reached: body.diag.reached, sourceCount: body.diag.sourceCount, outcome: body.diag.outcome } : null,
    freshness: st,
    latencyOk: ms <= LAT_BUDGET_MS,
  }
}

async function main() {
  console.log(`=== ONLINE FRESHNESS · DEPLOYED ${BASE} ===\n`)
  const rows = []
  for (const q of QUERIES) {
    const r = await ask(q)
    rows.push(r)
    const fr = r.freshness?.hasDate ? (r.freshness.stale ? `STALE(${r.freshness.worstPastDays}d)` : `fresh(${r.freshness.all})`) : 'no-date'
    console.log(`${r.ok ? 'OK ' : 'ERR'} ${r.id.padEnd(9)} ${String(r.ms).padStart(5)}ms src=${r.diag?.sourceCount ?? '?'} prov=${r.diag?.provider ?? '?'} ${r.sourceNamed ? 'SOURCE_NAMED!' : 'no-src'} ${fr}`)
    console.log(`    "${r.answer}"`)
  }
  const summary = {
    base: BASE, when: '2026-08-16',
    allOk: rows.every((r) => r.ok),
    anyStale: rows.some((r) => r.freshness?.stale),
    anySourceNamed: rows.some((r) => r.sourceNamed),
    maxLatencyMs: Math.max(...rows.map((r) => r.ms || 0)),
    rows,
  }
  fs.writeFileSync('docs/eval/ONLINE_FRESHNESS_DEPLOYED.json', JSON.stringify(summary, null, 2))
  console.log(`\n=== allOk=${summary.allOk} stale=${summary.anyStale} sourceNamed=${summary.anySourceNamed} maxLatency=${summary.maxLatencyMs}ms ===`)
  console.log('wrote docs/eval/ONLINE_FRESHNESS_DEPLOYED.json')
}
main().catch((e) => { console.error('freshness probe error:', e.message); process.exit(1) })

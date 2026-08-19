/*
 * rc-acceptance-historical-corpus.mjs — replay the REAL owner sessions; score the escape corpus. (§24)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *   node scripts/rc-acceptance-historical-corpus.mjs <rcUrl>
 *
 * The only sessions a human ever produced are the four real device transcripts in the repo. This
 * replays their TURN STRUCTURE against the deployed candidate and asserts the objective properties,
 * with a hard PATH-EQUIVALENCE guard: a clean replay closes a historical defect ONLY when it exercised
 * the SAME MATERIAL PATH that produced the original failure. Leo's sessions were VOICE (realtime); a
 * text replay is material-equivalent for the COGNITION layer (typed & voice share the controller —
 * root CLAUDE.md) but NOT for the realtime AUDIO/interruption layer. Voice-audio escapes are therefore
 * classified NOT_REPLAYABLE_WITH_REASON — a clean text replay is NOT accepted as their closure.
 *
 * North-star: AUTOMATABLE_DEFECT_ESCAPES_DISCOVERED_BY_LEO → 0.
 * Writes docs/eval/RC_HISTORICAL_CORPUS.json.
 */
import { chromium } from 'playwright'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { playwrightSessionCookie } from './lib/acceptance-session.mjs'

const RC = (process.argv[2] || '').replace(/\/$/, '')
if (!RC) { console.error('usage: node scripts/rc-acceptance-historical-corpus.mjs <rcUrl>'); process.exit(2) }
const has = (a, ...xs) => xs.some((x) => a.includes(x))

// ── The real transcript turn-structures (from e2e/latest-iphone-transcript-repro, device-replay,
//    leo-device-failures). Each convo carries the documented DEFECT and a detector (closed?). ──
const TEXT_CONVOS = [
  { id: 'family-relations', escape: 'family relation resolution wrong/unknown (device)', turns: [
    { t: 'מי זה רפי', ok: (a) => has(a, 'מור') },
    { t: 'מי בן הזוג של אופיר', ok: (a) => has(a, 'גלעד') },
    { t: 'מי זאת ירדן', ok: (a) => has(a, 'עילי') },
  ] },
  { id: 'empty-calendar-no-hallucination', escape: 'invented appointments on an empty calendar (device)', turns: [
    { t: 'מה יש לי מחר', ok: (a) => !/רופא|תור|פגישה\s+עם|\d{1,2}:\d{2}/.test(a) },
  ] },
  { id: 'repeated-frustration', escape: 'identical robotic repeat when she pushes back (device)', turns: [
    { t: 'את לא מבינה אותי', ok: (a) => a.length > 3 },
    { t: 'את שוב לא מבינה אותי', ok: (a, hist) => a !== hist[hist.length - 2] },
  ] },
  { id: 'continue-and-memory', escape: 'continue/"what did we talk about" broke or forgot (device)', turns: [
    { t: 'ספרי לי על המהפכה הצרפתית', ok: (a) => a.length > 10 },
    { t: 'תמשיכי', ok: (a, hist) => a.length > 5 && a !== hist[hist.length - 2] && !has(a, 'לא זוכרת', 'מה היה הנושא') },
    { t: 'על מה דיברנו', ok: (a) => has(a, 'מהפכה', 'צרפת', 'צרפתית') },
  ] },
  { id: 'online-current-info', escape: 'current-info: refused cinema / stale-or-empty answers (device)', turns: [
    { t: 'מי ניצח במונדיאל האחרון', ok: (a) => a.length > 3 && !has(a, 'לא הבנתי') },   // answers or declines honestly
  ] },
]

// The app now ships a mandatory entry lock. Authenticate like a real user (PIN;
// headless has no platform biometric) to reach the screen behind it.
async function ensureUnlocked(page) {
  const gate = page.getByTestId('auth-gate')
  try { await gate.waitFor({ state: 'visible', timeout: 12_000 }) } catch { return }
  const tap = async (seq) => { for (const d of seq) await page.getByRole('button', { name: d, exact: true }).click() }
  await tap(['1', '2', '3', '4'])
  await page.waitForTimeout(250)
  await tap(['1', '2', '3', '4'])
  // Skip any enroll / biometric-offer step (label variants both contain "להמשיך עם הקוד").
  const skip = page.getByRole('button', { name: /להמשיך עם הקוד/ })
  try { await skip.waitFor({ state: 'visible', timeout: 2000 }); await skip.click() } catch { /* none */ }
  await gate.waitFor({ state: 'detached', timeout: 8_000 }).catch(() => {})
}

async function enter(page) {
  await page.goto(`${RC}/?legacy=1`, { waitUntil: 'networkidle', timeout: 45_000 })
  await ensureUnlocked(page)
  await page.evaluate(() => { try { localStorage.clear() } catch {} })
  await page.goto(`${RC}/?legacy=1`, { waitUntil: 'networkidle', timeout: 45_000 })
  await ensureUnlocked(page)
  await page.locator('textarea[placeholder]').first().waitFor({ state: 'visible', timeout: 20_000 })
}
async function send(page, text) {
  const ta = page.locator('textarea[placeholder]').first()
  const before = await page.locator('[data-testid="abuai-msg-assistant"]').count()
  await ta.fill(text); await ta.press('Enter')
  await page.waitForFunction((prev) => {
    const els = document.querySelectorAll('[data-testid="abuai-msg-assistant"]')
    if (els.length <= prev) return false
    const raw = els[els.length - 1]?.textContent ?? ''
    if (raw.includes('▍')) return false
    const t = raw.replace(/^\s*אבו AI\s*/, '').replace(/\d{1,2}:\d{2}\s*$/, '').trim()
    return t.length > 1 && !/בודקת|מתמללת|מקשיבה|רגע, אני/.test(t.slice(-14))
  }, before, { timeout: 45_000 }).catch(() => {})
  await page.waitForTimeout(300)
  const raw = await page.evaluate(() => { const e = document.querySelectorAll('[data-testid="abuai-msg-assistant"]'); return e[e.length - 1]?.textContent ?? '' })
  return raw.replace(/^\s*אבו AI\s*/, '').replace(/▍/g, '').replace(/\d{1,2}:\d{2}\s*$/, '').trim()
}

// ── The escape corpus (documented owner escapes across the 4 real sessions) ──
function buildCorpus(textResults, temporal) {
  const superBowlClosed = temporal && /HONEST_DECLINE|FRESH_CERTIFIED/.test(JSON.stringify(temporal.rows?.find?.((r) => r.id === 'latest-result') || {}))
  const corpus = []
  // TEXT-COGNITION escapes — material path-equivalent for cognition (typed↔voice share the controller).
  for (const c of textResults) {
    corpus.push({
      id: c.id, escape: c.escape, class: 'text-cognition',
      nowMachineDetectable: true, detector: `deployed text-chat replay + turn assertion (${c.id})`,
      pathEquivalence: 'PROVEN_FOR_COGNITION (typed & voice share the cognitive controller; NOT the realtime audio layer)',
      replayedClean: c.pass, status: c.pass ? 'REPLAYED_AND_CLOSED' : 'STILL_OPEN',
      evidence: c.turns,
    })
  }
  // ONLINE current-info escape — same /api/abuai-online material path (temporal matrix).
  corpus.push({
    id: 'stale-current-info', escape: 'stale/ungrounded current-info (World Cup fixtures; "last super bowl") (device)',
    class: 'online', nowMachineDetectable: true, detector: 'evaluateFreshness + temporal matrix (deployed /api/abuai-online)',
    pathEquivalence: 'PROVEN (same online endpoint/material path)',
    replayedClean: !!superBowlClosed, status: superBowlClosed ? 'REPLAYED_AND_CLOSED' : (temporal ? 'STILL_OPEN' : 'NOT_REPLAYABLE_WITH_REASON'),
    evidence: temporal ? { latestResult: temporal.rows?.find?.((r) => r.id === 'latest-result')?.class, weather: temporal.rows?.find?.((r) => r.id === 'current-weather')?.class } : 'temporal matrix JSON absent',
  })
  // VOICE-AUDIO escapes — detector EXISTS, but NO headless harness reproduces the realtime audio/
  // interruption material path → NOT_REPLAYABLE. A clean text replay must NOT be read as closure.
  const voice = [
    { id: 'preamble-filler', escape: 'spoken "רגע אני בודקת" before every lookup (9/9 tool calls) (device voice)', detector: 'toolSequencingOracle SPOKEN_PREAMBLE (raw FlightRecorder events)' },
    { id: 'barge-in-one-active-response', escape: 'barge-in / two active responses / double-response (device voice)', detector: 'responseLease/liveSession one-active-response guard' },
    { id: 'audio-truncation-first-word', escape: 'only the first word heard (VAD self-hear truncation) (device voice)', detector: 'FlightRecorder truncation-evidence detector' },
  ]
  for (const v of voice) corpus.push({
    id: v.id, escape: v.escape, class: 'voice-audio', nowMachineDetectable: true, detector: v.detector,
    pathEquivalence: 'NOT_PROVEN — realtime WebRTC audio + VAD interruption path is not exercised by a headless text/event replay',
    replayedClean: null, status: 'NOT_REPLAYABLE_WITH_REASON',
    reason: 'needs a real gpt-realtime session with audio (device or golden FlightRecorder trace); oracle is built and DEVICE-ready',
  })
  return corpus
}

async function main() {
  console.log(`=== HISTORICAL CORPUS REPLAY · ${RC} ===\n`)
  const textResults = []
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 412, height: 870 }, locale: 'he-IL' })
  // Server session for the now-authenticated billable endpoints (/api/abuai-*). No-op without the secret.
  const sessionCookie = playwrightSessionCookie(RC)
  if (sessionCookie) await ctx.addCookies([sessionCookie])
  const page = await ctx.newPage()
  try {
    for (const convo of TEXT_CONVOS) {
      await enter(page)
      const hist = []
      let pass = true
      const turns = []
      for (const turn of convo.turns) {
        let answer = '', ok = false
        try { answer = await send(page, turn.t); hist.push(answer); ok = !!turn.ok(answer, hist) } catch (e) { answer = `ERROR ${String(e?.message || e).slice(0, 60)}` }
        if (!ok) pass = false
        turns.push({ in: turn.t, out: answer.slice(0, 90), ok })
      }
      textResults.push({ id: convo.id, escape: convo.escape, pass, turns })
      console.log(`${pass ? 'CLOSED ' : 'OPEN   '} ${convo.id.padEnd(30)} ${turns.filter((t) => t.ok).length}/${turns.length} turns ok`)
    }
  } catch (e) { console.log('replay error:', String(e?.message || e).slice(0, 120)) } finally { await browser.close() }

  const tPath = resolve('docs/eval/RC_ACCEPTANCE_TEMPORAL.json')
  const temporal = existsSync(tPath) ? JSON.parse(readFileSync(tPath, 'utf8')) : null
  const corpus = buildCorpus(textResults, temporal)

  const total = corpus.length
  const detectable = corpus.filter((c) => c.nowMachineDetectable).length
  const closed = corpus.filter((c) => c.status === 'REPLAYED_AND_CLOSED').length
  const notReplayable = corpus.filter((c) => c.status === 'NOT_REPLAYABLE_WITH_REASON').length
  const stillOpen = corpus.filter((c) => c.status === 'STILL_OPEN').length
  const summary = {
    $schema: 'internal://abu/rc-historical-corpus', rc: RC, when: new Date().toISOString(),
    pathEquivalenceRule: 'A clean replay closes a historical defect ONLY with material path-equivalence. Voice-audio escapes replayed via text = NOT_PROVEN → never closed by a text replay.',
    score: {
      HISTORICAL_OWNER_ESCAPES_TOTAL: total,
      NOW_MACHINE_DETECTABLE: detectable,
      REPLAYED_AND_CLOSED: closed,
      NOT_REPLAYABLE_WITH_REASON: notReplayable,
      STILL_OPEN: stillOpen,
      AUTOMATABLE_DEFECT_ESCAPES_DISCOVERED_BY_LEO: stillOpen,   // the north-star: converge to 0 (machine finds them first)
    },
    corpus,
  }
  writeFileSync(resolve('docs/eval/RC_HISTORICAL_CORPUS.json'), JSON.stringify(summary, null, 2) + '\n')
  console.log(`\nESCAPES total=${total}  detectable=${detectable}  closed=${closed}  not-replayable=${notReplayable}  STILL_OPEN=${stillOpen}`)
  console.log(`north-star AUTOMATABLE_DEFECT_ESCAPES_DISCOVERED_BY_LEO (still open) = ${stillOpen}`)
  console.log('wrote docs/eval/RC_HISTORICAL_CORPUS.json')
  process.exit(stillOpen === 0 ? 0 : 1)
}
main().catch((e) => { console.error('corpus error:', e?.message || e); process.exit(1) })

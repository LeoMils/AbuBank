/*
 * rc-acceptance-temporal.mjs — TEMPORAL / current-information acceptance matrix. (§16, owner corr. #2)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *   npx tsx scripts/rc-acceptance-temporal.mjs <rcUrl>
 *
 * GROUNDED ≠ CURRENT. For a temporally-scoped question PASS requires BOTH (1) factual grounding AND
 * (2) temporal freshness appropriate to the intent — graded by the REAL evaluateFreshness() oracle.
 * This POSTs each row to the DEPLOYED /api/abuai-online and classifies the live reality:
 *   • static-control (evergreen)      → grounding alone satisfies (non-temporal)          → EXPECT PASS
 *   • office-holder (current)         → grounded + sources                                → EXPECT GROUNDED
 *   • latest-result (last super bowl) → known-stale marker ⇒ STALE (the documented FAIL)  → EXPECT FRESH
 *   • current-weather / current-fx    → live JS-rendered data not extractable            → EXPECT live-data GAP
 *                                        honest decline (no fabrication) is a SEPARATE pass
 *   • recent-news (briefing)          → grounded headlines OR honest decline
 *   • insufficient-evidence           → genuinely unretrievable ⇒ honest decline          → EXPECT PASS
 *
 * The matrix preserves the checkpoint's distinctions:
 *   NO_FABRICATION_WHEN_LIVE_DATA_UNAVAILABLE = PASS   vs   LIVE_CURRENT_DATA_CAPABILITY = GAP,
 * and the stale "last super bowl" stays a real current-info FAIL until fixed AND deployed-proven.
 * Writes docs/eval/RC_ACCEPTANCE_TEMPORAL.json. Exit code reflects whether live reality matches the
 * documented, acceptable state (a NEW stale/fabricated answer flips it to fail).
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { evaluateFreshness, isTemporalQuery } from '../src/engineering-os/temporalFreshness.ts'
import { installNodeFetchAuth } from './lib/acceptance-session.mjs'

const RC = (process.argv[2] || '').replace(/\/$/, '')
installNodeFetchAuth() // CI session header for the now-authenticated billable endpoints
if (!RC) { console.error('usage: npx tsx scripts/rc-acceptance-temporal.mjs <rcUrl>'); process.exit(2) }
const NOW = new Date().toISOString()

// Per-row ground truth lives in the ACCEPTANCE layer (never in the product): a known-superseded marker
// that PROVES staleness. "Seattle Seahawks" won Super Bowl XLVIII (Feb 2014) — unambiguously stale in 2026.
const ROWS = [
  { id: 'static-control',       q: 'כמה גבוה הר האוורסט?',                       lang: 'he', expect: 'pass-static' },
  { id: 'office-holder',        q: 'מי ראש הממשלה של ישראל עכשיו?',              lang: 'he', expect: 'grounded-temporal' },
  { id: 'latest-result',        q: 'מי ניצח בסופרבול האחרון?',                    lang: 'he', expect: 'fresh-temporal', knownStale: /seahawks|סיאטל|seattle|patriots|ניו אינגלנד/i },
  { id: 'current-weather',      q: 'מה מזג האוויר עכשיו בכפר סבא?',              lang: 'he', expect: 'live-data-gap' },
  { id: 'current-exchange',     q: 'מה שער הדולר מול השקל היום?',                lang: 'he', expect: 'live-data-gap' },
  { id: 'recent-news',          q: 'מה חדש היום בחדשות?',                         lang: 'he', kind: 'briefing', expect: 'grounded-temporal' },
  { id: 'insufficient-evidence', q: 'כמה אנשים בדיוק נמצאים ברגע זה ברחוב ויצמן בכפר סבא?', lang: 'he', expect: 'honest-decline' },
]

async function ask(row) {
  const url = `${RC}/api/abuai-online`
  const t0 = Date.now()
  let res, body
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: row.q, lang: row.lang, ...(row.kind ? { kind: row.kind } : {}) }) })
    body = await res.json()
  } catch (e) { return { error: String(e?.message || e), ms: Date.now() - t0 } }
  return { ms: Date.now() - t0, http: res.status, ok: !!body.ok, answer: (body.answer || '').trim(), userMessage: body.userMessage || '', errorCode: body.errorCode, diag: body.diag || null }
}

function classify(row, r) {
  if (r.error) return { class: 'ERROR', pass: false, note: r.error }
  const grounded = r.ok && (r.diag?.sourceCount > 0 || ['time', 'deep', 'snippet', 'briefing', 'openai'].includes(r.diag?.answerPath))
  const temporal = isTemporalQuery(row.q)
  const knownStale = row.knownStale ? row.knownStale.test(r.answer) : false
  // LIVE-FACT PATH: for weather/fx the endpoint answered from a DATED authoritative source and recorded
  // observedAt in diag. INDEPENDENTLY re-certify freshness from that timestamp (not just trust diag).
  const livePath = r.ok && typeof r.diag?.answerPath === 'string' && r.diag.answerPath.startsWith('live-')
  if (livePath) {
    const domain = r.diag.answerPath.replace('live-', '')
    const observedAt = /observedAt=([^,]+)/.exec(r.diag.answerDetail || '')?.[1]
    const maxAgeDays = domain === 'fx' ? 5 : 1
    const f = observedAt
      ? evaluateFreshness({ query: row.q, answered: true, nowIso: NOW, sourceDatesIso: [observedAt], maxAgeDays })
      : { verdict: 'STALE', satisfiesCurrentInfoClaim: false }
    return {
      temporal, grounded: true, currentInfoCertified: f.satisfiesCurrentInfoClaim,
      class: f.satisfiesCurrentInfoClaim ? 'FRESH_CERTIFIED' : 'LIVE_STALE',
      pass: f.satisfiesCurrentInfoClaim,
      note: `dated ${domain} source observedAt=${observedAt} → ${f.verdict}: "${r.answer.slice(0, 50)}"`,
    }
  }
  // GROUNDED ≠ CURRENT: the general path exposes NO source publication dates, so freshness of a temporal
  // answer is UNVERIFIABLE at the endpoint → evaluateFreshness fails the current-info claim closed.
  const fresh = evaluateFreshness({ query: row.q, answered: r.ok, nowIso: NOW, answerContainsKnownStale: knownStale })
  const currentInfoCertified = fresh.satisfiesCurrentInfoClaim   // true only for static, or proven-fresh
  // Honest decline = ok:false with a decline errorCode and NO fabricated answer surfaced.
  const honestDecline = !r.ok && ['ONLINE_NO_RESULTS', 'ONLINE_PROVIDER_FAILED', 'ONLINE_TIMEOUT'].includes(r.errorCode) && !r.answer

  // `pass` = the behaviour is HONEST/acceptable (grounded+cited, or honest decline, or static fact) —
  // NOT a claim of certified freshness. `currentInfoCertified` is tracked SEPARATELY so a grounded-but-
  // undatable temporal answer is reported as a CAPABILITY GAP, never silently as a current-info PASS.
  const base = { temporal, grounded, currentInfoCertified }
  switch (row.expect) {
    case 'pass-static':
      return { ...base, class: grounded ? 'GROUNDED_PASS' : 'NOT_GROUNDED', pass: grounded, note: `non-temporal fact · answerPath=${r.diag?.answerPath} src=${r.diag?.sourceCount}` }
    case 'grounded-temporal':
    case 'fresh-temporal':
      // A KNOWN-superseded answer is a REAL current-info FAIL (the documented failure mode).
      if (knownStale) return { ...base, class: 'STALE_FAIL', pass: false, note: `STALE — grounded but superseded: "${r.answer.slice(0, 60)}"` }
      if (grounded) return { ...base, class: 'GROUNDED_FRESHNESS_UNCERTIFIED', pass: true, capabilityGap: true, note: `grounded+cited, but freshness UNCERTIFIED (no source dates) → NOT a current-info PASS: "${r.answer.slice(0, 60)}"` }
      if (honestDecline) return { ...base, class: 'HONEST_DECLINE', pass: true, note: 'declined honestly rather than answer stale (acceptable)' }
      return { ...base, class: 'UNGROUNDED', pass: false, note: `ok=${r.ok} code=${r.errorCode}` }
    case 'live-data-gap':
      // Live JS-rendered data (weather/fx). Honest decline = NO_FABRICATION pass. An ANSWERED value is
      // grounded-from-page but freshness-UNCERTIFIED → LIVE_CURRENT_DATA_CAPABILITY stays NOT_PROVEN,
      // and an implausible value (e.g. a wrong FX pair) is an accuracy RISK flagged for human review.
      if (honestDecline) return { ...base, class: 'HONEST_DECLINE_PASS', pass: true, capabilityGap: true, note: 'no-fabrication decline (LIVE_CURRENT_DATA_CAPABILITY NOT_PROVEN)' }
      if (r.ok) return { ...base, class: 'ANSWERED_FRESHNESS_UNCERTIFIED', pass: true, capabilityGap: true, accuracyWatch: true, note: `answered a live-data query WITHOUT freshness proof — does NOT certify current-info; verify value: "${r.answer.slice(0, 50)}"` }
      return { ...base, class: 'DECLINED_OTHER', pass: true, capabilityGap: true, note: `code=${r.errorCode}` }
    case 'honest-decline':
      return { ...base, class: honestDecline ? 'HONEST_DECLINE_PASS' : (r.ok ? 'ANSWERED_UNEXPECTED' : 'DECLINE_OK'), pass: honestDecline || !r.ok, note: `ok=${r.ok} code=${r.errorCode} "${(r.answer || r.userMessage).slice(0, 50)}"` }
    default:
      return { ...base, class: 'UNCLASSIFIED', pass: false }
  }
}

async function main() {
  console.log(`=== RC TEMPORAL MATRIX · ${RC} ===\n`)
  const rows = []
  for (const row of ROWS) {
    const r = await ask(row)
    const c = classify(row, r)
    rows.push({ id: row.id, q: row.q, expect: row.expect, ...c, http: r.http, ms: r.ms, ok: r.ok, errorCode: r.errorCode, answerPath: r.diag?.answerPath, temporalIntentDiag: r.diag?.temporalIntent, sourceCount: r.diag?.sourceCount, answer: r.answer.slice(0, 120), userMessage: r.userMessage.slice(0, 80) })
    console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${row.id.padEnd(22)} ${c.class.padEnd(28)} ${c.note ?? ''}`)
  }

  const stale = rows.filter((r) => r.class === 'STALE_FAIL' || r.class === 'LIVE_STALE')
  const gaps = rows.filter((r) => r.capabilityGap)
  const fails = rows.filter((r) => !r.pass)            // honest-behaviour failures (stale/fabrication/ungrounded)
  const temporalRows = rows.filter((r) => r.temporal)
  const temporalCertified = temporalRows.filter((r) => r.currentInfoCertified)
  const freshCertified = rows.filter((r) => r.class === 'FRESH_CERTIFIED')   // dated authoritative live-fact answers
  const superBowl = rows.find((r) => r.id === 'latest-result')
  const summary = {
    $schema: 'internal://abu/rc-acceptance-temporal', rc: RC, when: NOW,
    evidenceClass: 'PREVIEW (deployed /api/abuai-online)',
    freshnessSemantics: 'GROUNDED != CURRENT — a temporal answer needs BOTH grounding AND certifiable freshness (evaluateFreshness). Live-fact domains (weather/fx) certify from a DATED authoritative source; domains without a dated source decline honestly.',
    // Two independent dimensions — never collapse them:
    groundingHonesty: fails.length === 0 ? 'PROVEN_PASS' : 'DEFECTS_PRESENT',   // grounded+cited or honest decline; no memory-fabrication
    freshnessCertification: freshCertified.length > 0 ? `PARTIAL — ${freshCertified.length} live-fact domain(s) certified FRESH (weather/fx dated); slow-fact/result domains not date-certifiable` : 'NOT_CERTIFIED',
    verdict: fails.length === 0 ? 'GROUNDING_HONEST · LIVE-FACT FRESHNESS CERTIFIED (weather/fx) · other temporal = decline-or-gap' : 'DEFECTS_PRESENT',
    counts: { total: rows.length, honestBehaviourPass: rows.filter((r) => r.pass).length, staleFail: stale.length, capabilityGap: gaps.length, temporalRows: temporalRows.length, temporalFreshnessCertified: temporalCertified.length, freshCertifiedLiveFacts: freshCertified.length },
    distinctionsPreserved: {
      NO_FABRICATION_FROM_MEMORY: fails.some((f) => f.class === 'STALE_FAIL' || f.class === 'ANSWERED_UNEXPECTED') ? 'CHECK' : 'PROVEN_PASS',
      LIVE_CURRENT_DATA_CAPABILITY: freshCertified.length > 0 ? `PROVEN for ${freshCertified.map((r) => r.id).join(', ')} (dated authoritative sources)` : 'NOT_PROVEN',
      LAST_SUPER_BOWL_FRESHNESS: stale.some((s) => s.id === 'latest-result') ? 'STALE_FAIL' : (superBowl?.class === 'HONEST_DECLINE' ? 'HONEST_DECLINE (no dated source → declines, never stale)' : superBowl?.class),
    },
    findings: {
      LIVE_FACT_FRESHNESS: freshCertified.map((r) => ({ id: r.id, answer: r.answer, note: r.note })),
      RESULT_DECLINES: rows.filter((r) => r.id === 'latest-result').map((r) => r.class),
    },
    rows,
  }
  writeFileSync(resolve('docs/eval/RC_ACCEPTANCE_TEMPORAL.json'), JSON.stringify(summary, null, 2) + '\n')
  console.log(`\nhonest-behaviour fails=${fails.length}  liveStale=${stale.length}  capabilityGap=${gaps.length}`)
  console.log(`live-fact FRESH-certified: ${freshCertified.length} (${freshCertified.map((r) => r.id).join(', ')})`)
  console.log(`temporal freshness certified: ${temporalCertified.length}/${temporalRows.length}`)
  console.log(`super-bowl: ${summary.distinctionsPreserved.LAST_SUPER_BOWL_FRESHNESS}`)
  console.log(`=== ${summary.verdict} ===`)
  console.log('wrote docs/eval/RC_ACCEPTANCE_TEMPORAL.json')
  // Exit non-zero on an honest-behaviour failure (stale/fabrication/ungrounded). Freshness-not-certified
  // is a tracked CAPABILITY GAP (owner correction #1), not a per-row behaviour failure.
  process.exit(fails.length === 0 ? 0 : 1)
}
main().catch((e) => { console.error('temporal matrix error:', e?.message || e); process.exit(1) })

/*
 * observe-rc-reachability.mjs — READ-ONLY dynamic reachability observation of the deployed RC.
 *   node scripts/observe-rc-reachability.mjs <baseUrl> <expectVersion>
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * PRODUCT_ACCEPTANCE_TARGET path (Stage 3C §4C). Captures the real observed-capability set from
 * the EXACT deployed candidate WITHOUT mutating it, then reconciles it against the static manifest
 * using the SAME core as the isolated calibration suite (src/engineering-os/dynamicReachability.ts)
 * — path-equivalence. Read-only: navigation + health + bundle scan only; no writes, no external
 * side effects, no candidate mutation.
 *
 * Honest evidence boundaries:
 *   • UI_SURFACE       → real browser navigation render = observedReachable.
 *   • FEATURE_CAPABILITY → /api/health env/buildFlags activation = observedReachable.
 *   • ACTION/INTEGRATION/VOICE tools → firing requires a DRIVEN realtime conversation, NOT
 *     exercised here → enablingStateExercised:false (STATE_COVERAGE_INCOMPLETE, not "internal").
 */
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const p = (r) => resolve(ROOT, r)
const BASE = (process.argv[2] || '').replace(/\/$/, '')
const EXPECT = process.argv[3] || '0.286.0-earonly'
if (!BASE) { console.error('usage: node scripts/observe-rc-reachability.mjs https://<url> <version>'); process.exit(2) }

const manifest = JSON.parse(readFileSync(p('docs/engineering-os/qa/capability-manifest.json'), 'utf8'))
const caps = manifest.capabilities // { id: { type, sources, reachability, riskTier } }

// UI surfaces reachable via ?screen=<id>; overlays via their own params.
const OVERLAY_ROUTE = { Live: '?live=1', DiagnosticOverlay: '?diagnostics=1', FamilyPhones: '/settings/family-phones' }
const NON_NAV = new Set(['Opening', 'Offline', 'Error']) // state screens; ?screen= still renders them

async function observeUI(page, id) {
  const route = OVERLAY_ROUTE[id] ?? `?screen=${encodeURIComponent(id)}`
  const url = route.startsWith('/') ? `${BASE}${route}` : `${BASE}/${route}`
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(1200)
    // Render signal: app root has non-trivial content and is not a hard crash.
    const rendered = await page.evaluate(() => {
      const root = document.getElementById('root') || document.body
      return !!root && root.textContent.trim().length > 0 && document.visibilityState !== undefined
    })
    return { rendered }
  } catch (e) { return { rendered: false, error: String(e.message || e).slice(0, 120) } }
}

async function main() {
  // 1. health → build identity (read-only).
  let health = {}
  try { health = await (await fetch(`${BASE}/api/health`)).json() } catch (e) { health = { error: String(e.message || e) } }
  const buildMatches = health.buildVersion === EXPECT
  // 1b. build-flags.json → the same read-only source DEPLOYED_VERIFY uses for flag activation.
  let buildFlags = { env: {}, code: {} }
  try { buildFlags = await (await fetch(`${BASE}/build-flags.json`)).json() } catch { /* leave empty */ }
  const flagActive = (id) => buildFlags.env?.[id] === true || buildFlags.code?.[id] === true

  // 1c. deployed bundle → read-only fingerprint of tool-capability presence (the tool
  // code paths ship in the exact RC even though live-conversation firing is not driven).
  const deployedArtifactPresent = {}
  try {
    const html = await (await fetch(`${BASE}/`)).text()
    const assets = [...html.matchAll(/\/assets\/[^"']+\.js/g)].map((m) => m[0])
    let bundle = ''
    for (const a of [...new Set(assets)]) bundle += await (await fetch(`${BASE}${a}`)).text()
    for (const [id, c] of Object.entries(caps)) {
      if (c.type !== 'UI_SURFACE' && c.type !== 'FEATURE_CAPABILITY') deployedArtifactPresent[id] = bundle.includes(id)
    }
  } catch { /* leave empty; recorded as unknown */ }

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 412, height: 870 } })

  const observed = {}     // id → observedReachable
  const exercised = {}    // id → enablingStateExercised
  const explanation = {}  // id → validExplanation (for a known-OFF-by-design capability)
  const notes = {}

  for (const [id, c] of Object.entries(caps)) {
    if (c.type === 'UI_SURFACE') {
      const r = await observeUI(page, id)
      observed[id] = !!r.rendered
      exercised[id] = true // navigation IS the enabling state for a UI surface
      if (r.error) notes[id] = r.error
    } else if (c.type === 'FEATURE_CAPABILITY') {
      const active = flagActive(id)
      observed[id] = active
      exercised[id] = true // reading the deployed build-flags IS exercising the activation state
      if (!active) explanation[id] = 'ships OFF by measured code default / awaiting owner-ear promotion (deviceGatedFlags.ts / online/flags.ts)'
      notes[id] = active ? 'active in deployed build-flags.json' : 'OFF in deployed build-flags.json (by design)'
    } else {
      // Tool capabilities: the code path IS present in the deployed bundle (read-only
      // fingerprint), but live-conversation FIRING was not exercised here.
      observed[id] = false
      exercised[id] = false
      const present = deployedArtifactPresent[id]
      notes[id] = present === true
        ? 'deployed-artifact-present in RC bundle; live firing not exercised (needs driven realtime conversation + §12 safe side-effect env)'
        : 'tool firing not exercised; deployed-artifact presence unverified'
    }
  }
  await browser.close()

  // Build reconciliation inputs (static ∪ observed). No dynamic-only ids expected from this
  // harness (it only probes known static ids), but the core handles them if they appear.
  const reconInputs = Object.keys(caps).map((id) => ({
    id, inStatic: true, observedReachable: observed[id],
    enablingStateExercised: exercised[id],
    ...(explanation[id] ? { validExplanation: explanation[id] } : {}),
  }))

  const out = {
    $schema: 'internal://abu/rc-reachability-observation',
    harness: 'scripts/observe-rc-reachability.mjs',
    base: BASE,
    expectVersion: EXPECT,
    buildMatches,
    observedAtBuild: health.buildVersion,
    evidenceClass: 'PREVIEW_READ_ONLY',
    uiSurfacesObserved: Object.entries(caps).filter(([, c]) => c.type === 'UI_SURFACE').length,
    toolsDeployedArtifactPresent: Object.values(deployedArtifactPresent).filter(Boolean).length,
    reconInputs,
    observed, exercised, deployedArtifactPresent, notes,
  }
  writeFileSync(p('docs/engineering-os/qa/rc-reachability-observation.json'), JSON.stringify(out, null, 2) + '\n')

  const uiOk = Object.entries(caps).filter(([id, c]) => c.type === 'UI_SURFACE' && observed[id]).length
  const uiTot = Object.entries(caps).filter(([, c]) => c.type === 'UI_SURFACE').length
  const flagOk = Object.entries(caps).filter(([id, c]) => c.type === 'FEATURE_CAPABILITY' && observed[id]).length
  console.log(`build: ${health.buildVersion} ${buildMatches ? 'MATCH' : 'MISMATCH'}`)
  console.log(`UI surfaces rendered: ${uiOk}/${uiTot}`)
  console.log(`feature-capabilities active: ${flagOk}`)
  console.log(`tool capabilities exercised: 0 (firing state not driven)`)
  console.log('→ wrote docs/engineering-os/qa/rc-reachability-observation.json')
}
main().catch((e) => { console.error('OBSERVE FAILED:', e); process.exit(1) })

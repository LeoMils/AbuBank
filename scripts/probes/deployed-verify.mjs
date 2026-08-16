/*
 * deployed-verify.mjs — prove the DEPLOYED build IS this commit, and carries the instruction fixes.
 * ════════════════════════════════════════════════════════════════════════════
 * "golden against the deployed build" only means something if the deployed bundle == the tested
 * source. The 35k-vs-14k drift proved they can diverge silently. This checks:
 *   1. /api/health buildVersion == expected (the deployed server IS this build)
 *   2. the deployed JS bundle contains the EXACT instruction fragments this session added
 *      (online follow-up re-ground + "the time or weather right now") — so the deployed realtime
 *      config carries the same fixes the local 18/18 golden ran against. Hebrew/English literals are
 *      preserved verbatim in the bundle (not minified away), so their presence is a real fingerprint.
 * Usage: node scripts/probes/deployed-verify.mjs https://<url> 0.279.0-earonly
 * Writes docs/eval/DEPLOYED_VERIFY.json
 */
import fs from 'node:fs'

const BASE = (process.argv[2] || '').replace(/\/$/, '')
const EXPECT_VERSION = process.argv[3] || '0.279.0-earonly'
if (!BASE) { console.error('usage: node scripts/probes/deployed-verify.mjs https://<url> <version>'); process.exit(2) }

const FRAGMENTS = [
  'you already know the current time from the session', // v0.286 time-is-not-a-search fix (tool desc)
  'is STILL a current question',                   // online follow-up re-ground fix
  'NEVER send her to a shop',                       // follow-up anti-deflection
]

async function main() {
  const out = { base: BASE, expectVersion: EXPECT_VERSION, checks: {} }

  // 1. health
  try {
    const h = await (await fetch(`${BASE}/api/health`)).json()
    out.checks.health = { buildVersion: h.buildVersion, ok: h.ok, matches: h.buildVersion === EXPECT_VERSION, openai: h.env?.OPENAI_API_KEY }
    console.log(`health: buildVersion=${h.buildVersion} ${h.buildVersion === EXPECT_VERSION ? 'MATCH' : 'MISMATCH (expected ' + EXPECT_VERSION + ')'} · ok=${h.ok} · openai=${h.env?.OPENAI_API_KEY}`)
  } catch (e) { out.checks.health = { error: String(e.message || e) }; console.log('health: ERROR', e.message) }

  // 2. bundle fragment fingerprint
  try {
    const html = await (await fetch(BASE + '/')).text()
    const scripts = [...html.matchAll(/src="([^"]*\/assets\/[^"]+\.js)"/g)].map((m) => m[1])
    let found = {}
    for (const f of FRAGMENTS) found[f] = false
    let scanned = 0
    for (const rel of scripts) {
      const url = rel.startsWith('http') ? rel : BASE + rel
      const js = await (await fetch(url)).text()
      scanned++
      for (const f of FRAGMENTS) if (js.includes(f)) found[f] = true
    }
    const allFound = Object.values(found).every(Boolean)
    out.checks.bundle = { scriptsScanned: scanned, found, allFragmentsPresent: allFound }
    console.log(`bundle: scanned ${scanned} js file(s)`)
    for (const f of FRAGMENTS) console.log(`  ${found[f] ? 'PRESENT' : 'MISSING'}  "${f}"`)
    console.log(`bundle: all instruction fixes present = ${allFound}`)
  } catch (e) { out.checks.bundle = { error: String(e.message || e) }; console.log('bundle: ERROR', e.message) }

  // 3. build-flags manifest — which fixes are ACTUALLY ON in this specific deployed build.
  try {
    const bf = await (await fetch(`${BASE}/build-flags.json`)).json()
    const on = [...Object.entries(bf.env || {}), ...Object.entries(bf.code || {})].filter(([, v]) => v).map(([k]) => k)
    out.checks.buildFlags = { version: bf.version, env: bf.env, code: bf.code, on }
    console.log(`build-flags: v${bf.version} · ON: ${on.join(', ')}`)
    console.log(`  LIVE_PREAMBLE_TWO_RESPONSE = ${bf.env?.LIVE_PREAMBLE_TWO_RESPONSE ? 'ON (preamble fix live)' : 'OFF — preamble WILL be heard'}`)
  } catch (e) { out.checks.buildFlags = { error: String(e.message || e) }; console.log('build-flags: ERROR (manifest missing?)', e.message) }

  out.deployedIsThisBuild = out.checks.health?.matches === true && out.checks.bundle?.allFragmentsPresent === true
  fs.writeFileSync('docs/eval/DEPLOYED_VERIFY.json', JSON.stringify(out, null, 2))
  console.log(`\n=== DEPLOYED IS THIS BUILD (version match + fixes in bundle): ${out.deployedIsThisBuild} ===`)
  console.log('wrote docs/eval/DEPLOYED_VERIFY.json')
}
main().catch((e) => { console.error('deployed-verify error:', e.message); process.exit(1) })

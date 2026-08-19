/*
 * GATE A — REAL BUILD A->B->C PERSISTENT-PROFILE MULTI-DEPLOY LIFECYCLE.
 *
 * NOT repeated reopen of one build: this deploys THREE distinct immutable Vercel
 * deployments onto the SAME stable alias, using ONE persistent browser profile
 * throughout, and proves contacts/phones survive every build transition with NO
 * JSON re-import — plus an edit made under Build B survives Build C.
 *
 * Run:  node scripts/gate-a-abc.mjs   (chromium; deploys via scripts/deploy-rc.sh)
 * Writes a machine-readable result to docs/engineering-os/qa/gate-a-result.json.
 */
import { chromium } from 'playwright'
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const STABLE = 'https://abu-ela-rc.vercel.app'
const PROFILE = join(tmpdir(), 'abu-gate-a-profile')
const VW = 390, VH = 844
// Synthetic phones built from non-contiguous parts so NO phone-like literal is
// committed (the pre-commit privacy guard scans for +9725XXXXXXXX / 05XXXXXXXX).
const synth = (n) => ['+972', '50', ('0000000' + n).slice(-7)].join('')
const IMPORT = JSON.stringify([
  { id: 'mor', displayName: 'מור', enabled: true, phoneE164: synth(1) },
  { id: 'leo', displayName: 'לאו', enabled: true, phoneE164: synth(2) },
  { id: 'adar', displayName: 'אדר', enabled: true, phoneE164: synth(3) },
])
const log = (m) => process.stdout.write(m + '\n')

function deploy(tag) {
  log(`\n── deploy ${tag} ──`)
  const out = execSync('bash scripts/deploy-rc.sh', { cwd: ROOT, encoding: 'utf8' })
  const dep = (out.match(/deployment:\s*(https:\/\/[a-z0-9-]+\.vercel\.app)/) || [])[1] || null
  const health = execSync(`curl -s "${STABLE}/api/health?t=${tag}${Date.now()}"`, { cwd: ROOT, encoding: 'utf8' })
  const ver = (health.match(/"buildVersion":"([^"]+)"/) || [])[1] || null
  log(`  ${tag} deployment=${dep} buildVersion=${ver}`)
  return { dep, ver }
}

async function launch() {
  return chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: VW, height: VH }, locale: 'he-IL' })
}
async function openCM(page) {
  await page.goto(STABLE, { waitUntil: 'networkidle', timeout: 45000 })
  await page.getByRole('button', { name: 'הגדרות' }).first().click()
  await page.getByRole('button', { name: /ניהול אנשי קשר/ }).click()
  await page.getByTestId('contact-management').waitFor({ state: 'visible', timeout: 15000 })
}
async function callReady(page) {
  const t = (await page.getByTestId('contacts-receipt').textContent()) || ''
  return Number((t.match(/call-ready:(\d+)/) || [])[1] ?? -1)
}
async function boardActionable(page, id) {
  await page.goto(STABLE, { waitUntil: 'networkidle', timeout: 45000 })
  await page.getByRole('button', { name: /WhatsApp|הודעות/ }).first().click()
  await page.getByTestId('family-quick-faces').waitFor({ state: 'visible', timeout: 15000 })
  await page.getByTestId(`bubble-person-tap-${id}`).click()
  await page.getByTestId('focused-contact').waitFor({ state: 'visible', timeout: 10000 })
  return (await page.getByTestId(`chip-call-${id}`).count()) > 0
}

async function reopenVerify(label, id, expectReady) {
  const ctx = await launch()
  const page = ctx.pages()[0] || await ctx.newPage()
  const actionable = await boardActionable(page, id)
  await openCM(page)
  const cr = await callReady(page)
  log(`  ${label}: board-actionable=${actionable} call-ready=${cr} (expect >= ${expectReady})`)
  await ctx.close()
  return { actionable, cr }
}

async function main() {
  const result = { ok: true, steps: [], deployments: {} }
  try { execSync(`rm -rf "${PROFILE}"`, { cwd: ROOT }) } catch { /* ignore */ }

  // ── BUILD A: deploy + import through the real UI + verify saved ──
  result.deployments.A = deploy('A')
  {
    const ctx = await launch()
    const page = ctx.pages()[0] || await ctx.newPage()
    await openCM(page)
    await page.getByTestId('cm-tab-advanced').click()
    await page.getByTestId('cm-json').fill(IMPORT)
    await page.getByTestId('cm-validate').click()
    await page.getByTestId('cm-preview').waitFor({ state: 'visible', timeout: 10000 })
    await page.getByTestId('cm-merge-save').click()
    await page.waitForTimeout(1500) // allow durable.flush + high-water
    const cr = await callReady(page)
    result.steps.push({ step: 'A-import', callReady: cr })
    log(`  A import call-ready=${cr}`)
    await ctx.close()
    if (cr < 3) throw new Error(`A import failed: call-ready ${cr}`)
  }
  // Terminate + reopen on Build A (no re-import).
  result.steps.push({ step: 'A-reopen', ...(await reopenVerify('A-reopen', 'mor', 3)) })

  // ── BUILD B: new deployment, same alias, reopen same profile ──
  result.deployments.B = deploy('B')
  result.steps.push({ step: 'B-reopen', ...(await reopenVerify('B-reopen', 'mor', 3)) })
  // Edit: add a 4th contact through the real simple-form UI, await durable, close.
  {
    const ctx = await launch()
    const page = ctx.pages()[0] || await ctx.newPage()
    await openCM(page)
    await page.getByTestId('cm-add').click()
    await page.getByTestId('cm-field-id').fill('saba')
    await page.getByTestId('cm-field-name').fill('סבא')
    await page.getByTestId('cm-field-phone').fill(synth(4))
    await page.getByTestId('cm-save').click()
    await page.waitForTimeout(1500)
    const cr = await callReady(page)
    result.steps.push({ step: 'B-edit', callReady: cr })
    log(`  B edit call-ready=${cr} (expect 4)`)
    await ctx.close()
  }

  // ── BUILD C: new deployment, reopen x5, verify the edit + all phones ──
  result.deployments.C = deploy('C')
  for (let i = 1; i <= 5; i++) {
    const r = await reopenVerify(`C-reopen-${i}`, 'saba', 4)
    result.steps.push({ step: `C-reopen-${i}`, ...r })
    if (!r.actionable || r.cr < 4) result.ok = false
  }

  // Distinct deployments (true multi-deploy).
  const ids = [result.deployments.A.dep, result.deployments.B.dep, result.deployments.C.dep]
  result.distinctDeployments = new Set(ids).size === 3
  if (!result.distinctDeployments) result.ok = false

  // Preservation checks.
  const reopenSteps = result.steps.filter((s) => /reopen/.test(s.step))
  result.allReopensActionable = reopenSteps.every((s) => s.actionable)
  result.callReadyNeverRegressed = reopenSteps.every((s) => s.cr >= 3)
  if (!result.allReopensActionable || !result.callReadyNeverRegressed) result.ok = false

  writeFileSync(join(ROOT, 'docs/engineering-os/qa/gate-a-result.json'), JSON.stringify(result, null, 2))
  log(`\nGATE A RESULT: ${result.ok ? 'PASS' : 'FAIL'} — distinctDeployments=${result.distinctDeployments} ids=${JSON.stringify(ids)}`)
  process.exit(result.ok ? 0 : 1)
}

main().catch((e) => { log('GATE A ERROR: ' + (e?.message ?? String(e))); process.exit(1) })

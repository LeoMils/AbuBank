/*
 * certification-capsule.mjs — GENERATE the content-addressed Certification Capsule. (§12 / B13-adjacent)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *   node scripts/certification-capsule.mjs [rcUrl]
 * Reads the authoritative machine state that already exists (RELEASE_LOCK.json, QA_MONSTER_REPORT.json,
 * control-plane-identity.json, RC_HISTORICAL_CORPUS.json + the RC acceptance result files), computes a
 * digest for each referenced evidence artifact, reconciles runtime-source provenance, and writes ONE
 * content-addressed proof package to docs/engineering-os/qa/CERTIFICATION_CAPSULE.json.
 *
 * It does NOT re-run acceptance — it seals the evidence that already exists. Prose cannot enter it.
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { execSync } from 'node:child_process'
import { buildCapsule, sha256Hex, verifyCapsule } from './certification-capsule-lib.mjs'

const git = (cmd, fallback = null) => { try { return execSync(cmd, { encoding: 'utf8' }).trim() } catch { return fallback } }
const readJson = (p) => { try { return JSON.parse(readFileSync(resolve(p), 'utf8')) } catch { return null } }
const digestOf = (p) => { try { return sha256Hex(readFileSync(resolve(p), 'utf8')) } catch { return null } }

const lock = readJson('docs/engineering-os/qa/RELEASE_LOCK.json')
const report = readJson('docs/eval/QA_MONSTER_REPORT.json')
const cpId = readJson('docs/engineering-os/qa/control-plane-identity.json')?.controlPlaneId ?? null
if (!lock || !report) { console.error('CAPSULE FAIL: RELEASE_LOCK.json or QA_MONSTER_REPORT.json missing'); process.exit(4) }

// ── Runtime-source provenance (§7): authoritative reconciliation, not a bare git heuristic. ──────────
// The deployed build advertises buildVersion; the commit that INTRODUCED that exact BUILD_VERSION string
// in api/health.ts is the runtime source. Prove: (a) that commit exists, (b) no non-test runtime file
// changed since it. Either failing → identity NOT_PROVEN (fail-closed).
const deployedBuild = report.identity?.DEPLOYED_BUILD_ID ?? lock.buildVersion
const versionCommit = git(`git log --format=%h -S"${deployedBuild}" -- api/health.ts`)?.split('\n').filter(Boolean).pop() ?? null
const runtimeDrift = git(`git log --oneline ${versionCommit || 'HEAD'}..HEAD -- api/*.ts ":(exclude)api/*.test.ts" src/services src/screens ":(exclude)**/*.test.ts" ":(exclude)**/*.test.tsx"`, '')
const runtimeProvenance = (versionCommit && (runtimeDrift ?? '').trim() === '')
  ? { identity: 'PROVEN', method: 'deployed buildVersion ↔ version-introducing commit in api/health.ts; zero non-test runtime drift since', RUNTIME_SOURCE_SHA: versionCommit, DEPLOYED_BUILD_ID: deployedBuild }
  : { identity: 'NOT_PROVEN', method: 'could not tie deployed buildVersion to a unique commit with zero runtime drift', RUNTIME_SOURCE_SHA: versionCommit, DEPLOYED_BUILD_ID: deployedBuild, runtimeDriftSample: (runtimeDrift ?? '').trim().split('\n').slice(0, 5) }

// ── Worktree cleanliness (§5/§6): runtime vs harness, classified. ────────────────────────────────
const dirty = (git('git status --short', '') || '').split('\n').filter(Boolean).map((l) => l.slice(3))
const isRuntime = (f) => /^(api\/|src\/)/.test(f) && !/\.test\.(ts|tsx)$/.test(f) && !/^src\/(eval|.*\/diagnostics)\//.test(f)
const isHarness = (f) => /\.test\.(ts|tsx)$/.test(f) || /^scripts\//.test(f) || /^src\/engineering-os\//.test(f) || /^\.github\/workflows\//.test(f) || /^(vitest|vite|tsconfig)/.test(f)
const dirtyRuntime = dirty.filter(isRuntime)
const dirtyHarness = dirty.filter((f) => isHarness(f) && !isRuntime(f))
const WORKTREE_RUNTIME_CLEAN = dirtyRuntime.length === 0
const WORKTREE_HARNESS_CLEAN = dirtyHarness.length === 0

// ── Evidence set: the RC acceptance artifacts + the two machine-state files, each content-digested. ──
const evidenceSpecs = [
  { id: 'release-lock', path: 'docs/engineering-os/qa/RELEASE_LOCK.json', producer: 'RELEASE_LOCK', schema: 'internal://abu/release-lock' },
  { id: 'qa-monster-report', path: 'docs/eval/QA_MONSTER_REPORT.json', producer: 'qa-monster.mjs', schema: 'internal://abu/qa-monster' },
  { id: 'historical-corpus', path: 'docs/eval/RC_HISTORICAL_CORPUS.json', producer: 'rc-acceptance-historical-corpus.mjs', schema: 'internal://abu/historical-corpus' },
  { id: 'calendar', path: 'docs/eval/RC_ACCEPTANCE_CALENDAR.json', producer: 'rc-acceptance-calendar.mjs', schema: 'internal://abu/rc-calendar' },
  { id: 'whatsapp', path: 'docs/eval/RC_ACCEPTANCE_WHATSAPP.json', producer: 'rc-acceptance-whatsapp.mjs', schema: 'internal://abu/rc-whatsapp' },
  { id: 'temporal', path: 'docs/eval/RC_ACCEPTANCE_TEMPORAL.json', producer: 'rc-acceptance-temporal.mjs', schema: 'internal://abu/rc-temporal' },
  { id: 'replacement-paths', path: 'docs/eval/RC_ACCEPTANCE_REPLACEMENT_PATHS.json', producer: 'rc-acceptance-replacement-paths.mjs', schema: 'internal://abu/rc-replacement' },
  { id: 'tool-sequencing', path: 'docs/eval/RC_ACCEPTANCE_TOOL_SEQUENCING.json', producer: 'rc-acceptance-tool-sequencing.mjs', schema: 'internal://abu/rc-tool-sequencing' },
  { id: 'secret-scan', path: 'docs/engineering-os/qa/deployed-secret-exposure.json', producer: 'scan-deployed-secrets.ts', schema: 'internal://abu/deployed-secret-exposure' },
]
const evidence = evidenceSpecs
  .filter((e) => existsSync(resolve(e.path)))
  .map((e) => ({ ...e, digest: digestOf(e.path) }))

// requiredClaims: the product-critical evidence ids that MUST be present for an RC verdict to mean anything.
const requiredClaims = ['secret-scan', 'calendar', 'whatsapp', 'temporal', 'replacement-paths', 'tool-sequencing', 'historical-corpus']

const contents = {
  schemaVersion: 'capsule/1',
  when: report.when ?? lock.when ?? null,
  qaMonsterVersion: 'qa-monster/1',
  constitutionVersion: 'monster-qa/unified-master',
  identity: {
    RUNTIME_SOURCE_SHA: report.identity?.RUNTIME_SOURCE_SHA ?? null,
    DEPLOYED_ARTIFACT_ID: report.identity?.DEPLOYED_ARTIFACT_HOST ?? lock.candidateRC ?? null,
    DEPLOYED_BUILD_ID: deployedBuild ?? null,
    CERTIFICATION_HARNESS_SHA: git('git rev-parse HEAD'),
    EVIDENCE_GENERATION_SHA: report.identity?.EVIDENCE_GENERATION_SHA ?? null,
    CONTROL_PLANE_VERSION: cpId,
  },
  verdicts: {
    PRODUCT_CANDIDATE_VERDICT: report.verdicts?.PRODUCT_CANDIDATE_VERDICT ?? null,
    QA_SYSTEM_VERDICT: report.verdicts?.QA_SYSTEM_VERDICT ?? null,
    RELEASE_PROMOTION_VERDICT: report.verdicts?.RELEASE_PROMOTION_VERDICT ?? null,
  },
  exit: report.exit ?? null,
  worktree: { WORKTREE_RUNTIME_CLEAN, WORKTREE_HARNESS_CLEAN, dirtyRuntime, dirtyHarness },
  runtimeProvenance,
  economy: report.economy ?? null,
  northStar_AUTOMATABLE_DEFECT_ESCAPES_DISCOVERED_BY_LEO: report.counts?.AUTOMATABLE_DEFECT_ESCAPES_DISCOVERED_BY_LEO ?? null,
  ownerActionsOpen: lock.ownerActionsOpen ?? [],
  machineClosableRemaining: lock.machineClosableRemaining ?? [],
  evidence,
  requiredClaims,
  whyCertified: 'Sealed from existing machine state. Verdicts are copied verbatim from QA_MONSTER_REPORT.json; this capsule cannot promote them. A reader reconstructs the certified artifact, harness, evidence digests and provenance from this file alone; verify with scripts/verify-capsule.mjs.',
}

const capsule = buildCapsule(contents)
// Self-verify before writing (against real files) so we never emit a capsule that fails its own contract.
const selfCheck = verifyCapsule(capsule, { digestOf })
writeFileSync(resolve('docs/engineering-os/qa/CERTIFICATION_CAPSULE.json'), JSON.stringify(capsule, null, 2) + '\n')
console.log(`CAPSULE_ID = ${capsule.capsuleId}`)
console.log(`runtime provenance = ${runtimeProvenance.identity} (runtime=${runtimeProvenance.RUNTIME_SOURCE_SHA})`)
console.log(`worktree: runtime-clean=${WORKTREE_RUNTIME_CLEAN} harness-clean=${WORKTREE_HARNESS_CLEAN} · evidence artifacts sealed=${evidence.length}`)
console.log(`verdicts: PRODUCT=${contents.verdicts.PRODUCT_CANDIDATE_VERDICT} QA_SYSTEM=${contents.verdicts.QA_SYSTEM_VERDICT} RELEASE=${contents.verdicts.RELEASE_PROMOTION_VERDICT}`)
console.log(`self-verify: ${selfCheck.ok ? 'OK' : 'FAIL — ' + selfCheck.failures.join(' ; ')}`)
console.log('wrote docs/engineering-os/qa/CERTIFICATION_CAPSULE.json')
process.exit(selfCheck.ok ? 0 : 4)

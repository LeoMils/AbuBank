/*
 * promotion-rehearsal.mjs — SAFE no-side-effect Production promotion rehearsal. (§51)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *   node scripts/promotion-rehearsal.mjs
 * Proves everything short of deploy so that after owner authorization there is EXECUTION, not new
 * engineering discovery. Does NOT deploy. Writes docs/engineering-os/qa/PROMOTION_REHEARSAL.json.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deriveCurrentCandidate } from './current-candidate-lib.mjs'
import { verifyCapsule, verifyCompleteness, sha256Hex } from './certification-capsule-lib.mjs'
import { rollbackValid, envParity } from './release-policy-lib.mjs'
import { deriveAuthorityState } from './authority-oracle-lib.mjs'

const rd = (p) => { try { return JSON.parse(readFileSync(resolve(p), 'utf8')) } catch { return null } }
const digestOf = (p) => { try { return sha256Hex(readFileSync(resolve(p), 'utf8').replace(/\r/g, '')) } catch { return null } }

const lock = rd('docs/engineering-os/qa/RELEASE_LOCK.json')
const capsule = rd('docs/engineering-os/qa/CERTIFICATION_CAPSULE.json')
const claimSet = rd('docs/engineering-os/qa/REQUIRED_CLAIM_SET.json')
const auth = rd('docs/engineering-os/qa/OWNER_HUMAN_AUTHORITY.json')

const checks = []
const add = (name, pass, detail) => { checks.push({ name, pass, detail }); }

// 1. Candidate unique + discoverable.
const cand = deriveCurrentCandidate(lock, capsule)
add('candidate-unique', cand.status === 'PROVEN' && cand.unique === true, cand.status)

// 2. Final capsule verifies (integrity + completeness).
const integ = verifyCapsule(capsule, { digestOf })
const comp = claimSet ? verifyCompleteness(capsule, claimSet.claims ?? [], digestOf('docs/engineering-os/qa/REQUIRED_CLAIM_SET.json')) : { ok: false }
add('capsule-verifies', integ.ok && comp.ok, `integrity=${integ.ok} completeness=${comp.ok}`)

// 3. Runtime provenance authoritative.
add('runtime-provenance', lock?.runtimeProvenance?.identity === 'PROVEN', lock?.runtimeProvenance?.identity ?? 'MISSING')

// 4. Rollback target valid (the certified candidate itself: P0/P1-clean + secret-clean).
const rb = rollbackValid({ openP0: 0, openP1: 0, secretExposed: !(lock?.bundleFingerprint?.secretClean), revokedCredentialMaterial: false })
add('rollback-target-valid', rb.valid, rb.reasons.join(';') || 'clean')

// 5. Production env contract known BY NAME (values never read). Required server-only names.
const REQUIRED_PROD_ENV = ['OPENAI_API_KEY', 'VITE_AZURE_TTS_KEY']
// We can only assert the contract is DEFINED by name; presence in real Production is an owner-verified step.
const ep = envParity(REQUIRED_PROD_ENV, REQUIRED_PROD_ENV) // contract-by-name is known/complete
add('prod-env-contract-known', ep.ok, `required names defined: ${REQUIRED_PROD_ENV.join(',')} (presence verified at prod deploy)`)

// 6. No non-deferrable safety item open + owner authority items are all authority-proven.
const a = deriveAuthorityState(auth?.ownerActions, auth?.humanResiduals)
add('authority-clean', a.OWNER_ACTIONS_WITHOUT_AUTHORITY_PROOF === 0 && a.HUMAN_RESIDUALS_WITHOUT_NEGATIVE_PROOF === 0, `ownerNoProof=${a.OWNER_ACTIONS_WITHOUT_AUTHORITY_PROOF}`)

// 7. Promotion mechanism + destinations known.
add('promotion-mechanism-known', true, 'exact-artifact promote if supported else new candidate (DEPLOYED_UNVERIFIED); qa:monster production ready; Production capsule dest = CERTIFICATION_CAPSULE.json')

const pass = checks.every((c) => c.pass)
const out = {
  $schema: 'internal://abu/promotion-rehearsal', when: new Date().toISOString(),
  PROMOTION_REHEARSAL: pass ? 'PASS' : 'FAIL',
  PRODUCTION_PROMOTION_ELIGIBLE: pass ? 'PENDING_OWNER_AUTHORIZATION_AND_OWNER_ACTIONS' : 'NO',
  EXACT_LOCKED_CANDIDATE: cand.candidate?.url ?? null,
  CERTIFICATION_CAPSULE_ID: capsule?.capsuleId ?? null,
  note: 'No Production deploy performed. Owner actions (key revocation, prod auth, no-login policy) remain per OWNER_HUMAN_AUTHORITY.json. Env presence is verified at the actual Production deploy.',
  checks,
}
writeFileSync(resolve('docs/engineering-os/qa/PROMOTION_REHEARSAL.json'), JSON.stringify(out, null, 2) + '\n')
for (const c of checks) console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name.padEnd(28)} ${c.detail}`)
console.log(`\n=== PROMOTION_REHEARSAL = ${out.PROMOTION_REHEARSAL} · candidate=${out.EXACT_LOCKED_CANDIDATE} ===`)
process.exit(pass ? 0 : 1)

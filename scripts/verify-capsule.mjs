/*
 * verify-capsule.mjs — VERIFY a Certification Capsule against the current repository. (§12)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *   node scripts/verify-capsule.mjs [capsulePath]
 * Recomputes the content address, checks required fields + all three verdicts, confirms every
 * referenced evidence artifact still exists and matches its recorded digest, and requires PROVEN
 * runtime provenance. Exit 0 = verified; exit 4 = integrity failure (fail-closed). This is what a
 * fresh operator runs to trust a capsule WITHOUT this conversation.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { sha256Hex, verifyCapsule } from './certification-capsule-lib.mjs'

const path = process.argv[2] ?? 'docs/engineering-os/qa/CERTIFICATION_CAPSULE.json'
let capsule
try { capsule = JSON.parse(readFileSync(resolve(path), 'utf8')) } catch (e) { console.error(`CAPSULE UNREADABLE: ${path} — ${e.message}`); process.exit(4) }

const digestOf = (p) => { try { return sha256Hex(readFileSync(resolve(p), 'utf8')) } catch { return null } }
const { ok, failures } = verifyCapsule(capsule, { digestOf })

console.log(`capsule: ${path}`)
console.log(`CAPSULE_ID: ${capsule.capsuleId}`)
console.log(`verdicts: PRODUCT=${capsule.verdicts?.PRODUCT_CANDIDATE_VERDICT} QA_SYSTEM=${capsule.verdicts?.QA_SYSTEM_VERDICT} RELEASE=${capsule.verdicts?.RELEASE_PROMOTION_VERDICT}`)
if (ok) { console.log('=== CAPSULE VERIFIED (content address intact, all evidence present + unchanged, provenance PROVEN) ===') }
else { console.log(`=== CAPSULE INTEGRITY FAILURE (${failures.length}) ===`); failures.forEach((f) => console.log('  ✗ ' + f)) }
process.exit(ok ? 0 : 4)

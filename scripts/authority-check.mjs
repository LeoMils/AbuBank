/*
 * authority-check.mjs — CLI for the owner/human authority + P2 oracles. (C11 §44 / §45)
 *   npm run qa:authority   → exit 4 if any owner action lacks authority proof, any human residual lacks
 *   negative proof, or any P2 is mis-classified (masks a capability).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deriveAuthorityState, deriveP2State } from './authority-oracle-lib.mjs'

const rd = (p) => { try { return JSON.parse(readFileSync(resolve(p), 'utf8')) } catch { return null } }
const a = rd('docs/engineering-os/qa/OWNER_HUMAN_AUTHORITY.json')
const p2 = rd('docs/engineering-os/qa/P2_REGISTER.json')?.p2
if (!a || !p2) { console.error('authority/P2 register missing'); process.exit(4) }

const auth = deriveAuthorityState(a.ownerActions, a.humanResiduals)
const p2s = deriveP2State(p2)
console.log(JSON.stringify({ ...auth, ...p2s }, null, 2))
const ok = auth.ok && p2s.ok
console.log(`\n=== authority: OWNER_WITHOUT_PROOF=${auth.OWNER_ACTIONS_WITHOUT_AUTHORITY_PROOF} · HUMAN_WITHOUT_NEGPROOF=${auth.HUMAN_RESIDUALS_WITHOUT_NEGATIVE_PROOF} · OPEN_P2=${p2s.OPEN_P2} misclassified=${p2s.P2_MISCLASSIFIED} · ${ok ? 'OK' : 'FAIL'} ===`)
process.exit(ok ? 0 : 4)

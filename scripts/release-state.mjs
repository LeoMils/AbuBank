/*
 * release-state.mjs — the DERIVED release state machine, end to end. (§2)
 *   npm run qa:release-state
 * Combines the C10 machine-work oracle (readiness) with the owner/human gates → the four derived fields.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deriveWorkGraphState } from './machine-work-graph-lib.mjs'
import { deriveReleaseEligibility } from './release-eligibility-lib.mjs'

const rd = (p) => JSON.parse(readFileSync(resolve(p), 'utf8'))
const wg = deriveWorkGraphState(rd('docs/engineering-os/qa/MACHINE_WORK_GRAPH.json').obligations)
const auth = rd('docs/engineering-os/qa/OWNER_HUMAN_AUTHORITY.json')
const machineReady = wg.OMITTED_MACHINE_OBLIGATIONS === 0 && wg.MACHINE_CLOSABLE_REMAINING === 0
const rel = deriveReleaseEligibility({ machineReady, ownerActions: auth.ownerActions, humanResiduals: auth.humanResiduals })

console.log(JSON.stringify({
  MACHINE_RELEASE_READINESS: rel.MACHINE_RELEASE_READINESS,
  MACHINE_CLOSABLE_REMAINING: wg.MACHINE_CLOSABLE_REMAINING,
  EXTERNAL_BLOCKED_REMAINING: wg.EXTERNAL_BLOCKED_REMAINING,
  BLOCKING_OWNER_ACTIONS_REMAINING: rel.BLOCKING_OWNER_ACTIONS_REMAINING,
  BLOCKING_HUMAN_RESIDUALS_REMAINING: rel.BLOCKING_HUMAN_RESIDUALS_REMAINING,
  RELEASE_PROMOTION_VERDICT: rel.RELEASE_PROMOTION_VERDICT,
  PRODUCTION_PROMOTION_ELIGIBLE: rel.PRODUCTION_PROMOTION_ELIGIBLE,
  blockingOwner: rel.blockingOwner, blockingHuman: rel.blockingHuman,
}, null, 2))

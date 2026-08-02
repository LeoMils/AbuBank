/*
 * AbuBank — build identity. Single source of truth for the visible version
 * label, branch hint, and operator-readable build name. Imported by main.tsx
 * (startup console.info) and by Settings/About (visible badge).
 *
 * IMPORTANT
 * - This is a build-identity surface, NOT a feature flag.
 * - Do not store secrets, tokens, or private data here.
 * - Bump `version` and `buildDate` each time a new operator-testable build ships.
 * - The package.json semver is exposed separately as `import.meta.env.VITE_APP_VERSION`.
 */

export const APP_VERSION = {
  appName:    'AbuBank',
  version:    '0.168.0-storage-taxonomy-clone-migrate-genome-rc',
  buildLabel: 'AbuBank — STORAGE_TAXONOMY + CLONE_MIGRATE + FAILURE_GENOME (session 44). Closes more of the automatable QA residue. GATE 8: contactStorageHealth.ts classifies WHY contacts are missing (CONTACT_NOT_CONFIGURED / SAVE_INTERRUPTED / RECOVERY_PENDING / DATA_CORRUPT / STORAGE_UNAVAILABLE / QUOTA_EXCEEDED / EXTERNAL_STORAGE_LOSS / WRONG_ORIGIN / USER_DELETION) using a privacy-safe high-water marker; the Board focused-contact and the operator receipt now show an HONEST message and NEVER say "not configured" for a storage/recovery failure. Saves record the high-water + in-flight markers so an interrupted save is detectable on reopen. GATE 4/D5: migrateContactsOnClone runs any migration on a CLONE and commits atomically only if schema + phone-preservation + checksum pass; strip/drop/throw/invalid all abort with the prior revision byte-for-byte intact (cloneMigration.test.ts). Failure Genome (failure-genome.json): 20 automatable failures mapped to regression + mutation proof + deployed replay, replayed before every RC. Meta-QA (meta-qa.json): blind-spot + assumption registers, mutation certification (every critical invariant has a red mutant), test-path authenticity audit, QA-system fault-injection, and a bug-coverage matrix. Evidence: CODE + TEST (Gate 8 11/11, D5 6/6; full suite only 5 pre-existing date/replay failures, 0 new). DEVICE: iOS storage-partition confirmation remains. Automatable residue: real A->B->C multi-deploy + real-provider comms matrix + enlarged-text reachability. Builds on 0.167.0.',
  buildDate:  '2026-08-03',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION

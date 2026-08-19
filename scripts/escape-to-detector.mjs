/*
 * escape-to-detector.mjs — canonical command: owner-found defect → permanent machine memory. (§21/B6)
 *   node scripts/escape-to-detector.mjs <defect-id>          → prints the record scaffold to fill in
 *   node scripts/escape-to-detector.mjs --validate           → validates every QA_CONTROL_ESCAPE record
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { scaffold, validateEscapeRecord } from './escape-to-detector-lib.mjs'

if (process.argv[2] === '--validate') {
  const escapes = JSON.parse(readFileSync(resolve('docs/engineering-os/qa/QA_CONTROL_ESCAPE_CORPUS.json'), 'utf8')).escapes
  const bad = escapes.map((e) => ({ id: e.id, ...validateEscapeRecord(e) })).filter((r) => !r.ok)
  if (bad.length) { console.log('INVALID escape records:', JSON.stringify(bad, null, 2)); process.exit(4) }
  console.log(`=== all ${escapes.length} escape records valid ===`); process.exit(0)
}
const id = process.argv[2]
if (!id) { console.error('usage: node scripts/escape-to-detector.mjs <defect-id> | --validate'); process.exit(2) }
console.log(JSON.stringify(scaffold(id), null, 2))
console.log('\nFill this in, add the detector test, append to QA_CONTROL_ESCAPE_CORPUS.json, then run --validate.')

/*
 * scan-bundle-privacy.mjs — measure private family data in the built client bundle.
 * (Task B: bundle graph + source-map/public-asset scan.)
 * ════════════════════════════════════════════════════════════════════════════
 *   node scripts/scan-bundle-privacy.mjs [distDir=dist]
 * Distinguishes the two known private sources so the number is HONEST:
 *   1) family_data.json DATASET — the ~70-person structured knowledge (this pass's
 *      target). Detected by its UNIQUE top-level markers (pii_excluded /
 *      resolved_notes / open_questions) which only the raw JSON carries.
 *   2) familyContacts.private SEED — the WhatsApp contacts-board scaffold (a
 *      SEPARATE source; documented residual). Detected by sampling its names.
 * Exit 0 iff the family_data.json DATASET is absent (this pass's contract); the
 * contacts-seed count is reported for transparency.
 */
import fs from 'node:fs'
import path from 'node:path'

const DIST = path.resolve(process.argv[2] || 'dist')
if (!fs.existsSync(DIST)) { console.error(`no dist dir at ${DIST} — build first`); process.exit(2) }

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(js|mjs|css|map|html|json|txt)$/.test(e.name)) out.push(p)
  }
  return out
}
const files = walk(DIST)
const all = files.map((f) => ({ f: path.relative(DIST, f), c: fs.readFileSync(f, 'utf8') }))

// (1) family_data.json dataset markers — only the raw JSON module carries these.
const DATASET_MARKERS = ['pii_excluded', 'resolved_notes', 'open_questions']
const datasetHits = []
for (const { f, c } of all) for (const m of DATASET_MARKERS) if (c.includes(`"${m}"`) || c.includes(m + ':')) datasetHits.push({ file: f, marker: m })

// (2) contacts-seed names (separate, documented source) — sample for transparency.
let seedNames = new Set()
try {
  const priv = fs.readFileSync(path.resolve('src/screens/AbuWhatsApp/familyContacts.private.ts'), 'utf8')
  for (const m of priv.matchAll(/label:\s*'([^']{3,})'|name:\s*'([^']{3,})'/g)) { const v = m[1] || m[2]; if (v) seedNames.add(v) }
} catch { /* file absent */ }
const seedHits = []
for (const { f, c } of all) for (const nm of seedNames) if (c.includes(nm)) { seedHits.push({ file: f, name: nm }); break }

const familyDatasetBundled = datasetHits.length > 0
const result = {
  distFilesScanned: files.length,
  FAMILY_DATA_JSON_DATASET: familyDatasetBundled ? 'BUNDLED (LEAK)' : 'ABSENT (clean)',
  datasetMarkerHits: datasetHits,
  contactsSeedSource: 'src/screens/AbuWhatsApp/familyContacts.private.ts (separate, documented residual)',
  contactsSeedFilesWithNames: seedHits.length,
  PUBLIC_PRIVATE_DATA_EXPOSURES: (familyDatasetBundled ? 1 : 0) + (seedHits.length > 0 ? 1 : 0),
  note: 'This pass migrates family_data.json only. The contacts-seed is a separate source (see PRIVATE_DATA_EXPOSURE.md).',
}
console.log(JSON.stringify(result, null, 2))
if (familyDatasetBundled) { console.error('❌ family_data.json dataset is STILL bundled'); process.exit(1) }
console.log(`✅ family_data.json dataset ABSENT from ${files.length} dist files (clean). Contacts-seed residual: ${seedHits.length > 0 ? 'present (documented)' : 'none'}.`)

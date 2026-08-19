/*
 * validate-knowledge.ts — AbuBank Knowledge System validator.
 * Fails (exit 1) if: an authority file is missing/empty; an authority YAML lacks its
 * domain markers; a knowledge_domain is claimed by more than one file (duplication);
 * or the generated per-person family files have drifted from family_data.json.
 * Pure Node + native JSON (no yaml dependency). Lightweight (MEDIUM) checks for YAML.
 */
import { readFileSync, existsSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const errors: string[] = []
const ok: string[] = []
const read = (p: string) => readFileSync(resolve(root, p), 'utf-8')
const exists = (p: string) => existsSync(resolve(root, p))

// 1. Required authority files exist + non-empty.
const AUTHORITIES = [
  'knowledge/KNOWLEDGE.md',
  'knowledge/product.yaml',
  'knowledge/behavior.yaml',
  'knowledge/production_rules.yaml',
  'knowledge/abuai_identity.yaml',
  'knowledge/martita_personality.yaml',
  'knowledge/family_data.json',
]
for (const f of AUTHORITIES) {
  if (!exists(f)) errors.push(`MISSING authority file: ${f}`)
  else if (read(f).trim().length < 20) errors.push(`EMPTY authority file: ${f}`)
  else ok.push(`exists: ${f}`)
}

// 2. YAML authorities declare their domain + authority marker; collect domains.
const YAML_AUTH = ['knowledge/product.yaml', 'knowledge/behavior.yaml', 'knowledge/production_rules.yaml', 'knowledge/abuai_identity.yaml']
const domainCount: Record<string, string[]> = {}
for (const f of YAML_AUTH) {
  if (!exists(f)) continue
  const src = read(f)
  const m = src.match(/^knowledge_domain:\s*(\S+)/m)
  if (!m) errors.push(`${f}: missing 'knowledge_domain:'`)
  else { domainCount[m[1]!] ??= []; domainCount[m[1]!]!.push(f) }
  if (!/^authority:\s*true/m.test(src)) errors.push(`${f}: missing 'authority: true'`)
}
// 3. Anti-duplication: each domain is owned by exactly one file.
for (const [domain, files] of Object.entries(domainCount)) {
  if (files.length > 1) errors.push(`DUPLICATE domain '${domain}' claimed by: ${files.join(', ')}`)
  else ok.push(`domain '${domain}' single-owned by ${files[0]}`)
}

// 4. Per-person family files are in sync with family_data.json.
try {
  const data = JSON.parse(read('knowledge/family_data.json')) as { family: Record<string, unknown> }
  const names: string[] = []
  for (const val of Object.values(data.family)) {
    const arr = Array.isArray(val) ? val : [val]
    for (const p of arr) { const o = p as Record<string, unknown>; if (o && (o.canonical_name || o.hebrew_name)) names.push(String(o.canonical_name ?? o.hebrew_name)) }
  }
  const peopleDir = 'knowledge/family/people'
  if (!exists(peopleDir)) {
    errors.push(`per-person files missing — run 'npm run generate:knowledge'`)
  } else {
    const files = readdirSync(resolve(root, peopleDir)).filter(f => f.endsWith('.yaml'))
    if (files.length !== names.length) errors.push(`per-person DRIFT: ${files.length} files vs ${names.length} people in family_data.json — run 'npm run generate:knowledge'`)
    else ok.push(`per-person in sync: ${files.length} files == ${names.length} people`)
    // every canonical/hebrew name appears in some per-person file
    const blob = files.map(f => read(`${peopleDir}/${f}`)).join('\n')
    for (const n of names) if (!blob.includes(n)) errors.push(`per-person missing record for: ${n} (regenerate)`)
  }
} catch (e) {
  errors.push(`family_data.json parse error: ${(e as Error).message}`)
}

// 5. Manifest lists the authorities (anti-scatter contract present).
if (exists('knowledge/KNOWLEDGE.md')) {
  const man = read('knowledge/KNOWLEDGE.md')
  for (const f of ['family_data.json', 'product.yaml', 'behavior.yaml', 'production_rules.yaml', 'abuai_identity.yaml']) {
    if (!man.includes(f)) errors.push(`KNOWLEDGE.md does not register authority: ${f}`)
  }
}

// eslint-disable-next-line no-console
console.log('=== Knowledge Validation ===')
// eslint-disable-next-line no-console
for (const o of ok) console.log('  OK:', o)
if (errors.length) {
  // eslint-disable-next-line no-console
  console.error('\n=== FAILED ===')
  // eslint-disable-next-line no-console
  for (const e of errors) console.error('  ✗', e)
  process.exit(1)
}
// eslint-disable-next-line no-console
console.log('=== ALL PASSED ===')

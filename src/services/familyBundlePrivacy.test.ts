/*
 * familyBundlePrivacy.test.ts — the private family dataset must NEVER be statically
 * imported by a client-bundled module. (Task B, PUBLIC_PRIVATE_DATA_EXPOSURES = 0)
 *
 * This is the source-graph guarantee: Vite only bundles what the client graph
 * statically imports, so if no runtime src/ module imports family_data.json or
 * abu-family.md, neither can appear in the public JS / source maps. The deployed
 * bundle is additionally scanned empirically in the recert (scripts/scan-bundle-privacy.mjs).
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '../..')
const SRC = path.join(ROOT, 'src')

// Allowed to reference the private data: TEST files, the test setup, and — for the
// SERVER side — api/family.ts (not a client module). Everything else in src/ must not.
function isAllowed(rel: string): boolean {
  return (
    rel.includes('.test.') ||
    rel.endsWith(path.join('test', 'hydrateFamily.ts')) ||
    rel.endsWith(path.join('services', 'familyData.ts')) || // only comments mention it
    rel.endsWith(path.join('services', 'familyHydration.ts')) // only comments
  )
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) out.push(p)
  }
  return out
}

const IMPORT_RE = /import\s+[^;]*from\s+['"][^'"]*(family_data\.json|abu-family\.md)[^'"]*['"]/g

describe('private family data is not bundled into the client', () => {
  const offenders: string[] = []
  for (const abs of walk(SRC)) {
    const rel = path.relative(ROOT, abs)
    if (isAllowed(rel)) continue
    const src = fs.readFileSync(abs, 'utf8')
    if (IMPORT_RE.test(src)) offenders.push(rel)
    IMPORT_RE.lastIndex = 0
  }

  it('no client-runtime src module statically imports family_data.json or abu-family.md', () => {
    expect(offenders, `these client modules still bundle the private dataset:\n${offenders.join('\n')}`).toEqual([])
  })

  it('familyData.ts (the hydration source) has NO static import of the dataset', () => {
    const src = fs.readFileSync(path.join(SRC, 'services', 'familyData.ts'), 'utf8')
    expect(/import\s+[^;]*from\s+['"][^'"]*family_data\.json/.test(src)).toBe(false)
    expect(/import\s+[^;]*from\s+['"][^'"]*abu-family\.md/.test(src)).toBe(false)
  })
})

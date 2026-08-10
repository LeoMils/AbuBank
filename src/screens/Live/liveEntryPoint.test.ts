/**
 * liveEntryPoint.test.ts — Abu AI cutover (Milestone: live is the default Abu AI).
 * ════════════════════════════════════════════════════════════════════════════
 * Proves the two halves of the entry-point cutover:
 *   1. the home Abu AI tile routes to the LIVE path (not the legacy AbuAI screen),
 *      the live overlay no longer REQUIRES ?live=1, and the legacy screen survives
 *      ONLY behind ?legacy=1;
 *   2. none of the legacy canned strings are REACHABLE from the default route —
 *      proven by walking the real static import graph from the two roots that the
 *      default route actually renders (Home + the Live overlay) and asserting the
 *      strings appear in NONE of the reachable modules.
 *
 * Evidence class: CODE (static source + real import-graph reachability). This does
 * not prove device behaviour — it proves the wiring and that the legacy cascade is
 * unreachable without ?legacy=1.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BUILD_ID } from '../../version'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(HERE, '..', '..')            // src/
const read = (rel: string) => readFileSync(resolve(SRC, rel), 'utf8')

/** The exact legacy canned strings that must NOT be reachable from the default route. */
const LEGACY_CANNED = [
  'לא הצלחתי להבין את ההקלטה. ננסה שוב',
  'לא הצלחתי לבדוק את זה עכשיו',
]

// ─── 1. Routing: the tile opens the live path; legacy is ?legacy=1 only ──────────

describe('Abu AI entry point — cutover to the live path', () => {
  const homeSrc = read('screens/Home/index.tsx')
  const appSrc = read('App.tsx')

  it('home Abu AI tile routes to the live path, not the legacy AbuAI screen', () => {
    // The 'ai' tile opens the live overlay through the opener…
    expect(homeSrc).toMatch(/item\.id === 'ai'\s*\?\s*\(\)\s*=>\s*openLiveAbu\(\)/)
    // …and openLiveAbu invokes the global App exposes.
    expect(homeSrc).toContain('__abubankOpenLive')
    // The tile must NOT navigate to the legacy Screen.AbuAI anymore.
    expect(homeSrc).not.toMatch(/item\.id === 'ai'[^\n]*setScreen\(Screen\.AbuAI\)/)
  })

  it('the live overlay no longer REQUIRES ?live=1 (opened via the global)', () => {
    expect(appSrc).toContain('__abubankOpenLive = () => setLiveOpen(true)')
  })

  it('the legacy AbuAI screen is reachable ONLY via ?legacy=1', () => {
    // The single place that routes to the legacy screen is the ?legacy=1 guard.
    expect(appSrc).toMatch(/searchParams\.get\('legacy'\) === '1'\)\s*setScreen\(Screen\.AbuAI\)/)
  })

  it('the live overlay renders BUILD_ID so a screenshot proves the build', () => {
    const liveSrc = read('screens/Live/LiveScreen.tsx')
    expect(liveSrc).toContain('BUILD_ID')
    expect(liveSrc).toContain("data-testid=\"live-build-id\"")
    expect(BUILD_ID).toMatch(/\d+\.\d+\.\d+/) // version-shaped fingerprint
  })
})

// ─── 2. Reachability: legacy canned strings unreachable from the default route ───

/** Resolve a relative import specifier from `fromFile` to a concrete source file. */
function resolveModule(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null                 // bare package — not our source
  if (spec.includes('?')) return null                    // ?raw etc. — not a code module
  const base = resolve(dirname(fromFile), spec)
  const candidates = [
    base, base + '.ts', base + '.tsx',
    resolve(base, 'index.ts'), resolve(base, 'index.tsx'),
  ]
  for (const c of candidates) if (existsSync(c) && !c.endsWith('/') && /\.tsx?$/.test(c)) return c
  return null
}

/** Collect the STATIC import specifiers of a file (import … from '…'; export … from '…').
 *  Dynamic import() (lazy legacy screens) is deliberately EXCLUDED — those are not part
 *  of what the default route statically renders. */
function staticImports(src: string): string[] {
  const specs: string[] = []
  // `… from '…'` — covers single- and multi-line import/export blocks. `import()`
  // (dynamic, used for the lazy legacy screen) has no `from` clause and is skipped.
  const fromRe = /\bfrom\s*['"]([^'"]+)['"]/g
  // Side-effect imports: `import '…'` (no `from`).
  const sideRe = /\bimport\s+['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = fromRe.exec(src))) { if (m[1]) specs.push(m[1]) }
  while ((m = sideRe.exec(src))) { if (m[1]) specs.push(m[1]) }
  return specs
}

/** BFS the static import graph from the given roots, returning every reachable file. */
function reachableFrom(roots: string[]): Set<string> {
  const seen = new Set<string>()
  const queue = [...roots]
  while (queue.length) {
    const file = queue.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    let src: string
    try { src = readFileSync(file, 'utf8') } catch { continue }
    for (const spec of staticImports(src)) {
      const next = resolveModule(file, spec)
      if (next && !seen.has(next)) queue.push(next)
    }
  }
  return seen
}

describe('Abu AI default route — legacy canned strings are unreachable', () => {
  // The default route renders the Home screen and, on tap, the Live overlay. Those
  // two files are the reachability roots (App mounts the legacy screen only through a
  // dynamic import behind ?legacy=1, which staticImports() intentionally skips).
  const roots = [
    resolve(SRC, 'screens', 'Home', 'index.tsx'),
    resolve(SRC, 'screens', 'Live', 'LiveScreen.tsx'),
  ]
  const graph = reachableFrom(roots)

  it('walks a non-trivial graph (guards against an empty/false pass)', () => {
    expect(graph.size).toBeGreaterThan(5)
    // The live path core must be inside the reachable set — sanity that we rooted right.
    expect([...graph].some((f) => f.endsWith('liveSession.ts'))).toBe(true)
    expect([...graph].some((f) => f.endsWith('liveTools.ts'))).toBe(true)
  })

  for (const canned of LEGACY_CANNED) {
    it(`no module reachable from the default route contains: ${canned.slice(0, 24)}…`, () => {
      const offenders = [...graph].filter((f) => readFileSync(f, 'utf8').includes(canned))
      expect(offenders).toEqual([])
    })
  }

  it('the canned strings still exist SOMEWHERE (proves the guard can actually catch a regression)', () => {
    // If these strings were deleted repo-wide the reachability test would pass vacuously.
    // Assert they still live in the (unreachable) legacy cascade so the guard has teeth.
    const legacyFiles = [
      'services/errorMediation.ts',       // contains canned string #1
      'screens/AbuAI/runtimeFullTurn.ts', // contains canned string #2
    ]
    const anyPresent = legacyFiles.some((rel) => {
      try { const s = read(rel); return LEGACY_CANNED.some((c) => s.includes(c)) } catch { return false }
    })
    expect(anyPresent).toBe(true)
  })
})

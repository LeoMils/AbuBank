/*
 * deployedSecretScan.ts — the DEPLOYED-bundle credential scanner as canonical release authority. (A2)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * The prior scripts/scan-deployed-secrets.ts had HARDCODED targets and ignored its URL argument — so
 * release certification could silently inspect the WRONG deployment (a false-security-PASS). This
 * module makes the scanner trustworthy AND unit-calibratable (injectable fetch):
 *   • explicit target — no hidden default; the caller's URL is materially honored.
 *   • fails CLOSED — an unreachable target is UNREACHABLE, never CLEAN/PASS.
 *   • scans the ACTUAL HTML + the reachable client CHUNK GRAPH (entry + transitive /assets/*.js),
 *     not just the entry — a secret in a lazy route chunk cannot hide.
 *   • scans credential MATERIAL (raw token shapes) via scanBundleForCredentialMaterial — catches a
 *     renamed/minified/inlined secret that a VITE_-name check misses — plus the name classifier.
 *   • redacted fingerprints only; never a credential value.
 */
import { scanBundleForCredentialMaterial, classifyShippedKeys } from './bundleSecretScan'

export type ScanFetch = (url: string) => Promise<{ ok: boolean; text: () => Promise<string> }>

export interface TargetScan {
  target: string
  reachable: boolean
  chunks: number
  bytes: number
  /** raw credential-material scan result (the authoritative signal). */
  clean: boolean
  findings: Array<{ provider: string; redactedFingerprint: string; length: number }>
  /** VITE_-name classifier: names shipped with a real credential-kind value. */
  confirmedSecretNames: string[]
  /** Public client configuration present (specificity — NOT a leak). */
  publicConfig: string[]
  verdict: 'CLEAN' | 'EXPOSED' | 'UNREACHABLE'
  error?: string
}

/** Fetch the entry HTML and walk the client chunk graph (entry + transitively-referenced /assets/*.js).
 *  reachable=false when the entry cannot be fetched → the caller MUST fail closed (never certify CLEAN). */
export async function crawlChunkGraph(base: string, fetchImpl: ScanFetch): Promise<{ text: string; chunks: number; reachable: boolean }> {
  const b = base.replace(/\/$/, '')
  let html: string
  try {
    const r = await fetchImpl(`${b}/`)
    if (!r.ok) return { text: '', chunks: 0, reachable: false }
    html = await r.text()
  } catch { return { text: '', chunks: 0, reachable: false } }

  const seen = new Set<string>()
  const queue: string[] = []
  const enqueue = (s: string) => { for (const m of s.matchAll(/assets\/[\w.\-]+\.js/g)) { const a = '/' + m[0]; if (!seen.has(a)) queue.push(a) } }
  enqueue(html)
  let text = html
  let chunks = 0
  while (queue.length) {
    const a = queue.shift()!
    if (seen.has(a)) continue
    seen.add(a)
    try {
      const r = await fetchImpl(`${b}${a}`)
      if (r.ok) { const js = await r.text(); text += '\n' + js; chunks++; enqueue(js) }
    } catch { /* a missing chunk is not a pass — it just contributes nothing */ }
  }
  return { text, chunks, reachable: true }
}

/** Scan ONE explicit target. Unreachable → UNREACHABLE (fail closed). Never returns CLEAN for a
 *  target it could not actually fetch and walk. */
export async function scanTarget(target: string, fetchImpl: ScanFetch): Promise<TargetScan> {
  if (!target || !/^https?:\/\//.test(target)) {
    return { target, reachable: false, chunks: 0, bytes: 0, clean: false, findings: [], confirmedSecretNames: [], publicConfig: [], verdict: 'UNREACHABLE', error: 'no explicit http(s) target — refuse to certify' }
  }
  const { text, chunks, reachable } = await crawlChunkGraph(target, fetchImpl)
  if (!reachable) {
    return { target, reachable: false, chunks: 0, bytes: 0, clean: false, findings: [], confirmedSecretNames: [], publicConfig: [], verdict: 'UNREACHABLE', error: 'target unreachable — fail closed (never CLEAN)' }
  }
  const raw = scanBundleForCredentialMaterial(text)
  const classes = classifyShippedKeys(text)
  const confirmedSecretNames = classes.filter((c) => c.exposure === 'CONFIRMED_SECRET_EXPOSED').map((c) => c.name)
  const publicConfig = classes.filter((c) => c.exposure === 'PUBLIC_CLIENT_CONFIGURATION').map((c) => c.name)
  const exposed = !raw.clean || confirmedSecretNames.length > 0
  return {
    target, reachable: true, chunks, bytes: text.length,
    clean: raw.clean,
    findings: raw.findings.map((f) => ({ provider: f.provider, redactedFingerprint: f.redactedFingerprint, length: f.length })),
    confirmedSecretNames, publicConfig,
    verdict: exposed ? 'EXPOSED' : 'CLEAN',
  }
}

/** Scan several explicit targets. The overall release-authority verdict is CLEAN only when EVERY
 *  target is reachable AND clean; any UNREACHABLE or EXPOSED target makes the whole scan not-PASS. */
export async function scanTargets(targets: string[], fetchImpl: ScanFetch): Promise<{ pass: boolean; targets: TargetScan[] }> {
  const results: TargetScan[] = []
  for (const t of targets) results.push(await scanTarget(t, fetchImpl))
  const pass = results.length > 0 && results.every((r) => r.verdict === 'CLEAN')
  return { pass, targets: results }
}

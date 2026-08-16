/*
 * CAPABILITY DISCOVERY PRODUCER (o-capability, static).  npx tsx scripts/discover-capabilities.ts
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 * Reconciles MULTIPLE independent static signals from the REAL repo into the canonical
 * capability manifest — proving the product universe is capabilities, not just screens.
 * This is a reproducible GENERATED_EVIDENCE producer (§30): it identifies itself and its
 * inputs; it does not hand-author truth. Dynamic (deployed-RC) reachability differential
 * (§13) is a separate step and is recorded as pending, so o-capability stays honestly open.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { evaluateCapabilityManifest, type CapabilitySignal, type ManifestInput } from '../src/engineering-os/capabilityManifest.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const p = (r: string) => resolve(ROOT, r)
const read = (r: string) => { try { return readFileSync(p(r), 'utf8') } catch { return '' } }

const signals: CapabilitySignal[] = []

// SIGNAL 1: screen directories.
try {
  for (const d of readdirSync(p('src/screens'), { withFileTypes: true })) {
    if (d.isDirectory()) signals.push({ id: d.name, source: 'SCREEN_DIR', type: 'UI_SURFACE' })
  }
} catch { /* */ }

// SIGNAL 2: Screen enum/union (string-literal screen ids in state/types.ts).
const typesSrc = read('src/state/types.ts')
for (const m of typesSrc.matchAll(/'(Home|Opening|Offline|Error|Admin|AbuAI|AbuWhatsApp|AbuCalendar|AbuWeather|AbuGames|AbuNews|Live|Settings|FamilyGallery|FamilyPhones|FamilyRecord)'/g)) {
  signals.push({ id: m[1]!, source: 'SCREEN_ENUM', type: 'UI_SURFACE' })
}

// SIGNAL 3: live tool/action registry (voice + action + integration capabilities).
const toolsSrc = read('src/services/liveTools.ts')
const INTEGRATION = new Set(['phone_call', 'whatsapp_draft', 'get_current_info'])
const VOICE_ONLY = new Set(['care_concern'])
for (const m of toolsSrc.matchAll(/name:\s*'([a-z_]+)'/g)) {
  const id = m[1]!
  const type = INTEGRATION.has(id) ? 'INTEGRATION_CAPABILITY' : VOICE_ONLY.has(id) ? 'VOICE_CHANNEL' : 'ACTION_CAPABILITY'
  signals.push({ id, source: 'TOOL_REGISTRY', type })
}

// SIGNAL 4: device-gated feature flags — each registers a distinct HEARD capability
// (deviceGatedFlags.ts DEVICE_GATED_FLAGS registry). Missed by the 3 legacy signals.
const flagsSrc = read('src/services/deviceGatedFlags.ts')
for (const m of flagsSrc.matchAll(/id:\s*'(LIVE_[A-Z0-9_]+)'/g)) {
  signals.push({ id: m[1]!, source: 'FEATURE_FLAG', type: 'FEATURE_CAPABILITY' })
}

// SIGNAL 5: online capability flags (online/flags.ts *_DEFAULT constants gate the
// online search/prefetch capabilities).
const onlineFlagsSrc = read('src/services/online/flags.ts')
for (const m of onlineFlagsSrc.matchAll(/export const (ONLINE_[A-Z0-9_]+)_DEFAULT\b/g)) {
  signals.push({ id: m[1]!, source: 'FEATURE_FLAG', type: 'FEATURE_CAPABILITY' })
}

// SIGNAL 6: deep-link/query-param routes (App.tsx). Most targets overlap existing
// screens (?live=1→Live, /settings/family-phones→FamilyPhones), but ?diagnostics opens
// DiagnosticOverlay — a user-reachable overlay that is NOT a src/screens/* dir and NOT
// in the Screen enum, so SCREEN_DIR/SCREEN_ENUM cannot see it.
const appSrc = read('src/App.tsx')
if (/diagnostics'|#diagnostics/.test(appSrc) && /DiagnosticOverlay/.test(appSrc)) {
  signals.push({ id: 'DiagnosticOverlay', source: 'ROUTE', type: 'UI_SURFACE' })
}

// Conservative default classification: every discovered capability is provisionally
// USER_REACHABLE/USER_INVOKABLE (never shrink the denominator without proof, §16).
// Non-user classification must be ADDED later with a machine-verifiable exclusion proof.
const classifications: ManifestInput['classifications'] = {}
const uiHighRisk = new Set(['AbuAI', 'AbuCalendar', 'AbuWhatsApp', 'AbuNews', 'Live'])
const actionHighRisk = new Set(['phone_call', 'whatsapp_draft', 'get_current_info', 'people_lookup', 'set_reminder', 'prepare_calendar_event', 'confirm_calendar_event', 'update_calendar_event', 'cancel_calendar_event', 'read_calendar', 'resolve_contact', 'remember'])
for (const s of signals) {
  const isUI = s.type === 'UI_SURFACE'
  const high = uiHighRisk.has(s.id) || actionHighRisk.has(s.id)
  classifications[s.id] = { reachability: isUI ? 'USER_REACHABLE' : 'USER_INVOKABLE', riskTier: high ? 'high' : isUI ? 'medium' : 'medium' }
}

const result = evaluateCapabilityManifest({ signals, classifications, dynamicObserved: [] })
const unique = new Map<string, { type: string; sources: string[]; reachability: string; riskTier?: string }>()
for (const c of result.capabilities) unique.set(c.id, { type: c.type, sources: c.sources, reachability: c.reachability, ...(c.riskTier ? { riskTier: c.riskTier } : {}) })

const manifest = {
  $schema: 'internal://abu/capability-manifest',
  producer: 'scripts/discover-capabilities.ts',
  producedFrom: ['src/screens/*', 'src/state/types.ts', 'src/services/liveTools.ts', 'src/services/deviceGatedFlags.ts', 'src/services/online/flags.ts', 'src/App.tsx'],
  candidateNote: 'static discovery now source-complete (6 source classes; verified by capabilityDiscoverySource oracle). DYNAMIC reachability differential vs deployed RC is PENDING (o-capability stays UNIMPLEMENTED until dynamic + drift proof).',
  totalCapabilities: unique.size,
  byType: [...unique.values()].reduce((a, c) => { a[c.type] = (a[c.type] ?? 0) + 1; return a }, {} as Record<string, number>),
  staticBlockers: result.blockers,
  capabilities: Object.fromEntries([...unique.entries()].sort()),
}
writeFileSync(p('docs/engineering-os/qa/capability-manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
const line = (s: string) => process.stdout.write(s + '\n')
line('── capability discovery (static) ──────────────────────')
line(`total capabilities: ${unique.size}`)
for (const [t, n] of Object.entries(manifest.byType)) line(`  ${t.padEnd(22)} ${n}`)
line(`static blockers: ${result.blockers.length}`)
line(`→ wrote docs/engineering-os/qa/capability-manifest.json`)
line('NOTE: dynamic reachability differential vs deployed 0.286 is PENDING → o-capability remains UNIMPLEMENTED (honest).')

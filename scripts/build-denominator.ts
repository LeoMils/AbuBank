/*
 * build-denominator.ts — derive the acceptance denominator from the canonical manifest. (§7)
 *   npx tsx scripts/build-denominator.ts
 * Reads the canonical capability-manifest.json, maps each capability to its risk-relevant shape,
 * builds the denominator (risk assigned in denominator.ts), writes acceptance-denominator.json.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildDenominator, type CapabilitySpec, type CapabilityType } from '../src/engineering-os/denominator.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const p = (r: string) => resolve(ROOT, r)

const manifest = JSON.parse(readFileSync(p('docs/engineering-os/qa/capability-manifest.json'), 'utf8'))

// Risk-relevant shape per capability (from the tool semantics — not a guess about risk itself).
const SIDE_EFFECT = new Set(['prepare_calendar_event', 'confirm_calendar_event', 'cancel_calendar_event', 'update_calendar_event', 'correct_calendar_field', 'whatsapp_draft', 'phone_call', 'cancel_communication', 'set_reminder', 'remember'])
const GROUNDS = new Set(['get_current_info', 'people_lookup', 'history_lookup', 'read_calendar', 'resolve_contact'])
const FAMILY_TRUTH = new Set(['people_lookup', 'history_lookup', 'resolve_contact', 'FamilyRecord', 'FamilyGallery', 'FamilyPhones'])
const PLAYBACK = new Set(['Live', 'AbuAI', 'care_concern'])

const specs: CapabilitySpec[] = Object.entries(manifest.capabilities).map(([id, c]) => ({
  id,
  type: (c as { type: CapabilityType }).type,
  ...(SIDE_EFFECT.has(id) ? { hasSideEffect: true } : {}),
  ...(GROUNDS.has(id) ? { grounds: true } : {}),
  ...(FAMILY_TRUTH.has(id) ? { familyTruth: true } : {}),
  ...(PLAYBACK.has(id) ? { playback: true } : {}),
}))

const result = buildDenominator(specs)
const artifact = {
  $schema: 'internal://abu/acceptance-denominator',
  producer: 'scripts/build-denominator.ts',
  derivedFrom: 'docs/engineering-os/qa/capability-manifest.json (canonical, o-capability PROVEN)',
  note: 'Applicability derived, not Cartesian. Risk assigned by the certified model in denominator.ts. minEvidenceClass is the floor a cell must reach to count PROVEN.',
  capabilityCount: specs.length,
  cellCount: result.cells.length,
  byRisk: result.byRisk,
  byFamily: result.byFamily,
  cells: result.cells,
}
writeFileSync(p('docs/engineering-os/qa/acceptance-denominator.json'), JSON.stringify(artifact, null, 2) + '\n')

const line = (s: string) => process.stdout.write(s + '\n')
line('── acceptance denominator ─────────────────────────────')
line(`capabilities: ${specs.length}   cells: ${result.cells.length}`)
line(`by risk: P0=${result.byRisk.P0} P1=${result.byRisk.P1} P2=${result.byRisk.P2}`)
line(`by family: ${Object.entries(result.byFamily).map(([k, v]) => `${k}=${v}`).join(' ')}`)
line('→ wrote docs/engineering-os/qa/acceptance-denominator.json')

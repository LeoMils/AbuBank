/**
 * Generates memory/ family files from the single source of truth.
 *
 * Source: knowledge/family_data.json
 * Outputs:
 *   - memory/family_graph.yaml
 *   - memory/aliases_and_names.yaml
 *   - memory/martita_profile.yaml (identity from JSON, personality preserved)
 *
 * Run: npm run generate:memory
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const root = resolve(dirname(__filename), '..')

const HEADER = `# ⚠️ 100% GENERATED FILE — DO NOT EDIT
# Source of truth: knowledge/family_data.json + knowledge/martita_personality.yaml
# Regenerate with: npm run generate:memory
# Generated: ${new Date().toISOString().split('T')[0]}
`

const json = JSON.parse(readFileSync(resolve(root, 'knowledge/family_data.json'), 'utf-8'))
const personalityRaw = readFileSync(resolve(root, 'knowledge/martita_personality.yaml'), 'utf-8')
const f = json.family

// ─── Generate family_graph.yaml ───

function generateFamilyGraph(): string {
  const lines = [HEADER, '']

  lines.push('matriarch:')
  lines.push(`  canonical_name: "${f.matriarch.canonical_name}"`)
  lines.push(`  aliases: ${JSON.stringify(f.matriarch.aliases)}`)
  lines.push(`  birthday: "${f.matriarch.birthday}"`)
  lines.push(`  location: "${f.matriarch.location}"`)
  lines.push('')

  lines.push('children:')
  for (const c of f.children) {
    lines.push(`  - canonical_name: "${c.canonical_name}"`)
    lines.push(`    hebrew: "${c.hebrew_name}"`)
    lines.push(`    relationship: "${c.relationship}"`)
    if (c.ex_spouse) lines.push(`    ex_spouse: "${c.ex_spouse}"`)
    if (c.partner) lines.push(`    partner: "${c.partner}"`)
    if (c.location) lines.push(`    location: "${c.location}"`)
    if (c.location_notes) lines.push(`    location_notes: "${c.location_notes}"`)
    if (c.birthday) lines.push(`    birthday: "${c.birthday}"`)
    if (c.children?.length) {
      lines.push(`    children:`)
      for (const gc of (f.grandchildren_mor ?? []).concat(f.grandchildren_leo ?? [])) {
        if (c.children.includes(gc.hebrew_name)) {
          lines.push(`      - canonical_name: "${gc.canonical_name}"`)
          lines.push(`        hebrew: "${gc.hebrew_name}"`)
          lines.push(`        relationship: "${gc.relationship}"`)
          if (gc.spouse) lines.push(`        spouse: "${gc.spouse}"`)
          if (gc.notes) lines.push(`        notes: "${gc.notes}"`)
          if (gc.children?.length) {
            lines.push(`        children:`)
            for (const ggc of f.great_grandchildren ?? []) {
              if (gc.children.includes(ggc.hebrew_name)) {
                lines.push(`          - { name: "${ggc.canonical_name}", hebrew: "${ggc.hebrew_name}", relationship: "${ggc.relationship}" }`)
              }
            }
          } else if (Array.isArray(gc.children) && gc.children.length === 0) {
            lines.push(`        children: []`)
          }
        }
      }
    }
    lines.push('')
  }

  if (f.deceased) {
    lines.push('deceased:')
    lines.push(`  - canonical_name: "${f.deceased.canonical_name}"`)
    lines.push(`    hebrew: "${f.deceased.hebrew_name}"`)
    lines.push(`    aliases: ${JSON.stringify(f.deceased.aliases)}`)
    lines.push(`    relationship: "${f.deceased.relationship}"`)
    lines.push(`    birthday: "${f.deceased.birthday}"`)
    lines.push(`    date_of_passing: "${f.deceased.date_of_passing}"`)
    if (f.deceased.notes) lines.push(`    notes: "${f.deceased.notes}"`)
    lines.push('')
  }

  if (f.pets?.length) {
    lines.push('pets:')
    for (const p of f.pets) {
      lines.push(`  - name: "${p.canonical_name}"`)
      lines.push(`    hebrew: "${p.hebrew_name}"`)
      lines.push(`    owner: "${p.owner}"`)
      if (p.notes) lines.push(`    notes: "${p.notes}"`)
    }
    lines.push('')
  }

  if (f.close_friends?.length) {
    lines.push('close_friends:')
    for (const fr of f.close_friends) {
      lines.push(`  - { name: "${fr.canonical_name}", hebrew: "${fr.hebrew_name}", relationship: "${fr.relationship_hebrew}" }`)
    }
  }

  return lines.join('\n') + '\n'
}

// ─── Generate aliases_and_names.yaml ───

function generateAliases(): string {
  const lines = [HEADER, '']
  lines.push('aliases:')

  const allMembers = [
    f.matriarch,
    f.deceased,
    ...f.children,
    ...(f.children_related ?? []),
    ...(f.grandchildren_mor ?? []),
    ...(f.grandchildren_leo ?? []),
    ...(f.grandchildren_spouses ?? []),
    ...(f.great_grandchildren ?? []),
    ...(f.pets ?? []),
    ...(f.close_friends ?? []),
  ].filter(Boolean)

  for (const m of allMembers) {
    const name = m.canonical_name
    const aliases = [m.hebrew_name, ...(m.aliases ?? [])].filter((a: string) => a !== name)
    const uniqueAliases = [...new Set(aliases)]
    lines.push(`  ${name.padEnd(12)}: ${JSON.stringify(uniqueAliases)}`)
  }

  lines.push('')
  lines.push('# Role-based lookups')
  lines.push('roles:')

  const children = f.children.map((c: any) => c.canonical_name)
  const grandchildren = [...(f.grandchildren_mor ?? []), ...(f.grandchildren_leo ?? [])].map((g: any) => g.canonical_name)
  const greatGrandchildren = (f.great_grandchildren ?? []).map((g: any) => g.canonical_name)
  const pets = (f.pets ?? []).map((p: any) => p.canonical_name)
  const friends = (f.close_friends ?? []).map((fr: any) => fr.canonical_name)

  lines.push(`  children:            ${JSON.stringify(children)}`)
  lines.push(`  grandchildren:       ${JSON.stringify(grandchildren)}`)
  lines.push(`  great_grandchildren: ${JSON.stringify(greatGrandchildren)}`)
  lines.push(`  deceased_spouse:     ${JSON.stringify([f.deceased?.canonical_name].filter(Boolean))}`)
  lines.push(`  pets:                ${JSON.stringify(pets)}`)
  lines.push(`  close_friends:       ${JSON.stringify(friends)}`)

  return lines.join('\n') + '\n'
}

// ─── Generate martita_profile.yaml ───

function generateProfile(): string {
  const m = f.matriarch
  const d = f.deceased
  const pets = (f.pets ?? []).filter((p: any) => p.owner === 'Martita')

  const lines = [HEADER, '']

  // Identity section — from family_data.json
  lines.push('# Identity (from knowledge/family_data.json)')
  lines.push('identity:')
  lines.push(`  display_name: "${m.canonical_name}"`)
  lines.push(`  self_sign: "${m.aliases?.[0] ?? 'אבו'}"`)
  lines.push(`  age_range: "80+"`)
  lines.push(`  origin: "${m.origin}"`)
  lines.push(`  current_city: "${m.location}"`)
  lines.push(`  languages:`)
  for (const lang of m.languages ?? []) {
    lines.push(`    - "${lang}"`)
  }
  lines.push(`  marital_status: "widowed"`)
  if (d) lines.push(`  husband_name: "${d.canonical_name}"`)
  lines.push(`  birthday: "${m.birthday}"`)
  if (pets.length) lines.push(`  pet: "${pets[0].canonical_name}"`)
  lines.push('')

  // Personality + daily_life — from martita_personality.yaml
  lines.push('# Personality & daily life (from knowledge/martita_personality.yaml)')
  lines.push(personalityRaw.split('\n').filter(l => !l.startsWith('#') || l.trim() === '').join('\n').trim())

  return lines.join('\n') + '\n'
}

// ─── Execute ───

console.log('Generating memory files from knowledge/family_data.json...')

writeFileSync(resolve(root, 'memory/family_graph.yaml'), generateFamilyGraph(), 'utf-8')
console.log('  ✓ memory/family_graph.yaml')

writeFileSync(resolve(root, 'memory/aliases_and_names.yaml'), generateAliases(), 'utf-8')
console.log('  ✓ memory/aliases_and_names.yaml')

writeFileSync(resolve(root, 'memory/martita_profile.yaml'), generateProfile(), 'utf-8')
console.log('  ✓ memory/martita_profile.yaml')

console.log('\nDone. Memory files regenerated from source of truth.')

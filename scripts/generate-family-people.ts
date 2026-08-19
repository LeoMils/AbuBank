/*
 * generate-family-people.ts
 * Emits one human-readable YAML record per family member into
 * knowledge/family/people/, derived from the machine source knowledge/family_data.json.
 * These per-person files are a GENERATED, scalable VIEW — never hand-edit them; edit
 * family_data.json (skill add-family-member) then re-run `npm run generate:knowledge`.
 *
 * Writes YAML as text (no yaml dependency needed).
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(root, 'knowledge/family/people')

type Person = Record<string, unknown>
const data = JSON.parse(readFileSync(resolve(root, 'knowledge/family_data.json'), 'utf-8')) as { family: Record<string, unknown> }

function yamlValue(v: unknown, indent: number): string {
  const pad = '  '.repeat(indent)
  if (v === null || v === undefined) return 'null'
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]'
    return '\n' + v.map(item => (typeof item === 'object' && item !== null)
      ? `${pad}-\n${yamlObject(item as Person, indent + 2)}`
      : `${pad}- ${scalar(item)}`).join('\n')
  }
  if (typeof v === 'object') return '\n' + yamlObject(v as Person, indent + 1)
  return scalar(v)
}
function scalar(v: unknown): string {
  const s = String(v)
  return /[:#\n]|^\s|\s$/.test(s) ? JSON.stringify(s) : s
}
function yamlObject(o: Person, indent: number): string {
  const pad = '  '.repeat(indent)
  return Object.entries(o).map(([k, v]) => {
    const val = yamlValue(v, indent)
    return val.startsWith('\n') ? `${pad}${k}:${val}` : `${pad}${k}: ${val}`
  }).join('\n')
}

function slug(p: Person): string {
  const name = (p.canonical_name as string) || (p.hebrew_name as string) || 'unknown'
  return String(name).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'unknown'
}

// collect every person across all groups, tagging the group it came from
const people: Array<{ group: string; person: Person }> = []
for (const [group, val] of Object.entries(data.family)) {
  if (Array.isArray(val)) for (const p of val) { if (p && typeof p === 'object' && ('canonical_name' in p || 'hebrew_name' in p)) people.push({ group, person: p as Person }) }
  else if (val && typeof val === 'object' && ('canonical_name' in (val as Person) || 'hebrew_name' in (val as Person))) people.push({ group, person: val as Person })
}

// clean the output dir (it is fully generated)
if (existsSync(OUT)) for (const f of readdirSync(OUT)) if (f.endsWith('.yaml')) rmSync(resolve(OUT, f))
mkdirSync(OUT, { recursive: true })

const index: string[] = []
for (const { group, person } of people) {
  const file = `${slug(person)}.yaml`
  const body = `# GENERATED from knowledge/family_data.json — DO NOT EDIT. Edit the JSON + run generate:knowledge.\ngroup: ${group}\n${yamlObject(person, 0)}\n`
  writeFileSync(resolve(OUT, file), body, 'utf-8')
  index.push(`- ${person.canonical_name ?? person.hebrew_name} (${group}) -> people/${file}`)
}
writeFileSync(resolve(root, 'knowledge/family/INDEX.md'), `# Family — per-person files (GENERATED)\n\n${people.length} people. Source: knowledge/family_data.json.\n\n${index.join('\n')}\n`, 'utf-8')

// eslint-disable-next-line no-console
console.log(`generate:knowledge — wrote ${people.length} per-person files to knowledge/family/people/`)

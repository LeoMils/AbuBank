/**
 * Validates that knowledge/family_data.json is consistent
 * and that memory/ files don't contradict the source of truth.
 *
 * Run: npx tsx scripts/validate-family-data.ts
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const root = resolve(dirname(__filename), '..')
const json = JSON.parse(readFileSync(resolve(root, 'knowledge/family_data.json'), 'utf-8'))
const yaml = readFileSync(resolve(root, 'memory/family_graph.yaml'), 'utf-8')
const aliases = readFileSync(resolve(root, 'memory/aliases_and_names.yaml'), 'utf-8')

let errors = 0

function check(condition: boolean, msg: string) {
  if (!condition) { console.error('FAIL:', msg); errors++ }
  else { console.log('  OK:', msg) }
}

console.log('=== Family Data Validation ===\n')

// 1. JSON structure
console.log('Structure checks:')
check(!!json.family, 'family root exists')
check(!!json.family.matriarch, 'matriarch exists')
check(!!json.family.children?.length, 'children exist')
check(!!json.family.grandchildren_mor?.length, 'grandchildren_mor exist')
check(!!json.family.grandchildren_leo?.length, 'grandchildren_leo exist')
check(!!json.family.great_grandchildren?.length, 'great_grandchildren exist')

// 2. Key relationships from JSON
console.log('\nRelationship checks:')
const mor = json.family.children.find((c: any) => c.canonical_name === 'Mor')
check(!!mor, 'Mor exists')
check(mor?.ex_spouse === 'רפי', 'Mor is divorced from Rafi')
check(mor?.partner === 'יעל', 'Mor partner is Yael')
check(!mor?.spouse, 'Mor has no spouse field (not married)')

const ofir = json.family.grandchildren_mor.find((g: any) => g.canonical_name === 'Ofir')
check(ofir?.spouse === 'גלעד', 'Ofir married to Gilad')

const eili = json.family.grandchildren_mor.find((g: any) => g.canonical_name === 'Eili')
check(eili?.relationship_hebrew?.includes('ירדן'), 'Eili married to Yarden')
check(Array.isArray(eili?.children) && eili.children.length === 0, 'Eili has no children')

const yarden = json.family.grandchildren_spouses.find((g: any) => g.canonical_name === 'Yarden')
check(yarden?.spouse === 'עילי', 'Yarden married to Eili (not Ofir)')

const gilad = json.family.grandchildren_spouses.find((g: any) => g.canonical_name === 'Gilad')
check(gilad?.spouse === 'אופיר', 'Gilad married to Ofir (not Ayalon)')

const anabel = json.family.great_grandchildren.find((g: any) => g.canonical_name === 'Anabel')
check(anabel?.relationship_hebrew?.includes('אופיר וגלעד'), 'Anabel is child of Ofir+Gilad')

// 3. Check memory/ files don't contradict
console.log('\nMemory file contradiction checks:')
check(!yaml.match(/^\s+spouse: "Raphi/m), 'YAML does not say Mor married to Raphi (ex_spouse is OK)')
check(!yaml.includes('spouse: "Yarden (ירדן)"') || yaml.includes('Eili'), 'YAML Yarden only as Eili spouse')
check(yaml.includes('GENERATED') || yaml.includes('DERIVED BACKUP'), 'YAML has generated/derived header')
check(aliases.includes('GENERATED') || aliases.includes('DERIVED BACKUP'), 'Aliases has generated/derived header')

// 4. No forbidden patterns
console.log('\nForbidden pattern checks:')
check(!yaml.includes('אשת אופיר'), 'YAML: no "wife of Ofir" for Yarden')
check(!yaml.includes('בן זוג של איילון'), 'YAML: no "partner of Ayalon" for Gilad')

console.log(`\n=== ${errors === 0 ? 'ALL PASSED' : errors + ' ERRORS FOUND'} ===`)
process.exit(errors > 0 ? 1 : 0)

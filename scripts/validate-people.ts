/*
 * validate-people.ts — the people-store gate (M3). Errors in PLAIN HEBREW.
 * A broken family file must never reach a build: this runs in prebuild and exits 1
 * on any error. It also locks the three named kinship relationships as a regression.
 */
import { loadPeople, resolvePersonId, normalizeName } from '../src/services/people/peopleModel'
import { relationshipOf, type KinKind } from '../src/services/people/kinship'

const people = loadPeople()
const errors: string[] = []
const byId = new Map(people.map((p) => [p.id, p]))

// every person has a verbatim Hebrew name
for (const p of people) if (!p.hebrewName?.trim()) errors.push(`אדם ללא שם עברי: ${p.canonicalName}`)

// ids unique
const seen = new Set<string>()
for (const p of people) { if (seen.has(p.id)) errors.push(`מזהה כפול: ${p.id}`); seen.add(p.id) }

// every name/alias resolves to EXACTLY one person
const nameOwner = new Map<string, string>()
for (const p of people) for (const key of [p.hebrewName, ...p.hebrewAliases, ...p.latinNames]) {
  if (!key) continue
  const n = normalizeName(key)
  const prev = nameOwner.get(n)
  if (prev && prev !== p.id) errors.push(`השם "${key}" מצביע על שני אנשים: ${prev} ו-${p.id}`)
  nameOwner.set(n, p.id)
}

// every edge points at a real person
const edgeFields: Array<keyof typeof people[number]> = ['parents', 'children', 'spouses', 'formerSpouses', 'partners', 'cohabitsWith']
for (const p of people) for (const f of edgeFields) for (const rid of (p[f] as string[])) if (!byId.has(rid)) errors.push(`קשר לא תקין: ${p.hebrewName} → ${String(f)} → "${rid}" (אדם לא קיים)`)

// gender only from the allowed set (never a guess encoded as a bad value)
for (const p of people) if (!['male', 'female', 'unknown'].includes(p.gender)) errors.push(`מגדר לא תקין ל-${p.hebrewName}: "${p.gender}"`)

// the three named relationships MUST hold (device-failure regression)
const NAMED: Array<[string, string, KinKind, string]> = [
  ['leo', 'ofir', 'uncle_aunt', 'לאו הוא הדוד של הילדים של מור'],
  ['gilad', 'eili', 'sibling_in_law', 'גלעד הוא הגיס של עילי'],
  ['yarden', 'raphi', 'child_in_law', 'ירדן היא הכלה של רפי'],
]
for (const [x, y, kind, desc] of NAMED) {
  const r = relationshipOf(x, y, people)
  if (r?.kind !== kind) errors.push(`קשר משפחתי שגוי — ${desc} (התקבל: ${r?.he ?? 'ללא קשר'})`)
}

// a sanity anchor: aliases still resolve
for (const [alias, id] of [['הדר', 'adar'], ['לאו', 'leo'], ['eilon', 'ayalon']] as const) {
  if (resolvePersonId(alias) !== id) errors.push(`הכינוי "${alias}" כבר לא מצביע על ${id}`)
}

if (errors.length) {
  console.error('\nשגיאות בקובץ המשפחה — הבנייה נעצרה:')
  for (const e of errors) console.error('  ✗ ' + e)
  process.exit(1)
}
console.log(`אימות המשפחה עבר: ${people.length} אנשים, כל הקשרים תקינים.`)

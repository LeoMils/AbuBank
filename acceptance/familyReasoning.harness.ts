/*
 * RC5 Family-Reasoning Acceptance Harness (deterministic, runnable).
 *
 * Drives the REAL engine `describeRelation` (src/screens/AbuAI/familyGraph.ts)
 * with relationship questions an 80-year-old would actually ask. Each case
 * asserts on a required kinship substring, or NULL where no representable
 * relation should exist.
 *
 * This is NOT a unit test mirroring the implementation. It encodes what
 * Martita expects to hear (ABUAI_IDENTITY_SPEC §6/§7), and is run across
 * RC5 loops to measure real improvement.
 *
 * Run: npx tsx acceptance/familyReasoning.harness.ts
 */
import { describeRelation } from '../src/screens/AbuAI/familyGraph'

type Sev = 1 | 2
interface Case {
  a: string
  b: string
  lang: 'he' | 'es' | 'en'
  // required substring in the answer, or 'NULL' to require no relation
  expect: string | 'NULL'
  kind: string
  sev: Sev
}

// Family ground truth (from knowledge/family_data.json):
//   Martita → children: Mor, Leo
//   Mor → Ofir, Ayalon(איילון), Eili(עילי), Adar ; partner Yael ; ex Rafi
//   Leo → Adi(עדי), Noam(נועם)
//   Ofir(m) spouse Gilad → children Anabel, Ari
//   Eili spouse Yarden
const CASES: Case[] = [
  // ── Direct (must already pass) ─────────────────────────────────────────
  { a: 'מרטיטה', b: 'מור', lang: 'he', expect: 'אמא', kind: 'parent', sev: 1 },
  { a: 'מור', b: 'אופיר', lang: 'he', expect: 'אמא', kind: 'parent', sev: 1 },
  { a: 'מור', b: 'לאו', lang: 'he', expect: 'אח', kind: 'siblings', sev: 1 },
  { a: 'עדי', b: 'נועם', lang: 'he', expect: 'אח', kind: 'siblings(twins)', sev: 2 },
  { a: 'אופיר', b: 'גלעד', lang: 'he', expect: 'נשואים', kind: 'spouse', sev: 1 },
  { a: 'מור', b: 'יעל', lang: 'he', expect: 'זוג', kind: 'partner', sev: 1 },
  { a: 'מור', b: 'רפי', lang: 'he', expect: 'גרושים', kind: 'ex', sev: 2 },
  { a: 'עילי', b: 'ירדן', lang: 'he', expect: 'נשואים', kind: 'spouse', sev: 2 },
  { a: 'רפי', b: 'לאו', lang: 'he', expect: 'גיסים', kind: 'in-law(former)', sev: 2 },
  { a: 'אנאבל', b: 'ארי', lang: 'he', expect: 'אח', kind: 'siblings', sev: 2 },

  // ── Grandparent one hop (must already pass) ────────────────────────────
  { a: 'מרטיטה', b: 'אופיר', lang: 'he', expect: 'סבתא', kind: 'grandparent', sev: 1 },
  { a: 'מור', b: 'אנאבל', lang: 'he', expect: 'סבתא', kind: 'grandparent', sev: 1 },

  // ── Great-grandparent (EXPECTED GAP at baseline) ───────────────────────
  { a: 'מרטיטה', b: 'אנאבל', lang: 'he', expect: 'רבתא', kind: 'great-grandparent', sev: 1 },
  { a: 'מרטיטה', b: 'ארי', lang: 'he', expect: 'רבתא', kind: 'great-grandparent', sev: 1 },

  // ── Aunt / uncle (EXPECTED GAP at baseline) ────────────────────────────
  { a: 'לאו', b: 'אופיר', lang: 'he', expect: 'דוד', kind: 'uncle', sev: 1 },
  { a: 'לאו', b: 'עילי', lang: 'he', expect: 'דוד', kind: 'uncle', sev: 1 },
  { a: 'מור', b: 'עדי', lang: 'he', expect: 'דוד', kind: 'aunt', sev: 1 },
  { a: 'מור', b: 'נועם', lang: 'he', expect: 'דוד', kind: 'aunt', sev: 1 },

  // ── Cousins (EXPECTED GAP at baseline) ─────────────────────────────────
  { a: 'אופיר', b: 'עדי', lang: 'he', expect: 'דוד', kind: 'cousins', sev: 1 },
  { a: 'עילי', b: 'נועם', lang: 'he', expect: 'דוד', kind: 'cousins', sev: 1 },
  { a: 'אדר', b: 'עדי', lang: 'he', expect: 'דוד', kind: 'cousins', sev: 2 },

  // ── Spanish / English coverage on key inferences ───────────────────────
  { a: 'מרטיטה', b: 'אופיר', lang: 'es', expect: 'abuela', kind: 'grandparent(es)', sev: 2 },
  { a: 'מרטיטה', b: 'אנאבל', lang: 'es', expect: 'bisabuela', kind: 'great-grandparent(es)', sev: 2 },
  { a: 'לאו', b: 'אופיר', lang: 'en', expect: 'uncle', kind: 'uncle(en)', sev: 2 },
  { a: 'אופיר', b: 'עדי', lang: 'es', expect: 'primo', kind: 'cousins(es)', sev: 2 },

  // ── Honest NULL (must NOT fabricate) ───────────────────────────────────
  { a: 'מירטה', b: 'אופיר', lang: 'he', expect: 'NULL', kind: 'friend≠family', sev: 1 },
  { a: 'שושנה', b: 'מור', lang: 'he', expect: 'NULL', kind: 'friend≠family', sev: 1 },
]

function run() {
  let pass = 0
  let fail = 0
  const failures: string[] = []
  for (const c of CASES) {
    const got = describeRelation(c.a, c.b, c.lang)
    let ok: boolean
    if (c.expect === 'NULL') ok = got === null
    else ok = !!got && got.includes(c.expect)
    if (ok) pass++
    else {
      fail++
      failures.push(
        `  FAIL [S${c.sev}] ${c.kind.padEnd(22)} ${c.a}→${c.b} (${c.lang})  ` +
        `expect:${c.expect}  got:${got === null ? 'NULL' : JSON.stringify(got)}`,
      )
    }
  }
  const sev1Fail = CASES.filter((c, i) => {
    const got = describeRelation(c.a, c.b, c.lang)
    const ok = c.expect === 'NULL' ? got === null : !!got && got.includes(c.expect)
    return !ok && c.sev === 1
  }).length

  console.log('─'.repeat(72))
  console.log(`RC5 FAMILY-REASONING HARNESS   total:${CASES.length}  pass:${pass}  fail:${fail}  sev1Fail:${sev1Fail}`)
  console.log('─'.repeat(72))
  if (failures.length) console.log(failures.join('\n'))
  else console.log('  ALL PASS')
  console.log('─'.repeat(72))
  // Non-zero exit only when a Sev-1 fails (Sev-1 is release-blocking).
  process.exitCode = sev1Fail > 0 ? 1 : 0
}

run()

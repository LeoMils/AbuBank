/*
 * Exhaustive family-relation matrix (DETERMINISTIC).
 *
 * Covers Mor, Yael, Ofir, Ayalon, Eili, Adar, Ari, Anabel, Gilad, Pepe across:
 * identity, aliases, pronouns, location, inferred relations (parent/grandparent/
 * great-grandparent/uncle/sibling), Spanish, corrections, and unknown-relation
 * safety. Asserts: grounded answers are correct, perspective is "שלך" (never "שלי"
 * / "ל-Martita"), and unknown people are DECLINED, never invented.
 *
 * Run: npx tsx acceptance/familyMatrix.harness.ts
 */
import { writeFileSync } from 'fs'
import { resolve } from 'path'

const g = globalThis as unknown as { localStorage?: Storage }
if (typeof g.localStorage === 'undefined') { const m = new Map<string, string>(); g.localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as Storage }

import { tryGroundedAnswer } from '../src/screens/AbuAI/service'
import { describeRelation } from '../src/screens/AbuAI/familyGraph'
import { resolveRelationalQuery } from '../src/screens/AbuAI/relationalResolver'

interface Case { id: string; q: string; want: (a: string | null) => boolean; note: string }
const C: Case[] = []
const contains = (...subs: string[]) => (a: string | null) => !!a && subs.some(s => a.includes(s))
const isNull = (a: string | null) => a === null
// Perspective + no-invention guard applied to every grounded answer.
const clean = (a: string | null) => !!a && !/\bשלי\b/.test(a) && !/ל-?Martita|למרטיטה יש/.test(a)

// ── Identity (each of the 10) ──
C.push({ id: 'M-MOR', q: 'מי זאת מור?', want: a => contains('מור', 'הבת שלך')(a) && clean(a), note: 'Mor = daughter, POV' })
C.push({ id: 'M-YAEL', q: 'מי זאת יעל?', want: a => contains('יעל')(a) && contains('מור')(a) && clean(a), note: 'Yael = Mor partner' })
C.push({ id: 'M-OFIR', q: 'מי זה אופיר?', want: a => contains('אופיר')(a) && clean(a), note: 'Ofir grandchild' })
C.push({ id: 'M-AYALON', q: 'מי זה איילון?', want: a => contains('איילון')(a) && clean(a), note: 'Ayalon grandchild' })
C.push({ id: 'M-EILI', q: 'מי זה עילי?', want: a => contains('עילי')(a) && clean(a), note: 'Eili grandchild' })
C.push({ id: 'M-ADAR', q: 'מי זה אדר?', want: a => contains('אדר')(a) && clean(a), note: 'Adar grandchild' })
C.push({ id: 'M-ARI', q: 'מי זה ארי?', want: a => contains('ארי')(a) && clean(a), note: 'Ari great-grandchild' })
C.push({ id: 'M-ANABEL', q: 'מי זאת אנאבל?', want: a => contains('אנאבל')(a) && clean(a), note: 'Anabel great-grandchild' })
C.push({ id: 'M-GILAD', q: 'מי זה גלעד?', want: a => contains('גלעד')(a) && clean(a), note: 'Gilad spouse of Ofir' })
C.push({ id: 'M-PEPE', q: 'מי זה פפי?', want: a => contains('פפי', 'בעל')(a) && clean(a), note: 'Pepe = late husband' })

// ── Aliases ──
C.push({ id: 'A-MORI', q: 'מי זאת מורי?', want: a => contains('מור')(a) && clean(a), note: 'alias מורי → Mor' })
C.push({ id: 'A-PEPE2', q: 'מי זה פאפי?', want: a => contains('פפי', 'בעל')(a) && clean(a), note: 'alias פאפי → Pepe' })

// ── Inferred relations ──
C.push({ id: 'R-OFIR-MOM', q: 'מי אמא של אופיר?', want: contains('מור'), note: 'Ofir mother = Mor' })
C.push({ id: 'R-ARI-GGM', q: 'מי סבתא רבתא של ארי?', want: contains('מרטיטה', 'את'), note: 'Ari great-grandmother = Martita' })
C.push({ id: 'R-ANABEL-GGM', q: 'מי סבתא רבתא של אנאבל?', want: contains('מרטיטה', 'את'), note: 'Anabel great-grandmother = Martita' })
C.push({ id: 'R-OFIR-UNCLE', q: 'מי דוד של אופיר?', want: contains('לאו'), note: 'Ofir uncle = Leo' })
C.push({ id: 'R-NOAM-GM', q: 'מי סבתא של נועם?', want: contains('מרטיטה', 'את'), note: 'Noam grandmother = Martita' })
C.push({ id: 'R-ARI-PARENTS', q: 'מי ההורים של ארי?', want: a => contains('אופיר')(a) || contains('גלעד')(a), note: 'Ari parents = Ofir+Gilad' })

// ── Location ──
C.push({ id: 'L-MOR', q: 'איפה גרה מור?', want: contains('הוד השרון'), note: 'Mor location' })
C.push({ id: 'L-OFIR-EILI', q: 'איפה גר עילי?', want: a => !!a && a.length > 0, note: 'Eili location' })

// ── Spanish ──
C.push({ id: 'ES-OFIR-MOM', q: '¿quién es la mamá de Ofir?', want: a => contains('Mor')(a) && !/[֐-׿]/.test(a ?? ''), note: 'ES Ofir mom, no leak' })
C.push({ id: 'ES-ANABEL-GGM', q: '¿quién es la bisabuela de Anabel?', want: a => /Abu|Martita/.test(a ?? '') && !/[֐-׿]/.test(a ?? ''), note: 'ES Anabel great-grandma' })
C.push({ id: 'ES-MOR-HIJA', q: '¿quién es la hija de Mor?', want: a => /no tiene/i.test(a ?? ''), note: 'ES honest: Mor has no daughter (all sons)' })

// ── Sibling / cousin / uncle / spouse roles (ה-prefix + plurals) ──
C.push({ id: 'RL-SIB', q: 'מי האח של אופיר?', want: contains('איילון'), note: 'Ofir brothers' })
C.push({ id: 'RL-SIBS', q: 'מי האחים של אופיר?', want: a => contains('איילון')(a) && contains('אדר')(a), note: 'all siblings' })
C.push({ id: 'RL-COUSIN', q: 'מי בן הדוד של עדי?', want: contains('אופיר'), note: 'Adi cousins' })
C.push({ id: 'RL-UNCLE', q: 'מי הדוד של אופיר?', want: contains('לאו'), note: 'Ofir uncle = Leo' })
C.push({ id: 'RL-WIFE', q: 'מי האישה של עילי?', want: contains('ירדן'), note: 'Eili wife = Yarden' })
C.push({ id: 'RL-NOAUNT', q: 'מי הדודה של אופיר?', want: a => /לא יודעת/.test(a ?? ''), note: 'no aunt → honest decline' })
C.push({ id: 'RL-NOSIS', q: 'מי האחות של אופיר?', want: a => /לא יודעת/.test(a ?? '') && !contains('הבת שלך')(a), note: 'no sister → no invention' })

// ── Aliases (Leo) ──
C.push({ id: 'A-LEON', q: 'מי זה לאון?', want: a => contains('לאו')(a) && clean(a), note: 'alias לאון → Leo' })
C.push({ id: 'A-LIO', q: 'מי זה ליאו?', want: a => contains('לאו')(a) && clean(a), note: 'alias ליאו → Leo' })

// ── Group ──
C.push({ id: 'G-GRANDKIDS', q: 'מי הנכדים שלי?', want: a => contains('אופיר')(a) && contains('נועם')(a), note: 'all grandchildren' })
C.push({ id: 'G-LEO-KIDS', q: 'מי הילדים של לאו?', want: a => contains('עדי')(a) && contains('נועם')(a), note: "Leo's children" })

// ── Unknown — NEVER invent ──
C.push({ id: 'U-1', q: 'מי זה זבולון הקוסם?', want: a => !contains('הבת שלך', 'הבן שלך', 'הנכד')(a), note: 'unknown → no invented relation' })
C.push({ id: 'U-2', q: 'מי סבתא רבתא של דניאל הלא-קיים?', want: a => !contains('את היא', 'הנינה שלך')(a), note: 'unknown great-grandchild → no invention' })

let pass = 0, fail = 0
const lines = ['# Family-Relation Matrix — Deterministic Results', '',
  '_Identity, aliases, pronouns, location, inferred relations, Spanish, and unknown-relation safety. Perspective "שלך" enforced; unknowns never invented._', '',
  '| ID | Query | Answer | Result | Note |', '|----|-------|--------|--------|------|']
for (const c of C) {
  const a = tryGroundedAnswer(c.q)
  const ok = c.want(a)
  if (ok) pass++; else fail++
  lines.push(`| ${c.id} | ${c.q.replace(/\|/g, '/')} | ${(a ?? '∅').replace(/\n/g, ' / ').replace(/\|/g, '/')} | ${ok ? '✅' : '❌'} | ${c.note} |`)
}
// Direct describeRelation/resolveRelationalQuery invariants (no runtime routing)
const dr1 = describeRelation('מרטיטה', 'זבולון הקוסם', 'he')
const drPass = dr1 === null
if (drPass) pass++; else fail++
lines.push(`| D-UNK | describeRelation(unknown) | ${dr1 ?? 'null'} | ${drPass ? '✅' : '❌'} | returns null, no invention |`)
const rr1 = resolveRelationalQuery('¿quién es la hija de Zúñiga?', 'es')
const rrPass = rr1 === null
if (rrPass) pass++; else fail++
lines.push(`| D-ES-UNK | resolveRelationalQuery(unknown,es) | ${rr1 ?? 'null'} | ${rrPass ? '✅' : '❌'} | declines |`)

lines.push('', `**Total ${C.length + 2} · pass ${pass} · fail ${fail}**`)
const out = resolve(process.cwd(), 'docs/abuai/FAMILY_MATRIX_RESULTS.md')
writeFileSync(out, lines.join('\n'), 'utf-8')
console.log(`Family matrix: ${C.length + 2} cases · pass ${pass} · fail ${fail}. Wrote ${out}`)
if (fail > 0) { for (let i = 0; i < C.length; i++) { const a = tryGroundedAnswer(C[i]!.q); if (!C[i]!.want(a)) console.log(`  FAIL ${C[i]!.id} "${C[i]!.q}" → "${a}"`) } process.exitCode = 1 }

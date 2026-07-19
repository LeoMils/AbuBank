/*
 * THE LAWS — family-universe invariants enforced at the WRITE GATE (Constitution §2).
 * ════════════════════════════════════════════════════════════════════════════════
 * A contradiction can no longer ENTER the ledger — not merely be caught later. Every
 * write, from ANY source (in-flow confirmation, explicit "תזכרי ש…", Leo's manual
 * upload), passes through `applyChange`, which runs the invariant suite on the SIMULATED
 * post-change state and REJECTS violations at the gate with a one-line Hebrew reason.
 *
 * Pure + deterministic (no I/O). The ledger is the single state; the write gate is the
 * only door. Symmetry (spouse↔spouse, parent↔child) is maintained BY CONSTRUCTION here,
 * so an asymmetric edge cannot be produced in the first place.
 */
export type Gender = 'male' | 'female' | 'unknown'

export interface LedgerPerson {
  id: string
  name: string
  gender: Gender
  /** YYYY-MM-DD when known. Ages are ALWAYS computed from this — never stored (§L6). */
  birthdate?: string
  parents: string[]
  spouses: string[]
  exSpouses: string[]
  aliases: string[]
}
export type Ledger = Map<string, LedgerPerson>

export type Change =
  | { op: 'addPerson'; person: LedgerPerson & { age?: never } }
  | { op: 'addParent'; child: string; parent: string }
  | { op: 'addSpouse'; a: string; b: string }
  | { op: 'divorce'; a: string; b: string }
  | { op: 'addSibling'; a: string; b: string }
  | { op: 'setBirthdate'; id: string; birthdate: string }

export interface Violation { law: string; message: string }
export interface LawResult { ok: boolean; violations: Violation[] }
export interface WriteResult { ok: boolean; ledger: Ledger; violations: Violation[]; log: string | null }

const clone = (l: Ledger): Ledger => new Map([...l].map(([k, v]) => [k, { ...v, parents: [...v.parents], spouses: [...v.spouses], exSpouses: [...v.exSpouses], aliases: [...v.aliases] }]))
const has = (l: Ledger, id: string) => l.has(id)
const person = (l: Ledger, id: string) => l.get(id)
const uniq = (a: string[]) => [...new Set(a)]

/** Every name (canonical + aliases), lowercased, this ledger already answers to → id. */
function nameIndex(l: Ledger): Map<string, string> {
  const m = new Map<string, string>()
  for (const p of l.values()) for (const n of [p.name, ...p.aliases]) m.set(n.trim().toLowerCase(), p.id)
  return m
}

/** All ancestors of `id` (walking parents transitively). */
function ancestors(l: Ledger, id: string, seen = new Set<string>()): Set<string> {
  const p = person(l, id)
  if (!p) return seen
  for (const par of p.parents) if (!seen.has(par)) { seen.add(par); ancestors(l, par, seen) }
  return seen
}

// ── the write gate: check every law on the simulated post-change state ──────────
export function checkLaws(ledger: Ledger, change: Change): LawResult {
  const v: Violation[] = []
  const add = (law: string, message: string) => v.push({ law, message })

  switch (change.op) {
    case 'addPerson': {
      const p = change.person
      if ((p as { age?: unknown }).age !== undefined) add('L6:age-from-birthdate', `לא שומרים גיל — רק תאריך לידה (מחושב מהתאריך).`)
      const idx = nameIndex(ledger)
      for (const n of [p.name, ...p.aliases]) {
        const hit = idx.get(n.trim().toLowerCase())
        if (hit && hit !== p.id) { add('L5:one-identity', `"${p.name}" כבר קיים כ${person(ledger, hit)!.name} — צריך שאלת הבהרה אחת לפני הוספה.`); break }
      }
      if (p.birthdate && !/^\d{4}-\d{2}-\d{2}$/.test(p.birthdate) && !/^\d{2}-\d{2}$/.test(p.birthdate)) add('L6:birthdate-format', `תאריך לידה לא תקין: ${p.birthdate}.`)
      break
    }
    case 'addParent': {
      const { child, parent } = change
      if (!has(ledger, child) || !has(ledger, parent)) { add('L0:unknown', `אחד מהאנשים לא קיים בקובץ.`); break }
      if (child === parent) { add('L8:no-self', `אדם לא יכול להיות ההורה של עצמו.`); break }
      // §L2 no parenthood cycle: parent must not be a descendant of child.
      if (ancestors(ledger, parent).has(child) || child === parent) add('L2:no-cycle', `זה יוצר לולאה: ${parent} כבר צאצא של ${child}.`)
      // §L4 parent older than child.
      const c = person(ledger, child)!, pa = person(ledger, parent)!
      if (c.birthdate && pa.birthdate && cmpDate(pa.birthdate, c.birthdate) >= 0) add('L4:parent-older', `${parent} לא יכול להיות הורה של ${child} — לא מבוגר ממנו.`)
      break
    }
    case 'addSpouse': {
      const { a, b } = change
      if (!has(ledger, a) || !has(ledger, b)) { add('L0:unknown', `אחד מהאנשים לא קיים בקובץ.`); break }
      if (a === b) { add('L8:no-self', `אדם לא יכול להיות נשוי לעצמו.`); break }
      const pa = person(ledger, a)!, pb = person(ledger, b)!
      // §L7 monogamy: neither may already have a DIFFERENT current spouse.
      const otherA = pa.spouses.find((s) => s !== b)
      const otherB = pb.spouses.find((s) => s !== a)
      if (otherA) add('L7:spouse-conflict', `${a} כבר נשוי/ה ל${otherA} — צריך קודם גירושין.`)
      if (otherB) add('L7:spouse-conflict', `${b} כבר נשוי/ה ל${otherB} — צריך קודם גירושין.`)
      // A spouse cannot also be an ancestor/descendant.
      if (ancestors(ledger, a).has(b) || ancestors(ledger, b).has(a)) add('L7:incest-guard', `${a} ו${b} הם הורה־צאצא — לא יכולים להיות נשואים.`)
      break
    }
    case 'addSibling': {
      const { a, b } = change
      if (!has(ledger, a) || !has(ledger, b)) { add('L0:unknown', `אחד מהאנשים לא קיים בקובץ.`); break }
      if (a === b) { add('L8:no-self', `אדם לא יכול להיות אח/ות של עצמו.`); break }
      const pa = person(ledger, a)!, pb = person(ledger, b)!
      // §L3 siblings share parents: if BOTH already have parents, they must overlap.
      if (pa.parents.length && pb.parents.length && !pa.parents.some((x) => pb.parents.includes(x)))
        add('L3:siblings-share-parents', `${a} ו${b} לא חולקים הורה — לא יכולים להיות אחים.`)
      break
    }
    case 'setBirthdate': {
      const { id, birthdate } = change
      if (!has(ledger, id)) { add('L0:unknown', `${id} לא קיים בקובץ.`); break }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate) && !/^\d{2}-\d{2}$/.test(birthdate)) { add('L6:birthdate-format', `תאריך לידה לא תקין: ${birthdate}.`); break }
      // §L4 stays consistent: not younger than a child, not older than a parent.
      const p = person(ledger, id)!
      for (const cid of childrenOf(ledger, id)) { const c = person(ledger, cid)!; if (c.birthdate && cmpDate(birthdate, c.birthdate) >= 0) add('L4:parent-older', `${id} לא יכול להיוולד אחרי ${cid}.`) }
      for (const par of p.parents) { const pp = person(ledger, par)!; if (pp.birthdate && cmpDate(pp.birthdate, birthdate) >= 0) add('L4:parent-older', `${id} לא יכול להיוולד לפני ${par}.`) }
      break
    }
    case 'divorce': break // always allowed structurally
  }
  return { ok: v.length === 0, violations: v }
}

function childrenOf(l: Ledger, id: string): string[] {
  return [...l.values()].filter((p) => p.parents.includes(id)).map((p) => p.id)
}
/** Compare two dates (YYYY-MM-DD or MM-DD). Returns <0 if a<b, 0 if equal, >0 if a>b. */
function cmpDate(a: string, b: string): number {
  const norm = (d: string) => (d.length === 5 ? `0000-${d}` : d)
  return norm(a) < norm(b) ? -1 : norm(a) > norm(b) ? 1 : 0
}

/** THE WRITE GATE. Symmetry is maintained by construction. Returns the (unchanged) ledger
 *  + one-line reason on rejection, or the new ledger + one-line log on accept. */
export function applyChange(ledger: Ledger, change: Change): WriteResult {
  const res = checkLaws(ledger, change)
  if (!res.ok) return { ok: false, ledger, violations: res.violations, log: null }
  const next = clone(ledger)
  const link = (aId: string, bId: string, field: 'parents' | 'spouses' | 'exSpouses') => {
    const p = next.get(aId); if (p && !p[field].includes(bId)) p[field] = uniq([...p[field], bId])
  }
  switch (change.op) {
    case 'addPerson': next.set(change.person.id, { ...change.person, parents: [...change.person.parents], spouses: [...change.person.spouses], exSpouses: [...change.person.exSpouses], aliases: [...change.person.aliases] }); break
    case 'addParent': link(change.child, change.parent, 'parents'); break // child→parent; children derived
    case 'addSpouse': link(change.a, change.b, 'spouses'); link(change.b, change.a, 'spouses'); break // symmetric
    case 'divorce': {
      const pa = next.get(change.a), pb = next.get(change.b)
      if (pa) { pa.spouses = pa.spouses.filter((s) => s !== change.b); pa.exSpouses = uniq([...pa.exSpouses, change.b]) }
      if (pb) { pb.spouses = pb.spouses.filter((s) => s !== change.a); pb.exSpouses = uniq([...pb.exSpouses, change.a]) }
      break
    }
    case 'addSibling': { // materialize via shared parents (siblings share parents §L3)
      const pa = next.get(change.a)!, pb = next.get(change.b)!
      const shared = uniq([...pa.parents, ...pb.parents])
      pa.parents = shared; pb.parents = shared
      break
    }
    case 'setBirthdate': { const p = next.get(change.id); if (p) p.birthdate = change.birthdate; break }
  }
  return { ok: true, ledger: next, violations: [], log: describeChange(change) }
}

/** One-line human log for the ledger's change history (§1: every change logged + undoable). */
export function describeChange(c: Change): string {
  switch (c.op) {
    case 'addPerson': return `נוסף/ה ${c.person.name}`
    case 'addParent': return `${c.parent} הורה של ${c.child}`
    case 'addSpouse': return `${c.a} ו${c.b} נשואים`
    case 'divorce': return `${c.a} ו${c.b} התגרשו`
    case 'addSibling': return `${c.a} ו${c.b} אחים`
    case 'setBirthdate': return `תאריך לידה של ${c.id}: ${c.birthdate}`
  }
}

export interface BatchEntry { change: Change; accepted: boolean; reason: string }
/** A manual upload / multi-fact write: apply changes one by one, returning a one-line diff
 *  per change (§ Truth Loop proof f). A rejected change never mutates the ledger. */
export function applyBatch(ledger: Ledger, changes: Change[]): { ledger: Ledger; diff: BatchEntry[] } {
  let cur = ledger
  const diff: BatchEntry[] = []
  for (const change of changes) {
    const r = applyChange(cur, change)
    if (r.ok) { cur = r.ledger; diff.push({ change, accepted: true, reason: r.log! }) }
    else diff.push({ change, accepted: false, reason: r.violations.map((x) => x.message).join(' ') })
  }
  return { ledger: cur, diff }
}

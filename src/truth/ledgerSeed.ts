/*
 * Seed the truth ledger from the REAL family graph (single source: familyGraph).
 * The laws then operate on real people, so a planted contradiction is planted against
 * the real universe — not a toy fixture.
 */
import { loadGraph } from '../screens/AbuAI/familyGraph'
import type { Ledger, LedgerPerson } from './familyLaws'

export function seedLedgerFromGraph(): Ledger {
  const l: Ledger = new Map<string, LedgerPerson>()
  for (const n of loadGraph()) {
    l.set(n.hebrew, {
      id: n.hebrew,
      name: n.hebrew,
      gender: n.gender,
      parents: [...n.parentsHe],
      spouses: [...n.spousesHe],
      exSpouses: [...n.exSpousesHe],
      aliases: [...n.aliases, n.canonical].filter(Boolean),
    })
  }
  return l
}

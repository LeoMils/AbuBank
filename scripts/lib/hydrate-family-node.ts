/*
 * hydrate-family-node.ts — hydrate familyData.ts for BUILD/CLI scripts.
 * ════════════════════════════════════════════════════════════════════════════
 * The private family dataset is no longer statically imported by runtime modules
 * (it is served from /api/family). Build-time scripts (validate-people, eval,
 * probes) that call peopleModel/familyLoader still need it in memory. Scripts are
 * NOT part of the client bundle, so importing the JSON here is safe — this file
 * is never reachable from src/main.tsx.
 */
import familyData from '../../knowledge/family_data.json'
import { hydrateFamily, type FamilyRaw } from '../../src/services/familyData'

hydrateFamily(familyData as unknown as FamilyRaw)

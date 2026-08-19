/*
 * hydrateFamily.ts — vitest setupFile (NOT part of the app/production bundle).
 * ════════════════════════════════════════════════════════════════════════════
 * The private family dataset is no longer statically imported by any runtime
 * module (it is served at runtime from the authenticated /api/family). Tests,
 * however, exercise family reasoning directly and need the data present. This
 * setupFile — referenced only from vitest.config.ts — hydrates familyData.ts
 * from the JSON + abu-family.md before each test file runs. Because it is a
 * test-only file, it never reaches the client bundle.
 */
import familyData from '../../knowledge/family_data.json'
import abuFamilyMd from '../../knowledge/abu-family.md?raw'
import { hydrateFamily, type FamilyRaw } from '../services/familyData'

hydrateFamily(familyData as unknown as FamilyRaw, abuFamilyMd)

# Private family data — bundle exposure status

## 1) knowledge/family_data.json — MIGRATED (0.294.0-privauth)
The ~70-person structured family dataset is **no longer bundled** into the public client.

- No client-runtime module statically imports it (proven by `familyBundlePrivacy.test.ts`).
- Served only from the **authenticated** `/api/family` (`guardBillable`: 401 unauthenticated,
  503 if production-misconfigured), with `Cache-Control: private, no-store`; the service worker
  never caches it (`runtimeCaching: []`). Proven by `api/familyEndpoint.test.ts`.
- The client hydrates it at boot from `/api/family` + a **device-local IndexedDB** copy
  (`familyHydration.ts`) for offline — never a public/cacheable asset.
- Empirical proof: `node scripts/scan-bundle-privacy.mjs dist` →
  `FAMILY_DATA_JSON_DATASET: ABSENT (clean)` (markers pii_excluded/resolved_notes/open_questions absent).
- All family reasoning / aliases / relationships / birthdays / calendar / whatsapp behaviour is
  preserved (full suite green; tests hydrate via the `src/test/hydrateFamily.ts` setup file).

Refactored consumers: `familyLoader`, `liveInstructions` (+ `getAbuFamily()`), `liveContacts`,
`people/peopleModel`, `qa/scopeInventory`, `AbuCalendar/familyEvents` → all read `getFamilyRaw()`.

## 2) familyContacts.private.ts (WhatsApp contacts seed) — RESIDUAL (separate source)
Discovered during the audit: `src/screens/AbuWhatsApp/familyContacts.private.ts` (the contacts-board
scaffold, ~36 people with names + photo ids) is a **different** private-data source that is still
bundled. `scan-bundle-privacy.mjs` reports it (`PUBLIC_PRIVATE_DATA_EXPOSURES: 1`).

**Why not in this pass (materially larger):** `FAMILY_QUICK_FACES` is imported by 7 client modules
(`familyQuickFaces`, `familyContactsStorage`, `ContactManagement`, `FamilyContactsSetup`, `index`,
`VoiceCompose`, `whatsappAdapter`) with ~15 **module-top** usages (`SEED_PERSON_FACES`,
`FAMILY_GROUP_FACE`, `DEFAULT_SEED_CONTACTS`) and drives **offline-first first-run seeding** of the
contacts board. Moving it behind auth is a separate refactor with real regression surface on the
WhatsApp contacts feature; rushing it alongside the family_data.json + auth-replay work would risk
that feature and a red recert.

**Migration plan (next pass):**
1. Serve the seed from `/api/family` (extend the payload) behind the same session.
2. Route the 7 importers through a hydrated `getQuickFaces()` accessor; convert the module-top
   consts (`FAMILY_GROUP_FACE`, `SEED_PERSON_FACES`, `DEFAULT_SEED_CONTACTS`) to lazy getters.
3. First-run seeding happens **after auth** (post-hydration); persist to IndexedDB for offline.
4. Extend `scan-bundle-privacy.mjs` to require the contacts names absent too; add a bundle test.
5. Re-run WhatsApp acceptance + the contacts-storage suite; fresh RC + Monster recert.

Until then: `PUBLIC_PRIVATE_DATA_EXPOSURES = 1` (the contacts seed). The owner-approved direction is
**migrate** (not public-by-policy).

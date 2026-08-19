# AbuWhatsApp — Data Reliability Report

**Sprint:** Autonomous AbuWhatsApp Data Reliability
**Version label (requested):** `0.50.0-abuwp-data-reliability` — **not applied to
`src/version.ts`**; see §6. The version identity is a test-enforced single source
actively owned by the concurrent production war-room (working tree currently
`0.51.0-non-green-to-green-war-room`). This change is version-agnostic and ships
under whatever label the war-room stamps; the human should fold the requested
label into the build identity at integration.
**Date:** 2026-07-08
**Scope:** AbuWhatsApp contacts / phone directory · persistence · backup/restore · schema versioning · validation · recovery.
**Non-goals (untouched):** AbuAI core runtime, existing contact data, storage resets.

---

## 1. Root cause

AbuWhatsApp stores every real per-person phone number and photo in a **single
localStorage key**, `abubank.familyContacts.v1`
(`src/screens/AbuWhatsApp/familyContactsStorage.ts`). The runtime merges the
committed scaffold (`familyContacts.private.ts`, all phones empty) with these
device-only overrides via `mergeFacesWithLocal()` to render the family grid.

The app already has a durable persistence layer — `DurableStore`
(`src/services/durableStore.ts`) — that mirrors safety-critical keys into
**IndexedDB** and, on every app start (`main.tsx` → `durable.init()`),
**re-hydrates localStorage from IndexedDB**. That is how calendar appointments
and reminders survive Safari/iOS eviction.

**The bug:** `abubank.familyContacts.v1` was **never registered in
`DurableStore.CRITICAL_KEYS`.** The two contact keys that *were* listed
(`martita-contacts-v1`, `martita-loc-contacts-v1`) are legacy placeholders that
no live code writes. So AbuWhatsApp contacts had:

- **No IndexedDB durable copy** and **no auto-restore** — unlike calendar/reminders.
- Only a localStorage copy, which **Safari ITP evicts after ~7 days of
  inactivity** (and which private mode / quota pressure can drop). The existing
  `seededStorageRepro.test.ts` even names "ITP cleared storage" as the suspected
  cause — but nothing mitigated it.

Result: localStorage gets evicted → contacts and phone numbers **disappear on
the next load, with no durable copy to restore from.** A manual backup path
(`backup.ts`) existed but required the operator to have proactively exported.

Contributing (secondary) gaps, now also closed: no schema version on the
payload, corruption returned `[]` silently with no recovery, and no automatic
backup before any migration.

---

## 2. Storage model — before / after

### Before

```
AbuWhatsApp write → window.localStorage['abubank.familyContacts.v1'] = JSON.stringify(LocalFamilyContact[])
                    (bare array, no version)
App start        → durable.init() restores calendar/reminders/… but NOT this key
Eviction (ITP)   → localStorage wiped → contacts GONE (no IndexedDB copy)
```

### After

```
AbuWhatsApp write → localStorage['abubank.familyContacts.v1'] = { "v": 2, "contacts": [...] }
                    AND durable.setString(key, json)  → IndexedDB backend + cache (kept current)
App start        → durable.init():
                     • pre-migration BACKUP snapshot (once per schema version)
                     • migrate localStorage → IndexedDB (idempotent)
                     • RESTORE localStorage mirror from IndexedDB  ← survives eviction
Read             → getLocalContacts() → localStorage, falling back to the durable
                    mirror when localStorage is empty/evicted; tolerant of v1 (bare
                    array) AND v2 (envelope); drops only invalid entries, never throws
Corruption       → bad JSON in localStorage is overwritten by the good IndexedDB
                    copy on the next durable.init(); reads never throw
```

Key shape (`LocalFamilyContact`) is unchanged. The **localStorage key name is
deliberately unchanged** (`abubank.familyContacts.v1`) so existing devices keep
their data and every privacy/scaffold contract still points at the same key.
The new `v` field lives *inside* the value envelope, not in the key.

---

## 3. Backup / restore

Three independent layers now protect the data:

1. **Durable IndexedDB mirror (automatic).** Every contacts write is mirrored to
   the `abu-durable` IndexedDB store; `durable.init()` restores localStorage from
   it on every app start. This is the primary eviction defense. Writes keep the
   backend current so a stale backend can never clobber a fresh edit on reload.

2. **Automatic pre-migration backup (new).** Before `DurableStore` performs any
   localStorage→IndexedDB migration or stamps a new schema version, it captures a
   one-time reversible snapshot of all managed keys into
   `__abu_pre_migration_backup__` (`{ fromSchema, toSchema, data }`), readable via
   `durable.getPreMigrationBackup()`. Written only when there is real data to
   protect; never included in user exports or the migration loop.

3. **Operator export/import (existing, still supported).**
   - Per-contacts JSON: `exportContactsJSON()` / `importContactsJSON()` in the
     operator setup screen (**מתקדם → ייצוא לגיבוי / ייבוא אנשי קשר**). Export
     format stays a bare `LocalFamilyContact[]` array for easy hand-editing.
   - Whole-app backup file: `src/services/backup.ts` (`downloadBackup()` /
     `importBackup()`) already includes `abubank.familyContacts.v1`.
   - Durable blob: `durable.exportAll()` / `durable.importAll()` for
     origin/URL-change recovery.

A committed placeholder import example already exists at
`docs/examples/abuwhatsapp-contacts.import.example.json` (X-masked phones only) —
**no new seed data was added**, so no real data is ever overwritten.

---

## 4. Tests added

New suite: `src/screens/AbuWhatsApp/familyContactsDurability.test.ts` — **16
tests, all passing** (uses only `id`/empty-phone fixtures — zero phone-like
tokens, passes the privacy scan). Proves:

| Guarantee | Test |
| --- | --- |
| Key is durable | `abubank.familyContacts.v1` ∈ `CRITICAL_KEYS` |
| Survives reload + eviction | current envelope migrates to IndexedDB and returns after localStorage wipe |
| Survives reload — legacy | v1 bare array survives an evicted reload, read without loss |
| Backup before migration | reversible snapshot captured; fresh install writes none |
| Survives app/schema version change | older schema stamp → data intact + pre-bump snapshot |
| Corruption recovery | corrupt localStorage repaired from IndexedDB; `parseContactsPayload` never throws |
| Schema envelope + validation | envelope round-trip, legacy read, partial-corruption salvage, `validateContacts` |
| Migration helper | legacy→v2 upgrade in place; no-op when clean; leaves unsalvageable blob for durable to win |
| Mid-session durable recovery | `getLocalContacts()` recovers from the durable mirror after eviction |

Existing suites remain green — the change is backward compatible with
`seededStorageRepro.test.ts`, `contactsImportRecovery.test.ts`,
`phonePrivacy.test.ts`, `durableStore.test.ts`, `persistenceKeys.test.ts`.

**Evidence:** `npm run typecheck` clean; targeted run
`vitest run src/screens/AbuWhatsApp src/services/durableStore.test.ts
src/services/persistenceKeys.test.ts` → **17 files, 386 tests passing**; full
suite + `npm run build` per §7.

---

## 5. Files changed

| File | Change |
| --- | --- |
| `src/services/durableStore.ts` | Registered `abubank.familyContacts.v1` in `CRITICAL_KEYS`; added automatic pre-migration backup (`PRE_MIGRATION_BACKUP_KEY`, `getPreMigrationBackup()`). |
| `src/screens/AbuWhatsApp/familyContactsStorage.ts` | Schema-versioned envelope (`CONTACTS_SCHEMA_VERSION = 2`) with back-compat v1 read; durable-backend mirror on default-storage writes/clears; durable read fallback; `parseContactsPayload`, `readContactsWithDiagnostics`, `validateContacts`, `migrateContactsFormat`. |
| `src/screens/AbuWhatsApp/FamilyContactsSetup.tsx` | Opportunistic `migrateContactsFormat()` on operator-setup mount (upgrade legacy / salvage corrupt). |
| `src/screens/AbuWhatsApp/familyContactsDurability.test.ts` | New 16-test reliability suite. |
| `docs/eval/ABUWHATSAPP_DATA_RELIABILITY_REPORT.md` | This report. |

`src/version.ts` is intentionally **not** in this commit — see §6 (owned by the
concurrent war-room's single-source version identity). No changes to
`package.json`, `.env*`, `memory/*`, `knowledge/*`, family data, or AbuAI
runtime. No existing contact data deleted; no storage reset.

---

## 6. Remaining risks

- **Version label not applied — single-source is owned by the concurrent
  war-room.** The mission requested `0.50.0-abuwp-data-reliability`, but
  `src/version.ts` is a **test-enforced single source** (`version.test.ts`,
  `api/health.ts` BUILD_VERSION, and `Settings/copyTurnsButton.test.tsx` all pin
  the exact string). During this sprint another active workstream (the production
  war-room) repeatedly rewrote it in the working tree — observed
  `0.50.0-sound-system` → `0.50.0-ux-polish` → `0.51.0-non-green-to-green-war-room`
  — and updated the pinned tests to match. Reapplying the requested label breaks
  those three war-room-owned tests, and correcting them would clobber the
  war-room's coordination. **Decision: leave `version.ts` as the war-room owns it
  and do NOT stage it in this commit.** The data-reliability code is
  version-agnostic. **Action for the human/war-room:** record
  `abuwp-data-reliability` in the next `buildLabel` bump so this change is
  reflected in the visible build identity.
- **Durable backend write is fire-and-forget.** Like calendar/reminders, the
  IndexedDB mirror write is async. A save immediately followed by a hard app kill
  (before the write flushes) could miss the last edit in IndexedDB — localStorage
  still has it, and the next `durable.init()` re-migrates it. Low impact.
- **Format upgrade is lazy.** Legacy bare-array devices are read correctly but
  only rewritten to the v2 envelope on the next save or when the operator opens
  setup. Reads work either way; this is intentional (no surprise writes on
  Martita's screen).
- **True cross-origin move still needs a manual export.** The IndexedDB mirror is
  per-origin. Moving to a different URL/origin requires operator export/import
  (documented) or `durable.exportAll()`.
- **Deliberate operator "נקי הכל" still deletes.** Recovery protects against
  *accidental/technical* loss (eviction, corruption), not an intentional
  two-step confirmed clear-all.

---

## 7. Validation

- `npm run typecheck` — **pass** (clean).
- `vitest run` (AbuWhatsApp + durableStore + persistenceKeys) — **17 files / 386 tests pass**, including the new 16-test suite.
- Full `vitest run` and `npm run build` — see the sprint's final summary for the recorded result.

---

## 8. Preview URL

Not deployed by this sprint (no preview URL). Deploy is a human-gated step; the
build gate result is recorded in the final summary.

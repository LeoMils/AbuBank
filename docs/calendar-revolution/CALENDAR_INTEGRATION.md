# CALENDAR_INTEGRATION — Phase 4 Integration Intelligence

Branch: `feat/calendar-revolution`. Scope: READ-ONLY investigation of scope item **(e)** — re-source the hard-coded family birthdays/memorials from `knowledge/family_data.json`. No source files were modified; the only write is this deliverable. All claims carry `file:line` evidence. Investigation language only ("found", "confirmed by grep at", "no evidence of", "requires") — nothing is claimed fixed/working/verified-passing.

Anchors confirmed against live source (read 2026-05-25):
- `FAMILY_BIRTHDAYS` array at `service.ts:344-367` (16 entries), `FAMILY_MEMORIALS` at `service.ts:369-372` (1 entry). Comment "hardcoded from memory/birthdays_registry.yaml" at `service.ts:340`.
- `loadAppointmentsWithFamily(viewYear?)` at `service.ts:375-395` merges both, regenerating dates/ids per viewed year and de-duping against user appts.
- `Appointment` shape confirmed at `service.ts:3-17`.

---

## 1. Runtime consumption of birthdays — call sites

**`loadAppointmentsWithFamily` runtime callers (confirmed by grep):**

Calendar screen (runtime):
- `src/screens/AbuCalendar/index.tsx:5` — import.
- `index.tsx:70` — initial `useState` seed: `loadAppointmentsWithFamily(todayDate.getFullYear())`.
- `index.tsx:153` — `reload` callback for the viewed `year`.
- `index.tsx:158` — `useEffect` reload when `year` changes.
- `index.tsx:163` — `loadAppointmentsWithFamily()` (no arg → current year) inside the alert-scan effect.

AbuAI tools (runtime — read-only consumer of the calendar service):
- `src/screens/AbuAI/tools.ts:2` import; called at `tools.ts:81, 88, 95, 117, 125, 137, 151, 169` inside `getTodayEvents`/`getTomorrowEvents`/`getWeekEvents`/`getUpcomingEvents`/`findEventsByPerson`/`findNextEventByType`/`getEventsByDate`/`getEventsByMonth`.

Test (NOT runtime):
- `src/screens/AbuAI/runtimeProof.test.ts:6, 62`.

**`FAMILY_BIRTHDAYS` references:**
- Runtime: `tools.ts:3` (import), `tools.ts:186` (`getBirthdayFor` searches it directly).
- Definition + internal use: `service.ts:344`, `service.ts:380`.
- Test: `service.test.ts:10, 64-88`.

**`FAMILY_MEMORIALS` references:**
- Runtime: `tools.ts:4` (import), `tools.ts:210` (`getMemorialFor`).
- Definition + internal use: `service.ts:369`, `service.ts:385`.
- Test: `service.test.ts:11, 90-100`.

**Where birthdays are actually rendered in the running app:** the merged array from `loadAppointmentsWithFamily` flows into `appointments` state (`index.tsx:70`) and is rendered as calendar dots and the selected-day `ApptCard` list (per CALENDAR_AUDIT §2, `index.tsx:952-1086`). AbuAI additionally surfaces them in spoken/text answers via `tools.ts` (e.g. `getBirthdayFor` `tools.ts:184-206`, `getMemorialFor` `tools.ts:208-220`).

**Conclusion:** scope (e) touches TWO runtime consumers — the calendar screen (via `loadAppointmentsWithFamily`) and AbuAI `tools.ts` (via both `loadAppointmentsWithFamily` AND the direct `FAMILY_BIRTHDAYS`/`FAMILY_MEMORIALS` array imports at `tools.ts:3-4, 186, 210`). Any migration that removes the exported arrays must also address `tools.ts:186` and `tools.ts:210`, or those AbuAI tools break.

---

## 2. Is `memory/birthdays_registry.yaml` consumed at runtime?

**No — no evidence of any runtime read.** Grep of `src/`, `scripts/`, `vite.config.ts`, and `tsconfig*.json` for `birthdays_registry` returns exactly ONE hit: the comment at `service.ts:340` ("hardcoded from memory/birthdays_registry.yaml"). It is a provenance note, not an import.

Broader grep of `memory/` in `src/` finds only: an AbuAI test string (`jointOptimizationContract.test.ts:208`), AbuWhatsApp privacy comments/tests (`familyContactsStorage.ts:6`, `FamilyContactsSetup.tsx:8`, `familyContacts.private.ts:7`, `phonePrivacy.test.ts:142-148`), and the same `service.ts:340` comment. **No `import` or `fetch` of any `memory/*.yaml` anywhere in runtime code.**

**Definitive finding:** `birthdays_registry.yaml` is a human/generation-time artifact only. It is NOT loaded at runtime. The 10-12 (Yarden) / 09-11 (Sharon) dates the yaml/hard-coded list may hold are not reachable by the app except through the hard-coded `service.ts` array. Per CLAUDE.md, `memory/*` is auto-generated and must not be hand-edited (any edit there → `HUMAN_APPROVAL_REQUIRED`). It is therefore NOT a valid runtime source for (e).

---

## 3. Is `knowledge/family_data.json` already consumed at runtime?

**Yes — confirmed at two runtime call sites, via bundled ES import (`resolveJsonModule`).**

- `src/services/familyLoader.ts:1` — `import familyRaw from '../../knowledge/family_data.json'`. Exposes `loadFamilyData(): FamilyMember[]` (`familyLoader.ts:52-120`, memoized via module-level `_cache` at `familyLoader.ts:33, 118`) and `generateFamilyPromptSection()` (`familyLoader.ts:122-174`). The mapper `toFamilyMember` already copies `birthday` when present (`familyLoader.ts:46`: `if (m.birthday) result.birthday = m.birthday`) and the `FamilyMember` interface carries `birthday?: string` (`familyLoader.ts:12`).
- `src/screens/AbuAI/familyGraph.ts:19` — `import familyRaw from '../../../knowledge/family_data.json'` (graph lookup util; no React/fetch/env per its header `familyGraph.ts:1-15`).

`loadFamilyData()` is consumed at runtime by AbuAI `tools.ts:10, 14-16` (`searchFamily`, `getFamilyContext`, and the `getBirthdayFor` fallback at `tools.ts:191-198` which ALREADY reads `member.birthday` from the JSON).

**Generators that read the JSON (generation-time, not runtime):**
- `scripts/generate-memory-from-knowledge.ts:26` — `JSON.parse(readFileSync(... 'knowledge/family_data.json'))`. Emits the `memory/*` files. It writes `birthday` for matriarch (`:38`), children (`:51`), deceased (`:83`), and into `memory/birthdays_registry.yaml`-adjacent identity output (`:179`). This is the `npm run generate:memory` path.
- `scripts/validate-family-data.ts:14` — consistency validator (read-only of the JSON).

**Finding:** a working, memoized, type-mapped runtime loader of `family_data.json` ALREADY EXISTS (`familyLoader.ts`) and is already wired into AbuAI. Scope (e) does NOT need a new import mechanism — it can reuse `loadFamilyData()` (which already exposes `birthday`), or add a small calendar-side adapter that consumes it. The deceased's `memorial_date` is NOT currently surfaced by `familyLoader.ts` (the `FamilyMember` interface omits it — `familyLoader.ts:3-15` has no `memorialDate`), so memorial sourcing requires either extending that interface or reading `familyRaw.family.deceased.memorial_date` directly.

---

## 4. Exact field mapping: `family_data.json` → `Appointment`

`Appointment` target shape (`service.ts:3-17`): `{id, title, date(YYYY-MM-DD), time(HH:MM), emoji, color, notes?, location?, type?, personName?, birthYear?, isRecurring?}`.

Proposed mapping per person entry that has a usable `birthday` (`MM-DD`):
- `id` → stable slug from `canonical_name` (e.g. `bday-ofir`) + `-${year}` (preserve current id convention from `service.ts:384`).
- `title` → `יום הולדת ${hebrew_name} 🎂` (Martita kept Latin per product rule + `CALENDAR_DESIGN.md:68`).
- `date` → `${year}-${birthday}` (birthday is already `MM-DD`).
- `time` → `'09:00'` (current constant, `service.ts:346`).
- `emoji` → `'🎂'`; `type` → `'birthday'`; `isRecurring` → `true`; `personName` → `hebrew_name`; `color` → assigned (see Q5).
- Deceased memorial: `title` `יום הזיכרון של ${hebrew_name} 🕯️`, `date` `${year}-${memorial_date}`, `type:'memory'`, `emoji:'🕯️'`, `personName: hebrew_name`.

**Per-group inventory of usable dates (from `family_data.json`):**

| JSON group | Entry (hebrew) | `birthday`/`memorial_date` | Usable? |
|---|---|---|---|
| matriarch | Martita (מרטיטה) | 04-01 (`:8`) | yes — birthday |
| deceased | Papi (פפי) | birthday 04-19 (`:22`), memorial_date 01-01 (`:24`), birth_year 1941 (`:23`) | yes — birthday + memorial |
| children | Mor (מור) | 08-10 (`:38`) | yes |
| children | Leo (לאו) | 08-22 (`:47`) | yes |
| children_related | Raphi (רפי) | 07-29 (`:58`) | yes |
| children_related | Yael (יעל) | none | no |
| grandchildren_mor | Ofir (אופיר) | 02-15 (`:80`) | yes |
| grandchildren_mor | Ayalon (איילון) | 07-31 (`:90`) | yes |
| grandchildren_mor | Eili (עילי) | 04-08 (`:99`) | yes |
| grandchildren_mor | Adar (אדר) | 02-28 (`:109`) | yes |
| grandchildren_leo | Adi (עדי) | 04-05 (`:121`) | yes |
| grandchildren_leo | Noam (נועם) | 04-05 (`:131`) | yes |
| grandchildren_spouses | Yarden (ירדן) | **none** (`:135-144`) | **no — DROP** |
| grandchildren_spouses | Gilad (גלעד) | none | no |
| great_grandchildren | Anabel (אנאבל) | 10-01 (`:162`) | yes |
| great_grandchildren | Ari (ארי) | 11-26 (`:170`) | yes |
| pets | Tutsi/Tonto | none | no |
| close_friends | Mirta/Shoshana | none | no |
| close_friends | Sharon (שרון) | **none** (`:204-209`) | **no — DROP** |

**ADD / KEEP / DROP vs current hard-coded list (`service.ts:344-372`):**

- **KEPT (date + person resolve from JSON, 14 birthdays + 1 memorial):** Ofir (02-15), Adar (02-28), Martita (04-01), Adi (04-05), Noam (04-05), Eili/עילי (04-08), Papi birthday (04-19), Raphi (07-29), Ayalon (07-31), Mor (08-10), Leo (08-22), Anabel (10-01), Ari (11-26), and Papi memorial (01-01). Hard-coded "עילאי"→ JSON canonical is "עילי" (`:94, 99`); hard-coded "אילון"→ JSON canonical "איילון" with "אילון" only an alias (`:87`). Migration should adopt the JSON `hebrew_name`.
- **ADDED:** none. No JSON birthday is absent from the current hard-coded list. (Yael/Gilad/Mirta/Shoshana/pets have no birthday → not events.)
- **DROPPED:** **Yarden** (hard-coded `bday-yarden` 10-12, `service.ts:364`) and **Sharon** (hard-coded `bday-sharon` 09-11, `service.ts:361`). Neither has a `birthday` field in the JSON (`:135-144`, `:204-209`). Per the operator decision and "never invent" (calendar-date-integrity rule), these drop out automatically under a JSON-sourced approach. Tracked as FU-2 in `CALENDAR_DESIGN.md:9`.

Net: current hard-coded list has 16 birthdays; JSON-sourced yields **14 birthdays + 1 memorial**. The `service.test.ts:66` assertion `>= 10` would still hold (see Q8).

---

## 5. Safe migration path (design only — NO code written)

**Import mechanism:** reuse the existing bundled ES import. `src/services/familyLoader.ts:1` already imports the JSON and `loadFamilyData()` already exposes `birthday`. The lowest-risk path is a calendar-side adapter (e.g. in `service.ts` or a sibling util) that calls `loadFamilyData()` and maps members with a `birthday` to `Appointment` birthday objects, plus a direct read of `familyRaw.family.deceased.memorial_date` (or extend `FamilyMember` with `memorialDate`) for the memorial. **Do NOT add a `fetch()`** — a static bundled import is already the established pattern (`familyLoader.ts:1`, `familyGraph.ts:19`) and avoids async/runtime-path concerns.

**Preserve recurring per-year generation:** keep the existing `loadAppointmentsWithFamily(viewYear?)` contract (`service.ts:375-395`). Replace only the *source* of the base list: instead of mapping the static `FAMILY_BIRTHDAYS`/`FAMILY_MEMORIALS` arrays, derive the base list from `loadFamilyData()` once, then apply the SAME per-year transform currently at `service.ts:380-389` (`date: ${yr}-${b.date.slice(5)}`, `id: ${b.id}-${yr}`). The de-dup against user appts (`service.ts:391-393`) is unchanged.

**Stable IDs:** generate a deterministic slug per person (e.g. `bday-${canonicalName.toLowerCase()}`, `memorial-${...}`) so ids match today's convention (`bday-ofir`, `memorial-papi`) and remain stable across reloads; the `-${yr}` suffix is appended exactly as `service.ts:384, 388` do now. This keeps the de-dup `familyIds` set (`service.ts:392`) working and avoids breaking `abubank-alerted-ids` (the alert-fired set keyed by id, per CALENDAR_AUDIT §3).

**De-dup against user appointments:** unchanged — keep `service.ts:391-393` filtering user appts whose id collides with a family id.

**Avoid silently merging old sources:** the migration must DELETE the hard-coded `FAMILY_BIRTHDAYS`/`FAMILY_MEMORIALS` literals (or repoint them to the JSON-derived list) so the 10-12/09-11 dates cannot leak back in. It must NOT read `memory/birthdays_registry.yaml` (not a runtime source; editing memory → `HUMAN_APPROVAL_REQUIRED`). Because `tools.ts:3-4, 186, 210` import those two arrays by name, the migration must either (a) keep same-named exports backed by the JSON-derived list, or (b) update `tools.ts` to use the new accessor. Option (a) is the smaller-blast-radius change.

**Color stability note:** today birthdays carry hand-assigned `color` values (`service.ts:346-366`). `loadFamilyData()` does not provide colors. The adapter must assign deterministic colors (e.g. index into `APPT_COLORS` `service.ts:19-28` by a stable hash of the slug) — NOT the module-global cycling `colorIndex` (`service.ts:30`), which the audit flags as non-stable across sessions (CALENDAR_AUDIT §3). This is a design detail to settle in Phase 5.

**Bundler / build concern — checked:**
- `tsconfig.json:18` and `tsconfig.node.json:14` both set `"resolveJsonModule": true` → JSON ES imports type-check. Confirmed.
- `vite.config.ts` — grep found NO custom JSON handling and NO `assetsInclude`; Vite supports JSON imports natively. The two existing imports (`familyLoader.ts:1`, `familyGraph.ts:19`) already import `knowledge/family_data.json` from inside `src/`, so the relative-path-out-of-`src/` pattern is already in use and bundles. No new bundler config required. (Note: this is reasoned from config + existing identical imports; a build run is REQUIRED in Phase 5 to prove it — not asserted here.)
- Path depth: `src/services/familyLoader.ts` uses `../../knowledge/...`; a loader placed in `src/screens/AbuCalendar/` would need `../../../knowledge/...` (same depth as `familyGraph.ts:19`, which works). Reusing `familyLoader.ts`'s existing export avoids any new path entirely.

---

## 6. Privacy check

The proposed mapping reads ONLY `canonical_name`, `hebrew_name`, `birthday`, and (for deceased) `memorial_date` / `birth_year`. The `family_data.json` carries NO phone numbers, NO street addresses (locations are city-level only: "כפר סבא" `:9`, "הוד השרון" `:36`, "תל אביב" `:120`), NO medical, NO financial fields — consistent with `.claude/rules/privacy-boundaries.md`.

**Fields that must NOT be rendered into calendar events:** `location`/`location_notes` (e.g. `:37` "וילה עם יעל"), `notes` (relationship gossip e.g. `:59` "מור ורפי גרושים"), `relationship_hebrew`, `spouse`/`partner`/`ex_spouse`. Current hard-coded entries DO embed some `notes` (e.g. `service.ts:363` "נינה — בת של אופיר וגלעד"); a JSON-sourced birthday event should NOT auto-copy the JSON `notes` field into the Appointment `notes`, to avoid surfacing relationship detail on a birthday tile. **Recommendation: map name+date only; omit `notes`/`location`.** `birth_year` (1941, `:23`) is only relevant to the Papi memorial copy and may be used for age/anniversary text but is not sensitive.

---

## 7. AbuAI integration safety

The migration does NOT require changing `src/screens/AbuAI/` business logic, but it DOES touch the AbuAI surface because `tools.ts` imports the to-be-removed symbols:
- `tools.ts:2-4` imports `loadAppointmentsWithFamily`, `FAMILY_BIRTHDAYS`, `FAMILY_MEMORIALS` from the calendar `service.ts`.
- `tools.ts:186` (`getBirthdayFor`) and `tools.ts:210` (`getMemorialFor`) read the arrays directly.

The calendar is a read-only consumer of AbuAI exports (per CALENDAR_AUDIT §4) — that direction is unaffected. But the REVERSE dependency (AbuAI → calendar `service.ts` arrays) means scope (e) cannot remove `FAMILY_BIRTHDAYS`/`FAMILY_MEMORIALS` without either keeping same-named JSON-backed exports or updating `tools.ts:186, 210`. **Shared utils both consume:** `service.ts` (`loadAppointmentsWithFamily`, the two arrays, `formatHebrewDate`) and `narration.ts` (`classifyMeaning`, `sortByPriority`, imported at `tools.ts:8`); and `familyLoader.ts` (`loadFamilyData`) is shared by AbuAI `tools.ts:10` and would be shared by the new calendar adapter. No AbuAI prompt/LLM file needs editing for (e). `getBirthdayFor` already has a JSON fallback (`tools.ts:191-198`), so AbuAI is partially JSON-aware today.

---

## 8. Test impact (for Phase 5/6)

Tests that assert on the hard-coded birthdays/memorials (grep-confirmed):

- `src/screens/AbuCalendar/service.test.ts:10-11` imports `FAMILY_BIRTHDAYS`/`FAMILY_MEMORIALS`.
  - `:64-67` asserts `FAMILY_BIRTHDAYS.length >= 10` — JSON yields 14 birthdays, so this STILL passes, but the magic number should be revisited.
  - `:69-73` every birthday has `personName`; `:75-80` personName not containing "יום הולדת"; `:82-87` dates valid `MM-DD`. A JSON-sourced list must continue to satisfy these (mapping sets `personName = hebrew_name`).
  - `:90-100` `FAMILY_MEMORIALS` length `>= 1` and Papi memorial `type:'memory'`, `isRecurring:true`. JSON-sourced memorial must preserve these.
- `src/screens/AbuAI/runtimeProof.test.ts:6, 58-72` uses `loadAppointmentsWithFamily` to prove a user appt round-trips (does not assert specific family dates; safe if the merge contract is preserved).
- `src/screens/AbuAI/warRoom.test.ts:4, 82, 94, 136` exercises `getBirthdayFor`/`getMemorialFor` (`:82` Papi birthday, `:94` Papi memorial, `:136` Gilad). Gilad has NO birthday in JSON (`:146-153`) — `getBirthdayFor('גלעד')` relies on the array OR the JSON fallback; both return not-found for Gilad, so `:136` likely asserts not-found and is unaffected, **requires** re-reading the assertion to confirm.
- `src/screens/AbuAI/responseShaper.test.ts:135` hand-builds an "אופיר 02-15" birthday literal in test data (not importing the array) — unaffected by the source change.

No test was found asserting the specific dropped dates `10-12` (Yarden) or `09-11` (Sharon). Grep for those literals in tests returned only unrelated location/router hits. **No test currently locks in the Yarden/Sharon birthdays**, so dropping them does not break an existing assertion (confirmed by grep — absence of any `10-12`/`09-11` birthday assertion).

---

## DECISION INPUTS FOR PHASE 5

**(a) Is `memory/birthdays_registry.yaml` consumed at runtime?** NO. Only a provenance comment at `service.ts:340`; no import/fetch anywhere in `src/` (Q2). It is generation-time only and is HUMAN_APPROVAL_REQUIRED to edit. Not a valid runtime source.

**(b) Is `knowledge/family_data.json` consumed at runtime?** YES — via bundled ES import at `familyLoader.ts:1` (loader `loadFamilyData()`, already exposes `birthday`) and `familyGraph.ts:19`. Already wired into AbuAI `tools.ts:10`. A runtime loader already exists; (e) should reuse it.

**(c) ADD / KEEP / DROP (precise):**
- ADD: none.
- KEEP (14 birthdays): Ofir 02-15, Adar 02-28, Martita 04-01, Adi 04-05, Noam 04-05, עילי 04-08, Papi 04-19, Raphi 07-29, איילון 07-31, Mor 08-10, Leo 08-22, Anabel 10-01, Ari 11-26 — plus the 1 memorial: Papi 01-01. Adopt JSON canonical Hebrew names ("עילי", "איילון").
- DROP: Yarden (10-12, `service.ts:364`) and Sharon (09-11, `service.ts:361`) — no `birthday` in JSON; falls out under JSON-sourcing; tracked FU-2 (`CALENDAR_DESIGN.md:9`).

**(d) Import/bundler approach that will work:** static bundled ES import (NOT fetch), reusing `loadFamilyData()` from `familyLoader.ts`. `resolveJsonModule:true` is set in both `tsconfig.json:18` and `tsconfig.node.json:14`; Vite imports JSON natively (no `assetsInclude` needed — `vite.config.ts` has no custom JSON handling). The identical import pattern already bundles in two existing files. Preserve `loadAppointmentsWithFamily`'s per-year transform (`service.ts:380-389`), stable slug ids, and the user-appt de-dup (`service.ts:391-393`). To keep AbuAI working, either retain JSON-backed exports named `FAMILY_BIRTHDAYS`/`FAMILY_MEMORIALS` or update `tools.ts:186, 210`. (Build run still REQUIRED in Phase 5 to prove — reasoned, not executed here.)

**(e) Open questions needing operator input:**
1. **Memorial sourcing:** `familyLoader.ts` `FamilyMember` does not expose `memorial_date` (`familyLoader.ts:3-15`). Phase 5 must decide: extend `FamilyMember` with `memorialDate`, or read `familyRaw.family.deceased.memorial_date` directly in the calendar adapter. Either is a code change for Phase 5.
2. **Color assignment:** JSON has no per-person color; need a deterministic color scheme (hash → `APPT_COLORS`) so colors are stable. Confirm acceptable.
3. **Yarden/Sharon:** confirm DROP stands (operator already decided per brief), or supply verified dates to add to `family_data.json` then `npm run generate:memory`.
4. **`notes`/title copy:** confirm birthday events should NOT copy JSON `notes` (privacy, Q6), and confirm title format `יום הולדת ${hebrew_name} 🎂` (Martita kept Latin).
5. **`service.test.ts:66` `>= 10`:** still passes at 14 but should be reviewed/tightened in Phase 6.

*End of Phase-4 Integration Intelligence. READ-ONLY: no source files other than this deliverable were modified. No npm scripts were run; findings on build behavior are reasoned from config + existing identical imports and REQUIRE a Phase-5 build to prove.*

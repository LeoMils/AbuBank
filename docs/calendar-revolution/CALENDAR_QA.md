# Calendar Revolution — QA Report

Branch: `feat/calendar-revolution` · Base: `6a91ac5` · QA date: 2026-05-27
Mode: VERIFICATION ONLY (no source/test modified; only this file written).

> Environment caveat (governs every verdict below): vitest runs in the **node**
> environment. The repo has **no jsdom / @testing-library / browser**. Therefore
> anything requiring rendering — real 360×740 no-scroll fit, pixel layout,
> measured WCAG contrast ratios, bottom-sheet open/close/focus/scroll behavior,
> alert-inset reflow, glance tap behavior — is **NOT PROVEN here** and is marked
> "NOT PROVEN — requires browser QA".

---

## 1. Build / Test / Typecheck Results

| Command | Result | Evidence |
|---|---|---|
| `npm run typecheck` (`tsc --noEmit`) | **PASS** | exit 0, no diagnostics |
| `npm test` (`vitest run`) | **PASS** | `Test Files 95 passed (95)` · `Tests 2110 passed (2110)` — matches expected 2110 |
| `npm run build` (`tsc -b` + vite + PWA) | **PASS** | `✓ built in 10.73s`, `dist/sw.js` generated, 25 precache entries |

Post-build hygiene: `prebuild`→`generate:memory` rewrote only `# Generated:`
timestamps in three `memory/*.yaml`. Ran `git restore memory/`; **`git status` is
clean** (verified empty `git status --short`). Nothing committed or pushed.

Confidence: **HIGH** — all three are actual command outputs with assertion/exit
evidence.

---

## 2. Scope (e) — Family events from `knowledge/family_data.json`

New file `src/screens/AbuCalendar/familyEvents.ts`; tested by
`familyEvents.test.ts` (ran green within the 2110-test pass above → **PROVEN-by-test**).

| Claim | Verdict | Evidence |
|---|---|---|
| 13 birthdays + 1 memorial produced | **PROVEN-by-test** | `familyEvents.test.ts:8-9` (`bdays.length===13`, `FAMILY_BIRTHDAYS.length===13`); `:74-75` (`memorials.length===1`) — green in §1 |
| JSON actually has 13 birthdays + 1 memorial | **PROVEN (data)** | `grep -c '"birthday"' knowledge/family_data.json` = **13**; `grep -c 'memorial_date'` = **1** |
| Sourced from JSON, not memory/* | code-present (static) | `familyEvents.ts:9-10` imports `loadFamilyData` + `familyRaw` from `knowledge/family_data.json` |
| Drops Yarden / Sharon / Yael (no birthday in JSON) | **PROVEN-by-test** | filter `.filter(m => Boolean(m.birthday))` `familyEvents.ts:40`; `familyEvents.test.ts:32-39` asserts none present and stale dates (10-12, 09-11) do not leak |
| Gilad / Mirta / Shoshana omitted | code-present (static) | same `Boolean(m.birthday)` filter; not asserted individually by name in the test (filter logic covers them) → static |
| No notes / location copied into events | **PROVEN-by-test** | `familyEvents.ts:44-54` maps only id/title/date/time/emoji/color/type/personName/isRecurring; `familyEvents.test.ts:54-59, 85-88` assert `notes`/`location` undefined |
| Canonical Hebrew names עילי / איילון (not aliases) | **PROVEN-by-test** | `familyEvents.test.ts:26-30` (`bday-ayalon`→`איילון`, `bday-eili`→`עילי`); old hard-coded used alias `אילון`/`bday-eylon` (removed, see §3) |
| Martita kept Latin | **PROVEN-by-test** | `familyEvents.ts:34-36` `displayName`; `familyEvents.test.ts:19-24` (`personName==='Martita'`, title `יום הולדת Martita 🎂`) |
| Deterministic colors | **PROVEN-by-test** | `familyEvents.ts:24-31` `stableHash`→`colorFor`; `familyEvents.test.ts:61-67` two builds equal per index |

---

## 3. AbuAI preservation (hard constraint)

| Claim | Verdict | Evidence |
|---|---|---|
| No AbuAI **source** file changed | **PROVEN** | `git diff --name-only 6a91ac5..HEAD -- src/screens/AbuAI/` returns ONLY `onlineWiring.test.ts` + `tools.test.ts` (filtering out `.test.` → NONE) |
| `tools.test.ts` change is the documented query swap | **PROVEN** | diff: `findEventsByPerson('אופיר')`→`('ארי')`, summary assertion updated; comment notes match by personName/title, not leaked relationship notes |
| `onlineWiring.test.ts` made version-agnostic | **PROVEN** | diff: replaced pinned `0.4.17-final-release-war-room` assertion with regex `version:\s*'[^']+'` + `buildLabel:\s*'AbuBank[^']*'` |
| `service.ts` still exports `FAMILY_BIRTHDAYS`/`FAMILY_MEMORIALS` by name | **PROVEN** | `service.ts:343` `export { FAMILY_BIRTHDAYS, FAMILY_MEMORIALS } from './familyEvents'`; `:344` re-import for local use |
| AbuAI `tools.ts` imports those names (unchanged) | code-present (static) | `tools.ts:3-4` import; `:186, :210` use `FAMILY_BIRTHDAYS.find` / `FAMILY_MEMORIALS.find` |

The old hard-coded `FAMILY_BIRTHDAYS`/`FAMILY_MEMORIALS` arrays were **removed**
from `service.ts` (diff shows deletion of the literal Sharon `09-11` entry and
the alias `אילון`/`bday-eylon`) and replaced by the JSON-backed re-export.

---

## 4. Truth Contract / write path

| Claim | Verdict | Evidence |
|---|---|---|
| `createAppointmentSafe` is the single create path | code-present (static) | defined `service.ts:85`; non-test callers: `voiceAutoCreate.ts:148`, `index.tsx:267` (manual save), `index.tsx:686` (voice confirm). No other create call sites |
| Voice path cannot bypass validation | code-present (static) | `index.tsx:683-691` `handleVoiceConfirm` routes through `createAppointmentSafe`; `voiceAutoCreate.ts:148` likewise |
| Raw transcript not rendered as user-visible copy in primary flow | code-present (static) | `index.tsx` `rawTranscript` is passed only as a prop to `<VoiceCard rawTranscript=...>` (`:1267`) and into trace diagnostics; no new raw-transcript display block introduced in `index.tsx`. Whether VoiceCard surfaces it as user copy is unchanged from base and out of this branch's index diff |

Note: write-path uniqueness is a static grep finding (MEDIUM-HIGH). The
underlying validation/round-trip of `createAppointmentSafe` is exercised by the
existing suite (green in §1) but not re-asserted as part of this QA.

---

## 5. PP-1 / PP-2 structural check (static)

| Claim | Verdict | Evidence |
|---|---|---|
| Old sticky footer (`position:sticky; bottom:0`) gone from primary flow | code-present (static) | `git diff 6a91ac5..HEAD -- index.tsx` shows removed line `-        position: 'sticky', bottom: 0,`; `grep 'sticky' index.tsx` now matches only a code comment (`:1109`) |
| Inline selected-day list moved into sheet | code-present (static) | `selectedAppts.map(...)` now rendered **inside** `<DayDetailSheet>` children (`index.tsx:1192-1201`); list no longer in the primary scroll body |
| ADD / mic / voice-trace live inside the sheet only | code-present (static) | `<DayDetailSheet footer={...}>` hosts StatusPill, `VoiceTraceCard` (`:1126`), ADD button (`:1135`), mic button (`:1139`); no permanent ADD/mic block remains in the primary view |
| AbuTime moved into the sheet | code-present (static) | `<AbuTime ... />` rendered as first child of the sheet (`index.tsx:1172`) |
| Day-cell tap opens sheet | code-present (static) | `onClick={() => { setSelectedDay(ds); soundTap(); setSheetOpen(true) }}` (`index.tsx:1011`) |

Behavioral proof (does the primary screen actually fit without scroll once the
list is gone; does the sheet open/scroll/restore focus correctly) is
**NOT PROVEN — requires browser QA**.

---

## 6. Regression / Hygiene

| Check | Verdict | Evidence |
|---|---|---|
| `git status` clean (memory restored) | **PROVEN** | `git status --short` empty after `git restore memory/` |
| No `package.json` / `package-lock.json` / `.env*` changes | **PROVEN** | absent from `git diff --stat 6a91ac5..HEAD` |
| No `memory/*` hand-edits in branch diff | **PROVEN** | absent from branch diff-stat (only transient build timestamps, restored) |
| No `knowledge/*` changes (incl. `family_data.json`) | **PROVEN** | absent from `git diff --stat 6a91ac5..HEAD` |
| Four bottom-bar screens untouched | **PROVEN** | branch diff-stat touches only `src/screens/AbuCalendar/*`, two `src/screens/AbuAI/*.test.ts`, `src/version*`, and `docs/*` |
| Build config untouched | **PROVEN** | no vite/tsconfig in diff-stat |
| Orphaned imports / dead code | code-present (static) | typecheck PASS (unused-import friendly only if `noUnusedLocals` off); manual read of `index.tsx`, `DayDetailSheet.tsx`, `familyEvents.ts`, `constants.ts`, `ApptCard.tsx` found no obviously dead exports — every new symbol (`DayDetailSheet`, `TEXT_PRIMARY/SECONDARY/MUTED`, `familyEvents`) has a reachable call site. Full dead-code certainty would need lint; `npm run lint` not run as part of this QA |

Branch `git diff --stat 6a91ac5..HEAD` (full): 19 files, +1383 / -193 — all
within scope (AbuCalendar source, AbuAI tests only, version, docs).

---

## 7. Scope c / a / b presence (static + browser split)

### Scope (c) — 6.2

| Item | code-present (file:line) | Browser-only (NOT PROVEN) |
|---|---|---|
| Day cell minHeight 54→64 | `index.tsx:995` (empty cell) + `:1015` (`minHeight: 64`) | actual ≥64pt touch target rendered |
| Shape-encoded indicator (birthday=filled circle, memorial=ring, regular=square) | `index.tsx:1077-1102` (`borderRadius: isRegularOnly ? 2 : '50%'`; ring via transparent bg + border) | visual distinguishability / color-independence |
| Count digit when >1 event | `index.tsx:1093-1099` | visual |
| Solid contrast tokens | `constants.ts:9-11` (`TEXT_PRIMARY/SECONDARY/MUTED`) | measured WCAG ratio / AAA — **NOT PROVEN** |
| `ApptCard` "עבר" pill (no strikethrough) | `ApptCard.tsx:71-78` (pill element); no `textDecoration: line-through` present | visual |

### Scope (a) — 6.3

| Item | code-present (file:line) | Browser-only (NOT PROVEN) |
|---|---|---|
| `DayDetailSheet.tsx` exists | whole file (1-103) | open/close/scroll behavior |
| role=dialog / aria-modal / Escape / scrim / focus in+restore / reduced-motion | `DayDetailSheet.tsx:20-31` (Escape + focus), `:45-47` (dialog), `:38-42` (scrim), `:97-99` (reduced-motion) | actual focus movement, Escape handling, scrim click in a browser |
| Own scroll region | `DayDetailSheet.tsx:77` (`overflowY: 'auto'`) | real scroll containment |
| Full Tab-trap + swipe-close | deferred (FU-4) — comment `DayDetailSheet.tsx:8-9` | n/a (not built) |

### Scope (b) — 6.4

| Item | code-present (file:line) | Browser-only (NOT PROVEN) |
|---|---|---|
| Next-thing glance (next event + today count) | `index.tsx:763-768` (compute), `:874-902` (render); tap jumps + opens sheet `:876` | tap behavior, no-scroll fit |
| Alert banner = in-flow inset (not position:fixed) | `index.tsx:817-847` (`flexShrink: 0` flow block, no `position:fixed`) | reflow behavior |
| AbuTime moved into sheet | `index.tsx:1172` | rendered placement |
| Version bump `0.4.18-calendar-revolution` | **PROVEN-by-test** `version.ts:15` + `version.test.ts` (green in §1) | n/a |

---

## QA SUMMARY

### PROVEN (automated assertion / command output — HIGH)
- typecheck PASS, **2110/2110 tests PASS**, build PASS; `git status` clean.
- Scope (e) data: 13 birthdays + 1 memorial; Sharon/Yarden/Yael dropped; no
  notes/location leak; עילי/איילון canonical; Martita Latin; deterministic colors
  — all asserted by `familyEvents.test.ts`. JSON cross-check: 13 `birthday`, 1
  `memorial_date`.
- AbuAI **source untouched** — only `tools.test.ts` + `onlineWiring.test.ts`
  (tests) changed. `service.ts` still exports `FAMILY_BIRTHDAYS`/`FAMILY_MEMORIALS`.
- Version `0.4.18-calendar-revolution` asserted.
- No package.json / memory / knowledge / bottom-bar / build-config changes.

### code-present (static — MEDIUM)
- `createAppointmentSafe` single write path (callers grep); raw transcript not
  newly surfaced as user copy in `index.tsx`.
- PP-1/PP-2: sticky footer removed, list + ADD/mic/AbuTime relocated into
  `DayDetailSheet`, day-cell tap opens sheet.
- Scope c/a/b code present: 64px cells, shape indicators, contrast tokens, "עבר"
  pill, the sheet with min-safe a11y, the glance, alert in-flow inset.

### NOT PROVEN — MUST go to browser QA (Phase 7 manual)
- Real **no-scroll fit** of the primary screen at 360×740.
- Measured **WCAG contrast ratios** (no AAA claim made).
- **Bottom-sheet** open/close, own-scroll containment, focus-into / focus-restore,
  Escape, scrim-click, reduced-motion in a real browser.
- **Alert-inset** reflow (no paint-over of chrome).
- **Glance tap** → month jump + sheet open behavior.
- ≥64pt / ≥48pt **touch-target** rendering and **shape-vs-color** distinguishability.
- Full Tab focus-trap + swipe-down-close are **deferred (FU-4)**, not built.

No core regression detected in automated checks. Visual/interaction correctness
for an 80+ RTL user requires manual browser QA before release.

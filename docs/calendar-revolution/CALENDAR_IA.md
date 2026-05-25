# CALENDAR_IA — Phase 2 Information Architecture

Branch: `feat/calendar-revolution`. Inputs: `CALENDAR_AUDIT.md`, `CALENDAR_BRIEF.md`, operator ACCEPT-1 decisions.
Status: IA written — awaiting ACCEPT-2. No production code. Nothing pushed. Read-only inspection only.

Operator decisions carried in (ACCEPT-1):
- Tapping a day cell opens a **bottom-sheet day-detail** that **replaces** the inline selected-day list.
- **Mic + manual add live inside the sheet only.** No permanent ADD/mic/manual footprint on the primary view (PP-2 is the footprint problem).
- Birthday data: **verify real file shape, do not invent.** Map through the Truth Contract if fields exist; document the gap if they don't.

---

## 1. Information model (entities)

| Entity | Source | Key fields | Notes |
|---|---|---|---|
| **Appointment** (user) | `localStorage: abubank-calendar-appointments` | `id,title,date(YYYY-MM-DD),time,emoji,color,notes?,location?,type?,personName?,birthYear?,isRecurring?` (service.ts:3-17) | Only write path = `createAppointmentSafe` (service.ts:85). Truth Contract: unchanged. |
| **FamilyEvent** (derived) | TODAY hard-coded `FAMILY_BIRTHDAYS`/`FAMILY_MEMORIALS` (service.ts:344-372); TARGET `knowledge/family_data.json` | birthday `MM-DD`, memorial `MM-DD`, name | Recurring; regenerated per viewed year (service.ts:380-389). Scope (e) re-sources this. |
| **Holiday / Shabbat** | holiday table (service.ts:409-444) | date, label | Read-only; informational chip. |
| **Alert** (transient) | `abubank-alert-minutes` + `abubank-alerted-ids` (index.tsx:132-146) | lead time, fired-id set | Drives the ALERT moment. |

The three product moments map onto entities as: **ADD** → creates an Appointment via the safe path; **SHOW** → renders Appointments + FamilyEvents + Holiday for a day/month; **ALERT** → surfaces an upcoming Appointment/FamilyEvent at its lead time.

## 2. Data-source layer & source-of-truth reconciliation (scope e)

**Verified `knowledge/family_data.json` shape** (read 2026-05-25): a single `family` object with groups `matriarch`, `deceased`, `children[]`, `children_related[]`, `grandchildren_mor[]`, `grandchildren_leo[]`, `grandchildren_spouses[]`, `great_grandchildren[]`, `pets[]`, `close_friends[]`. Person entries carry `canonical_name`, `hebrew_name`, `aliases[]`, `relationship`, and **most carry `birthday` in `MM-DD`**. `deceased` carries `birthday` + `birth_year` + `memorial_date` (`01-01`).

**Birthday fields DO exist** → map them through the Truth Contract. But hard-coded list ≠ JSON. Reconciliation table:

| Person | Hard-coded (service.ts) | JSON `birthday` | Reconciliation |
|---|---|---|---|
| Ofir / Adar / Martita / Adi / Noam / Eili / Mor / Leo / Raphi / Anabel / Ari | present | matches | map 1:1 |
| Ayalon | `bday-eylon` "אילון" 07-31 | `Ayalon` "איילון" 07-31 | date matches; **use JSON canonical `hebrew_name` "איילון"** (hard-coded "אילון" is an alias) |
| Papi | birthday 04-19 + memorial 01-01 | `deceased.birthday` 04-19, `memorial_date` 01-01 | map; memorial already correct (matches `FAMILY_MEMORIALS` 01-01) |
| **Yarden** | `bday-yarden` 10-12 | **NO `birthday` field** | **GAP — do not invent.** JSON has no birthday for Yarden. Migrating to JSON would DROP this event. Needs operator decision (Phase 4): add to JSON if known, else drop. |
| **Sharon** | `bday-sharon` 09-11 | **NO `birthday` field** (close_friends, friend) | **GAP — do not invent.** Same as above. |
| Yael / Gilad / Mirta / Shoshana | not in hard-coded list | no birthday | no change |

**Secondary source flag:** the hard-coded block cites `memory/birthdays_registry.yaml` as its origin (service.ts:340). CLAUDE.md states the runtime source of truth is `knowledge/family_data.json` ("Birthdays and family dates live in family_data.json"). `birthdays_registry.yaml` may hold the 10-12 / 09-11 dates the JSON lacks. **Reconciliation of these two sources is deferred to Phase 4 (Integration Intelligence)** — IA only records the gap; it does not resolve or invent. No `memory/*` edits (auto-generated; HUMAN_APPROVAL_REQUIRED per CLAUDE.md).

**Privacy:** the migration reads only name + date fields. It must NOT surface phone/street/medical/financial (none of which exist in this file anyway) — abstract relationship roles only.

## 3. Primary view IA (no-scroll, 360×740 budget)

Single non-scrolling column, top→bottom. ADD/mic/manual are NOT here (moved to sheet per ACCEPT-1).

```
[ALERT layer]   transient banner — overlays as a top inset, does NOT cover header/selector (fixes PP-1 top-overlap)
─────────────────────────────────────────────
ScreenHeader    back · "Abu יומן" · Martita photo · info-legend          (persistent)
Glance strip    "next thing" one-liner (next upcoming event) — replaces need to expand AbuTime for the common case
Alert-interval  compact reminder lead-time control
Month nav       ‹ prev · [month year] · "היום" · next ›
Month grid      6×7 day cells, each ≥56pt, ≥12pt gap; non-color event indicator + dot
─────────────────────────────────────────────
(no footer band — bottom space is free)
```

Removed from the primary view vs. today: the inline `maxHeight:200` selected-day list (index.tsx:1054) and the sticky footer stack (index.tsx:1089-1151) — both relocate into the bottom-sheet. This is the structural fix for PP-1 (no list under a sticky footer) and PP-2 (no permanent ADD band).

## 4. Bottom-sheet day-detail IA (the SHOW + ADD surface)

Triggered by tapping a day cell. Owns its own scroll, so list length never collides with primary chrome.

```
Bottom-sheet (modal surface, above primary; backdrop scrim)
├─ Grip + day header        Hebrew date, holiday/Shabbat chip if any
├─ Event list  [scrolls within the sheet]
│   ├─ EmptyState ("אין אירועים ביום הזה") when none
│   └─ ApptCard × n   (existing ApptCard.tsx; time-state, location, notes, delete)
├─ ADD zone  [pinned to sheet bottom, inside the sheet's own layout]
│   ├─ Manual add   ("＋ הוספה ידנית")  → ManualModal (existing)
│   └─ Mic          → existing voice pipeline (handleVoiceRecord, index.tsx:329)
└─ Voice status  StatusPill + VoiceTraceCard render INSIDE the sheet during a voice session only
```

Rules baked into the IA:
- The event list and the ADD zone share the **sheet's** scroll/space, not the primary view's. The list can grow; the sheet scrolls; nothing is hidden behind global chrome.
- Voice trace card is shown **only during a non-idle voice session** (preserves the always-honest state feedback from audit H9/§5 without the permanent footprint).
- Existing modals (`ManualModal` z200, `VoiceCard` z200, ambiguity sheet z220) open **above** the day-sheet — their relative order is preserved.

## 5. Navigation & state map

```
Home ──(calendar tile, Home/index.tsx:624)──▶ AbuCalendar primary view
AbuCalendar primary ──tap day cell──▶ day-sheet OPEN (selectedDate set)
day-sheet ──swipe-down / scrim tap / close──▶ day-sheet CLOSED (back to primary, no nav change)
day-sheet ──manual add──▶ ManualModal ──save (createAppointmentSafe)──▶ list refresh + success toast, sheet stays on that day
day-sheet ──mic──▶ voice pipeline ──auto_created/confirm/clarify──▶ same day, list refresh
AbuCalendar ──BackButton (index.tsx:796)──▶ Home
ALERT fires ──▶ banner inset on primary; tapping it selects the event's day + opens sheet
```

State ownership: `selectedDate` + `sheetOpen` drive SHOW; `alert-minutes` + `alerted-ids` drive ALERT; appointment writes go only through `createAppointmentSafe`. No new global state beyond `sheetOpen` (sheet visibility) is required at IA level.

## 6. Surface / layering model (prevents PP-1 recurrence)

IA-level layering contract (visual values are Phase 3's job):
- **Primary chrome** (header, glance, selector, month nav, grid) = base layer, no element overlaps another; no sticky/blurred band over content.
- **ALERT banner** = a top inset that reflows content downward OR sits in reserved space — it must not paint over the selector/glance (today's bug, index.tsx:762).
- **Day-sheet** = one layer above primary, with a scrim; owns its own scroll.
- **Modals** (ManualModal/VoiceCard/ambiguity) = above the day-sheet, existing z-order (200/220) preserved.

This removes the two mechanical causes of PP-1 from §6 of the audit (sticky footer over list; fixed banner over chrome) by construction.

## 7. What stays untouched (guardrails)

- Abu AI sources — calendar remains a read-only consumer of its exports (audit §7).
- Raw transcript — never rendered as user copy; normalization stays upstream of display.
- `createAppointmentSafe` round-trip — the single write path; semantics unchanged.
- The four bottom-bar screens — out of bounds.
- `memory/*` — auto-generated; not edited.

## 8. Open gaps / questions for the ACCEPT-2 gate

- **G1 (birthday gap).** Yarden (10-12) and Sharon (09-11) have NO birthday in `family_data.json`. Options for Phase 4: (i) you provide/confirm the dates to add to `family_data.json` (then `npm run generate:memory`), or (ii) drop them from the calendar to honor "never invent." Which?
- **G2 (dual source).** `memory/birthdays_registry.yaml` may be the origin of those two dates. Confirm `knowledge/family_data.json` is the sole runtime source for (e) and that `birthdays_registry.yaml` is not separately consumed at runtime. (Phase 4 will verify consumption; flagging now.)
- **G3 (glance vs AbuTime).** The IA proposes a compact "next thing" glance on primary and keeps the fuller AbuTime briefing reachable. Confirm AbuTime stays (collapsed) on primary, or moves into the sheet, or is removed from primary. (Affects no-scroll budget.)

---

*End of Phase-2 IA. No source files other than this deliverable were modified; `knowledge/family_data.json` and `service.ts` were read only.*

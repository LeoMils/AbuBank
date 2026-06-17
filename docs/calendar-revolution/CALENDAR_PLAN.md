# CALENDAR_PLAN — Phase 5 Architecture + Implementation Plan

Branch: `feat/calendar-revolution`. Inputs: Phase 0-4 deliverables + operator ACCEPT-4 locked decisions.
Status: plan written — awaiting **ACCEPT-5**. **No production code yet.** This is the last gate before implementation. Nothing pushed.

This plan is precise enough that ACCEPT-5 authorizes exactly the file touches and chunks below — nothing else.

---

## A. Architecture decisions (resolving Phase-4 open items)

1. **Birthday/memorial source (e).** Add a calendar-side adapter `src/screens/AbuCalendar/familyEvents.ts` that:
   - imports `loadFamilyData()` from `src/services/familyLoader.ts` (already exposes `birthday`) and maps every member with a `birthday` to a birthday `Appointment`;
   - reads the memorial **directly** from a bundled import of the JSON's deceased node (`familyRaw.family.deceased.memorial_date`) — **does NOT modify `familyLoader.ts`** (preserves the AbuAI consumer; smallest safe change per locked decision 5);
   - exports `FAMILY_BIRTHDAYS: Appointment[]` and `FAMILY_MEMORIALS: Appointment[]` **with the same names/shapes** that `service.ts` exports today, re-exported from `service.ts` so `AbuAI/tools.ts:2-4, 186, 210` keep working unchanged (locked decision 2). **AbuAI is NOT touched** unless a build/type error proves it unavoidable.
2. **Deterministic colors.** Adapter assigns `color` by a stable hash of the person slug into `APPT_COLORS` (`service.ts:19-28`), e.g. `APPT_COLORS[hash(slug) % 8]`. **Never** the session-global `colorIndex` (`service.ts:30`). Same slug → same color every load (locked decision 6).
3. **Stable IDs.** Keep today's convention: `bday-${canonicalSlug}` / `memorial-${canonicalSlug}`, with `-${year}` appended by the existing per-year transform (`service.ts:380-389`). This preserves the de-dup set (`service.ts:392`) and the `abubank-alerted-ids` keys (so already-dismissed alerts do NOT re-fire).
4. **`loadAppointmentsWithFamily` contract unchanged.** Only the *base list source* changes (static literals → adapter output). The per-year transform + user-appt de-dup (`service.ts:375-395`) are preserved verbatim.
5. **Copy (locked decision 7).** Birthday title `יום הולדת ${hebrew_name} 🎂` (Martita stays Latin). Memorial title `יום הזיכרון של ${hebrew_name} 🕯️` — calm, formal, matches current `FAMILY_MEMORIALS` tone (`service.ts:370`). No JSON `notes`/`location` copied into events (privacy, locked decision 4).
6. **Bottom-sheet (a).** New component `src/screens/AbuCalendar/DayDetailSheet.tsx` (`role="dialog"`, focus trap, scrim, owns its own scroll). Hosts: day header + holiday chip, optional collapsed AbuTime per-day briefing, the event list (`ApptCard`s), and the ADD zone (manual + mic + in-sheet voice status). Opened by tapping a day cell. Existing modals (`ManualModal`, `VoiceCard`, ambiguity sheet) open ABOVE it, z-order preserved.
7. **Primary no-scroll (b) + indicators/sizing (c).** Done by editing `index.tsx` (remove inline list + sticky footer; alert banner → reflowing top inset; add next-thing glance; relocate AbuTime into sheet) and the grid cells (≥64pt height, ~46pt width, shape+glyph indicators), plus `ApptCard.tsx` (replace strikethrough), plus contrast tokens.

## B. Exact file-touch list (the ONLY files Phase 6 may modify)

**New files:**
- `src/screens/AbuCalendar/familyEvents.ts` — JSON-backed birthday/memorial adapter.
- `src/screens/AbuCalendar/familyEvents.test.ts` — adapter unit tests.
- `src/screens/AbuCalendar/DayDetailSheet.tsx` — bottom-sheet component.
- `src/screens/AbuCalendar/DayDetailSheet.test.tsx` — sheet behavior tests.

**Modified files:**
- `src/screens/AbuCalendar/service.ts` — replace hard-coded `FAMILY_BIRTHDAYS`/`FAMILY_MEMORIALS` literals (`:344-372`) with re-exports of the adapter output; keep export names/shapes.
- `src/screens/AbuCalendar/service.test.ts` — update the birthday/memorial assertions (`:64-100`) to the JSON-sourced reality (14 birthdays + 1 memorial; tighten the `>=10` magic number).
- `src/screens/AbuCalendar/index.tsx` — grid cell sizing + non-color indicators; remove inline selected-day list + sticky footer; alert → reflowing inset; next-thing glance; mount `DayDetailSheet`; relocate AbuTime + ADD + voice trace into the sheet.
- `src/screens/AbuCalendar/ApptCard.tsx` — replace `line-through` past styling (`:69`) with muted color + "עבר"/✓; contrast token.
- `src/screens/AbuCalendar/constants.ts` — add contrast/text tokens + indicator shape helper if needed.
- `src/version.ts` — bump `version`, `buildDate`, `branchHint` (current `0.4.17-final-release-war-room` → calendar-revolution build).
- `src/version.test.ts` — update version assertion.

**Explicitly NOT touched:** `src/services/familyLoader.ts`, anything under `src/screens/AbuAI/`, the four bottom-bar screens, `knowledge/family_data.json`, `memory/*`, `package.json`, `package-lock.json`, `.env*`, `vite.config.ts`, `tsconfig*.json`. If any of these *must* change, that is a STOP → re-gate with the operator (CLAUDE.md HUMAN_APPROVAL_REQUIRED).

## C. Chunked implementation plan (build order, each its own commit)

### Chunk 6.1 — JSON-backed family events (scope e) — SMALLEST, do first
- **Files:** new `familyEvents.ts` + `familyEvents.test.ts`; edit `service.ts` (re-export), `service.test.ts`.
- **What:** adapter maps `loadFamilyData()` birthdays + deceased `memorial_date` → `Appointment[]`; deterministic colors; stable slugs. `service.ts` re-exports same-named arrays.
- **Tests:** 14 birthdays produced; Papi memorial produced (`type:'memory'`,`isRecurring`); Yarden & Sharon ABSENT (assert no event with those names/dates); canonical names עילי/איילון used; colors deterministic across two calls; no `notes`/`location` on produced events (privacy); `loadAppointmentsWithFamily` still returns ≥ user+family count and de-dups; existing `service.test.ts` birthday/memorial suites pass post-update.
- **AbuAI guard:** run the full suite — `AbuAI/warRoom.test.ts` (`getBirthdayFor`/`getMemorialFor`) and `runtimeProof.test.ts` must stay green WITHOUT editing AbuAI. If they fail, the re-export shape is wrong → fix the adapter, not AbuAI.
- **Rollback risk:** id-slug drift could re-fire dismissed alerts or break de-dup. Mitigation: assert produced ids match the existing `bday-<slug>`/`memorial-<slug>` pattern. Revert = single-commit revert; no data migration (localStorage user appts untouched).
- **Verify:** `npm run typecheck && npm test` green; manual: open calendar, confirm the 14 birthdays + memorial render and Yarden/Sharon are gone.

### Chunk 6.2 — Day cells ≥64pt + non-color indicators + contrast/strikethrough (scope c)
- **Files:** `index.tsx` (grid cells `:952-1050`), `ApptCard.tsx` (`:69`), `constants.ts` (tokens).
- **What:** cell height ≥64pt, width ~46pt (8pt padding/4pt gap — the honest 7-col/360 limit, `CALENDAR_DESIGN §1.3`); event dots gain shape (filled/ring/square) + glyph + count; muted-alpha text → solid tokens (audit H6); past-event `line-through` → muted+"עבר"/✓ (audit H11); update InfoButton legend to describe shape.
- **Tests:** unit-test the indicator-shape mapping (type→shape) where extractable into a pure helper; `timeState.test.ts`/`duplicateDetection.test.ts` stay green. Contrast ratios are NOT unit-testable here → flagged for Phase 7 measurement (no AAA claim made by this chunk).
- **Rollback risk:** sizing could push primary into scroll → verify no-scroll at 360×740 in browser before commit. Revert = single commit.
- **Verify:** typecheck/test green; browser at 360×740 — cells legible, indicators non-color, no scroll introduced.

### Chunk 6.3 — Bottom-sheet day-detail; relocate SHOW + ADD into it (scope a)
- **Files:** new `DayDetailSheet.tsx` + `DayDetailSheet.test.tsx`; edit `index.tsx` (add `sheetOpen` state, day-tap opens sheet, move event list + ADD row + voice trace + StatusPill into the sheet).
- **What:** build the sheet (dialog semantics, focus trap, scrim, own scroll, 220/180ms motion, reduced-motion instant). Move — not rewrite — the existing event list, manual-add button, mic button, VoiceTraceCard/StatusPill JSX and their handlers into the sheet. The voice pipeline handlers (`handleVoiceRecord` etc.) keep identical logic; only their render location moves. ADD still routes through `createAppointmentSafe` (Truth Contract). Raw transcript still never rendered.
- **Tests:** sheet opens on day-tap, closes on scrim/Escape/close; ADD inside sheet still calls `createAppointmentSafe` and refreshes the day; focus moves into sheet and returns to the day cell; modals still open above the sheet. Reuse/extend existing voice tests to confirm the pipeline is unbroken.
- **Rollback risk:** HIGHEST — the voice pipeline is intricate (transcribe→normalize→processVoiceTranscript→createAppointmentSafe). Mitigation: relocate JSX/handlers wholesale without logic edits; rely on the existing voice test suite (voiceAutoCreate, voiceCardSlots, voiceConfirm, createPipelineIntegration, voicePersistence) as the regression net — all must stay green. Revert = single commit restores the inline footer/list.
- **Verify:** full suite green; browser — tap day opens sheet, add via manual AND mic both persist and show in-sheet, raw transcript never visible, no event hidden behind chrome (PP-1 gone).

### Chunk 6.4 — Primary no-scroll finish: glance + alert inset + AbuTime relocation + version (scope b)
- **Files:** `index.tsx` (remove now-dead inline list/sticky footer remnants; alert banner `:762` → reflowing top inset; add next-thing glance = next event + today's count per ACCEPT-3; mount collapsed AbuTime inside the sheet); `version.ts` + `version.test.ts`.
- **What:** finalize the no-scroll primary (header · glance · compact alert-interval · month nav · grid). Alert becomes reserved-space inset (never paints over chrome — audit H3). Bump version + buildDate + branchHint; update version test.
- **Tests:** next-thing glance picks the correct next upcoming event + correct today count (pure selector → unit test); `version.test.ts` matches new version; no-scroll asserted where testable (e.g. primary container has no `overflowY:auto`, the nested list moved to sheet).
- **Rollback risk:** removing surfaces could orphan handlers/imports (TS will catch). Alert inset mis-sizing could still overlap → browser-verify. Revert = single commit.
- **Verify:** full suite + `npm run build` green; browser at 360×740 — no page scroll, alert reflows without covering, glance correct, version visible in About.

> Note: chunks 6.3 and 6.4 are sequential and coupled (6.3 must host the list/ADD before 6.4 removes them from primary). If 6.3 review prefers it, 6.3+6.4 may merge into one chunk; default is two commits for smaller blast radius. Operator to confirm in ACCEPT-5 (see §F).

## D. Version-bump policy
Bump `src/version.ts` once, in **Chunk 6.4** (the last code chunk), to a single calendar-revolution build label — avoids churning the version across intermediate chunks while still satisfying "every change increments + displays version" for the shipped change. (If you prefer a bump per chunk, say so in ACCEPT-5.)

## E. Cross-cutting rollback & safety
- Every chunk = one commit on `feat/calendar-revolution`; rollback = `git revert <sha>` of that chunk only.
- No localStorage schema change → no user-data migration risk; user appointments are never rewritten.
- Pre-commit hook (family-data validation + full 2100-test suite) runs on every commit — a chunk cannot land if it breaks tests.
- **Nothing pushed** during Phase 6; push is a Phase-10 decision with explicit operator accept.
- AbuAI, bottom-bar screens, `memory/*`, build config: untouched; touching any is a STOP/re-gate.

## F. What must be confirmed for ACCEPT-5 (operator decisions on the plan)
1. **Adapter approach:** OK to add `familyEvents.ts` and re-export from `service.ts`, leaving `familyLoader.ts` and all of AbuAI untouched? (Recommended — smallest safe change.)
2. **Memorial read:** OK to read `familyRaw.family.deceased.memorial_date` directly in the adapter (vs extending `FamilyMember`)? (Recommended — avoids touching the shared loader.)
3. **Chunk split:** approve 4 chunks (6.1 → 6.2 → 6.3 → 6.4), or merge 6.3+6.4?
4. **Version bump:** once in 6.4 (recommended), or per chunk?
5. **File-touch list (§B):** approve as the complete and exclusive set; any addition re-gates.

## G. What is verified vs. reasoned (Truth Contract)
- VERIFIED by read/grep this session: the JSON loader exists and exposes `birthday` (`familyLoader.ts:1,12`); AbuAI consumes the two arrays (`tools.ts:2-4,186,210`); `resolveJsonModule` set; current version `0.4.17`; `APPT_COLORS` palette; `loadAppointmentsWithFamily` contract.
- REASONED, must be PROVEN in Phase 6/7: the Vite build bundles cleanly (no build run yet); the no-scroll budget holds on a real 360×740 viewport; contrast ratios meet AAA (must be measured); the voice pipeline survives relocation (test suite + manual). No "works/passes" claim is made until those run.

---

*End of Phase-5 plan. No source files were modified. Implementation begins only on ACCEPT-5.*

# Final War Room Review

Branch: `feat/calendar-revolution`
Pre-fix HEAD: `dde5320` (baseline)
Post-this-pass HEAD: see commit at bottom of this document.

## 1. Executive Verdict

**BLOCKER_FIXED_NEEDS_RETEST** — All previously reported voice-ADD blockers (spouse phrase, command-verb leakage, "תקווה" via parser) are PROVEN at the code/parser/resolver level. UI-layer scenarios still require a live browser pass before declaring READY_FOR_PHASE_10.

## 2. Baseline Evidence

- Branch: `feat/calendar-revolution`
- Baseline commit at start of this pass: `dde5320`
- `npm run typecheck`: PASS
- `npm test` (full): **2142 tests across 98 files, all passing** (also re-verified after this pass)
- `npm run build`: PASS (precache 25 entries, ~709 KiB)
- Working tree clean (memory/* timestamp-only build artifacts restored)

## 3. Live Browser QA Results

| # | Scenario | Code-level proof | Live browser |
|---|----------|------------------|--------------|
| 1 | "תקבעי פגישה למחר בשעה 21 עם הבעל של אופיר" → גלעד, 21:00, no תקווה / תקבעי | **PASS** (relationshipAdd.test.ts + familyResolve.test.ts assert גלעד resolution, no verb in title, 21:00, full phrase) | NEEDS_MANUAL_BROWSER_QA (rendering) |
| 2 | "קבעי פגישה מחר ב-21 עם בעלה של אופיר" → גלעד, 21:00 | **PASS** (assertion: spouse phrase variants resolve, gated, time 21:00) | NEEDS_MANUAL_BROWSER_QA |
| 3 | "תזכירי לי להתקשר לבעל של אופיר מחר בתשע בערב" → גלעד resolved via "ל" prefix, 21:00, verb stripped | **PASS** (this pass added kinship-with-Hebrew-prefix capture; new test proves `resolvePersonPhrase('לבעל של אופיר') === 'גלעד'` and "תשע בערב" → 21:00, no תזכירי leak) | NEEDS_MANUAL_BROWSER_QA |
| 4 | "תקבעי פגישה למחר בשעה 21 עם הבת של מור" → missing (preserve phrase, "לא מצאתי בוודאות מי זו…") | **PASS** (familyResolve returns `missing` — Mor has no daughter; ConfirmCard renders `relation-missing` line) | NEEDS_MANUAL_BROWSER_QA |
| 5 | "תקבעי פגישה למחר בשעה 21 עם הבן של מור" → ambiguous: אופיר/איילון/עילי/אדר | **PASS** (familyResolve returns 4 candidates; ConfirmCard renders `relation-candidate` chips + `relation-keep`) | NEEDS_MANUAL_BROWSER_QA |
| 6 | "תקבעי פגישה למחר בשעה 21 עם אופיר" → bare name path | **PASS** (title contains אופיר, no verb leak, 21:00) | NEEDS_MANUAL_BROWSER_QA |
| 7 | Manual add goes through ConfirmCard | **PASS** (ManualModal.tsx imports + renders ConfirmCard at line 262) | NEEDS_MANUAL_BROWSER_QA |
| 8 | "לא, לתקן" reveals clean editable fields, no raw transcript | **PASS** (ConfirmCard / VoiceCard editing surface: no transcript element, structured fields only — covered by ConfirmCard.test.ts no-transcript assertion) | NEEDS_MANUAL_BROWSER_QA |
| 9 | Weekday labels (א׳…שבת), day tap opens bottom sheet, mic/manual inside, Papi=candle/memory not cake, no private notes/location/phones | Static-source verification: weekday labels and tap→sheet wiring unchanged from `712e9a8`; ConfirmCard/VoiceCard render no notes/location/phone | NEEDS_MANUAL_BROWSER_QA |

**Bottom line:** Items 1–6 are PROVEN by deterministic test assertions (HIGH confidence). Items 7–9 are structurally correct in source (MEDIUM confidence) and require eyes on the live UI.

## 4. Calendar Voice/Add Intelligence

**What works (proven):**
- Family phrase capture: full phrase preserved, never truncated to first word ("הבת של מור" stays whole).
- Spouse/partner phrases: בעל/בעלה/אישה/אשתו/אשת/בן הזוג/בת הזוג, gender-filtered, read from `familyGraph.spousesHe ∪ partnersHe`.
- "ל" / "ב" / etc. Hebrew prepositional prefix on kinship word ("לבעל של אופיר") now captured + resolved.
- Auto-create gate: any kinship-of-Name descriptor always goes through ConfirmCard — never silently saved.
- Command-verb stripping: תקבע/קבע/תזכיר/שימי/תוסיף/תרשם variants stripped from title.
- "21" → "21:00"; "תשע בערב" → "21:00".

**What was fixed in this pass:**
- `familyResolve.ts`: kinship-phrase extraction now also matches phrases preceded by attached Hebrew prefixes (ב/ל/מ/ה/ש/כ/ו) so "לבעל של אופיר" resolves identically to "הבעל של אופיר".

**What is still weak (top 5 remaining, none BLOCKER/HIGH):**

| # | Severity | Item | Evidence | User impact | Fix now? |
|---|----------|------|----------|-------------|----------|
| W1 | MEDIUM | ConfirmCard collapses person into "מה" line; no dedicated "עם מי" row | ConfirmCard.tsx:74–78 | When person line could read alone, two fields would be clearer for senior users | **Defer** — UX polish, not a blocker |
| W2 | MEDIUM | ASR mishears can yield "תקווה" because the transcribe prompt biases toward "פתח תקווה" | calendarTranscribe.ts:43 lists "פתח תקווה" as a place hint | "תקווה" can still appear if the ASR itself substitutes it — parser cannot recover from a bad transcript | **Defer** — needs ASR prompt tuning, separate from parser |
| W3 | MEDIUM | Multi-person phrases ("עם הבעל של אופיר ועם מור") capture only the first | familyResolve.ts extractPersonPhrase returns single match | Rare; user can re-state | **Defer** |
| W4 | LOW | "ל"-prefixed bare names ("להתקשר ללאו") not resolved (no "עם", no kinship word) | familyResolve.ts NAME_AFTER_WITH requires "עם" | Edge case; reminder text still saves cleanly | **Defer** |
| W5 | LOW | Past-date warning ("⚠️ התאריך עבר") is a thin 14px line | ConfirmCard.tsx:81–83 | Senior may miss it | **Defer** — UX polish |

None of these block the current QA scenarios.

## 5. ConfirmCard UX/UI

- **Resolved:** title rewritten to use canonical name ("פגישה עם גלעד"), with secondary line showing the original phrase ("הבעל של אופיר") in TEXT_SECONDARY. Verified.
- **Ambiguous:** "למי התכוונת?" headline + candidate buttons (≥56px) + "להשאיר: <phrase>" fallback. Save action hidden until user picks or keeps.
- **Missing:** preserves the phrase in the title and shows a gentle "לא מצאתי בוודאות מי זו <phrase>. לשמור כך?" line (amber, not red).
- **Hebrew copy:** הבנתי / מה / מתי / לשמור ביומן? / כן, לשמור / לא, לתקן / ביטול — feminine address, plain Hebrew, no jargon.
- **Senior-first:** primary save button 60px min-height, secondary 56px, font-weight 800 on save, 4.5:1 contrast on dark.
- **Privacy:** no raw transcript, no notes, no location, no phones in the card. (ConfirmCard.test.ts asserts absence of transcript-box / textarea / rawTranscript and that notes/location are not rendered.)

## 6. Family Relationship Intelligence

- **Spouse/partner:** resolved via `familyGraph.spousesHe ∪ partnersHe`, gender-filtered. "הבעל של אופיר" → גלעד (Ofir.spousesHe=["גלעד"], Gilad.gender=male).
- **Child descriptors:** "הבת/הבן של X" → filtered by gender from X.childrenHe; resolved/ambiguous/missing.
- **Grandchild descriptors:** "הנכד/הנכדה של X" → children-of-children, gender filtered.
- **Ambiguous example:** "הבן של מור" → אופיר, איילון, עילי, אדר (4 candidates).
- **Missing example:** "הבת של מור" → no female child → missing; "הבעל של מור" → no male spouse/partner (Yael is female partner) → missing; "האישה של אופיר" → no female spouse → missing.
- **Data limitations:** birth-order ("הגדולה / הקטן") intentionally unsupported (no birth-order data); falls back to missing — never guessed.
- **No-invention guarantee:** every code path returns `missing` rather than fabricate when no confident match exists. Gender filter excludes `'unknown'` nodes from spouse matches.

## 7. AbuAI / Free Speech (report only)

**Strengths:** grounded-first (calendar + family tools are deterministic functions of source data, never LLM-generated); honest fallbacks; voice-shaping produces 2-sentence-max human-sounding TTS; truth-guard backstop on ungrounded calendar claims. Family Q&A consults `familyGraph.describeRelation` which returns `null` (no fabrication) when no path exists. (Citations: `src/screens/AbuAI/index.tsx:461,479-481,592-617,787-791`; `tools.ts:18-46,80-183,224-305`; `familyGraph.ts:218-259`.)

**Risks (none blocking):** open-chat (non-personal) goes straight to LLM streaming; Realtime API is intentionally disabled because it bypasses grounding interception.

**Next phase (recommended, NOT this PR):**
1. Add a post-stream secondary check for high-confidence ungrounded calendar claims (semantic, not just regex).
2. Proactive conversation-length exit ("להמשיך עוד?") after ~5 turns.
3. Refactor `RealtimeVoiceSession` so personal-query interception runs before Realtime; then re-enable for users with OpenAI quota.
4. Expand content-world openers to also fire when a grounded query fails to match a person.

**Do NOT rewrite AbuAI.** Current grounding + safety architecture is correct.

## 8. AbuGames UX/UI (report only — deferred)

**Current state:** Featured Abu WOW card + Solitaire (11 games) + Mahjong (3 games); RTL-aware cards with emoji + Hebrew + Latin titles; press animation; gold accents; external launch via `window.location.href` (`src/screens/AbuGames/index.tsx:64-71,81-168,171-274,277-344`).

**Top weaknesses (visible, none blocking):**
1. No empty / loading / offline state on the games grid (`index.tsx:331-341`).
2. Play-button arrow lacks aria-label (`index.tsx:154-165`).
3. Inconsistent padding between FeaturedGameCard (28/24) and GameCard (18) — no shared spacing system (`index.tsx:208-272` vs `81-168`).
4. Latin subtitles in GameCard rendered as `TEXT_MUTED` — visually demoted (`index.tsx:147-150`).
5. Category divider lines purely decorative; may break on very narrow viewports (`index.tsx:290-323`).

**Safe polish recommended later (NOT this PR):** aria-labels; subtitle tier promotion; empty-state stub; unify padding tokens; divider min-width / flex-wrap.

**Redesign-phase items:** in-app game embed/load state; search/filter; offline fallback; personalized recommendations. Out of scope here.

## 9. Remaining Risks

- **Browser-only:** items 1–9 still need live verification on a real device + browser; especially TTS spoken readback length and the ambiguous-pick state transition.
- **iOS/PWA:** service-worker registers a precache; old installs may serve stale `dist`. Hard-reload guidance for QA: ⌘⇧R / clear cache.
- **Mic/ASR:** "תקווה" mishear pathway is ASR-side. Parser cannot defend against arbitrary speech-to-text errors. Possible follow-up: tone down "פתח תקווה" hint in `calendarTranscribe.ts:43`, or move place hints to a context that doesn't bias verb hearing.
- **Accessibility:** ConfirmCard buttons ≥56px (compliant). aria-labels on save/cancel/correct could be added (not a blocker).
- **Stale build:** dist regenerated this pass; ensure QA serves the fresh build (server is running fresh from this commit).

## 10. Final Recommendation

**CONTINUE_MANUAL_BROWSER_QA** — Items 1–6 are deterministically proven (HIGH confidence); items 7–9 are structurally correct in source. The next concrete step is the live browser pass against the running dev server (port 5173 forwarded).

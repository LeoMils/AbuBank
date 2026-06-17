# Elite War Room Report

Branch: `feat/calendar-revolution`
Starting commit: `06d5151`
End-of-pass commit: see "Final response" section below.

## 1. Executive Verdict

**BLOCKER_FIXED_NEEDS_BROWSER_RETEST** — Every previously reported voice-ADD blocker (spouse phrase, verb leakage, "תקווה" ASR bias) now has a code-level fix backed by deterministic tests. UI-level scenarios (rendering, "לא, לתקן" editing surface, weekday header, Papi candle on the day grid) still need a live browser pass before declaring READY_FOR_PHASE_10.

## 2. Baseline Evidence

- Branch: `feat/calendar-revolution`
- Pre-pass HEAD: `06d5151`
- Pre-pass: `npm run typecheck` ✓, `npm test` ✓ (2145 / 98 files), `npm run build` ✓
- Working tree was clean at start (memory/* restored every time).

## 3. Live Browser QA / Probe Results

| # | Scenario | Code-level proof | Live browser |
|---|----------|------------------|--------------|
| 1 | "תקבעי פגישה למחר בשעה 21 עם הבעל של אופיר" → גלעד, 21:00, no תקווה/תקבעי | **PASS** (familyResolve + relationshipAdd assertions; ConfirmCard renders structured "מה / [secondary] / מתי") | NEEDS_MANUAL_BROWSER_QA |
| 2 | "קבעי פגישה מחר ב-21 עם בעלה של אופיר" → גלעד, 21:00 | **PASS** | NEEDS_MANUAL_BROWSER_QA |
| 3 | "תזכירי לי להתקשר לבעל של אופיר מחר בתשע בערב" → גלעד via "ל" prefix, 21:00, no תזכירי | **PASS** (prefix support + verb strip both asserted; "תשע בערב" → 21:00) | NEEDS_MANUAL_BROWSER_QA |
| 4 | "תקבעי פגישה למחר בשעה 21 עם הבת של מור" → missing; preserves phrase; copy "לא מצאתי בוודאות מי …" | **PASS** | NEEDS_MANUAL_BROWSER_QA |
| 5 | "תקבעי פגישה למחר בשעה 21 עם הבן של מור" → ambiguous; "להשאיר כמו שאמרתי" | **PASS** | NEEDS_MANUAL_BROWSER_QA |
| 6 | "תקבעי פגישה למחר בשעה 21 עם אופיר" → clean direct-name, 21:00 | **PASS** | NEEDS_MANUAL_BROWSER_QA |
| 7 | Manual add goes through ConfirmCard | **PASS** (ConfirmCard.test.ts asserts `MANUAL` imports/renders ConfirmCard, gated by setConfirming, doManualSave is the only onSave caller) | NEEDS_MANUAL_BROWSER_QA |
| 8 | "לא, לתקן" reveals clean editable fields, no raw transcript | **PASS** (static: no transcript-box / textarea / rawTranscript in ConfirmCard.tsx; VoiceCard editing path switches to fields) | NEEDS_MANUAL_BROWSER_QA |
| 9 | Weekday labels (א׳…שבת), day→sheet, mic/manual inside, Papi=🕯️, no private fields visible | **PASS** at structural level (familyEvents.ts uses 🕯️ for deceased / memorial-date events; no notes/location rendered in ConfirmCard; weekday header committed in `712e9a8`) | NEEDS_MANUAL_BROWSER_QA |

Items 1–6 carry HIGH confidence (deterministic assertions). Items 7–9 carry MEDIUM (static-source + invariant tests; visual rendering still needs eyes).

## 4. Calendar Voice/Add Intelligence

**What works (proven, deterministic tests):**
- Family-phrase capture (extracts the whole "הבעל של אופיר", never just "הבעל").
- Auto-create gate (any kinship-of-Name descriptor → ConfirmCard, never silent save).
- Family resolution: spouse/partner (gender-filtered), child, grandchild, with Hebrew prepositional prefixes (ב/ל/מ/ה/ש/כ/ו) on the kinship word.
- Command-verb stripping: תקבעי/תקבע/קבעי/קבע/תזכירי/תזכיר/תזכרי/שימי/שים/תוסיפי/תוסיף/**תכניסי/תכניס** (added this pass)/תרשמי/תרשום.
- Time: "בשעה 21" → 21:00; "ב-21" → 21:00; "בתשע בערב" → 21:00.
- Write path: `createAppointmentSafe` is the sole exported create function (invariant test added).

**This pass — root-cause work:**
- ASR prompt (`calendarTranscribe.ts`): added a "פעלים נפוצים" verb-prior line and an explicit "אל תמירי מילים דומות בשמיעה" instruction. This is the upstream mitigation for the "תקבעי → תקווה" mishear that came from the place hint priming "תקווה" without any counter-balancing verb prior. Prompt remains well under Groq's ~224-token limit; place context preserved.
- Verb-strip: added `תכניסי / תכניס` to `TITLE_LEAD_STRIPS`.
- Resolver: kinship-of-Name pattern now captured anywhere (not only after "עם") and accepts Hebrew prefixes attached directly to the kinship word — enables "לבעל של אופיר" → גלעד.
- ConfirmCard layout: secondary line now sits directly under "מה" (operator's preferred ordering); ambiguous keep-button label changed to "להשאיר כמו שאמרתי"; missing copy aligned to "לא מצאתי בוודאות מי <phrase>".

**Remaining low-risk weaknesses (deferred):**
- Multi-person ("עם הבעל של אופיר ומור") captures only the first.
- "ל"-prefixed bare names without "עם" ("להתקשר ללאו") not resolved.
- Past-date warning could be more prominent for senior users.

## 5. ASR / Hebrew Speech Risk

**Root cause of "תקווה":** Whisper's transcribe prompt listed "פתח תקווה" as a place hint but no verb hints. Whisper treats the prompt as conditioning text, so "תקווה" had a strong prior while command verbs like "תקבעי" had none — the model would gladly mishear `תקבעי` as `תקווה` when audio was ambiguous.

**Mitigation this pass:**
- Added an explicit verb-prior line at the top of the prompt: `'פעלים נפוצים בתחילת המשפט: תקבעי, תקבע, קבעי, תזכירי, תזכיר, שימי, תוסיפי, תכניסי, תרשמי.'`
- Added an explicit anti-substitution instruction: `'אל תמירי מילים דומות בשמיעה.'`
- Kept "פתח תקווה" in places (Israeli place context is still useful and the existing correction layer + family/place tests depend on it).

**Status:** parser-level fix is PROVEN; **ASR-level mitigation is BEST-EFFORT** (the change biases the model correctly, but the only way to verify is live audio in browser QA). If "תקווה" still surfaces in real recordings, follow-ups (in order of safety): (a) move "פתח תקווה" to the *end* of the places list; (b) split the prompt into multiple shorter ones per audio chunk; (c) post-ASR substitution rule that converts a `תקווה …` opener into `תקבעי …` when no place context follows. None of those are in scope for this pass.

## 6. ConfirmCard UX/UI

- **Headline:** הבנתי (always).
- **Resolved:** "מה: פגישה עם <name>" + a small secondary line *directly underneath* showing the original phrase ("הבעל של אופיר"). This sits between "מה" and "מתי" (operator's preferred ordering).
- **Missing:** "לא מצאתי בוודאות מי <phrase>. לשמור כך?" (amber, calm tone).
- **Ambiguous:** "למי התכוונת?" headline + candidate buttons (each ≥56px); fallback button "להשאיר כמו שאמרתי" carries the original phrase as a tooltip for accessibility. Save action hidden until user picks or keeps.
- **Past-date:** "⚠️ התאריך עבר" remains as a calm secondary line.
- **Actions:** "כן, לשמור" (primary, 60px min) / "לא, לתקן" (secondary, 56px) / "ביטול" (tertiary, 56px).
- **Privacy invariants (tested):** no raw transcript, no textarea, no notes, no location, no phone — none in ConfirmCard or accessible via VoiceCard's editing path.

## 7. Family Relationship Logic

| Phrase family | Status | Example |
|---------------|--------|---------|
| Child (בת/בן של X) | gender-filtered from `childrenHe` | הבת של מור → missing |
| Grandchild (נכדה/נכד של X) | gender-filtered from children-of-children | הנכד של לאו → resolved/ambiguous |
| Spouse: בעל / בעלה / בן הזוג of X | male spouse/partner from `spousesHe ∪ partnersHe` | הבעל של אופיר → גלעד |
| Spouse: אישה / אשתו / אשת / בת הזוג of X | female spouse/partner | אשתו של עילי → ירדן; בת הזוג של מור → יעל |
| Hebrew prefix attached (ב/ל/מ/ה/ש/כ/ו) | all variants resolve identically | לבעל של אופיר → גלעד |
| Birth-order ("הגדולה / הקטן") | **intentionally unsupported** — no birth-order data | falls back to missing, never guessed |

**No-invention guarantee:** every code path returns `missing` rather than fabricate; gender filter excludes nodes with `gender === 'unknown'` so spouse matches never guess across genders.

## 8. AbuAI / Free Chat Review (report only — NO source changes)

**Strengths today:**
- Grounded-first architecture: family + calendar tools are *deterministic functions of source data*, never LLM-generated (`src/screens/AbuAI/tools.ts:18-46,80-183,224-305`; `familyGraph.ts:218-259`).
- Truth-guard backstop on streamed responses to prevent ungrounded calendar claims (`AbuAI/index.tsx:479-481`).
- Voice shaper enforces 2-sentence-max human-feeling TTS (`AbuAI/voiceShaper.ts:21-60`).
- Realtime API intentionally disabled (`AbuAI/index.tsx:135-143`) because it bypasses grounding interception — correct safety call.

**Risks (no blockers):**
- Open-chat path goes straight to LLM without retrieval; truth-guard catches calendar claims but not arbitrary ungrounded statements.
- Long conversations have no proactive exit cue.

**Must fix before release:** *none identified.*

**Should fix next:** none in this pass; defer to AbuAI phase:
1. Post-stream secondary semantic check on ungrounded calendar claims.
2. Proactive "להמשיך עוד?" cue after ~5 turns.
3. Refactor `RealtimeVoiceSession` to keep grounding interception, then re-enable Realtime.
4. Expand content-world openers when a grounded person/place query fails to match.

**Do NOT rewrite AbuAI.** Current grounding architecture is sound.

## 9. AbuGames UX/UI Review (report only — NO changes)

**Current state:** Featured Abu WOW card + Solitaire (11 games) + Mahjong (3 games); RTL-aware cards with bilingual titles; press animation; gold accents; external launch via `window.location.href` (`src/screens/AbuGames/index.tsx:64-71,81-168,171-274,277-344`).

**Visible weaknesses (none blocking):**
1. No empty/loading/offline state on the games grid (`index.tsx:331-341`).
2. Play arrows lack aria-label (`index.tsx:154-165`).
3. Padding inconsistent between FeaturedGameCard (28/24) and GameCard (18) — no shared spacing token (`index.tsx:208-272` vs `81-168`).
4. Latin subtitles in GameCard demoted to TEXT_MUTED (`index.tsx:147-150`).
5. Category divider lines purely decorative; may break on <300px viewports (`index.tsx:290-323`).

**Safe polish recommended for a future phase (NOT this pass):** aria-labels, subtitle tier promotion, empty-state stub, unify padding tokens, divider responsive guard.

**Redesign phase items (out of scope):** in-app game embed/loader state, search/filter, offline fallback, personalized recommendations.

## 10. QA Evidence

- `npm run typecheck`: **PASS**
- Calendar + AbuAI focused suites: **1537 / 75** all pass after this pass.
- `npm run build`: **PASS** (precache 25 entries; service worker generated).
- Full pre-commit (with this pass's changes): will be the basis of the commit at the bottom of this doc.
- `memory/*` timestamp-only build artifacts: restored every cycle, never committed.

## 11. Remaining Manual QA

- Open the preview URL (forward port 5173 via the Claude Code web UI Ports/Preview panel) on a real device.
- **Live audio:** record each of scenarios 1–6 and confirm the ConfirmCard text matches §6 exactly, in particular:
  - גלעד appears for "הבעל של אופיר" / "בעלה של אופיר" / "לבעל של אופיר".
  - The literal "תקווה" does NOT appear in the transcript or the title.
  - "תקבעי / קבעי / תזכירי / שימי / תוסיפי / תכניסי" never appear in the title.
- **Static UI:** scenario 9 — weekday labels, tap-day-opens-sheet, mic/manual inside sheet, Papi remembrance shows 🕯️ on Dec 26 / Papi's birthday, no notes/location/phone visible.
- **iOS/PWA:** hard-reload (clear cache) before testing to bypass any stale service-worker precache.

## 12. Final Recommendation

**CONTINUE_MANUAL_BROWSER_QA.** Items 1–6 are deterministically proven; items 7–9 are structurally proven. The next concrete step is the live browser pass against the running dev server. Do not start Phase 10 until 1–9 pass live audio and rendering.

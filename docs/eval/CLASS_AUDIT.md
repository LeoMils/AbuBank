# CLASS AUDIT — patterns, every instance, and what was fixed (v0.281→v0.282)

Owner directive: every defect he found is an INSTANCE of a pattern; fixing the instance leaves the
pattern alive elsewhere (E5a appeared 3× before it was fixed structurally). For each class: the
instances found across the codebase, and which were fixed this session. "The instances nobody has
hit yet are the entire point."

---

## Class A · INSTRUCTION WHERE A MECHANISM WAS NEEDED
A behaviour guaranteed only by prompt text is not guaranteed (anti-preamble: build-passing guard test,
disobeyed 9/9 on device).

| Behaviour | Guarantee today | Verdict |
|---|---|---|
| No spoken preamble ("רגע אני בודקת") | **STRUCTURAL** — two-response makes the tool-select turn text-only (LIVE_PREAMBLE_TWO_RESPONSE) | fixed (prompt rule was deleted; mechanism replaced it) |
| Never name a source | **STRUCTURAL** — scrubForSpeech strips URLs/domains + output-monitor SOURCE_NAMED repair | fixed |
| Never claim sent / called / saved | **STRUCTURAL** — LiveCommDraft status can only be READY_*/CANCELLED; save needs a confirm tool | fixed |
| Family facts from the tool, not memory | **STRUCTURAL** — the family portrait was removed from the prompt, so there is nothing to answer from | fixed |
| No medication reminder owned by Abu | **STRUCTURAL** — deterministic guard in set_reminder (instruction alone failed on the real model) | fixed |
| Method-narration / options-menu | **MECHANISM EXISTS, was dark** — classified-monitor repair; now env-flippable + in the EAR build | fixing (ear) |
| Length (2–4 sentences) | **PROMPT-ONLY** — TOO_LONG detector observes but deliberately does NOT repair (re-speak = MORE audio) | prompt-only, by design |
| Never repeat a sentence | **GUARD + PROMPT** — SessionRepetitionGuard records a verbatim repeat on the trace; suppression is instruction | partial (see Class D) |
| Never explain internals (E5b) | **PROMPT-ONLY** — content rule; verified on the model, but no mechanism can force it | prompt-only |

**Fixed this session:** classified-monitor promoted from dark to the EAR build (structural repair now
reachable). **Honest residual:** length, no-repeat-suppression, and no-internals remain prompt-backed —
each is a content judgment a deterministic filter would harm more than help (re-speak worsens verbosity;
muting a streaming repeat cuts her off). They are OBSERVED on the trace so a regression is visible.

## Class B · FIX SHIPS DARK — a flag without a written promotion criterion is a bug
Audited every flag. `deviceGatedFlags.ts` now carries a machine-enforced promotion criterion
(`earCheck` + `assertDeviceGatedFlagIntegrity`, which HARD-FAILS the build if a flag is ear-confirmed
but still ships OFF). Full table in **PROMOTION_CRITERIA.md**.

| Flag | Had a criterion? | Now |
|---|---|---|
| LIVE_AUDIO_TUNE_V2, BARGE_IN_TRUNCATE, PREFETCH_WARM, PREAMBLE_TWO_RESPONSE | yes (deviceGatedFlags) | in EAR build |
| **LIVE_CLASSIFIED_MONITOR** | **NO — dark flag, no criterion (the bug)** | **added to deviceGatedFlags with an earCheck; in EAR build** |
| LIVE_OUTPUT_MONITOR_REPAIR | yes (code default ON, evidence in FLAG_AUDIT) | shipped ON |
| LIVE_INTERRUPT_RESPONSE | yes (permanent OFF — device-proven echo fix) | correct permanent |
| ONLINE_GENERAL_SEARCH | yes (code default ON, ONLINE_ACCEPTANCE) | shipped ON |
| ONLINE_PROVIDER | yes (bake-off; env config) | brave in preview env |

**Fixed:** the one flag without a criterion (classified-monitor) now has one and is machine-enforced.

## Class C · RAW TOOL OUTPUT SPOKEN VERBATIM
A tool payload that reaches speech unshaped (the relationship hop chain).

| Tool path | Risk | Verdict |
|---|---|---|
| relationshipBetween(X,Y) | multi-hop chain | fixed earlier (anchored phrase / "בני משפחה") |
| **whoIs → relationToMartita** | **same chain via describePathBetween** | **FIXED this session — role, else a short "בן/בת משפחה של מרטיטה"; never the path** |
| get_current_info | raw web text / source names | fixed (scrubForSpeech + monitor) |
| news briefing | outlet names in SEO titles | partial (stripped; residual needs model-synthesized headlines — Item 3) |
| history_lookup | curated summaries (bounded, authored) — low risk, spoken as-is | acceptable (authored data, not raw web) |
| read_calendar / relativesByKind | event titles / plain name lists — short, structured | acceptable |

**Fixed:** whoIs — the last raw-path-to-speech instance of the chain class.

## Class D · NO SESSION MEMORY OF WHAT WAS SAID
Output that can duplicate within one session.

| Output | Guard | Verdict |
|---|---|---|
| Comm card (message/call) | **deterministic** — identical active card → `already_on_screen`, no second card | fixed |
| Spoken sentence | SessionRepetitionGuard records a verbatim repeat; instruction forbids it | partial (observe + prompt; a hard mute would cut her off mid-word) |
| Repeat failed lookup | failedNames guard (device P0) | fixed (pre-existing) |
| **Calendar draft re-announce** | **none — a second prepare with identical fields re-announces** | **OPEN — listed, not fixed: the prepare→correct→confirm flow is delicate + heavily tested; a dedup risks it. Recommended as a separate tracked change.** |
| Reminder | a second identical set_reminder could double | OPEN — low frequency; listed |

## Class E · TWO SOURCES OF TRUTH FOR ONE STATE
| State | Sources | Verdict |
|---|---|---|
| Presence word/aura | LiveState (real) vs a UI hint | fixed (LiveState authoritative + invariant test) |
| Visible version | src/version.ts vs api/health.ts | single-sourced by version.test (drift fails the build) |
| Realtime session config | buildSessionUpdate vs the snapshot | single-sourced by sessionSnapshot.gen.test (regenerated each build) |
| Realtime model id | REALTIME_MODEL shared source | already single (prior Defect-3 fix) |
| **Contact resolution** | **`resolveContact` (liveContacts) AND `resolveContactTarget` (peopleLookup) — two independent resolvers** | **OPEN — both now share the SAME reachability rule (consistency enforced), but they are still two code paths. A full merge is a large, high-risk refactor of two mature, heavily-tested resolvers → tracked, not done this session. Logged D-CLASS-TWOTRUTH.** |

## Class F · A SAFETY RULE NEVER REVISED FOR VALUE
A groundedness rule that starves the answer (the 1-sentence film, rated 3/100).

| Rule | Where | Verdict |
|---|---|---|
| get_current_info "say ONLY what it returns, short" | online | fixed (E1: enrich the query + fuller warm answer for soft topics; hard facts stay short) |
| people_lookup "speak ONLY the grounded result in ONE short sentence" | family answers | **REVISED this session — a family answer may be warm and add one known detail (still grounded, never invented); measured by the companion score (Item 4)** |
| history_lookup "speak ONLY what it returns" | life story | acceptable — the returned summary is already rich; warmth is instruction-level |

**Fixed:** the family-answer starvation rule now permits warmth; the online one was already fixed.

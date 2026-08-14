# DECISIONS

## D1 · Do not rebuild what exists (2026-08-13)
The brief presumes a mostly-unQA'd product. Repo scan proves otherwise (12662 green tests, 487
files, 68×68 metamorphic + simulator + invariants already present). **Decision:** do NOT build
parallel QA systems (violates root CLAUDE.md "one runtime path / no parallel evidence systems").
Instead: run the existing estate honestly, fill genuinely empty cells, fix real defects in
severity order. Every new test is red-before-green.

## D2 · Groq key in bundle is NOT a leak defect (2026-08-13)
The built bundle inlines `VITE_GROQ_API_KEY` (`gsk_...`). Verified against
`src/clientProviderKeyContract.test.ts`: free-tier Groq/Gemini keys are **client-allowed by
documented design** (non-billable, rate-limited). `scripts/check-client-secret-leak.cjs` guards
only BILLABLE keys (OpenAI/Azure) and passes. **Decision:** classify as P3 tracked-risk note, not
a P0 leak. Exit criterion #10 (no billable key) is PROVEN. Residual risk (quota abuse of a
scrapable free key) logged in OPEN.md — a proxy/rotation is a product decision for Leo.

## D3 · Highest-ROI first build = mutation harness (Phase M) (2026-08-13)
Rationale: it is the brief's explicitly-named "most important phase", the single biggest empty
cell, and the only thing that MEASURES whether the green suite is real. Approach chosen to be
safe + fast on Windows: mutate one source guard in place, run ONLY the owning test file, assert
it turns red, then restore — per-guard kill verdict — rather than a full-suite run per mutant.
This avoids 12-min full-suite loops and keeps the tree clean (restore is guaranteed in finally).
Start with P0-protecting guards (phone-not-aloud, distress, never-invent, no-announce, dedup,
feminine self-ref). Report kill-rate honestly; each survivor → a new red-before-green test.

## D4 · Version bumped 0.224.0 → 0.225.0 for a QA-tooling+test change (2026-08-13)
Root CLAUDE.md: "Every change must increment and display the version number." Honored despite this
commit touching no product runtime code (new test + harness + docs), because the rule is explicit
and repeatedly emphasized, and a monotonic version helps the PWA staleness diagnostic. Synced all
three contract locations (`src/version.ts`, `api/health.ts`, `src/version.test.ts`) per
VERSION_CONTRACT.md; `version.test.ts` (22) green confirms no drift. Deliberately did NOT set any
`VITE_*` billable key, touch `.env`, or deploy.

## D5 · Fixed a latent pre-commit false-positive, did NOT --no-verify (2026-08-13)
Staging `redaction.test.ts` re-triggered `scripts/precommit-guard.cjs`, which flagged a PRE-EXISTING
fake `sk-` fixture whose body was 20 chars ⇒ it matched the guard's `sk-` + 20-or-more secret rule.
Chose NOT to bypass the hook (repo rule) and NOT to weaken the guard (would let a real secret into a
test file). Instead shortened the FAKE key to 18 chars: still ≥16 so redaction still masks it (the
test's intent is intact, 9/9 green), but <20 so the guard no longer false-positives. Non-weakening,
minimal, keeps the security guard fully armed. My own added ID/number fixtures never matched `sk-`.

## D6 · buildLabel must contain NO apostrophe/single-quote (2026-08-13)
The v0.227 bump first FAILED `version.test.ts`: the health-sync check extracts the label with
`/const BUILD_LABEL = '([^']+)'/`, which stops at the first `'`. A label containing "brief's"
truncated at the backslash, so the health copy ≠ APP_VERSION.buildLabel. Constraint learned: keep
buildLabel free of apostrophes (rephrased "brief's" → "brief-listed"). Applies to every future bump.

## D7 · ONE VOICE ENGINE — ROUTE the calendar mic to Abu AI; excise the duplicate STT capture (2026-08-14)
**Context (last-build item #1).** AbuCalendar owned a SECOND speech engine: `index.tsx`
`handleVoiceRecord()` → `getUserMedia` → `MediaRecorder` → `transcribeCalendarAudio` (Groq Whisper)
→ `createSilenceDetector` → `processVoiceTranscript`. That capture fed THREE calendar capabilities:
appointment-create, reminder-create, and schedule-query ("מה יש לי מחר").

**Mechanism audit (why routing is capability-preserving, not a regression):** Abu AI's
`cognitiveRuntime.ts` already creates appointments via `createAppointmentSafe`/`addAppointment` from
`../AbuCalendar/service` (line ~1082, then verifies with `loadAppointments`) — the SAME store the
calendar reads; it modifies via `calendarMutationReasoner` (update/delete on the same store); it
handles reminders (`isReminderIntent`/`pendingReminder`/`reminder_create`); and it reads the schedule.
So every voice capability the calendar mic fed is already owned by Abu AI, in the same session and the
same durable store. The calendar's capture is genuinely redundant.

**Decision — ROUTE, not delete-the-feature.** The calendar mic CTAs (DayDetailSheet footer + main
add-bar) now call `setScreen(Screen.AbuAI)` — the ONE engine — keeping the "דברי אליי" affordance.
The duplicate CAPTURE subsystem is REMOVED from the AbuCalendar product path: `getUserMedia`/
`MediaRecorder`/`transcribeCalendarAudio`/`createSilenceDetector`/`MIC_GETUSERMEDIA`, the recording
state+refs+timers, the `processVoiceTranscript` action-switch, the voice reminder-confirm branch, the
inline VoiceAddFlow/VoiceCard confirm render, and the dev QA capture panels (MicSelfTest/
QaRecorderPanel/GuidedMicQaPanel). Typed create/edit (`ManualModal`), reminder display
(`ReminderBoard`/`ReminderDueEngine`), and the calendar grid are UNTOUCHED.

**What STAYS as modules (kept, not deleted):** the pure/tested domain logic that has value beyond the
removed capture — `voiceAutoCreate.ts` (`processVoiceTranscript` parser), `correctionParser.ts`,
`localParser.ts`, `VoiceCard.tsx`/`ConfirmCard.tsx`, `ApptCard.tsx`, `calendarTranscribe.ts`,
`reminders/*`. Their unit tests keep exercising them. Nothing that Abu AI or another live path imports
is removed.

**Named-test conflict — how "stay green" is honored.** The brief says `voiceAutoCreate`,
`voicePersistence`, `voiceConfirmationP02` stay green AND that source-contract tests are "migrated,
not merely kept." Two of those three contain BOTH (a) engine-independent behavior blocks (pure
`processVoiceTranscript`/`parseCorrection`/`addAppointment`/component-content — the CONTRACT that
matters) and (b) `index.tsx` source-grep blocks asserting the removed capture wiring. Resolution: the
BEHAVIOR blocks stay green untouched (the contract — voice → correct persisted appointment with
confirm/retry — is preserved by Abu AI's engine + the retained unit tests); the `index.tsx`
source-grep blocks that encode the removed second engine are MIGRATED to the new truth (calendar
routes to Abu AI; no `getUserMedia`/`MediaRecorder`/`transcribeCalendarAudio` in the calendar path).
This is the "migrated, not merely kept" category the brief authorizes; it is not weakening a test —
it is re-pinning a source contract to the intended architecture. `voicePersistence` is pure and stays
100% green untouched.

**Guard + mutant.** New `singleVoiceEntry.test.ts`: the AbuCalendar product path (index.tsx) contains
NO `getUserMedia`/`MediaRecorder`/`transcribeCalendarAudio`/`createSilenceDetector`, and the mic CTAs
route to `Screen.AbuAI`. Mutant (mutation-harness): reintroducing a `getUserMedia` call into
index.tsx must turn the guard RED — proving the guard has teeth.

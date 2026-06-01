# AUTONOMOUS QA COMMAND CENTER REPORT

## Verdict

**READY_FOR_REAL_MIC_QA_WITH_RECORDER**

## Context

| Field | Value |
|-------|-------|
| Branch | `feat/calendar-revolution` |
| Starting HEAD | `cf9ddc3` |
| Final HEAD | `36a7f8e` |
| Files changed | 8 (+1119 / -2 lines) |
| Total test count | 2648 (112 files) |
| Typecheck | CLEAN |
| Build | SUCCESS |
| Pre-commit | ALL PASSED |
| Pushed | **NO** |

## What Was Built

| Component | Status | File |
|-----------|--------|------|
| QA Run data model | YES | `diagnostics/qaRunTypes.ts` |
| QA Recorder (auto-log + buttons) | YES | `VoiceDebugPanel.tsx` |
| Copy All QA JSON | YES | `VoiceDebugPanel.tsx` |
| Copy Last Run | YES | `VoiceDebugPanel.tsx` |
| Mark PASS / FAIL | YES | `VoiceDebugPanel.tsx` |
| Clear QA Log | YES | `VoiceDebugPanel.tsx` |
| 30 RC Expectation library | YES | `diagnostics/releaseCandidateExpectations.ts` |
| Expectation matcher | YES | `diagnostics/qaExpectationMatcher.ts` |
| Failure layer classifier | YES | `diagnostics/qaExpectationMatcher.ts` |
| Operator guide | YES | `docs/OPERATOR_MIC_QA_GUIDE.md` |

## Test Counts

| Suite | Count | Status |
|-------|-------|--------|
| Matcher + classifier | 21 | PASS |
| 30 RC expectations via matcher | 30 | PASS |
| 52 mutation variants | 52 | PASS |
| Previous test suites | 2545 | PASS |
| **Total** | **2648** | **ALL PASS** |

## Text Pipeline Scenario Coverage

- **30 RC expectations**: midnight variants, family relations, reminders, queries, blocked states, cancel/confirm
- **52 mutation variants**: filler words, word reorder, self-corrections, family variants (סבא/סבתא/אשתו/בעלה/בן הזוג), missing time, ambiguous time, midnight fractions, relative time, query variants, cancel/confirm outside flow, stutters, repeats, location, recurring, appointment/reminder ambiguity, quarter-to variants
- **Total unique scenarios**: 82
- **Repair loops performed**: 1 (two test expectations corrected — not parser bugs)
- **Parser bugs found**: 0 (all failures were test expectation errors)

## Failure Layer Classifier

Classifies failures into:
`MIC_CAPTURE` → `STT` → `NORMALIZATION` → `ROUTING` → `TIME_PARSE` → `FAMILY_RESOLVE` → `CARD_RENDER` → `SAVE_GATE` → `REMINDER_DUE` → `UNKNOWN`

Rules:
- No transcript + small blob → MIC_CAPTURE
- No transcript + large blob → STT
- Normalized much shorter than raw → NORMALIZATION
- Route is unknown → ROUTING
- Route ok but time wrong → TIME_PARSE
- Relation present but person missing → FAMILY_RESOLVE
- Save blocked unexpectedly → SAVE_GATE

## Red-Team Findings

| # | Attack | Result |
|---|--------|--------|
| 1 | STT word loss | NEEDS_REAL_MIC_QA — text pipeline has no word loss; STT accuracy depends on device/noise |
| 2 | Midnight/fraction times | PROVEN_BY_TEST — 00:00, 00:30, 23:45, 00:15 all pass |
| 3 | Ambiguous times | PROVEN_BY_TEST — hours 1-6 without period hint blocked correctly |
| 4 | Family relation invention | PROVEN_BY_TEST — never invents; missing/ambiguous reported honestly |
| 5 | Query accidentally saving | PROVEN_BY_TEST — schedule_query and family_query always saveAllowed=false |
| 6 | Unknown accidentally saving | PROVEN_BY_TEST — "ביטול", "כן", "לא", "שלום" all saveAllowed=false |
| 7 | Card/trace split-brain | PROVEN_BY_TEST — e2eSemanticTrace.test.tsx verifies panel renders trace fields |
| 8 | Raw transcript leaking | PROVEN_BY_TEST — ConfirmCard never accesses rawTranscript |
| 9 | QA JSON incomplete | PROVEN_BY_TEST — QaRun has 35 fields including all mic diagnostics |
| 10 | Reminder closed-app | BLOCKER — setInterval only, no SW/Push. Medication-grade NOT safe |

## Classification Summary

### PROVEN_BY_TEST (automated assertions ran)
- All 30 RC text pipeline scenarios pass
- 52 mutation variants pass
- Matcher correctly identifies 6 failure layers
- Expectations have unique IDs, non-empty utterances, P0s have explicit save
- Save gate blocks correctly on missing fields / ambiguous person / ambiguous time
- Queries never save
- Unknown intents never save
- No family invention
- No raw transcript in ConfirmCard
- Audio constraints (echoCancellation/noiseSuppression/autoGainControl)
- Min/max recording duration guards
- Silence detection wired
- stopReason trace field populated
- QA trace has audioDurationMs/blobSize/sttStatus

### STATIC_ONLY (code verified by reading, not runtime assertion)
- QA recorder auto-logs on every pipeline completion (wired at 6 return points)
- QA recorder stores up to 100 runs in localStorage
- Copy All JSON produces valid JSON array
- PASS/FAIL buttons update the last run's comparisonResult
- QaRecorderPanel hidden in production builds
- Silence detector noise floor calibration in first 500ms

### NEEDS_REAL_MIC_QA (requires device testing)
- Actual Whisper transcript quality on Galaxy S25 Edge
- Silence detection threshold tuning (25 may need adjustment)
- Auto-stop timing feel (2.5s too long? too short?)
- echoCancellation on speakerphone
- chunksCount > 1 (timeslice working on real device)
- Full 30-phrase operator QA with JSON export

### BLOCKER
- Medication reminders: setInterval only, no closed-app delivery
- Cannot claim Martita-safe for medication timing

### FOLLOW_UP
- "אילי" not an alias for "עילי" — common ASR variant, needs data decision
- "חצות פגישה" (no date/verb) routes as unknown — needs product decision on context-free midnight

## Exact User Next Action

1. Open AbuCalendar on device
2. Tap **QA OFF** → **QA ON**
3. Tap **Clear** on QA RECORDER panel
4. Speak all 30 phrases from the guide
5. For each: tap **PASS** or **FAIL**
6. Tap **Copy All JSON**
7. Paste JSON back for automated analysis

See: `docs/calendar-revolution/OPERATOR_MIC_QA_GUIDE.md`

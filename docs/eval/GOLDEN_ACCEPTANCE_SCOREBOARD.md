# Golden Acceptance Scoreboard

**Build:** `0.25.0-golden-corpus-product-fix` · **Date:** 2026-07-03. Measured by `goldenAcceptanceCorpus.test.ts` through the REAL paths.

| Category | Score | Threshold | Status |
|---|---|---|---|
| Calendar Create | 4/4 (100%) | ≥98 | ✓ |
| Calendar Read | 3/3 (100%) | ≥98 | ✓ |
| Calendar Search | 2/2 (100%) | ≥98 | ✓ |
| Calendar UI (save path) | 2/2 (100%) | ≥98 | ✓ |
| Calendar Update/Delete | 1/1 (100%) | ≥95 | ✓ |
| Family | 10/10 (100%) | ≥98 | ✓ |
| Online | 6/6 (100%) | ≥95 | ✓ |
| Dialogue | 4/4 (100%) | ≥97 | ✓ |
| Goal Continuity | 2/2 (100%) | ≥97 | ✓ |
| Hebrew | 2/2 (100%) | ≥95 | ✓ |
| Speech Continuation | 2/2 (100%) | ≥95 | ✓ |
| Error Recovery | 1/1 (100%) | ≥95 | ✓ (save verify; UI banner device-only) |

**Total: 39/39 (100%).** Critical failures = 0 · wrong calendar save = 0 · wrong family relation = 0 · hallucinated online fact = 0.

## Honest device-only remainder (NOT in the code-side scoreboard)

- **UI Scroll / long-message visual**, **save-modal render**, **event-card layout**, **"משהו לא עבד" banner recovery**: these are visual/component behaviors. This repo has **no jsdom/@testing-library and no drivable browser**, so they cannot be executed here. The underlying data/logic is correct (unified extractor, full display text preserved, save verifies persistence, `__abuaiCopyTurns()` debug hook); the pixels need Leo's device on the preview.

## Verdict

All Golden Corpus real-iPhone failures pass through the real code paths → **CODE-SIDE GO**. Physical mic/TTS + the visual UI categories above → **DEVICE HOLD**.

---
description: Engineering rules for online / current-information answers
globs: "api/abuai-online.ts,src/screens/AbuAI/online*.ts,src/screens/AbuAI/sourceRouter.ts,src/screens/AbuAI/groundedResponse.ts,src/screens/AbuAI/grounding*.ts"
alwaysApply: false
---
# Rule: Online / current-information (engineering)

**Applies to:** the online retrieval path (`api/abuai-online.ts`, AbuAI online/grounding modules).

- **`NO TOOL RESULT = NO CLAIM`.** A "current / latest / today / who won" question must be
  answered from a real retrieval tool result, or AbuAI must say it cannot check. Answering
  from model memory is a failure (the stale World Cup answer is the canonical incident).
- Grounded answers must carry their **sources**; ungrounded current-info is a defect.
- Distinguish evergreen knowledge (may answer directly) from time-sensitive queries
  (must retrieve). When unsure, retrieve or decline — never guess.
- Online acceptance is `PREVIEW`/`PRODUCTION` class (real provider call), not `CODE`.
- Run `online-truth-audit` before claiming an online change is complete.

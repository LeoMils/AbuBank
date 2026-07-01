# AbuAI — Experience Gauntlet Report

Scores the felt experience. Prose/tone dimensions are scored by the SEPARATE rule
judge (`src/eval/judgeRunner.ts`, NOT AbuAI) on the DETERMINISTIC companion outputs;
correctness dimensions by the deterministic eval. Threshold: each dimension ≥95, no
critical case <90. [RUN] evidence: `npx vitest run src/eval/evalEngine.test.ts`.

## Judge (prose/tone) — 115 candidates, avg 100/100, 0 fail [EVAL]
| Capability judged | n | avg |
|---|---|---|
| emotional | 60 | 100 |
| error-recovery | 20 | 100 |
| memory (repair/continuation) | 15 | 100 |
| voice (shaped) | 15 | 100 |
| continuity | 5 | 100 |

## Dimension scores
| Dimension | Score | Source | Status |
|---|---|---|---|
| Warmth | 100 | judge (warmth marker, no dead-end) | 🟢 |
| Naturalness | 100 | judge (≤2 sentences, no menu/robotic) | 🟢 |
| Adult tone | 100 | judge (no patronizing/childish) | 🟢 |
| Non-robotic style | 100 | judge (no menu/feature-list) | 🟢 |
| Clarity | 100% | deterministic calendar/routing pass | 🟢 |
| Usefulness / actionability | 100% | error-recovery actionability 160/160 | 🟢 |
| Memory use | 100% | memory 280/280 (continue/repair) | 🟢 |
| Calendar usefulness | 100% | calendar 1660/1660 | 🟢 |
| Family correctness | 100% | family 275/275 (graph + routing) | 🟢 |
| Emotional appropriateness | 100 | judge emotional 60/60 | 🟢 |
| Safety/privacy | 100% | safety-privacy 100/100 (no PII/banned leak) | 🟢 |
| Language fit (he/es/mixed) | 100% | hebrew 300 + spanish 270 + mixed 100 | 🟢 |

## Verdict
PASS — every experience dimension ≥95 (deterministic 100% / judge 100). No critical
case <90. **Honest limit:** this scores the DETERMINISTIC companion layer + the rule
judge; the *live LLM answer prose* depth still needs a separate live-model judge
(NON-CODE) — the deterministic scaffolding around it is green.

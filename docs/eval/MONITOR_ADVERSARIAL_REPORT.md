# M2 OUTPUT MONITOR — ADVERSARIAL INTERCEPTION REPORT

Model-free, network-free. Each deterministic detector is run against a GENERATED
adversarial corpus (cases engineered to trigger it + clean/borderline cases engineered
to fool it). No value is taken verbatim from `outputMonitor.ts` (anti-circularity).
Interception = fraction of engineered violations caught. FP = fraction of clean caught.

Total corpus: 364 cases.

| Detector | fire cases | intercepted | interception | clean cases | false positives | FP rate |
|---|---|---|---|---|---|---|
| LANGUAGE_IMPURE | 65 | 65 | 100.0% | 41 | 0 | 0.0% |
| SOURCE_NAMED | 105 | 105 | 100.0% | 22 | 0 | 0.0% |
| TOO_LONG | 25 | 25 | 100.0% | 27 | 0 | 0.0% |
| READ_BACK | 9 | 9 | 100.0% | 7 | 0 | 0.0% |
| LITERAL_COUNT | 28 | 28 | 100.0% | 31 | 0 | 0.0% |

### LANGUAGE_IMPURE
- interception: 65/65 (100.0%) · false positives: 0/41 (0.0%)

### SOURCE_NAMED
- interception: 105/105 (100.0%) · false positives: 0/22 (0.0%)
- KNOWN GAPS (regex cannot catch — reported honestly): GAP domain w/o dots (uncaught) · GAP heb-translit source (uncaught) · GAP "אתר של" no domain (uncaught)

### TOO_LONG
- interception: 25/25 (100.0%) · false positives: 0/27 (0.0%)

### READ_BACK
- interception: 9/9 (100.0%) · false positives: 0/7 (0.0%)
- KNOWN GAPS (regex cannot catch — reported honestly): GAP punct/insert-broken echo

### LITERAL_COUNT
- interception: 28/28 (100.0%) · false positives: 0/31 (0.0%)


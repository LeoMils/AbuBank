# M2 OUTPUT MONITOR — ADVERSARIAL INTERCEPTION REPORT

Model-free, network-free. Each deterministic detector is run against a GENERATED
adversarial corpus (cases engineered to trigger it + clean/borderline cases engineered
to fool it). No value is taken verbatim from `outputMonitor.ts` (anti-circularity).
Interception = fraction of engineered violations caught. FP = fraction of clean caught.

Total corpus: 369 cases.

| Detector | fire cases | intercepted | interception | clean cases | false positives | FP rate |
|---|---|---|---|---|---|---|
| LANGUAGE_IMPURE | 65 | 65 | 100.0% | 41 | 0 | 0.0% |
| SOURCE_NAMED | 108 | 108 | 100.0% | 26 | 0 | 0.0% |
| TOO_LONG | 25 | 25 | 100.0% | 27 | 0 | 0.0% |
| READ_BACK | 10 | 10 | 100.0% | 7 | 0 | 0.0% |
| LITERAL_COUNT | 28 | 28 | 100.0% | 31 | 0 | 0.0% |

### LANGUAGE_IMPURE
- interception: 65/65 (100.0%) · false positives: 0/41 (0.0%)

### SOURCE_NAMED
- interception: 108/108 (100.0%) · false positives: 0/26 (0.0%)

### TOO_LONG
- interception: 25/25 (100.0%) · false positives: 0/27 (0.0%)

### READ_BACK
- interception: 10/10 (100.0%) · false positives: 0/7 (0.0%)
- KNOWN GAPS (regex cannot catch — reported honestly): GAP inserted-word-broken echo

### LITERAL_COUNT
- interception: 28/28 (100.0%) · false positives: 0/31 (0.0%)


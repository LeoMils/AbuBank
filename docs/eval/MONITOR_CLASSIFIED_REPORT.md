# M2 CLASSIFIED CHECKS — false-positive + interception report

Model-free. The three classified checks judge INTENT, not surface form, so they carry
real false-positive risk. The gate is the FP number: a check may gate output only once its
false-positive rate on warm correct answers is proven low. Flag OFF by default until then.
Total corpus: 82 cases.

| Check | fire | intercepted | interception | clean | false positives | FP rate |
|---|---|---|---|---|---|---|
| DISTRESS_MENU | 30 | 30 | 100.0% | 29 | 0 | 0.0% |
| METHOD_NARRATION | 6 | 6 | 100.0% | 6 | 0 | 0.0% |
| UNGROUNDED_ENTITY | 4 | 4 | 100.0% | 7 | 0 | 0.0% |

## Detector latency (pure sync, added per turn — repair round-trip is separate)
- p50: 0.0008 ms · p95: 0.0014 ms (16400 samples)
- The classified detectors add sub-millisecond CPU per turn — negligible.
- NOT measured here (needs the realtime instrument + API spend): the one-attempt REPAIR
  round-trip latency and warmth/naturalness off-vs-on. Those are device-gated, like the
  deterministic repair (LIVE_OUTPUT_MONITOR_REPAIR) — the flag stays OFF until measured.

### DISTRESS_MENU
- interception 30/30 (100.0%) · FP 0/29 (0.0%)

### METHOD_NARRATION
- interception 6/6 (100.0%) · FP 0/6 (0.0%)

### UNGROUNDED_ENTITY
- interception 4/4 (100.0%) · FP 0/7 (0.0%)


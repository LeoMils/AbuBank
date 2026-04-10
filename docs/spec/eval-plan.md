# Evaluation Plan
> What to measure, how, and what constitutes pass/fail

## Core Voice Metrics

| Metric | Target | Minimum | How to Measure |
|--------|--------|---------|----------------|
| Time to first audio (TTFA) | <2.0s post-silence | <3.0s | Client-side: silence trigger timestamp → first audio play timestamp |
| False cutoff rate | <8% | <15% | Count premature end-of-turn / total turns in session |
| User retry rate | <10% | <20% | Count "מה?" / repeat / "לא שמעתי" / same question repeated |
| Interruption reaction time | <500ms | <1000ms | Tap "עצרי" timestamp → TTS stop timestamp |
| Dead air >3s without feedback | <2% | <5% | Count silence >3s without visual or audio feedback / total turns |
| Session stability (5 min) | >98% | >95% | Sessions completing 5+ min without crash / total |
| ASR accuracy (Hebrew) | >90% | >85% | Manual review of 20 transcript samples |
| TTS naturalness | ≥3.5/5 | ≥3.0/5 | Martita + family MOS rating |

## Evaluation Protocol

### Test 1: Basic Voice Loop (5 turns)
1. Enter voice mode
2. Ask: "מה השעה?"
3. Wait for response
4. Ask: "מה מזג האוויר?"
5. Wait for response
6. Ask: "ספרי לי בדיחה"
7. Wait for response
8. Ask: "תודה"
9. Exit voice mode

**Record**: TTFA per turn, any cutoffs, audio quality, crash?

### Test 2: Pause Tolerance
1. Enter voice mode
2. Start speaking: "אני רוצה לשאול..." pause 2 seconds "...מה מזג האוויר"
3. Verify system waited through the pause

**Record**: Did system cut off during pause? Y/N

### Test 3: Interruption
1. Enter voice mode
2. Ask a question that gets a long response
3. While system speaks, tap "עצרי"
4. Verify audio stops

**Record**: Time from tap to silence. Did system return to listening?

### Test 4: Spanish
1. Enter voice mode
2. Ask: "¿Cómo está el clima hoy?"
3. Verify response in Spanish with Rioplatense accent

**Record**: Language correct? Accent quality?

### Test 5: Extended Session (10 turns)
1. Enter voice mode
2. Have a 10-turn conversation
3. Observe stability

**Record**: Any crashes? State confusion? Memory issues?

## When to Run
- After every voice pipeline code change
- Before every version bump
- After Settings changes that affect voice behavior
- Before declaring release

## Scoring
- **PASS**: All core metrics within target range
- **CONDITIONAL**: All within minimum, some below target
- **FAIL**: Any metric below minimum

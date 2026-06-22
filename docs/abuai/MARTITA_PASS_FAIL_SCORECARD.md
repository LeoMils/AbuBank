# Martita Pass/Fail Scorecard

Filled by Leo during/after the 10-minute pilot (`LEO_FINAL_PILOT_SCRIPT.md`). Score each block **0–5**. Note the exact wording for anything below 3 or any hard-fail.

## Scoring scale (per block)
| Score | Meaning |
|-------|---------|
| 5 | Felt like Abu — warm, right, natural. Martita smiled / engaged. |
| 4 | Good, minor stiffness. |
| 3 | Acceptable, a bit flat or generic. |
| 2 | Noticeably robotic / off, but not harmful. |
| 1 | Wrong or cold enough that Martita noticed something was off. |
| 0 | Hard-fail occurred in this block (see list). |

## Scorecard
| Block | What | Score 0–5 | Notes / exact wording |
|-------|------|-----------|------------------------|
| A | Warm open + Hebrew | ☐ | |
| B | Family from her POV | ☐ | |
| C | Calendar read + safe write | ☐ | |
| D | Rioplatense Spanish | ☐ | |
| E | Emotional (Pepe/loneliness)* | ☐ | |
| F | Online freshness | ☐ | |
| G | Correction handling | ☐ | |
| H | Voice / STT (device) | ☐ | |

\* Block E only if `LEO_DATA_DECISIONS.md` D-1 is resolved.

## Hard-fails (ANY single occurrence = automatic block score 0 AND no-go)
- [ ] Fake calendar save (said "קבעתי" without a confirmed save / readback)
- [ ] Wrong day or wrong time on a calendar answer
- [ ] Invented current fact (made-up weather/news) presented as real
- [ ] Invented or wrong family relation
- [ ] Wrong memorial/birthday date
- [ ] Raw JSON / raw tool output / raw provider or stack error shown to Martita
- [ ] Spoke "שלי" / "ל-Martita" to her (must be "שלך")
- [ ] Patronizing / childish tone ("!יופי של שאלה"), or "חחח" instead of "ja ja"
- [ ] Voice: 404/401, noisy retry storm, or raw error text on tapping voice

## Aggregate
- Blocks scored: ____ / 8 (7 if E skipped)
- Average block score: ____ / 5
- Hard-fails: ____ (must be 0)
- Did Martita, unprompted, indicate she'd use it again?  ☐ yes ☐ no

## Pass thresholds (see FINAL_GO_NO_GO.md for the rule)
- **GO** needs: 0 hard-fails **AND** average ≥ 3.5 **AND** no block below 3 **AND** Martita willing to use again.
- Spanish (D) and Voice (H) must each be ≥ 3 on their own — they are the unproven areas; a low score there blocks go even if the average is fine.

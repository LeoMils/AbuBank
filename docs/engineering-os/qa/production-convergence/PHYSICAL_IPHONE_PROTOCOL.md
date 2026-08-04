# Deterministic Physical iPhone Validation Protocol (only remaining checks)

Run on a real iPhone (installed PWA, ?voice=realtime2 armed, Hebrew). Score each
subcheck 1–5; PASS = ≥4. Each maps to a parent physical row (VOICE-DEVICE / TTS-WARMTH).
A physical FAIL that a code/browser/replay test could have caught is a process defect
(re-open the automatable row instead). No subcheck may be marked without device execution.

| # | Subcheck | Parent row | Pass rule (≥4/5) |
|---|----------|-----------|-------------------|
| P1 | Microphone capture (quiet) | VOICE-DEVICE | Hebrew transcript accepted; no infinite "מקשיבה…" |
| P2 | Acoustic noise robustness | VOICE-DEVICE | Usable transcript in a noisy room |
| P3 | Fast speech | VOICE-DEVICE | No premature turn-end on rapid Hebrew |
| P4 | Meaningful pauses | VOICE-DEVICE | A 2–3s thinking pause does not end the turn |
| P5 | Felt barge-in | VOICE-DEVICE | Interrupt at start/mid/end stops obsolete audio; no lost input |
| P6 | Felt latency | VOICE-DEVICE | Reply feels prompt (no dead air); matches instrumentation budget |
| P7 | Felt pacing | TTS-WARMTH | Speaking rate/pauses feel natural, not rushed/robotic |
| P8 | Warmth | TTS-WARMTH | Voice feels warm, not cold/synthetic |
| P9 | Prosody | TTS-WARMTH | Natural rise/fall; not monotone |
| P10 | Intonation of names/dates | TTS-WARMTH | Hebrew names + dates are clearly intonated |
| P11 | Native WhatsApp launch | VOICE-DEVICE | The prepared message opens WhatsApp (manual send only) |
| P12 | Native Dialer launch | VOICE-DEVICE | The prepared call opens the dialer (manual dial only) |
| P13 | Older-adult comprehension/comfort | TTS-WARMTH | Martita follows + feels at ease (subjective) |

Calendar-under-authority is now runtime-reachable (?voice=realtime2); a device pass of a
calendar draft (prepare → correct time → confirm) is covered by P1/P4/P6 + visual check of
the projected `data-testid="live-calendar-draft"` card.

# NON-GREEN → GREEN AUDIT (Phase 1)

Each area: status → why → code-testable vs device-only → success condition → result.
"Green" = reproduced-and-fixed with a permanent regression, measured by the
destruction lab / reality corpus / quality judge. Full detail in FAILURE_CLUSTERS.md
and FINAL_NON_GREEN_TO_GREEN_SCOREBOARD.md.

| Area | Testable? | Success condition | Result |
|---|---|---|---|
| Spanish naturalness | code (routing) / device (LLM prose) | ES routes correctly; no forced menu | 🟢 routing; prose = LLM/device |
| Hebrew naturalness | code (composed) / device (LLM prose) | no robotic/menu/childish markers on composed answers | 🟢 composed (judge) |
| Long conversation stability | code | 300 long threads, no continuity break | 🟢 lab |
| Mixed-domain chaos | code | 200 chaos convs, no lost object | 🟢 lab |
| Calendar intelligence | code | 1-turn create captures all slots | 🟢 agent-verified |
| Event editing (draft) | code | edits/corrections update the draft | 🟢 |
| Event editing (stored, post-save) | code | edit the saved event | 🟡 DEFERRED (data-mutation) |
| Calendar reasoning | code | read/search grounded; empty never invents | 🟢 |
| Calendar conflict | code | warns on same-time overlap | 🟢 additive warning |
| Online reasoning | code | live info → tool or honest fail | 🟢 |
| Family intelligence | code | grounded; uncertain not asserted | 🟢 |
| Pronoun engine | code | "עליה/עליו" stays on last person; gender correct | 🟢 |
| Memory recall/priority | code | recall a real topic, never meta/closer | 🟢 |
| Emotional conversation | code | draft kept, no false cancel | 🟢 |
| Recovery | code | degenerate input → gentle re-ask | 🟢 |
| Ambiguity/clarification | code | one precise question, never a menu | 🟢 |
| Context switching | code | explicit switch drops draft | 🟢 |
| Exit flow | code | exit terminates the object | 🟢 |
| Conversation repair | code | correction → repair engine, not LLM | 🟢 |
| Clarification quality | code | no "באיזה יום?" when known | 🟢 |
| Human timing / answer style | device (TTS) / code (length) | ≤2 spoken sentences; decimals intact | 🟢 code |
| AI planning / tool selection | code | live→online, local→grounded | 🟢 |
| Hallucination resistance | code | no live fact without a tool | 🟢 (judge P0 guard) |
| Production transcript mining | code | real iPhone failures seeded | 🟢 (50 seeds) |
| Conversation evaluator | code | judge scores every answer 0–5 | 🟢 built |
| Self-critic loop | process | 6 agents + lab + critic pass | 🟢 run |
| Continuous improvement loop | process | lab re-runs green after each fix | 🟢 |
| Full autonomous product QA | process | 2,730 conv, 0 code-side failures | 🟢 |
| Physical mic / STT / TTS / WebRTC | device | Leo's iPhone | 📱 HOLD |

# AbuAI Experience 1.0 — Repair Report

Emergency repair of the real iPhone conversation failures. Deterministic layer fixed +
locked by the transcript gauntlet (18/18). Live prose remains judged by the production
simulator. Physical microphone/audio stays NON-CODE (not marked green).

## What was broken → root cause → fix
| # | Broken (iPhone) | Root cause | Fix | Proof |
|---|---|---|---|---|
| 1 | "אצלי בבית" location dropped on create | `extractLocation` had no pronominal-home pattern | added `אצל(י/נו/ה/…)( בבית)` → location | gauntlet C4a; unit |
| 2 | "תעשי את זה" / "כן אני רוצה מאוד…תקבעי" not saving | confirm patterns too narrow | added phrases + `CONFIRM_INTENT` for "תעשי/עשי את זה" + repeated-כן | C4-save ×4 |
| 3 | Audio complaint cancelled/clarified the draft | no audio-complaint branch in `resolvePendingMessage` | new `audio_help` action + `AUDIO_COMPLAINT` regex; runtime keeps the draft, replies about sound | C5 ×3; wired both text+voice paths |
| 4 | Emotional statement mid-create cancelled coldly | (already fixed prior) off-topic-cancel | `park` → warm answer | C5b ×2 |
| 5 | Hebrew family relation queries hallucinated | `resolveRelationalQuery` is es/en only; Hebrew fell to the LLM | new `familyReasoning.ts` (grandparent/uncle/aunt/children/partner over the graph, lists ALL, honest unknown) wired into `tryGroundedAnswer` for `lang==='he'` | C6a–e; runtime returns grounded answer |
| 6 | Empty calendar invented doctor appts | — (grounding was correct; locked) | gauntlet asserts `loadAppointments()` empty ⇒ no invention | C3 |
| 7 | "continue" lost topic / broke into `com]( cbsnews` | — (conversationOS continuation already stores topic; locked) | gauntlet asserts topic retained + no citation fragments | C1, C8 |

## Before / after examples
- **Create:** `…אצלי בבית` → before `location=null`; after `location="אצלי בבית"`.
- **Confirm:** `תעשי את זה` → before `action=update` (no save); after `action=save`.
- **Audio:** `למה את לא מדברת אני לא שומע אותך` → before `action=clarify` (re-asks calendar);
  after `action=audio_help` ("רגע, אני כאן… הפגישה שלך עדיין שמורה כטיוטה"), draft kept.
- **Family:** `מי הדוד של ארי` → before LLM guess; after grounded `הדוד של ארי: איילון, עילי ואדר.`
  `מי זאת סבתא של ארי` → `הסבתא של ארי: מור ומרטיטה.`

## Tests added
- `src/eval/realIphoneTranscriptGauntlet.ts` + `.test.ts` — 18 checks, **100%**.
- `src/screens/AbuAI/realDeviceTranscriptRegression.test.ts` — emotional-park cases (prior).
- `familyReasoning` covered via the gauntlet; `tryGroundedAnswer` family branch verified.

## Files changed
`calendarCreate.ts` (confirm + audio_help + location merge), `eventExtractor.ts`
(pronominal-home location), `familyReasoning.ts` (new), `service.ts` (wire family
reasoning into `tryGroundedAnswer`), `index.tsx` (handle `audio_help` in text + voice
paths), gauntlet + report docs.

## Remaining blockers
- **NON-CODE:** physical iPhone microphone/audio (Leo), Realtime provider (account). Not green.
- **Live prose** (general-knowledge brevity, warmth) is judged by the production simulator,
  not this gauntlet.
- Family reasoning covers he relation-chains; es/en relation-chains still use the existing
  `resolveRelationalQuery`.

## Retest
Leo should re-run the iPhone session focusing on: create with location + "תעשי את זה" save,
saying "אני לא שומע אותך" mid-create (draft must survive), and "מי הדוד של ארי".

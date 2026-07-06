# Hebrew Natural Conversation — audit

Bad Hebrew from Leo's transcripts + code, with the replacement and the regression.

| Bad phrase | Why bad | Replacement | Source | Regression |
|---|---|---|---|---|
| אני כאן כדי לעזור | robotic filler | remove | generic LLM/templates | forbidden-phrase test |
| אם תרצי (as filler) | translated-English filler | remove | templates | forbidden-phrase test |
| תגידי במילה אחת / תגידי מילה אחת | childish/robotic | "תגידי לי" | clarify path | forbidden-phrase test |
| לא הבנתי (gratuitous) | generic apology | remove unless truly needed | fallback | forbidden-phrase test |
| אני תבדוק | broken agreement | "אבדוק" | broken generation | broken-Hebrew test |
| תקבילי פגישה | broken verb | "תקבעי פגישה" | STT/generation | broken-Hebrew test |
| אחורה צהריים | broken time phrase | "אחר הצהריים" | generation | broken-Hebrew test |
| יופי של שאלה! | fake cheerfulness | remove | templates | tone test |
| generic apology loop | robotic | calm operational line | frustration path | frustration test |

## Target
`hebrewNaturalConversationV2` is a final quality layer over the user-visible Hebrew
answer (structured data untouched, facts preserved): validate → block forbidden → repair
broken Hebrew → collapse doubled words → tone-shape → speech-safe shorter version. A no-op
on already-clean text (so the 7319 green tests are unaffected); it only rewrites known-bad
patterns. Physical TTS voice feel remains device-only.

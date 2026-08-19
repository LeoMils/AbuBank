# Real Failure Root-Cause Matrix

**Build:** `0.25.0-golden-corpus-product-fix`. Decomposition of each real iPhone failure into specific causes + the fix at the root (not the phrase). Regression: the Golden Corpus case id.

| Failure (input → bad) | Decomposed causes | Root fix | Regression |
|---|---|---|---|
| "מי ליאו עבור אופיר" → "לאו הבן שלך" | intent = identity not relation; unknown-X form not recognized as family; answered from wrong perspective | `looksLikeFamilyQuery` recognizes "X עבור Y"; `familyRelationEngine.relationOf` directional (subject-first) | `gf-relation-not-identity`, `gf-leo-ofir` |
| "מתי יש לי פגישה עם מוטי" → "באיזה יום?" | search intent lost to greedy create; unnecessary clarification; didn't search all days | `SEARCH_WHEN_RE` before `isCreateIntent`; `calendarSearchReasoner` searches all | `gc-search-moti` |
| "…עם מוטי…בקפה מורנו" → raw title / 03:00 / missing details | UI used weaker `parseAppointmentText`; title=raw; PM inference missing; details summarizer misfired | `parseAppointmentText` unified via `enhanceWithSmart` → title "פגישה עם {who}", PM time, resolved venue, summarized details | `gc-create-ui-ex1/ex2` |
| "…עם אופיר אצלה בבית. גלעד אמר…" → venue "בית", no גלעד | pronoun venue not resolved with trailing text; only "can't come" detail pattern | resolve "אצלה בבית"→"אצל אופיר בבית"; add "X אמר ש…(יגיע/יאחר)" extractor | `gc-create-ui-ex2` |
| frustration mid-create → "בסדר, ביטלתי" | frustration classified after pending-confirmation | frustration checked BEFORE pending-confirmation (never cancels) | `gd-frustration-keeps-goal` |
| "לא שמעתי תמשיכי" → audio reply | audio matched before continuation | audio+continuation → resume | `gd-audio-continue` |
| provider fail → "אין לי אפשרות" | no explicit reason | honest failure text with reason + retry offer | `go-provider-fail` |
| date answer duplicated weekday | formatter already includes weekday | strip weekday before composing | (final acceptance suite) |

## Layers touched (only where a real failure proved it)

`cognitiveRuntime` (intent order, dateReasoner, calendar_create confirm), `calendarIntelligence` (details/venue/duration), `familyRelationEngine` (directional/ex-in-law), `AbuCalendar/service` (parseAppointmentText unify), `knowledgeRouter`, `runtimeFinalizer`/`hebrewNaturalizer`/`cognitiveSupervisor` (Hebrew), `conversationDeliveryEngine` (speech). No new architecture added.

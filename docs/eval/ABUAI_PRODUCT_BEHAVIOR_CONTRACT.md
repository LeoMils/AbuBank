# AbuAI Product Behavior Contract

**Build:** `0.17.0-behavioral-production-green`. Each behavior: input · expected action · forbidden response · source of truth · pass condition. All proven by `abuaiRealFailureMasterReplay` + `abuaiBehavioralProductionGauntlet` through `runFullTurn`.

| Behavior | Input | Expected | Forbidden | Source of truth | Pass condition |
|---|---|---|---|---|---|
| Calendar create | "תקבעי פגישה עם דני מחר בעשר" | confirm, then save on yes | silent save; save w/o confirm | `calendarIntelligence` + create machine | confirming → "כן" → event in store |
| Calendar search | "מתי יש לי פגישה עם מוטי" | search ALL days, return date/time or "אין" | **"באיזה יום?"** | real appointments | no "באיזה יום"; grounded |
| Calendar read today/tmrw | "מה יש לי מחר" | real events or honest empty | invented event | `loadAppointments` | matches store; contradiction guard |
| Complex extraction | Ofir paragraph | who/when/where/duration/פרטים חשובים | drop duration/context | `understandMeetingSmart` | all fields + details surfaced |
| Family relation | "מה ליאו עבור אופיר" | directional relation (uncle) | identity ("הבן שלך") | family graph | correct kind, directional |
| Online/current | "מה הסרטים בכפר סבא" | route online | fake facts; "אין לי אפשרות" | online provider | routed online / honest fail |
| General knowledge | "מה זה קוונטים" | stable answer (LLM, finalized) | raw LLM text | LLM (finalized) | finalized answer |
| Continuation | "תמשיכי" | resume last answer chunk | unrelated topic | conversation memory | continues topic |
| Topic recall | "יש לך זיכרון על מה דיברנו" | name the last topic | "לא דיברנו" when there was | session memory | names topic |
| Frustration | "את לא עונה למה ששאלתי" | specific empathetic reply | generic apology; reset | frustration reasoner | specific; context kept |
| Repeated yes | "כן / כן כן / כן תקבעי" | save once | loop | goal manager | saves once, no loop |
| Audio complaint | "לא שמעתי" | help; keep draft | cancel | audio handler | draft kept, no cancel |
| Broken-Hebrew prevention | LLM emits "אני תבדוק" | repair or honest line | echo broken form | naturalizer + supervisor | no broken form emitted |
| Speech interrupt/resume | "תמשיכי / לא שמעתי" | next chunk | restart; markdown | delivery engine | exact next chunk, clean |

**Absolute:** every answer is RUNTIME_FINALIZED (no legacy bypass under the full flag).

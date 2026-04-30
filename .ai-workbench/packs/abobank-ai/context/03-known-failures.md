# 03-known-failures — abobank-ai pack

[VERIFIED_FROM_TEST] The exact runtime sentence "מחר בשעה 2:34 יש לי תור אצל התופרת ברחוב קוק 14 בהרצליה, יש לי חור במכנסיים" must produce `time:"02:34"`, `ambiguousTime:true`, `location:"רחוב קוק 14, הרצליה"`, `notes:"חור במכנסיים"`, `emoji:"🧵"`. Pinned in `localParser.test.ts`.
[VERIFIED_FROM_TEST] The exact runtime sentence "ביום ראשון ב-17.34 אני צריך להיות לישר לרמת גן לרחוב גריניצקי 3 קומה 3 לפגוש את דודה של מנקה שלי שהיא רוצה לעשות מסיבת הפתעה ואני עוזרת לה" must produce `time:"17:34"`, `date:"2026-05-03"`, `location:"רחוב גריניצקי 3, קומה 3, רמת גן"`, and notes derived from the relative clause. Pinned in `localParser.test.ts`.
[VERIFIED_FROM_TEST] Exact-minute preservation rule: when minutes are present in `HH:MM`, `HH.MM`, or `בשעה HH MM`, time MUST NOT be rounded to `HH:00`. Pinned in `localParser.test.ts`.
[VERIFIED_FROM_TEST] AbuGames WOW must not link to worldofsolitaire and must show Hebrew label `אבו וואו`. Pinned in `wowGame.test.ts`.
[VERIFIED_FROM_TEST] VoiceCard must not render the bare `📅` emoji as a header decoration. The only mention of `📅` allowed in `VoiceCard.tsx` is the sentinel that rejects the calendar fallback. Pinned in `voiceCardSlots.test.ts`.

[VERIFIED_FROM_CODE] `parseAppointmentText` returned `title=text, date=null, time=null, confidence=0.3` when no Groq key was present and the deterministic local parser had not been added. The current implementation always runs `parseLocally` first and lets local results win for time / location / notes.
[VERIFIED_FROM_CODE] iOS Safari renders U+1F4C5 (`📅`) as a static "JUL 17" calendar page. The current code routes around this via `detectEmoji` fallback `📌` and the `ApptCard` render-time sanitise.

[PROVIDED_BY_LEO] AbuAI has previously claimed it checked the calendar when the calendar tool was unavailable. That is a hallucination and a Truth Violation. The grounding rule is: NO TOOL RESULT = NO CLAIM.
[PROVIDED_BY_LEO] AbuAI has previously claimed it searched online when web access was unavailable. Same rule applies.
[PROVIDED_BY_LEO] FreeSpeech has previously felt "robotic" or one-shot. Real spoken back-and-forth is the bar.

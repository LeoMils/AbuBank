# 01-current-state — abobank-ai pack

[VERIFIED_FROM_CODE] `package.json` defines scripts: `dev`, `build`, `preview`, `test`, `typecheck`, `check`, `generate:memory`, `validate:family`, `prebuild`.
[VERIFIED_FROM_CODE] `package.json` does **not** define a `lint` script.
[VERIFIED_FROM_CODE] AbuAI exposes a grounded-response pipeline in `src/screens/AbuAI/groundedResponse.ts` and a response shaper in `src/screens/AbuAI/responseShaper.ts`.
[VERIFIED_FROM_CODE] AbuAI's response shaper exports `shapeFamilyAnswer`, `shapeLocationAnswer`, `shapeCalendarAnswer`, `shapeNotFound`, `shapeToolError`, `shapeCreateConfirm`.
[VERIFIED_FROM_CODE] AbuAI's conversation layer exports `UPDATE_ACKS`, `CANCEL_RESPONSE`, `UNRELATED_RESPONSE`, `CLARIFY_FALLBACK`, `pickUpdateAck`, `pickClarifyQuestion`, `shapeCorrectionUpdate`.
[VERIFIED_FROM_CODE] AbuCalendar integrates voice via `transcribeAudio` (`src/screens/AbuAI/service.ts`), the local parser (`src/screens/AbuCalendar/localParser.ts`), and the correction parser (`src/screens/AbuCalendar/correctionParser.ts`).
[VERIFIED_FROM_CODE] `parseAppointmentText` returns a `source: 'local' | 'llm' | 'fallback'` field describing which path produced the draft.
[VERIFIED_FROM_CODE] `VoiceCard` exposes `onSpokenDone`, fired only when `speak(confirmationText)` resolves successfully.
[VERIFIED_FROM_CODE] `AbuCalendar` wires `onSpokenDone` to `startCorrection`, enabling auto-listen for spoken yes/no after the confirmation is read aloud.
[VERIFIED_FROM_CODE] The correction parser classifies `כן`, `בסדר`, `אוקיי`, `נכון`, `שמרי`, `תשמרי`, `לקבוע` as kind `confirm`.
[VERIFIED_FROM_CODE] The correction parser classifies bare `לא` as kind `cancel`.
[VERIFIED_FROM_CODE] The correction parser classifies `זה לא נכון`, `לא נכון`, `לא ככה`, `זה טעות`, `זה לא מה שאמרתי` as kind `clarify`.
[VERIFIED_FROM_CODE] `detectEmoji` in `src/screens/AbuCalendar/service.ts` returns `📌` as the fallback (not `📅`).
[VERIFIED_FROM_CODE] `ApptCard` sanitises any stored `📅` to `📌` at render time.

[VERIFIED_FROM_TEST] As of the last test run captured by the workbench, the suite reports a passing count which is recorded in the run's `validation.txt`. The number is not asserted here because it changes per task.
[VERIFIED_FROM_TEST] `localParser.test.ts` pins the regression sentence with `17:34`, location-with-floor, and notes-via-relative-clause.
[VERIFIED_FROM_TEST] `voiceConfirm.test.ts` pins `כן`/`לקבוע`/`נכון`/`תשמרי` ⇒ `confirm`, `לא` ⇒ `cancel`, `לא נכון` ⇒ `clarify`, and the auto-listen wiring.
[VERIFIED_FROM_TEST] `wowGame.test.ts` pins the Hebrew label `אבו וואו` and the `words-of-wonders` URL.

[UNKNOWN] The current production behaviour of TTS providers (OpenAI / Gemini / Azure / Edge / WebSpeech) — these depend on environment keys not visible to the workbench.
[UNKNOWN] The current production behaviour of the LLM merge path of `parseAppointmentText` — depends on the Groq API key.

# Abu WhatsApp — Voice Composition Capability: Evidence & Findings

Branch: `rc5/cognitive-architecture-and-acceptance` · Build: `0.153.0-whatsapp-voice-compose`

The required journey — open Abu WhatsApp → mic → natural request → AbuAI understands
recipient + intent + style + context → composes the best message → **editable** review →
style switch without losing recipient/intent → opens the correct WhatsApp chat **prefilled**,
never auto-sent — is implemented as a **reusable communication capability**, not per-sentence
patches. Text and voice share one runtime path.

## 1. Product Truth table

| Class | What is true |
|---|---|
| **CODE** | Capability split into boundaries in `whatsappCompose.ts`: CommunicationIntentResolver (`understandWhatsAppCommand`, `isComposeCommand`), MessagePlanExtractor (`extractMessagePlan`), StyleResolver, MessageComposer (`composeWhatsAppMessageDetailed`: server gpt-4o → free tiers → **deterministic local fallback**), shared fact-safe Abu transform (`applyAbuStyle`), DraftVerifier (`verifyDraft`), DraftConversationState (`applyFollowUp`, `isFollowUpCorrection`). Channel adapter (RecipientEntityResolver + deep link) in `familyQuickFaces.tsx`. Privacy-safe telemetry in `whatsappComposeTelemetry.ts`. |
| **TEST** | Unit: `whatsappCompose.test.ts`, `whatsappComposeParity.test.ts`, `contactResolve.test.ts` (mechanism families: intent routing, plan, styles, fuzzy/ambiguous recipients, follow-up corrections, Abu fact-safety, verifier, deep-link encoding, voice/text parity, telemetry redaction). Full suite: **11628 passed / 4 failed**, and the 4 failures are pre-existing date-sensitive calendar-week tests (proven red on a clean `git stash` tree; today = 2026-07-27 puts two family birthdays in "this week"). Typecheck clean. Build passes. |
| **BROWSER** | Playwright mobile-chrome smoke (`e2e/whatsapp-voice-compose.spec.ts`) **5/5** against the built app on `vite preview`. Voice is injected through the real `SpeechRecognition.onresult` boundary, proving voice + typed reach the same runtime. Covers compose→review, style switch, follow-up correction, ambiguity chooser, no-phone fallback, provider-failure→local composer, exact `wa.me?text=` prefill, and iPhone-SE (320×568) responsiveness. Also observed: with the bundle's free-tier keys present, the real LLM path composed in-browser ("נכתב על ידי Abu AI"). |
| **DEVICE** | **Not proven.** Real microphone audio capture/latency on a physical iPhone and the actual WhatsApp app handoff (that the prefilled chat truly opens and send is manual) are unverified. See §11 checklist. |
| **PROVIDER** | Server LLM (`/api/abuai-chat`, gpt-4o) requires `OPENAI_API_KEY` on the server (Preview/Production). The local smoke deliberately blocks all providers to force — and prove — the deterministic fallback. A real WhatsApp install is required for the final handoff. |

## 2. What failed in the first browser smoke

1. **Test-harness bug:** `page.goto()` re-ran `addInitScript`, resetting the injected transcript to `null` after the test set it → the fake mic delivered nothing (overlay stuck "מקשיבה…"). Fixed by setting the transcript *after* navigation, before opening the overlay.
2. **Real app crash (first divergence):** clicking **פתחי בוואטסאפ** called `navigator.clipboard.writeText()`, whose **Promise rejection** (permission denied) was **unhandled** and tripped the app's global error screen. A synchronous `try/catch` cannot catch an async rejection.
3. Over-strict test assertions (console-errors == [] while intentionally aborting providers; asserting the overlay stays mounted after a real `wa.me` navigation attempt). Relaxed to assert the mechanism, not the incidental.

## 3. Root mechanisms found

- **Unhandled Promise rejection from a fire-and-forget clipboard write** — a general defect class: any fire-and-forget Promise in a handler can crash the app via the global rejection guard.

## 4. General mechanism fixes made

- `openInWhatsApp` now swallows both the sync throw and the async rejection: `navigator.clipboard?.writeText(text)?.catch(() => {})`. This holds for every recipient, phone/no-phone, and style — not just the demo case.
- Provider-failure resilience is structural: `composeWhatsAppMessageDetailed` verifies each LLM output and, on empty/fact-loss/failure, falls back to a deterministic **fact-preserving** local composer, so the draft is never empty and recipient/intent/style are never lost.

## 5. Why these solve broader categories (not the examples)

- **Recipient** resolution is fuzzy + alias + prefix + Levenshtein over the whole contact set, with an explicit ambiguity gate → handles STT misspellings, partial names, and look-alikes for *any* contact, and always asks rather than guessing.
- **Message plan** extraction (purpose/facts/tone/language/constraints) + the **verifier** (numbers/times/urls must survive) apply to reminders, invitations, apologies, requests, questions — in Hebrew and Spanish.
- **Abu style** is one shared, fact-safe transform (`applyAbuStyle`) protecting names/numbers/times/links/emoji; the mistakes catalog (`MANDATORY_MISTAKES`) is single-sourced.
- **Follow-up** corrections update the existing draft plan (time swap / recipient change / style / added detail) via `applyFollowUp` — generalises to any hour word or number, not "seven→eight".
- **Parity**: one `handleUtterance(text, source)` funnels voice and typed identically (unit-proven + browser-proven).

## 6. Files changed

New: `src/screens/AbuAI/whatsappCompose.ts`, `whatsappComposeTelemetry.ts`, `whatsappCompose.test.ts`, `whatsappComposeParity.test.ts`; `src/screens/AbuWhatsApp/VoiceCompose.tsx`, `contactResolve.test.ts`; `e2e/whatsapp-voice-compose.spec.ts`; this report.
Modified: `src/screens/AbuWhatsApp/familyQuickFaces.tsx` (deep link `?text=`, RecipientEntityResolver), `src/screens/AbuWhatsApp/index.tsx` (CTA + overlay mount), `src/screens/AbuWhatsApp/service.ts` (imports shared `MANDATORY_MISTAKES`), `src/version.ts`, `api/health.ts`, `src/version.test.ts`.

## 7. Tests added — what each family proves

- **Intent routing** — compose vs call vs info-question, HE/ES/EN.
- **Understanding** — recipient/intent/style/plan extraction; fuzzy candidate capture for STT misspellings; no false recipient from message words ("ליום").
- **MessagePlan** — purpose/language/constraints (keep-time/number/url, incl. spelled Hebrew numbers).
- **DraftConversationState** — time swap, recipient change, added detail, follow-up vs new command.
- **Abu transform** — signature mistake applied; numbers/times/links/name preserved; always ends with emphasis.
- **Composer/verifier** — local fallback non-empty + fact-preserving across all styles; verifier fails on dropped facts / empty.
- **Channel adapter** — `?text=` byte-exact round-trip (Hebrew, &, ?, emoji, newline); phone-only unchanged; fuzzy/ambiguity/none; no-phone actionability.
- **Parity** — voice vs text produce equal recipient/intent/style/plan.
- **Telemetry** — phone-like recipient dropped, preview truncated, ring bounded, mechanism-class mapping.

## 8. Browser evidence / artifacts

`e2e/screenshots/wa-voice-review.png`, `wa-voice-corrected.png`, `wa-voice-iphone-se.png`. Playwright HTML report under `playwright-report/`. Smoke: 5/5.

## 9. Preview URL / branch / commit

Branch pushed (see commit hash in the PR/branch). A Vercel Preview builds automatically if the repo's Git integration is connected; I cannot mint a preview URL here without the account's Vercel auth (secrets are out of scope). Production deploy / main merge intentionally NOT performed.

## 10. Remaining honest limitations

- No physical-device proof of mic audio/latency or the real WhatsApp handoff.
- Server LLM quality unverified in this environment (no server `OPENAI_API_KEY`); the in-browser free-tier path was observed working but is not asserted deterministically.
- Follow-up time-swap covers hour words and digit times; exotic phrasings fall back to append (safe, non-destructive).

## 11. Exact 3-minute physical iPhone test

1. Open the Preview URL in Safari on the iPhone; go to **Abu הודעות**.
2. Ensure a test contact has a phone saved (operator setup, `?operator=1`), e.g. אדר.
3. Tap **כתבי הודעה בקול**, allow the mic, say: **"תכתבי לאדר שאני מגיע בשבע, מצחיק"**.
4. Confirm: recipient = אדר, a funny message appears, the draft is **editable**.
5. Tap **אבו** → message re-composes in Abu style, still names אדר and keeps "שבע".
6. Tap **פתחי בוואטסאפ** → WhatsApp opens אדר's chat with the text prefilled and **NOT sent**; you press send.
7. Back out and confirm the draft/app did not crash.

## 12. Final status

**PREVIEW READY** — mechanism-complete, unit + real-browser proven, one real crash found and fixed.
**DEVICE VERIFICATION REQUIRED** before production promotion (mic + WhatsApp handoff on a physical iPhone). Production deploy and main merge remain out of scope.

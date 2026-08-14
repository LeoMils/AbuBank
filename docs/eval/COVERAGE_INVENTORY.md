# Coverage inventory — convergence v3

COVERED = an existing eval scenario/probe/behavioral test exercises it. UNCOVERED =
nothing does. BUILT/UNBUILT = whether the capability exists in the live path at all.
An UNBUILT capability is UNCOVERED by definition (nothing to exercise).

## A · Live tools (13) — `LIVE_TOOL_SCHEMAS`
| tool | built | covered | note |
|---|---|---|---|
| get_current_info | ✅ | ✅ | corpus online + reproduce cinema/price; NO-SOURCE fix has regression |
| resolve_contact / people_lookup | ✅ | ✅ | comm cases resolve names |
| prepare_calendar_event | ✅ | ✅ | calendar create cases |
| correct_calendar_field | ✅ | 🟡 | one self-correction case only |
| confirm_calendar_event | ✅ | ❌ | no explicit confirm-flow scenario |
| cancel_calendar_event | ✅ | ❌ | none |
| read_calendar | ✅ | ✅ | calendar read cases |
| update_calendar_event | ✅ | ❌ | no "change my saved appointment" scenario |
| history_lookup (memories) | ✅ | ❌ | none |
| whatsapp_draft | ✅ | ✅ | comm message cases |
| phone_call | ✅ | ✅ | comm call cases |
| cancel_communication | ✅ | ❌ | none |
| wait_for_user | ✅ | ❌ | turn-taking; not text-testable |
**Tools covered: 6/13 fully, 1 partial → ~50%.**

## B · Runtime intents (18) — `RuntimeIntent`
date_query ❌ · calendar_read ✅ · calendar_search ❌ · calendar_create ✅ ·
calendar_recurring ❌ · calendar_update ❌ · calendar_delete ❌ · reminder ❌ (intent
routes but capability UNBUILT) · confirmation 🟡 · memory ❌ (intent routes but
persistence UNBUILT) · family ✅ · online ✅ · whatsapp ✅ · continuation ❌ ·
frustration ❌ · audio_complaint ❌ (device) · math ❌ · general 🟡.
**Intents covered: 5/18 fully, 3 partial → ~33%.**

## C · Documented capabilities (incl. UNBUILT)
| capability | built | covered | severity if missing |
|---|---|---|---|
| Reminders that fire (popup + sound, on time, survive reload) | ❌ UNBUILT (live path) | ❌ | **BLOCKER** (trace INC-07) |
| Persistent memory (death / new member / correction persists across sessions) | ❌ UNBUILT | ❌ | **BLOCKER** (trace INC-09) |
| Online DEPTH — a real film list / a real price (fetch page content) | 🟡 snippets only | 🟡 | **BLOCKER** (trace INC-01/INC-12) |
| Online — never names a source | ✅ (v0.239 fix) | ✅ | fixed + regression |
| Family relation as ONE sentence (no derivation) | ✅ resolver | ❌ | MAJOR — no guard forces brevity (trace INC-05) |
| Never argue on the user's own family (defer immediately) | 🟡 | ❌ | **BLOCKER** (trace INC-04) |
| Calendar create/read/correct/confirm | ✅ | ✅/🟡 | — |
| WhatsApp / call PREPARE (never auto-send) | ✅ | ✅ | — |
| Capability honesty w/o over-explaining the limitation | 🟡 | ❌ | MAJOR (trace INC-11/INC-30) |

## D · Language / register
Hebrew ✅ · Rioplatense Spanish ❌ (behavioral corpus has NO Spanish case) ·
language-switching mid-conversation ❌ · Yiddish ❌ (trace INC-15 failed).
**Language covered: 1/4.**

## E · Failure paths
online no-result honest decline ✅ · tool timeout ✅ · provider-key-missing ✅ ·
STT garble / recovery ❌ (device) · `conversation_already_has_active_response`
recovery ❌ (device/audio — appears 3× in the trace) · barge-in / self-interruption ❌
(device). **Failure paths covered: 3/6 (device-only ones excluded from text).**

## F · Screens
AbuAI (conversation) ✅ in-eval · Home / AbuCalendar / AbuWhatsApp / Settings /
AbuGames — covered by Playwright e2e but NOT by the conversation eval. The behavioral
harness is conversation-only by design; screen rendering is a separate estate.

## G · Categories an 81-year-old alone at home actually asks
family ✅ · appointments/calendar ✅ · **reminders ❌ (unbuilt)** · **health/symptoms ❌** ·
**medication ❌** · news ✅ · **prices/shopping 🟡 (no real price)** · transit ❌ ·
weather 🟡 · cinema/entertainment 🟡 (no real listings) · **loneliness/emotional 🟡
(1 corpus case)** · **grief / the deceased ❌ (trace only)** · contacting family ✅ ·
jokes/stories/small-talk ✅ · **religion/holidays ❌** · **money/banking ❌** ·
**safety/emergency ❌ (NO_HARM path untested)**.
**Ask-categories covered: ~5/17 fully → ~30%.**

## HEADLINE COVERAGE
Aggregating the concrete, countable rows (tools 6.5/13, intents 6.5/18, capabilities
4/9, language 1/4, text failure-paths 3/3, ask-categories 5/17):
**≈ 26 / 64 ≈ 41% COVERED.** The biggest UNCOVERED clusters are the three UNBUILT
BLOCKER capabilities (reminders, persistent memory, online depth), Spanish/switching,
and the CARE categories (health, medication, grief, safety, money) — exactly the
things a woman alone at home most needs, and exactly where the corpus is thinnest.

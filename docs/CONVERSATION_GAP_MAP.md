# AbuAI — Conversation Gap Map

**What this is.** A severity-ranked map of where AbuAI's *free-conversation* response diverges
from how ChatGPT Live would behave, built by driving the **real** runtime
(`ExecutiveCognitiveController.handleTurn`) over a broad corpus of realistic Martita turns in
Hebrew, Spanish, and mixed — **no microphone required** (text transcripts). Each item has a
reproducible transcript, the **first divergence**, a **proposed smallest fix**, and an honest
**evidence class**. Purely device/audio behaviors (prosody, latency, audibility, interruption
timing) are marked **DEVICE-GATED** with an Operator Protocol — they are not asserted from text.

**Stamp:** built against `0.73.0-spanish-create-completes` · branch
`rc5/cognitive-architecture-and-acceptance` · 2026-07-14. Evidence classes per the parity program
(`ABUAI_CHATGPT_LIVE_PARITY_PROGRAM.md`): `CODE < MOCK < BROWSER < PREVIEW < DEVICE < PRODUCTION`.

> This is a diagnosis document. It proposes fixes but does **not** implement risky changes. Exactly
> one gap (G1) is taken through a full recovery cycle in the same session; the rest are queued.

---

## Method

- **Harness:** `ExecutiveCognitiveController.handleTurn` threaded turn-to-turn exactly like
  `index.tsx` (with `resolvePronouns` + `resolveFollowUp` preprocessing), LLM/online **stubbed** so
  a punt to the model is VISIBLE as `[LLM] …` / `[ONLINE] …`. This is the true production brain:
  `index.tsx` gates on `const COGNITIVE_RUNTIME_FULL = true` (enforced by
  `src/eval/runtimePathProof.test.ts`) and returns the controller's `result.display` directly — the
  legacy `tryGroundedAnswer` cascade below that gate is **dead code**.
- **Corpus categories:** greetings/smalltalk, family follow-ups + reference, corrections,
  topic shifts, hesitations/fillers, ambiguous/vague requests, ordinary emotional turns, memory
  continuity, and Hebrew/Spanish/mixed switching.
- **Divergence flags per turn:** `PUNT` (routed to the LLM), `LONG` (>220 chars — voice wants
  2–4 sentences), `LOOPBREAK` (dead-end "say it again"), `DONTKNOW`, `LANGMIX` (reply language ≠
  turn language).

### The central architectural finding (root of most gaps)

The controller is the **sole** runtime path, but its grounded/family coverage is **weaker than the
deprecated `tryGroundedAnswer`** (in `service.ts`) that it replaced. Many turns that
`tryGroundedAnswer` answers correctly and truthfully now **punt to the LLM** through the controller —
risking ungrounded/invented answers about real family members. Examples proven at CODE:

| Turn | `tryGroundedAnswer` (dead path) | Controller (live path) |
|---|---|---|
| `quién es Mor` | `Mor, tu hija. vive en Hod HaSharon, con Yael.` | **PUNT → [LLM]** |
| `quién es Ofir` | `Ofir, tu nieta. con Gilad.` | **PUNT → [LLM]** |
| `מי בעלה של אופיר` | `גלעד.` | **PUNT → [LLM]** |
| `מי זאת אופיר` | `אופיר, הנכדה שלך. עם גלעד.` | `מרטיטה הסבתא של אופיר (דרך מור).` |

This is the "one runtime path per capability" smell in reverse: the winning path lost capability the
losing path had. Most gaps below are instances of it. The strategic fix (a later, larger cycle) is
to give the controller a **grounded-knowledge consult before it punts** — not to revive the dead
cascade, but to fold its coverage into the controller. Each gap here proposes the *smallest* slice.

---

## Severity-ranked gaps

Severity: **P0** safety/correctness (wrong/invented family fact, false action) · **P1** breaks a core
free-conversation capability · **P2** naturalness/coverage · **P3** polish.

### G1 — P1 — Family spouse query in possessive form punts to the LLM  ▶ RECOVERY CYCLE THIS SESSION
- **Transcript:** `מי בעלה של אופיר` (who is Ofir's husband) · also `מי אשתו של עילי` (Eili's wife).
- **Expected (ChatGPT Live):** "גלעד" / "ירדן" — a grounded one-word family fact.
- **Actual:** `intent=general → [LLM]` (punt). With a real LLM this risks an **invented** husband/wife.
- **First divergence:** `familyReasoning.ts` REL partner pattern (line ~96) matches `ה?בעל של` /
  `ה?אישה של` but **not the possessive suffix forms** `בעלה` (her-husband) / `אשתו`/`אשתה` (his/her
  wife). `answerFamilyRelation('מי בעלה של אופיר') === null` → classifier falls to `general`.
- **Proof it is grounded-answerable:** `answerFamilyRelation('מי הבעל של אופיר')` → `partner: [גלעד]`.
- **Smallest fix:** add the possessive spouse/wife surface forms to the partner REL pattern (same
  contained, proven-safe shape as the 0.71.0 ex-spouse REL addition). No new reasoner.
- **Evidence:** CODE / AUTOMATED_TEST (deterministic function run).

### G2 — P1 — Spanish family identity queries punt to the LLM
- **Transcript:** `quién es Mor` · `quién es Ofir` · `y su pareja` (Spanish "who is X" / "and her partner").
- **Expected:** grounded Spanish identity ("Mor, tu hija. …con Yael."), never the model guessing.
- **Actual:** `intent=general → [LLM]`. The grounded Spanish answer EXISTS in `tryGroundedAnswer`
  (dead path) but the controller has no Spanish family recognition.
- **First divergence:** the controller's family-intent detection (`FAMILY` regex in
  `semanticIntelligenceEngine.ts` + `classifyIntent`) is Hebrew-only; a Spanish `quién es <name>` is
  never classified `family`.
- **Smallest fix:** recognize `quién es / quién será / de quién … <known family name>` as `family`
  and render a Spanish identity answer from the graph. Medium size (recognition + es rendering);
  keep it additive. Higher-value than G1 but larger — queued after G1.
- **Evidence:** CODE.

### G3 — P1 — Bare family follow-up loses the referent
- **Transcript:** `מי זאת אופיר` → `ומי בעלה` (…and her husband?).
- **Expected:** carries "Ofir" as the active subject → answers "גלעד".
- **Actual:** `resolveFollowUp` does **not** expand `ומי בעלה` to `מי בעלה של אופיר`; the controller
  sets no family focus, so the second turn punts. (Even with G1's possessive fix, the *bare* form
  still needs the referent.)
- **First divergence:** no `focus: { kind: 'family', label: 'אופיר' }` is set after a family answer,
  and `contextResolver.resolveFollowUp` has no family-relation follow-up expansion.
- **Smallest fix:** set a family focus after a family answer; expand a bare relational follow-up
  ("ומי בעלה / ואחותה / ובן כמה") against it. Medium (focus + resolver) — queued.
- **Evidence:** CODE.

### G4 — P2 — "Who is X" answered from Martita's perspective, not X's
- **Transcript:** `מי זאת אופיר` → `מרטיטה הסבתא של אופיר (דרך מור).`
- **Expected:** describe the person asked about — "אופיר, הנכדה שלך, הבת של מור" (as the dead
  `tryGroundedAnswer` path does), not "Martita is Ofir's grandmother".
- **First divergence:** a bare identity query `מי זה/זאת X` is routed to the relation-between engine
  (`familyRelationEngine`), which frames every answer as Martita↔X.
- **Smallest fix:** for a bare identity query (no "של"), answer with the person's own identity blurb
  before falling to relation-between. Shares the family path → needs regression care. Queued.
- **Evidence:** CODE.

### G5 — P2 — Personal-fact recall (pet) not surfaced
- **Transcript:** `איך קוראים לכלב שלי` → `לא יודעת` (should be "טוטסי"; `matriarch.pet` in
  `knowledge/family_data.json`). Even `tryGroundedAnswer` misses it (`מה שם הכלב שלי` → null).
- **First divergence:** no handler surfaces `matriarch.pet` for a "my dog's name" query.
- **Smallest fix:** add a small personal-fact lookup (pet name, city, origin) from the matriarch
  record. Contained, low-risk, low value. Queued.
- **Evidence:** CODE.

### G6 — P2 — Correction that names a different entity punts
- **Transcript:** `מי זה רפי` → `לא, התכוונתי ליעל` (no, I meant Yael) → `[LLM]`.
- **Expected:** re-answer about Yael (self-correction of the *subject*).
- **First divergence:** a correction naming a new family member is not re-routed to the family
  identity path (the "לא, התכוונתי ל-X" form isn't recognized as a subject correction).
- **Smallest fix:** detect "לא, התכוונתי ל-<name>" → re-run the identity query on `<name>`. Queued.
- **Evidence:** CODE.

### G7 — P2 — Ambiguous "מה יש לי" punts instead of routing to the calendar
- **Transcript:** `מה יש לי` (what do I have) → `[LLM]`.
- **Expected:** treat a bare "what do I have" as a calendar read (today) or ask "ביומן? היום?".
- **First divergence:** `מה יש לי` without a date/noun isn't classified as `calendar_read`.
- **Smallest fix:** route a bare "מה יש לי / מה יש לי היום" to the calendar-read reasoner (defaulting
  to today). Low-risk. Queued.
- **Evidence:** CODE.

### G8 — P3 — Emotional/greeting turns rely entirely on the LLM
- **Transcript:** `אני קצת עצובה היום` / `אני מתגעגעת לפפי` / `estoy un poco sola hoy` / `שלום`.
- **Note:** these legitimately need warm *prose* → LLM is acceptable. But there is **no deterministic
  warmth or safety floor** if the LLM is unavailable, and Pepe's memorial tone (`emotional-accuracy`
  rule) is not guaranteed. Not a punt-bug; a resilience/tone-guarantee gap.
- **Smallest fix:** a deterministic warm fallback for a small set of ordinary-emotional intents
  (loneliness, missing Pepe, boredom) when the LLM path is unavailable, honoring the tone rules.
  Queued (needs `martita-tone-check`).
- **Evidence:** CODE for the fallback; the *felt* warmth is DEVICE-GATED (see below).

---

## DEVICE-GATED conversation behaviors (not assertable from text)

These are real parity dimensions but require a physical device + human ears; they must **not** be
claimed from the text harness. Emit/execute an Operator Protocol for each:

- **Prosody, warmth, age-appropriate voice, Spanish/Hebrew pronunciation** — blinded human listening.
- **First-audible-response and tail latency** (the ~20s device observation on the Board).
- **Interruption / barge-in timing and overlap** (full-duplex is structurally limited on the public
  Realtime API — see program §27; record as `BLOCKED[OFFICIAL_CURRENT]`, do not imitate).
- **Audibility on the target device / PWA** (mic capture + speaker route).

Existing protocols cover parts of this: `diagnostics/operator-protocols/OP-001-*` (fragment create),
`OP-002-*` (Spanish voice create). A dedicated **conversation-quality** listening protocol
(naturalness/warmth/turn-taking on the seed scenarios) should be added when device access is scheduled.

---

## Recovery-cycle selection

**G1 (possessive spouse query)** is taken through a full recovery cycle this session: it is the
highest-value gap with a genuinely *small, safe* fix (a contained REL surface-form addition, the same
proven-safe shape as the 0.71.0 ex-spouse work), it is fully machine-provable, and it converts a
common family question from an ungrounded LLM punt into a grounded family fact — directly serving the
parity + truthfulness goal (§14.11, §19, §47 "no wrong/invented family relationship").

G2 (Spanish family) is higher raw value but a larger, additive change (recognition + Spanish
rendering); G3 (referent-carry) needs family-focus tracking. Both are the strongest next candidates.

# MASTER Checkpoint — Cycles 39–40 (Generative Marathon widening) + next: Parity Judge

## Segment-18 update — Cycle 57: LEDGER EXPANSION v3 — nightly autopilot core + honest infra limits

**HEAD:** `fix …edge-safe cron (0.137.0-nightly-autopilot)` — pushed `origin/rc5` (`e0e98fe`).
**Fresh PREVIEW:** `https://abu-bank-582kg5kit-leos-projects-d3c04c09.vercel.app` — health
`0.137.0`; **`/api/cron/nightly` LIVE** → `🟢 הכל תקין`, channel `status-page`, honest infra note.

Built the invisible maintenance chain (all CODE-provable, reusing existing engines):
- **LEDGER CURATOR** (`ledgerCurator.ts` + `LedgerService.curate/undoCuration`): dedupe /
  supersede (latest wins, in place) / reorder — NEVER deletes a fact; one Hebrew line per
  change; whole curation UNDOABLE. **PROOF: a planted duplicate + superseded fact are cleaned,
  facts survive, undoable** (3/3).
- **NIGHTLY CHAIN** (`nightlyAutopilot.ts`): duel corpus + flight-recorder analyzer + curator →
  ONE Hebrew line (🟢/🟠 N) + a ready-made fix-the-queue prompt when items exist (5/5).
- **LEO-ONLY NOTIFICATION** (`notify.ts`): Resend email when key+recipient exist, else the honest
  Leo-only status page; never Martita-facing (4/4).
- **SERVER CRON** (`api/cron/nightly.ts` edge + `vercel.json` crons 03:00): the Leo-only status
  page, **PREVIEW-verified live** (cronNightly 2/2).

**HONEST INFRA LIMITS (verified by name, not hidden):** NO storage backend (KV/Postgres/Blob),
NO email provider (Resend/SendGrid/SMTP), NO deps addable (package.json is approval-gated) are
provisioned here. So **cloud-canonical persistence, real email, and guaranteed cron firing are
DEFERRED** — the endpoint + fallbacks are built + documented. Evidence: CODE — full suite 11115
pass / 2 todo, typecheck + build; PREVIEW — cron endpoint responds with the status page.

**Mandate proofs status:** ✓ curator cleans duplicate+superseded (undoable) · ✓ scheduled
endpoint responds + notification emits (honest status-page fallback documented) · ⬜ ledger write
cross-client (needs cloud store) · ⬜ person-chapter question (needs item 2) · ⬜ free-text
add→diff→approve UI (applyBatch diff is CODE-proven; UI not built).

**Remaining (needs infra creds or bigger work):** (1) CLOUD-CANONICAL ledger — a provisioned
KV/Postgres/Blob store + a /api/ledger read/write endpoint (gated by THE LAWS server-side) +
offline-tolerant sync; prove a write from one client is visible from another. (2) FULL-PERSON
CHAPTERS — expand LedgerPerson to a chapter (residence/work/hobbies/health/events/stories/prefs
with provenance+date); Abu answers any personal question from it. (3) a תעודת המשפחה screen +
one-tap upload diff approval (reuse applyBatch) + ledger view (renderLedgerHebrew). (4) email +
cron once a provider/store is provisioned.

**Continuation prompt (paste to resume):**

> Resume LEDGER EXPANSION v3 on rc5 from HEAD (0.137.0-nightly-autopilot; pushed; preview
> https://abu-bank-582kg5kit-leos-projects-d3c04c09.vercel.app health-verified; /api/cron/nightly
> live). Verify git + preview health. The autopilot core (curator + nightly chain + Leo-only
> notification + cron status page) is built + CODE-proven, with honest infra limits documented (no
> cloud store / email / addable deps). Next, pick the highest-value PROVABLE-WITHOUT-CREDENTIALS
> piece: (2) FULL-PERSON CHAPTERS — extend LedgerPerson to a full chapter (relations already exist;
> add residence/work/hobbies/health/events/stories/preferences, each fact with provenance + date),
> wire a chapter-read into the family engine so Abu answers a personal question ("איפה גר X", "מה
> X אוהב") from the ledger chapter — RED-first controller round-trip, proven on preview — OR (3) a
> senior-safe one-tap UPLOAD DIFF surface (a card/screen) that runs applyBatch on pasted facts and
> shows the one-line accept/reject diff, each committed on tap, + a תעודת המשפחה view rendering
> renderLedgerHebrew — proven on preview. Cloud-canonical storage + email stay DEFERRED until a
> store/provider is provisioned (never fabricate them; document honestly). Reuse
> familyLaws/ledgerService/ledgerRuntime/conversationIntake/ledgerCurator; never a parallel path.
> RED-first; smallest general mechanism; bump version + keep src/version.ts ⇄ api/health.ts ⇄
> src/version.test.ts in sync (no apostrophes in buildLabel); typecheck + full vitest + build;
> redeploy + re-run e2e for any app change; commit + push rc5. NEVER merge to main (hard stop —
> explicit joint decision only). Only deployed-preview evidence counts for product claims; label
> CODE vs PREVIEW vs DEVICE honestly. Checkpoint honestly.

## Segment-17 update — Cycle 56: REVOLUTION session 6 — the soft-confirm door (three doors complete)

**HEAD:** `feat …Cycle 56 (0.136.0-ledger-soft-confirm)` — pushed `origin/rc5` (`8188d2f`).
**Fresh PREVIEW:** `https://abu-bank-qu436onp2-leos-projects-d3c04c09.vercel.app` — health
`0.136.0-ledger-soft-confirm`.

Completed the three-door conversation intake (explicit ✓ Cycle 55, ignore ✓, **soft-confirm ✓**):
- A plainly-stated family fact with NO "תזכרי" is caught ONLY in the general path (real domains
  win first), replies ONE Hebrew confirm prompt, and sets `pendingLedgerChange` WITHOUT writing.
- The next "כן" commits it through THE LAWS gate; "לא" abandons it; any other turn drops it.
- The pending-confirm resolver runs before the conversation engine, guarded (createState idle +
  no pendingReminder + pendingLedgerChange), so it can NEVER hijack the calendar "כן".

**PREVIEW-PROVEN round-trip on 0.136.0:** `רותי היא אשתו של דני` → `לרשום שזה נכון?` · `כן` →
`רשמתי: רותי ודני נשואים` · `מי אשתו של דני` → `דני נשוי לרותי`. Evidence: CODE — ledgerSoftConfirm
3/3, truth + AbuAI 4545 pass, full suite 11101 pass / 2 todo, typecheck + build; no regressions.

**Conversation write path is now COMPLETE** (explicit write, soft-confirm, vague-never, family
reads from ledger, all gated by THE LAWS — every piece PREVIEW-proven).

**Remaining (product tail):** (1) birthdays→calendar — on an approved birthdate write, create the
yearly entry via the AbuCalendar service (`proposeBirthdayEvent` exists); (2) a senior-safe one-tap
upload diff approval surface (reuse `applyBatch` one-line diff); (3) a ledger view surface for Leo
(`renderLedgerHebrew`); (4) pre-emission ledger check + per-reply source tagging.

**Continuation prompt (paste to resume):**

> Resume the REVOLUTION mandate on rc5 from HEAD (0.136.0-ledger-soft-confirm; pushed; preview
> https://abu-bank-qu436onp2-leos-projects-d3c04c09.vercel.app health-verified). Verify git +
> preview health. The conversation write path is COMPLETE (explicit + soft-confirm + vague-never +
> family-reads-from-ledger, all gated, PREVIEW-proven). Next, pick ONE: (1) BIRTHDAYS→CALENDAR — when
> a birthdate is written to the ledger (explicit or confirmed), create the recurring yearly entry via
> the existing AbuCalendar service (proposeBirthdayEvent already returns the shape) — RED-first
> controller/integration test (write a birthdate → the yearly יום-הולדת event exists + is
> readable), proven on preview — OR (2) a senior-safe one-tap UPLOAD DIFF surface (Settings or a card)
> that runs applyBatch on Leo's pasted facts and shows the one-line accept/reject diff, each fact
> committed only on tap — OR (3) a LEDGER VIEW surface (operator/Settings) rendering
> renderLedgerHebrew. Reuse familyLaws/ledgerService/ledgerRuntime/conversationIntake; never a
> parallel path. RED-first; smallest general mechanism; bump version + keep src/version.ts ⇄
> api/health.ts ⇄ src/version.test.ts in sync (no apostrophes in buildLabel); typecheck + full vitest
> + build; redeploy + re-run e2e for any app change; commit + push rc5. NEVER merge to main (hard stop
> — explicit joint decision only). Only deployed-preview evidence counts for product claims; label
> CODE vs PREVIEW vs DEVICE honestly. Checkpoint honestly.

## Segment-16 update — Cycle 55: REVOLUTION session 5 — the ledger goes LIVE in conversation

**HEAD:** `feat …Cycle 55 (0.135.0-ledger-wiring)` — pushed `origin/rc5` (`741e414`).
**Fresh PREVIEW:** `https://abu-bank-49feiyx2f-leos-projects-d3c04c09.vercel.app` — health
`0.135.0-ledger-wiring`.

Wired the ledger core into the AbuAI runtime through THE LAWS gate (RED-first, controller-level):
- **WRITE:** an explicit "תזכרי ש<family fact>" is intercepted in the memory-save path and
  written via `LedgerService.writeFact` (auto-creates a new relative, atomically). A
  contradiction is REFUSED at the gate and never stores; a normal preference "תזכרי ש…" is
  untouched (still preference-memory).
- **READ:** the family engine reads FROM the ledger — a conversation-added relation the static
  graph is silent about is answered from the ledger (raw input, so possessive pronouns aren't
  rewritten). Safe because the LAWS gate guarantees a ledger fact can't contradict the graph.

**PREVIEW-PROVEN round-trip on 0.135.0:** `תזכרי שדני נשוי לרותי` → `רשמתי: דני ורותי נשואים` ·
`מי אשתו של דני` → `דני נשוי לרותי` · `תזכרי שאופיר נשואה לרפי` → `לא רשמתי — אופיר כבר נשוי/ה
לגלעד … הורה־צאצא …` (the LAWS gate refusing, live). Evidence: CODE — ledgerWiring 3/3, AbuAI
4511 pass, full suite 11098 pass / 2 todo, typecheck + build; no regressions. PLUS deployed
PREVIEW round-trip above.

**Remaining (product tail):** (1) the soft-confirm flow — a plainly-stated fact (no "תזכרי")
sets a pending change + prompt, and the next "כן" commits (needs a `pendingLedgerChange` on
RuntimeState, guarded against the calendar "כן"); (2) a senior-safe one-tap upload diff approval
UI (reuse `applyBatch` one-line diff); (3) birthdays→calendar actually creating the yearly entry
on approval via the calendar service; (4) a ledger view surface for Leo (`renderLedgerHebrew`).

**Continuation prompt (paste to resume):**

> Resume the REVOLUTION mandate on rc5 from HEAD (0.135.0-ledger-wiring; pushed; preview
> https://abu-bank-49feiyx2f-leos-projects-d3c04c09.vercel.app health-verified). Verify git +
> preview health. The ledger is LIVE in conversation (explicit write gated + family reads from it,
> PREVIEW-proven). Next, pick ONE: (1) the SOFT-CONFIRM flow — add pendingLedgerChange to
> RuntimeState; a plainly-stated family fact (classifyIntake → soft-confirm, NO "תזכרי") replies the
> Hebrew confirm prompt and the NEXT "כן" commits via LedgerService.writeFact — RED-first controller
> test (state fact → "כן" → in ledger AND answerable), guarded so it never hijacks the calendar
> "כן" (only when createState idle + no pendingReminder + pendingLedgerChange set) — OR (2)
> birthdays→calendar: on an approved birthdate write, create the yearly entry via the existing
> AbuCalendar service (proposeBirthdayEvent already exists), proven on preview — OR (3) a
> senior-safe one-tap upload diff surface reusing applyBatch's one-line diff. Reuse
> familyLaws/ledgerService/ledgerRuntime/conversationIntake; never a parallel path. RED-first;
> smallest general mechanism; bump version + keep src/version.ts ⇄ api/health.ts ⇄
> src/version.test.ts in sync (no apostrophes in buildLabel); typecheck + full vitest + build;
> redeploy + re-run e2e for any app change; commit + push rc5. NEVER merge to main (hard stop —
> explicit joint decision only). Only deployed-preview evidence counts for product claims; label
> CODE vs PREVIEW vs DEVICE honestly. Checkpoint honestly.

## Segment-15 update — Cycle 54: REVOLUTION session 4 — the living ledger core

**HEAD:** `feat …Cycle 54 (0.134.0-family-ledger)` — pushed `origin/rc5` (`c26cd61`).
**Fresh PREVIEW:** `https://abu-bank-rby9vqccl-leos-projects-d3c04c09.vercel.app` — health
`0.134.0-family-ledger`.

Built the product-facing Truth-Loop foundation on top of THE LAWS (all pure, CODE-proven):
- **`LedgerService`** (`src/truth/ledgerService.ts`) — ONE canonical state; the ledger IS a
  pure function of (seed, change-log) → file-as-view. EVERY write goes through
  `familyLaws.applyChange` (THE LAWS gate): a contradiction can't enter, a rejected fact leaves
  NO log entry (poison never stores). Every change is one log line + UNDOABLE (replay from
  seed); persists across reload (`localLedgerStore`).
- **`renderLedgerHebrew`** (`ledgerView.ts`) — regenerates the canonical human-readable Hebrew
  ledger from state.
- **Conversation intake** (`conversationIntake.ts`) — three doors: explicit "תזכרי ש…" writes
  now; a plainly-stated fact gets ONE soft confirmation; a vague hint NEVER writes.
  `extractChange` parses spouse/parent/sibling/birthdate → a gated Change (an explicit
  poisoning fact is still refused at the gate). Upload → one-line diff per fact.
- **Birthdays → calendar** — a birthdate proposes a yearly entry on approval.

Evidence: CODE — ledgerService 12/12, truth suite 28, full suite 11095 pass / 2 todo,
typecheck + build. HONEST LIMIT: the ledger core is **not yet wired into the live conversation
runtime or a one-tap approval UI** — that is the remaining integration (next session), so this
is CODE + deploy/health PREVIEW only, no product-behavior claim.

**Continuation prompt (paste to resume):**

> Resume the REVOLUTION mandate on rc5 from HEAD (0.134.0-family-ledger; pushed; preview
> https://abu-bank-rby9vqccl-leos-projects-d3c04c09.vercel.app health-verified). Verify git +
> preview health. The ledger CORE is built + CODE-proven (src/truth/ledgerService.ts +
> ledgerView + conversationIntake, all through familyLaws.applyChange). What remains is the
> live WIRING: (1) call classifyIntake in the AbuAI conversation path so an explicit "תזכרי ש…"
> writes via LedgerService.write and a stated fact surfaces the soft-confirm prompt (the next
> "כן" commits the pending change) — RED-first via a controller-level test proving the round-trip
> (state a fact → confirm → it is in the ledger AND answerable) and that the LAWS gate still
> refuses a poisoning fact end-to-end; (2) make the family engine READ from the ledger where it
> has an override (ledger fact wins over the static graph) — smallest safe seam, prove a
> ledger-added relation is answered by the family reasoner; (3) a senior-safe one-tap diff
> approval surface (reuse applyBatch's one-line diff) for Leo's manual upload; (4) birthdays→
> calendar actually creating the yearly entry on approval via the existing calendar service. Reuse
> familyLaws/ledgerService/mirrorSuite/duel/weaknessMap; never a parallel path. RED-first; smallest
> general mechanism; bump version + keep src/version.ts ⇄ api/health.ts ⇄ src/version.test.ts in
> sync (no apostrophes in buildLabel); typecheck + full vitest + build; redeploy + re-run e2e for
> any app change; commit + push rc5. NEVER merge to main (hard stop — explicit joint decision
> only). Only deployed-preview-through-the-app evidence counts for product claims; label CODE vs
> PREVIEW vs DEVICE honestly. Checkpoint honestly.

## Segment-14 update — Cycle 53: REVOLUTION session 3 — Weakness Map (proof c) — ALL PROOFS DONE

**HEAD:** `feat …Cycle 53 (0.133.0-weakness-map)` — pushed `origin/rc5` (`120faf9`).
**Fresh PREVIEW:** `https://abu-bank-gkxd1683k-leos-projects-d3c04c09.vercel.app` — health
`0.133.0-weakness-map`.

Built the weakness map (Constitution §5) — `src/truth/weaknessMap.ts`:
- Auto-classifies every real miss (flight-recorder reality) into a failure ARCHETYPE
  (answer-not-the-question / phrase-not-resolved / fabricated-fact / capability-denial /
  repeated / rejected), tagged by domain + language. Detectors are domain-AGNOSTIC.
  `mineTranscript` over Leo's real stale-round turns yields the archetype map.
- **Cross-domain proof (c):** the phrase-not-resolved archetype was closed in CALENDAR (Cycle
  50) but the cross-domain probe caught it still OPEN in FAMILY (`מי החתן של רפי` punted to the
  LLM). **ONE general fix** closes it in both domains: `looksLikeFamilyQuery` recognizes in-law
  words (חתן/כלה/גיס/נין) → routes to the family engine; `familyReasoner` resolves via the SAME
  `resolvePersonPhrase` the calendar uses (`מי החתן של רפי` → `החתן של רפי הוא גלעד`). Locked by
  the cross-domain probe suite. **PREVIEW-proven** on 0.133.0.

Evidence: CODE — weaknessMap 3/3, full suite 11083 pass / 2 todo, typecheck + build; no
family/parity regressions. PREVIEW — family in-law who-is resolves on the deployed build.

**REVOLUTION PROOFS — ALL SIX DELIVERED:** (a) contradiction rejected at gate ✓ · (b) 1000+
mirrors pass + planted asymmetry caught ✓ · (c) cross-domain archetype fix ✓ · (d) regressed
challenger blocked ✓ · (e) poison never stores ✓ · (f) upload one-line diff ✓.

**Remaining (product-facing Truth-Loop wiring — not a "proof" but the user-visible half):** the
canonical Hebrew ledger FILE + conversation write path (one soft confirmation / explicit תזכרי /
never vague) + Leo's manual upload with one-tap diff approval; birthdays→calendar auto-entries;
pre-emission ledger check with one corrective retry; per-reply source tagging.

**Continuation prompt (paste to resume):**

> Resume the REVOLUTION mandate on rc5 from HEAD (0.133.0-weakness-map; pushed; preview
> https://abu-bank-gkxd1683k-leos-projects-d3c04c09.vercel.app health-verified). Verify git +
> preview health. ALL SIX revolution PROOFS (a–f) are delivered (LAWS gate, 1380 mirrors,
> weakness-map cross-domain, champion/challenger duel). What remains is the PRODUCT-FACING
> Truth-Loop wiring — turn familyLaws.applyChange into a persisted, user-visible LEDGER: (1) a
> canonical human-readable Hebrew ledger file regenerated from state (file-as-view) that the family
> engine reads FROM; (2) a conversation write path — one soft in-flow confirmation for a stated
> fact, explicit "תזכרי ש…" writes immediately, vague hints never write — all through
> familyLaws.applyChange so THE LAWS gate every write; (3) Leo's manual upload/edit → extraction +
> one-tap diff approval (reuse applyBatch's one-line diff); (4) birthdays/life-events entering the
> ledger auto-create yearly calendar entries on approval; (5) every change logged one line +
> undoable; (6) pre-emission ledger check with one corrective retry + per-reply source tagging.
> Reuse familyLaws/mirrorSuite/duel/weaknessMap; never a parallel path. RED-first; smallest general
> mechanism; bump version + keep src/version.ts ⇄ api/health.ts ⇄ src/version.test.ts in sync (no
> apostrophes in buildLabel); typecheck + full vitest + build; redeploy + re-run e2e for any app
> change; commit + push rc5. NEVER merge to main (hard stop — explicit joint decision only). Only
> deployed-preview evidence counts for product claims; label CODE vs PREVIEW vs DEVICE honestly.
> Checkpoint honestly.

## Segment-13 update — Cycle 52: REVOLUTION session 2 — Champion vs Challenger duel (proof d)

**HEAD:** `feat …Cycle 52 (0.132.0-champion-challenger-duel)` — pushed `origin/rc5` (`68d6bcf`).
**Fresh PREVIEW:** `https://abu-bank-diord29g0-leos-projects-d3c04c09.vercel.app` — health
`0.132.0-champion-challenger-duel`.

Built the Learning-Loop safety capstone (Constitution §6) — the promotion gate:
- **corpusScore** (`src/eval/duel.ts`) REUSES existing engines (runParityGuard: parity 6 dims +
  marathon smoke + flight-recorder reality; + the 1380-mirror suite) into one per-dimension
  scorecard. No parallel path.
- **duel()** is pure: a single regressed dimension OR lost coverage BLOCKS promotion and names it.
- **runWeeklyDuel** duels the current build vs the stored champion baseline
  (`docs/eval/CHAMPION_BASELINE.json`), advances the baseline only on a pass, and writes Leo one
  plain-Hebrew line to `docs/eval/DUEL_LATEST.md`:
  `השבוע: 0 נתפסו, 0 תוקנו, 0 חזרו (חובה: 0 חזרו) — עבר ✓`.

**Proof (d) delivered:** a deliberately regressed challenger (mirror breaks) and a coverage-loss
challenger are both BLOCKED + named; an equal/improved build passes. Evidence: CODE — duel 7/7
(corpus mirrors 1380, all dims green), full suite 11080 pass / 2 todo, typecheck + build.

**Revolution proof status:** (a) ✓ (b) ✓ (d) ✓ (e) ✓ (f) ✓ — only **(c)** remains.

**Remaining (final session):** (c) WEAKNESS MAP — auto-mine flight-recorder reality
(corrected/repeated/abandoned/rejected/capability-denial) into failure ARCHETYPES; prove an
archetype fixed in calendar is caught by a cross-domain probe when planted in family. Plus the
product-facing Truth-Loop wiring: the canonical Hebrew ledger FILE + conversation write path (one
soft confirmation / explicit תזכרי / never vague) + Leo's manual upload with one-tap diff approval;
birthdays→calendar auto-entries; pre-emission ledger check with one corrective retry; per-reply
source tagging.

**Continuation prompt (paste to resume):**

> Resume the REVOLUTION mandate on rc5 from HEAD (0.132.0-champion-challenger-duel; pushed; preview
> https://abu-bank-diord29g0-leos-projects-d3c04c09.vercel.app health-verified). Verify git +
> preview health. Sessions 1–2 shipped the LAWS write gate, the 1380-mirror suite, and the
> champion/challenger duel (proofs a,b,d,e,f). Deliver the LAST proof (c) WEAKNESS MAP: build a
> failure-archetype miner over the flight-recorder reality (reuse flightRecorderImport +
> leoStaleRoundRegression + the recordTurn export shape) that classifies each real miss into an
> ARCHETYPE (answer-not-the-question, phrase-not-resolved, fabricated-fact, only-partial-answer,
> capability-denial, repeated/abandoned) tagged by domain+language; then prove an archetype fixed
> in CALENDAR (e.g. answer-the-whole-question / resolve-the-phrase) is caught by a CROSS-DOMAIN
> probe when the same archetype is planted in FAMILY — i.e. one general fix must close the archetype
> across ALL domains + BOTH languages, with new mirrors generated around it and locked forever.
> Reuse familyLaws/mirrorSuite/duel; never a parallel path. Then (product) start the ledger FILE +
> conversation write path via familyLaws.applyChange (persisted canonical Hebrew ledger, one-tap
> diff approval, birthdays→calendar). RED-first; smallest general mechanism; bump version + keep
> src/version.ts ⇄ api/health.ts ⇄ src/version.test.ts in sync (no apostrophes in buildLabel);
> typecheck + full vitest + build; redeploy + re-run e2e for any app change; commit + push rc5.
> NEVER merge to main (hard stop — explicit joint decision only). Only deployed-preview evidence
> counts for product claims; label CODE vs PREVIEW vs DEVICE honestly. Checkpoint honestly.

## Segment-12 update — Cycle 51: REVOLUTION mandate session 1 — the Constitution foundation

**HEAD:** `feat …Cycle 51 (0.131.0-constitution-foundation)` — pushed `origin/rc5` (`dad5ba6`).
**Fresh PREVIEW:** `https://abu-bank-f47q6svky-leos-projects-d3c04c09.vercel.app` — health
`0.131.0-constitution-foundation`. (Cycle 50 = calendar-search which-day fix, 0.130.0, prior.)

Built the two constitutional keystones as pure, CODE-provable mechanisms under `src/truth/`:
- **THE LAWS (`familyLaws.ts`) — the write gate.** `applyChange` runs the invariant suite on
  the simulated post-change state and REJECTS at the gate with a one-line Hebrew reason;
  symmetry is maintained BY CONSTRUCTION. Laws: no-cycle (L2), parent-older (L4),
  monogamy+incest (L7), siblings-share-parents (L3), one-identity/alias-quarantine (L5),
  age-from-birthdate (L6), no-self (L8). `applyBatch` → one-line diff per fact. Seeded from the
  real graph (`ledgerSeed`).
- **METAMORPHIC MIRROR SUITE (`mirrorSuite.ts`).** 1380 oracle-free checks (inverse-existence +
  paraphrase-alias, He+Es) over the real relation engine + a spouse-symmetry mirror.

**Proofs delivered this session:** (a) contradiction rejected at gate; (b) 1000+ mirrors pass +
planted asymmetry caught by mirrors alone; (e) poison never stores; (f) upload one-line diff.
Evidence: CODE — familyLaws 10/10, mirrorSuite 3/3 (1380 mirrors, 0 breaks), full suite 11073
pass / 2 todo, typecheck + build. Operator-runnable (not typed AbuAI checks yet — no
conversation→ledger write path is wired).

**Deferred (remaining revolution work):** (c) weakness-map archetypes + cross-domain probes;
(d) champion/challenger promotion duel + weekly-guard one-line Hebrew summary; the canonical
Hebrew ledger FILE + conversation-fact write path (one soft confirmation / explicit תזכרי /
never vague) + Leo's manual upload with one-tap diff approval; birthdays→calendar auto-entries;
pre-emission ledger check with one corrective retry; per-reply source tagging.

**Continuation prompt (paste to resume):**

> Resume the REVOLUTION mandate on rc5 from HEAD (0.131.0-constitution-foundation; pushed;
> preview https://abu-bank-f47q6svky-leos-projects-d3c04c09.vercel.app health-verified). Verify
> git + preview health. Session 1 shipped the two keystones (src/truth/familyLaws.ts write gate
> + src/truth/mirrorSuite.ts 1380 mirrors; proofs a,b,e,f). Next highest-value, pick ONE and
> prove it: (c) WEAKNESS MAP — auto-mine the flight-recorder reality (user corrected/repeated/
> abandoned/rejected/capability-denial) into failure ARCHETYPES; prove an archetype fixed in
> calendar is caught by a cross-domain probe when planted in family (reuse leoStaleRoundRegression
> + flightRecorderImport) — OR (d) CHAMPION vs CHALLENGER — a duel harness that promotes a build
> only if it beats the previous on the ENTIRE corpus (recorded history + notebook + mirror suite +
> parity scorecard) with NO dimension regressing; prove a deliberately regressed challenger is
> BLOCKED; wire the weekly guard to write Leo one plain-Hebrew line — OR the LEDGER FILE +
> conversation write path (extend familyLaws.applyChange into a persisted canonical Hebrew ledger
> with one-tap diff approval + birthdays→calendar). Reuse familyLaws/mirrorSuite; never a parallel
> path. RED-first; smallest general mechanism; bump version + keep src/version.ts ⇄ api/health.ts ⇄
> src/version.test.ts in sync (no apostrophes in buildLabel); typecheck + full vitest + build;
> redeploy + re-run e2e for any app change; commit + push rc5. NEVER merge to main (hard stop —
> explicit joint decision only). Only deployed-preview-through-the-app evidence counts for product
> claims; label CODE vs PREVIEW vs DEVICE honestly. Checkpoint honestly per session.

## Segment-11 update — Cycle 49: Leo stale-round triage + which-day fix + stale-build guard

**HEAD:** `fix …Cycle 49 (0.129.0-day-and-stale-guard)` — pushed `origin/rc5` (`5fdc0fb`).
**Fresh PREVIEW:** `https://abu-bank-ec2dnxqxt-leos-projects-d3c04c09.vercel.app` — health
`0.129.0-day-and-stale-guard`.

**Root cause of Leo's "catastrophic" round:** it ran on a **49-versions-stale cached build
(0.79.0)**, not 0.128. Replayed the observed turns against the CURRENT app entry and imported
them as PERMANENT regressions (`leoStaleRoundRegression.test`, 5/5).

**Triage table:**
- *Already fixed 0.79→0.128 (locked green):* family contradiction (עדי/נועם = BROTHERS,
  deterministic, no invented בן דוד); relation-phrase create (אח של נועם → עדי); in-law chain
  (מה הקשר בין ירדן לנועם → via עילי).
- *STILL reproduced → NOW FIXED (RED-first):* calendar which-day/when. `באיזה יום` / `מתי הפגישה`
  returned only the hour / a location dead-end / the LLM. Fix (cognitiveRuntime.ts): route those
  phrasings to the property path + answer DAY+DATE+TIME via safeHebrewDate. **PREVIEW-proven:**
  `באיזה יום הפגישה` → `הפגישה עם רפי ב20 ביולי 2026, יום שני בשעה 15:00.`

**Stale-build guard (Bug 5):** `services/versionSync` existed but was wired NOWHERE (dead code —
why Leo ran stale silently). Mounted as a calm `StaleBuildBanner` in App (fetches /api/health,
offers one-tap refresh on version mismatch). Typed-script gained **Step 0** (verify QA badge ==
expected version, else STOP) + a which-day check.

Evidence: CODE — leoStaleRoundRegression 5/5, StaleBuildBanner 3/3, full suite 11057 pass / 2
todo, typecheck + build; which-day PREVIEW-proven.

**FOR LEO'S RE-RUN (the round that was invalidated):**
- Preview URL: `https://abu-bank-ec2dnxqxt-leos-projects-d3c04c09.vercel.app`
- Version to see (Home QA badge / Settings→About): `0.129.0-day-and-stale-guard`
- Typed script: `docs/LEO_TYPED_TEST_SCRIPT.md` — **START AT STEP 0** (verify the badge first).

**Note — his stale-round export:** still awaiting the paste to replay the FULL set through the
importer; the 4 prioritized bugs are triaged + fixed/locked above. When the export JSON arrives,
import via `importLeoRepro`-style → `replayExport` and fold any NEW failing turns into
`leoStaleRoundRegression.test`.

**Continuation prompt (paste to resume):**

> Resume on rc5 from HEAD (0.129.0-day-and-stale-guard; pushed; preview
> https://abu-bank-ec2dnxqxt-leos-projects-d3c04c09.vercel.app health-verified). Verify git +
> preview health. Leo's stale-round is triaged: which-day fixed + PREVIEW-proven, stale-build guard
> live (StaleBuildBanner + typed-script Step 0), regressions locked. If Leo pastes his full export
> JSON, replay EVERY turn via the flight-recorder importer (replayExport) and fold new failures into
> leoStaleRoundRegression.test (RED-first). Otherwise await his re-run on 0.129.0 and triage what he
> reports. Standing law: latest ChatGPT, NORMAL pace by default. Keyed Claude cross-check stays
> out-of-band (no ANTHROPIC_API_KEY; never read .env — hard stop). RED-first; smallest general root
> fix; bump version + keep src/version.ts ⇄ api/health.ts ⇄ src/version.test.ts in sync (no
> apostrophes in buildLabel); typecheck + full vitest + build; redeploy + re-run e2e for any app
> change; commit + push rc5. NEVER merge to main (hard stop — explicit joint decision only). Only
> deployed-preview-through-the-app evidence counts; label CODE vs PREVIEW vs DEVICE honestly.

## Segment-10 update — Cycle 48: voice-readiness pack + parity guard + typed script (brain-phase close-out)

**HEAD:** `feat …Cycle 48 (0.128.0-voice-readiness)` — pushed `origin/rc5` (`e6d19af`).
**Fresh PREVIEW for Leo's verification round:**
`https://abu-bank-hshx2ngc2-leos-projects-d3c04c09.vercel.app` — health `0.128.0-voice-readiness`;
`e2e/preview-parity.spec.ts` 2/2 (no regression).

Closed the four requested items in one run (all CODE, no device claims):
1. **Voice-readiness pack** — (a) iOS mic constraints centralized to one source
   (`services/audioConstraints` `MIC_GETUSERMEDIA`) at every primary capture site, bare
   `{audio:true}` only as the iOS fallback; (b) per-user speech profile
   (`services/speechProfile`) — NORMAL 1.0 by default, explicit-change-only, single source for
   `voice.ts` + Settings; (c) cached warm openers (`services/warmOpeners`) wired into
   `getVoiceGreeting` behind a DEFAULT-OFF flag (`abu-warm-openers`) pending Leo's blind listening.
   RED-first `voiceReadiness.test` 7/7; `micCapture.test` updated to the refactor (21/21).
2. **Weekly parity guard** — `src/eval/parityGuard.*` (parity scorecard + marathon smoke +
   flight-recorder replay → `docs/eval/PARITY_GUARD_LATEST.md`). Run:
   `PARITY_GUARD_WRITE=1 npx vitest run src/eval/parityGuard.test.ts` (GREEN, no drift).
3. **Typed script** — `docs/LEO_TYPED_TEST_SCRIPT.md` refreshed to 31 numbered bilingual checks
   with exact expected answers from the preview E2E + good/failing examples.
4. **Fresh preview** deployed + health-verified (above).

Evidence: CODE — full suite 11049 pass / 2 todo, typecheck + build clean. package.json untouched.

**FOR LEO'S BIG VERIFICATION ROUND:**
- Preview URL: `https://abu-bank-hshx2ngc2-leos-projects-d3c04c09.vercel.app`
- Version to see (Settings → About / Home QA badge): `0.128.0-voice-readiness`
- Typed test script: `docs/LEO_TYPED_TEST_SCRIPT.md` (31 checks).

**Continuation prompt (paste to resume):**

> Resume on rc5 from HEAD (0.128.0-voice-readiness; pushed; preview
> https://abu-bank-hshx2ngc2-leos-projects-d3c04c09.vercel.app health-verified). Verify git +
> preview health. The brain-phase items are closed: Flight Recorder, P2+parity PROVEN on preview,
> cross-language contamination fixed, normal speech pace, voice-readiness pack (mic constraints /
> speech profile / warm openers behind default-off flag), weekly parity guard, and a 31-check typed
> script for Leo. Next depends on Leo's verification-round results: triage any typed-script check he
> reports failing (RED-first regression → smallest general root fix → redeploy → re-run e2e), OR if
> all green, move to the VOICE (device) phase — turn on warm openers for his blind listening
> (localStorage abu-warm-openers=1), gather PHYSICAL_DEVICE evidence for audio pace / time-to-first-
> audio / STT quality (the one thing CODE/PREVIEW cannot prove). Keyed Claude cross-check stays
> out-of-band (no ANTHROPIC_API_KEY; never read .env — hard stop). RED-first; smallest general root
> fix; bump version + keep src/version.ts ⇄ api/health.ts ⇄ src/version.test.ts in sync (no
> apostrophes in buildLabel); typecheck + full vitest + build; redeploy + re-run e2e for any app
> change; commit + push rc5 (never production). Only deployed-preview-through-the-app evidence counts;
> label CODE vs PREVIEW vs DEVICE honestly.

## Segment-9 update — Cycle 47: latency pack — NORMAL speech pace by default

**HEAD:** `fix …Cycle 47 (0.127.0-normal-speech-pace)` — pushed `origin/rc5` (`034714a`).
**Fresh PREVIEW:** https://abu-bank-3p20sg2r8-leos-projects-d3c04c09.vercel.app — health
`0.127.0`; `e2e/preview-parity.spec.ts` 2/2 (no regression from the pace change).

Latency pack, highest-value provable slice. The standing law (benchmark = latest ChatGPT at
NORMAL human speech pace, never slowed by default) was VIOLATED: the applied TTS speed
(`voice.ts` → `getEffectiveRate` → `getVoiceProfile(lang).rate`) defaulted to 0.95 (He) / 0.97
(Es) and the Settings scale maxed at 0.95 — nothing played at normal 1.0. FIX: HE/ES rate → 1.0;
Settings scale re-centered (איטי 0.9 / רגיל 1.0 / מהיר 1.1), default 1.0; overrides still honored
(clamped 0.8–1.15). RED-first: the old voiceConfig test ENCODED the slowed default — rewritten to
assert the law (default === 1.0), red before the fix. Realtime path model-voiced (unchanged).
**Latency table** recorded `docs/eval/LATENCY_TABLE.md`: deterministic 0.31–0.68s < 1s
(PREVIEW-measured), LLM ~4s, online 4.8–6.8s. CODE: voiceConfig 6/6, full suite 11041 pass / 2
todo, typecheck + build.

**Honest deferral:** true sentence-by-sentence AUDIO streaming (time-to-first-audio) is
DEVICE evidence — the reply is still handed to TTS as one `speak()` blob; not done here. Lean
context injection is already lean at the runtime (grounding mostly null). Greeting-time calendar
prefetch is marginal (calendar is local <1s).

**Continuation prompt (paste to resume):**

> Resume the NEXT MANDATE on rc5 from HEAD (0.127.0-normal-speech-pace; pushed; preview
> https://abu-bank-3p20sg2r8-leos-projects-d3c04c09.vercel.app health-verified). Verify git +
> preview health. Done: Flight Recorder (P1), P2+parity PROVEN on preview, cross-language
> contamination fixed (Cycle 46), normal speech pace by default + latency table (Cycle 47). Pick
> the next highest-value remaining: (4) VOICE-READINESS PACK code-level — iOS getUserMedia
> constraints (echoCancellation, noiseSuppression, autoGainControl) in the mic-capture path
> (src/services/ mic/realtime), a per-user speech profile (the rate override already exists —
> extend to a small profile object read from settings), cached warm openers behind a DEFAULT-OFF
> flag; all CODE-level, NO device claims — OR (5) a weekly parity-guard script wrapping
> parityScorecard + generativeMarathon smoke + flightRecorderImport into a dated report (drift
> detection) — OR (6) refresh docs/LEO_TYPED_TEST_SCRIPT.md to ~30 bilingual behavior checks and
> run vs preview. Standing law: NORMAL ChatGPT pace, never slowed by default. Keyed Claude
> cross-check stays out-of-band (no ANTHROPIC_API_KEY; never read .env values — hard stop).
> RED-first; smallest general root fix; bump version + keep src/version.ts ⇄ api/health.ts ⇄
> src/version.test.ts in sync (no apostrophes in buildLabel); typecheck + full vitest + build; for
> any app-code change redeploy a fresh preview + re-run e2e vs it; commit + push rc5 (never
> production). Only deployed-preview-through-the-app evidence counts for product claims; label
> CODE vs PREVIEW vs DEVICE honestly.

## Segment-8 update — Cycle 46: cross-language contamination FIXED (CODE + PREVIEW)

**HEAD:** `fix …Cycle 46 (0.126.0-crosslang-supersede)` — pushed `origin/rc5` (`fd8ef9f`).
**Fresh PREVIEW:** https://abu-bank-fguzpk5us-leos-projects-d3c04c09.vercel.app — health
`0.126.0-crosslang-supersede`.

Fixed the single-session contamination the Segment-7 browser E2E surfaced. **First divergence**
(mechanism-first): with a Hebrew create on a pending "נכון?", a Spanish create rendered a
Spanish confirm for Gabi but `createState.draft` stayed on the stale Hebrew גלעד —
`classifySignalV2`'s new-create detector was Hebrew-only → the Spanish create was misread as
`side_question` → `side_keep` restored the stale draft → the next `dale, agendalo` SAVED גלעד in
Hebrew. **Root fix** (`conversationEngineV2.ts`): a NON-Hebrew genuine create (`isCreateIntent`,
not a draft-edit) now classifies `new_create → replace`; scoped to non-Hebrew input so Hebrew
incremental collecting is untouched. **RED-first** `crossLanguageDraftSupersession.test.ts` (2/2).

Evidence: CODE — full suite 11041 pass / 2 todo; typecheck + build clean. **PREVIEW** —
`e2e/preview-parity.spec.ts` (2/2 vs the fresh 0.126.0 preview): the single-session supersession
now yields `Listo, te agendé una reunión con Gabi…` (saves Gabi in Spanish, not גלעד in Hebrew).

**Continuation prompt (paste to resume):**

> Resume the NEXT MANDATE on rc5 from HEAD (0.126.0-crosslang-supersede; pushed; preview
> https://abu-bank-fguzpk5us-leos-projects-d3c04c09.vercel.app health-verified). Verify git +
> preview health. Priority 1 (Flight Recorder) shipped; P2 + bilingual parity PROVEN on preview;
> the single-session cross-language contamination is FIXED (Cycle 46) and proven on preview. Pick
> the next highest-value remaining priority: (3) LATENCY PACK — sentence-by-sentence streamed TTS,
> lean per-turn context injection (only turn-relevant facts into the voice session), greeting-time
> calendar prefetch; record a preview latency table (deterministic <1s already shown 0.31–0.68s;
> LLM <4s; online <8s) — OR (4) VOICE-READINESS PACK code-level (iOS getUserMedia
> echoCancellation/noiseSuppression/autoGainControl; per-user speech profile defaulting to NORMAL
> ChatGPT-like pace; cached warm openers behind a default-off flag) — OR (5) a weekly parity-guard
> script wrapping parityScorecard + generativeMarathon smoke + flightRecorderImport into a dated
> report — OR (6) refresh docs/LEO_TYPED_TEST_SCRIPT.md to ~30 bilingual behavior checks and run
> vs the preview. Standing law: benchmark is the latest ChatGPT at NORMAL human speech pace, never
> slowed by default. Keyed Claude cross-check stays out-of-band (no ANTHROPIC_API_KEY; never read
> .env values — hard stop). RED-first; smallest general root fix; bump version + keep src/version.ts
> ⇄ api/health.ts ⇄ src/version.test.ts in sync (no apostrophes in buildLabel); typecheck + full
> vitest + build; for any app-code change redeploy a fresh preview and re-run the e2e vs it; commit
> + push rc5 (never production). Only deployed-preview-through-the-app evidence counts for product
> claims; label CODE vs PREVIEW honestly.

## Segment-7 update — browser E2E vs preview: P2 + parity PROVEN (PREVIEW)

**No version bump** (preview-evidence commit; the deployed build under test is `0.125.0`,
matching HEAD — same convention as prior `test(preview):` commits). Preview:
https://abu-bank-9vwvg4c29-leos-projects-d3c04c09.vercel.app.

Drove real browsers (Playwright, mobile-chrome, he-IL, 412×870) against the preview, typing into
the AbuAI screen and reading the reply bubble — the client-side cognition the endpoint probes
could not reach. Results (`docs/eval/PREVIEW_EVIDENCE_0125.md` + `PREVIEW_PARITY_RESULTS.json`):
- **P2 rambling extraction PROVEN** (`e2e/leo-device-failures.spec.ts`): story → `פגישה עם גלעד
  … בית קפה טולדנו …` — resolvedToGilad ✓, hasLocation ✓, dateTomorrow ✓, verbatimDump ✗;
  Cycle-43 subject-dedup holds on the deployed build.
- **Deterministic script 18/18** (`e2e/preview-typed-script.spec.ts`): family/date/memory/calendar
  CRUD+referability/math, ~300–400ms.
- **Bilingual parity 8/8 in ISOLATED sessions** (NEW `e2e/preview-parity.spec.ts`, one fresh
  session per flow to match the CODE oracle): He relation/date/rambling; Es family/math + full
  CRUD create→confirm→cancel **all in Spanish, zero Hebrew leak** (Cycle-41 Spanish-cancel proven).
- **Preview latency (in-browser, deterministic path): 0.31–0.68s < 1s.** LLM proxy ~4s; online 4.8–6.8s.

**Documented candidate bug (NOT fixed — RED-first follow-up):** running He + Es in ONE session
(a He rambling create left on a pending "נכון?", then a Spanish create) caused the Spanish
`dale, agendalo` to confirm the STALE Hebrew גלעד draft in Hebrew (confirm≠read-back Gabi), and
`cancelalo` to cancel it with a Hebrew name in a Spanish sentence. Vanishes in isolated sessions.
Root: a new create must fully supersede a prior unconfirmed draft; a confirm must save what was
read back. See `PREVIEW_EVIDENCE_0125.md` → "Observed candidate bug".

**Continuation prompt (paste to resume):**

> Resume the NEXT MANDATE on rc5 from HEAD (0.125.0-flight-recorder-ui). Verify git + preview
> health. Priority 1 (Flight Recorder) shipped; P2 extraction + bilingual parity are now PROVEN on
> the deployed preview in a real browser (e2e/leo-device-failures, preview-typed-script,
> preview-parity — all green; docs/eval/PREVIEW_EVIDENCE_0125.md). Highest-value next: EITHER (A)
> RED-first fix the documented single-session contamination bug — write a failing test
> (parityScorecard-style, ONE session) where a pending He draft then a Spanish create must (i)
> supersede the stale draft so a confirm saves the READ-BACK person, and (ii) reply in Spanish with
> no Hebrew-name leak; find the first divergence in the calendar draft/confirm state machine
> (src/screens/AbuAI/calendarCreate.ts + cognitiveRuntime confirm path) and apply the smallest
> general root fix — OR (3) LATENCY PACK (sentence-by-sentence streamed TTS, lean per-turn context
> injection, greeting-time calendar prefetch) proven on preview with a latency table — OR (4)
> VOICE-READINESS PACK code-level (iOS getUserMedia echoCancellation/noiseSuppression/autoGainControl;
> per-user speech profile defaulting to NORMAL ChatGPT-like pace; cached warm openers behind a
> default-off flag) — OR (5) weekly parity-guard script wrapping parityScorecard + generativeMarathon
> smoke + flightRecorderImport into a dated report — OR (6) refresh docs/LEO_TYPED_TEST_SCRIPT.md to
> ~30 bilingual behavior checks. Standing law: benchmark is the latest ChatGPT at NORMAL human speech
> pace, never slowed by default. Keyed Claude cross-check stays out-of-band (no ANTHROPIC_API_KEY;
> never read .env values). If (A) or a code change: RED-first, smallest general root fix, bump version
> + keep src/version.ts ⇄ api/health.ts ⇄ src/version.test.ts in sync (no apostrophes in buildLabel),
> typecheck + full vitest + build, redeploy a fresh preview, re-run the e2e vs that preview; if a
> preview-evidence-only cycle, no version bump. commit + push rc5 (never production). Only
> deployed-preview-through-the-app evidence counts for product claims; label CODE vs PREVIEW honestly.

## Segment-6 update — Cycle 45 done (Flight Recorder UI) + Priority-2 PREVIEW evidence

**HEAD:** `feat …Cycle 45 (0.125.0-flight-recorder-ui)` — pushed `origin/rc5` (`ea6f363`).
**Fresh PREVIEW:** https://abu-bank-9vwvg4c29-leos-projects-d3c04c09.vercel.app — health
`0.125.0-flight-recorder-ui` (matches HEAD).

**Priority 1 tail — DONE.** Settings (About/diagnostics) now has a senior-first Flight
Recorder control: an OFF-SWITCH toggle (`flight-recorder-toggle`) + an EXPORT button
(`flight-recorder-export`) that downloads the redacted text-only transcript. Architecture:
pure export shape + serializers moved to a RUNTIME module (`src/evolution/recorderExport.ts`,
`exportStoredTranscript` reads the durable queue) so the bundle never pulls the eval harness;
`src/eval/flightRecorderImport.ts` re-exports them (one source). Off switch
(`src/evolution/recorderSwitch.ts`) persists in localStorage, read PER-TURN at the single
`observeTurn` seam → live, safer-only. RED-first (the switch test proved capture continued
when off before the guard). CODE: recorderSwitch 3/3, recorderExport 3/3, controls 3/3,
importer 3/3; full suite 11039 pass / 2 todo; typecheck + build.

**Priority 2 — PREVIEW evidence captured + limits documented** (`docs/eval/PREVIEW_EVIDENCE_0125.md`):
LLM proxy `abuai-chat` live with server key (`ok:true`, real OpenAI, ~4s); online seam wired +
HONEST (`NO TOOL RESULT = NO CLAIM` verified live, 4.8–6.8s < 8s). KEY LIMITS: (a) the keyed
Claude cross-check needs `ANTHROPIC_API_KEY` — absent from the app's provider set even
server-side → out-of-band; (b) P2 extraction + parity are CLIENT-SIDE cognition (the endpoint is
a bare proxy), so true PREVIEW proof needs a **browser E2E (Playwright) against the preview**,
not curl; (c) online search returned no results in preview (provider/config, not a code defect —
the decline is correct).

**Remaining:** (2-tail) browser E2E vs preview for P2/parity; (3) LATENCY PACK (streamed
sentence TTS, lean context injection, greeting prefetch, preview latency table); (4) VOICE-READINESS
PACK (iOS getUserMedia constraints, per-user speech profile defaulting to NORMAL pace, cached warm
openers behind default-off flag); (5) WEEKLY PARITY GUARD script + dated report; (6)
`docs/LEO_TYPED_TEST_SCRIPT.md` ~30 bilingual checks.

**Continuation prompt (paste to resume):**

> Resume the NEXT MANDATE on rc5 from HEAD (0.125.0-flight-recorder-ui; pushed; preview
> https://abu-bank-9vwvg4c29-leos-projects-d3c04c09.vercel.app health-verified). Verify git +
> preview health first. Priority 1 (Flight Recorder) is fully done incl. the Settings export
> button + off-switch toggle. Pick the next highest-value: EITHER (2-tail) write/point a Playwright
> E2E at the DEPLOYED preview URL to drive AbuAI's client-side cognition (rambling create → resolves
> the person, keeps place/date, no verbatim dump; a parity turn set) and record PREVIEW evidence +
> a real latency table — this is the ONLY way to prove P2/parity end-to-end since the endpoints are
> bare proxies — OR (3) LATENCY PACK (sentence-by-sentence streamed TTS + lean per-turn context
> injection + greeting-time calendar prefetch), RED-first, proven on preview, latency table
> (deterministic <1s, LLM <4s, online <8s) — OR (4) VOICE-READINESS PACK code-level (iOS
> getUserMedia echoCancellation/noiseSuppression/autoGainControl; per-user speech profile defaulting
> to NORMAL ChatGPT-like pace; cached warm openers behind a default-off flag) — OR (5) a weekly
> parity-guard script wrapping parityScorecard + generativeMarathon smoke + flightRecorderImport into
> a dated report — OR (6) refresh docs/LEO_TYPED_TEST_SCRIPT.md to ~30 bilingual behavior checks and
> run them against the preview. Standing law: the benchmark is the latest ChatGPT at NORMAL human
> speech pace — never slowed by default. Keyed Claude cross-check stays out-of-band (no
> ANTHROPIC_API_KEY; never read .env values — hard stop). Reuse existing engines/judges; RED-first;
> smallest general root fix; bump version + keep src/version.ts ⇄ api/health.ts ⇄ src/version.test.ts
> in sync (no apostrophes in buildLabel); typecheck + full vitest + build; commit + push rc5 (never
> production). Only deployed-preview-through-the-app evidence counts for product claims; label CODE
> vs PREVIEW honestly.

## Segment-5 update — Cycle 44 done (FLIGHT RECORDER importer) + fresh preview

**HEAD:** `feat …Cycle 44 (0.124.0-flight-recorder-import)` — pushed to `origin/rc5`
(commit `47ade71`). **Deployed PREVIEW:**
`https://abu-bank-lragg3t0i-leos-projects-d3c04c09.vercel.app` — `/api/health`
`buildVersion` = `0.124.0-flight-recorder-import` (matches HEAD), root `/` = HTTP 200.
**PREVIEW-class** evidence that the build deploys + serves with the correct version; the
importer itself is CODE (a test harness, not a runtime path).

**Priority 1 (FLIGHT RECORDER) — the flagship, delivered as an importer.** Discovery first:
the CAPTURE side already exists and was REUSED, not rebuilt — `observeTurn` (OBSERVE_ONLY) is
wired inside `ExecutiveCognitiveController` so BOTH typed and voice are captured on the one
runtime path; `buildEnvelope` redacts + minimizes (text-only, no audio, PII stripped, dedup);
durable IndexedDB is the local store; `VITE_EVOLUTION_KILL` / `EvolutionConfig.enabled` is the
off switch. The missing link, now built (`src/eval/flightRecorderImport.ts`):
- `envelopesToExport` — redacted envelopes → stable text-only JSON (`serializeExport` /
  `parseExport` round-trip, asserted no-audio).
- `importLeoRepro` — `LEO_DEVICE_FAILURES_REPRO.json` → replay sessions whose per-turn
  expectations come from STRUCTURED truth fields (`resolvedToGilad`, `hasLocation`,
  `dateTomorrow`, `verbatimDump`) NOT the stale recorded wording → truth is permanent,
  phrasing is free to improve.
- `replayExport` — runs every recorded turn back through the SAME app entry the
  marathon/scorecard use; asserts `expectContains`/`expectAbsent`/`expectSide`; returns the
  failing turns so a divergence names a real regression (proven to CATCH a false-expectation
  probe — no green-washing).

Leo's 3 real device transcripts now replay green as PERMANENT tests. RED-first (standing
suite written before the module). Evidence (CODE): flightRecorderImport 3/3, evolution +
recorded-replay 71/71; full suite 11030 pass / 2 todo; typecheck + build clean. Docs:
`docs/eval/FLIGHT_RECORDER.md`.

**Remaining mandate priorities (honest status, all still open):**
- (1) tail — user-facing **export button + off-switch toggle** wiring into a screen (the data
  layer `serializeExport` + config kill switch exist; only the UI control remains).
- (2) P2 end-to-end on preview + **keyed parity judge** — BLOCKED locally: no
  `ANTHROPIC_API_KEY` (cross-check needs it) and reading `.env` values is a hard stop. Must be
  run against the deployed preview (drive the app's own API) or with keys provided out-of-band.
- (3) LATENCY PACK (streamed sentence TTS, lean context injection, greeting prefetch, preview
  latency table) — not started.
- (4) VOICE-READINESS PACK (iOS getUserMedia constraints, per-user speech profile, cached warm
  openers behind a default-off flag) — not started.
- (5) WEEKLY PARITY GUARD (scheduled rerun of scorecard + marathon smoke → dated report) — not
  started; the parity + flight-recorder + marathon suites it would wrap all exist.
- (6) `docs/LEO_TYPED_TEST_SCRIPT.md` (~30 bilingual checks) — not refreshed this cycle; a
  fresh preview URL now exists to run it against.

**Continuation prompt (paste to resume):**

> Continue the NEXT MANDATE on rc5 from HEAD (0.124.0-flight-recorder-import; pushed;
> preview https://abu-bank-lragg3t0i-leos-projects-d3c04c09.vercel.app health-verified).
> Verify git + preview health first. Flight Recorder capture+redact+store+off-switch exist and
> the importer→standing-replay is built (src/eval/flightRecorderImport.*, Leo transcripts are
> permanent tests). Pick the next highest-value in-sandbox step: EITHER (1-tail) wire a
> senior-safe export button + off-switch TOGGLE into a diagnostics/settings surface calling
> serializeExport(envelopesToExport(...)) and EvolutionConfig — RED-first component test — OR
> (6) refresh docs/LEO_TYPED_TEST_SCRIPT.md to ~30 bilingual checks and RUN it against the
> deployed preview's app API to capture PREVIEW evidence + a latency table (deterministic <1s,
> LLM <4s, online <8s) — OR (3) LATENCY PACK (streamed sentence TTS + lean context injection +
> greeting prefetch) proven on preview. Priority (2) keyed parity + P2 end-to-end stays
> out-of-band until ANTHROPIC_API_KEY is provided or driven via the deployed app (never read
> .env values — hard stop). Reuse existing engines/judges; never a parallel path. RED-first,
> smallest general root fix; bump version + keep src/version.ts ⇄ api/health.ts ⇄
> src/version.test.ts in sync (no apostrophes in buildLabel); typecheck + full vitest + build;
> commit + push rc5 (never production). Only deployed-preview-through-the-app evidence counts
> for product claims; label CODE vs PREVIEW honestly.

**Branch:** `rc5/cognitive-architecture-and-acceptance`
**HEAD after this segment:** `docs(war-room): log Cycles 39-40` (on top of `feat …Cycle 40 (0.120.0)`)
**Version:** `0.120.0-marathon-ordinal` (src/version.ts ⇄ api/health.ts ⇄ src/version.test.ts in sync)

## What shipped this segment (all gates green each cycle)

Priority (1) — WIDEN the generative marathon — substantially advanced.
`src/screens/AbuAI/generativeMarathon.test.ts` now runs **1200 sessions × 10 scenario
classes** through the REAL app entry (index.tsx-faithful preprocessing +
ExecutiveCognitiveController, mocked llm/online), CLEAN.

Scenario classes: familyWho · calendar CRUD · memory store/recall/forget · date
arithmetic · **relation-phrase create** · **"the last one" cancel chain** · **mid-flow
person correction** · **Spanish (Rioplatense) calendar** · **cross-language cancel** ·
**"the first one" cancel chain**.

Real general mechanisms fixed (each = a class the wide batch exposed):
1. **ES referable delete** — "cancelalo/borrá/eliminala" on a SAVED event dead-ended to
   the LLM (Hebrew-only gate). Added `REFERENTIAL_DELETE_ES_RE` (calendarMutationReasoner.ts).
2. **Focus-property precision** — "איפה אני פוגשת אותו?" read the OLDEST same-person event;
   now the most-recently-created match (cognitiveRuntime.ts `answerCalendarProperty`).
3. **Person-name truncation** — extractPerson's bare `ב/ל/על` prefix-stop truncated any
   name starting with ל/ב (לאו, לאה, לירון) and the genitive target after "של". Split
   hard-stops from the prefix-stop; exempt first person word + post-"של" (eventExtractor.ts).
4. **Ordinal delete** — "תבטלי את הפגישה הראשונה" deleted the FOCUSED/last event; added
   `ORDINAL_FIRST_RE` → chronologically-earliest (calendarMutationReasoner.ts). "last/האחרונה"
   left on its working focus path (no regression).

Cross-language cancel (He↔Es) was already CLEAN — the referable gate is language-agnostic
once a calendar focus is set. Two of the original 910 breaks were marathon oracle bugs
(store-accumulation), now store-aware.

Evidence (CODE at app-entry level): generativeMarathon 1200/1200 clean; full suite
**11017 pass / 2 todo**; typecheck + build clean. Voice/Realtime untouched.

## Next highest-ROI: Priority (2) PARITY JUDGE — design constraints discovered

The mandate wants a judge that, for sampled turns, gets a **ChatGPT-class reference reply**
(same context + warm-elderly-companion He/Es persona) and has a **judge model** score
AbuAI's actual app-path reply vs the reference on: correctness, warmth, brevity,
answered-what-was-asked, language discipline, naturalness — persisted as a standing suite
+ scorecard.

**Blocking decision (needs a human choice on model access):** this test environment mocks
the LLM and has **no live ChatGPT-class tool**, so a *live-model* reference/judge cannot run
deterministically in `vitest`. Options:
- (a) **Live seam, run out-of-band**: build the harness with a pluggable `reference(turn)` +
  `judge(app, ref)` interface; wire a real provider (needs a key + provider decision:
  OpenAI vs Anthropic Claude as the reference) and run it as a PREVIEW/PRODUCTION-class
  job, NOT in the unit suite. Highest fidelity to "identical to ChatGPT."
- (b) **Deterministic half now**: REUSE the existing deterministic judges — do NOT rebuild:
  - `src/eval/conversationQualityJudge.ts` `judgeTurn()` (0–5: forced-menu, childish,
    robotic, markdown, doubled-word, live-fact-without-tool, empty).
  - `src/eval/judgeRunner.ts` (0–100 emotional/naturalness; banned-phrase + fabricated-life).
  Compose these + NEW per-dimension checks (brevity budget per intent, language-discipline
  = reply lang matches turn lang, answered-what-asked = intent-appropriate oracle content,
  correctness = family/date engine oracles) into a **parity scorecard** over a curated turn
  set. Honest label: *deterministic quality parity*, NOT live-model parity.

**Recommended:** ship (b) as the runnable standing suite (reuses existing judges, grounds on
real turns), and structure it with the (a) seam documented so a keyed live run drops in later.
Ground the turn set in REAL flows — see `src/eval/*iphone*`, `deviceFailuresTriage.test.ts`,
`leoRetestAcceptance.test.ts`, `realDeviceTranscriptRegression.test.ts` — plus a marathon
turn sample. Avoid creating a parallel judge; extend the existing eval judges.

Priorities (3) P2 LLM semantic calendar extraction and (4) BEHAVIOR_SPEC also depend on
live-LLM/preview proof — same model-access decision gates their end-to-end evidence.

## Segment-4 update — Cycle 43 done (grow parity set w/ real Leo flows + rambling dedup fix)

HEAD now `feat …Cycle 43 (0.123.0-parity-rambling-dedup)`. Took the "grow the parity turn
set with real device-failure flows" branch of the continuation. **Diagnosis-first:** ran 5
grounded Leo flows (`docs/eval/LEO_DEVICE_FAILURES_REPRO.json` + `deviceFailuresTriage.test.ts`)
through the SAME parity harness before touching anything. Four were clean
(midnight+person+place extraction, He/Es relation-BETWEEN, relation-FOR); **one red** — the P2
`create-rambling-story` confirm restated the subject TWICE (`בנושא טיול המשפחתי` +
redundant `(לדבר על הטיול המשפחתי)`), blowing brevity.

- **General fix** (`shapeCreateConfirm`, `responseShaper.ts`): a subject/notes redundancy
  guard — `coreWords` (strip definite article + purpose/function words) + `saysTheSame`
  (content-word containment) — drops the notes parenthetical when it merely restates the
  already-shown subject; a genuinely distinct note is kept (guarded against over-suppression).
- **Regression test FIRST** (`responseShaper.test.ts`, red→green, exact device string) +
  a no-over-suppression companion test.
- Promoted all 5 flows into the standing scorecard: **6/6 dimensions @100% over 22 scored
  turns** (was 17), 1 correctly LLM-routed. Calendar brevity budget aligned to the product
  rule (root CLAUDE.md: "voice responses 2-4 sentences max"; the 220-char cap stays as the
  anti-ramble guard) — correcting an over-strict oracle, not hiding a bug.

Evidence (CODE): responseShaper 61/61; parityScorecard 22/22 @100%; full suite
**11027 pass / 2 todo**; typecheck + build clean. Voice/Realtime untouched. Live cross-check
seam still unkeyed (out-of-band). Builds on 0.122.0.

**Continuation prompt (paste to resume):**

> Continue the MASTER MANDATE on rc5 from HEAD (0.123.0-parity-rambling-dedup). Verify git
> state first. The deterministic parity scorecard is now 6/6 @100% over 22 turns incl. 5 real
> Leo device flows; the rambling-story subject-duplication is fixed generally in
> shapeCreateConfirm. Pick the next highest-ROI in-sandbox step: EITHER keep mining real Leo
> flows (src/eval/deviceFailuresTriage, leoRetestAcceptance, realDeviceTranscriptRegression,
> LEO_DEVICE_FAILURES_REPRO.json) into the parity set — each new red dimension names a real
> gap to fix with a GENERAL mechanism, regression test FIRST — OR build (3) P2 LLM semantic
> calendar extraction for the rambling-story class behind the EXISTING controller (reuse
> engines, no parallel path), with the live-LLM end-to-end proof deferred to a keyed
> preview run. Reuse existing judges/engines; never build a parallel judge. Increment version
> + keep src/version.ts ⇄ api/health.ts ⇄ src/version.test.ts in sync (no apostrophes in
> buildLabel — the health drift regex breaks on them); run typecheck + full vitest + build;
> commit. Label CODE vs live-model honestly; the live cross-check seam + P2 end-to-end remain
> out-of-band until provider keys / a deployed preview exist. Do not claim preview/device
> without proof.

## Segment-3 update — Cycle 42 done (live cross-check parity judge)

HEAD now `feat …Cycle 42 (0.122.0-parity-live-crosscheck)`. Implemented the pluggable LIVE
reference/judge seam as a **cross-check panel** (user choice): reference from BOTH
`claude-opus-4-8` and an OpenAI GPT model under one persona brief; judge panel with **AND
across judges** then **OR across references**. `src/eval/parityLiveJudge.ts` (raw fetch — no
package.json change; Anthropic per the claude-api contract) + `makeCrossCheckReference` /
`makeCrossCheckSeamJudge` fit the `ParityOptions` seam exactly, so a keyed run is
`runParityScorecard(sessions, { reference, judge })`. The **KEYED run is OUT-OF-BAND** (needs
`ANTHROPIC_API_KEY` + `OPENAI_API_KEY`; PREVIEW/PRODUCTION evidence); wiring + aggregation are
proven with mocked fetch — `parityLiveJudge.test.ts` 7/7 (CODE). Runner snippet is in
`docs/eval/PARITY_SCORECARD.md` → *Live cross-check judge*.

**Open for the next segment:** (a) execute the KEYED live cross-check once keys are provided
and record the PREVIEW-class scorecard; (b) Priority (3) P2 LLM semantic calendar extraction
for the rambling-story class, proven on the deployed preview; (c) Priority (4)
`docs/BEHAVIOR_SPEC.md` informed by the parity results. All three need an external resource
(provider keys or the deployed preview) the sandbox lacks.

## Segment-2 update — Cycle 41 done (parity scorecard shipped)

HEAD now `docs(parity): correct model-dependent finding` on top of
`feat …Cycle 41 (0.121.0-parity-scorecard)`. Delivered the **deterministic half of the
parity judge** (option b above):
- `src/eval/parityScorecard.ts` + `parityScorecard.test.ts` — a standing suite scoring the
  ACTUAL app-path reply on all 6 dimensions over a curated He+Es turn set, REUSING
  `judgeTurn` + `judgeResponse` (no parallel judge), with a pluggable live `reference`/`judge`
  seam. `docs/eval/PARITY_SCORECARD.md` holds the scorecard (currently **6/6 dimensions at
  100%, 17 scored turns, 1 model-dependent**).
- It caught a REAL bug on first run: a Rioplatense "cancelalo" deleted correctly but
  confirmed in HEBREW → fixed `deleteReasoner` to confirm in Spanish via `personName`.
- Verified (evidence over assumption): ES memory store+recall have Spanish parity; the one
  model-dependent turn ("¿quién es Gabi?") is correctly LLM-routed because Gabi is not a
  known family member (`findNode` → null) — no fabrication.

Remaining for Priority (2): the **LIVE** ChatGPT-class reference+judge (the seam) — still
gated on the model-access decision below. Priorities (3) P2 LLM semantic calendar extraction
and (4) BEHAVIOR_SPEC are next and also want live-LLM/preview proof.

## Continuation prompt (paste to resume)

> Continue the MASTER MANDATE on rc5 from HEAD (0.121.0-parity-scorecard). Verify git state
> first. The deterministic parity scorecard is shipped (src/eval/parityScorecard.*,
> docs/eval/PARITY_SCORECARD.md, 6/6 @ 100%). Next, EITHER (2b) grow the parity turn set with
> more REAL Leo flows mined from src/eval/*iphone*, deviceFailuresTriage, leoRetestAcceptance,
> realDeviceTranscriptRegression — each new turn that reds a dimension names a real gap to fix
> via a general mechanism — OR (2a) wire the LIVE reference/judge seam (needs a provider +
> key decision: OpenAI vs Claude as the ChatGPT-class reference; run out-of-band, NOT in the
> unit suite) OR (3) build P2 LLM semantic calendar extraction for the rambling-story class,
> proven on the deployed preview. Reuse existing judges/engines; never build a parallel judge.
> Increment version + keep src/version.ts ⇄ api/health.ts ⇄ src/version.test.ts in sync (avoid
> apostrophes in the buildLabel — the health drift regex breaks on them); run typecheck + full
> vitest + build; commit. Evidence discipline: verify, never assume; label CODE vs live-model.

## Superseded continuation prompt (segment-1, kept for history)

> Continue the MASTER MANDATE on rc5 from HEAD (0.120.0-marathon-ordinal). Verify git state
> first. Build Priority (2) the PARITY JUDGE, option (b) first: a deterministic parity
> scorecard that REUSES `conversationQualityJudge.judgeTurn` and `judgeRunner` (do NOT build a
> parallel judge). Curate a turn set from the REAL device-failure evals (`src/eval/*iphone*`,
> `deviceFailuresTriage`, `leoRetestAcceptance`, `realDeviceTranscriptRegression`) + a
> sample of generativeMarathon turns; run each through the SAME app entry the marathon uses;
> score each on the 6 mandate dimensions (correctness via family/date oracles, warmth,
> brevity per-intent, answered-what-asked, language discipline = reply-lang matches turn-lang,
> naturalness). Assert per-dimension pass-rate floors as a standing suite and write a scorecard
> to docs/eval/PARITY_SCORECARD.md. Structure a pluggable `reference()`/`judge()` seam for a
> future LIVE ChatGPT-class run (do NOT fake it; label the deterministic run honestly).
> Increment version + keep src/version.ts ⇄ api/health.ts ⇄ src/version.test.ts in sync; run
> typecheck + full vitest + build; commit. Then propose the live-reference provider decision.

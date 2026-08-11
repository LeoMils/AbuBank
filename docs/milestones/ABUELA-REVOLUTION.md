# THE ABU-ELA REVOLUTION — durable spec + running log

**This file is the resume point.** If context is cleared, read this top-to-bottom
and continue from the first unchecked box. One commit per milestone, pushed to the
RC branch. Never merge main. Never deploy production.

## Operating protocol
1. This spec is committed first and updated as work proceeds.
2. Never stop to ask which part is next. Ambiguous → safest option, log it, continue.
3. One commit per milestone, pushed.
4. Evidence discipline: `CODE < TEST < PREVIEW < DEVICE`. Never claim green on
   weaker evidence than the claim needs.
5. Use specialist agents where they genuinely help; record which and what they gave.
6. Every milestone ends green: typecheck · full suite · build · validators · gate.

## Evidence legend
`CODE` wiring exists · `TEST` automated assertion ran · `PREVIEW` real provider/
deploy · `DEVICE` proven on Leo's iPhone · `HUMAN` needs a human eye.

---

## Checklist

### M1 — Online provider bake-off  (do first; everything online depends on it)
- [x] Provider abstraction (`src/services/online/`: providerTypes, adapters, registry) — key server-side
- [x] 36-question Hebrew(+Spanish) corpus (`corpus.ts`): news/sports/weather/cinema/prices/hours/live
- [x] Scoring harness (`scripts/online-bakeoff.ts`): citation rate · answer rate · latency (avg/p95) · by-category
- [x] Adapters: OpenAI (incumbent, VERIFIED), Tavily, Brave, Perplexity Sonar (CODE — key-gated, unit-tested via mocks)
- [x] Ran incumbent FOR REAL; others recorded BLOCKED (no key) — never faked
- [x] Matrix written (`docs/eval/ONLINE_BAKEOFF.json`) — see decision D2
- [x] Key request reported (below) — Leo must obtain 3 keys to finish the tournament
- [ ] BLOCKED-on-keys: run Tavily/Brave/Perplexity, choose winner (likely a composition), wire behind the endpoint

### M2 — Full online, inside the conversation
- [ ] Abu answers current things invisibly; states source in speech, never a URL
- [ ] Follow-ups from the SAME retrieved results; personal/family/calendar never hit the web
- [ ] Failed retrieval = warm honest "couldn't check"; never stale-as-fresh
- [ ] Abu News: real stories, Israel-first, dynamic count, source+time, plain Hebrew; read aloud + discuss
- [ ] Harness scenarios for each, run for real against the chosen provider

### M3 — One people store, real Hebrew kinship  ── DONE (core) ──
- [x] ONE canonical model (src/services/people/peopleModel) reads the single source (family_data.json);
      direct edges only (parents/children/spouses/formerSpouses/partners/cohabits)
- [~] Collapse 4 stores: the canonical MODEL + people_lookup are the one path; PHYSICAL retirement of
      family_graph.json / abu-family.md (generate them FROM the one source) + contacts merge = STAGED (D4)
- [x] Derive kinship at query time (kinship.ts) — every required Hebrew term, gendered, never stored
- [x] Named failures pass (tests): Leo=דוד of Mor's children · Gilad=גיס of Eili · Yarden=כלה of Rafi
- [x] ONE `people_lookup` tool wired into LiveTools (who/relationship/relatives/contact); numbers at UI only
- [~] Retire `resolve_contact`: people_lookup supersedes it and is wired; physical removal = STAGED (D4)
- [x] Family DATA physically REMOVED from the live prompt (D4 done): "# What Abu Knows — Family" + the
      abu-family.md embed are gone; a "# Family and People" routing instruction sends the model to
      people_lookup. resolve_contact references in the instructions replaced by people_lookup. Size
      12978 → 9962 chars (−23%; pure-removal floor 9587 + the routing paragraph). abu-family.md remains
      legacy prose only; generating it from the one source is still staged.
- [x] Invariant tests (all 8: unknown-stays-unknown, alias→one person, spellings verbatim, death keeps
      genealogy, former_spouse/partner distinct + partner≠parent, temporal dated, gender-only-where-known, add-by-data)
- [x] Gate validator (scripts/validate-people.ts) — errors in plain Hebrew, in prebuild; broken file never builds
- [x] Kinship "harness": 28 deterministic queries (kinship.test + peopleLookup.test) incl. every derived type
      + "הבת שלי"→Mor in one turn + "הנכד שלי"→ambiguous. (Deterministic > LLM for kinship correctness.)

### M4 — Brand + design revolution  ── FOUNDATION done; rollout next ──
- [x] 2–3 hub directions proposed in words; Leo chose **B "Night Garden"** (+ light "Bright Day" flip)
- [x] THEMEABLE tokens (condition 1): src/design/theme.css + theme.ts — dark⇄light by one attribute, no rebuild
- [x] Per-app logo FAMILY as SVG components (src/design/logos/AbuLogo): 7 emblems, one system, distinct glyph+accent
- [x] Applied to the HUB (logos + theme tokens + Night-Garden page bg)
- [x] Senior-first VERIFICATION gate (both themes): WCAG AA contrast + 56px/16px, system-wide via tokens/components
- [x] Rollout wave 1: ScreenHeader carries the per-app logo; Abu News + Abu Bank fully in the Night Garden system
- [ ] Rollout wave 2 (STAGED, careful per-screen): Weather (already starfield) / Games / Calendar / WhatsApp + Abu AI

### M5 — Abu's presence (Abu AI screen)
- [x] 2–3 character directions proposed; Leo chose **3 "Silhouette & light"**
- [x] STILL FRAME delivered for approval BEFORE animating (condition 2): docs/design/abu-bust-still.svg + .png
- [ ] AWAITING Leo's judgement on the still (warm + dignified in one look?) before any animation
- [ ] Mouth from real output-audio amplitude (AnalyserNode); states; idle life; graceful degrade
- [ ] Screen around her (cards, transcript, trace) in the new system; measure + report frame cost

### M6 — Device test script
- [x] docs/DEVICE-TEST.md written for the RC build: 10 numbered items, riskiest-first, say/expect/trace, non-programmer

---

## Decisions log
- **D9 (M5 character, Leo's call):** SHIP variant A ("Warm Gold", docs/design/abu-bust-A.svg) as-is and
  ANIMATE it now. "Warm and not uncanny" is the bar; a commissioned illustration is a later upgrade,
  not a blocker. Keep CHARACTER-ASSET-SPEC.md and structure the animation so the asset swaps in later
  WITHOUT touching animation code (the character SVG lives in ONE component with named layer groups;
  replacing that file's SVG — same group ids — is the whole swap).
- **D8 (M4 rollout, safest):** Verified senior-first minimums SYSTEM-WIDE (WCAG AA contrast in both
  themes + 56/16 sizes) via the tokens + shared components every screen uses — a per-screen guarantee
  without rushing 7 bespoke re-themes. Applied the full system to hub + News + Bank. STAGED the careful
  re-theme of Weather/Games/Calendar/WhatsApp + the Abu AI rebuild (Weather already carries the Night
  Garden starfield; blind bg swaps would regress bespoke layouts — the brief says fix-don't-note, which
  means doing them properly). M6 device-test doc shipped. M2 prep: M1 registry makes the winner-swap a
  small change, gated on a keyed winner.
- **D7 (M5 character, honest ceiling):** Two refinement passes (variants A "Warm Gold", B "Starlight
  Depth") warmed + softened the bust but hand-authored SVG has hit its ceiling — it reads as refined
  vector, not painterly; more shading makes the face muddy. Stopped animation (Leo's condition). Wrote
  docs/design/CHARACTER-ASSET-SPEC.md — the exact commissioned-illustration spec (layered SVG, named
  groups for eyes/eyelids/mouth-visemes/brows/hair, registration, format) so the ordered asset is
  directly animatable. Awaiting Leo: pick a variant to ship interim, or commission per the spec.
- **D6 (M4/M5, Leo's choices + conditions):** Hub = Night Garden (B); character = Silhouette & light (3).
  Condition 1 met — palette is CSS-variable tokens, dark⇄light by one attribute, no rebuild (Bright Day
  wired). Condition 2 honoured — the character STILL is delivered for approval BEFORE animating. Applied the
  system to the HUB only this pass; per the brief I REPORT before rolling logos+theme across the other 6
  screens. Character animation is BLOCKED on Leo approving the still.
- **D5 (D4 pass):** Physically removed family from the live prompt (12978 to 9962 chars). Fixed a
  version-label sync bug shipped in 0.196.0: an apostrophe in the build label truncated the health.ts
  BUILD_LABEL extraction regex in version.test — labels must stay apostrophe-free (the bump tooling now
  guards it). The people_lookup LIVE tool remains; physically deleting the resolve_contact executor + its
  tests is still staged (its own commit).
- **D0 (protocol):** Wrote this spec as the first commit; it is the resume point.
- **D1 (M1, safest):** Built the bake-off as a self-contained framework; did NOT refactor
  the shipped endpoint internals this milestone (would risk 30+ passing online tests for a
  swap that cannot be validated without a keyed winner). `registry.selectProvider(env)` is
  ready; the endpoint swaps via `ONLINE_PROVIDER` once a winner is chosen + proven.
- **D2 (M1, from real numbers):** Incumbent OpenAI web_search is INADEQUATE alone for a voice
  product — citation 58%, and worst exactly where it matters: sports 33% / weather 33% /
  cinema 33% (best: hours 100%, prices 75%), avg 4.5s / p95 8.2s (too slow for voice).
  Cannot pick a winner without the other providers' keys. Recommended target = a COMPOSITION
  (fast search API for grounding + a dedicated weather API + a sports source), to be decided
  from real numbers once keyed. Tournament framework is ready to run them.
- **Agents:** M1 is an empirical/measurement + architecture task — done directly, no subagent
  (a design/review agent adds nothing to a latency/citation measurement). Agents are planned
  for M4 (design directions) and M5 (character) where they genuinely help.
- **D3 (M3, safest):** Built the canonical parent graph from the EXISTING data (children arrays +
  spouse/former-spouse as co-parents, EXCLUDING partners — matches the brief's "partner implies
  nothing about parenthood") + a group rule for the matriarch. No family_data.json edits ⇒ zero
  generator/memory churn, zero regression to the 12k-test suite.
- **D4 (M3, staged):** Delivered the correctness CORE (model + kinship + people_lookup + Hebrew
  validator + 59 tests) green. Deferred the PHYSICAL store merge (generate family_graph.json /
  abu-family.md from the one source), the full prompt-removal of family, and the physical deletion
  of resolve_contact — each touches the embedded-family / familyReconciliation / resolve_contact
  tests and is a migration best done as its own reviewed commit. people_lookup already supersedes
  resolve_contact functionally; the char-count delta (−26%) is measured and reported.

## Status / evidence per milestone
- **M1 … DONE (framework + incumbent baseline). Evidence: TEST (framework, 13 tests) +
  PREVIEW (real incumbent run, 36 queries: 58% citation / 4.5s avg). Winner selection
  BLOCKED on Leo's keys.**
- M2 … not started (depends on M1 winner; can proceed on the incumbent meanwhile)
- **M3 … DONE (core). Evidence: TEST (59 tests — kinship engine, people_lookup, live-tool wiring,
  8 invariants, 3 named failures) + gate validator (Hebrew) in prebuild. Physical store merge +
  prompt removal STAGED (D4). On-device kinship speech = PHYSICAL_DEVICE (not claimed).**
- M4 … not started
- M5 … not started
- M6 … not started

## Keys Leo must obtain (running list)
To finish the M1 tournament and unlock a better online experience, obtain and place these
in `.env.local` (server-side; never the client bundle), then re-run `npx tsx scripts/online-bakeoff.ts`:
- **`TAVILY_API_KEY`** — Tavily Search API (search + synthesized answer + sources). tavily.com
- **`BRAVE_API_KEY`** — Brave Search API (note: perpetual free tier retired Feb 2026 — check current plan). brave.com/search/api
- **`PERPLEXITY_API_KEY`** — Perplexity Sonar (answer + citations). docs.perplexity.ai
(Weather may be better served by a dedicated API, e.g. the Israel Meteorological Service or
OpenWeather — flagged after the search tournament runs.)

## Resume pointer — DO THESE IN ORDER (fresh session starts here)

Ledger so far (all pushed to RC): 7d7be99 spec · 9fd23d3 M1 · 70f157b M3 · 11d3837 D4 ·
a904200 M4-foundation · 51774b7 character-refine · f0b2f6f rollout-w1+M6 · (this) resume-spec.
Every commit ends green: `npm run typecheck` · `npx vitest run` · `npm run build` · validators.
Bump src/version.ts + api/health.ts + src/version.test.ts together; LABEL must have NO apostrophe
(health BUILD_LABEL regex truncates on it — see D5). Use the escape-aware bump pattern in prior commits.

### STEP 1 — Animate character A  (D9)
Architecture so the commissioned asset swaps in later without touching animation code:
- `src/screens/AbuAI/presence/AbuCharacterA.tsx` — variant A (docs/design/abu-bust-A.svg) as an SVG
  React component, split into NAMED `<g>` layers per CHARACTER-ASSET-SPEC.md: hair-back, base,
  cheeks, brows, eyes (eyeballs+irises+catchlights), eyelids (a shape that can lower to fully cover
  the eyes = blink), mouth (THREE registered shapes: closed/mid/open on one origin), hair-front,
  rim-light. A future asset = replace this file's SVG keeping the same group ids.
- `src/services/useOutputAmplitude.ts` — hook: given a MediaStream, AudioContext→AnalyserNode→
  getByteTimeDomainData in ONE requestAnimationFrame loop → RMS amplitude 0..1 (smoothed). Cleanup on
  unmount. Returns `undefined` when no AudioContext/stream (graceful degrade). Unit-test with a fake
  analyser (inject the AnalyserNode/ctx) — do NOT require a real device.
- `src/screens/AbuAI/presence/AbuPresence.tsx` — props { state:'listening'|'thinking'|'speaking'|
  'waiting', amplitude?:number }. Mouth = cross-fade closed→mid→open by amplitude; if amplitude is
  undefined AND state==='speaking', a gentle mouth loop (degrade). Blink = setInterval 3–6s lowering
  eyelids ~120ms. Breathe = CSS keyframe scale 1→1.02 on `base`. Aura/ring colour by state (listening
  teal, thinking amber shimmer, speaking gold ripple, waiting calm). Use theme tokens; NO hardcoded bg.
- FRAME COST: one rAF (amplitude) + CSS-composited blink/breathe (GPU). Report the design budget;
  real fps is DEVICE-measured — do not claim it. Add a test: AbuPresence renders each state + a given
  amplitude opens the mouth (renderToString, assert the open-mouth group is shown).

### STEP 2 — Rebuild the Abu AI screen in Night Garden
- The screen is `src/screens/Live/LiveScreen.tsx` (opened via window.__abubankOpenLive → App setLiveOpen).
- liveSession (src/services/liveSession.ts) holds `this.remoteStream` (the realtime audio) and calls
  cb.onState('listening'|'speaking'|…). EXPOSE the remote stream to the UI: add a callback e.g.
  `onRemoteStream?(stream)` set in LiveSession.attachPlayback (where remoteStream is assigned), and a
  state→presence-state mapping. Feed the stream to useOutputAmplitude → AbuPresence.amplitude, and
  onState → AbuPresence.state (thinking = between user-stop and first audio; waiting = wait_for_user).
- Rebuild the layout in the system: PAGE_BG, theme tokens, ScreenHeader-style back, AbuPresence centre,
  the action cards (existing ActiveActionCard / CommunicationActionCard), the transcript, the trace
  button (session.exportTrace). All ≥56px targets, ≥16px body, both themes (seniorFirst gate covers
  tokens/components). Keep the live cutover (liveEntryPoint.test) + the recorder intact.

### STEP 3 — Re-theme Weather, Games, Calendar, WhatsApp — ONE AT A TIME, each verified
- Per screen: root bg → PAGE_BG; header → ScreenHeader with its `app` logo (weather/games/calendar/
  whatsapp); text/surfaces → theme tokens (t.*); buttons ≥56px. AbuWeather ALREADY has the Night
  Garden starfield — migrate its colours to tokens without flattening the starfield. Run THAT screen's
  tests after each; fix failures in the same pass (do not blind-swap). Commit per screen.

### Then M2 (still blocked on keys)
- Keys needed: TAVILY_API_KEY, BRAVE_API_KEY, PERPLEXITY_API_KEY in .env.local (server-side).
- Wiring the winner = refactor api/abuai-online.ts to call selectProvider(env).search() (registry is
  built: src/services/online/registry.ts) and map to the existing {ok,answer,sources}|failure shape,
  keeping the honesty gate. Do it WITH a keyed winner so it can be validated; re-run scripts/online-bakeoff.ts.

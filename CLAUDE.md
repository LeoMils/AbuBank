# AbuBank — Project Rules

## Who This Is For
Martita, 80+, non-technical, living in Kfar Saba. Speaks Hebrew (with characteristic patterns) and Rioplatense Spanish. Family is everything. The app is her portal to services, family, and daily help.

## Product Principles
- Readability beats aesthetics.
- Premium but calm. Never flashy, never cold.
- No scroll on primary screens. If it doesn't fit, redesign — don't add scroll.
- Same-tab navigation for service destinations.
- Hebrew UI throughout. "Martita" always in Latin script.
- Every change must increment and display the version number.

## Senior-First UX
- Touch targets ≥ 48px. Text ≥ 16px. High contrast on dark background.
- One-tap access to core actions. No complex gestures.
- Clear state feedback — Martita must always know what the app is doing.
- Error messages in plain Hebrew, never technical.
- When in doubt, simplify.

## Communication & Tone
- Speak like a warm, smart person who knows her — not like an app trying to help.
- Never patronizing ("!יופי של שאלה"), never childish, never robotic.
- Voice responses: 2-4 sentences max. Direct answer first, detail on request.
- Feminine Hebrew address (את, לחצי, תגידי).
- Spanish = Rioplatense (vos, dale, llevar).

## Knowledge System — LOAD FIRST
Before ANY implementation or evaluation task, read `knowledge/KNOWLEDGE.md` (the
single-source manifest) and the relevant authority file. Each domain has ONE
authority — never duplicate facts elsewhere; point to the authority instead:
- Family → `knowledge/family_data.json` (machine source; per-person views in
  `knowledge/family/people/*.yaml` are GENERATED) — change via skill `add-family-member`.
- Product → `knowledge/product.yaml` · Behavior/tone → `knowledge/behavior.yaml` ·
  Production rules → `knowledge/production_rules.yaml` · AbuAI identity →
  `knowledge/abuai_identity.yaml` — change via skill `update-knowledge`.
- Personality → `knowledge/martita_personality.yaml`.
Validate with `npm run validate:knowledge` (auto-runs in `prebuild` with
`generate:knowledge` + `validate:family`). Never hand-edit generated files
(`memory/*`, `knowledge/family/people/*`).

## Working Rules for Claude Code
- Diagnosis before implementation for visual changes.
- Do not overclaim verification.
- Use the minimal process that produces the highest-quality result.
- Family data source of truth: `knowledge/family_data.json` — all runtime code reads from here.
- Consult `/memory/` files for Martita personality, tone, and patterns — but NOT for family relationships.
- Birthdays and family dates live in `knowledge/family_data.json` — never scatter ad hoc.
- Before modifying Martita's voice or tone, consult `memory/whatsapp_patterns.yaml` and `memory/message_examples.md`.
- **memory/ family files are AUTO-GENERATED.** Never edit them directly. Edit `knowledge/family_data.json` then run `npm run generate:memory`.

## Key Data Files
- `knowledge/family_data.json` — **SOURCE OF TRUTH** for family relationships, read by runtime
- `knowledge/martita_personality.yaml` — **SOURCE OF TRUTH** for personality, communication style, daily life
- `knowledge/family_context.md` — human-readable family description (derived from JSON)
- `knowledge/family_verification.md` — Hebrew Unicode verification table
- `memory/martita_profile.yaml` — **100% GENERATED** from family_data.json + martita_personality.yaml
- `memory/family_graph.yaml` — **100% GENERATED** from family_data.json
- `memory/aliases_and_names.yaml` — **100% GENERATED** from family_data.json
- `memory/birthdays_registry.yaml` — birthdays + memorial dates + reminder policy
- `memory/whatsapp_patterns.yaml` — real writing patterns for message generation
- `memory/message_examples.md` — curated style-teaching examples

## AI Workbench

When a Workbench-generated `claude-prompt.md` is the source of the task, obey it as the controlling spec. Beyond that:

- Obey the selected pack's allowed and forbidden paths.
- Make minimal scoped changes. No unrelated refactors.
- Preserve existing working behavior. Do not redesign unless explicitly requested.
- No dead code. Every new function/module must have a real reachable call site (reachable from a user flow OR covered by test execution), or an explicit test-only reason.
- Validate before reporting: run `npm run typecheck`, `npm test`, `npm run build` (and `npm run lint` if it exists) and treat any failure as not pass; treat any skipped command as not pass.
- Hebrew/RTL and 80+ usability are mandatory for AbuBank.
- NO TOOL RESULT = NO CLAIM. AbuAI must not say it checked the calendar / searched the web / used a tool unless that tool actually returned data.
- Never report an eval as PASS unless an actual automated assertion ran. Static-source greps are MEDIUM at best; running the deterministic function or component is HIGH.
- Never claim `fixed`, `working`, `resolved`, `improved`, `enhanced`, `better`, `optimized`, `successful`, `approved`, `completed`, or `solved` without evidence. The Workbench truth scanner treats those words in result/status sections without proof as a `TRUTH_VIOLATION` and flips the run to `FAILED`.
- Allowed wording when status is not `PROVEN`: `attempted`, `modified`, `changed`, `generated`, `proposed`, `hypothesis`, `requires evidence`, `requires manual review`, `not proven`.
- Unknowns must be reported, not guessed.
- Unrelated changes must be flagged as regression / drift risk.
- If no `core_functionality` / `main_user_flow` / `critical_bug_fix` is PROVEN with HIGH confidence, report `NO_CORE_PROOF`.
- If `package.json` / `package-lock.json` / `.env*` / `memory/*` / a forbidden screen is touched, mark `HUMAN_APPROVAL_REQUIRED` and stop.
- The Workbench does not auto-execute, auto-commit, auto-push, or auto-merge. It prepares evidence-based prompts and reports.

## Engineering OS — Always-On Truths (Foundation Release 1)
These are non-negotiable and always loaded. Domain specifics live in path-scoped
`.claude/rules/*.md`; the Engineering OS process lives in `.claude/CLAUDE.md`.
- **What this is:** AbuBank is Martita's PWA portal; AbuAI is the warm-companion
  conversation core. Current objective: pass **physical-device** production
  acceptance, tracked in `docs/engineering-os/PRODUCTION_ACCEPTANCE_BOARD.md`.
- **Evidence classes (never claim a stronger one than proven):**
  `CODE < MOCK < BROWSER < PREVIEW < PHYSICAL_DEVICE < PRODUCTION`.
  Real user / device evidence OVERRIDES any number of passing mocks.
- **Mechanism-first debugging.** Find the *first divergence* (the earliest point
  where actual ≠ expected) before proposing a fix. No fix without a mechanism.
- **One runtime path per capability.** If two engines/routers can answer the same
  turn, that is a defect to surface — do not add a third. Never silently fork behavior.
- **A passing test that encodes the bug is a liability.** When real evidence
  contradicts a green test, the test is suspect — fix the truth, never weaken a test to pass.
- **Current-info queries require verified online retrieval.** No answer to a
  "current/latest/today" question from model memory — it must come from a real
  tool result, or say it cannot check. (`NO TOOL RESULT = NO CLAIM`.)
- **Calendar writes must be immediately readable and modifiable** in the same
  session — a write that cannot be read back is a failure (see `.claude/rules/calendar.md`).
- **Residence is not live location.** Kfar Saba is where Martita lives, not a
  real-time GPS position; never present it as live location.
- **Typed and voice input must reach the same cognitive controller** — parity is
  mandatory; a fix in one modality must hold in the other.
- **Ofir is female.** (Family truth; see `knowledge/family_data.json`.)
- **Git/deploy safety:** never `git add -A`; never deploy to Production without
  explicit human approval; no background agents/forks/worktrees by default.
  Routine safe inspection/edits/tests/commits are approved. Build and full test
  suite are run sequentially, never simultaneously.

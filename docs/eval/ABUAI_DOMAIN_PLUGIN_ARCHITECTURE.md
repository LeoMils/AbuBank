# AbuAI Domain Plugin Architecture

**Build:** `0.20.0-domain-plugins` · **Date:** 2026-07-03 · **Verdict: HOLD** (not deployed; not device-verified).

## What replaced the special-case reasoner

The 4 calendar-mutation domains are no longer special-case `switch` arms. They are
generic **domain plugins** selected by a generic **Domain Planner** the Executive
Cognitive Controller runs. Adding a future domain = register a plugin; the
controller and planner never change (proven by a test).

| File | Role |
|---|---|
| `domainPlugin.ts` | The `DomainPlugin` interface: `match(ctx) → priority`, `reason(ctx) → PluginResult`. A plugin NEVER emits text — it returns structured data (candidate answer + side-effect + state patch + confidence). |
| `domainPlanner.ts` | Registry (`registerPlugin`) + planner (`runPlan`/`planWith`): selects every plugin with `match > 0`, runs their `reason()`, merges side-effects/state, primary = highest-confidence handled. **Multiple plugins may participate in one turn.** |
| `calendarMutationPlugins.ts` | `reminder`, `recurring`, `delete`, `modify` as plugins (they call `calendarMutationReasoner` functions, which are the TOOLS). |
| `cognitiveRuntime.ts` | Runs `runPlan` for every turn except the precedence intents (`audio/continuation/frustration/confirmation/date`); a handled plugin's candidate is composed + verified + finalized by the controller. The 4 special-case cases were removed. |

## Rules (all enforced)

1. Generic Domain Planner inside the controller pipeline — ✓ (`runPlan` in `runCognitiveTurn`).
2. Every mutation domain is a plugin of the same interface — ✓.
3. The controller decides which plugins participate — ✓ (planner selects by `match`).
4. Multiple plugins may participate in one turn — ✓ (test: two plugins participate; side-effects merged).
5. Plugins never emit user-visible text — ✓ (they return `PluginResult`; no UI calls).
6. Plugins only return structured reasoning results — ✓ (`PluginResult`).
7. The controller is the only component that produces the final answer — ✓ (finalizer composes/supervises/delivers the plugin's candidate).
8. Add a domain without changing the controller — ✓ (test: a newly-registered `ping` plugin is used by the Executive Controller with **zero** controller edits).

## Proof

- `domainPlanner.test.ts` — 4 tests: selection, multi-participation, side-effect merge, **add-domain-without-controller-change**.
- `calendarMutationReasoner.test.ts` — 5/5 (reminder/recurring/delete/modify through the controller, now via plugins).
- `runtimePathProof.test.ts` — 16/16 path types, 0 bypasses (mutations now flow through the planner).
- Gates: typecheck ✓ · full suite **6167/6167** ✓ · validate:family/knowledge ✓ · build ✓.

## Honest status

- **Migrated to plugins:** reminders, recurring, delete, modify.
- **Not yet migrated (still built-in runtime cases):** calendar create/read/search, family, online, general, and the precedence intents (date/continuation/frustration/audio/confirmation). They are candidates for the same plugin pattern in a follow-up; the architecture already supports them.
- Legacy `index.tsx` cascade remains **disabled/dead at runtime** (from the prior single-path cutover), pending physical deletion.
- No deploy. No production-readiness claim. New domains proven on unit/path-proof, not on device.

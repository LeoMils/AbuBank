# DECISIONS (war-room choices + rationale)

- Realtime provider down → ship the quiet pipeline fallback as the production path,
  do not block on the provider. Rationale: fallback is validated; provider is account-side.
- PWA is the mobile production path (vite-plugin-pwa). Native app is out of scope.
- Do NOT merge to main autonomously. Rationale: explicit standing rule; awaiting device sign-off.
- Build + test + typecheck are the release gates; no lint gate is claimed (none exists).
- memory/* is generated — never hand-edit; edit knowledge/* then `npm run generate:memory`.
- Tests assert behavior (run deterministic functions/components), not static greps —
  source-contract greps are MEDIUM evidence at best.

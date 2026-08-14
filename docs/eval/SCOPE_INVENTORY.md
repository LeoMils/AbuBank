# SCOPE INVENTORY — cell-level ledger (mechanically derived)

Derived from the code, not a hand list: LIVE_TOOL_SCHEMAS, the Screen enum, family_data.json,
and the liveSession event switch. A tool/screen/event added there appears here automatically.

- tools: 17 · tool param cells: 30 · tool failure paths: 35
- screens: 15 · realtime event types: 19
- family entities: 65 · ordered relationship pairs: 4160 (covered by relationMatrix.test)
- declared-unbuilt capabilities (must decline): 6

## Layer 1 — tool CONTRACT cells (EXECUTED): 97/97 pass
- all contract cells pass (valid types, non-empty descriptions, required⊆properties, unknown-param rejection, well-formed enums)

## Cell-level ledger: 172 cells seeded · 97 executed (56.4%)
- Layer 1 (executed now): tool-schema contract.
- Layer 2 (not_run — next): tool failure-path behaviour (generated args → handler), every screen via a browser harness, realtime-event invariants.
- Layer 3 (not_run): declared-unbuilt-capability declines (model behaviour, sampled).

Full machine ledger: docs/eval/SCOPE_INVENTORY.json

## Uncovered-by-any-domain (explicitly tracked, per the brief)
- multi-tool requests in one turn · 50+ turn sessions · anything depending on time passing
  (fast-forward, never wait) · every screen render/nav/RTL/text-size via a browser harness.

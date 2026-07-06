# Memory Runtime Cutover — audit

The AbuAI runtime is a PURE function: `runCognitiveTurn(state, input, ctx) → decision`,
with `RuntimeState` threaded immutably per turn. That purity is why the system is
deterministic and 6696 tests are green. So the cutover is **not** "replace the carrier"
(that would destabilize everything) — it is "make Memory Engine v2 the single canonical
ACCESSOR over the one carrier, and migrate the one true duplicate (a module-global)."

## Memory owners today — classification

| Owner | Holds | Duplicate? | Decision |
|---|---|---|---|
| `RuntimeState.createState` | pending calendar draft + phase (confirmation) | no — sole owner | **keep** (the carrier); read via adapter |
| `RuntimeState.lastFamilyPair` | last family pair (איך בדיוק) | no — sole owner | **keep**; read via adapter |
| `RuntimeState.conv` (conversationOS) | last answer, topic (תמשיכי/recall) | no — sole owner | **keep**; read via adapter |
| `RuntimeState.pendingReminder` | reminder draft | no — sole owner | **keep**; read via adapter |
| `RuntimeState.frustrationCount/Variant` | frustration | no — sole owner | **keep**; read via adapter |
| Delivery engine chunks | speech chunk plan | derived from the answer | **wrap** — Memory v2 `resumeLastAnswer` is the accessor |
| **`liveTurnDiagnostics` BUFFER** | last-20 turns | **YES — module-global parallel store** | **migrate** → Memory v2 `SessionMemory` (Copy-Last-20 reads canonical) |
| Online last-result | last online query/result/failure | held ad-hoc in the online branch | **migrate** → Memory v2 `rememberToolResult` |
| Greeting state | UI/session | UI-only, no memory backing | **migrate** → Memory v2 `shouldGreet/markGreeted` |
| MemoryEngineV2 (sprint 4) | full session memory model | — | **the canonical owner + API** |

## Target

- `RuntimeState` = the runtime's immutable working carrier (lightweight; sole owner per
  field — no duplicate truth).
- `memoryRuntimeAdapter.memoryFromState(state)` = the **single canonical accessor**:
  every consumer (Conversation v2, Speech, Online, Calendar, Family, Diagnostics) reads
  memory through it, never raw fields → nothing can drift.
- `SessionMemory` (wrapping MemoryEngineV2) = the **write-once-per-turn** owner, feeding
  the durable session memory + Copy-Last-20 (replaces the module-global buffer).
- Instance-based → **no module-global mutable live memory** (hard rule 5).

## Deferred (honest)

Full statefulization of the pure runtime (holding a MemoryEngineV2 inside the turn
function) is NOT done — it would break the deterministic backbone for no behavioral gain.
The anti-drift guarantee is met by: one carrier + one accessor + cutover tests proving
the accessor mirrors the carrier exactly, and the one module-global migrated.

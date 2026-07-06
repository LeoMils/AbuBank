# Intent Router Runtime Cutover — audit

The runtime already classifies EXACTLY ONCE per turn (cognitiveRuntime.classifyIntent,
fed by the semantic + conversation + knowledge routers) before any domain runs, and the
RUNTIME_FINALIZED stamp (noBypassRuntimeGuard) already rejects any answer produced without
the single runtime tail. So the cutover names ONE canonical Intent Router V2 that produces
a scored decision (intent + confidence + alternatives + reason + trace) mapped to the 21
required categories, and proves the runtime's routing agrees with it (no drift).

| Owner | Role | Classify |
|---|---|---|
| cognitiveRuntime.classifyIntent | priority ladder / cues | **wrap** → the Router's internal scorer (derived-only; cannot emit a final answer without the finalizer) |
| Semantic Intelligence v2 (recoverTranscript/resolveSemanticIntent) | STT recovery + scored intent | **keep** → feeds buildRouterContext |
| Conversation Engine v2 (classifySignalV2/reduceV2) | pending/confirmation/continuation | **keep** → priority rules (pending "כן" wins) |
| onlineIntent / ONLINE_EXTRA / classifyOnlineNeed | live detection + non-hijack | **wrap** → online_live scoring |
| calendar heuristics (buildEventV2 detection) | create/search/read/delete | **wrap** → calendar_* scoring |
| family detectors (relation cues) | relation vs name collision | **wrap** → family_* scoring (name ≠ calendar) |
| continuation detectors | תמשיכי/לא שמעתי/תשלימי | **wrap** → continuation/replay |
| help/app-how-to | settings/backup questions | **migrate** → help scoring (answered, never dismissed) |
| LLM fallback | last resort | **derived-only** → only reachable AFTER a routed knowledge_static/conversation/unknown decision |

## Target
`intentRouterV2.routeTurn(input, context)` is the ONE canonical decision: scoreIntents →
applyPriorityRules (pending "כן" wins; cancel only the right pending; search≠create;
family-name≠calendar; online-live≠static; help answered; unknown→natural clarification) →
decideClarification → {intent, confidence, alternatives, reason, trace}. The runtime's
own routing is proven to AGREE with routeTurn for every code-testable case (acceptance),
so there is one router and no legacy fallback can diverge. Physical voice stays device-only.

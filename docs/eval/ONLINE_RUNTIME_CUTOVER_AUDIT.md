# Online Runtime Cutover — audit

Code-side online routing / orchestration / retry / cache / honest failure — NOT live
provider content (device/provider-gated) or physical voice.

| Owner | Holds | Classify |
|---|---|---|
| `onlineIntent` (isOnlineCurrentInfoQuery, shouldBlockOnlineForPersonal) | live detection + personal/calendar/family block | **wrap** — feeds classifyOnlineNeed |
| `knowledgeRouter` / `ONLINE_EXTRA` (cognitiveRuntime) | bus/train/weather cues | **wrap** — folded into category detection |
| `runtimeFullTurn.callOnlineWithRetry` | retry-once + reason mapping | **migrate** → onlineRuntimeV2 executeProvider/retry |
| `onlineEngineV2` (Sprint 3: classifyInformationNeed, runOnlineV2, cache) | classify + retry + cache | **migrate** → subsumed by onlineRuntimeV2 |
| `dateReasoner` (system clock) | current date/time | **keep** — time/date come from the SYSTEM CLOCK, never online/LLM |
| Memory Engine v2 (`rememberToolResult`) | last online result | **wrap** — rememberOnlineResult + follow-up |
| tools.online provider (api/abuai-online) | actual live data | **device/provider-gated** |

## Target
`onlineRuntimeV2.OnlineRuntimeV2` is the ONE canonical, deterministic owner: category
classification (sports/movies/transport/time/date/news/events/weather), provider
selection, retry/timeout/failover, cache + freshness, normalized result, speech-safe
formatting, honest failure with provider reason, memory integration (result + follow-up),
and a diagnostic trace (Copy-Last-20). Non-hijack: calendar/family/personal are NEVER
routed online; time/date come from the system clock. Never hallucinates current facts —
only the provider's answer is ever returned. Live provider CONTENT stays device-gated.

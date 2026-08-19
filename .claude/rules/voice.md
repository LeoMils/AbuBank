---
description: Engineering rules for the voice pipeline (STT / TTS / Realtime)
globs: "src/services/voice*.ts,src/services/realtime*.ts,src/services/recording*.ts,src/services/ttsFallbackPolicy*.ts,src/screens/AbuAI/*oice*.ts,src/screens/AbuAI/speechDelivery*.ts,src/screens/AbuAI/sttSemanticRecovery*.ts"
alwaysApply: false
---
# Rule: Voice pipeline (engineering)

**Applies to:** voice/STT/TTS/Realtime source under `src/services/` and AbuAI voice modules.

- The path is STT → the SAME cognitive controller as typed input → TTS or Realtime.
  Typed/voice parity is mandatory (see root CLAUDE.md always-on truths).
- **Every fallback must be bounded** (explicit timeout/attempt cap) and must surface a
  **truthful UI state** (listening / thinking / speaking / error / fallback-used).
  A silent wait is a defect (`REALTIME_AUDIO_TIMEOUT` watchdog is the reference pattern).
- **Physical audibility and on-device latency are `PHYSICAL_DEVICE` evidence only.**
  Never claim voice "works" from CODE/MOCK/BROWSER — those prove wiring, not that Martita
  heard warm, natural audio. The Acceptance Board voice rows stay red/yellow until heard.
- Run the `voice-runtime-audit` skill before claiming any voice change is complete.
- Do not edit product voice behavior during Engineering-OS foundation work.

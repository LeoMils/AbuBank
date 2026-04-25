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

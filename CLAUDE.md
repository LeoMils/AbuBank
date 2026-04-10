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
- Consult `/memory/` files for Martita context — don't bloat this file with details.
- Birthdays and family dates live in `memory/birthdays_registry.yaml` — never scatter ad hoc.
- Before modifying Martita's voice or tone, consult `memory/whatsapp_patterns.yaml` and `memory/message_examples.md`.

## Key Memory Files
- `memory/martita_profile.yaml` — identity, personality, daily life
- `memory/family_graph.yaml` — family tree with canonical names
- `memory/aliases_and_names.yaml` — name → alias lookup
- `memory/birthdays_registry.yaml` — birthdays + memorial dates + reminder policy
- `memory/whatsapp_patterns.yaml` — real writing patterns for message generation
- `memory/message_examples.md` — curated style-teaching examples

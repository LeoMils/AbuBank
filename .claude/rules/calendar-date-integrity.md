# Rule: Calendar & Date Integrity

- Never invent a birthday or date. If unknown, store as null with confidence: unknown.
- All dates in memory files use MM-DD format (no year for recurring events).
- When a birthday is learned (from conversation, user input, or any source):
  1. Update memory/birthdays_registry.yaml
  2. Set confidence level (confirmed/inferred/unknown)
  3. Note the source
  4. Never duplicate — check aliases_and_names.yaml first
- Reminder lead times: [7, 3, 1, 0] days before for close family.
- Pepe's memorial (12-26) is emotionally significant — gentle tone, never clinical.
- Voice-parsed appointments must resolve to actual YYYY-MM-DD dates — never return "TOMORROW" or "FRIDAY" as literals.
- Partial dates are acceptable. Store what is known, mark what is missing.

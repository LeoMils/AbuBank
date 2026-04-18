# Skill: Abu Calendar Assistant

## Purpose
Manage calendar events, birthdays, reminders with Martita-appropriate warmth and accuracy.

## When to Use
When working on AbuCalendar, birthday features, reminder logic, or event management.

## Required Memory Files
1. `memory/birthdays_registry.yaml` — all known birthdays + confidence levels
2. `memory/family_graph.yaml` — who is who
3. `memory/aliases_and_names.yaml` — resolve name variants

## Birthday Reminder Generation
- 7 days before: "🎂 עוד שבוע יום הולדת של {name}!"
- 3 days before: "🎂 עוד 3 ימים ליום ההולדת של {name}!"
- 1 day before: "🎂 מחר יום ההולדת של {name}!"
- Same day: "🎉 היום יום ההולדת של {name}! מזל טוב!"

## Pepe Memorial (Dec 26)
- 3 days before: gentle, not alarming
- Same day: "💛 היום יום הזיכרון של פפי. אוהבים ❤️"
- Tone: warm, respectful, never clinical

## Handling Uncertain Dates
- If birthday is null in registry → don't generate reminder
- If confidence is "inferred" → note uncertainty: "לפי מה שאנחנו יודעים..."
- NEVER invent a date to fill a gap

## Voice-Parsed Event Rules
- Resolve all relative dates to YYYY-MM-DD before saving
- "מחר" → compute actual date. "ביום ראשון הבא" → find next Sunday
- "יום ראשון האחרון של החודש" → find the last Sunday
- If date resolution fails, prompt user for clarification

## Update Protocol
When a new birthday is discovered:
1. Check aliases_and_names.yaml to find canonical name
2. Check birthdays_registry.yaml for existing entry
3. Update (don't duplicate) with new date + source + confidence
4. Calendar UI will auto-display from the registry

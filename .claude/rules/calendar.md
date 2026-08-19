---
description: Engineering rules for calendar create/read/modify continuity
globs: "src/screens/AbuCalendar/**,src/screens/AbuAI/calendar*.ts,src/screens/AbuAI/eventExtractor.ts,src/screens/AbuAI/meetingIntelligence.ts,src/screens/AbuAI/dateParser.ts"
alwaysApply: false
---
# Rule: Calendar continuity (engineering)

**Applies to:** AbuCalendar screen + AbuAI calendar/date modules.
**Domain authority:** `.claude/rules/calendar-date-integrity.md` (dates, memorial date, no invented dates).

- **Write → readback → modify must be transactional within the same session.** An event the
  user just created must be immediately readable AND modifiable. A write that cannot be read
  back is a failure (this failed physical acceptance and stays red until re-proven on device).
- Voice/typed appointments must resolve to real `YYYY-MM-DD` dates — never emit `TOMORROW`,
  `FRIDAY`, etc. as literals.
- Persistence is IndexedDB (`services/durableStore`); prove round-trips, do not assume them.
- Follow-up and explicit correction ("no, make it 4pm") must update the pending event, not
  start over. Run `calendar-integrity` (+ `failure-to-regression` for any failure) before claiming complete.

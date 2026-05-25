# Calendar Revolution — Follow-ups (deferred work)

Items intentionally OUT OF SCOPE for the current revolution, captured so they are not lost.

## FU-1 — One-tap "add bill as reminder" from services/bills
- **Why deferred:** Phase 0 §8 found NO due-date / billing-cycle data model in the codebase. `Home/data.ts` `Service` (`{id,label,url,color,logo,bgColor}`) carries no date/amount/dueDate field; the only billing references are decorative rotating copy strings in `MSGS`/`getDailyMsg`, not structured data.
- **Prerequisite:** a new per-service due-date data model (e.g. billing cycle / next-due date per service), defined with source-of-truth discipline and no financial-detail leakage (privacy-boundaries rule forbids storing financial details).
- **Then:** a one-tap "הוסיפי כתזכורת" affordance on the service launcher that creates a calendar reminder via the existing `createAppointmentSafe` path.
- **Status:** future work — requires data model first. Not started.

## (candidate, not yet approved) Other Phase-0 §9 abilities held back
- Unified AbuAI voice-contract adapter (`{rawTranscript, contextDate, locale} → {status, reminder?, confidence, alternatives?, failureReason?}`).
- Recurring user reminders (medication, weekly calls) — `isRecurring` field exists but is family-only today.
- Shabbat/holiday-aware scheduling nudges (holiday table already present).
These remain audit candidates only; not in the current operator-approved scope.

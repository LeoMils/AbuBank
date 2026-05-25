# Calendar Revolution — Phase Status

> Live plan (TodoWrite substitute — its MCP server is disconnected this session).
> Statuses: ⬜ pending · 🟡 in_progress · ✅ completed.
> Operator acceptance signals: `ACCEPT-N` / `BLOCK-N <reason>` / `STATUS` / `RESET-N`.

| # | Phase | Role | Gate | Status |
|---|-------|------|------|--------|
| 0 | Audit | Audit Agent [SPAWN] | ACCEPT-0 | ✅ ACCEPT-0 received |
| 1 | Brief | [INLINE] | ACCEPT-1 | ✅ ACCEPT-1 received |
| 2 | Information Architecture | [INLINE] | ACCEPT-2 | ✅ IA written — awaiting ACCEPT-2 |
| 3 | Design (Visual+Motion+Hebrew+A11y) | [INLINE] | ACCEPT-3 | ⬜ |
| 4 | Integration Intelligence | Integration Agent [SPAWN] | ACCEPT-4 | ⬜ |
| 5 | Architecture + Plan | [INLINE] | ACCEPT-5 | ⬜ |
| 6 | Build (chunk-by-chunk) | Build Executor [SPAWN/chunk] | ACCEPT-6.N → ACCEPT-6 | ⬜ |
| 7 | QA | QA Agent [SPAWN] | ACCEPT-7 | ⬜ |
| 8 | Red Team | Red Team Agent [SPAWN] | ACCEPT-8 | ⬜ |
| 9 | Principal Review | Principal Reviewer [SPAWN] | ACCEPT-9 | ⬜ |
| 9.5 | External Second-Opinion | operator-triggered | EXTERNAL-9.5 | ⬜ (optional) |
| 10 | Ship | [INLINE] | ACCEPT-10 | ⬜ |

## Setup decisions (operator-confirmed)
- **Branch base:** `feat/calendar-revolution` off `feat/abuwhatsapp-local-family-contacts` @ `6a91ac5` (NOT `main` — main lacks all calendar code). Operator confirmed.
- **Governing docs:** `CLAUDE.md` + the v5 mega-prompt. `abubank-operating-protocol-v5-FINAL.md` is absent from the repo; operator approved proceeding without it.
- **Calendar path correction:** code lives at `src/screens/AbuCalendar/`, not `src/calendar/` as the mega-prompt assumed. Audit targets the real path.
- **Ship step:** PR-based delivery with explicit operator accept (per CLAUDE.md no-auto-merge rule), not an automatic squash-merge to main. Re-confirm at Phase 10.
- **Off-limits:** `.git/`, `node_modules/`, anything outside repo root, and the bottom-bar screens' sources unless a chunk explicitly scopes them.
- **Scope (ACCEPT-0):** IN — (a) bottom-sheet day-detail, (b) no-scroll-primary redesign, (c) ≥56pt cells + non-color indicators, (e) read birthdays from `knowledge/family_data.json`. OUT — (d) add-bill-as-reminder → deferred to `FOLLOW_UPS.md` (needs a due-date data model). Branch `claude/enable-family-contact-data-Hhcf4` declared out of scope for this mission.

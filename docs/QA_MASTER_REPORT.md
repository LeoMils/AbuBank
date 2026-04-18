# QA Master Report — AbuBank v15 PR

**Date:** 2026-04-18
**Branch:** `claude/add-wow-solitaire-game-IGypa`
**PR:** #3

---

## Executive Summary

A structured 8-area static code analysis was performed across all screens, services, and components. Three parallel QA teams examined Navigation & Flow, Calendar, AbuAI, AbuWhatsApp, Cross-App Consistency, Accessibility, Error Handling, and Performance.

**1 blocker was found** — a stale closure bug in AbuWhatsApp voice mode that sends an empty clipboard when the user says "send to family." This must be fixed before merge.

**6 should-fix items** were identified, ranging from misleading clipboard success toasts to a modal title that says "new event" when editing. None are crash-level, but all affect Martita's real-world experience.

All other findings are deferrable — pre-existing Weather screen text sizes, minor timer cleanup gaps, and cosmetic inconsistencies that don't affect usability.

---

## Merge Recommendation

### FIX THEN MERGE

Fix the 1 blocker and 6 should-fix items, then merge.

---

## Blockers (1)

| # | Area | File:Line | Description |
|---|------|-----------|-------------|
| B1 | AbuWhatsApp | `AbuWhatsApp/index.tsx:292+358` | `handleSendToFamily` reads `result` state directly but is called from `startVoiceListening` (`useCallback([])`) — stale closure sends empty string to clipboard. Fix: use `resultRef.current` instead of `result` on line 296. |

## Should-Fix Before Merge (6)

| # | Area | File:Line | Description |
|---|------|-----------|-------------|
| S1 | AbuWhatsApp | `AbuWhatsApp/index.tsx:296` | Clipboard `.catch{}` swallows failure but toast still says "copied!" — misleading to Martita |
| S2 | AbuWhatsApp | `AbuWhatsApp/index.tsx:1024` | Same clipboard silent-success pattern in copy button |
| S3 | Calendar | `AbuCalendar/index.tsx:232` | Modal title says "אירוע חדש" even when editing — confusing for Martita |
| S4 | Calendar | `AbuCalendar/index.tsx:569-595` | Rapid delete overwrites single undo slot — previous undo lost silently |
| S5 | Settings | `Settings/index.tsx:179-183` | `clipboard.writeText()` has no `.catch()` — unhandled rejection triggers Error screen |
| S6 | AbuAI | `AbuAI/index.tsx:215` | Too-short recording silently discarded — no user feedback |

## Can-Defer Items (14)

| # | Area | File | Description |
|---|------|------|-------------|
| D1 | Calendar | `AbuCalendar/index.tsx:552` | `showToast` setTimeout not cleaned on unmount |
| D2 | Calendar | `AbuCalendar/index.tsx:629,637` | `voiceStatus` setTimeout not cleaned on unmount |
| D3 | Calendar | `AbuCalendar/service.ts:29` | `colorIndex` resets on reload — cosmetic color collisions |
| D4 | Navigation | `navigationService.ts:48` | `window.open(_blank)` in openService — may be dead code path |
| D5 | Consistency | Multiple screens | Deprecated `BackToHome` still on Admin/Opening/Offline/Error |
| D6 | Consistency | `AbuWhatsApp/index.tsx:597` | Header 82px vs 72px on all other screens |
| D7 | Consistency | Multiple screens | Non-canonical gold gradients (cosmetic only) |
| D8 | Consistency | `FamilyGallery/index.tsx:257-262` | Keyframes style tag never removed on unmount |
| D9 | Weather | `AbuWeather/index.tsx:289,294,729` | 10px text at 0.28-0.38 opacity (pre-existing, not regression) |
| D10 | Weather | `AbuWeather/index.tsx:369-387` | DayTab buttons ~29px height (below 44px minimum) |
| D11 | Weather | `AbuWeather/index.tsx:629` | Refresh button ~33px height |
| D12 | Calendar | `AbuCalendar/index.tsx:824-836` | "היום" button minHeight 36px (below 44px) |
| D13 | AbuAI | `AbuAI/index.tsx:470-471` | localStorage not try/caught in enterVoiceMode |
| D14 | AbuAI | `AbuAI/index.tsx:148` | Empty catch in unmount cleanup |

## Confidence Level

**HIGH.** All blocker and should-fix items are verified through direct code reading with exact line references. No speculative issues are included.

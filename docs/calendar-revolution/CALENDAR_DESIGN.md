# CALENDAR_DESIGN — Phase 3 (Visual · Motion · Hebrew/RTL · Accessibility)

Branch: `feat/calendar-revolution`. Inputs: `CALENDAR_AUDIT.md`, `CALENDAR_BRIEF.md`, `CALENDAR_IA.md`, operator ACCEPT-2 decisions.
Status: design spec written — awaiting ACCEPT-3. No production code. Nothing pushed.

This is a specification, not code. Concrete pixel/contrast targets are stated so Phase 6 can build and Phase 7 can PROVE them. No "passes AAA" claim is made here — those are targets to be verified with real measurement (Truth Contract).

ACCEPT-2 decisions folded in:
- Drop Yarden/Sharon birthdays (now in `FOLLOW_UPS.md` FU-2); birthdays come from `knowledge/family_data.json`.
- AbuTime is NOT a permanent primary footprint — its per-day briefing moves **into the day-sheet** (optional, collapsed); primary stays no-scroll.

---

## 1. Visual system

### 1.1 Tokens (dark base preserved from current screen)
- **Surface base:** deep navy `#050A18` (current footer/bg gradient origin, audit index.tsx:1094). Sheet surface one step lighter, e.g. `#0C1426`, with a 1px hairline top border `rgba(201,168,76,0.25)`.
- **Accent (gold):** `#C9A84C` — reserved for "today", primary action, selected state. Used sparingly (calm, premium).
- **Text tokens (replace the sub-AAA muted alphas flagged in audit H6):**
  | Token | Use | Target on `#050A18` |
  |---|---|---|
  | `text-primary` `#F5F0E8` | titles, event names, day numbers | ≥ 7:1 (AAA) |
  | `text-secondary` `#D8D2C4` (NOT the current 0.50/0.70 alpha) | labels, "אירועים", day-of-week headers | ≥ 7:1 target — must be measured in Phase 7 |
  | `text-muted` solid `#9C9486` | timestamps, helper | ≥ 4.5:1 floor, aim 7:1 |
  Rule: **no `rgba(...alpha)` text on the dark base** — alpha compositing is what dropped contrast below AAA (audit H6 at index.tsx:842, 944, 1058, 1059). Use solid hex tokens chosen to meet ratio.

### 1.2 Primary view (no-scroll, 360×740 budget)
Vertical budget (approx, 360×740, safe-area ~ top 8 / bottom 16):
```
ScreenHeader            ~64pt   back · "Abu יומן" · Martita photo · info-legend
Next-thing glance       ~44pt   one line: next upcoming event (icon + Hebrew label + relative day)
Alert-interval (compact) ~40pt  single select row; collapses to a chip when default
Month nav               ~48pt   ‹ · month year · "היום" · ›
Day-of-week header row  ~24pt
Month grid (6 rows)     ~420pt  see §1.3
─────────────────────── ≈ 640pt + gaps/padding < 740 → fits without scroll
```
No footer band; bottom area intentionally empty (calm). ADD lives in the sheet only.

### 1.3 Day cells — sizing & the honest 7-column constraint
- **Height:** target **≥64pt** per row (6 rows × 64 = 384 + 5×12 gap = 444 ≤ budget). Comfortably above the 56pt recommendation on the dominant (vertical) axis.
- **Width — measured constraint, stated honestly:** on a 360pt-wide viewport, 7 columns cannot each be ≥48pt wide once any side padding + inter-cell gap exists. Best achievable: side padding 8pt → usable 344pt; column gap 4pt (6 gaps = 24pt) → `(344−24)/7 ≈ 45.7pt` wide. **~46pt < the 48pt floor on the horizontal axis.** We will NOT add horizontal scroll (no-scroll rule) and will NOT shrink to fit a 4-week strip. **Decision:** maximize width to ~46pt (8pt padding, 4pt gap), keep height ≥64pt; the *whole cell* is the tap target (≈46×64), exceeding 48 on one axis. Residual: ~46pt width is ~4% under the 48 floor — flagged as a geometric limit of 7-col/360, to be re-measured in QA; acceptable tradeoff vs. scrolling or cramped gaps. (Improves on today's `minHeight:54`, `gap:3` — audit H4.)
- Selected/today states use the gold accent ring + bold number, not color alone (see §4.2).

### 1.4 Bottom-sheet day-detail
- Slides up from bottom; **height ~70–85% of viewport**, rounded top corners `20pt`, scrim `rgba(5,10,24,0.6)` behind.
- Structure (from IA §4): grip · day header (Hebrew date + holiday/Shabbat chip) · **optional collapsed AbuTime per-day briefing** · event list (scrolls within sheet) · ADD zone pinned to sheet bottom (manual + mic) · in-sheet voice status during active session only.
- The sheet **owns its own scroll**; the event list never sits under global chrome → PP-1 cannot recur (IA §6).
- ADD zone: manual-add SeniorButton + mic button, both ≥56pt, side by side, inside the sheet's bottom inset (not a global sticky footer).

---

## 2. Motion

- **Sheet open:** translateY 100%→0 + scrim fade, **220ms**, ease-out (spring-ish). **Close:** 180ms ease-in. Backdrop tap / swipe-down / close-button all dismiss.
- **Day select:** 120ms scale/opacity tap feedback on the cell; **15ms haptic** on tap (senior-ux rule).
- **iOS repaint guard (audit §6d, unproven but cheap to avoid):** do NOT nest looping/animated children (shimmer/`todayShimmer`, `fadeSlideUp`) inside a `borderRadius + overflow:hidden` clip. Either drop the clip on animated containers or move the animation outside the rounded-overflow box. This removes the MEDIUM iOS repaint-flash risk by construction rather than relying on device luck.
- **prefers-reduced-motion:** all transitions collapse to instant (no slide, no shimmer); state still changes visibly. Mandatory.
- Keep motion calm — no bounce overshoot, no flashy effects (product principle).

---

## 3. Hebrew / RTL

- Primary + sheet `dir="rtl"`. Week layout RTL: Sunday (א׳) on the **right**, Saturday (ש׳) on the **left** — matches Israeli week + RTL reading.
- **Numbers & time strings `dir="ltr"`** within RTL context (day numbers, `HH:MM`) — preserve the existing correct pattern (audit H10, ManualModal.tsx:177, VoiceCard.tsx:252). Do not regress.
- **Past-event styling — replace strikethrough (audit H11).** `textDecoration:line-through` on 16px Hebrew harms presbyopic legibility. Instead: past events get `text-muted` color + a small "עבר" pill OR reduced opacity 0.6 with a ✓ glyph — never a line through Hebrew glyphs.
- **"Martita" always Latin script** (product rule) — e.g. birthday title keeps `Martita`, surrounding copy Hebrew.
- Copy stays warm, plain Hebrew, feminine address; honest failure copy preserved (audit H12). Raw transcript never rendered (constraint).

---

## 4. Accessibility (WCAG 2.2, AAA target)

### 4.1 Contrast
- All body/label text uses solid tokens from §1.1 chosen to hit **≥7:1** on `#050A18`; interactive/large text **≥4.5:1** floor but aim 7:1. The specific muted spots from audit H6 (index.tsx:842, 944, 1058, 1059) are replaced with `text-secondary`/`text-muted` solids. **Phase 7 must measure actual ratios and report numbers — no AAA claim until measured.**

### 4.2 Non-color-only event indicators (audit H7)
Each event type pairs **color + shape + glyph**, so color is never the sole signal:
| Type | Color | Shape | Glyph |
|---|---|---|---|
| Birthday | pink/gold | filled circle | 🎂 |
| Memorial | gold | outline circle (ring) | 🕯️ |
| Regular | teal/blue | small square | • / type emoji |
On day cells: show the dot **shape** (filled vs ring vs square) + a count digit when >1; the glyph appears in the sheet's event rows. The existing InfoButton legend (audit index.tsx:813-823) is updated to describe shape, not just color.

### 4.3 Touch targets
- Day cells: ≈46×64 (see §1.3 honest constraint).
- All buttons in the sheet (manual, mic, close, delete) **≥56pt**. Fix the VoiceTraceCard dismiss from 36pt (audit H5, VoiceTraceCard.tsx:77) to **≥48pt** when shown in-sheet.
- Spacing between adjacent targets ≥12pt (grid gap exception noted in §1.3).

### 4.4 Sheet semantics
- `role="dialog"` `aria-modal="true"`, labelled by the day header; focus moves into the sheet on open, returns to the originating day cell on close; Escape / backdrop / swipe-down close. Focus is trapped while open.
- Day cells are buttons with `aria-label` = full Hebrew date + event summary ("3 אירועים"), not color-dependent.
- State changes (recording/processing/saved/error) announced via `aria-live="polite"` — preserves audit H9's good state visibility without the permanent footprint.

### 4.5 Diagnostic text (audit H8)
Dev/diagnostic text (trace metadata 11px, DEBUG 12px) is exempt from the 16px body minimum but should not be presented to Martita as primary content; keep it within the collapsed/diagnostic trace area only.

---

## 5. Mapping design → the three moments

- **ADD:** lives only in the day-sheet ADD zone (manual + mic, ≥56pt). No primary footprint (PP-2 resolved). Voice pipeline unchanged; raw transcript never shown.
- **SHOW:** primary = month grid + next-thing glance (no-scroll); detail = sheet with its own scroll (PP-1 resolved). Family birthdays sourced from `family_data.json`.
- **ALERT:** banner becomes a **top inset that reflows content** (reserved space), never painting over header/selector (fixes audit H3 / index.tsx:762). Tapping the alert opens the relevant day-sheet (IA §5).

## 6. Guardrails (unchanged)
Preserve Abu AI (read-only consumer); raw transcript never displayed; `createAppointmentSafe` single write path; four bottom-bar screens untouched; `memory/*` not hand-edited; version incremented + displayed when code lands.

## 7. Open questions for ACCEPT-3 gate
- **D1.** Next-thing glance: show only the single next event, or next event + today's count? (Affects glance height / no-scroll budget.)
- **D2.** AbuTime per-day briefing in the sheet — keep it (collapsed, opt-in) or drop entirely? IA §8/G3 deferred the keep-vs-drop; design assumes "collapsed, opt-in inside sheet" — confirm or say drop.
- **D3.** Accept the ~46pt day-cell width (the honest 7-col/360 limit) with ≥64pt height, or do you want an alternative (e.g. larger side margins sacrificed, or a different grid treatment)?

---

*End of Phase-3 Design. No source files other than docs deliverables were modified.*

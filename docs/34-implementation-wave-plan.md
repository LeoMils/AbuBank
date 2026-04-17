# 34 — Implementation Wave Plan

> Concrete, buildable. Each wave is self-contained and shippable.

---

## Wave 1 — Shared System / Safe Foundations

**Goal:** Create shared components and design constants that all subsequent waves depend on. Zero visual change to the running app — purely additive.

**Files to create:**
- `src/components/BackButton/index.tsx` — unified back button (glass pill, 48×44, chevron + "חזרה")
- `src/components/Toast/index.tsx` — standardized toast (info, success, undo variants)
- `src/design/colors.ts` — canonical color constants (GOLD, TEAL, CREAM, BG, opacity scale)
- `src/design/gradients.ts` — canonical gradient strings (gradient-gold, gradient-teal, gradient-gold-button)
- `src/design/typography.ts` — font size/weight/family constants for each scale level
- `src/design/glass.ts` — glass-surface and glass-elevated recipe objects
- `src/design/animation.ts` — shared keyframe strings (fadeSlideUp, pulse, dotPulse, waveBar)

**Files to modify:**
- `src/design/tokens.ts` — replace dead CSS variable mirrors with re-exports from new files above
- `src/components/BackToHome/index.tsx` — deprecate (add comment: "use BackButton instead")

**Must remain untouched:**
- All screen files (Home, AbuAI, AbuWhatsApp, AbuCalendar, AbuWeather, AbuGames)
- `src/services/voice.ts`
- `src/state/store.ts`, `types.ts`, `defaults.ts`
- `src/App.tsx`

**Regression risks:** NONE — all new files, no existing code modified except tokens.ts (dead code) and BackToHome (comment only).

**Verification:**
- `tsc` passes with no errors
- `vite build` succeeds
- New files export correctly (import each in a scratch test)
- App runs identically to before (no visual change)

---

## Wave 2 — Calendar

**Goal:** Complete calendar editing, undo-delete, Jump to Today, senior-friendly grid sizing. This is the biggest single-screen change.

**Stash decision: PARTIALLY REUSE.** Restore stash `calendar-partial-editing-pre-review`, keep:
- `updateAppointment()` in service.ts (fully implemented, correct)
- `ManualModal` editing prop support (pre-fill logic is correct)
- `ApptCard` onEdit prop (wrapper div is correct)
- `editingAppt` / `undoAppt` / `undoTimerRef` state declarations
- Visual improvements: cell 58px, font 18px, dots 6px gold, grid border 0.14

Discard from stash:
- Gold gradient string in header (replace with canonical `gradient-gold` from Wave 1)
- InfoButton positionStyle change (evaluate separately)

Complete what's missing:
- Wire `onEdit` handler: tap card → `setEditingAppt(appt)` + `setShowManual(true)`
- Wire `showManual` to pass `editing={editingAppt}` to ManualModal
- Wire `onSave` to call `updateAppointment()` when `editingAppt !== null`
- Wire undo-delete: delete → store in `undoAppt` → show undo toast (4s) → on timeout, permanently delete
- Add Jump to Today button (visible when `month !== todayMonth || year !== todayYear`)
- Replace inline back button with `<BackButton />`
- Replace inline toast with `<Toast />`
- Apply canonical colors from `colors.ts` and `gradients.ts`
- Increase day header font: 12px → 14px, opacity 0.50 → 0.70
- Event dots: change from TEAL to gold (rgba(201,168,76,0.80))

**Files to modify:**
- `src/screens/AbuCalendar/index.tsx` — main screen (editing, undo, grid sizing, back button, today button)
- `src/screens/AbuCalendar/service.ts` — `updateAppointment()` from stash + expand emoji detection

**Files to create:** None.

**Must remain untouched:**
- Voice recording flow (mic → transcribe → parse → confirm) — working correctly
- Alert system (60s interval + banner + sound) — working correctly
- ManualModal form field structure (title, date, time, color, notes) — working correctly
- `loadAppointments()` / `addAppointment()` / `deleteAppointment()` — working correctly

**Regression risks:**
- MEDIUM: Editing save could create duplicate if `updateAppointment` path fails and falls through to `addAppointment`. Guard: check `editingAppt` before choosing save path.
- LOW: Undo timer could leak if user navigates away during 4s window. Guard: clear `undoTimerRef` in useEffect cleanup.
- LOW: Jump to Today button could overlap month nav on small screens. Guard: test on 320px width.

**Verification:**
- Create event (voice) → appears in grid → tap to edit → change title → save → title updated
- Create event (manual) → appears → tap delete → undo toast appears → tap undo → event restored
- Create event → tap delete → wait 4s → event gone permanently
- Navigate to different month → "היום" button visible → tap → returns to today
- Grid cells are 58px+ on mobile viewport
- Day numbers are 18px and readable at arm's length
- `tsc` passes, `vite build` succeeds

---

## Wave 3 — Abu AI

**Goal:** Fix resource leaks, improve error feedback, increase font sizes for accessibility, add subtle atmospheric depth.

**Files to modify:**
- `src/screens/AbuAI/index.tsx` — all changes below

**Changes:**
1. **Resource leak fix:** Add `recognitionRef.current?.abort()` to useEffect cleanup (line ~134)
2. **Sender labels:** fontSize 12→14, opacity 0.42/0.55 → 0.75
3. **Timestamps:** fontSize 12→14, opacity 0.30 → 0.55
4. **Remove "ABU AI" sub-label** (10px, unnecessary)
5. **Transcription failure:** Replace `// silent` catch with toast "לא הצלחתי לשמוע. נסי שוב"
6. **Mic permission denied:** Add toast "צריכה הרשאה למיקרופון" on `not-allowed` error
7. **getUserMedia failure in voice mode:** Show toast before exiting voice mode
8. **TTS failure:** If `speakVoiceMode()` returns false, add response as text bubble, continue to listening
9. **Messages trim:** When messages.length > 100, trim to last 50
10. **Replace inline back button** with `<BackButton />`
11. **Replace inline gold gradient** with canonical `gradient-gold`
12. **Add warm radial glow** behind chat area: `radial-gradient(ellipse at 50% 30%, rgba(201,168,76,0.03) 0%, transparent 70%)`
13. **Empty state orb:** Add pulse animation (scale 1.00→1.02, 4s ease-in-out infinite)
14. **Voice mode exit:** Show brief toast "שיחה הסתיימה"

**Files to create:** None.

**Must remain untouched:**
- `src/screens/AbuAI/service.ts` — system prompt is SACRED, do not modify
- `src/screens/AbuAI/types.ts` — no changes needed
- `src/services/voice.ts` — stable, no changes in this wave
- Voice mode conversation loop logic (listen→process→speak→listen)
- Few-shot examples
- Provider priority (Groq for voice, OpenAI search for text)
- Silence detection (createSilenceDetector)

**Regression risks:**
- MEDIUM: Messages trim could remove context needed for AI conversation quality. Guard: trim from beginning, keep system prompt + few-shot + last 50 messages.
- LOW: Radial glow could reduce readability on low-end devices. Guard: use 0.03 opacity max, test on actual phone.
- LOW: Toast imports could conflict with existing inline toast patterns. Guard: replace inline toasts with Toast component.

**Verification:**
- Enter voice mode → press back (browser) → no console warnings, mic released
- Trigger transcription failure (disconnect network during recording) → toast appears
- Deny mic permission → toast with clear message
- Send 120+ messages → array trims to ~50 → conversation still coherent
- Sender labels and timestamps are readable at arm's length on phone
- Subtle gold glow visible behind chat but doesn't reduce text readability
- `tsc` passes, `vite build` succeeds

---

## Wave 4 — Abu WhatsApp

**Goal:** Fix resource leaks, upgrade silence detection, add style-driven accent colors, improve error paths.

**Files to modify:**
- `src/screens/AbuWhatsApp/index.tsx` — all changes below

**Changes:**
1. **Resource leak fix:** Add `recognitionRef.current?.abort()` to useEffect cleanup (line ~121)
2. **Replace 10s countdown** with `createSilenceDetector` from voice.ts (same as AbuAI uses)
3. **Replace inline back button** with `<BackButton />`
4. **voiceGenerate null handling:** Simplify error path — when null, speak "סליחה, לא הצלחתי. נסי שוב" directly, don't rely on stale error state
5. **getUserMedia failure:** Show toast before silent exit
6. **TTS failure in voice:** Show result text on screen if speech fails
7. **Result card glass:** Add `backdropFilter: 'blur(8px)'` + accent glow in box-shadow
8. **Style-driven accent colors on result card:**
   - מקורי → `rgba(20,184,166,0.40)` border
   - בדיחה → `rgba(201,168,76,0.40)` border
   - חידה → `rgba(167,139,250,0.40)` border
   - טריק → `rgba(37,211,102,0.40)` border
9. **Voice CTA idle pulse:** Subtle glow breath (3s, box-shadow 0.10→0.25 opacity)
10. **Replace inline gold/teal gradients** with canonical values
11. **Style pills stagger:** Add 0.05s entry delay per pill on screen load

**Files to create:** None.

**Must remain untouched:**
- `src/screens/AbuWhatsApp/service.ts` — system prompt + mandatory mistakes are SACRED
- Voice command detection logic (send, retry, style change, exit)
- Copy/retry/send action buttons (working correctly)
- WhatsApp deep link sending (working correctly)
- Style selector pill design (working correctly, only adding stagger)

**Regression risks:**
- MEDIUM: Replacing 10s countdown with silence detector changes recording behavior. Guard: test silence detection threshold with Hebrew speech, ensure it commits after natural pauses.
- LOW: Style-driven border colors could look muddy on some screens. Guard: test all 4 styles on real device.
- LOW: Voice CTA pulse could be distracting during typing. Guard: stop pulse animation when input is focused.

**Verification:**
- Enter voice mode → navigate away → no console warnings, mic released
- Voice mode: speak → natural pause → silence detector commits (not 10s countdown)
- Select "בדיחה" → generate → result card has gold-tinted border
- Select "חידה" → generate → result card has purple-tinted border
- Trigger API error in voice mode → clear spoken error message
- Voice CTA glows subtly when idle, stops when typing
- `tsc` passes, `vite build` succeeds

---

## Wave 5 — Cross-App Consistency / Polish

**Goal:** Apply shared design system across all remaining screens. Unify gradients, back buttons, version badges, font sizes, spacing.

**Files to modify:**
- `src/screens/Home/index.tsx` — geolocation error feedback, version badge placement, settings gear touch target (44→48px)
- `src/screens/AbuWeather/index.tsx` — replace back button with `<BackButton />`, add version badge, standardize Martita portrait to 48px
- `src/screens/AbuGames/index.tsx` — replace back button with `<BackButton />`, add version badge, standardize portrait
- `src/screens/FamilyGallery/index.tsx` — replace back button with `<BackButton />`, increase info button from 28→48px, add version badge
- `src/screens/Settings/index.tsx` — replace back button with `<BackButton />` (40→48px), increase contact action buttons from 36→48px
- `src/screens/Admin/index.tsx` — no changes (uses BackToHome, acceptable for admin-only screen)

**Files to create:** None.

**Must remain untouched:**
- Home service grid design (volumetric bubbles — they're beautiful)
- Home hero wordmark and greeting treatment
- Weather atmospheric system (sky, particles, mood colors — the masterpiece)
- Games WOW Solitaire featured card
- All service files
- All state files

**Regression risks:**
- LOW: BackButton replacement could affect header layouts that depend on specific sizing. Guard: test each screen's header after replacement.
- LOW: Geolocation error toast in Home could fire repeatedly. Guard: debounce with flag.
- LOW: Increasing Settings touch targets could break layout in contact list. Guard: test with 5+ contacts.

**Verification:**
- Every screen has the same back button (glass pill, chevron + "חזרה")
- Every screen shows version badge in bottom-left
- Home: deny geolocation → error toast appears (not silent)
- Settings: contact action buttons are 48px (visually verify)
- FamilyGallery: info button is 48px and tappable
- No screen has any font below 14px (except version badge at 10px)
- `tsc` passes, `vite build` succeeds

---

## Wave 6 — QA Hardening

**Goal:** Fix remaining edge cases, add error boundaries, verify all silent failures are resolved, clean up dead code.

**Files to modify:**
- `src/App.tsx` — wrap screen router in ErrorBoundary with Hebrew fallback message
- `src/components/ErrorBoundary/index.tsx` — update fallback UI to show "משהו השתבש. לחצי לרענון" with reload button
- `src/screens/AbuCalendar/index.tsx` — increase alert check interval from 60s to 30s, clear alertedIdsRef daily
- `src/screens/AbuCalendar/service.ts` — add try/catch around localStorage.setItem with quota error toast
- `src/services/voice.ts` — reduce TTS provider timeout from 15s to 8s per provider for faster fallback
- `src/design/tokens.ts` — clean up: re-export from new design files, remove dead CSS variable references

**Files to delete (dead code):**
- `src/components/ServiceTile/index.tsx` — never imported anywhere
- `src/components/BackToHome/BackToHome.module.css` — replaced by BackButton

**Files to deprecate (mark for v17 removal):**
- `src/components/BackToHome/index.tsx` — still used in Admin, add deprecation comment

**Must remain untouched:**
- All system prompts (AbuAI/service.ts, AbuWhatsApp/service.ts)
- Voice mode conversation loops (both screens)
- Weather visual system
- Home service grid
- Zustand store

**Regression risks:**
- LOW: ErrorBoundary wrapping could catch errors too broadly. Guard: wrap per-screen, not entire app.
- LOW: Faster TTS timeout could cause more fallbacks to lower-quality providers. Guard: test with slow network simulation.
- LOW: Deleting ServiceTile could break an import somewhere not visible in grep. Guard: `grep -r 'ServiceTile' src/` before deleting.

**Verification:**
- Force an error in AbuAI (throw in render) → ErrorBoundary catches, shows Hebrew message with reload
- Calendar: create event → close app → reopen → alert fires within 30s of scheduled time
- Calendar: fill localStorage to near quota → save event → error toast (not silent failure)
- Verify ServiceTile has zero imports before deletion
- Full manual test: Home → each screen → back → voice mode → exit → navigate → no console errors
- `tsc` passes, `vite build` succeeds
- Version bump to v16.0 in package.json

---

## Wave Dependencies

```
Wave 1 (foundations) ← no dependencies
Wave 2 (Calendar)   ← depends on Wave 1 (BackButton, Toast, colors, gradients)
Wave 3 (AbuAI)      ← depends on Wave 1 (BackButton, Toast, colors, gradients)
Wave 4 (WhatsApp)   ← depends on Wave 1 (BackButton, Toast, colors, gradients)
Wave 5 (polish)     ← depends on Wave 1 (BackButton, version badge pattern)
Wave 6 (QA)         ← depends on Waves 1-5 (all screens updated)
```

Waves 2, 3, 4 can run in parallel after Wave 1 completes. Wave 5 can start after Wave 1 but should finish after 2-4. Wave 6 is always last.

## Calendar Stash Decision Summary

**PARTIALLY REUSE.** The stash (`calendar-partial-editing-pre-review`) contains:
- ✅ KEEP: `updateAppointment()` service function — correct implementation
- ✅ KEEP: ManualModal `editing` prop — correct pre-fill logic
- ✅ KEEP: ApptCard `onEdit` prop — correct wrapper div
- ✅ KEEP: State declarations (editingAppt, undoAppt, undoTimerRef)
- ✅ KEEP: Grid visual improvements (58px cells, 18px fonts, 6px gold dots)
- ❌ DISCARD: Custom gold gradient string (replace with canonical)
- ❌ DISCARD: InfoButton positionStyle change (evaluate independently)

Restore stash at start of Wave 2. Cherry-pick the keeps. Replace the discards with Wave 1 canonical values.

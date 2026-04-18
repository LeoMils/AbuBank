# 31 — Screen Blueprints

> Per-screen direction. What stays, what changes, what the target is.

---

## HOME

**Current role:** Brand hero + service grid hub + geolocation + family photo focal point.
**Target role:** Same — but with consistent chrome and feedback.

**What stays:**
- 3×3 service bubble grid with volumetric gradients (they're beautiful and functional)
- Martita portrait as focal point (74px, gold border)
- "AbuBank" hero wordmark at large scale (this is the ONLY screen with full-size brand)
- Bottom footer with service shortcuts
- Staggered grid entrance animation

**What changes:**
- Geolocation denial: show error toast "לא הצלחתי לקבל מיקום" instead of silently sending generic link
- Footer shortcut icons: increase label font from 14px to 15px
- Settings gear: increase touch target from 44×52 to 48×48
- Version badge: move to bottom-left, standardize to 10px/0.30 opacity

**Target hierarchy:**
1. AbuBank wordmark + Martita photo (brand identity)
2. Service grid (primary actions)
3. Footer shortcuts (secondary navigation)

**Target layout zones:**
- Top 90px: Hero header (portrait + wordmark + greeting)
- Middle: 3×3 service grid (flex fill)
- Bottom 60px: Footer shortcuts + version badge

**Target interaction priorities:**
1. Tap service → navigate (instant, with scale feedback)
2. Tap footer → navigate to feature screen
3. Tap location → GPS request with error handling
4. Triple-tap portrait → Admin (hidden, preserved)

**Target visual direction:** Preserve current luxury treatment. Only fix geolocation feedback and minor sizing.

---

## CALENDAR

**Current role:** Basic calendar with voice/manual event creation, alerts. No editing. No undo.
**Target role:** Full-featured personal calendar with editing, undo-delete, Jump to Today, and senior-friendly grid.

**What stays:**
- Voice-first input (mic hero button, Groq parsing, confirmation card)
- Manual entry modal (ManualModal)
- Alert system (60s interval check, banner + sound)
- Appointment card design (color stripe + emoji + title/time)
- Monthly grid navigation

**What changes:**
- Grid cells: 48px → 58px minimum height
- Day numbers: 15px → 18px, weight 500→600
- Day headers: 12px → 14px, weight 600→700, opacity 0.50→0.70
- Event dots: 4px teal → 6px gold (match app palette)
- Add event editing (tap card → open ManualModal with pre-filled data)
- Add undo-delete (delete → 4s undo toast with restore button)
- Add "Jump to Today" button (visible when not on today's month)
- ManualModal: accepts `editing` prop, calls `updateAppointment()` on save
- Back button: replace current pill with unified back component
- Manual add button: enlarge from 44px to 52px, increase font to 15px

**Target hierarchy:**
1. Calendar grid (scanning for dates with events)
2. Selected day's appointments (viewing/managing)
3. Voice input button (creating new events)
4. Manual add button (alternative creation)

**Target layout zones:**
- Top 72px: Sticky header (back + portrait + "Abu יומן" + info)
- Top action bar: Month nav + Jump to Today button
- Middle: Calendar grid (7×5/6, cells 58px+)
- Below grid: Selected day appointments (scrollable)
- Bottom fixed: Voice mic + manual add + alert settings

**Target interaction priorities:**
1. Tap day → select (view appointments)
2. Tap appointment → edit (open modal)
3. Tap delete → undo toast (4s to restore)
4. Tap mic → voice record
5. Tap "הוספה ידנית" → manual modal
6. Tap "היום" → jump to current month/day

**Target visual direction:** Gold-dominant. Larger grid for senior readability. Dots in gold (not teal). Glass cards for appointments. Warm, not austere.

---

## ABU AI

**Current role:** Chat + voice AI conversation with Martita persona.
**Target role:** Same — but with fixed resource leaks, error feedback, and subtle atmospheric depth.

**What stays:**
- System prompt (warm, dignified, non-patronizing) — SACRED, do not touch
- Few-shot examples — preserve tone anchoring
- Voice mode conversation loop (listen→process→speak→listen)
- Voice phase visualization (gold ring, wave bars, dots)
- Chat bubble layout (RTL, user right, AI left)
- Empty state with greeting card and voice CTA
- Professional silence detection (createSilenceDetector)
- Provider priority: Groq (speed) for voice, OpenAI search (quality) for text

**What changes:**
- recognitionRef.abort() added to useEffect cleanup
- Sender labels: 12px/0.42 opacity → 14px/0.75 opacity
- Timestamps: 12px/0.30 opacity → 14px/0.55 opacity
- "ABU AI" sub-label: 10px → remove entirely (unnecessary)
- Transcription failure: silent → toast "לא הצלחתי לשמוע. נסי שוב"
- Mic denied: silent → toast "צריכה הרשאה למיקרופון"
- TTS failure: silent → show response as text bubble, continue
- Back button: replace with unified back component
- Add subtle warm radial glow behind chat area (0.03 opacity, gold)
- Empty state orb: add gentle pulse (scale 1.00→1.02, 4s cycle)
- Messages array: trim to last 50 on reaching 100+
- Voice mode exit: show brief "שיחה הסתיימה" toast

**Target hierarchy:**
1. Chat messages (primary content)
2. Input bar (text + mic)
3. Voice mode overlay (when active)

**Target layout zones:**
- Top 72px: Sticky header (back + portrait + "Abu AI" wordmark)
- Middle: Chat area (scrollable, staggered entry)
- Bottom: Input bar (textarea + mic + send)
- Overlay: Voice mode (full screen below header)

**Target interaction priorities:**
1. Type + send message
2. Tap mic → manual recording → transcript fills input
3. Enter voice mode → full conversation loop
4. Back → exit voice mode (if active) + navigate home

**Target visual direction:** Warm dark gold atmosphere. Subtle radial glow behind content. NOT Weather-level visual complexity — this is an interaction screen.

---

## ABU WHATSAPP

**Current role:** Generate WhatsApp messages in Martita's voice with style selection + voice mode.
**Target role:** Same — but with consistent silence detection, error feedback, and style-driven accent colors.

**What stays:**
- System prompt with 1,388 real messages — SACRED, do not touch
- Mandatory mistakes block — preserve exactly
- Style selector (מקורי/בדיחה/חידה/טריק)
- Result card with copy/retry/send actions
- Voice command detection (send, retry, style change, exit)
- Direct generate on style pill tap (non-original styles)
- Copy toast with paste instructions

**What changes:**
- recognitionRef.abort() added to useEffect cleanup
- Replace 10s countdown silence detection with createSilenceDetector (same as AbuAI)
- Back button: replace with unified back component (current 46×46 → 48px+)
- voiceGenerate null path: simplify error handling, speak clear error message
- getUserMedia failure: show toast instead of silent exit
- TTS failure: show result text if speech fails
- Result card: enhance glass treatment (add backdrop blur 8px + accent glow)
- Style-driven accent: each style tints result card border/glow:
  - מקורי → teal border
  - בדיחה → gold border
  - חידה → purple border (#A78BFA)
  - טריק → green border (#25D366)
- Voice CTA: add subtle idle glow pulse (3s cycle, very subtle)

**Target hierarchy:**
1. Style selector (choose message type)
2. Intent input (what to write about)
3. Result card (generated message + actions)
4. Voice mode (alternative input)

**Target layout zones:**
- Top 72px: Sticky header (back + portrait + "Abu הודעות")
- Content: Style pills → intent textarea → generate button → result card
- Bottom: Voice CTA circle
- Overlay: Voice mode (when active)

**Target interaction priorities:**
1. Select style → type intent → generate
2. Or: tap voice CTA → speak intent → auto-generate
3. Copy result → send via WhatsApp
4. Retry for different version

**Target visual direction:** Teal-dominant (WhatsApp identity), with style-driven accent colors on result card. Subtle, not overwhelming.

---

## WEATHER

**Current role:** Atmospheric weather display with mood-driven visuals and personal briefing.
**Target role:** Same — this is the visual masterpiece. Preserve almost entirely.

**What stays (everything):**
- Dynamic sky gradient based on mood + time
- Animated overlays (rain, snow, stars, sun rays, lightning)
- Hero emoji with float animation + glow
- Temperature color system
- Glass morphism content cards with accent inheritance
- Staggered entry animations
- Personal Martita briefing
- Day tabs for forecast

**What changes:**
- Back button: replace with unified back component
- Martita portrait in header: standardize to 48px with canonical gold border
- Version badge: add to bottom-left (currently missing)

**Target visual direction:** Preserve entirely. Weather is the reference implementation for "what premium atmospheric design looks like." Other screens borrow principles, not elements.

---

## GAMES

**Current role:** Game link grid with WOW Solitaire featured hero.
**Target role:** Same — minor consistency fixes only.

**What stays:**
- WOW Solitaire featured card (hero treatment)
- 2-column game card grid
- Category separators with emoji
- Floating particle symbols (ambient motion)

**What changes:**
- Back button: replace with unified back component
- Martita portrait in header: standardize to 48px
- Version badge: add to bottom-left

**Target visual direction:** Gold-dominant. Preserve floating particles as ambient decoration. No major changes needed.

---

## SHARED CONTROLS

### Back Button (REDESIGN)
**Current:** 8 different implementations.
**Target:** ONE component used everywhere.
- Design: Glass pill, 48×48 minimum, gold border (0.18 opacity)
- Content: RTL chevron (›) + "חזרה" text label
- Position: Top-right in RTL sticky header
- Behavior: If voice mode active → exit voice first, then navigate home
- Animation: scale(0.95) on press
- File: `src/components/BackButton/index.tsx` (new shared component)

### Alert Banner
**Current:** Calendar-only, fixed position below header.
**Target:** Keep Calendar-only for now. Refine:
- Increase check interval from 60s to 30s
- Clear alertedIdsRef daily (not per-session)
- Add sound + haptic feedback

### Microphone Button
**Current:** Different sizes and styles per screen.
**Target:** Standardize recording indicator:
- Mic icon: 24px, gold at rest, red when recording
- Container: 56×56 minimum
- Recording state: red pulse animation (1.2s), timer above
- Transcribing state: spinner replaces mic icon

### Version Badge
**Current:** Inconsistent placement, some screens missing.
**Target:** Every screen shows version in bottom-left:
- Font: 10px, DM Sans, 0.30 opacity
- Position: fixed, bottom 8px, left 12px
- Content: "v16.0"

### Toast System
**Current:** Ad-hoc toasts with different positions and durations.
**Target:** Standardized toast:
- Position: bottom 100px, centered, max-width 340px
- Background: glass (rgba(255,250,240,0.08), blur 12px)
- Border: 1px gold (0.25 opacity)
- Duration: 3s (info), 5s (success with action), 4s (undo with restore button)
- Animation: slideUp 0.25s on enter, fadeOut 0.2s on exit

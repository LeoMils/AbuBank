# 32 — Shared Design System Direction

> The canonical values. One source of truth for the entire app.

## Typography Scale

**Font families (3 total, no more):**
- **Display:** `'Cormorant Garamond', Georgia, serif` — brand wordmarks only
- **Body:** `'Heebo', sans-serif` — all Hebrew text, messages, labels
- **Label:** `'DM Sans', sans-serif` — metadata, timestamps, buttons

**Size scale (8 sizes, no more):**

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| display-lg | 42px | 600 | 1.1 | Home "AbuBank" wordmark only |
| display | 28px | 600 | 1.2 | Screen wordmarks ("Abu יומן", "Abu AI") |
| heading | 22px | 700 | 1.3 | Section titles, modal titles |
| subheading | 18px | 600 | 1.4 | Calendar day numbers, card titles |
| body | 16px | 400 | 1.7 | Chat messages, descriptions, form inputs |
| label | 15px | 600 | 1.4 | Button text, pill labels, card metadata |
| caption | 14px | 500 | 1.5 | Timestamps, sender labels, hints, notes |
| micro | 10px | 500 | 1.2 | Version badge ONLY — nothing else uses this |

**Hard rule: Nothing below 14px except version badge.**

## Spacing Scale

**8-based scale (7 values):**

| Token | Value | Usage |
|-------|-------|-------|
| space-4 | 4px | Tight gaps (dot indicators, inline icon spacing) |
| space-8 | 8px | Compact (list item gaps, card internal spacing) |
| space-12 | 12px | Standard (form field gaps, button padding) |
| space-16 | 16px | Content (screen side padding, card padding, section gaps) |
| space-20 | 20px | Generous (content area top padding, modal padding) |
| space-24 | 24px | Spacious (between major sections) |
| space-32 | 32px | Extra (modal vertical padding, empty state spacing) |

**Content padding:** 16px on both sides, all screens. No exceptions.

**Header height:** 72px. All screens. No exceptions. (Home can extend below 72px for greeting, but sticky header is 72px.)

## Back Button System

**ONE design. ONE component. Every screen.**

```
Component: <BackButton />
File: src/components/BackButton/index.tsx

Design:
- Shape: Pill (border-radius 22px)
- Size: min 48×44px (width adapts to text)
- Background: rgba(255,250,240,0.04)
- Backdrop filter: blur(12px)
- Border: 1px solid rgba(201,168,76,0.18)
- Content: SVG chevron (14px, pointing right in RTL) + "חזרה" (14px Heebo, 600 weight)
- Color: rgba(245,240,232,0.75)
- Press: scale(0.95), transition 0.1s
- Position: Top-right in header (RTL), absolutely positioned right: 12px

Behavior:
- Default: setScreen(Screen.Home)
- If voice mode active: exitVoiceMode() first, then navigate
- If modal open: close modal first, then navigate (on second tap)
- Accepts optional onPress override
```

**Delete BackToHome component** (house icon version). Replace all 8 implementations with this one.

## Semantic Colors

**Core palette (6 colors):**

| Token | Hex | Usage |
|-------|-----|-------|
| gold | #C9A84C | Primary accent, buttons, borders, active states |
| gold-bright | #F0C060 | Highlights, hover states, emphasis |
| teal | #14b8a6 | Secondary accent, navigation, WhatsApp identity |
| cream | #F5F0E8 | Primary text color |
| bg | #0C0A08 | Background (warm black) |
| bg-deep | #050A18 | Deep background (cool black, Weather/Home) |

**Opacity scale for text on dark backgrounds:**

| Token | Opacity | Usage |
|-------|---------|-------|
| text-strong | 0.95 | Primary content (messages, titles) |
| text-medium | 0.75 | Secondary content (labels, sender names) |
| text-muted | 0.55 | Tertiary content (timestamps, hints) |
| text-faint | 0.30 | Version badge, decorative text ONLY |

**Hard rule: No text intended for reading below 0.55 opacity.**

**Functional colors:**

| Token | Value | Usage |
|-------|-------|-------|
| success | #34D399 | Save confirmations, positive toasts |
| danger | #EF4444 | Recording state, delete actions, errors |
| warning | #FB923C | Alert banners, caution states |
| info | rgba(201,168,76,0.70) | Informational toasts |

## Gradients

**Canonical gradients (use ONLY these):**

| Token | Definition | Usage |
|-------|-----------|-------|
| gradient-gold | `linear-gradient(135deg, #FDE68A 0%, #F59E0B 30%, #C9A84C 70%, #FDE68A 100%)` | All gold text gradients (wordmarks, hero text) |
| gradient-gold-button | `linear-gradient(135deg, #D4A853 0%, #C9A84C 50%, #B8912A 100%)` | Gold action buttons (save, send) |
| gradient-teal | `linear-gradient(135deg, #5EEAD4 0%, #2DD4BF 20%, #0D9488 45%, #14B8A6 70%, #5EEAD4 100%)` | "Abu" text in wordmarks, teal accents |
| gradient-bg | `linear-gradient(180deg, #0C0A08 0%, #050A18 100%)` | Screen backgrounds |
| gradient-shimmer | `linear-gradient(90deg, transparent 0%, rgba(201,168,76,0.28) 25%, rgba(201,168,76,0.42) 50%, rgba(201,168,76,0.28) 75%, transparent 100%)` | Decorative shimmer lines |

**Every screen uses gradient-gold for gold text. No custom gradients.** Weather is exempt (mood-driven gradients are data visualization).

## Glass Surfaces

**Two glass recipes:**

| Token | Background | Blur | Border | Shadow | Usage |
|-------|-----------|------|--------|--------|-------|
| glass-surface | rgba(255,250,240,0.04) | blur(12px) | 1px rgba(201,168,76,0.14) | inset 0 1px 0 rgba(255,250,240,0.03) | Cards, appointment items, result cards |
| glass-elevated | rgba(255,250,240,0.08) | blur(16px) | 1px rgba(201,168,76,0.22) | 0 8px 32px rgba(0,0,0,0.40) | Modals, sticky headers, voice overlays |

**No other glass combinations.** If it's not a surface or elevated, it doesn't get glass.

## Cards

**One card recipe:**

```
Background: glass-surface token
Border-radius: 14px
Padding: 14px 16px
Margin-bottom: 10px
Entry animation: fadeSlideUp 0.3s ease-out (staggered)
Hover/press: border shifts to rgba(201,168,76,0.30)
```

Used for: appointment cards, chat bubbles, game cards, gallery items, weather time-period cards.

**Appointment card additions:** Left color stripe (4px), emoji (26px), delete button (48×48, top-right).

## Icon Discipline

**Three icon sources only:**
1. **Emoji** — for content decoration (weather, calendar events, game categories). Size: 26-48px.
2. **Inline SVG** — for UI controls (back chevron, mic, send, delete ×). Size: 16-24px. Stroke: currentColor.
3. **Phosphor Icons** — only in Admin/Settings for utility icons. Not in main screens.

**No oil-painting icons in new work.** Home service tiles keep their volumetric gradients (they work at 68px), but this style is not extended elsewhere.

## Border Radius Discipline

**Four values:**

| Token | Value | Usage |
|-------|-------|-------|
| radius-sm | 8px | Small pills, tags, dots |
| radius-md | 14px | Cards, buttons, inputs |
| radius-lg | 20px | Modals, large panels |
| radius-full | 50% | Circles (portraits, voice orb, color selectors) |

**No other values.** Currently 10+ different radius values exist — consolidate to these 4.

## Motion / Effect Discipline

**Entry animations (ONE pattern):**
```css
@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
/* Duration: 0.3s ease-out, stagger: +0.05s per item */
```

**Press feedback (ONE pattern):**
```css
transform: scale(0.95);
transition: transform 0.1s ease;
```

**Loop animations (THREE patterns only):**
```css
/* 1. Pulse (recording, alerts) */
@keyframes pulse { 0%,100% { opacity:0.7; } 50% { opacity:1; } }
/* Duration: 1.2s ease-in-out infinite */

/* 2. Dot bounce (loading) */
@keyframes dotPulse { 0%,80%,100% { scale:0.75; opacity:0.25; } 40% { scale:1; opacity:1; } }
/* Duration: 1.4s ease-in-out infinite, stagger: 0.15s */

/* 3. Wave bars (speaking) */
@keyframes waveBar { 0%,100% { scaleY:0.25; } 50% { scaleY:1; } }
/* Duration: ~1s, varied per bar */
```

**Weather-specific animations are exempt** (rain, snow, stars, sun rotation, lightning). They serve data visualization.

**All other existing animation definitions should be consolidated into these patterns.**

## Version Badge Discipline

**Every screen. Same treatment.**

```
Position: fixed, bottom: 8px, left: 12px
Font: 10px DM Sans, weight 500
Color: rgba(245,240,232,0.30)
Content: "v16.0"
z-index: 1 (below everything interactive)
```

Currently some screens show it, some don't, some in different positions. Standardize everywhere.

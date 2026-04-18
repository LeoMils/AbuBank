# 11 — Design Language Audit

> Every color, gradient, font, spacing value, animation, and glass effect across all screens.

## Color Constants by Screen

### Home
```
GOLD = '#C9A84C'
TEAL = '#14b8a6'
Background: linear-gradient(180deg, #070D1E 0%, #050A18 40%, #050A18 100%)
```

### AbuAI
```
GOLD = '#C9A84C'
GOLD_BRIGHT = '#F0C060'
BG = '#0C0A08'
SURFACE = rgba(255,250,240,0.06)
BORDER = rgba(201,168,76,0.14)
TEXT = '#F5F0E8'
TEXT_MUTED = rgba(245,240,232,0.48)
```

### AbuWhatsApp
```
TEAL = '#14b8a6'
GOLD = '#C9A84C'
WA_GREEN = '#25D366'
Header bg: linear-gradient(180deg, rgba(5,12,18,1) 0%, rgba(4,14,10,1) 60%, rgba(5,10,24,1) 100%)
```

### AbuCalendar
```
GOLD = '#C9A84C'
BRIGHT_GOLD = '#D4A853'
TEAL = '#14b8a6'
CREAM = '#F5F0E8'
```

### AbuWeather
```
Background: '#050A18'
Accent: mood-driven (sunny=#FCD34D, rain=#38BDF8, thunder=#A78BFA, etc.)
Temperature: gradient from #7DD3FA (cold) through #34D399 to #EF4444 (hot)
```

### AbuGames
```
GOLD = '#C9A84C' (solitaire accent)
RED = '#ef4444' (mahjong accent)
Ambient blobs: gold rgba(201,168,76,0.14), red rgba(239,68,68,0.09), purple rgba(139,92,246,0.05)
```

## Gold Gradient Inventory

Every distinct gold gradient definition found in the codebase:

| # | Screen | Usage | Definition |
|---|--------|-------|------------|
| 1 | Home | "Bank" wordmark | `135deg, #FDE68A 0%, #F59E0B 12%, #D97706 26%, #FBBF24 40%, #B45309 55%, #D4A843 68%, #F59E0B 80%, #FDE68A 92%, #EAB308 100%` |
| 2 | Home | Greeting name | Same as #1 |
| 3 | Home | Footer shimmer | `90deg, transparent 0%, rgba(201,168,76,0.28) 25%, rgba(201,168,76,0.42) 50%, rgba(201,168,76,0.28) 75%, transparent 100%` |
| 4 | AbuAI | Wordmark | `135deg, #FFF0C0 0%, #F0C060 20%, #D4A853 45%, #C9A84C 60%, #B8912A 80%, #E8C060 100%` |
| 5 | AbuAI | Send button | `135deg, #C9A84C 0%, #B8912A 60%, #A07828 100%` |
| 6 | AbuCalendar | Header gradient | `135deg, #e8d5a0 0%, #D4A853 35%, #f0e0a0 60%, #C9A84C 100%` |
| 7 | AbuCalendar | Modal save button | `135deg, #D4A853 0%, #e8c76a 50%, #C9A84C 100%` |
| 8 | AbuWhatsApp | Generate button | `135deg, #14b8a6 0%, #0d9488 35%, #C9A84C 75%, #B8912A 100%` (teal→gold) |
| 9 | AbuGames | Featured card | Gold gradient (varies by press state) |
| 10 | FamilyGallery | Header shimmer | `90deg, #C9A84C 0%, #E8D5A0 25%, #C9A84C 50%, #E8D5A0 75%, #C9A84C 100%` |
| 11 | Settings | Section accent | `135deg, #5EEAD4 0%, #2DD4BF 20%, #0D9488 45%, #5EEAD4 80%` (teal, not gold) |

**Finding: At least 8 distinct gold gradient definitions. No two screens use the same gradient.**

## Teal Gradient Inventory

| # | Screen | Usage | Definition |
|---|--------|-------|------------|
| 1 | Home | "Abu" wordmark | `135deg, #5EEAD4 0%, #2DD4BF 14%, #0D9488 28%, #5EEAD4 42%, #14B8A6 58%, #0F766E 74%, #5EEAD4 88%, #2DD4BF 100%` |
| 2 | Home | Greeting text | `135deg, #5EEAD4 0%, #2DD4BF 15%, #0D9488 30%, #5EEAD4 48%, #14B8A6 65%, #0F766E 80%, #5EEAD4 100%` (slightly different stops) |
| 3 | AbuWhatsApp | "Abu" wordmark | `135deg, #5EEAD4 0%, #2DD4BF 14%, #0D9488 28%, #5EEAD4 42%, #14B8A6 58%, #0F766E 74%, #5EEAD4 88%, #2DD4BF 100%` |
| 4 | Settings | Header wordmark | `135deg, #5EEAD4 0%, #2DD4BF 20%, #0D9488 45%, #5EEAD4 80%` (fewer stops) |
| 5 | AbuGames | "Abu" wordmark | Teal gradient (Cormorant Garamond, 30px) |

**Finding: 4-5 teal gradient variants. Home's "Abu" and WhatsApp's "Abu" match. Settings uses a simplified version.**

## Back Button Audit

| Screen | Size | Shape | Icon | Text | Background | Border |
|--------|------|-------|------|------|------------|--------|
| BackToHome (shared) | 64×64 | Circle | Phosphor House 24px | None | transparent | none |
| AbuAI | 56×56 | Circle | SVG left arrow | None | transparent | none |
| AbuWhatsApp | 46×46 | Rounded square (14px) | SVG left arrow | None | rgba(255,255,255,0.04) | rgba(255,255,255,0.09) |
| AbuCalendar | 56×44 | Pill (22px) | "›" char | "חזרה" | rgba(255,250,240,0.04) | rgba(201,168,76,0.18) |
| AbuWeather | — | Pill | SVG arrow | "חזרה" | glass | gold border |
| AbuGames | — | Glass pill | SVG chevron | "חזרה" | glass | subtle |
| FamilyGallery | — | Flex row | SVG chevron 16px | "חזרה" | glass | subtle |
| Settings | 40×40 | Circle | SVG arrow 18px | None | glass | subtle |

**Finding: 8 different back button implementations. No two match. Mix of house icon, arrows, chevrons, text labels.**

## Typography Map

### Font Families
- **Cormorant Garamond** (serif) — brand wordmarks, luxury display, voice phase text
- **DM Sans** (sans-serif) — labels, buttons, secondary wordmarks
- **Heebo** (sans-serif) — Hebrew body text, form inputs, messages

### Font Size Inventory

| Size | Usage |
|------|-------|
| 100px | Weather temperature hero |
| 46px | Home "Abu" wordmark |
| 42px | Home "Bank" wordmark, Calendar month label |
| 38px | AbuAI voice phase text |
| 34px | AbuAI "Martit" wordmark |
| 31px | AbuWhatsApp "Abu" wordmark |
| 30px | AbuAI "AI" wordmark, AbuGames "Abu" |
| 28px | AbuGames featured title, Settings "Abu" |
| 27px | AbuWhatsApp "הודעות", AbuGames "Games" |
| 26px | Home greeting name, AbuAI empty state name, AbuWhatsApp voice phase |
| 24px | FamilyGallery title |
| 23px | Home greeting text |
| 22px | AbuAI empty headline |
| 20px | Calendar modal title, Weather condition, AbuWhatsApp intent textarea |
| 18px | AbuGames game name |
| 17px | Settings section label, Weather briefing, AbuWhatsApp result, FamilyGallery photo caption |
| 16px | AbuAI chat, AbuAI empty subtitle, AbuWhatsApp pills/buttons, Calendar appt title |
| 15px | Home service label, Calendar day numbers, Settings contact name, Calendar notes/empty |
| 14px | Home footer, Calendar time, Weather feels-like, FamilyGallery caption, AbuWhatsApp copy toast sub |
| 13px | Weather greeting |
| 12px | Home settings label, Calendar day headers, Calendar input labels, AbuAI sender label, Settings desc |
| 11px | Weather location |
| 10px | AbuAI "ABU AI" sub-label |

**Finding: 22 distinct font sizes. No consistent scale or type ramp.**

## Touch Target Audit

| Element | Screen | Size | Meets 44px min? |
|---------|--------|------|-----------------|
| Service bubbles | Home | 68×68 | YES |
| Martita photo | Home | 74×74 | YES |
| Footer buttons | Home | 52×56 | YES |
| Settings gear | Home | 44×52 | BORDERLINE |
| Back button | AbuAI | 56×56 | YES |
| Mic/Send buttons | AbuAI | 56×56 | YES |
| Voice exit | AbuAI | 72×72 | YES |
| Back button | AbuWhatsApp | 46×46 | YES |
| Voice CTA | AbuWhatsApp | 108×108 | YES |
| Style pills | AbuWhatsApp | 46h | YES |
| Calendar cells | AbuCalendar | 48×48 | YES (barely) |
| Delete button | AbuCalendar | 44×44 | BORDERLINE |
| Month nav | AbuCalendar | 52×52 | YES |
| Voice button | AbuCalendar | 80×80 | YES |
| Back button | Settings | 40×40 | NO |
| Contact actions | Settings | 36×36 | NO |
| Gallery info button | FamilyGallery | 28×28 | NO |

**Finding: 3 elements below 44px minimum. Settings back button (40px), contact actions (36px), gallery info (28px).**

## Glass Morphism Patterns

| Screen | Background | Blur | Border | Shadow |
|--------|-----------|------|--------|--------|
| AbuCalendar cards | rgba(255,250,240,0.04) | 16px | rgba(255,255,255,0.07) | inset 0 1px 0 rgba(255,250,240,0.04) |
| AbuWeather header | rgba(0,0,0,0.25) | 8px | rgba(255,255,255,0.18) | none |
| AbuWeather time cards | rgba(255,255,255,0.10→0.06) | 8px | accent+30 | 0 4px 16px + accent glow |
| AbuWeather hourly | rgba(255,255,255,0.08) | none | rgba(255,255,255,0.12) | 0 2px 8px |
| AbuWeather briefing | rgba(255,255,255,0.09→0.05) | 10px | accent+40 | 0 6px 24px + accent glow |
| AbuGames cards | rgba(255,255,255,0.06) | none | rgba(255,255,255,0.09) | 0 4px 18px |
| AbuGames header | gradient dark | 16px | rgba(201,168,76,0.18) | none |
| AbuCalendar header | rgba(5,10,24,0.92) | 16px | rgba(201,168,76,0.18) | none |

**Finding: Blur values range from 0 to 16px. Border opacities range from 0.07 to 0.40. No consistent system.**

## Animation Inventory

### Entry Animations
| Name | Screen | Duration | Easing |
|------|--------|----------|--------|
| fadeSlideUp | AbuAI, AbuCalendar | 0.35–0.65s | ease / ease-out |
| msgIn | AbuAI | 0.22–0.3s | ease |
| slideUpIn | AbuWhatsApp | 0.25–0.35s | ease |
| headerSlide | AbuWhatsApp | 0.38s | ease |
| modalIn | AbuCalendar | 0.28s | cubic-bezier(0.34,1.56,0.64,1) |
| sheetUp | AbuCalendar | 0.32s | cubic-bezier(0.34,1.3,0.64,1) |
| cardIn | AbuGames | 0.45s | cubic-bezier(0.34,1.20,0.64,1) |
| fgCardIn | FamilyGallery | 0.5s | ease |
| fgHeaderSlide | FamilyGallery | 0.4s | ease |
| wxFadeUp | AbuWeather | 0.45–0.75s | ease |

### Loop Animations
| Name | Screen | Duration | Usage |
|------|--------|----------|-------|
| dotPulse | AbuAI | 1.4–1.8s | Loading/listening dots |
| waveBar | AbuAI | 0.95–1.03s | Speaking bars |
| spin | AbuAI, AbuWhatsApp | 0.8–1.1s | Loading spinner |
| waPulse | AbuWhatsApp | 1.2s | Loading dots |
| recPulse | AbuWhatsApp | 1.5s | Recording button |
| voicePulse | AbuWhatsApp | 2s | Processing orb |
| tealRipple | AbuWhatsApp | 1.8s | Listening ripples |
| recordPulse | AbuCalendar | 1.2s | Recording button |
| wxFloat | AbuWeather | 4s | Hero icon bob |
| wxRain | AbuWeather | 0.9–1.3s | Rain drops |
| wxSnow | AbuWeather | 3.5s | Snowflakes |
| wxStar | AbuWeather | 2.2–3.4s | Star twinkle |
| wxSunRot | AbuWeather | 28s | Sun rays |
| wxLightning | AbuWeather | 5s | Flash |
| floatParticle | AbuGames | 6–9s | Card suit symbols |
| fgShimmer | FamilyGallery | 4s | Title shimmer |

**Finding: 26+ animation definitions. No shared animation library. Each screen defines its own keyframes inline.**

## Spacing Patterns

### Header Heights
- Home: ~90px (flexible, includes portrait)
- AbuAI: 72px
- AbuWhatsApp: 82px
- AbuCalendar: 72px
- AbuWeather: 72px (sticky)
- AbuGames: 72px (sticky)
- FamilyGallery: 72px
- Settings: 72px

**Finding: Most screens use 72px. Home is taller. WhatsApp is 82px. No shared constant.**

### Content Padding
- Home: 4px 16px (grid), 10px 4px (footer)
- AbuAI: 20px top, 16px sides
- AbuWhatsApp: 20px top, 16px sides
- AbuCalendar: 0 12px (grid)
- AbuWeather: 0 16px
- AbuGames: 0 16px
- Settings: 14px all

**Finding: Side padding varies between 4px and 20px. No consistent content margin.**

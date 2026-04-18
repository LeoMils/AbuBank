# 30 — Final Product Blueprint

> AbuBank v16 — One premium product for Martita, not five stitched screens.

## App-Wide Product Direction

AbuBank is a **bespoke personal assistant** for one user: Martita, 80+, Hebrew/Spanish bilingual, non-technical. Every decision must pass one test: **does Martita feel respected, confident, and in control?**

The app is NOT a generic elderly-friendly tool. It is a luxury product built around one person's real life — her family, her language quirks, her daily rhythms, her independence.

**v16 goal:** Transform from "collection of impressive screens" into "one coherent premium product."

## Design Philosophy

**Premium but calm.** No flashy animations competing for attention. No gratuitous gradients. Every visual element earns its place by serving readability, hierarchy, or emotional warmth.

**One palette, one language.** Gold (#C9A84C) is the primary accent. Teal (#14b8a6) is the secondary. These two colors — and ONLY these two — define the entire product. Weather is the one exception (mood-driven by nature), but even Weather returns to gold/teal in its chrome.

**Dark theme is the only theme.** Background: #0C0A08 (warm black). Text: #F5F0E8 (warm cream). This is non-negotiable — it reduces eye strain for elderly users and creates the luxury atmosphere.

**Depth through restraint.** Glass morphism is used selectively — for elevated surfaces (modals, voice overlays, sticky headers). Not for every card. When everything is glass, nothing is elevated.

## UX Philosophy

**Every action produces feedback.** No silent successes. No silent failures. If Martita taps something, she sees/hears a response within 200ms. If something fails, she gets a clear Hebrew message explaining what happened and what to do.

**Undo before confirm.** Destructive actions (delete appointment) use undo-toast pattern (4 seconds to restore), not confirmation dialogs. Dialogs interrupt flow. Undo respects it.

**Voice is a first-class citizen, not the only citizen.** Every voice action has a manual equivalent. Voice enhances, never gates.

**Navigation is muscle memory.** One back button design. One position. One behavior. Everywhere. Always visible. Always reachable.

## Interaction Philosophy

**Predictable states.** Every screen has exactly 4 possible states: empty, loading, content, error. Each state has a defined visual treatment. No ambiguity.

**Permission before action.** Before requesting microphone, show a one-sentence explanation in Hebrew. On denial, show recovery steps. Never silently fail.

**Timeout with grace.** Voice recording uses professional silence detection (not fixed countdown). If silence detection fails, cap at 30s with clear visual countdown. Never loop infinitely.

**Clean exit.** Every modal, every overlay, every voice mode has an obvious, large (56px+) exit affordance. Voice mode exit button is always visible, not buried.

## Architecture Philosophy

**Keep what works.** Zustand store is clean — preserve it. Screen-based navigation is simple — preserve it. Voice.ts 6-provider fallback is robust — preserve it.

**Fix what leaks.** Every useEffect that creates a resource (interval, timeout, MediaRecorder, WSR) must clean it up. This is non-negotiable. recognitionRef.abort() in cleanup.

**Extract what repeats.** One back button component. One toast component. One glass card component. One voice recorder hook. Shared across all screens.

**Don't migrate what works.** Inline styles stay for now. Migrating to CSS modules is a v17+ concern. The priority is consistency (same values) not technology (same approach).

## Branding Philosophy

**"Abu" is the brand.** Every screen says "Abu [feature]" in the same size (28px Cormorant Garamond), same gradient (canonical gold), same position (center of sticky header). Home alone uses the full "AbuBank" at hero scale.

**Martita photo is the anchor.** Present in every header at 48px. Same gold border. Same position (left of wordmark in RTL). This is her app — her face should always be visible.

**Version badge:** Bottom-left corner, 10px font, 0.30 opacity. Same on every screen. Invisible unless looked for.

## Motion Philosophy

**Entry: staggered fade-up.** All content enters with opacity 0→1 + translateY 12→0, staggered at 0.05s intervals. Duration: 0.3s ease-out. This is the ONE entry animation used everywhere.

**Interaction: scale press.** Buttons scale to 0.95 on press. Duration: 0.1s. No other press effect.

**Loop: gentle pulse.** Recording indicators pulse at 1.2s. Voice mode orb pulses at 2s. Loading dots at 1.4s. These three are the only loop animations.

**Weather exception:** Weather keeps its atmospheric overlays (rain, snow, stars) because they serve data visualization, not decoration.

## State Clarity Philosophy

| State | Visual Treatment |
|-------|-----------------|
| Empty | Centered emoji (48px) + Hebrew text (16px, 0.70 opacity) + CTA button |
| Loading | 3 gold dots pulsing + Hebrew status text (16px) |
| Content | Normal render with staggered entry |
| Error | Gold-bordered card with ⚠️ emoji + Hebrew explanation + retry button |

Every screen. Every feature. No exceptions.

## Voice / AI Philosophy

**Martita is respected, never patronized.** The AI speaks to her as a smart friend, not a nurse. System prompts explicitly forbid condescending openers ("כמובן!", "בהחלט!"). This is preserved exactly as-is.

**WhatsApp message authenticity is sacred.** The 1,388-message training corpus with Martita's real typos ("מאכלת" instead of "מאחלת") is the app's crown jewel. Never simplify, never "fix" her voice.

**Voice mode is a conversation, not a command interface.** AbuAI voice mode loops naturally (listen→process→speak→listen). Exit keywords are natural Hebrew ("ביי", "תודה", "להתראות"). This flow is preserved.

**Bilingual is seamless.** Hebrew input → Hebrew response. Spanish input → Rioplatense Spanish response. Mixed → mixed. Language detection is heuristic-based and works. Don't over-engineer it.

**Speed matters.** Voice mode uses Groq (fastest) as primary provider, not OpenAI. TTS uses OpenAI HD (best quality). This priority split is correct and preserved.

## Senior Usability Philosophy

**Minimum font size: 14px.** Nothing smaller. Ever. Labels, timestamps, metadata — all 14px minimum.

**Minimum touch target: 48px.** Not 44px (WCAG minimum) — 48px. Martita's hands may tremble. Extra margin is cheap insurance.

**Minimum text opacity: 0.70.** Nothing more transparent on text. Sender labels, timestamps, hints — all at least 0.70 opacity against the dark background.

**Contrast ratio: 4.5:1 minimum.** All text must pass WCAG AA. No exceptions for "decorative" text — if Martita can read it, it must be readable.

**Cognitive load budget: 3.** Each screen presents a maximum of 3 primary actions above the fold. Secondary actions are below fold or in overflow.

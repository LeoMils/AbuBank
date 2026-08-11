# Abu-ela Design System

One system for the whole Abu family of apps — so it feels like **one product built
for one woman (Martita, 80)**, not seven separate screens. The identity is *abuela* —
grandmother: warm, dignified, a little celebratory. **Legible before beautiful:
accessibility IS the aesthetic here.**

## Principles (in priority order)

1. **Legible before beautiful.** Body text ≥ 16px, high contrast on the dark
   background, generous spacing, touch targets ≥ 56px. Nothing ships that a woman of
   80 cannot read at arm's length in daylight.
2. **Warm, joyful, colourful** — never clinical, never childish, never a
   medical-device look. She should feel *loved* when she opens it.
3. **Hebrew-first RTL.** Body/UI type is **Heebo** (a real Hebrew typeface with proper
   weights and numerals); the display accent is Cormorant Garamond (the "Abu-ela"
   wordmark only). All app screens are `dir="rtl"`.
4. **One system, not seven styles.** Shared palette, spacing scale, type scale, and
   Card / Button / Header components. Each app carries its own **accent colour**
   within the system.
5. **Restraint in motion.** Gentle transitions that aid orientation; nothing flashes
   or bounces.

## Tokens — `src/design/` (import from `src/design/tokens`)

| Group | File | What |
|---|---|---|
| Colour | `colors.ts` | `GOLD`, `TEAL`, `CREAM`, `TEXT_STRONG/MEDIUM/MUTED`, `SURFACE`, `GOLD_BORDER`, `SUCCESS/DANGER/WARNING` |
| Type | `typography.ts` | `FONT_BODY` (Heebo), `FONT_DISPLAY`, the `type.*` role scale (display/title/body/button/…), `SIZE_*` |
| Space | `space.ts` | `space` (4→48 scale), `radius` (sm→pill), `MIN_TOUCH` = **56**, `MIN_BODY_PX` = **16** |
| Surface | `glass.ts`, `gradients.ts` | glass surfaces + brand gradients |
| Motion | `animation.ts`, `animations.ts` | shared, gentle keyframes |

### Per-app accent colours

`ai #FCD34D · bank #5EEAD4 · calendar #C4B5FD · whatsapp #4ADE80 · games #FCA5A5 ·
weather #7DD3FC · news #FDBA74` — one hue per app, used for its header, tiles and
primary actions.

## Components — `src/components/ui/`

- **`ScreenHeader`** — the app header: an always-visible `BackButton` + the
  brand-family title (gold italic "Abu" + the app name), with an optional `right` slot.
- **`Card`** — the warm glass surface; pass `onClick` to make it a pressable ≥56px
  target with press feedback and a per-app accent.
- **`PrimaryButton`** — the senior-first primary action: ≥56px, large high-contrast
  type, soft radius, per-app accent.

## Adoption status

- **Reference app (fully in the system):** **Abu News** — `ScreenHeader`, `Card`,
  `PrimaryButton`, space/type/colour tokens.
- **Adopted `ScreenHeader`:** **Abu Bank**.
- **Hub tiles** are token-driven (accent colours + Phosphor icons).
- **Not yet migrated (rollout — do NOT assume done):** the Home brand hero, Abu AI /
  Calendar / WhatsApp / Games / Weather screens. Roll the shared components across
  these next; report before each wave.

## Rules for new/changed UI

- Import tokens from `src/design/tokens`; do not hard-code hex/spacing.
- Use `ScreenHeader` for any app screen inside the hub.
- Interactive elements ≥ `MIN_TOUCH` (56px); body text ≥ `MIN_BODY_PX` (16px).
- Always `dir="rtl"`; Hebrew via `FONT_BODY` (Heebo).

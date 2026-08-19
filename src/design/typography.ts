export const FONT_DISPLAY = "'Cormorant Garamond', Georgia, serif"
export const FONT_BODY = "'Heebo', sans-serif"
export const FONT_LABEL = "'DM Sans', sans-serif"

// Sizes bumped for readability on Martita's iPhone (Stage 7 — text was too small).
// Body/label/caption raised so critical text reads without zoom.
export const SIZE_DISPLAY_LG = 46
export const SIZE_DISPLAY = 30
export const SIZE_HEADING = 24
export const SIZE_SUBHEADING = 19
export const SIZE_BODY = 17
export const SIZE_LABEL = 16
export const SIZE_CAPTION = 15
export const SIZE_MICRO = 11

export const WEIGHT_DISPLAY = 600
export const WEIGHT_HEADING = 700
export const WEIGHT_SUBHEADING = 600
export const WEIGHT_BODY = 400
export const WEIGHT_LABEL = 600
export const WEIGHT_CAPTION = 500

// ─── Semantic typography tokens (rem-based → respects Dynamic Type) ──────────
// Prefer these for new/updated user-facing text: spread `type.<role>` into style.
// Operator/diagnostic text stays deliberately small (not user-critical).
const HEEBO = "'Heebo',sans-serif"
export const type = {
  display:      { fontSize: '2rem',      fontWeight: 800, lineHeight: 1.15, fontFamily: HEEBO },
  title:        { fontSize: '1.5rem',    fontWeight: 700, lineHeight: 1.25, fontFamily: HEEBO },
  sectionTitle: { fontSize: '1.1875rem', fontWeight: 600, lineHeight: 1.3,  fontFamily: HEEBO },
  body:         { fontSize: '1.0625rem', fontWeight: 400, lineHeight: 1.6,  fontFamily: HEEBO },
  chat:         { fontSize: '1.125rem',  fontWeight: 400, lineHeight: 1.7,  fontFamily: HEEBO },
  button:       { fontSize: '1.125rem',  fontWeight: 700, lineHeight: 1.2,  fontFamily: HEEBO },
  input:        { fontSize: '1.0625rem', fontWeight: 400, lineHeight: 1.5,  fontFamily: HEEBO },
  helper:       { fontSize: '0.9375rem', fontWeight: 400, lineHeight: 1.55, fontFamily: HEEBO },
  caption:      { fontSize: '0.875rem',  fontWeight: 500, lineHeight: 1.45, fontFamily: HEEBO },
  error:        { fontSize: '0.9375rem', fontWeight: 600, lineHeight: 1.5,  fontFamily: HEEBO },
  diagnostic:   { fontSize: '0.72rem',   fontWeight: 400, lineHeight: 1.6,  fontFamily: 'ui-monospace,Menlo,monospace' },
} as const
export type TypeRole = keyof typeof type

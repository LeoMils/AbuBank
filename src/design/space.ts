/*
 * space.ts — the spacing, radius and touch-target scale for the Abu-ela system.
 * ════════════════════════════════════════════════════════════════════════════
 * One scale, used everywhere, so seven apps share one rhythm instead of ad-hoc
 * pixel values. Senior-first is baked in: MIN_TOUCH is 56px (not 44), because the
 * user is 80 — accessibility IS the aesthetic here.
 */

/** 4px base spacing scale. Use these for padding, gaps and margins. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const

/** Corner radii — soft, warm, never sharp/clinical. */
export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 999,
} as const

/** Minimum interactive target. 56px per the senior-first rule (≥ 48, recommended 56). */
export const MIN_TOUCH = 56

/** Minimum readable body text for an 80-year-old at arm's length. */
export const MIN_BODY_PX = 16

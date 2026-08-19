/*
 * introTiming.ts — the single source of truth for the cold-open intro budget.
 * Kept separate (pure) so the timing contract is unit-testable and the CSS +
 * the orchestrator + the sound all read the same numbers.
 */
export const INTRO = {
  /** Handwritten stroke-by-stroke reveal duration. */
  drawMs: 1500,
  /** Beat the finished signature rests before handing off to auth. */
  holdMs: 380,
  /** Cross-fade out of the splash. */
  fadeMs: 300,
  /** Reduced-motion: no draw — the word is shown, held briefly, then fades. */
  reducedHoldMs: 620,
} as const

/** Total wall-time of the intro, honoring reduced-motion. Target window: 1.4–2.2s. */
export function introTotalMs(reducedMotion: boolean): number {
  return reducedMotion
    ? INTRO.reducedHoldMs + INTRO.fadeMs
    : INTRO.drawMs + INTRO.holdMs + INTRO.fadeMs
}

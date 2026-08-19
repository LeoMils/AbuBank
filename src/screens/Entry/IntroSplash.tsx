import { useEffect, useRef, useState } from 'react'
import { INTRO, introTotalMs } from './introTiming'
import { playIntroSound } from './introSound'
import { IntroSignature } from './IntroSignature'
import styles from './IntroSplash.module.css'

interface IntroSplashProps {
  /** Called once the reveal + rest + fade have completed. */
  onDone: () => void
  /** Test/e2e hook to force reduced-motion (bypasses matchMedia). */
  forceReducedMotion?: boolean
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * The cold-open, black-luxury brand reveal: "Abu Ela" written left-to-right on a
 * warm matte black, with a soft champagne ink-gleam and a restrained finishing
 * sound. No hand, no pen. Honors reduced-motion (shows the finished word, no
 * draw, no sound) and always calls `onDone` — it can never trap the user.
 */
export function IntroSplash({ onDone, forceReducedMotion }: IntroSplashProps) {
  const [leaving, setLeaving] = useState(false)
  const reduced = forceReducedMotion ?? prefersReducedMotion()
  const doneRef = useRef(false)

  useEffect(() => {
    const total = introTotalMs(reduced)
    const cancelSound = reduced ? () => {} : playIntroSound(INTRO.drawMs)

    // Begin the fade slightly before the end so the cross-fade lands on `onDone`.
    const fadeAt = Math.max(0, total - INTRO.fadeMs)
    const fadeTimer = window.setTimeout(() => setLeaving(true), fadeAt)
    const doneTimer = window.setTimeout(() => {
      if (doneRef.current) return
      doneRef.current = true
      onDone()
    }, total)

    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(doneTimer)
      cancelSound()
    }
    // Intentionally run once — the intro is a one-shot cold-open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rootStyle = {
    // Expose the timing to CSS so animation + component agree on one budget.
    ['--intro-draw' as string]: `${INTRO.drawMs}ms`,
    ['--intro-fade' as string]: `${INTRO.fadeMs}ms`,
  } as React.CSSProperties

  return (
    <div
      className={`${styles.root} ${leaving ? styles.leaving : ''} ${reduced ? styles.reduced : ''}`}
      style={rootStyle}
      data-testid="intro-splash"
    >
      <div className={styles.grain} aria-hidden="true" />
      <div className={styles.brandWrap}>
        <IntroSignature drawMs={INTRO.drawMs} reduced={reduced} />
      </div>
    </div>
  )
}

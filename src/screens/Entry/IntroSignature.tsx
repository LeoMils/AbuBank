import styles from './IntroSignature.module.css'

/**
 * The Abu Ela signature — a purpose-built calligraphic vector, drawn stroke by
 * stroke via stroke-dashoffset (no font dependency). Each stroke is normalized
 * (pathLength=1) and revealed in true writing order, so the word appears to be
 * written by hand rather than wiped in. Extremely thin, warm champagne, calm.
 *
 * Coordinates live in a 560×180 canvas, baseline ~132, centered by the viewBox.
 */

interface Stroke {
  d: string
  /** [start, end] as fractions of the total draw, in writing order. */
  span: [number, number]
}

// Two capitals (A, E) + lowercase b u / l a, each as connected thin strokes.
const STROKES: Stroke[] = [
  // A — left leg sweeping up to the apex, then down the right leg
  { d: 'M40 138 C 58 92 74 50 88 49 C 100 48 108 82 116 112 C 121 130 125 138 130 140', span: [0.0, 0.16] },
  // A — crossbar, a soft dipping tie
  { d: 'M66 112 C 84 121 104 121 122 111', span: [0.16, 0.24] },
  // b — tall stem
  { d: 'M150 44 C 149 88 148 118 151 140', span: [0.24, 0.34] },
  // b — bowl
  { d: 'M150 108 C 172 100 192 112 192 124 C 192 138 171 147 150 140', span: [0.34, 0.45] },
  // u — left arc into the cup
  { d: 'M208 90 C 206 118 212 140 228 141 C 240 142 248 127 249 104', span: [0.45, 0.55] },
  // u — right stem + exit tail
  { d: 'M249 90 C 248 116 250 133 258 142 C 262 147 269 146 275 139', span: [0.55, 0.63] },
  // E — epsilon-style capital, one continuous stroke
  { d: 'M356 70 C 340 49 314 55 312 78 C 310 97 333 103 347 96 C 330 107 313 126 322 143 C 330 158 356 157 370 141', span: [0.63, 0.8] },
  // l — tall looped stem
  { d: 'M404 44 C 401 88 400 118 404 140 C 406 150 416 150 424 141', span: [0.8, 0.88] },
  // a — bowl
  { d: 'M470 90 C 451 86 438 105 440 124 C 442 141 461 149 474 139', span: [0.88, 0.95] },
  // a — stem + exit tail
  { d: 'M474 90 C 473 116 475 134 483 143 C 487 148 495 147 501 140', span: [0.95, 1.0] },
]

interface IntroSignatureProps {
  /** Total stroke-writing duration in ms. */
  drawMs: number
  /** Reduced-motion: render the finished signature, no drawing. */
  reduced?: boolean
}

export function IntroSignature({ drawMs, reduced }: IntroSignatureProps) {
  return (
    <svg
      className={styles.svg}
      viewBox="20 20 520 150"
      role="img"
      aria-label="Abu Ela"
      preserveAspectRatio="xMidYMid meet"
    >
      <g className={styles.ink}>
        {STROKES.map((s, i) => {
          const [start, end] = s.span
          const style = reduced
            ? { strokeDashoffset: 0 }
            : {
                animationDuration: `${Math.max(60, (end - start) * drawMs)}ms`,
                animationDelay: `${start * drawMs}ms`,
              }
          return (
            <path
              key={i}
              d={s.d}
              className={reduced ? styles.strokeDone : styles.stroke}
              pathLength={1}
              style={style as React.CSSProperties}
            />
          )
        })}
      </g>
    </svg>
  )
}

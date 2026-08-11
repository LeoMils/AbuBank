/*
 * AbuPresence — Abu's living presence on the Abu AI screen (M5, STEP 1).
 * ════════════════════════════════════════════════════════════════════════════
 * The ANIMATION layer. It owns the life — amplitude-driven mouth, natural blink,
 * breathing, and a state aura — and drives the dumb character (AbuCharacterA)
 * through its asset-agnostic prop contract (mouth 0..1, eyesClosed 0..1). Swapping
 * in a commissioned illustration = replace AbuCharacterA's SVG; THIS file is unchanged.
 *
 * The mouth moves because she is truly speaking: `amplitude` is the live RMS of
 * her output audio (services/outputAmplitude, read in one rAF by the screen).
 * Graceful degrade: if `amplitude` is undefined while speaking, a gentle mouth
 * loop stands in so she never looks frozen mid-sentence.
 *
 * ── Frame cost (design budget; real fps is DEVICE-measured, not claimed here) ──
 *   • Mouth: re-renders only when `amplitude` changes (the screen's single rAF,
 *     ~30–60 Hz while speaking). Idle/listening/thinking: no per-frame renders.
 *   • Blink: one setTimeout every ~3–6 s toggling a boolean (2 renders per blink).
 *   • Breathe + aura ripple/shimmer: pure CSS keyframes → GPU-composited, 0 JS/frame.
 *   • Degrade loop: a ~50 ms interval ONLY when speaking with no analyser.
 */
import { useEffect, useRef, useState } from 'react'
import { AbuCharacterA } from './AbuCharacterA'

export type PresenceState = 'listening' | 'thinking' | 'speaking' | 'waiting'

export interface AbuPresenceProps {
  state: PresenceState
  /** Live output-audio loudness 0..1. Undefined ⇒ no analyser ⇒ degrade loop. */
  amplitude?: number | undefined
  /** Character box size in px (default fits the presence panel). */
  size?: number
}

/** Amplitude → mouth openness, with a mild gamma so quiet speech still parts the lips. */
const mouthFromAmplitude = (amp: number) => Math.min(1, Math.pow(Math.max(0, amp), 0.7) * 1.15)

/** The loudness below which the analyser is considered to be producing no real signal. */
export const SIGNAL_FLOOR = 0.05

/**
 * Whether to drive the mouth from the fallback loop instead of real amplitude. TRUE when
 * she is speaking AND either there is no analyser at all (amplitude undefined) OR the
 * analyser is DEAD — the iOS Safari case where a WebRTC remote stream reads as a defined
 * 0. Pure so the device-critical rule is unit-tested without a DOM/timer. */
export function shouldDegradeMouth(state: PresenceState, amplitude: number | undefined, analyserDead: boolean): boolean {
  return state === 'speaking' && (amplitude === undefined || analyserDead)
}

/** The state aura — a semantic accent glow (NOT a page background). */
const AURA: Record<PresenceState, string> = {
  listening: '#5EEAD4', // teal — I'm hearing you
  thinking: '#E8B563',  // amber — I'm considering
  speaking: '#F0C070',  // gold — I'm talking
  waiting: '#7DD3FC',   // calm blue — take your time
}

const HE_STATE: Record<PresenceState, string> = {
  listening: 'מקשיבה',
  thinking: 'חושבת',
  speaking: 'מדברת',
  waiting: 'מוכנה',
}

export function AbuPresence({ state, amplitude, size = 260 }: AbuPresenceProps) {
  const [eyesClosed, setEyesClosed] = useState(0)
  const [loopMouth, setLoopMouth] = useState(0)

  // Natural blink: lower the lids for ~120 ms every 3–6 s, on a self-rescheduling
  // timer so the rhythm is irregular (a metronome blink reads as uncanny).
  useEffect(() => {
    let openTimer: ReturnType<typeof setTimeout>
    let closeTimer: ReturnType<typeof setTimeout>
    const scheduleBlink = () => {
      const delay = 3000 + Math.random() * 3000
      openTimer = setTimeout(() => {
        setEyesClosed(1)
        closeTimer = setTimeout(() => { setEyesClosed(0); scheduleBlink() }, 120)
      }, delay)
    }
    scheduleBlink()
    return () => { clearTimeout(openTimer); clearTimeout(closeTimer) }
  }, [])

  // Degrade loop trigger. On iOS Safari the WebAudio analyser reads a WebRTC remote
  // stream as SILENCE (a defined 0, not undefined) — so the mouth would sit shut through
  // a whole spoken turn while only the eyes blink (device defect 4). So we do NOT rely on
  // `amplitude === undefined`: we detect a DEAD analyser — speaking with no real signal
  // shortly after she starts — and fall back to the loop. A working analyser (any signal
  // above the floor) keeps driving the mouth from real loudness.
  const seenSignalRef = useRef(false)
  const [analyserDead, setAnalyserDead] = useState(false)

  useEffect(() => {
    if (state !== 'speaking') { seenSignalRef.current = false; setAnalyserDead(false); return }
    seenSignalRef.current = false
    setAnalyserDead(false)
    // Grace window: if no real loudness arrives soon after she starts speaking, the
    // analyser is unavailable on this device → animate from the speaking state instead.
    const t = setTimeout(() => { if (!seenSignalRef.current) setAnalyserDead(true) }, 450)
    return () => clearTimeout(t)
  }, [state])

  useEffect(() => {
    if (state === 'speaking' && amplitude !== undefined && amplitude > SIGNAL_FLOOR) {
      seenSignalRef.current = true
      if (analyserDead) setAnalyserDead(false) // real audio recovered — use it
    }
  }, [amplitude, state, analyserDead])

  const degrade = shouldDegradeMouth(state, amplitude, analyserDead)
  const phase = useRef(0)
  useEffect(() => {
    if (!degrade) { setLoopMouth(0); return }
    const id = setInterval(() => {
      phase.current += 0.5
      // Two summed sines → a natural, non-repetitive mouth movement.
      const v = (Math.sin(phase.current) + Math.sin(phase.current * 0.53 + 1)) / 2
      setLoopMouth(0.25 + Math.max(0, v) * 0.55)
    }, 55)
    return () => clearInterval(id)
  }, [degrade])

  const mouth =
    state === 'speaking'
      ? (degrade ? loopMouth : mouthFromAmplitude(amplitude ?? 0))
      : 0

  const aura = AURA[state]

  return (
    <div
      data-testid="abu-presence"
      data-state={state}
      style={{ position: 'relative', width: size, height: (size * 400) / 360, display: 'grid', placeItems: 'center' }}
    >
      <style>{PRESENCE_KEYFRAMES}</style>

      {/* State aura — colour-coded AND labelled below (never colour-only). */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: '-14% -18%',
          borderRadius: '50%',
          background: `radial-gradient(circle at 50% 42%, ${aura}55 0%, ${aura}18 45%, transparent 72%)`,
          animation:
            state === 'speaking' ? 'abu-ripple 1.6s ease-in-out infinite'
            : state === 'thinking' ? 'abu-shimmer 2.4s ease-in-out infinite'
            : state === 'listening' ? 'abu-breathe-glow 3s ease-in-out infinite'
            : 'none',
          filter: 'blur(2px)',
          pointerEvents: 'none',
        }}
      />

      {/* Breathing wrapper (shoulders anchored) → GPU-composited scale. */}
      <div style={{ animation: 'abu-breathe 4.6s ease-in-out infinite', transformOrigin: '50% 100%' }}>
        <AbuCharacterA mouth={mouth} eyesClosed={eyesClosed} size={size} />
      </div>

      {/* Hidden accessible state label; the visible one lives in the screen chrome. */}
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {HE_STATE[state]}
      </span>
    </div>
  )
}

const PRESENCE_KEYFRAMES = `
@keyframes abu-breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.02); } }
@keyframes abu-ripple { 0%,100% { opacity: 0.75; transform: scale(1); } 50% { opacity: 1; transform: scale(1.06); } }
@keyframes abu-shimmer { 0%,100% { opacity: 0.55; } 50% { opacity: 0.9; } }
@keyframes abu-breathe-glow { 0%,100% { opacity: 0.6; } 50% { opacity: 0.85; } }
@media (prefers-reduced-motion: reduce) {
  [data-testid="abu-presence"] * { animation: none !important; }
}
`

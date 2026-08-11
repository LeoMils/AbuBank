/*
 * useOutputAmplitude — one rAF loop reading Abu's live output loudness for the mouth.
 * ════════════════════════════════════════════════════════════════════════════
 * Given the primed AudioContext (unlocked inside the start tap) and the realtime
 * remote MediaStream (exposed by liveSession.onRemoteStream), this attaches ONE
 * analyser and reads a smoothed RMS amplitude each animation frame. The value is
 * fed to AbuPresence.amplitude, so the mouth moves because she is truly speaking.
 *
 * Graceful degrade: if either input is missing (no WebAudio, or the stream has not
 * arrived yet) it returns `undefined`, and AbuPresence falls back to a gentle mouth
 * loop. A single rAF, cancelled on cleanup; the analyser is disconnected on unmount.
 */
import { useEffect, useState } from 'react'
import { createAmplitudeReader, type AudioCtxLike } from '../../../services/outputAmplitude'

// The real AudioContext structurally satisfies the analyser seam; the cast keeps the
// engine testable with lightweight fakes (outputAmplitude.test) while the hook takes
// the genuine browser context.
export function useOutputAmplitude(ctx: AudioContext | null, stream: MediaStream | null): number | undefined {
  const [amplitude, setAmplitude] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (!ctx || !stream) { setAmplitude(undefined); return }
    let raf = 0
    let reader: ReturnType<typeof createAmplitudeReader> | null = null
    try {
      reader = createAmplitudeReader(ctx as unknown as AudioCtxLike, stream)
    } catch {
      setAmplitude(undefined)
      return
    }
    const tick = () => {
      setAmplitude(reader!.read())
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); reader?.stop() }
  }, [ctx, stream])

  return amplitude
}

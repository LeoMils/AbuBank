/*
 * outputAmplitude.ts — read the REAL loudness of Abu's output audio (M5, STEP 1).
 * ════════════════════════════════════════════════════════════════════════════
 * The mouth moves because she is truly speaking: an AnalyserNode on the realtime
 * remote stream gives a live RMS amplitude 0..1 that AbuPresence maps to a mouth
 * viseme. Pure + injectable (no React, no device) so it is unit-testable — the React
 * screen (STEP 2) just calls createAmplitudeReader(ctx, remoteStream) and reads() in
 * one requestAnimationFrame loop. Graceful degrade: if the stream/ctx is unavailable
 * the screen simply omits the reader and AbuPresence falls back to a speaking loop.
 */

/** Minimal shapes so this is testable without the DOM's full WebAudio types. */
export interface AnalyserLike { fftSize: number; getByteTimeDomainData(a: Uint8Array): void }
export interface AudioCtxLike {
  createMediaStreamSource(s: MediaStream): { connect(n: AnalyserLike): void; disconnect(): void }
  createAnalyser(): AnalyserLike
}

export interface AmplitudeReader {
  /** Current smoothed amplitude, 0 (silence) .. 1 (loud). */
  read(): number
  stop(): void
}

/** Attach an analyser to the stream and return a live amplitude reader. */
export function createAmplitudeReader(ctx: AudioCtxLike, stream: MediaStream, opts: { smoothing?: number; gain?: number } = {}): AmplitudeReader {
  const smoothing = opts.smoothing ?? 0.4
  const gain = opts.gain ?? 2.5
  const source = ctx.createMediaStreamSource(stream)
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 256
  source.connect(analyser)
  const buf = new Uint8Array(analyser.fftSize)
  let smoothed = 0
  return {
    read() {
      analyser.getByteTimeDomainData(buf)
      let sum = 0
      for (let i = 0; i < buf.length; i++) { const v = (buf[i]! - 128) / 128; sum += v * v }
      const rms = Math.sqrt(sum / buf.length)
      const level = Math.max(0, Math.min(1, rms * gain))
      smoothed = smoothed * smoothing + level * (1 - smoothing)
      return smoothed
    },
    stop() { try { source.disconnect() } catch { /* already gone */ } },
  }
}

/** Map an amplitude 0..1 to a mouth viseme the character exposes. */
export type Viseme = 'closed' | 'mid' | 'open'
export function amplitudeToViseme(amp: number): Viseme {
  if (amp < 0.12) return 'closed'
  if (amp < 0.4) return 'mid'
  return 'open'
}

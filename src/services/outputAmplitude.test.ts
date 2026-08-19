/*
 * outputAmplitude.test.ts — the amplitude engine drives the mouth from REAL audio (CODE).
 * Injects a fake analyser so no device/WebAudio is needed.
 */
import { describe, it, expect } from 'vitest'
import { createAmplitudeReader, amplitudeToViseme, type AudioCtxLike, type AnalyserLike } from './outputAmplitude'

/** A fake ctx whose analyser fills the buffer with a sine of the given peak (0..1). */
function fakeCtx(peak: number): { ctx: AudioCtxLike; disconnected: () => boolean } {
  let disconnected = false
  const analyser: AnalyserLike = {
    fftSize: 256,
    getByteTimeDomainData(a: Uint8Array) { for (let i = 0; i < a.length; i++) a[i] = Math.round(128 + Math.sin(i / 4) * 127 * peak) },
  }
  const ctx: AudioCtxLike = {
    createAnalyser: () => analyser,
    createMediaStreamSource: () => ({ connect: () => {}, disconnect: () => { disconnected = true } }),
  }
  return { ctx, disconnected: () => disconnected }
}

describe('createAmplitudeReader', () => {
  it('reads ~0 for silence and a clearly higher value for loud audio', () => {
    const silent = createAmplitudeReader(fakeCtx(0).ctx, {} as MediaStream)
    for (let i = 0; i < 10; i++) silent.read()
    expect(silent.read()).toBeLessThan(0.05)

    const loud = createAmplitudeReader(fakeCtx(1).ctx, {} as MediaStream)
    for (let i = 0; i < 10; i++) loud.read() // let the smoothing settle
    expect(loud.read()).toBeGreaterThan(0.4)
  })

  it('stop() disconnects the source (cleanup)', () => {
    const f = fakeCtx(0.5)
    const r = createAmplitudeReader(f.ctx, {} as MediaStream)
    r.stop()
    expect(f.disconnected()).toBe(true)
  })
})

describe('amplitudeToViseme — mouth shape from loudness', () => {
  it('maps silence→closed, medium→mid, loud→open', () => {
    expect(amplitudeToViseme(0)).toBe('closed')
    expect(amplitudeToViseme(0.05)).toBe('closed')
    expect(amplitudeToViseme(0.25)).toBe('mid')
    expect(amplitudeToViseme(0.7)).toBe('open')
  })
})

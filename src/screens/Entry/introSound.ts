/*
 * introSound.ts — the intro's premium sound design, synthesized (no assets).
 * ════════════════════════════════════════════════════════════════════════════
 * Three restrained layers, boutique not gaming:
 *   1. a soft ink/brush texture (low-passed noise) that swells with the writing,
 *   2. a subtle airy tonal pad (a quiet, warm major-third drone),
 *   3. a tiny elegant finishing chime as the word completes.
 * Everything is very quiet and fire-and-forget. If the browser blocks autoplay
 * (a cold launch has no user gesture yet) the AudioContext stays suspended and
 * this is silently inaudible — the visual intro is never blocked on audio.
 *
 * Follows the repo's existing WebAudio idiom (see reminders/reminderSound.ts).
 */

/** Play the intro sound over `totalMs`. Returns a cancel fn (tears down the graph). */
export function playIntroSound(totalMs = 1500): () => void {
  const noop = () => {}
  let ctx: AudioContext | null = null
  try {
    const Ctx: typeof AudioContext | undefined =
      typeof AudioContext !== 'undefined'
        ? AudioContext
        : (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return noop
    ctx = new Ctx()
    // Best-effort resume; if there is no gesture yet this stays suspended → silent.
    if (ctx.state === 'suspended') void ctx.resume()

    const now = ctx.currentTime
    const dur = Math.max(0.4, totalMs / 1000)

    const master = ctx.createGain()
    master.gain.value = 0.85
    master.connect(ctx.destination)

    // 1) airy tonal bed — almost inaudible warm fifth (A2 + E3), slow swell.
    for (const [i, f] of [110, 164.81].entries()) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const g = ctx.createGain()
      const peak = 0.03 - i * 0.012
      g.gain.setValueAtTime(0.0001, now)
      g.gain.linearRampToValueAtTime(peak, now + 0.6)
      g.gain.setValueAtTime(peak, now + dur - 0.3)
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.3)
      o.connect(g)
      g.connect(master)
      o.start(now)
      o.stop(now + dur + 0.35)
    }

    // 2) ink/brush texture — band-passed noise, a soft dry whisper under the strokes.
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate)
    const chd = buf.getChannelData(0)
    for (let i = 0; i < chd.length; i++) chd[i] = (Math.random() * 2 - 1) * 0.5
    const noise = ctx.createBufferSource()
    noise.buffer = buf
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 2600
    bp.Q.value = 0.7
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.0001, now)
    ng.gain.linearRampToValueAtTime(0.016, now + 0.25)
    ng.gain.linearRampToValueAtTime(0.012, now + dur - 0.25)
    ng.gain.exponentialRampToValueAtTime(0.0001, now + dur)
    noise.connect(bp)
    bp.connect(ng)
    ng.connect(master)
    noise.start(now)
    noise.stop(now + dur)

    // 3) completion signature — ONE refined soft bell (F#5) with a whisper of its
    //    octave, a graceful long decay. The luxury "signature moment", never a chime.
    const sigAt = now + dur - 0.02
    for (const [i, f] of [739.99, 1479.98].entries()) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const g = ctx.createGain()
      const peak = 0.06 - i * 0.045
      g.gain.setValueAtTime(0.0001, sigAt)
      g.gain.linearRampToValueAtTime(peak, sigAt + 0.03)
      g.gain.exponentialRampToValueAtTime(0.0001, sigAt + 1.35)
      o.connect(g)
      g.connect(master)
      o.start(sigAt)
      o.stop(sigAt + 1.45)
    }
  } catch {
    return noop
  }

  return () => {
    try {
      ctx?.close()
    } catch {
      /* ok */
    }
  }
}

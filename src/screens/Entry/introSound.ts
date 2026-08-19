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
export function playIntroSound(totalMs = 1400): () => void {
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
    master.gain.value = 0.9 // overall ceiling — the layer gains below are already low
    master.connect(ctx.destination)

    // 1) airy tonal pad — a warm, quiet major third (A3 + C#4), slow in/out.
    for (const [i, f] of [220, 277.18].entries()) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, now)
      g.gain.linearRampToValueAtTime(0.05 - i * 0.015, now + 0.45)
      g.gain.setValueAtTime(0.05 - i * 0.015, now + dur - 0.25)
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.25)
      o.connect(g)
      g.connect(master)
      o.start(now)
      o.stop(now + dur + 0.3)
    }

    // 2) ink/brush texture — low-passed noise that swells with the stroke.
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate)
    const ch = buf.getChannelData(0)
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * 0.5
    const noise = ctx.createBufferSource()
    noise.buffer = buf
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1100
    lp.Q.value = 0.25
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.0001, now)
    ng.gain.linearRampToValueAtTime(0.028, now + 0.22)
    ng.gain.linearRampToValueAtTime(0.018, now + dur - 0.22)
    ng.gain.exponentialRampToValueAtTime(0.0001, now + dur)
    noise.connect(lp)
    lp.connect(ng)
    ng.connect(master)
    noise.start(now)
    noise.stop(now + dur)

    // 3) finishing chime — a soft bell (A5 + a quiet E6 shimmer) as the word rests.
    const chimeAt = now + dur - 0.04
    for (const [i, f] of [880, 1318.51].entries()) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, chimeAt)
      g.gain.linearRampToValueAtTime(0.075 - i * 0.04, chimeAt + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, chimeAt + 0.9)
      o.connect(g)
      g.connect(master)
      o.start(chimeAt)
      o.stop(chimeAt + 1.0)
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

/*
 * liveSessionReplay.ts — Milestone 1 replay harness.
 * ══════════════════════════════════════════════════
 * The one asset that pays off for every later milestone: substitute the live mic
 * track with a MediaStreamTrack sourced from a recorded Hebrew WAV, so
 * comprehension and turn-taking can be tested repeatably in a browser WITHOUT
 * Martita present.
 *
 * Usage:
 *   const track = await createReplayMicTrack('/replay/he-01.wav')
 *   const session = new LiveSession(cb, convId, false, { micTrackOverride: () => track })
 *
 * The track is a real, live MediaStreamTrack (an AudioBuffer played into a
 * MediaStreamAudioDestinationNode), so it flows through the exact same
 * pc.addTrack path a real mic would.
 */

/**
 * Decode a WAV URL and return a live audio MediaStreamTrack that plays it once.
 * Optionally loop for longer turn-taking scenarios.
 */
export async function createReplayMicTrack(
  wavUrl: string,
  opts: { loop?: boolean; audioContext?: AudioContext } = {},
): Promise<MediaStreamTrack> {
  const Ctor = (globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
  const C = Ctor.AudioContext ?? Ctor.webkitAudioContext
  if (!C) throw new Error('REPLAY_NO_AUDIOCONTEXT')
  const ctx = opts.audioContext ?? new C()
  await (ctx as unknown as { resume?: () => Promise<void> }).resume?.()

  const res = await fetch(wavUrl)
  if (!res.ok) throw new Error(`REPLAY_WAV_HTTP_${res.status}`)
  const arrayBuf = await res.arrayBuffer()
  const audioBuf = await ctx.decodeAudioData(arrayBuf)

  const source = ctx.createBufferSource()
  source.buffer = audioBuf
  source.loop = !!opts.loop
  const dest = ctx.createMediaStreamDestination()
  source.connect(dest)
  source.start(0)

  const track = dest.stream.getAudioTracks()[0]
  if (!track) throw new Error('REPLAY_NO_TRACK')
  return track
}

/** Build a micTrackOverride for LiveSession.deps from an already-created track. */
export function replayMicOverride(track: MediaStreamTrack): () => MediaStreamTrack {
  return () => track
}

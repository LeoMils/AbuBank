export function getSupportedMimeType(): string {
  const types = [
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
  ]
  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }
  return ''
}

export interface RecordingRefs {
  recorder: MediaRecorder | null
  chunks: Blob[]
  stream: MediaStream | null
  silenceDetector: { stop: () => void; getLevel: () => number } | null
  levelInterval: ReturnType<typeof setInterval> | null
}

export function createRecordingRefs(): RecordingRefs {
  return { recorder: null, chunks: [], stream: null, silenceDetector: null, levelInterval: null }
}

export async function startMicStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  })
}

export function createRecorder(stream: MediaStream): MediaRecorder {
  const mimeType = getSupportedMimeType()
  return mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream)
}

export function assembleBlob(chunks: Blob[], recorder: MediaRecorder): Blob {
  const mimeType = getSupportedMimeType()
  const actualType = recorder.mimeType || mimeType || 'audio/mp4'
  return new Blob(chunks, { type: actualType })
}

export function cleanupStream(refs: RecordingRefs): void {
  if (refs.levelInterval) { clearInterval(refs.levelInterval); refs.levelInterval = null }
  refs.silenceDetector?.stop()
  refs.silenceDetector = null
  if (refs.stream) {
    try { refs.stream.getTracks().forEach(t => t.stop()) } catch {}
    refs.stream = null
  }
  if (refs.recorder?.state === 'recording') {
    try { refs.recorder.stop() } catch {}
  }
  refs.recorder = null
}

export interface IndividualRefs {
  recorderRef: { current: MediaRecorder | null }
  streamRef: { current: MediaStream | null }
  silenceRef: { current: { stop: () => void } | null }
  levelRef: { current: ReturnType<typeof setInterval> | null }
}

export function cleanupIndividualRefs(refs: IndividualRefs): void {
  if (refs.levelRef.current) { clearInterval(refs.levelRef.current); refs.levelRef.current = null }
  if (refs.silenceRef.current) { try { refs.silenceRef.current.stop() } catch {}; refs.silenceRef.current = null }
  if (refs.streamRef.current) {
    try { refs.streamRef.current.getTracks().forEach(t => t.stop()) } catch {}
    refs.streamRef.current = null
  }
  if (refs.recorderRef.current?.state === 'recording') {
    try { refs.recorderRef.current.stop() } catch {}
  }
  refs.recorderRef.current = null
}

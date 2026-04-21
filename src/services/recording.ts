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
  if (refs.stream) { refs.stream.getTracks().forEach(t => t.stop()); refs.stream = null }
  if (refs.recorder?.state === 'recording') refs.recorder.stop()
  refs.recorder = null
}

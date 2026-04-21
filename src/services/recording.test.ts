import { describe, it, expect, vi } from 'vitest'
import { getSupportedMimeType, createRecordingRefs, assembleBlob, cleanupIndividualRefs } from './recording'

describe('getSupportedMimeType', () => {
  it('returns a string', () => {
    expect(typeof getSupportedMimeType()).toBe('string')
  })
})

describe('createRecordingRefs', () => {
  it('returns all fields initialized to null/empty', () => {
    const refs = createRecordingRefs()
    expect(refs.recorder).toBeNull()
    expect(refs.chunks).toEqual([])
    expect(refs.stream).toBeNull()
    expect(refs.silenceDetector).toBeNull()
    expect(refs.levelInterval).toBeNull()
  })
})

describe('assembleBlob', () => {
  it('creates a blob from chunks', () => {
    const chunk1 = new Blob(['hello'], { type: 'audio/webm' })
    const chunk2 = new Blob([' world'], { type: 'audio/webm' })
    const mockRecorder = { mimeType: 'audio/webm' } as MediaRecorder
    const blob = assembleBlob([chunk1, chunk2], mockRecorder)
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
    expect(blob.type).toBe('audio/webm')
  })

  it('falls back to audio/mp4 when recorder has no mimeType', () => {
    const chunk = new Blob(['data'], { type: 'audio/mp4' })
    const mockRecorder = { mimeType: '' } as MediaRecorder
    const blob = assembleBlob([chunk], mockRecorder)
    expect(blob.type).toMatch(/audio/)
  })

  it('handles empty chunks array', () => {
    const mockRecorder = { mimeType: 'audio/webm' } as MediaRecorder
    const blob = assembleBlob([], mockRecorder)
    expect(blob.size).toBe(0)
  })
})

describe('cleanupIndividualRefs', () => {
  it('clears all refs', () => {
    const stopTrack = vi.fn()
    const stopDetector = vi.fn()
    const refs = {
      recorderRef: { current: { state: 'recording', stop: vi.fn() } as any },
      streamRef: { current: { getTracks: () => [{ stop: stopTrack }] } as any },
      silenceRef: { current: { stop: stopDetector } },
      levelRef: { current: setInterval(() => {}, 1000) },
    }
    cleanupIndividualRefs(refs)
    expect(refs.streamRef.current).toBeNull()
    expect(refs.silenceRef.current).toBeNull()
    expect(refs.levelRef.current).toBeNull()
    expect(refs.recorderRef.current).toBeNull()
    expect(stopTrack).toHaveBeenCalled()
    expect(stopDetector).toHaveBeenCalled()
  })

  it('is safe to call with all nulls', () => {
    const refs = {
      recorderRef: { current: null },
      streamRef: { current: null },
      silenceRef: { current: null },
      levelRef: { current: null },
    }
    expect(() => cleanupIndividualRefs(refs)).not.toThrow()
  })

  it('is safe to call twice', () => {
    const refs = {
      recorderRef: { current: { state: 'inactive', stop: vi.fn() } as any },
      streamRef: { current: { getTracks: () => [{ stop: vi.fn() }] } as any },
      silenceRef: { current: { stop: vi.fn() } },
      levelRef: { current: setInterval(() => {}, 1000) },
    }
    cleanupIndividualRefs(refs)
    expect(() => cleanupIndividualRefs(refs)).not.toThrow()
    expect(refs.streamRef.current).toBeNull()
  })
})

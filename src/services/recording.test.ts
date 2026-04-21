import { describe, it, expect } from 'vitest'
import { getSupportedMimeType, createRecordingRefs, assembleBlob } from './recording'

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

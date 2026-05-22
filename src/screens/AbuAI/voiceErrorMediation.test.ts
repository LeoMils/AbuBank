import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const SRC = fs.readFileSync(path.resolve(__dirname, 'index.tsx'), 'utf8')

describe('AbuAI voice error mediation wiring', () => {
  it('imports shared mediateVoiceCaptureError helper', () => {
    expect(SRC.includes("import { mediateVoiceCaptureError } from '../../services/errorMediation'"))
      .toBe(true)
  })

  it('manual recording start path uses mediated mic message', () => {
    expect(SRC.includes("mediateVoiceCaptureError(err, 'permission_or_device')")).toBe(true)
  })

  it('voice transcription fallback path uses mediated transcription message', () => {
    expect(SRC.includes("mediateVoiceCaptureError(err, 'transcription')")).toBe(true)
  })

  it('does not show raw DOMException names in user-facing assistant messages', () => {
    expect(SRC.includes("content: mediateVoiceCaptureError(err, 'permission_or_device')")).toBe(true)
    expect(SRC.includes("content: mediateVoiceCaptureError(err, 'transcription')")).toBe(true)
  })
})

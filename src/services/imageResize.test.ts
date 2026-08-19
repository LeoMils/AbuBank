import { describe, it, expect } from 'vitest'
import { validateImageFile, approxDataUrlBytes, MAX_INPUT_IMAGE_BYTES } from './imageResize'

// Pure helpers only — the canvas/createImageBitmap path is browser-only and is
// exercised by the built-app browser tests with a synthetic image.
describe('validateImageFile — specific errors, no corruption', () => {
  it('rejects a null file', () => {
    const r = validateImageFile(null)
    expect(r.ok).toBe(false)
  })
  it('rejects a non-image file with a specific message', () => {
    const r = validateImageFile({ type: 'text/plain', size: 100 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('אינו תמונה')
  })
  it('rejects an oversized image', () => {
    const r = validateImageFile({ type: 'image/jpeg', size: MAX_INPUT_IMAGE_BYTES + 1 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('גדולה מדי')
  })
  it('accepts a reasonable image', () => {
    expect(validateImageFile({ type: 'image/png', size: 200 * 1024 }).ok).toBe(true)
  })
})

describe('approxDataUrlBytes', () => {
  it('estimates decoded bytes from a base64 data URL', () => {
    // base64 "QUJD" → "ABC" = 3 bytes.
    expect(approxDataUrlBytes('data:image/jpeg;base64,QUJD')).toBe(3)
  })
  it('handles a bare base64 string', () => {
    expect(approxDataUrlBytes('QUJD')).toBe(3)
  })
})

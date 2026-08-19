import { describe, it, expect } from 'vitest'
import { checkExtraction, extractionScore } from './latestIphoneLiveFailureRepro'

const NOW = new Date(2026, 6, 3, 9, 0, 0)

describe('Latest iPhone live failure repro (calendar extraction)', () => {
  it('extracts both natural-speech meetings correctly, with clean details', () => {
    const rows = checkExtraction(NOW)
    const s = extractionScore(rows)
    // eslint-disable-next-line no-console
    if (s.failures.length) console.error('[REPRO] failures:\n' + s.failures.map(f => `  ${f.id} → ${f.detail}`).join('\n'))
    expect(s.failures.map(f => f.id)).toEqual([])
  })
})

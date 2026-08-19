/*
 * qaControlEscapeCorpus.test.ts — proof the QA-control escape corpus is closed. (C12 / §22)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * Every recorded QA-SYSTEM escape must (a) name a detector, (b) be CLOSED, and (c) for detectors that
 * are test files, that file must actually exist on disk. QA_CONTROL_ESCAPES_OPEN must be 0.
 */
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const corpus = JSON.parse(readFileSync(resolve('docs/engineering-os/qa/QA_CONTROL_ESCAPE_CORPUS.json'), 'utf8'))
const escapes: Array<{ id: string; detector: string; closureState: string; originalFailure: string; affectedReleaseLayer: string; originalFailureClass?: string; mutation?: string; expectedFailureReason?: string; restorationProof?: string; sensitivityProven?: boolean }> = corpus.escapes

describe('QA Control Escape Corpus (C12/§22)', () => {
  it('has escapes and every one is fully specified', () => {
    expect(escapes.length).toBeGreaterThan(0)
    for (const e of escapes) {
      expect(e.id, 'id').toBeTruthy()
      expect(e.detector, `${e.id} detector`).toBeTruthy()
      expect(e.originalFailure, `${e.id} originalFailure`).toBeTruthy()
      expect(e.affectedReleaseLayer, `${e.id} affectedReleaseLayer`).toBeTruthy()
    }
  })

  it('QA_CONTROL_ESCAPES_OPEN = 0 (every escape CLOSED)', () => {
    const open = escapes.filter((e) => e.closureState !== 'CLOSED')
    expect(open.map((e) => e.id)).toEqual([])
  })

  it('every detector that references a test file actually exists on disk', () => {
    for (const e of escapes) {
      const m = e.detector.match(/(src\/[^\s]+\.test\.ts)/)
      const p = m?.[1]
      if (p) expect(existsSync(resolve(p)), `${e.id} → ${p}`).toBe(true)
    }
  })

  it('escape ids are unique', () => {
    const ids = escapes.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  // ── §4 · CLOSED means the detector fails for the INTENDED reason, not "the file exists". ──────────
  it('QA_CONTROL_ESCAPES_WITHOUT_SENSITIVITY_PROOF = 0 (every escape maps mutation → expected reason)', () => {
    const withoutProof = escapes.filter((e) =>
      !e.originalFailureClass || !e.mutation || !e.expectedFailureReason || !e.restorationProof || e.sensitivityProven !== true)
    expect(withoutProof.map((e) => e.id)).toEqual([])
  })

  it('each expected-failure-reason is specific (not a generic "suite red")', () => {
    for (const e of escapes) {
      expect(e.expectedFailureReason, e.id).toBeTruthy()
      // A generic red / typescript-broke reason is NOT sensitivity proof for the escape.
      expect(e.expectedFailureReason, `${e.id} reason too generic`).not.toMatch(/^(red|failed|error|broke)$/i)
      expect((e.expectedFailureReason ?? '').length, e.id).toBeGreaterThan(15)
    }
  })
})

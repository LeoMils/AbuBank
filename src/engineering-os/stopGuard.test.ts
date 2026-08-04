import { describe, it, expect } from 'vitest'
import { decideStopBlock } from './stopGuard'

describe('stop guard — blocks premature completion, never loops forever', () => {
  it('does NOT block when the goal is not armed (normal workflow untouched)', () => {
    expect(decideStopBlock({ goalActive: false, gatePass: false, openCount: 5, blockCount: 0 }).block).toBe(false)
  })
  it('does NOT block when the gate passes', () => {
    expect(decideStopBlock({ goalActive: true, gatePass: true, openCount: 0, blockCount: 0 }).block).toBe(false)
  })
  it('BLOCKS when armed and the gate reports open automatable Critical/High work', () => {
    const d = decideStopBlock({ goalActive: true, gatePass: false, openCount: 4, blockCount: 0 })
    expect(d.block).toBe(true)
    expect(d.reason).toContain('4 open')
    expect(d.nextBlockCount).toBe(1)
  })
  it('RELEASES after maxBlocks consecutive blocks (loop backstop)', () => {
    const d = decideStopBlock({ goalActive: true, gatePass: false, openCount: 4, blockCount: 3, maxBlocks: 3 })
    expect(d.block).toBe(false)
    expect(d.reason).toContain('loop backstop')
    expect(d.nextBlockCount).toBe(0)
  })
  it('resets the block counter once the gate passes', () => {
    expect(decideStopBlock({ goalActive: true, gatePass: true, openCount: 0, blockCount: 2 }).nextBlockCount).toBe(0)
  })
})

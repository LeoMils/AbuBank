/*
 * WEEKLY PARITY GUARD — standing suite + report writer.
 * Runs runParityGuard through the real controller (fixed clock, mocked llm/online) and
 * asserts no drift. When PARITY_GUARD_WRITE=1 (the `npm run parity:guard` path) it also
 * writes docs/eval/PARITY_GUARD_LATEST.md so the dated report is refreshed on demand —
 * the normal suite run only asserts (no file churn).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import { runParityGuard, formatParityGuard } from './parityGuard'

const FIXED = new Date('2026-06-24T09:00:00') // Wednesday — same clock as the scorecard
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })
let storage: Record<string, string> = {}
beforeEach(() => {
  storage = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => storage[k] ?? null, setItem: (k: string, v: string) => { storage[k] = v }, removeItem: (k: string) => { delete storage[k] } })
  vi.stubGlobal('navigator', { onLine: true })
})

describe('WEEKLY PARITY GUARD', () => {
  it('all three signals hold — no drift', async () => {
    const date = '2026-06-24' // deterministic under the fixed clock
    const r = await runParityGuard(date)
    const report = formatParityGuard(r)
    // eslint-disable-next-line no-console
    console.log('\n' + report)
    if (process.env.PARITY_GUARD_WRITE === '1') {
      const out = path.resolve(__dirname, '../../docs/eval/PARITY_GUARD_LATEST.md')
      fs.writeFileSync(out, report)
    }
    expect(r.parity.ok, 'parity dimensions must all hold').toBe(true)
    expect(r.marathonSmoke.ok, `marathon smoke failures: ${r.marathonSmoke.failing.join(', ')}`).toBe(true)
    expect(r.flightRecorder.ok, `flight-recorder failures: ${r.flightRecorder.failing.join(', ')}`).toBe(true)
    expect(r.ok).toBe(true)
  })
})

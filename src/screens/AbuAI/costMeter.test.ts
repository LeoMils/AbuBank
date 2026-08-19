import { describe, it, expect } from 'vitest'
import {
  recordSpend, budgetDecision, shouldFireAlert, emptyTotals,
  ALERT_FRACTION, REALTIME_MODEL_NORMAL, REALTIME_MODEL_CHEAP,
} from './costMeter'

describe('costMeter — running totals (session/day/month)', () => {
  it('accumulates within the same day/month', () => {
    let t = emptyTotals('2026-08-14', '2026-08')
    t = recordSpend(t, 0.5, { day: '2026-08-14', month: '2026-08' })
    t = recordSpend(t, 0.25, { day: '2026-08-14', month: '2026-08' })
    expect(t.dayUsd).toBeCloseTo(0.75, 4)
    expect(t.monthUsd).toBeCloseTo(0.75, 4)
    expect(t.sessionUsd).toBeCloseTo(0.75, 4)
  })

  it('rolls the day bucket over on a new day but keeps the month', () => {
    let t = emptyTotals('2026-08-14', '2026-08')
    t = recordSpend(t, 1.0, { day: '2026-08-14', month: '2026-08' })
    t = recordSpend(t, 0.4, { day: '2026-08-15', month: '2026-08' })
    expect(t.dayUsd).toBeCloseTo(0.4, 4) // reset
    expect(t.monthUsd).toBeCloseTo(1.4, 4) // kept
  })

  it('rolls the month bucket over on a new month', () => {
    let t = emptyTotals('2026-08-31', '2026-08')
    t = recordSpend(t, 2.0, { day: '2026-08-31', month: '2026-08' })
    t = recordSpend(t, 0.3, { day: '2026-09-01', month: '2026-09' })
    expect(t.monthUsd).toBeCloseTo(0.3, 4)
  })

  it('a new session zeroes only the session bucket', () => {
    let t = emptyTotals('2026-08-14', '2026-08')
    t = recordSpend(t, 1.0, { day: '2026-08-14', month: '2026-08' })
    t = recordSpend(t, 0.5, { day: '2026-08-14', month: '2026-08' }, { newSession: true })
    expect(t.sessionUsd).toBeCloseTo(0.5, 4)
    expect(t.dayUsd).toBeCloseTo(1.5, 4)
  })

  it('ignores negative deltas', () => {
    let t = emptyTotals('2026-08-14', '2026-08')
    t = recordSpend(t, -5, { day: '2026-08-14', month: '2026-08' })
    expect(t.dayUsd).toBe(0)
  })
})

describe('costMeter — budget policy NEVER disconnects Martita', () => {
  const CEIL = 3

  it('below 70%: normal tier, normal model, no alert, connected, no Martita message', () => {
    const d = budgetDecision(1.0, CEIL) // 33%
    expect(d.tier).toBe('normal')
    expect(d.realtimeModel).toBe(REALTIME_MODEL_NORMAL)
    expect(d.notifyLeo).toBe(false)
    expect(d.connected).toBe(true)
    expect(d.martitaMessage).toBeNull()
    expect(d.maxResponseTokens).toBeUndefined()
  })

  it('at/above 70%: warn tier alerts LEO, still normal model, still connected, Martita untouched', () => {
    const d = budgetDecision(0.75 * CEIL, CEIL) // 75% — safely across the 70% line
    expect(d.fraction).toBeGreaterThanOrEqual(ALERT_FRACTION)
    expect(d.tier).toBe('warn')
    expect(d.notifyLeo).toBe(true)
    expect(d.leoMessage).toBeTruthy()
    expect(d.realtimeModel).toBe(REALTIME_MODEL_NORMAL) // no degrade yet
    expect(d.connected).toBe(true)
    expect(d.martitaMessage).toBeNull()
  })

  it('at the ceiling: DEGRADE (cheaper model + shorter replies), alert Leo, but NEVER disconnect and NEVER tell Martita', () => {
    const d = budgetDecision(CEIL, CEIL) // 100%
    expect(d.tier).toBe('degraded')
    expect(d.realtimeModel).toBe(REALTIME_MODEL_CHEAP)
    expect(d.maxResponseTokens).toBeGreaterThan(0)
    expect(d.notifyLeo).toBe(true)
    // THE HARD INVARIANT — a live conversation is never cut off, Martita never told.
    expect(d.connected).toBe(true)
    expect(d.martitaMessage).toBeNull()
  })

  it('far over the ceiling still keeps her connected (degraded, not disconnected)', () => {
    const d = budgetDecision(CEIL * 10, CEIL)
    expect(d.connected).toBe(true)
    expect(d.martitaMessage).toBeNull()
    expect(d.tier).toBe('degraded')
  })

  it('degraded replies are shorter but not terse-to-rude (>= a 2–4 sentence budget)', () => {
    const d = budgetDecision(CEIL, CEIL)
    expect(d.maxResponseTokens!).toBeGreaterThanOrEqual(200)
  })
})

describe('costMeter — Leo alert fires once per tier (no spam)', () => {
  it('fires entering warn, then again entering degraded, but not on repeats', () => {
    const warn = budgetDecision(2.1, 3) // 70%
    const degraded = budgetDecision(3, 3) // 100%
    expect(shouldFireAlert(warn, null)).toBe(true)
    expect(shouldFireAlert(warn, 'warn')).toBe(false) // already alerted at warn
    expect(shouldFireAlert(degraded, 'warn')).toBe(true) // new tier
    expect(shouldFireAlert(degraded, 'degraded')).toBe(false)
  })

  it('normal tier never fires', () => {
    const normal = budgetDecision(0.5, 3)
    expect(shouldFireAlert(normal, null)).toBe(false)
  })
})

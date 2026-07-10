import { describe, it, expect } from 'vitest'
import { createCase, transition, canTransition, isTerminal, currentRollbackTarget, type Actor } from './stateMachine'

const BOT: Actor = { kind: 'automation', name: 'test-bot' }
const HUMAN: Actor = { kind: 'human', name: 'leo' }
const base = { at: '2026-07-10T00:00:00Z', reason: 'r', evidenceRefs: [], confidence: 1, policy: 'observe_only' }

describe('case state machine — legal edges only', () => {
  it('allows a valid transition and appends history', () => {
    const c = createCase('c1', 'family', 't', base.at, BOT)
    const r = transition(c, 'SIGNAL_CLASSIFIED', { actor: BOT, ...base })
    expect(r.ok).toBe(true)
    if (r.ok) { expect(r.case.state).toBe('SIGNAL_CLASSIFIED'); expect(r.case.history).toHaveLength(2) }
  })
  it('rejects an illegal skip', () => {
    const c = createCase('c1', 'family', 't', base.at, BOT)
    const r = transition(c, 'DEPLOYED', { actor: HUMAN, ...base })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('illegal_transition')
  })
})

describe('governance separation — automation cannot reach production states', () => {
  it('blocks an automation actor from HUMAN_APPROVED', () => {
    // Walk to CANARY_READY legally with automation, then attempt HUMAN_APPROVED.
    let c = createCase('c1', 'calendar', 't', base.at, BOT)
    for (const to of ['SIGNAL_CLASSIFIED','EVIDENCE_VALIDATED','PRIVACY_REDACTED','DUPLICATE_CHECKED','REPRODUCTION_ATTEMPTED','REPRODUCED','FIRST_DIVERGENCE_IDENTIFIED','ROOT_CAUSE_SUPPORTED','FAILURE_FAMILY_GENERALIZED','REGRESSIONS_GENERATED','CANDIDATES_PROPOSED','CANDIDATES_EVALUATED','WINNER_SELECTED','SHADOW_VALIDATED','PREVIEW_VALIDATED','CANARY_READY'] as const) {
      const r = transition(c, to, { actor: BOT, ...base }); expect(r.ok).toBe(true); if (r.ok) c = r.case
    }
    const bot = transition(c, 'HUMAN_APPROVED', { actor: BOT, ...base })
    expect(bot.ok).toBe(false); if (!bot.ok) expect(bot.reason).toBe('requires_human')
    const human = transition(c, 'HUMAN_APPROVED', { actor: HUMAN, ...base })
    expect(human.ok).toBe(true)
  })
})

describe('rollback target + terminals', () => {
  it('surfaces the most recent rollback target', () => {
    const c = createCase('c1', 'x', 't', base.at, BOT)
    const r = transition(c, 'SIGNAL_CLASSIFIED', { actor: BOT, ...base, rollbackTarget: 'v-good' })
    expect(r.ok && currentRollbackTarget(r.case)).toBe('v-good')
  })
  it('knows terminal states', () => {
    expect(isTerminal('CONFIRMED')).toBe(true)
    expect(isTerminal('OBSERVED')).toBe(false)
    expect(canTransition('OBSERVED', 'SIGNAL_CLASSIFIED')).toBe(true)
  })
})

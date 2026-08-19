/*
 * ActiveActionCard — the canonical live card is a FAITHFUL, safe projection of one
 * committed ActiveActionViewModel (ADR §13). Rendered via react-dom/server (house
 * pattern) for two committed revisions (message → call) to prove: the right kind/
 * status/recipient/primary-control render, a completion is never shown, and a stale/
 * cancelled view-model renders nothing.
 */
import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { ActiveActionCard } from './ActiveActionCard'
import type { ActiveActionViewModel } from '../screens/AbuAI/realtime/sessionOrchestrator'

const messageReady: ActiveActionViewModel = {
  cardId: 'act_1', revision: 1, generation: 0, kind: 'message', recipientLabel: 'מור',
  status: 'READY_FOR_HANDOFF', visible: true, primaryControl: 'פתחי בוואטסאפ', supersedes: null,
  provenance: 'contacts-kernel', allowedClaims: ['message ready', 'opens WhatsApp', 'not sent until Send'],
  a11y: 'הודעה למור מוכנה. כפתור פותח את וואטסאפ — לא נשלח לבד.',
}
const callReady: ActiveActionViewModel = {
  ...messageReady, cardId: 'act_2', revision: 2, kind: 'call', primaryControl: 'התקשרי',
  supersedes: 'act_1', a11y: 'מוכנה שיחה למור. כפתור פותח את החייגן — לא מחייג לבד.',
}

describe('ActiveActionCard — faithful projection of the committed revision', () => {
  it('MESSAGE committed revision renders recipient, status, and the message primary control', () => {
    const html = renderToString(React.createElement(ActiveActionCard, { vm: messageReady }))
    expect(html).toContain('מור')
    expect(html).toContain('פתחי בוואטסאפ')
    expect(html).toContain('data-kind="message"')
    expect(html).toContain('data-revision="1"')
    expect(html).toContain('לא נשלח אוטומטית')
  })

  it('CALL committed revision (the atomic replace) renders as a call with its own control', () => {
    const html = renderToString(React.createElement(ActiveActionCard, { vm: callReady }))
    expect(html).toContain('התקשרי')
    expect(html).toContain('data-kind="call"')
    expect(html).toContain('data-revision="2"')
    expect(html).toContain('לא מתקשר אוטומטית')
  })

  it('NEVER renders a fabricated completion word', () => {
    const html = renderToString(React.createElement(ActiveActionCard, { vm: callReady }))
    for (const bad of ['שלחתי', 'התקשרתי', 'חייגתי', 'נשלח', 'השיחה בוצעה']) {
      expect(html).not.toContain(bad)
    }
  })

  it('a NOT_CONFIGURED card shows no primary control (no guessed handoff button)', () => {
    const notConfigured: ActiveActionViewModel = { ...messageReady, status: 'NOT_CONFIGURED', primaryControl: null, a11y: 'אין מספר שמור למור. אפשר להוסיף בהגדרות.' }
    const html = renderToString(React.createElement(ActiveActionCard, { vm: notConfigured }))
    expect(html).not.toContain('active-action-primary')
    expect(html).toContain('אין מספר שמור')
  })

  it('an invisible / cancelled view-model renders nothing', () => {
    const gone: ActiveActionViewModel = { ...messageReady, visible: false }
    expect(renderToString(React.createElement(ActiveActionCard, { vm: gone }))).toBe('')
    const noCard: ActiveActionViewModel = { ...messageReady, cardId: null }
    expect(renderToString(React.createElement(ActiveActionCard, { vm: noCard }))).toBe('')
  })
})

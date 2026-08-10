/*
 * ActionCard.test.tsx — the generic action-card surface renders correctly (CODE).
 * Uses react-dom/server (the repo's node-env convention) — proves the card markup:
 * title, body lines, the right primary affordance (wa.me link / confirm button /
 * honest disabled reason), and a dismiss. It does NOT prove the on-device tap.
 */
import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { ActionCard } from './ActionCard'
import type { LiveCard } from '../../services/liveActionCards'

const render = (card: LiveCard) => renderToString(<ActionCard card={card} onDismiss={() => {}} onConfirm={() => {}} />)

describe('ActionCard', () => {
  it('renders an RTL WhatsApp card with title, message, a wa.me Send link, and a dismiss', () => {
    const html = render({
      kind: 'whatsapp', title: 'הודעת וואטסאפ מוכנה', lines: ['אל: מור', 'נתראה בשישי'],
      primaryHref: 'https://wa.me/972545000005?text=hi', primaryLabel: 'שליחה בוואטסאפ',
    })
    expect(html).toContain('dir="rtl"')
    expect(html).toContain('הודעת וואטסאפ מוכנה')
    expect(html).toContain('נתראה בשישי')
    expect(html).toContain('href="https://wa.me/972545000005?text=hi"')
    expect(html).toContain('שליחה בוואטסאפ')
    expect(html).toContain('סגירה') // dismiss
    expect(html).toContain('data-card-kind="whatsapp"')
  })

  it('renders a calendar-draft card with a Confirm button (not an external link)', () => {
    const html = render({
      kind: 'calendar-draft', title: 'טיוטת פגישה — עדיין לא נשמר', lines: ['רופא', '2026'],
      primaryAction: 'confirm-calendar', primaryLabel: 'לאשר ולשמור',
    })
    expect(html).toContain('לאשר ולשמור')
    expect(html).toContain('<button')
    expect(html).not.toContain('href=')
  })

  it('renders an HONEST disabled state instead of a dead button when there is no number', () => {
    const html = render({ kind: 'call', title: 'שיחה מוכנה', lines: ['שיחה אל: גבי'], disabledReason: 'אין לי מספר טלפון של גבי' })
    expect(html).toContain('אין לי מספר טלפון של גבי')
    expect(html).toContain('live-action-card-disabled')
    expect(html).not.toContain('href=')
  })

  it('uses large type for senior readability (title ≥ 24px)', () => {
    const html = render({ kind: 'calendar-receipt', title: 'נשמר ביומן ✓', lines: ['רופא'] })
    expect(html).toMatch(/font-size:2[4-9]px|font-size:[3-9][0-9]px/)
  })
})

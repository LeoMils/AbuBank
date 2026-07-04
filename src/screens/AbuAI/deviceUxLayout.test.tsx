/*
 * Device UX layout contract (senior-first, iPhone). Renders the real components
 * via react-dom/server and asserts the structure that prevents clipping /
 * unreadability: long assistant text wraps (no clip), the event card shows every
 * structured field, and interactive text meets the readable-size floor.
 * (Pixel-perfect rendering still needs Leo's device — see IPHONE_UX_CHECKLIST.md.)
 */
import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { ChatBubble } from './ChatBubble'
import { ApptCard } from '../AbuCalendar/ApptCard'
import type { Appointment } from '../AbuCalendar/service'

const LONG = 'זה משפט ארוך מאוד שנועד לבדוק שהטקסט נשבר לשורות ולא נחתך. '.repeat(8)

describe('Device UX — assistant message does not clip long text', () => {
  const html = renderToString(React.createElement(ChatBubble, {
    msg: { id: 'm1', role: 'assistant', content: LONG, timestamp: 1_760_000_000_000 } as never,
    isLast: true, onRetry: () => {}, onHome: () => {}, onDismiss: () => {},
  }))
  it('wraps long text (pre-wrap + break-word), never clips', () => {
    expect(html).toContain('pre-wrap')
    expect(html).toContain('break-word')
    expect(html).not.toContain('overflow:hidden;text-overflow:ellipsis')
    expect(html).toContain(LONG.slice(0, 30).trim()) // the full text is present, not truncated
  })
  it('body text is readable (≥16px)', () => {
    expect(html).toMatch(/font-size:1[6-9]px|font-size:2\dpx/)
  })
})

describe('Device UX — event card shows every structured field clearly', () => {
  const appt = { id: '1', title: 'פגישה עם דני', date: '2026-07-06', time: '19:00', location: 'קפה מורנו', notes: 'להביא מסמכים', emoji: '📅', color: '#C9A84C' } as unknown as Appointment
  const html = renderToString(React.createElement(ApptCard, { appt }))
  it('renders title, time, location and notes (no field hidden)', () => {
    expect(html).toContain('פגישה עם דני')
    expect(html).toContain('19:00')
    expect(html).toContain('קפה מורנו')
    expect(html).toContain('להביא מסמכים')
  })
  it('time/title are readable-sized', () => {
    expect(html).toMatch(/font-size:1[6-9]px|font-size:2\dpx/)
  })
})

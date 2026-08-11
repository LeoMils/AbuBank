import React from 'react'
import { renderToString } from 'react-dom/server'
import { chromium } from 'playwright'
import { AbuLogo, type AbuAppId } from '../src/design/logos/AbuLogo'

const apps: AbuAppId[] = ['ai', 'news', 'bank', 'whatsapp', 'weather', 'games', 'calendar']
const labels: Record<AbuAppId, string> = { ai: 'AI', news: 'News', bank: 'Bank', whatsapp: 'WhatsApp', weather: 'Weather', games: 'Games', calendar: 'Calendar' }
const cell = (a: AbuAppId) =>
  `<div style="display:flex;flex-direction:column;align-items:center;gap:8px">${renderToString(React.createElement(AbuLogo, { app: a, size: 92 }))}<span style="color:rgba(245,243,236,0.75);font:600 15px Segoe UI,sans-serif">Abu ${labels[a]}</span></div>`
const html = `<body style="margin:0;background:radial-gradient(120% 90% at 50% -10%,#0B1226,#070B1E 55%,#05081A);display:flex;gap:20px;padding:28px 24px;align-items:center;justify-content:center">${apps.map(cell).join('')}</body>`

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 7 * 92 + 6 * 20 + 48, height: 170 }, deviceScaleFactor: 2 })
await p.setContent(html)
await p.screenshot({ path: 'docs/design/abu-logo-family.png' })
await b.close()
console.log('rendered docs/design/abu-logo-family.png')

import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'
const A = readFileSync('docs/design/abu-bust-A.svg', 'utf8')
const B = readFileSync('docs/design/abu-bust-B.svg', 'utf8')
const cell = (svg, label) => `<div style="display:flex;flex-direction:column;align-items:center;gap:10px">${svg}<span style="color:#E8B563;font:600 16px Segoe UI,sans-serif">${label}</span></div>`
const html = `<!doctype html><body style="margin:0;background:#04061a;display:flex;gap:28px;padding:26px;justify-content:center">${cell(A, 'A — Warm Gold')}${cell(B, 'B — Starlight Depth')}</body>`
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 360 * 2 + 28 + 52, height: 452 }, deviceScaleFactor: 2 })
await page.setContent(html)
await page.screenshot({ path: 'docs/design/abu-bust-variants.png' })
await browser.close()
console.log('rendered docs/design/abu-bust-variants.png')

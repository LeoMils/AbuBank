import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'
const svg = readFileSync('docs/design/abu-bust-still.svg', 'utf8')
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 360, height: 400 }, deviceScaleFactor: 2 })
await page.setContent(`<!doctype html><body style="margin:0;padding:0">${svg}</body>`)
await page.screenshot({ path: 'docs/design/abu-bust-still.png' })
await browser.close()
console.log('rendered docs/design/abu-bust-still.png')

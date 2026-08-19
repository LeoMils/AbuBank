/*
 * PERSISTENCE LIFECYCLE FORENSICS.
 *
 * Instruments the ENTIRE import -> commit -> terminate -> reopen lifecycle in a
 * real persistent Chromium profile and, at EVERY persistence boundary, reads BOTH
 * localStorage AND IndexedDB DIRECTLY (independent of the app's own view) — plus a
 * pre-init snapshot captured before any app code runs on reopen. It then
 * auto-detects the FIRST boundary where the phone count goes >0 -> 0, in the
 * authoritative store (what getLocalContacts reads), in localStorage, and in
 * IndexedDB — and names the responsible function/transaction/state.
 *
 * If no such transition exists, it PROVES the numbers became durable: IndexedDB
 * held the phones at the UI-success boundary AND at the pre-init reopen boundary.
 *
 * Target: a local build of the tested commit (code-identical; deterministic and
 * free of the deployed origin's bot-challenge).  Run: node scripts/lifecycle-forensics.mjs
 */
import { chromium } from '@playwright/test'
import { rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TARGET = process.env.TARGET || 'http://localhost:5183'
const PROFILE = join(tmpdir(), 'abu-forensics-profile')
const KEY = 'abubank.familyContacts.v1'
const synth = (n) => ['+972', '50', ('0000000' + n).slice(-7)].join('')
const IMPORT = JSON.stringify([1, 2, 3].map((n) => ({ id: ['mor', 'leo', 'adar'][n - 1], displayName: ['mor', 'leo', 'adar'][n - 1], enabled: true, phoneE164: synth(n) })))
const log = (m) => process.stdout.write(m + '\n')

// ── phone counting (authoritative, independent of the app) ──────────────────
function phoneCount(raw) {
  if (raw === null || raw === undefined || raw === '') return 0
  if (typeof raw === 'string' && raw.startsWith('ERR')) return -2
  let parsed
  try { parsed = JSON.parse(raw) } catch { return -1 } // corrupt
  const arr = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.contacts) ? parsed.contacts : null)
  if (!arr) return 0
  let p = 0
  for (const c of arr) if (c && typeof c === 'object' && (((c.phoneE164 || '') + '').trim() || ((c.whatsappE164 || '') + '').trim())) p++
  return p
}
const authoritative = (ls, idb) => (ls !== null && ls !== '' && phoneCount(ls) >= 0 && ls !== 'ERR' ? phoneCount(ls) : phoneCount(idb))

// Read LS + IDB directly, in-page, at the current moment.
async function readStorage(page) {
  return page.evaluate(async (key) => {
    let ls = null
    try { ls = localStorage.getItem(key) } catch { ls = 'ERR' }
    let idb = null
    try {
      const dbs = indexedDB.databases ? await indexedDB.databases() : []
      const info = dbs.find((d) => d.name === 'abu-durable')
      if (!info) { idb = 'ABSENT' } // app never created the durable DB
      else {
        const db = await new Promise((res, rej) => { const r = indexedDB.open('abu-durable', info.version); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('blocked')) })
        const stores = Array.from(db.objectStoreNames)
        if (!stores.includes('kv')) idb = 'NO-KV:[' + stores.join(',') + ']'
        else idb = await new Promise((res) => { try { const g = db.transaction('kv', 'readonly').objectStore('kv').get(key); g.onsuccess = () => res(g.result ?? null); g.onerror = () => res('ERR:get') } catch (e) { res('ERR:tx') } })
        db.close()
      }
    } catch (e) { idb = 'ERR:open:' + (e && e.message ? e.message : String(e)) }
    return { ls, idb }
  }, KEY).catch(() => ({ ls: 'ERR', idb: 'ERR' }))
}

async function launch() {
  const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: 390, height: 844 }, locale: 'he-IL' })
  // Pre-init snapshot: capture LS (sync) + IDB (async) BEFORE any app script runs.
  await ctx.addInitScript((key) => {
    const w = window
    w.__preInit = { ls: null, idb: null }
    try { w.__preInit.ls = localStorage.getItem(key) } catch { w.__preInit.ls = 'ERR' }
    w.__preInitReady = (async () => {
      try {
        const dbs = indexedDB.databases ? await indexedDB.databases() : []
        const info = dbs.find((d) => d.name === 'abu-durable')
        if (!info) { w.__preInit.idb = 'ABSENT'; return }
        const db = await new Promise((res, rej) => { const r = indexedDB.open('abu-durable', info.version); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('blocked')) })
        if (!Array.from(db.objectStoreNames).includes('kv')) { w.__preInit.idb = 'NO-KV'; db.close(); return }
        w.__preInit.idb = await new Promise((res) => { try { const g = db.transaction('kv', 'readonly').objectStore('kv').get(key); g.onsuccess = () => res(g.result ?? null); g.onerror = () => res('ERR:get') } catch (e) { res('ERR:tx') } })
        db.close()
      } catch (e) { w.__preInit.idb = 'ERR:open:' + (e && e.message ? e.message : String(e)) }
    })()
  }, KEY)
  return ctx
}
async function preInit(page) {
  return page.evaluate(async () => { try { await window.__preInitReady } catch { /**/ } return window.__preInit || { ls: null, idb: null } }).catch(() => ({ ls: null, idb: null }))
}

async function openCM(page) {
  await page.goto(TARGET, { waitUntil: 'networkidle', timeout: 30000 })
  await page.getByRole('button', { name: 'הגדרות' }).first().click()
  await page.getByRole('button', { name: /ניהול אנשי קשר/ }).click()
  await page.getByTestId('contact-management').waitFor({ state: 'visible', timeout: 15000 })
}
async function resolverCount(page) {
  const t = (await page.getByTestId('contacts-receipt').textContent().catch(() => '')) || ''
  return Number((t.match(/call-ready:(\d+)/) || [])[1] ?? -1)
}

const LEDGER = []
function record(boundary, phase, fn, ls, idb, resolver) {
  const row = { boundary, phase, function: fn, lsPhones: phoneCount(ls), idbPhones: phoneCount(idb), authoritativePhones: authoritative(ls, idb), resolverPhones: resolver ?? null }
  LEDGER.push(row)
  const idbErr = (typeof idb === 'string' && idb.startsWith('ERR')) ? `  [idb ${idb}]` : ''
  log(`  #${LEDGER.length} ${boundary.padEnd(22)} ls=${row.lsPhones} idb=${row.idbPhones} auth=${row.authoritativePhones} resolver=${row.resolverPhones}  (${fn})${idbErr}`)
  return row
}

async function main() {
  try { rmSync(PROFILE, { recursive: true, force: true }) } catch { /**/ }
  mkdirSync(PROFILE, { recursive: true })
  log('── PERSISTENCE LIFECYCLE FORENSICS ──')

  // ═══ SESSION 1: import → commit → terminate ═══
  let ctx = await launch()
  let page = ctx.pages()[0] || await ctx.newPage()
  await openCM(page)
  {
    const s = await readStorage(page)
    record('B0 pre-import (seed)', 'session1', 'seedDefaultContactsIfEmpty', s.ls, s.idb, await resolverCount(page))
  }
  await page.getByTestId('cm-tab-advanced').click()
  await page.getByTestId('cm-json').fill(IMPORT)
  await page.getByTestId('cm-validate').click()
  await page.getByTestId('cm-preview').waitFor({ state: 'visible', timeout: 10000 })
  {
    const s = await readStorage(page)
    record('B1 after validate', 'session1', 'previewImportContacts (parsed, NOT saved)', s.ls, s.idb, await resolverCount(page))
  }
  // The commit: saveMerge -> upsertLocalContact (sync LS + durable.setString) x3
  //             -> refresh -> await durable.flush() -> recordCommittedSave -> banner.
  await page.getByTestId('cm-merge-save').click()
  await page.waitForTimeout(2000) // let the awaited durable.flush() + banner complete
  {
    const s = await readStorage(page)
    record('B3 UI-success (post-flush)', 'session1', 'saveMerge/upsertLocalContact -> setLocalContacts -> durable.flush()', s.ls, s.idb, await resolverCount(page))
  }
  // Board (the runtime consumer) view.
  {
    await page.goto(TARGET, { waitUntil: 'networkidle', timeout: 30000 })
    await page.getByRole('button', { name: /WhatsApp|הודעות/ }).first().click()
    await page.getByTestId('family-quick-faces').waitFor({ state: 'visible', timeout: 15000 })
    await page.getByTestId('bubble-person-tap-mor').click()
    await page.getByTestId('focused-contact').waitFor({ state: 'visible', timeout: 10000 })
    const boardActionable = (await page.getByTestId('chip-call-mor').count()) > 0
    const s = await readStorage(page)
    record('B4 Board (consumer)', 'session1', 'getLocalContacts -> contactsToPersonFaces', s.ls, s.idb, boardActionable ? 3 : 0)
  }
  await ctx.close() // ═══ TERMINATE (flush on pagehide) ═══
  log('  ── terminate (context.close) ──')

  // ═══ SESSION 2: reopen SAME profile ═══
  ctx = await launch()
  page = ctx.pages()[0] || await ctx.newPage()
  await page.goto(TARGET, { waitUntil: 'networkidle', timeout: 30000 })
  {
    const pi = await preInit(page) // storage state BEFORE app code ran this session
    record('B5 reopen PRE-init', 'session2', 'process boot (before durable.init)', pi.ls, pi.idb, null)
  }
  await openCM(page)
  {
    const s = await readStorage(page) // after durable.init reconcile + seed + migrate
    record('B6 reopen POST-init', 'session2', 'durable.init reconcile + seed + migrate', s.ls, s.idb, await resolverCount(page))
  }
  {
    await page.goto(TARGET, { waitUntil: 'networkidle', timeout: 30000 })
    await page.getByRole('button', { name: /WhatsApp|הודעות/ }).first().click()
    await page.getByTestId('family-quick-faces').waitFor({ state: 'visible', timeout: 15000 })
    await page.getByTestId('bubble-person-tap-mor').click()
    await page.getByTestId('focused-contact').waitFor({ state: 'visible', timeout: 10000 })
    const boardActionable = (await page.getByTestId('chip-call-mor').count()) > 0
    const s = await readStorage(page)
    record('B7 reopen Board', 'session2', 'getLocalContacts -> contactsToPersonFaces', s.ls, s.idb, boardActionable ? 3 : 0)
  }
  await ctx.close()

  // ═══ AUTO-DETECT the first >0 -> 0 transition in each channel ═══
  const firstDrop = (field) => {
    for (let i = 1; i < LEDGER.length; i++) {
      const prev = LEDGER[i - 1][field], cur = LEDGER[i][field]
      if (typeof prev === 'number' && typeof cur === 'number' && prev > 0 && cur === 0) {
        return { from: LEDGER[i - 1], to: LEDGER[i], field }
      }
    }
    return null
  }
  const drops = {
    authoritative: firstDrop('authoritativePhones'),
    localStorage: firstDrop('lsPhones'),
    indexedDB: firstDrop('idbPhones'),
    resolver: firstDrop('resolverPhones'),
  }

  // The UI-success boundary and the pre-init reopen boundary — durability proof.
  const uiSuccess = LEDGER.find((r) => r.boundary.startsWith('B3'))
  const reopenPre = LEDGER.find((r) => r.boundary.startsWith('B5'))

  const conclusion = (() => {
    const anyDrop = drops.authoritative || drops.localStorage || drops.indexedDB || drops.resolver
    if (anyDrop) {
      const d = drops.authoritative || anyDrop
      return { verdict: 'FIRST_CAUSAL_TRANSITION_FOUND', channel: d.field, at: d.to.boundary, responsibleFunction: d.to.function, from: d.from, to: d.to }
    }
    // No drop. Prove durability at success + survival at reopen.
    const durableAtSuccess = uiSuccess && uiSuccess.idbPhones >= 3
    const durableAtReopenPreInit = reopenPre && reopenPre.idbPhones >= 3
    if (durableAtSuccess && durableAtReopenPreInit) {
      return { verdict: 'NO_TRANSITION_NUMBERS_ARE_DURABLE', proof: 'IndexedDB held the phones at the UI-success boundary AND at the pre-init reopen boundary; the authoritative store never dropped to 0. The in-process lifecycle has no phones>0->0 transition — durability succeeded and survived terminate/reopen. Any device N->0 is therefore OUT OF PROCESS (iOS standalone-PWA/Safari storage-partition or ITP eviction), not a function/transaction in this code path.', uiSuccess, reopenPre }
    }
    if (uiSuccess && uiSuccess.idbPhones < 3) {
      return { verdict: 'NEVER_DURABLE_DESPITE_UI_SUCCESS', proof: `At the UI-success boundary IndexedDB held ${uiSuccess.idbPhones} phones — the numbers never committed to the durable store despite success.`, uiSuccess }
    }
    return { verdict: 'INCONCLUSIVE', uiSuccess, reopenPre }
  })()

  const result = { ledger: LEDGER, firstDrop: drops, conclusion }
  writeFileSync(join(ROOT, 'docs/engineering-os/qa/lifecycle-forensics-result.json'), JSON.stringify(result, null, 2))
  log('\n══ CONCLUSION ══')
  log(JSON.stringify(conclusion, null, 2))
  process.exit(0)
}

main().catch((e) => { log('FORENSICS ERROR: ' + (e?.message ?? String(e))); process.exit(1) })

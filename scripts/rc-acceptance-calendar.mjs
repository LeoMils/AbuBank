/*
 * rc-acceptance-calendar.mjs — DEPLOYED Calendar write→readback→modify acceptance. (§16, machine-closable)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *   node scripts/rc-acceptance-calendar.mjs <rcUrl>
 *
 * The historical PHYSICAL-acceptance failure was: an event the user creates via the AbuCalendar UI
 * cannot be read back / modified in the SAME session (a write that never round-trips). This drives the
 * REAL deployed AbuCalendar screen (?screen=AbuCalendar) through the actual UI:
 *   WRITE (＋ הוספה ידנית → ManualModal → המשך → ConfirmCard "כן, לשמור")
 *   → READBACK (open the day cell → the ApptCard shows the title + time; store + IndexedDB carry it)
 *   → MODIFY (tap the card → editing modal → change the time → save)
 *   → READBACK-2 (the new time is shown + persisted)
 *   → RELOAD (the modified event survives a full reload — IndexedDB durability, not a memory artifact).
 * Every assertion reads the REAL rendered UI and the REAL persisted state (localStorage mirror +
 * abu-durable/kv IndexedDB). PASS requires a genuine round-trip at every stage — no seeded state.
 * Writes docs/eval/RC_ACCEPTANCE_CALENDAR.json and exits non-zero on any FAIL.
 */
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const RC = (process.argv[2] || '').replace(/\/$/, '')
if (!RC) { console.error('usage: node scripts/rc-acceptance-calendar.mjs <rcUrl>'); process.exit(2) }

const CAL_KEY = 'abubank-calendar-appointments'
const steps = []
const rec = (id, pass, detail) => { steps.push({ id, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${id.padEnd(22)} ${detail ?? ''}`) }

// Read the durable localStorage mirror the calendar service reads/writes.
async function readMirror(page) {
  return page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || '[]') } catch { return [] } }, CAL_KEY)
}
// Read the SAME key straight out of IndexedDB (abu-durable/kv) — proves durable persistence, not just the mirror.
async function readIndexedDb(page) {
  return page.evaluate((k) => new Promise((resolve) => {
    const req = indexedDB.open('abu-durable')
    req.onsuccess = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('kv')) { resolve(null); return }
      const store = db.transaction('kv', 'readonly').objectStore('kv')
      const g = store.get(k)
      g.onsuccess = () => resolve(typeof g.result === 'string' ? g.result : (g.result == null ? null : JSON.stringify(g.result)))
      g.onerror = () => resolve(null)
    }
    req.onerror = () => resolve(null)
  }), CAL_KEY)
}

// The app now ships a MANDATORY, fail-closed entry lock (0.292.x). A real user
// establishes a PIN on first run and enters it thereafter; there is NO production
// bypass. So this harness authenticates exactly like Martita would — which makes
// the calendar round-trip evidence STRONGER (it now traverses the real gate). In
// headless there is no platform biometric, so setup resolves to PIN-only.
async function ensureUnlocked(page) {
  const gate = page.getByTestId('auth-gate')
  const addBtn = page.getByRole('button', { name: /הוספה ידנית/ }).first()
  // Race: as soon as EITHER the gate or the in-app add button is visible we know
  // the state (fast on a warm/no-gate reload; waits out the intro on a cold one).
  const seen = await Promise.race([
    gate.waitFor({ state: 'visible', timeout: 15_000 }).then(() => 'gate').catch(() => null),
    addBtn.waitFor({ state: 'visible', timeout: 15_000 }).then(() => 'app').catch(() => null),
  ])
  if (seen !== 'gate') return // already unlocked (warm session) or app already shown
  const tap = async (seq) => { for (const d of seq) await page.getByRole('button', { name: d, exact: true }).click() }
  await tap(['1', '2', '3', '4'])       // set PIN (first-run) OR enter it (re-lock)
  await page.waitForTimeout(250)
  await tap(['1', '2', '3', '4'])       // confirm (first-run); a no-op-safe second entry otherwise
  // If a biometric-enroll offer appears (only when a platform authenticator exists), keep the PIN.
  const skip = page.getByRole('button', { name: /להמשיך עם הקוד/ })
  try { await skip.waitFor({ state: 'visible', timeout: 1500 }); await skip.click() } catch { /* no offer */ }
  await gate.waitFor({ state: 'detached', timeout: 8_000 }).catch(() => {})
}

async function openCalendarFresh(page, { clear }) {
  await page.goto(`${RC}/?screen=AbuCalendar`, { waitUntil: 'networkidle', timeout: 45_000 })
  await ensureUnlocked(page)
  if (clear) {
    // Wipe BOTH tiers so the run starts from genuine empty state (no seeded appointments).
    await page.evaluate((k) => new Promise((res) => {
      try { localStorage.removeItem(k) } catch { /* ignore */ }
      const del = indexedDB.deleteDatabase('abu-durable')
      del.onsuccess = del.onerror = del.onblocked = () => res(true)
      setTimeout(() => res(true), 1500)
    }), CAL_KEY)
    await page.goto(`${RC}/?screen=AbuCalendar`, { waitUntil: 'networkidle', timeout: 45_000 })
    await ensureUnlocked(page)
  }
  // The add button proves the calendar screen actually rendered (past any splash).
  await page.getByRole('button', { name: /הוספה ידנית/ }).first().waitFor({ state: 'visible', timeout: 30_000 })
}

// Compute a target date in the CURRENTLY-DISPLAYED month, using the browser's own clock (so it matches
// the app's `today`), and a day distinct from today — no month navigation needed to see the cell.
async function targetDate(page) {
  return page.evaluate(() => {
    const n = new Date()
    const y = n.getFullYear(), m = n.getMonth() // local, same basis the calendar uses to open
    const dim = new Date(y, m + 1, 0).getDate()
    let day = n.getDate() + 5
    if (day > dim) day = Math.max(1, n.getDate() - 5)
    const pad = (x) => String(x).padStart(2, '0')
    return { date: `${y}-${pad(m + 1)}-${pad(day)}`, day }
  })
}

async function clickDayCell(page, day) {
  // Day cells are <button aria-label="`${day} ${monthName}…`">. The trailing space anchors "2" ≠ "20".
  await page.getByRole('button', { name: new RegExp(`^${day} `) }).first().click()
}

async function saveThroughConfirm(page) {
  await page.getByTestId('manual-save').click()                 // "המשך"
  const confirm = page.getByTestId('confirm-save-btn')          // "כן, לשמור"
  await confirm.waitFor({ state: 'visible', timeout: 10_000 })
  await confirm.click()
  await page.getByTestId('confirm-save-btn').waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {})
}

async function main() {
  console.log(`=== RC CALENDAR ACCEPTANCE · ${RC} ===\n`)
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 412, height: 870 }, locale: 'he-IL' })
  const page = await context.newPage()
  const runTag = `QA${Date.now().toString().slice(-6)}`
  const title = `בדיקת יומן ${runTag}`          // unique, plain (no family/holiday collision)
  const TIME1 = '16:00'
  const TIME2 = '18:30'
  let target

  try {
    await openCalendarFresh(page, { clear: true })
    target = await targetDate(page)
    console.log(`target event: "${title}"  ${target.date} ${TIME1} → ${TIME2}\n`)

    // ── WRITE ────────────────────────────────────────────────────────────────
    await page.getByRole('button', { name: /הוספה ידנית/ }).first().click()
    await page.getByPlaceholder('שם האירוע...').fill(title)
    await page.locator('input[type="date"]').fill(target.date)
    await page.locator('input[type="time"]').fill(TIME1)
    await saveThroughConfirm(page)

    const afterWriteMirror = await readMirror(page)
    const written = afterWriteMirror.find((a) => a.title === title)
    rec('write.store', written && written.date === target.date && written.time === TIME1,
      written ? `stored date=${written.date} time=${written.time}` : 'event NOT in store after save')
    const idbAfterWrite = await readIndexedDb(page)
    rec('write.indexeddb', idbAfterWrite && idbAfterWrite.includes(title), idbAfterWrite ? 'present in abu-durable/kv' : 'MISSING from IndexedDB')

    // ── READBACK (UI, same session, no reload) ────────────────────────────────
    await clickDayCell(page, target.day)
    await page.getByText(title).first().waitFor({ state: 'visible', timeout: 10_000 })
    // EXACT time match scopes to the ApptCard's time div (renders exactly "16:00"), NOT the write
    // success toast ("קבעתי: …, בשעה 16:00") which is a longer, non-exact string.
    const readbackTimeShown = await page.getByText(TIME1, { exact: true }).first().isVisible().catch(() => false)
    rec('readback.ui', readbackTimeShown, readbackTimeShown ? `card shows "${title}" @ ${TIME1}` : `title shown but time ${TIME1} not visible`)

    // ── MODIFY (tap card → editing modal → change time → save) ─────────────────
    await page.getByText(title).first().click()                 // ApptCard onClick → editing modal
    await page.getByTestId('manual-save').waitFor({ state: 'visible', timeout: 10_000 })  // modal open
    await page.locator('input[type="time"]').fill(TIME2)
    await saveThroughConfirm(page)

    const afterModifyMirror = await readMirror(page)
    const modified = afterModifyMirror.find((a) => a.title === title)
    const modifiedOk = modified && modified.time === TIME2 && afterModifyMirror.filter((a) => a.title === title).length === 1
    rec('modify.store', modifiedOk, modified ? `time now ${modified.time} (single record, no duplicate)` : 'event lost after modify')

    // ── READBACK-2 (UI shows the modified time) ───────────────────────────────
    // The day sheet stays OPEN after the editing modal closes (the modal is a separate overlay),
    // and the calendar's reload() re-renders the card in place — so assert on the open sheet
    // directly. Re-clicking the day cell here would be intercepted by the open sheet overlay.
    await page.getByText(TIME2, { exact: true }).first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {})
    await page.getByText(title).first().waitFor({ state: 'visible', timeout: 10_000 })
    // EXACT match again — the card's time div is exactly "18:30"/"16:00"; the lingering write toast
    // ("…בשעה 16:00") is not an exact match, so this proves the CARD's time replaced (not duplicated).
    const newTimeShown = await page.getByText(TIME2, { exact: true }).first().isVisible().catch(() => false)
    const oldTimeGone = !(await page.getByText(TIME1, { exact: true }).first().isVisible().catch(() => false))
    rec('readback2.ui', newTimeShown && oldTimeGone, `new ${TIME2} shown=${newTimeShown}, old ${TIME1} gone=${oldTimeGone}`)

    // ── RELOAD (full reload — the modified event must survive from IndexedDB) ──
    await openCalendarFresh(page, { clear: false })
    const idbAfterReload = await readIndexedDb(page)
    const reloadMirror = await readMirror(page)
    const survived = reloadMirror.find((a) => a.title === title)
    rec('reload.persist', survived && survived.time === TIME2 && idbAfterReload && idbAfterReload.includes(TIME2),
      survived ? `survived reload @ ${survived.time}` : 'event GONE after reload')
    await clickDayCell(page, target.day)
    const survivedUi = await page.getByText(title).first().isVisible().catch(() => false)
    rec('reload.ui', survivedUi, survivedUi ? 'still rendered after reload' : 'not rendered after reload')
  } catch (e) {
    rec('harness', false, `threw: ${String(e?.message || e).slice(0, 180)}`)
    await page.screenshot({ path: resolve('docs/eval/RC_ACCEPTANCE_CALENDAR_FAIL.png') }).catch(() => {})
  } finally {
    await browser.close()
  }

  const passed = steps.filter((s) => s.pass).length
  const allPass = steps.length > 0 && passed === steps.length
  const summary = {
    $schema: 'internal://abu/rc-acceptance-calendar',
    rc: RC, when: new Date().toISOString(),
    event: { title, date: target?.date ?? null, time1: TIME1, time2: TIME2 },
    verdict: allPass ? 'PROVEN_PASS' : 'PROVEN_FAIL',
    evidenceClass: 'PREVIEW', // real deployed RC + real IndexedDB round-trip; device audibility not claimed
    passed, total: steps.length, steps,
  }
  writeFileSync(resolve('docs/eval/RC_ACCEPTANCE_CALENDAR.json'), JSON.stringify(summary, null, 2) + '\n')
  console.log(`\n=== ${summary.verdict}  ${passed}/${steps.length} ===`)
  console.log('wrote docs/eval/RC_ACCEPTANCE_CALENDAR.json')
  process.exit(allPass ? 0 : 1)
}
main().catch((e) => { console.error('calendar acceptance error:', e?.message || e); process.exit(1) })

import { test, expect } from '@playwright/test'

/**
 * Real-browser proof that the DurableStore persists critical data in IndexedDB
 * and restores the localStorage mirror after eviction across reloads.
 *
 * Flow: seed localStorage → reload (migrate → IndexedDB) → assert IndexedDB has
 * it → clear localStorage (eviction) → reload (restore mirror from IndexedDB) →
 * assert the data is back. Covers calendar appointments, reminders, and AbuAI
 * conversation memory.
 */
test('IndexedDB persistence: critical data survives reload + localStorage eviction', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const CAL = 'abubank-calendar-appointments'
  const REM = 'abu_reminders_v1'
  const CONV = 'abuai-conversation-history'

  // 1) Seed existing localStorage data (the pre-upgrade state).
  await page.evaluate(({ CAL, REM, CONV }) => {
    localStorage.setItem(CAL, JSON.stringify([{ id: 'pw1', title: 'רופא', date: '2026-06-22', time: '16:00', emoji: '🏥', color: '#C9A84C' }]))
    localStorage.setItem(REM, JSON.stringify([{ id: 'pwr1', title: 'כדור' }]))
    localStorage.setItem(CONV, JSON.stringify([{ role: 'user', content: 'שלום אבו' }]))
  }, { CAL, REM, CONV })

  // 2) Reload → durable.init() migrates localStorage → IndexedDB.
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(800)

  // 3) Assert the data is actually in IndexedDB (abu-durable / kv).
  const inIDB = await page.evaluate(() => new Promise<Record<string, string>>((resolve) => {
    const req = indexedDB.open('abu-durable')
    req.onsuccess = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('kv')) { resolve({}); return }
      const store = db.transaction('kv', 'readonly').objectStore('kv')
      const keysReq = store.getAllKeys()
      const valsReq = store.getAll()
      const out: Record<string, string> = {}
      keysReq.onsuccess = () => {
        valsReq.onsuccess = () => {
          (keysReq.result as IDBValidKey[]).forEach((k, i) => { out[String(k)] = (valsReq.result as string[])[i]! })
          resolve(out)
        }
      }
    }
    req.onerror = () => resolve({})
  }))
  expect(inIDB[CAL] ?? '').toContain('רופא')
  expect(inIDB[REM] ?? '').toContain('כדור')
  expect(inIDB[CONV] ?? '').toContain('שלום אבו')

  // 4) Evict the localStorage mirror (simulate eviction / clear).
  await page.evaluate(() => localStorage.clear())
  const afterClear = await page.evaluate((CAL) => localStorage.getItem(CAL), CAL)
  expect(afterClear).toBeNull()

  // 5) Reload → durable.init() restores the mirror from IndexedDB.
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(800)

  // 6) The data is back — restored from IndexedDB.
  const restored = await page.evaluate(({ CAL, REM, CONV }) => ({
    cal: localStorage.getItem(CAL),
    rem: localStorage.getItem(REM),
    conv: localStorage.getItem(CONV),
  }), { CAL, REM, CONV })
  expect(restored.cal ?? '').toContain('רופא')      // calendar appointment survived
  expect(restored.rem ?? '').toContain('כדור')      // reminder survived
  expect(restored.conv ?? '').toContain('שלום אבו') // conversation memory survived
})

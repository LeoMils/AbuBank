/**
 * J18 — AbuWeather smoke (happy + provider-fail). The open-meteo call is
 * intercepted so the test is deterministic: a valid forecast renders without
 * crashing; an aborted call degrades to the honest Hebrew error, never a blank or
 * infinite spinner. Closes the AbuWeather coverage gap (was 0 tests).
 */
import { test, expect, type Page } from '@playwright/test'

const OPEN_METEO = /api\.open-meteo\.com\/v1\/forecast/

function forecast() {
  const n = 24
  const arr = (v: number) => Array.from({ length: n }, () => v)
  const times = Array.from({ length: n }, (_, i) => `2026-08-03T${String(i).padStart(2, '0')}:00`)
  return {
    current_weather: { temperature: 24, windspeed: 10, weathercode: 0, is_day: 1, time: '2026-08-03T12:00' },
    hourly: { time: times, temperature_2m: arr(24), apparent_temperature: arr(25), precipitation_probability: arr(0), weathercode: arr(0), windspeed_10m: arr(10) },
    daily: { time: ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06'], weathercode: [0, 1, 2, 3], temperature_2m_max: [30, 31, 29, 28], temperature_2m_min: [20, 21, 19, 18], precipitation_sum: [0, 0, 1, 0], sunrise: ['2026-08-03T06:00', '2026-08-04T06:00', '2026-08-05T06:00', '2026-08-06T06:00'], sunset: ['2026-08-03T19:00', '2026-08-04T19:00', '2026-08-05T19:00', '2026-08-06T19:00'] },
  }
}
async function openWeather(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 })
  await page.getByRole('button', { name: /מזג אוויר/ }).first().click()
}

test('(happy) a valid forecast renders without crashing', async ({ page }) => {
  await page.route(OPEN_METEO, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(forecast()) }))
  await openWeather(page)
  // Resolves to data: the honest error is NOT shown and the loading text clears.
  await expect(page.getByText('לא הצלחתי לבדוק את מזג האוויר')).toHaveCount(0, { timeout: 15000 })
  await expect(page.getByText('טוענת מזג אוויר')).toHaveCount(0, { timeout: 15000 })
})

test('(provider-fail) an aborted forecast degrades to the honest Hebrew error', async ({ page }) => {
  await page.route(OPEN_METEO, (r) => r.abort())
  await openWeather(page)
  await expect(page.getByText(/לא הצלחתי לבדוק את מזג האוויר/)).toBeVisible({ timeout: 15000 })
})

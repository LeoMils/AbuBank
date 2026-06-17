import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'html',
  timeout: 60_000,
  expect: {
    timeout: 30_000,
  },
  use: {
    baseURL: process.env.PREVIEW_URL || 'http://localhost:5175',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    locale: 'he-IL',
    viewport: { width: 412, height: 870 },
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 412, height: 870 },
        locale: 'he-IL',
      },
    },
  ],
})

import { test, expect, Page } from '@playwright/test'
import path from 'path'

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots')

/** AI response timeout — generous for production LLM calls */
const AI_TIMEOUT = 30_000

/**
 * Helper: type a message in the AbuAI textarea and send it.
 * Waits for a new assistant response bubble to appear.
 */
async function sendChatMessage(page: Page, text: string) {
  const textarea = page.locator('textarea[placeholder]')
  await textarea.waitFor({ state: 'visible', timeout: 10_000 })
  await textarea.fill(text)

  // Count existing assistant messages before sending
  const beforeCount = await page.locator('div').filter({ hasText: /^אבו AI$/ }).count()

  // Press Enter to send
  await textarea.press('Enter')

  // Wait for a new assistant response to appear (the loading dots disappear
  // and a new bubble shows up). We detect this by waiting for the assistant
  // message count to increase.
  await page.waitForFunction(
    (prevCount) => {
      // Each assistant bubble is preceded by a label div containing "אבו AI".
      // We count those labels to know how many assistant messages exist.
      const labels = Array.from(document.querySelectorAll('div')).filter(
        (el) => el.textContent?.trim() === 'אבו AI' && el.children.length === 0
      )
      return labels.length > prevCount
    },
    beforeCount,
    { timeout: AI_TIMEOUT }
  )
}

/**
 * Get the text content of the last assistant message bubble.
 */
async function getLastAssistantMessage(page: Page): Promise<string> {
  // Assistant messages are right-aligned (alignItems: flex-end) with a label "אבו AI"
  // above the bubble. We find all such label divs, take the last one, then get the
  // sibling bubble's text content.
  const text = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('div')).filter(
      (el) => el.textContent?.trim() === 'אבו AI' && el.children.length === 0
    )
    if (labels.length === 0) return ''
    const lastLabel = labels[labels.length - 1]
    // The bubble is the next sibling of the label
    const bubble = lastLabel.nextElementSibling
    return bubble?.textContent?.trim() ?? ''
  })
  return text
}

test.describe('AbuBank Production Smoke Tests', () => {
  test.describe.configure({ mode: 'serial' })

  let page: Page

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 412, height: 870 },
      locale: 'he-IL',
    })
    page = await context.newPage()
  })

  test.afterAll(async () => {
    await page.context().close()
  })

  test('Scenario 1: General Knowledge — ask about the French Revolution', async () => {
    // Navigate to the app
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })

    // Wait for the home screen to load — look for the Abu AI footer item
    const aiButton = page.locator('text=Abu AI').first()
    await aiButton.waitFor({ state: 'visible', timeout: 15_000 })

    // Tap the Abu AI button
    await aiButton.click()

    // Wait for AbuAI screen to load — the textarea should appear
    const textarea = page.locator('textarea[placeholder]')
    await textarea.waitFor({ state: 'visible', timeout: 10_000 })

    // Send the question
    await sendChatMessage(page, 'מהי המהפכה הצרפתית')

    // Get the response and verify it is not empty
    const response = await getLastAssistantMessage(page)
    expect(response.length).toBeGreaterThan(0)

    // Take screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-general-knowledge.png'),
      fullPage: true,
    })
  })

  test('Scenario 2: Calendar Read — ask what is on the calendar this week', async () => {
    await sendChatMessage(page, 'מה יש לי השבוע ביומן')

    const response = await getLastAssistantMessage(page)
    expect(response.length).toBeGreaterThan(0)

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-calendar-read.png'),
      fullPage: true,
    })
  })

  test('Scenario 3: Calendar Create — schedule an appointment', async () => {
    await sendChatMessage(page, 'תקבע לי פגישה מחר בשלוש עם מוטי')

    const response = await getLastAssistantMessage(page)
    expect(response.length).toBeGreaterThan(0)

    // The response should mention appointment details (time, name, or confirmation prompt)
    const hasDetails =
      response.includes('מוטי') ||
      response.includes('15:00') ||
      response.includes('שלוש') ||
      response.includes('פגישה') ||
      response.includes('לקבוע') ||
      response.includes('מחר')
    expect(hasDetails).toBe(true)

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-calendar-create.png'),
      fullPage: true,
    })
  })

  test('Scenario 4: Calendar Confirm — confirm the appointment', async () => {
    await sendChatMessage(page, 'כן')

    const response = await getLastAssistantMessage(page)
    expect(response.length).toBeGreaterThan(0)

    // Look for confirmation language
    const hasConfirmation =
      response.includes('קבעתי') ||
      response.includes('נקבע') ||
      response.includes('רשמתי') ||
      response.includes('הוספתי') ||
      response.includes('ביומן') ||
      response.includes('נוצר')
    expect(hasConfirmation).toBe(true)

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04-calendar-confirm.png'),
      fullPage: true,
    })
  })

  test('Scenario 5: Calendar Read-Back — verify the appointment appears', async () => {
    await sendChatMessage(page, 'מה קבעתי מחר')

    const response = await getLastAssistantMessage(page)
    expect(response.length).toBeGreaterThan(0)

    // Verify the response mentions the appointment details
    const mentionsAppointment =
      response.includes('מוטי') ||
      response.includes('15:00') ||
      response.includes('שלוש') ||
      response.includes('פגישה')
    expect(mentionsAppointment).toBe(true)

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '05-calendar-readback.png'),
      fullPage: true,
    })
  })
})

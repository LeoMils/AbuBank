# AbuBank E2E Smoke Tests

Playwright tests that run against a deployed (or local) AbuBank instance.

## Prerequisites

Install Playwright and the Chromium browser:

```bash
npx playwright install chromium
```

## Running

### Against local dev server

```bash
PREVIEW_URL=http://localhost:5175 npx playwright test e2e/
```

### Against a Vercel preview deployment

```bash
PREVIEW_URL=https://abu-bank-xxx.vercel.app npx playwright test e2e/
```

### Headed mode (see the browser)

```bash
PREVIEW_URL=http://localhost:5175 npx playwright test e2e/ --headed
```

### View the HTML report after a run

```bash
npx playwright show-report
```

## Screenshots

Screenshots are saved to `e2e/screenshots/` after each scenario:

- `01-general-knowledge.png`
- `02-calendar-read.png`
- `03-calendar-create.png`
- `04-calendar-confirm.png`
- `05-calendar-readback.png`

## Test Scenarios

1. **General Knowledge** -- Navigate to Abu AI, ask about the French Revolution, verify response.
2. **Calendar Read** -- Ask what is on the calendar this week.
3. **Calendar Create** -- Request an appointment with Moti tomorrow at 3.
4. **Calendar Confirm** -- Confirm the appointment with "yes".
5. **Calendar Read-Back** -- Ask what is scheduled for tomorrow, verify the appointment appears.

All tests run serially in a single browser context to maintain conversation state.

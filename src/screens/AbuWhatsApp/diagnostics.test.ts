/*
 * Diagnostics added in fix/abuwhatsapp-flip-local-contacts:
 *   1. Operator status line in FamilyContactsSetup that counts contacts
 *      whose enabled flag is true AND whose phoneE164/whatsappE164
 *      passes the E.164 validator.
 *   2. Subtitle hint on the AbuWhatsApp grid header.
 *   3. Runtime listeners on FamilyQuickFaces that re-read localStorage on
 *      storage / focus / visibilitychange events.
 *
 * Source-contract tests only (vitest runs in node env, no DOM rendering).
 */

import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'

const PROJECT_ROOT = path.resolve(__dirname, '../../..')
const facesSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'src/screens/AbuWhatsApp/familyQuickFaces.tsx'), 'utf8')
const setupSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'src/screens/AbuWhatsApp/FamilyContactsSetup.tsx'), 'utf8')

describe('Operator setup — active-count diagnostic line', () => {
  it('renders the diagnostic block with data-testid="setup-active-count"', () => {
    expect(setupSrc.includes('data-testid="setup-active-count"')).toBe(true)
    expect(setupSrc.includes('data-active-count={activeCount}')).toBe(true)
  })

  it('positive copy mentions both N and the right Hebrew text', () => {
    expect(setupSrc.includes('`נשמרו ${activeCount} אנשי קשר פעילים במכשיר הזה`')).toBe(true)
  })

  it('zero-state copy is verbatim', () => {
    expect(setupSrc.includes("'לא נשמרו עדיין אנשי קשר במכשיר הזה'")).toBe(true)
  })

  it('count consults isValidPhoneE164 (not just truthy phone string)', () => {
    // The counter must use the validator on phoneE164 OR whatsappE164.
    expect(/activeCount[\s\S]{0,400}isValidPhoneE164\(c\.phoneE164\)/.test(setupSrc)).toBe(true)
    expect(/activeCount[\s\S]{0,400}isValidPhoneE164\(c\.whatsappE164\)/.test(setupSrc)).toBe(true)
  })

  it('does NOT print any phone digits in the rendered status', () => {
    // The status div must not interpolate phoneE164 or whatsappE164 values.
    expect(/setup-active-count[\s\S]{0,800}\{c\.phoneE164/.test(setupSrc)).toBe(false)
    expect(/setup-active-count[\s\S]{0,800}\{c\.whatsappE164/.test(setupSrc)).toBe(false)
  })
})

describe('Header is clean — no extra copy under the subtitle', () => {
  it('grid hint copy "לחיצה על תמונה פותחת פעולות" is removed from the Martita header', () => {
    // The hint string and its testid are gone; the header is title + subtitle only.
    expect(facesSrc.includes('לחיצה על תמונה פותחת פעולות')).toBe(false)
    expect(facesSrc.includes('data-testid="abuwhatsapp-grid-hint"')).toBe(false)
  })

  it('build version line is removed from the Martita header (testid + APP_VERSION usage gone)', () => {
    expect(facesSrc.includes('abuwhatsapp-build-version')).toBe(false)
    expect(facesSrc.includes('APP_VERSION')).toBe(false)
  })

  it('subtitle "למי לשלוח הודעה?" still renders right under the title', () => {
    expect(facesSrc.includes('למי לשלוח הודעה?')).toBe(true)
    const titleIdx = facesSrc.indexOf('Abu WhatsApp')
    const subtitleIdx = facesSrc.indexOf('למי לשלוח הודעה?')
    expect(titleIdx).toBeGreaterThan(-1)
    expect(subtitleIdx).toBeGreaterThan(titleIdx)
  })
})

describe('Runtime hardening — FamilyQuickFaces re-reads storage on env events', () => {
  it('subscribes to the window "storage" event for cross-tab sync', () => {
    expect(facesSrc.includes("window.addEventListener('storage'")).toBe(true)
    expect(facesSrc.includes("window.removeEventListener('storage'")).toBe(true)
  })

  it('subscribes to window focus and document visibilitychange', () => {
    expect(facesSrc.includes("window.addEventListener('focus'")).toBe(true)
    expect(facesSrc.includes("document.addEventListener('visibilitychange'")).toBe(true)
  })

  it('storage event filters on the canonical storage key (or a clear-all event with key=null)', () => {
    expect(/e\.key === null \|\| e\.key === ['"]abubank\.familyContacts\.v1['"]/.test(facesSrc)).toBe(true)
  })

  it('visibility refresh only happens when the tab becomes visible', () => {
    expect(/if \(document\.visibilityState === ['"]visible['"]\) refresh\(\)/.test(facesSrc)).toBe(true)
  })

  it('cleanup detaches all three listeners', () => {
    expect(facesSrc.includes("window.removeEventListener('focus'")).toBe(true)
    expect(facesSrc.includes("document.removeEventListener('visibilitychange'")).toBe(true)
  })

  it('test-injected localContacts prop still short-circuits storage reads', () => {
    expect(/if \(localContacts !== undefined\)\s*\{\s*setContacts\(localContacts\); return \}/.test(facesSrc)).toBe(true)
  })
})

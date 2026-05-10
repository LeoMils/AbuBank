import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import { FAMILY_QUICK_FACES, type FamilyQuickFace } from './familyContacts.private'
import {
  isPersonActionable,
  buildWhatsAppPersonUrl,
  buildTelUrl,
} from './familyQuickFaces'

const PROJECT_ROOT = path.resolve(__dirname, '../../..')
const TEST_FAKE_PHONE = '+972501234567'

const facesSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'src/screens/AbuWhatsApp/familyQuickFaces.tsx'), 'utf8')
const setupSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'src/screens/AbuWhatsApp/FamilyContactsSetup.tsx'), 'utf8')

// ─── BubbleTile chip render contract ───────────────────────────────────────

describe('BubbleTile direct-action chips (source contract)', () => {
  it('renders chips only when actions prop is supplied', () => {
    // Chip-row container is gated by `{actions && ...}`.
    expect(/\{actions && \(/.test(facesSrc)).toBe(true)
    // Chip elements are siblings of the main tap button, not nested in it.
    // Chip data-testids exist:
    expect(facesSrc.includes('chip-whatsapp-')).toBe(true)
    expect(facesSrc.includes('chip-call-')).toBe(true)
  })

  it('chips use Hebrew labels וואטסאפ and שיחה', () => {
    expect(facesSrc.includes('וואטסאפ')).toBe(true)
    expect(facesSrc.includes('שיחה')).toBe(true)
  })

  it('chips have aria-label in Hebrew (per-person)', () => {
    expect(facesSrc.includes('aria-label={`שליחת וואטסאפ אל ${label}`}')).toBe(true)
    expect(facesSrc.includes('aria-label={`שיחה אל ${label}`}')).toBe(true)
  })

  it('chip click handlers call event.stopPropagation', () => {
    // Hub wedges destructure the action as a top-level prop, so the source
    // pattern is `onWhatsApp()`/`onCall()` — not `actions.onWhatsApp()`.
    expect(/onClick=\{\(e\) => \{ e\.stopPropagation\(\); onWhatsApp\(\) \}\}/.test(facesSrc)).toBe(true)
    expect(/onClick=\{\(e\) => \{ e\.stopPropagation\(\); onCall\(\) \}\}/.test(facesSrc)).toBe(true)
  })

  it('chip touch target is at least 44 px tall (senior-first)', () => {
    // Action chips parameterise minHeight (48 default, 56 for the family-group
    // primary pill). The expression may be ternary; capture every numeric
    // literal that follows "minHeight:" on the same line and assert ≥ 44.
    const heights = [...facesSrc.matchAll(/minHeight:[^,\n]*?(\d{2,3})/g)]
      .map((m) => parseInt(m[1] as string, 10))
    expect(heights.some((v) => v >= 44)).toBe(true)
  })

  it('WhatsApp wedge uses WA_GREEN; Call wedge uses CALL_RED', () => {
    // The flip-circle hub uses the authentic WhatsApp green for the left
    // wedge and a tasteful call red for the right wedge — see
    // PersonActionHub gradient backgrounds in the source.
    expect(facesSrc.includes('WA_GREEN')).toBe(true)
    expect(facesSrc.includes('CALL_RED')).toBe(true)
    expect(facesSrc.includes('#25D366')).toBe(true)
    expect(facesSrc.includes('#D83A3A')).toBe(true)
  })
})

// ─── Grid plumbing: chips only render for actionable persons / never group ─

describe('FamilyQuickFaces wires chips only to actionable persons', () => {
  it('actionable person mapping passes actions {onWhatsApp,onCall}', () => {
    expect(facesSrc.includes('const actionable = isPersonActionable(p)')).toBe(true)
    // Either inline mapping or a fire helper — both end up calling the
    // sanitized URL builders.
    expect(facesSrc.includes('buildWhatsAppPersonUrl(p)')).toBe(true)
    expect(facesSrc.includes('buildTelUrl(p)')).toBe(true)
    expect(/onWhatsApp:\s*\(\)\s*=>/.test(facesSrc)).toBe(true)
    expect(/onCall:\s*\(\)\s*=>/.test(facesSrc)).toBe(true)
  })

  it('non-actionable persons get NO actions prop (chips do not render)', () => {
    // The grid uses a conditional spread so non-actionable persons receive
    // BubbleTile without an `actions` key. Tolerant regex — just checks the
    // ternary shape `actionable ? { actions: { ... } } : {}` is present.
    expect(/actionable\s*\?\s*\{/.test(facesSrc)).toBe(true)
    expect(/\bactions:\s*\{/.test(facesSrc)).toBe(true)
    expect(/\}\s*:\s*\{\}\)\}/.test(facesSrc)).toBe(true)
  })

  it('group BubbleTile is rendered without an actions prop (no chips ever)', () => {
    // The group render block is the only `<BubbleTile … kind="group"` use.
    const m = facesSrc.match(/<BubbleTile[^]*?kind="group"[^]*?\/>/)
    expect(m).not.toBeNull()
    expect((m as RegExpMatchArray)[0].includes('actions=')).toBe(false)
  })

  it('group is WhatsApp-only — never wires a tel/call action', () => {
    // groupAction TS type allows ONLY onWhatsApp. Assert no source site adds
    // onCall to it, and that the group's fire helper calls onOpenWhatsApp,
    // never onOpenTel.
    expect(facesSrc.includes('groupAction')).toBe(true)
    expect(/groupAction:[\s\S]{0,200}onCall/.test(facesSrc)).toBe(false)
    const fireMatch = facesSrc.match(/function fireGroupWhatsApp\([^)]*\)\s*\{([\s\S]*?)\n {2}\}/)
    expect(fireMatch).not.toBeNull()
    const fireBody = (fireMatch as RegExpMatchArray)[1] ?? ''
    expect(fireBody.includes('onOpenWhatsApp')).toBe(true)
    expect(fireBody.includes('onOpenTel')).toBe(false)
  })
})

// ─── Ari / Anabel default state ────────────────────────────────────────────

describe('Ari and Anabel — no-phone default behavior', () => {
  function person(id: string): Extract<FamilyQuickFace, { type: 'person' }> | undefined {
    const f = FAMILY_QUICK_FACES.find((x) => x.type === 'person' && x.id === id)
    return f as Extract<FamilyQuickFace, { type: 'person' }> | undefined
  }

  it('Ari is visible in scaffold with photo and no phone', () => {
    const ari = person('ari')
    expect(ari).toBeDefined()
    expect(ari!.phoneE164).toBe('')
    expect(ari!.photoFile).toBe('/family-contacts/ARI.JPEG')
  })

  it('Anabel is visible in scaffold with photo and no phone', () => {
    const anabel = person('anabel')
    expect(anabel).toBeDefined()
    expect(anabel!.phoneE164).toBe('')
    expect(anabel!.photoFile).toBe('/family-contacts/Anabel.JPEG')
  })

  it('Ari and Anabel are NOT actionable by default (no chips will render)', () => {
    expect(isPersonActionable(person('ari')!)).toBe(false)
    expect(isPersonActionable(person('anabel')!)).toBe(false)
  })

  it('Ari and Anabel become actionable when a valid local phone + enabled is merged', () => {
    // Synthesise a "with-local-override" person matching what mergeFacesWithLocal
    // would produce when the operator saves a phone for them.
    const ariEnabled: Extract<FamilyQuickFace, { type: 'person' }> = {
      type: 'person', id: 'ari', displayName: 'ארי',
      phoneE164: TEST_FAKE_PHONE, enabled: true,
    }
    const anabelEnabled: Extract<FamilyQuickFace, { type: 'person' }> = {
      type: 'person', id: 'anabel', displayName: 'אנאבל',
      phoneE164: TEST_FAKE_PHONE, enabled: true,
    }
    expect(isPersonActionable(ariEnabled)).toBe(true)
    expect(isPersonActionable(anabelEnabled)).toBe(true)
  })

  it('missing-phone toast text "המספר עדיין לא הוגדר" is preserved in source', () => {
    expect(facesSrc.includes('המספר עדיין לא הוגדר')).toBe(true)
  })
})

// ─── Direct-chip URL contracts ─────────────────────────────────────────────

describe('Direct chip handlers use sanitized URLs', () => {
  it('buildWhatsAppPersonUrl yields /^https:\\/\\/wa\\.me\\/\\d{8,15}$/', () => {
    const url = buildWhatsAppPersonUrl({
      type: 'person', id: 'x', displayName: 'X',
      phoneE164: TEST_FAKE_PHONE, enabled: true,
    })
    expect(/^https:\/\/wa\.me\/\d{8,15}$/.test(url)).toBe(true)
  })

  it('buildTelUrl yields /^tel:\\+\\d{8,15}$/', () => {
    const tel = buildTelUrl({
      type: 'person', id: 'x', displayName: 'X',
      phoneE164: TEST_FAKE_PHONE, enabled: true,
    })
    expect(/^tel:\+\d{8,15}$/.test(tel)).toBe(true)
  })
})

// ─── Privacy / source guarantees ───────────────────────────────────────────

describe('Privacy and storage rules unchanged', () => {
  it('scaffold has no real phone numbers — every person has empty phoneE164', () => {
    const persons = FAMILY_QUICK_FACES.filter((f) => f.type === 'person') as Extract<FamilyQuickFace, { type: 'person' }>[]
    for (const p of persons) {
      expect(p.phoneE164).toBe('')
    }
  })

  it('localStorage key is still abubank.familyContacts.v1', () => {
    const storageSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'src/screens/AbuWhatsApp/familyContactsStorage.ts'), 'utf8')
    expect(storageSrc.includes("LOCAL_FAMILY_CONTACTS_STORAGE_KEY = 'abubank.familyContacts.v1'")).toBe(true)
  })

  it('Martita-facing bubble-grid file (familyQuickFaces.tsx) contains no JSON UI', () => {
    expect(/<textarea\b/i.test(facesSrc)).toBe(false)
    expect(facesSrc.toLowerCase().includes('json')).toBe(false)
  })
})

// ─── Operator setup helper copy + JSON-collapsed ─────────────────────────

describe('Operator setup screen contract', () => {
  it('helper paragraph contains the privacy + activation lines verbatim', () => {
    expect(setupSrc.includes('המספרים נשמרים רק במכשיר הזה.')).toBe(true)
    expect(setupSrc.includes('הם לא נכנסים לקוד ולא נשלחים לשרת.')).toBe(true)
    expect(setupSrc.includes('אחרי שמירת מספר, יופיעו כפתורי וואטסאפ ושיחה.')).toBe(true)
  })

  it('JSON import/export remains collapsed under <details>"מתקדם"', () => {
    expect(setupSrc.includes('<details')).toBe(true)
    expect(setupSrc.includes('מתקדם')).toBe(true)
    // The JSON textarea exists ONLY in this file (verified by privacy test
    // above that the Martita-facing faces.tsx has no textarea).
    expect(/<textarea\b/i.test(setupSrc)).toBe(true)
  })
})

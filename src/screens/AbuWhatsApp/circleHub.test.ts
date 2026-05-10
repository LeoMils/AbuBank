/*
 * Source contract for the AbuWhatsApp circular flip-card "Action Hub" —
 * front side is photo + name (unchanged), back side is a 144 px disc with
 * a WhatsApp green LEFT wedge, a Call red RIGHT wedge, and a soft-cream
 * centre identity circle for persons; or a single full-circle WhatsApp
 * button with a small "המשפחה" badge for the family group.
 *
 * vitest runs in node env (no DOM), so each assertion is a static-source
 * check designed to pin the contract without painting pixels.
 */

import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'

const PROJECT_ROOT = path.resolve(__dirname, '../../..')
const facesSrc = fs.readFileSync(
  path.join(PROJECT_ROOT, 'src/screens/AbuWhatsApp/familyQuickFaces.tsx'),
  'utf8',
)

describe('Circular Action Hub — top-level component definitions', () => {
  it('PersonActionHub is defined exactly once with onWhatsApp / onCall / onCenter props', () => {
    const matches = facesSrc.match(/function PersonActionHub\b/g) ?? []
    expect(matches.length).toBe(1)
    expect(facesSrc.includes('onWhatsApp: () => void')).toBe(true)
    expect(facesSrc.includes('onCall: () => void')).toBe(true)
    expect(facesSrc.includes('onCenter: () => void')).toBe(true)
  })

  it('GroupActionHub is defined exactly once and only takes onWhatsApp + onCenter', () => {
    const matches = facesSrc.match(/function GroupActionHub\b/g) ?? []
    expect(matches.length).toBe(1)
    // GroupActionHub's TS prop block must NOT mention onCall.
    const m = facesSrc.match(/function GroupActionHub\([\s\S]*?\}\)\s*\{/)
    expect(m).not.toBeNull()
    const propBlock = (m as RegExpMatchArray)[0]
    expect(propBlock.includes('onWhatsApp')).toBe(true)
    expect(propBlock.includes('onCenter')).toBe(true)
    expect(propBlock.includes('onCall')).toBe(false)
  })

  it('BubbleTile back face renders PersonActionHub when actions are present', () => {
    expect(facesSrc.includes('<PersonActionHub')).toBe(true)
    expect(facesSrc.includes('<GroupActionHub')).toBe(true)
    // Old stacked-pill component is gone.
    expect(facesSrc.includes('<ActionChip')).toBe(false)
    expect(facesSrc.includes('function ActionChip(')).toBe(false)
  })
})

describe('Circular Action Hub — colour contract', () => {
  it('exports the WhatsApp green and the call red as named constants', () => {
    expect(facesSrc.includes("const WA_GREEN = '#25D366'")).toBe(true)
    expect(facesSrc.includes("const CALL_RED = '#D83A3A'")).toBe(true)
    expect(facesSrc.includes("const CALL_RED_DEEP = '#A81F1F'")).toBe(true)
  })

  it('PersonActionHub left wedge uses a WA_GREEN gradient; right wedge uses a CALL_RED gradient', () => {
    const fnMatch = facesSrc.match(/function PersonActionHub\([\s\S]*?\n\}\n/)
    expect(fnMatch).not.toBeNull()
    const body = (fnMatch as RegExpMatchArray)[0]
    expect(body.includes('linear-gradient(135deg, ${WA_GREEN}')).toBe(true)
    expect(body.includes('linear-gradient(135deg, ${CALL_RED}')).toBe(true)
  })

  it('Center identity circle uses the cream + ink palette', () => {
    expect(facesSrc.includes("const CENTER_CREAM = '#F5EBD2'")).toBe(true)
    expect(facesSrc.includes("const CENTER_INK = '#0c1f33'")).toBe(true)
  })
})

describe('Circular Action Hub — wedge geometry & accessibility', () => {
  it('FLIPPED card footprint is at least 140 px (preserves grid balance, gives wedge room)', () => {
    const m = facesSrc.match(/FLIPPED_CARD_W\s*=\s*(\d+)/)
    const px = parseInt((m as RegExpMatchArray)[1] as string, 10)
    expect(px).toBeGreaterThanOrEqual(140)
    expect(px).toBeLessThanOrEqual(160)
  })

  it('Wedges are senior-friendly — minHeight 44, large icons (≥ 24 px), Hebrew labels', () => {
    const fnMatch = facesSrc.match(/function PersonActionHub\([\s\S]*?\n\}\n/)
    expect(fnMatch).not.toBeNull()
    const body = (fnMatch as RegExpMatchArray)[0]
    expect(body.includes('minHeight: 44')).toBe(true)
    // HubWhatsAppIcon and HubCallIcon are summoned at size 26 in person hub
    // (32 in group hub) — both ≥ 24 px tall.
    expect(body.includes('size={26}')).toBe(true)
    expect(body.includes('וואטסאפ')).toBe(true)
    expect(body.includes('שיחה')).toBe(true)
    // No English text labels rendered to Martita. (Component identifiers
    // like `HubWhatsAppIcon` are fine; we look for `<span>WhatsApp</span>`
    // or `>WhatsApp<` style JSX text.)
    expect(/>WhatsApp</.test(body)).toBe(false)
    expect(/>Call</.test(body)).toBe(false)
  })

  it('Person hub aria-labels are Hebrew, per-person (interpolated label)', () => {
    expect(facesSrc.includes('aria-label={`שליחת וואטסאפ אל ${label}`}')).toBe(true)
    expect(facesSrc.includes('aria-label={`שיחה אל ${label}`}')).toBe(true)
  })

  it('Center identity has a name + a small heart icon', () => {
    const fnMatch = facesSrc.match(/function PersonActionHub\([\s\S]*?\n\}\n/)
    expect(fnMatch).not.toBeNull()
    const body = (fnMatch as RegExpMatchArray)[0]
    expect(body.includes('<HubHeartIcon')).toBe(true)
    // Centre renders {label} inside the centre button.
    expect(/bubble-hub-center-[\s\S]{0,400}\{label\}/.test(body)).toBe(true)
  })
})

describe('Circular Action Hub — event handling and flip-back contract', () => {
  it('Each wedge stops propagation BEFORE firing its action', () => {
    expect(/onClick=\{\(e\) => \{ e\.stopPropagation\(\); onWhatsApp\(\) \}\}/.test(facesSrc)).toBe(true)
    expect(/onClick=\{\(e\) => \{ e\.stopPropagation\(\); onCall\(\) \}\}/.test(facesSrc)).toBe(true)
  })

  it('Center identity onClick stops propagation then calls onCenter (= flip-back)', () => {
    expect(/onClick=\{\(e\) => \{ e\.stopPropagation\(\); onCenter\(\) \}\}/.test(facesSrc)).toBe(true)
  })

  it('BubbleTile passes onFlipBack as the hub onCenter handler', () => {
    expect(facesSrc.includes('onCenter={onFlipBack}')).toBe(true)
  })

  it('Back-face wrapper still fires onFlipBack on its own background click', () => {
    expect(/data-face="back"[\s\S]{0,500}onClick=\{\(e\) => \{ e\.stopPropagation\(\); onFlipBack\(\) \}\}/.test(facesSrc)).toBe(true)
  })
})

describe('Circular Action Hub — group-only constraint', () => {
  it('GroupActionHub renders ONE chip-whatsapp- testid and ZERO chip-call-', () => {
    const m = facesSrc.match(/function GroupActionHub\([\s\S]*?\n\}\n/)
    expect(m).not.toBeNull()
    const body = (m as RegExpMatchArray)[0]
    expect(body.includes('chip-whatsapp-')).toBe(true)
    expect(body.includes('chip-call-')).toBe(false)
    expect(body.includes('onCall')).toBe(false)
  })

  it('GroupActionHub uses a green radial gradient (WA_GREEN), no red anywhere', () => {
    const m = facesSrc.match(/function GroupActionHub\([\s\S]*?\n\}\n/)
    const body = (m as RegExpMatchArray)[0]
    expect(body.includes('WA_GREEN')).toBe(true)
    expect(body.includes('CALL_RED')).toBe(false)
  })

  it('Group rendering still passes only groupAction (WhatsApp-only), never `actions:`', () => {
    const groupBlock = facesSrc.match(/<BubbleTile[\s\S]*?kind="group"[\s\S]*?\/>/)
    expect(groupBlock).not.toBeNull()
    const block = (groupBlock as RegExpMatchArray)[0]
    expect(block.includes('groupAction:')).toBe(true)
    expect(/\bactions:\s*\{/.test(block)).toBe(false)
  })
})

describe('Circular Action Hub — front face is unchanged (no permanent buttons)', () => {
  it('Front face contains BubbleAvatar + {label} and NO chip-* button', () => {
    const tileStart = facesSrc.indexOf('export function BubbleTile')
    expect(tileStart).toBeGreaterThan(-1)
    const backIdx = facesSrc.indexOf('data-face="back"', tileStart)
    const frontSlice = facesSrc.slice(tileStart, backIdx)
    expect(frontSlice.includes('<BubbleAvatar')).toBe(true)
    // Front face must NOT render a chip-* button or hub component.
    expect(frontSlice.includes('chip-whatsapp-')).toBe(false)
    expect(frontSlice.includes('chip-call-')).toBe(false)
    expect(frontSlice.includes('PersonActionHub')).toBe(false)
    expect(frontSlice.includes('GroupActionHub')).toBe(false)
  })
})

describe('Circular Action Hub — testid surface for QA tooling', () => {
  it('Hub testids: bubble-hub-person-, bubble-hub-group-, bubble-hub-center-', () => {
    expect(facesSrc.includes('`bubble-hub-person-${id}`')).toBe(true)
    expect(facesSrc.includes('`bubble-hub-group-${id}`')).toBe(true)
    expect(facesSrc.includes('`bubble-hub-center-${id}`')).toBe(true)
  })

  it('Wedge data-attributes expose wedge kind for screenshot tooling', () => {
    expect(facesSrc.includes('data-hub-wedge="whatsapp"')).toBe(true)
    expect(facesSrc.includes('data-hub-wedge="call"')).toBe(true)
    expect(facesSrc.includes('data-hub-kind="person"')).toBe(true)
    expect(facesSrc.includes('data-hub-kind="group"')).toBe(true)
  })
})

describe('Circular Action Hub — privacy + storage invariants unchanged', () => {
  it('localStorage key is locked', () => {
    const storageSrc = fs.readFileSync(
      path.join(PROJECT_ROOT, 'src/screens/AbuWhatsApp/familyContactsStorage.ts'),
      'utf8',
    )
    expect(storageSrc.includes("'abubank.familyContacts.v1'")).toBe(true)
  })

  it('scaffold still commits zero non-empty phoneE164 literals', () => {
    const scaffold = fs.readFileSync(
      path.join(PROJECT_ROOT, 'src/screens/AbuWhatsApp/familyContacts.private.ts'),
      'utf8',
    )
    const lines = scaffold.match(/phoneE164:\s*'[^']*'/g) ?? []
    expect(lines.length).toBeGreaterThan(0)
    for (const l of lines) expect(l).toMatch(/phoneE164:\s*''/)
  })

  it('reduced-motion path is still respected on the back face wrapper', () => {
    expect(facesSrc.includes('reducedMotion ? (flipped ? 1 : 0) : 1')).toBe(true)
    expect(facesSrc.includes('usePrefersReducedMotion')).toBe(true)
  })
})

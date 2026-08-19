import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import {
  buildTelUrl,
  buildWhatsAppPersonUrl,
  GENERIC_MISSING_PHONE_TOAST,
  ARI_ANABEL_NO_PHONE_TOAST,
  getMissingPhoneMessage,
  isPersonActionable,
  isGroupActionable,
} from './familyQuickFaces'
import { FAMILY_QUICK_FACES, type FamilyQuickFace } from './familyContacts.private'

const PROJECT_ROOT = path.resolve(__dirname, '../../..')
const TEST_FAKE_PHONE = '+972501234567'

const facesSrc = fs.readFileSync(
  path.join(PROJECT_ROOT, 'src/screens/AbuWhatsApp/familyQuickFaces.tsx'),
  'utf8',
)

// ─── Default state — no permanent action UI ────────────────────────────────

describe('flip-card default state — clean photo + name', () => {
  it('the front face renders BubbleAvatar followed by {label}, with no chip on the front', () => {
    const tileStart = facesSrc.indexOf('export function BubbleTile')
    expect(tileStart).toBeGreaterThan(-1)
    // Slice up to the back face (data-face="back") so we only inspect the front.
    const backIdx = facesSrc.indexOf('data-face="back"', tileStart)
    expect(backIdx).toBeGreaterThan(tileStart)
    const frontSlice = facesSrc.slice(tileStart, backIdx)
    expect(frontSlice.includes('<BubbleAvatar')).toBe(true)
    expect(frontSlice.search(/>\s*\{label\}\s*</)).toBeGreaterThan(-1)
    // The front face must NOT render any chip-* button.
    expect(frontSlice.includes('chip-whatsapp-')).toBe(false)
    expect(frontSlice.includes('chip-call-')).toBe(false)
    expect(frontSlice.includes('ActionChip')).toBe(false)
  })

  it('grid wrapper has a backdrop click handler that closes the active card', () => {
    expect(facesSrc.includes('handleBackdropClick')).toBe(true)
    // The handler closes the flip only when the click target IS the wrapper.
    expect(/handleBackdropClick[\s\S]{0,150}e\.target === e\.currentTarget[\s\S]{0,80}closeFlip/.test(facesSrc)).toBe(true)
  })
})

// ─── Tap behaviour — flip toggle, single source of truth ───────────────────

describe('flip-card tap behaviour', () => {
  it('persons open the focused-contact state; the family group still flips in place', () => {
    expect(facesSrc.includes('setFocusedFace')).toBe(true)
    // The group keeps its in-place flip toggle.
    expect(/setActiveFlippedId\(\(prev\) => \(prev === ['"]family-group['"] \? null : ['"]family-group['"]\)\)/.test(facesSrc)).toBe(true)
    // handleTapPerson opens focus (no person flip toggle anymore).
    const m = facesSrc.match(/function handleTapPerson\([^)]*\)\s*\{([\s\S]*?)\n {2}\}/)
    const body = (m as RegExpMatchArray)[1] ?? ''
    expect(body.includes('setFocusedFace(face)')).toBe(true)
  })

  it('handleTapPerson opens the focused-contact state for every person (actionable or not)', () => {
    const m = facesSrc.match(/function handleTapPerson\([^)]*\)\s*\{([\s\S]*?)\n {2}\}/)
    expect(m).not.toBeNull()
    const body = (m as RegExpMatchArray)[1] ?? ''
    expect(body.includes('setFocusedFace(face)')).toBe(true)
    // No person-flip toggle (prev === face.id) remains.
    expect(/prev === face\.id/.test(body)).toBe(false)
  })

  it('persons render flipped={false}; only the group binds to activeFlippedId', () => {
    expect(facesSrc.includes('flipped={false}')).toBe(true)
    expect(facesSrc.includes("flipped={activeFlippedId === 'family-group'}")).toBe(true)
  })
})

// ─── Flip-back behaviour ────────────────────────────────────────────────────

describe('flip-back behaviour — back face background closes', () => {
  it('back-face wrapper onClick fires onFlipBack with stopPropagation', () => {
    // The back face must intercept clicks so they don't bubble to the grid
    // backdrop, then call onFlipBack to flip the card back.
    expect(/data-face="back"[\s\S]{0,400}onClick=\{\(e\) => \{ e\.stopPropagation\(\); onFlipBack\(\) \}\}/.test(facesSrc)).toBe(true)
  })

  it('action-chip onClick handlers stopPropagation BEFORE firing the action', () => {
    // Hub wedges destructure their action handlers as top-level props, so
    // the source pattern is `onWhatsApp()` / `onCall()` (not `actions.…`).
    // The center identity wedge is also a button; its onClick fires
    // onCenter (which closes the flip), and the back-face background
    // wrapper still fires onFlipBack with stopPropagation.
    expect(/onClick=\{\(e\) => \{ e\.stopPropagation\(\); onWhatsApp\(\) \}\}/.test(facesSrc)).toBe(true)
    expect(/onClick=\{\(e\) => \{ e\.stopPropagation\(\); onCall\(\) \}\}/.test(facesSrc)).toBe(true)
    expect(/onClick=\{\(e\) => \{ e\.stopPropagation\(\); onCenter\(\) \}\}/.test(facesSrc)).toBe(true)
  })

  it('closeFlip nulls activeFlippedId', () => {
    expect(/function closeFlip\(\)\s*\{\s*setActiveFlippedId\(null\)\s*\}/.test(facesSrc)).toBe(true)
  })
})

// ─── Family group — WhatsApp-only flip ─────────────────────────────────────

describe('family group flip behaviour — WhatsApp only, never tel', () => {
  it('group rendering passes groupAction (single onWhatsApp) and never `actions`', () => {
    // Isolate the JSX of the group BubbleTile (self-closing /> ends the
    // element) so the assertion can't escape into a later person tile.
    const groupBlock = facesSrc.match(/<BubbleTile[\s\S]*?kind="group"[\s\S]*?\/>/)
    expect(groupBlock).not.toBeNull()
    const block = (groupBlock as RegExpMatchArray)[0]
    expect(block.includes('groupAction:')).toBe(true)
    expect(block.includes('onWhatsApp:')).toBe(true)
    // The group block must not name the `actions:` prop key.
    expect(/\bactions:\s*\{/.test(block)).toBe(false)
  })

  it('groupAction TS type permits only onWhatsApp', () => {
    // The interface declaration explicitly limits groupAction's keys.
    expect(/groupAction\?:\s*\{\s*onWhatsApp:[^}]*\}/.test(facesSrc)).toBe(true)
    expect(/groupAction\?:[\s\S]{0,120}onCall/.test(facesSrc)).toBe(false)
  })
})

// ─── Ari / Anabel — no flip, only the cute toast ──────────────────────────

describe('Ari / Anabel — no flip, cute toast only', () => {
  function person(id: string): Extract<FamilyQuickFace, { type: 'person' }> {
    const f = FAMILY_QUICK_FACES.find((x) => x.type === 'person' && x.id === id)
    return f as Extract<FamilyQuickFace, { type: 'person' }>
  }

  it('Ari is in the scaffold but not actionable by default — no flip would happen', () => {
    expect(isPersonActionable(person('ari'))).toBe(false)
    expect(getMissingPhoneMessage('ari')).toBe(ARI_ANABEL_NO_PHONE_TOAST)
  })

  it('Anabel is in the scaffold but not actionable by default — no flip would happen', () => {
    expect(isPersonActionable(person('anabel'))).toBe(false)
    expect(getMissingPhoneMessage('anabel')).toBe(ARI_ANABEL_NO_PHONE_TOAST)
  })

  it('the cute message is the literal two-line copy', () => {
    expect(ARI_ANABEL_NO_PHONE_TOAST).toBe('הן עדיין קטנות 👧✨\nעדיין אין להן טלפון משלהן')
  })

  it('non-actionable persons still open the focused card, which shows the missing-number message', () => {
    // Tapping any person opens focus (no more toast short-circuit).
    const m = facesSrc.match(/function handleTapPerson\([^)]*\)\s*\{([\s\S]*?)\n {2}\}/)
    const body = (m as RegExpMatchArray)[1] ?? ''
    expect(body.includes('setFocusedFace(face)')).toBe(true)
    // The focused card renders focusedMissingMessage(face.id) when not actionable —
    // the centralized helper that delegates to getMissingPhoneMessage for a genuine
    // first-run and shows an honest storage-failure message otherwise (Gate 8).
    expect(facesSrc.includes('focusedMissingMessage(face.id)')).toBe(true)
  })
})

// ─── Yael — actionable when local phone exists, generic toast otherwise ───

describe('Yael behaviour', () => {
  function yael(over: Partial<Extract<FamilyQuickFace, { type: 'person' }>>): Extract<FamilyQuickFace, { type: 'person' }> {
    return {
      type: 'person', id: 'yael', displayName: 'יעל',
      phoneE164: '', enabled: false,
      ...over,
    }
  }

  it('Yael is in the scaffold (no special exception)', () => {
    const y = FAMILY_QUICK_FACES.find((f) => f.type === 'person' && f.id === 'yael')
    expect(y).toBeDefined()
  })

  it('Yael with a valid local phone + enabled is actionable (flips on tap)', () => {
    expect(isPersonActionable(yael({ phoneE164: TEST_FAKE_PHONE, enabled: true }))).toBe(true)
  })

  it('Yael without a local phone gets the generic missing-number toast (NOT the cute Ari/Anabel one)', () => {
    expect(isPersonActionable(yael({}))).toBe(false)
    expect(getMissingPhoneMessage('yael')).toBe(GENERIC_MISSING_PHONE_TOAST)
    expect(getMissingPhoneMessage('yael')).toBe('המספר עדיין לא הוגדר')
  })
})

// ─── 3D flip technical contract ────────────────────────────────────────────

describe('3D flip technical contract', () => {
  it('flip stage has perspective and a preserve-3d inner that animates rotateY', () => {
    expect(facesSrc.includes('perspective: 1000')).toBe(true)
    expect(facesSrc.includes("transformStyle: 'preserve-3d'")).toBe(true)
    expect(facesSrc.includes("'rotateY(180deg)'")).toBe(true)
    expect(facesSrc.includes("'rotateY(0deg)'")).toBe(true)
  })

  it('both faces use backface-visibility: hidden (vendor-prefixed too)', () => {
    expect(facesSrc.includes("backfaceVisibility: 'hidden'")).toBe(true)
    expect(facesSrc.includes("WebkitBackfaceVisibility: 'hidden'")).toBe(true)
  })

  it('flip duration sits in the 260–380 ms band per spec', () => {
    const m = facesSrc.match(/FLIP_DURATION_MS\s*=\s*(\d+)/)
    expect(m).not.toBeNull()
    const ms = parseInt((m as RegExpMatchArray)[1] as string, 10)
    expect(ms).toBeGreaterThanOrEqual(260)
    expect(ms).toBeLessThanOrEqual(380)
  })

  it('reduced-motion path is honoured via prefers-reduced-motion media query', () => {
    expect(facesSrc.includes('usePrefersReducedMotion')).toBe(true)
    expect(facesSrc.includes("'(prefers-reduced-motion: reduce)'")).toBe(true)
    // When reducedMotion, transitions become "none" instead of an animation.
    expect(facesSrc.includes("reducedMotion ? 'none'")).toBe(true)
  })

  it('reduced-motion swaps faces via opacity / pointer-events instead of rotateY', () => {
    // Front face hidden via opacity 0 when flipped under reduced motion.
    expect(/reducedMotion && flipped\s*\?\s*0\s*:\s*1/.test(facesSrc)).toBe(true)
    // Back face shown via opacity 1 only when flipped under reduced motion.
    expect(/reducedMotion\s*\?\s*\(flipped\s*\?\s*1\s*:\s*0\)/.test(facesSrc)).toBe(true)
  })
})

// ─── URL builders unchanged ────────────────────────────────────────────────

describe('URL builders still produce the exact required shapes', () => {
  it('WhatsApp chip URL: https://wa.me/<digits>, prefers whatsappE164', () => {
    const url = buildWhatsAppPersonUrl({
      type: 'person', id: 'x', displayName: 'X',
      phoneE164: '+972501111111', whatsappE164: '+972502222222', enabled: true,
    })
    expect(url).toBe('https://wa.me/972502222222')
    expect(/^https:\/\/wa\.me\/\d{8,15}$/.test(url)).toBe(true)
    expect(url.includes('+')).toBe(false)
    expect(/\s/.test(url)).toBe(false)
    expect(url.includes('-')).toBe(false)
  })

  it('Call chip URL: tel:+<digits>, plus retained, no spaces or dashes', () => {
    const url = buildTelUrl({
      type: 'person', id: 'x', displayName: 'X',
      phoneE164: '+972 (50) 123-4567', enabled: true,
    })
    expect(url).toBe('tel:+972501234567')
    expect(/^tel:\+\d{8,15}$/.test(url)).toBe(true)
  })
})

// ─── Privacy and storage invariants (regression guard) ────────────────────

describe('flip card does not weaken existing privacy guards', () => {
  it('localStorage key is unchanged', () => {
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

  it('action sheet bottom-sheet UI is gone (replaced by the flip card)', () => {
    expect(facesSrc.includes('action-cancel-')).toBe(false)
    expect(facesSrc.includes('family-action-sheet')).toBe(false)
  })

  it('isGroupActionable is still consulted in the group tap path', () => {
    expect(facesSrc.includes('isGroupActionable(group)')).toBe(true)
  })
})

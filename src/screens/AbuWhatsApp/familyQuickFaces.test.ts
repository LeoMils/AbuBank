import { describe, it, expect } from 'vitest'
import {
  sanitizePhoneE164,
  isValidPhoneE164,
  buildWhatsAppPersonUrl,
  buildTelUrl,
  getVisibleFaces,
  computeInitials,
  mergeFacesWithLocal,
  getDisplayablePersons,
  isPersonActionable,
  isGroupActionable,
} from './familyQuickFaces'
import { FAMILY_QUICK_FACES, type FamilyQuickFace } from './familyContacts.private'
import type { LocalFamilyContact } from './familyContactsStorage'

// Single synthetic placeholder reused by every merge test in this file.
// Real numbers must never appear in source.
const TEST_FAKE_PHONE = '+972501234567'

describe('sanitizePhoneE164', () => {
  it('strips all non-digit characters', () => {
    expect(sanitizePhoneE164('+972-50 123 4567')).toBe('972501234567')
  })
  it('returns empty string for empty input', () => {
    expect(sanitizePhoneE164('')).toBe('')
  })
})

describe('isValidPhoneE164', () => {
  it('rejects empty string', () => {
    expect(isValidPhoneE164('')).toBe(false)
  })
  it('rejects numbers without leading +', () => {
    expect(isValidPhoneE164('972501234567')).toBe(false)
  })
  it('rejects too-short numbers', () => {
    expect(isValidPhoneE164('+1234')).toBe(false)
  })
  it('accepts a valid +972 mobile number', () => {
    expect(isValidPhoneE164('+972501234567')).toBe(true)
  })
})

describe('buildWhatsAppPersonUrl', () => {
  it('uses phoneE164 when whatsappE164 is absent', () => {
    const face: Extract<FamilyQuickFace, { type: 'person' }> = {
      type: 'person', id: 'x', displayName: 'X',
      phoneE164: '+972501234567', enabled: true,
    }
    expect(buildWhatsAppPersonUrl(face)).toBe('https://wa.me/972501234567')
  })
  it('prefers whatsappE164 when provided', () => {
    const face: Extract<FamilyQuickFace, { type: 'person' }> = {
      type: 'person', id: 'x', displayName: 'X',
      phoneE164: '+972501111111', whatsappE164: '+972502222222', enabled: true,
    }
    expect(buildWhatsAppPersonUrl(face)).toBe('https://wa.me/972502222222')
  })
  it('strips formatting from the number', () => {
    const face: Extract<FamilyQuickFace, { type: 'person' }> = {
      type: 'person', id: 'x', displayName: 'X',
      phoneE164: '+972 (50) 123-4567', enabled: true,
    }
    expect(buildWhatsAppPersonUrl(face)).toBe('https://wa.me/972501234567')
  })
  it('does not include any prefilled text', () => {
    const face: Extract<FamilyQuickFace, { type: 'person' }> = {
      type: 'person', id: 'x', displayName: 'X',
      phoneE164: '+972501234567', enabled: true,
    }
    expect(buildWhatsAppPersonUrl(face).includes('?')).toBe(false)
    expect(buildWhatsAppPersonUrl(face).includes('text=')).toBe(false)
  })
})

describe('buildTelUrl', () => {
  it('produces a sanitized tel: URL with leading +', () => {
    const face: Extract<FamilyQuickFace, { type: 'person' }> = {
      type: 'person', id: 'x', displayName: 'X',
      phoneE164: '+972 (50) 123-4567', enabled: true,
    }
    expect(buildTelUrl(face)).toBe('tel:+972501234567')
  })
})

describe('getVisibleFaces', () => {
  it('hides disabled people even if a phone is provided', () => {
    const faces: FamilyQuickFace[] = [{
      type: 'person', id: 'a', displayName: 'A',
      phoneE164: '+972501234567', enabled: false,
    }]
    expect(getVisibleFaces(faces)).toEqual([])
  })

  it('hides enabled people whose phone fails validation', () => {
    const faces: FamilyQuickFace[] = [{
      type: 'person', id: 'a', displayName: 'A',
      phoneE164: '', enabled: true,
    }]
    expect(getVisibleFaces(faces)).toEqual([])
  })

  it('renders enabled people with valid phones', () => {
    const faces: FamilyQuickFace[] = [{
      type: 'person', id: 'a', displayName: 'A',
      phoneE164: '+972501234567', enabled: true,
    }]
    expect(getVisibleFaces(faces).length).toBe(1)
  })

  it('renders an enabled group with a real URL', () => {
    const faces: FamilyQuickFace[] = [{
      type: 'group', id: 'family-group', label: 'המשפחה',
      whatsappUrl: 'https://chat.whatsapp.com/JqqGpPKTCq3L0JnitU5y5f',
      enabled: true,
    }]
    expect(getVisibleFaces(faces).length).toBe(1)
  })

  it('hides a disabled group', () => {
    const faces: FamilyQuickFace[] = [{
      type: 'group', id: 'family-group', label: 'המשפחה',
      whatsappUrl: 'https://chat.whatsapp.com/JqqGpPKTCq3L0JnitU5y5f',
      enabled: false,
    }]
    expect(getVisibleFaces(faces)).toEqual([])
  })

  it('hides a group with empty URL', () => {
    const faces: FamilyQuickFace[] = [{
      type: 'group', id: 'family-group', label: 'המשפחה',
      whatsappUrl: '',
      enabled: true,
    }]
    expect(getVisibleFaces(faces)).toEqual([])
  })
})

describe('computeInitials', () => {
  it('returns the first character of a Hebrew name', () => {
    expect(computeInitials('מור')).toBe('מ')
  })
  it('returns ? for empty input', () => {
    expect(computeInitials('')).toBe('?')
  })
  it('trims whitespace', () => {
    expect(computeInitials('   לאו   ')).toBe('ל')
  })
})

describe('FAMILY_QUICK_FACES scaffold', () => {
  it('contains exactly one group entry', () => {
    const groups = FAMILY_QUICK_FACES.filter(f => f.type === 'group')
    expect(groups.length).toBe(1)
  })

  it('group is enabled and uses the real production family URL', () => {
    const group = FAMILY_QUICK_FACES.find(f => f.type === 'group') as Extract<FamilyQuickFace, { type: 'group' }>
    expect(group.enabled).toBe(true)
    expect(group.whatsappUrl).toBe('https://chat.whatsapp.com/JqqGpPKTCq3L0JnitU5y5f')
  })

  it('every person entry has an empty phoneE164 and is disabled (no fake phones committed)', () => {
    const people = FAMILY_QUICK_FACES.filter(f => f.type === 'person') as Extract<FamilyQuickFace, { type: 'person' }>[]
    expect(people.length).toBeGreaterThan(0)
    for (const p of people) {
      expect(p.phoneE164).toBe('')
      expect(p.enabled).toBe(false)
      expect(p.whatsappE164 ?? '').toBe('')
      expect(p.photoFile ?? '').toBe('')
    }
  })

  it('Anabel and Ari are present in the scaffold but disabled', () => {
    const anabel = FAMILY_QUICK_FACES.find(f => f.type === 'person' && f.id === 'anabel') as
      | Extract<FamilyQuickFace, { type: 'person' }>
      | undefined
    const ari = FAMILY_QUICK_FACES.find(f => f.type === 'person' && f.id === 'ari') as
      | Extract<FamilyQuickFace, { type: 'person' }>
      | undefined
    expect(anabel).toBeDefined()
    expect(anabel?.enabled).toBe(false)
    expect(ari).toBeDefined()
    expect(ari?.enabled).toBe(false)
  })

  it('default visible set contains only the family group', () => {
    const visible = getVisibleFaces()
    expect(visible.length).toBe(1)
    expect(visible[0]?.type).toBe('group')
  })

  it('visible filter would include a person if Leo enables one with a real phone', () => {
    const augmented: FamilyQuickFace[] = [
      ...FAMILY_QUICK_FACES.filter(f => f.id !== 'mor'),
      {
        type: 'person', id: 'mor', displayName: 'מור',
        relationshipHebrew: 'הבת',
        phoneE164: TEST_FAKE_PHONE, enabled: true,
      },
    ]
    const visible = getVisibleFaces(augmented)
    const mor = visible.find(f => f.type === 'person' && f.id === 'mor')
    expect(mor).toBeDefined()
  })
})

describe('source scaffold contains no real phone numbers', () => {
  it('every person scaffold entry has empty phoneE164 and is disabled', () => {
    const people = FAMILY_QUICK_FACES.filter(f => f.type === 'person') as Extract<FamilyQuickFace, { type: 'person' }>[]
    for (const p of people) {
      expect(p.phoneE164).toBe('')
      expect(p.whatsappE164 ?? '').toBe('')
      expect(p.enabled).toBe(false)
    }
  })
})

describe('mergeFacesWithLocal', () => {
  it('returns the scaffold untouched when no local overrides exist', () => {
    const merged = mergeFacesWithLocal(FAMILY_QUICK_FACES, [])
    expect(merged.length).toBe(FAMILY_QUICK_FACES.length)
    const visible = getVisibleFaces(merged)
    expect(visible.length).toBe(1)
    expect(visible[0]?.type).toBe('group')
  })

  it('localStorage data can enable a person with a valid local phone', () => {
    const local: LocalFamilyContact[] = [{ id: 'mor', enabled: true, phoneE164: TEST_FAKE_PHONE }]
    const merged = mergeFacesWithLocal(FAMILY_QUICK_FACES, local)
    const visible = getVisibleFaces(merged)
    const mor = visible.find(f => f.type === 'person' && f.id === 'mor')
    expect(mor).toBeDefined()
    expect((mor as Extract<FamilyQuickFace, { type: 'person' }>).enabled).toBe(true)
  })

  it('invalid local phone keeps the person hidden', () => {
    const local: LocalFamilyContact[] = [{ id: 'mor', enabled: true, phoneE164: '12345' }]
    const merged = mergeFacesWithLocal(FAMILY_QUICK_FACES, local)
    const visible = getVisibleFaces(merged)
    expect(visible.find(f => f.type === 'person' && f.id === 'mor')).toBeUndefined()
  })

  it('local override with enabled=false leaves the person hidden even with a valid phone', () => {
    const local: LocalFamilyContact[] = [{ id: 'mor', enabled: false, phoneE164: TEST_FAKE_PHONE }]
    const merged = mergeFacesWithLocal(FAMILY_QUICK_FACES, local)
    const visible = getVisibleFaces(merged)
    expect(visible.find(f => f.type === 'person' && f.id === 'mor')).toBeUndefined()
  })

  it('Anabel and Ari remain hidden unless valid local data exists', () => {
    const merged = mergeFacesWithLocal(FAMILY_QUICK_FACES, [])
    const visible = getVisibleFaces(merged)
    expect(visible.find(f => f.id === 'anabel')).toBeUndefined()
    expect(visible.find(f => f.id === 'ari')).toBeUndefined()
  })

  it('group bubble survives even when no local contacts exist', () => {
    const merged = mergeFacesWithLocal(FAMILY_QUICK_FACES, [])
    const visible = getVisibleFaces(merged)
    expect(visible.some(f => f.type === 'group' && f.id === 'family-group')).toBe(true)
  })

  it('WhatsApp URL builds only from local data (scaffold has no number)', () => {
    const local: LocalFamilyContact[] = [{ id: 'mor', enabled: true, phoneE164: TEST_FAKE_PHONE }]
    const merged = mergeFacesWithLocal(FAMILY_QUICK_FACES, local)
    const mor = merged.find(f => f.type === 'person' && f.id === 'mor') as Extract<FamilyQuickFace, { type: 'person' }>
    const url = buildWhatsAppPersonUrl(mor)
    expect(url.startsWith('https://wa.me/')).toBe(true)
    expect(/^https:\/\/wa\.me\/\d{8,15}$/.test(url)).toBe(true)
  })

  it('phone (tel:) URL builds only from local data', () => {
    const local: LocalFamilyContact[] = [{ id: 'mor', enabled: true, phoneE164: TEST_FAKE_PHONE }]
    const merged = mergeFacesWithLocal(FAMILY_QUICK_FACES, local)
    const mor = merged.find(f => f.type === 'person' && f.id === 'mor') as Extract<FamilyQuickFace, { type: 'person' }>
    const tel = buildTelUrl(mor)
    expect(/^tel:\+\d{8,15}$/.test(tel)).toBe(true)
  })

  it('identity (displayName, relationshipHebrew) is sourced from scaffold, not from local override', () => {
    // Malicious-override scenario: cast through unknown to inject extra fields.
    const malicious: unknown = { id: 'mor', enabled: true, phoneE164: TEST_FAKE_PHONE, displayName: 'OVERRIDE', relationshipHebrew: 'NOT_HEBET' }
    const merged = mergeFacesWithLocal(FAMILY_QUICK_FACES, [malicious as LocalFamilyContact])
    const mor = merged.find(f => f.type === 'person' && f.id === 'mor') as Extract<FamilyQuickFace, { type: 'person' }>
    expect(mor.displayName).toBe('מור')
    expect(mor.relationshipHebrew).toBe('הבת')
  })
})

// ─── v0.3.2 — visible-by-default family grid ──────────────────────────────

describe('getDisplayablePersons (visible-by-default scaffold persons)', () => {
  it('returns every scaffold person even with empty localStorage', () => {
    const persons = getDisplayablePersons(FAMILY_QUICK_FACES, [])
    const scaffoldPersons = FAMILY_QUICK_FACES.filter((f) => f.type === 'person')
    expect(persons.length).toBe(scaffoldPersons.length)
    expect(persons.length).toBeGreaterThan(0)
  })

  it('includes Anabel and Ari (scaffold persons) even without override', () => {
    const persons = getDisplayablePersons(FAMILY_QUICK_FACES, [])
    expect(persons.some((p) => p.id === 'anabel')).toBe(true)
    expect(persons.some((p) => p.id === 'ari')).toBe(true)
  })

  it('preserves scaffold render order regardless of local overrides', () => {
    const scaffoldOrder = (FAMILY_QUICK_FACES.filter((f) => f.type === 'person') as Extract<FamilyQuickFace, { type: 'person' }>[]).map((p) => p.id)
    const persons = getDisplayablePersons(FAMILY_QUICK_FACES, [
      { id: 'leo', enabled: true, phoneE164: TEST_FAKE_PHONE },
      { id: 'mor', enabled: false, phoneE164: '' },
    ])
    expect(persons.map((p) => p.id)).toEqual(scaffoldOrder)
  })

  it('overlays phone/photo/enabled from local override but never identity', () => {
    const persons = getDisplayablePersons(FAMILY_QUICK_FACES, [
      { id: 'mor', enabled: true, phoneE164: TEST_FAKE_PHONE, photoFile: '/family/FAmilly%201.JPG' },
    ])
    const mor = persons.find((p) => p.id === 'mor')!
    expect(mor.displayName).toBe('מור')
    expect(mor.relationshipHebrew).toBe('הבת')
    expect(mor.phoneE164).toBe(TEST_FAKE_PHONE)
    expect(mor.enabled).toBe(true)
    expect(mor.photoFile).toBe('/family/FAmilly%201.JPG')
  })
})

describe('isPersonActionable (tap-gating, not visibility)', () => {
  function person(over: Partial<Extract<FamilyQuickFace, { type: 'person' }>>): Extract<FamilyQuickFace, { type: 'person' }> {
    return { type: 'person', id: 'x', displayName: 'X', phoneE164: '', enabled: false, ...over }
  }

  it('is true for enabled person with valid E.164 phone', () => {
    expect(isPersonActionable(person({ enabled: true, phoneE164: TEST_FAKE_PHONE }))).toBe(true)
  })

  it('is false for enabled person with empty phone', () => {
    expect(isPersonActionable(person({ enabled: true, phoneE164: '' }))).toBe(false)
  })

  it('is false for enabled person with malformed phone', () => {
    expect(isPersonActionable(person({ enabled: true, phoneE164: '12345' }))).toBe(false)
  })

  it('is false for disabled person even with a valid phone', () => {
    expect(isPersonActionable(person({ enabled: false, phoneE164: TEST_FAKE_PHONE }))).toBe(false)
  })
})

describe('isGroupActionable', () => {
  it('is true when whatsappUrl is non-empty', () => {
    expect(isGroupActionable({ type: 'group', id: 'family-group', label: 'המשפחה', whatsappUrl: 'https://chat.whatsapp.com/ABC', enabled: true })).toBe(true)
  })
  it('is false when whatsappUrl is empty', () => {
    expect(isGroupActionable({ type: 'group', id: 'family-group', label: 'המשפחה', whatsappUrl: '', enabled: true })).toBe(false)
  })
})

// ─── Source-level guards for the unified bubble grid (v0.3.1) ──────────────
//
// The Vitest config runs in node env (no jsdom), so DOM rendering tests are
// not available here. These tests assert the contract via static-source
// inspection so future patches can't silently break the visual rules.

describe('AbuWhatsApp unified bubble grid (source contract)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs') as typeof import('fs')
  const path = require('path') as typeof import('path')
  const PROJECT_ROOT = path.resolve(__dirname, '../../..')

  function readSrc(rel: string): string {
    return fs.readFileSync(path.join(PROJECT_ROOT, rel), 'utf8')
  }

  it('header title "אבו וואטסאפ" appears in familyQuickFaces.tsx', () => {
    const src = readSrc('src/screens/AbuWhatsApp/familyQuickFaces.tsx')
    expect(src.includes('אבו וואטסאפ')).toBe(true)
  })

  it('subtitle "למי לשלוח הודעה?" appears in familyQuickFaces.tsx', () => {
    const src = readSrc('src/screens/AbuWhatsApp/familyQuickFaces.tsx')
    expect(src.includes('למי לשלוח הודעה?')).toBe(true)
  })

  it('build version v0.3.2-abuwhatsapp-family-grid is rendered on the AbuWhatsApp screen', () => {
    const src = readSrc('src/screens/AbuWhatsApp/familyQuickFaces.tsx')
    expect(src.includes('abuwhatsapp-build-version')).toBe(true)
    expect(src.includes("APP_VERSION.version")).toBe(true)
    const verSrc = readSrc('src/version.ts')
    expect(verSrc.includes("'0.3.2-abuwhatsapp-family-grid'")).toBe(true)
  })

  it('grid uses getDisplayablePersons (visible-by-default), not contacts.some filtering', () => {
    const src = readSrc('src/screens/AbuWhatsApp/familyQuickFaces.tsx')
    expect(src.includes('getDisplayablePersons(FAMILY_QUICK_FACES, contacts)')).toBe(true)
    // The previous "hide unless localStorage override exists" filter must be gone.
    expect(src.includes('contacts.some((c) => c.id === p.id)')).toBe(false)
  })

  it('tap-gating is by isPersonActionable / isGroupActionable, not raw enabled/phone checks in the handler', () => {
    const src = readSrc('src/screens/AbuWhatsApp/familyQuickFaces.tsx')
    expect(src.includes('isPersonActionable(face)')).toBe(true)
    expect(src.includes('isGroupActionable(group)')).toBe(true)
  })

  it('family group bubble has a deterministic photo fallback', () => {
    const src = readSrc('src/screens/AbuWhatsApp/familyQuickFaces.tsx')
    expect(src.includes('FAMILY_GROUP_PHOTO')).toBe(true)
    expect(src.includes('/family/FAmilly%206.JPG')).toBe(true)
  })

  it('group and person targets render via the same BubbleTile component', () => {
    const src = readSrc('src/screens/AbuWhatsApp/familyQuickFaces.tsx')
    // The single tile component must be defined exactly once and used for both kinds.
    const defs = src.match(/export function BubbleTile\b/g) ?? []
    expect(defs.length).toBe(1)
    expect(/<BubbleTile[^>]*kind=["']group["']/.test(src)).toBe(true)
    expect(/<BubbleTile[^>]*kind=["']person["']/.test(src)).toBe(true)
    // No legacy hero component should remain.
    expect(src.includes('FamilyGroupHeroBubble')).toBe(false)
    expect(src.includes('PersonBubbleCard')).toBe(false)
  })

  it('group target is WhatsApp-only — there is no call/tel action wired for the group', () => {
    const src = readSrc('src/screens/AbuWhatsApp/familyQuickFaces.tsx')
    // Slice from the function declaration to the next blank line — covers the
    // full handleTapGroup body without depending on brace counting.
    const startIdx = src.indexOf('function handleTapGroup')
    expect(startIdx).toBeGreaterThan(-1)
    const endIdx = src.indexOf('\n\n', startIdx)
    const handler = src.slice(startIdx, endIdx === -1 ? src.length : endIdx)
    expect(handler.includes('onOpenWhatsApp')).toBe(true)
    expect(handler.includes('onOpenTel')).toBe(false)
  })

  it('person target with phone offers WhatsApp + call (action sheet)', () => {
    const src = readSrc('src/screens/AbuWhatsApp/familyQuickFaces.tsx')
    expect(src.includes('action-whatsapp-')).toBe(true)
    expect(src.includes('action-call-')).toBe(true)
    expect(src.includes('action-cancel-')).toBe(true)
  })

  it('person target without a valid phone shows the friendly Hebrew "המספר עדיין לא הוגדר"', () => {
    const src = readSrc('src/screens/AbuWhatsApp/familyQuickFaces.tsx')
    expect(src.includes('המספר עדיין לא הוגדר')).toBe(true)
  })

  it('group target without a configured URL shows the friendly Hebrew "קבוצת המשפחה עדיין לא הוגדרה"', () => {
    const src = readSrc('src/screens/AbuWhatsApp/familyQuickFaces.tsx')
    expect(src.includes('קבוצת המשפחה עדיין לא הוגדרה')).toBe(true)
  })

  it('Martita-facing bubble grid does NOT render JSON UI (no JSON inputs in familyQuickFaces.tsx)', () => {
    const src = readSrc('src/screens/AbuWhatsApp/familyQuickFaces.tsx')
    // No textarea in the Martita bubble grid; JSON belongs to the operator setup file only.
    expect(/<textarea\b/i.test(src)).toBe(false)
    expect(src.toLowerCase().includes('json')).toBe(false)
  })

  it('source/scaffold contains no real phone numbers (only the placeholder in the comment)', () => {
    const scaffold = readSrc('src/screens/AbuWhatsApp/familyContacts.private.ts')
    // No bare phoneE164 string with real digits — every person row has phoneE164: ''.
    const phoneFields = scaffold.match(/phoneE164:\s*'([^']*)'/g) ?? []
    for (const m of phoneFields) {
      // The header doc-comment uses the example +972501234567; assert it is
      // ONLY in the comment block, never as a real assignment.
      expect(m.endsWith("''")).toBe(true)
    }
  })
})

// ─── v0.3.2 visual polish — circular geometry + no Martita tabs ────────────

describe('AbuWhatsApp bubble visual contract (v0.3.2 polish)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs') as typeof import('fs')
  const path = require('path') as typeof import('path')
  const PROJECT_ROOT = path.resolve(__dirname, '../../..')
  const facesSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'src/screens/AbuWhatsApp/familyQuickFaces.tsx'), 'utf8')
  const indexSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'src/screens/AbuWhatsApp/index.tsx'), 'utf8')

  it('BubbleAvatar enforces circular geometry: width === height === size, aspect-ratio 1/1, borderRadius 50%', () => {
    // Slice the BubbleAvatar function body.
    const startIdx = facesSrc.indexOf('function BubbleAvatar(')
    expect(startIdx).toBeGreaterThan(-1)
    const body = facesSrc.slice(startIdx, startIdx + 1800)
    expect(body.includes('width: size, height: size')).toBe(true)
    expect(body.includes('minWidth: size, minHeight: size')).toBe(true)
    expect(body.includes('maxWidth: size, maxHeight: size')).toBe(true)
    expect(body.includes("aspectRatio: '1 / 1'")).toBe(true)
    expect(body.includes("borderRadius: '50%'")).toBe(true)
    expect(body.includes("flex: '0 0 auto'")).toBe(true)
  })

  it('canonical bubble size matches AbuBank Home bubble system (≤ 96, ≥ 64)', () => {
    const m = facesSrc.match(/const\s+BUBBLE_SIZE\s*=\s*(\d+)/)
    expect(m).not.toBeNull()
    const px = Number((m as RegExpMatchArray)[1])
    expect(px).toBeGreaterThanOrEqual(64)
    expect(px).toBeLessThanOrEqual(96)
  })

  it('grid uses 3 columns with a single canonical gap (rowGap === columnGap)', () => {
    expect(facesSrc.includes('repeat(3, minmax(0, 1fr))')).toBe(true)
    expect(facesSrc.includes('rowGap: GRID_GAP, columnGap: GRID_GAP')).toBe(true)
  })

  it('label sits below the avatar (BubbleAvatar precedes the rendered label text inside BubbleTile)', () => {
    const tileStart = facesSrc.indexOf('export function BubbleTile')
    expect(tileStart).toBeGreaterThan(-1)
    const tileBody = facesSrc.slice(tileStart, tileStart + 2400)
    const avatarIdx = tileBody.indexOf('<BubbleAvatar')
    // The rendered text is inside its own <div>{label}</div>, distinct from
    // aria-label={label} on the button.
    const renderedLabelIdx = tileBody.indexOf('>\n        {label}')
    expect(avatarIdx).toBeGreaterThan(-1)
    expect(renderedLabelIdx).toBeGreaterThan(avatarIdx)
  })

  it('AbuWhatsApp default Martita view does NOT render the משפחה / פעולות tab bar', () => {
    // The tab bar JSX must be gated by `operatorMode` so Martita's default
    // surface is just the family bubble grid. The TabButton labels still
    // exist in source (kept for operator parity) but are not in the
    // Martita-facing render path.
    expect(/!voiceMode\s*&&\s*operatorMode\s*&&[\s\S]{0,40}data-testid="abuwhatsapp-tab-bar"/.test(indexSrc)).toBe(true)
    // The unconditional `{!voiceMode && (` wrapper for the tab bar must be gone.
    expect(/\{!voiceMode\s*&&\s*\(\s*\n\s*<div\s+data-testid="abuwhatsapp-tab-bar"/.test(indexSrc)).toBe(false)
  })

  it('build version label still renders on the AbuWhatsApp screen', () => {
    expect(facesSrc.includes('abuwhatsapp-build-version')).toBe(true)
    expect(facesSrc.includes('APP_VERSION.version')).toBe(true)
  })

  it('group + person still share the same BubbleTile component', () => {
    const defs = facesSrc.match(/export function BubbleTile\b/g) ?? []
    expect(defs.length).toBe(1)
    expect(/<BubbleTile[^>]*kind=["']group["']/.test(facesSrc)).toBe(true)
    expect(/<BubbleTile[^>]*kind=["']person["']/.test(facesSrc)).toBe(true)
  })

  it('missing-phone toast and action sheet behaviour are preserved', () => {
    expect(facesSrc.includes('המספר עדיין לא הוגדר')).toBe(true)
    expect(facesSrc.includes('קבוצת המשפחה עדיין לא הוגדרה')).toBe(true)
    expect(facesSrc.includes('action-whatsapp-')).toBe(true)
    expect(facesSrc.includes('action-call-')).toBe(true)
    expect(facesSrc.includes('action-cancel-')).toBe(true)
  })
})

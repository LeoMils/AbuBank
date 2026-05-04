import { describe, it, expect } from 'vitest'
import {
  sanitizePhoneE164,
  isValidPhoneE164,
  buildWhatsAppPersonUrl,
  buildTelUrl,
  getVisibleFaces,
  computeInitials,
} from './familyQuickFaces'
import { FAMILY_QUICK_FACES, type FamilyQuickFace } from './familyContacts.private'

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

  it('every enabled person has a valid E.164 phone; every disabled person has an empty phone', () => {
    const people = FAMILY_QUICK_FACES.filter(f => f.type === 'person') as Extract<FamilyQuickFace, { type: 'person' }>[]
    expect(people.length).toBeGreaterThan(0)
    for (const p of people) {
      if (p.enabled) {
        expect(isValidPhoneE164(p.phoneE164)).toBe(true)
        if (p.whatsappE164 !== undefined && p.whatsappE164.length > 0) {
          expect(isValidPhoneE164(p.whatsappE164)).toBe(true)
        }
      } else {
        expect(p.phoneE164).toBe('')
        expect(p.whatsappE164 ?? '').toBe('')
      }
    }
  })

  it('no person entry references a known-fake test number', () => {
    const FAKE = ['+972501234567', '+972501111111', '+972502222222', '+1234567890']
    const people = FAMILY_QUICK_FACES.filter(f => f.type === 'person') as Extract<FamilyQuickFace, { type: 'person' }>[]
    for (const p of people) {
      expect(FAKE).not.toContain(p.phoneE164)
      if (p.whatsappE164) expect(FAKE).not.toContain(p.whatsappE164)
    }
  })

  it('photoFile is empty for every entry until real assets are added', () => {
    for (const f of FAMILY_QUICK_FACES) {
      expect(f.photoFile ?? '').toBe('')
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

  it('Yael remains disabled until a real phone is provided', () => {
    const yael = FAMILY_QUICK_FACES.find(f => f.type === 'person' && f.id === 'yael') as
      | Extract<FamilyQuickFace, { type: 'person' }>
      | undefined
    expect(yael).toBeDefined()
    if (yael?.enabled) {
      expect(isValidPhoneE164(yael.phoneE164)).toBe(true)
    } else {
      expect(yael?.phoneE164).toBe('')
    }
  })

  it('default visible set contains the family group plus every enabled person and excludes disabled ids', () => {
    const visible = getVisibleFaces()
    const visibleIds = new Set(visible.map(f => f.id))
    expect(visibleIds.has('family-group')).toBe(true)
    expect(visibleIds.has('anabel')).toBe(false)
    expect(visibleIds.has('ari')).toBe(false)

    const enabledPeople = (FAMILY_QUICK_FACES.filter(
      f => f.type === 'person',
    ) as Extract<FamilyQuickFace, { type: 'person' }>[]).filter(p => p.enabled)
    for (const p of enabledPeople) {
      expect(visibleIds.has(p.id)).toBe(true)
    }
    expect(visible.length).toBe(1 + enabledPeople.length)
  })

  it('visible filter hides a person whose enabled flag is flipped off, even with a valid phone', () => {
    const visibleEnabledIds = new Set(getVisibleFaces().map(f => f.id))
    const aMember = (FAMILY_QUICK_FACES.find(
      f => f.type === 'person' && f.id === 'mor',
    ) as Extract<FamilyQuickFace, { type: 'person' }> | undefined)
    expect(aMember).toBeDefined()
    expect(visibleEnabledIds.has('mor')).toBe(aMember?.enabled === true)

    const flipped: FamilyQuickFace[] = FAMILY_QUICK_FACES.map(f =>
      f.type === 'person' && f.id === 'mor' ? { ...f, enabled: false } : f,
    )
    const visibleAfter = getVisibleFaces(flipped)
    expect(visibleAfter.find(f => f.id === 'mor')).toBeUndefined()
  })
})

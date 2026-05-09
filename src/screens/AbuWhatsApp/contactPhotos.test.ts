import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import {
  FAMILY_QUICK_FACES,
  KNOWN_CONTACT_PHOTOS,
  type FamilyQuickFace,
} from './familyContacts.private'

const PROJECT_ROOT = path.resolve(__dirname, '../../..')

const EXPECTED_IDS = [
  'mor', 'leo', 'yael', 'raphi', 'ofir', 'ayalon',
  'eili', 'adar', 'adi', 'noam', 'yarden', 'gilad',
] as const

describe('KNOWN_CONTACT_PHOTOS mapping', () => {
  it('contains exactly the 12 expected ids', () => {
    expect(Object.keys(KNOWN_CONTACT_PHOTOS).sort())
      .toEqual([...EXPECTED_IDS].sort())
  })

  it('every photo path starts with /family-contacts/', () => {
    for (const [id, p] of Object.entries(KNOWN_CONTACT_PHOTOS)) {
      expect(p.startsWith('/family-contacts/'), `${id} → ${p}`).toBe(true)
    }
  })

  it('no photo path contains spaces or parentheses', () => {
    for (const [id, p] of Object.entries(KNOWN_CONTACT_PHOTOS)) {
      expect(/\s/.test(p), `${id}: spaces in ${p}`).toBe(false)
      expect(/[()]/.test(p), `${id}: parens in ${p}`).toBe(false)
    }
  })

  it('every photo path is lowercase and has a .jpeg or .png extension', () => {
    for (const [id, p] of Object.entries(KNOWN_CONTACT_PHOTOS)) {
      const file = p.split('/').pop() as string
      expect(file).toBe(file.toLowerCase())
      expect(/\.(jpeg|png)$/.test(file), `${id}: ${file}`).toBe(true)
    }
  })
})

describe('photo files exist on disk under public/family-contacts', () => {
  for (const [id, p] of Object.entries(KNOWN_CONTACT_PHOTOS)) {
    it(`${id}: ${p} resolves to a real file in public/`, () => {
      const fsPath = path.join(PROJECT_ROOT, 'public', p.replace(/^\/+/, ''))
      expect(fs.existsSync(fsPath), `expected ${fsPath}`).toBe(true)
      const stat = fs.statSync(fsPath)
      expect(stat.isFile()).toBe(true)
      expect(stat.size).toBeGreaterThan(0)
    })
  }
})

describe('FAMILY_QUICK_FACES scaffold uses KNOWN_CONTACT_PHOTOS', () => {
  function person(id: string): Extract<FamilyQuickFace, { type: 'person' }> | undefined {
    const f = FAMILY_QUICK_FACES.find((x) => x.type === 'person' && x.id === id)
    return f as Extract<FamilyQuickFace, { type: 'person' }> | undefined
  }

  for (const id of EXPECTED_IDS) {
    it(`scaffold person "${id}" has photoFile = KNOWN_CONTACT_PHOTOS["${id}"]`, () => {
      const p = person(id)
      expect(p, `scaffold missing person "${id}"`).toBeDefined()
      expect(p!.photoFile).toBe(KNOWN_CONTACT_PHOTOS[id])
    })
  }

  it('Anabel and Ari intentionally have NO photoFile (initials fallback)', () => {
    const anabel = person('anabel')
    const ari = person('ari')
    expect(anabel).toBeDefined()
    expect(ari).toBeDefined()
    expect(anabel?.photoFile ?? '').toBe('')
    expect(ari?.photoFile ?? '').toBe('')
  })

  it('scaffold still has empty phoneE164 for every person (no real phones)', () => {
    const persons = FAMILY_QUICK_FACES.filter((f) => f.type === 'person') as Extract<FamilyQuickFace, { type: 'person' }>[]
    for (const p of persons) {
      expect(p.phoneE164, `${p.id} must have empty phoneE164`).toBe('')
    }
  })

  it('family-group entry remains unchanged (no photoFile override)', () => {
    const group = FAMILY_QUICK_FACES.find((f) => f.type === 'group')
    expect(group).toBeDefined()
    expect(group?.type).toBe('group')
    // Scaffold leaves photoFile unset; the runtime renderer falls back to
    // the existing /family/FAmilly%206.JPG family-group photo.
    expect((group as Extract<FamilyQuickFace, { type: 'group' }>).photoFile ?? '').toBe('')
  })
})

describe('BubbleAvatar render path (source contract)', () => {
  const facesSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'src/screens/AbuWhatsApp/familyQuickFaces.tsx'), 'utf8')

  it('renders <img src={photoFile}> branch when photoFile exists', () => {
    expect(facesSrc.includes('src={photoFile}')).toBe(true)
  })

  it('img uses object-fit contain + object-position center for non-cropping centred display', () => {
    expect(facesSrc.includes("objectFit: 'contain'")).toBe(true)
    expect(facesSrc.includes("objectPosition: 'center'")).toBe(true)
  })

  it('initials fallback span still present for missing photoFile', () => {
    expect(facesSrc.includes('{initials}')).toBe(true)
    expect(facesSrc.includes('Cormorant Garamond')).toBe(true)
  })

  it('mergeFacesWithLocal preserves scaffold photoFile when override has none', () => {
    expect(/else if \(f\.photoFile && f\.photoFile\.length > 0\) merged\.photoFile = f\.photoFile/.test(facesSrc)).toBe(true)
  })
})

/*
 * Family-photo gallery — pure helper + source-contract tests.
 *
 * vitest runs in node env (no DOM), so the runtime modal behaviour (Esc
 * close, backdrop close, etc.) is exercised by source-pattern checks
 * against FamilyPhotoGallery.tsx, while getFamilyGalleryPhotos itself
 * is tested as a pure function with synthetic scaffolds.
 */

import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import {
  getFamilyGalleryPhotos,
  type FamilyGalleryPhoto,
} from './familyQuickFaces'
import { FAMILY_QUICK_FACES, type FamilyQuickFace } from './familyContacts.private'
import type { LocalFamilyContact } from './familyContactsStorage'

const PROJECT_ROOT = path.resolve(__dirname, '../../..')
const facesSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'src/screens/AbuWhatsApp/familyQuickFaces.tsx'), 'utf8')
const gallerySrc = fs.readFileSync(path.join(PROJECT_ROOT, 'src/screens/AbuWhatsApp/FamilyPhotoGallery.tsx'), 'utf8')
const indexSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'src/screens/AbuWhatsApp/index.tsx'), 'utf8')

describe('getFamilyGalleryPhotos — derived from the same data as the bubble grid', () => {
  it('returns FamilyGalleryPhoto entries with id / label / photoUrl only (no phone fields)', () => {
    const items = getFamilyGalleryPhotos(FAMILY_QUICK_FACES, [])
    expect(items.length).toBeGreaterThan(0)
    for (const item of items) {
      expect(typeof item.id).toBe('string')
      expect(typeof item.label).toBe('string')
      expect(typeof item.photoUrl).toBe('string')
      expect(item.photoUrl.length).toBeGreaterThan(0)
      // Privacy contract: no phone field on the public gallery item shape.
      expect((item as unknown as Record<string, unknown>).phoneE164).toBeUndefined()
      expect((item as unknown as Record<string, unknown>).whatsappE164).toBeUndefined()
    }
  })

  it('includes the family group photo when one is set on the merged group', () => {
    const scaffold: FamilyQuickFace[] = [
      {
        type: 'group', id: 'family-group', label: 'המשפחה',
        photoFile: '/family/FAmilly%201.JPG',
        whatsappUrl: 'https://chat.whatsapp.com/ABC',
        enabled: true,
      },
      {
        type: 'person', id: 'mor', displayName: 'מור',
        phoneE164: '', enabled: false,
        photoFile: '/family-contacts/mor.jpeg',
      },
    ]
    const items = getFamilyGalleryPhotos(scaffold, [])
    expect(items.find((x) => x.id === 'family-group')?.photoUrl).toBe('/family/FAmilly%201.JPG')
    expect(items.find((x) => x.id === 'mor')?.photoUrl).toBe('/family-contacts/mor.jpeg')
  })

  it('includes every scaffold person that has a photoFile (current + future contacts)', () => {
    const items = getFamilyGalleryPhotos(FAMILY_QUICK_FACES, [])
    const ids = items.map((x) => x.id)
    // Real scaffold ships these 14 people with photos. New future ids will
    // appear automatically here without changing this helper.
    for (const id of ['mor', 'leo', 'yael', 'ari', 'anabel']) {
      expect(ids).toContain(id)
    }
  })

  it('skips entries with no photoUrl', () => {
    const scaffold: FamilyQuickFace[] = [
      { type: 'person', id: 'no-photo', displayName: 'X', phoneE164: '', enabled: false },
      { type: 'person', id: 'with-photo', displayName: 'Y', phoneE164: '', enabled: false, photoFile: '/family-contacts/leo.png' },
    ]
    const items = getFamilyGalleryPhotos(scaffold, [])
    expect(items.find((x) => x.id === 'no-photo')).toBeUndefined()
    expect(items.find((x) => x.id === 'with-photo')).toBeDefined()
  })

  it('localStorage photo overrides flow through and replace the scaffold photo', () => {
    const local: LocalFamilyContact[] = [
      { id: 'mor', enabled: true, phoneE164: '+972500000001', photoFile: '/operator-supplied/mor.jpg' },
    ]
    const items = getFamilyGalleryPhotos(FAMILY_QUICK_FACES, local)
    expect(items.find((x) => x.id === 'mor')?.photoUrl).toBe('/operator-supplied/mor.jpg')
  })

  it('extras are prepended and de-duplicated by photoUrl', () => {
    const extras: FamilyGalleryPhoto[] = [
      { id: 'martita-portrait', label: 'Martita', photoUrl: '/martita/Martita%201.JPG' },
    ]
    const items = getFamilyGalleryPhotos(FAMILY_QUICK_FACES, [], extras)
    expect(items[0]?.id).toBe('martita-portrait')
    // No duplicate of the same photo URL:
    const urls = items.map((x) => x.photoUrl)
    const uniq = new Set(urls)
    expect(urls.length).toBe(uniq.size)
  })

  it('extras with empty photoUrl are dropped', () => {
    const extras: FamilyGalleryPhoto[] = [
      { id: 'empty', label: 'X', photoUrl: '' },
    ]
    const items = getFamilyGalleryPhotos(FAMILY_QUICK_FACES, [], extras)
    expect(items.find((x) => x.id === 'empty')).toBeUndefined()
  })

  it('a brand-new contact added to the scaffold appears automatically (regression guard)', () => {
    const augmented: FamilyQuickFace[] = [
      ...FAMILY_QUICK_FACES,
      {
        type: 'person', id: 'new-future-cousin', displayName: 'בן-דוד',
        phoneE164: '', enabled: false,
        photoFile: '/family-contacts/new-future-cousin.jpeg',
      },
    ]
    const items = getFamilyGalleryPhotos(augmented, [])
    expect(items.find((x) => x.id === 'new-future-cousin')?.photoUrl)
      .toBe('/family-contacts/new-future-cousin.jpeg')
  })
})

describe('FamilyPhotoGallery component — source contract', () => {
  it('renders Hebrew title "תמונות המשפחה"', () => {
    expect(gallerySrc.includes('תמונות המשפחה')).toBe(true)
    expect(gallerySrc.includes('data-testid="family-photo-gallery-title"')).toBe(true)
  })

  it('close button reads "סגירה" with a stable testid', () => {
    expect(gallerySrc.includes('data-testid="family-photo-gallery-close"')).toBe(true)
    expect(gallerySrc.includes('סגירה')).toBe(true)
  })

  it('Escape key closes the modal', () => {
    expect(/if \(e\.key === ['"]Escape['"]\) onClose\(\)/.test(gallerySrc)).toBe(true)
    expect(gallerySrc.includes("window.addEventListener('keydown'")).toBe(true)
    expect(gallerySrc.includes("window.removeEventListener('keydown'")).toBe(true)
  })

  it('backdrop click (target === currentTarget) closes the modal', () => {
    expect(/onClick=\{\(e\) => \{ if \(e\.target === e\.currentTarget\) onClose\(\) \}\}/.test(gallerySrc)).toBe(true)
  })

  it('uses role="dialog" + aria-modal + aria-label for screen readers', () => {
    expect(gallerySrc.includes('role="dialog"')).toBe(true)
    expect(gallerySrc.includes('aria-modal="true"')).toBe(true)
    expect(gallerySrc.includes('aria-label="תמונות המשפחה"')).toBe(true)
  })

  it('reads photos from getFamilyGalleryPhotos by default (no hardcoded list)', () => {
    expect(gallerySrc.includes('getFamilyGalleryPhotos(FAMILY_QUICK_FACES, getLocalContacts(), extras')).toBe(true)
  })

  it('grid is 3 columns', () => {
    expect(gallerySrc.includes("'repeat(3, minmax(0, 1fr))'")).toBe(true)
  })

  it('photo tiles render label as the figcaption (visible name under photo)', () => {
    expect(gallerySrc.includes('<figcaption')).toBe(true)
    expect(gallerySrc.includes('{p.label}')).toBe(true)
  })

  it('locks body scroll while open and restores on close', () => {
    expect(gallerySrc.includes("document.body.style.overflow = 'hidden'")).toBe(true)
    expect(/document\.body\.style\.overflow = prev/.test(gallerySrc)).toBe(true)
  })

  it('does NOT reference any phone field — privacy guard', () => {
    // Gallery item shape is id + label + photoUrl only. The component must
    // never read or render phoneE164 / whatsappE164.
    expect(gallerySrc.includes('phoneE164')).toBe(false)
    expect(gallerySrc.includes('whatsappE164')).toBe(false)
    // (The string `localStorage` appears in the helper import path
    // `./familyContactsStorage`, which is fine — that's just the module
    // boundary, not a phone-field access.)
  })
})

describe('AbuWhatsApp page header — Martita portrait is bigger and opens the gallery', () => {
  it('header portrait is a tappable <button> with aria-label "פתיחת גלריית המשפחה"', () => {
    expect(indexSrc.includes('data-testid="abuwhatsapp-header-portrait"')).toBe(true)
    expect(indexSrc.includes('aria-label="פתיחת גלריית המשפחה"')).toBe(true)
    expect(/abuwhatsapp-header-portrait[\s\S]{0,400}onClick=\{\(\) => setGalleryOpen\(true\)\}/.test(indexSrc)).toBe(true)
  })

  it('header portrait is at least 68 px (target was 68–80 px)', () => {
    const slice = indexSrc.match(/data-testid="abuwhatsapp-header-portrait"[\s\S]{0,800}/)
    expect(slice).not.toBeNull()
    const m = (slice as RegExpMatchArray)[0].match(/width:\s*(\d+),\s*height:\s*(\d+)/)
    expect(m).not.toBeNull()
    const w = parseInt((m as RegExpMatchArray)[1] as string, 10)
    const h = parseInt((m as RegExpMatchArray)[2] as string, 10)
    expect(w).toBeGreaterThanOrEqual(68)
    expect(w).toBeLessThanOrEqual(80)
    expect(h).toBe(w)
  })

  it('FamilyPhotoGallery is mounted in the page tree, controlled by galleryOpen state', () => {
    expect(indexSrc.includes('<FamilyPhotoGallery')).toBe(true)
    expect(indexSrc.includes('open={galleryOpen}')).toBe(true)
    expect(indexSrc.includes('onClose={() => setGalleryOpen(false)}')).toBe(true)
  })

  it('galleryExtras prepends the Abu / Martita portrait + family portrait', () => {
    expect(indexSrc.includes("id: 'martita-portrait'")).toBe(true)
    expect(indexSrc.includes("id: 'family-portrait'")).toBe(true)
  })
})

describe('Gallery + flip-card invariants intact', () => {
  it('localStorage key is unchanged', () => {
    const storageSrc = fs.readFileSync(
      path.join(PROJECT_ROOT, 'src/screens/AbuWhatsApp/familyContactsStorage.ts'),
      'utf8',
    )
    expect(storageSrc.includes("'abubank.familyContacts.v1'")).toBe(true)
  })

  it('circular flip Action Hub still present (PersonActionHub + GroupActionHub)', () => {
    expect(facesSrc.includes('function PersonActionHub')).toBe(true)
    expect(facesSrc.includes('function GroupActionHub')).toBe(true)
  })

  it('Ari / Anabel cute toast still present', () => {
    expect(facesSrc.includes('הן עדיין קטנות 👧✨')).toBe(true)
    expect(facesSrc.includes('עדיין אין להן טלפון משלהן')).toBe(true)
  })
})

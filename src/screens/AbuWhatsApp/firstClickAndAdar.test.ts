/*
 * Regression tests for two user-reported bugs.
 *
 * BUG 1 — First-click AbuWhatsApp navigation regression
 *   Root cause: useSWUpdate's `controllerchange` listener auto-reloaded
 *   the page even on FIRST-install (when the page didn't yet have a
 *   controller). On iOS PWAs the SW often takes control after the first
 *   user interaction, so tapping AbuWhatsApp triggered a reload that
 *   reset currentScreen back to Home — the user saw their tap "bounce".
 *   Fix: capture `navigator.serviceWorker.controller` at hook mount and
 *   skip the reload when it was null (first-install).
 *
 * BUG 2 — Adar photo crop
 *   Root cause: BubbleAvatar globally used object-fit:contain so a tall
 *   portrait like Adar's 883×2048 left visible black bands inside the
 *   round bubble.
 *   Fix: per-contact `photoFit` + `photoObjectPosition` metadata in the
 *   FamilyQuickFace scaffold. Adar opts into 'cover' + 'center 28%';
 *   every other contact keeps the existing contain/center default and
 *   is unaffected.
 *
 * vitest runs in node env (no DOM rendering), so each test asserts the
 * source contract. Module imports also exercise the helper purity.
 */

import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import {
  mergeFacesWithLocal,
} from './familyQuickFaces'
import { FAMILY_QUICK_FACES, type FamilyQuickFace } from './familyContacts.private'
import type { LocalFamilyContact } from './familyContactsStorage'

const PROJECT_ROOT = path.resolve(__dirname, '../../..')
function read(rel: string): string {
  return fs.readFileSync(path.join(PROJECT_ROOT, rel), 'utf8')
}

const swSrc = read('src/hooks/useSWUpdate.ts')
const facesSrc = read('src/screens/AbuWhatsApp/familyQuickFaces.tsx')
const scaffoldSrc = read('src/screens/AbuWhatsApp/familyContacts.private.ts')

// ─── BUG 1 ────────────────────────────────────────────────────────────────

describe('useSWUpdate — first-install controllerchange must NOT reload (BUG 1 fix)', () => {
  it('captures the initial controller state at hook mount', () => {
    // The hook must read navigator.serviceWorker.controller BEFORE
    // attaching the controllerchange listener so we can distinguish
    // first-install (controller was null) from a real update.
    expect(swSrc.includes('hadControllerAtMount')).toBe(true)
    expect(/const hadControllerAtMount = !!navigator\.serviceWorker\.controller/.test(swSrc)).toBe(true)
  })

  it('controllerchange handler EARLY-returns when there was no initial controller', () => {
    // Source contract: the very first conditional inside the handler must
    // bail out for first-install (hadControllerAtMount === false), so
    // window.location.reload() never fires on first claim.
    const m = swSrc.match(/const handleControllerChange = \(\) => \{([\s\S]*?)\n {4}\}/)
    expect(m).not.toBeNull()
    const body = (m as RegExpMatchArray)[1] ?? ''
    expect(body.includes('if (!hadControllerAtMount) return')).toBe(true)
    // Reload is still present for the real-update path.
    expect(body.includes('window.location.reload()')).toBe(true)
    // The first guard must run BEFORE the reload call.
    const guardIdx = body.indexOf('if (!hadControllerAtMount) return')
    const reloadIdx = body.indexOf('window.location.reload()')
    expect(guardIdx).toBeGreaterThan(-1)
    expect(reloadIdx).toBeGreaterThan(guardIdx)
  })

  it('comment explains the iOS PWA bounce-back symptom (regression doc)', () => {
    // Future maintainers must not "simplify" the guard back. Keep the
    // explanation in source so the next refactor leaves it alone.
    expect(swSrc.includes('First-install guard')).toBe(true)
    expect(swSrc.includes('iOS Safari')).toBe(true)
    expect(swSrc.includes('controllerchange')).toBe(true)
  })

  it('still reloads on REAL updates (existing controller + new SW takes over)', () => {
    // Real-update path must remain functional. The reloading-guard +
    // reload call live after the first-install guard.
    expect(swSrc.includes('reloading = true')).toBe(true)
    expect(/if \(reloading\) return/.test(swSrc)).toBe(true)
  })

  it('module-level imports stay free of side effects (no auto-execution)', () => {
    // Sanity: useSWUpdate is a pure hook; no top-level
    // navigator.serviceWorker.addEventListener that would fire before
    // first React render and bypass the guard.
    expect(swSrc.match(/^navigator\.serviceWorker\.addEventListener/m)).toBeNull()
  })
})

// ─── BUG 2 ────────────────────────────────────────────────────────────────

describe('BubbleAvatar per-contact photo crop metadata (BUG 2 fix)', () => {
  it('FamilyQuickFace types accept optional photoFit and photoObjectPosition', () => {
    expect(scaffoldSrc.includes('photoFit?: PhotoFit')).toBe(true)
    expect(scaffoldSrc.includes('photoObjectPosition?: string')).toBe(true)
    expect(scaffoldSrc.includes("export type PhotoFit = 'contain' | 'cover'")).toBe(true)
  })

  it("Adar's scaffold entry opts into cover + an upper-portrait crop (face stays visible)", () => {
    const adar = FAMILY_QUICK_FACES.find(
      (f) => f.type === 'person' && f.id === 'adar',
    ) as Extract<FamilyQuickFace, { type: 'person' }> | undefined
    expect(adar).toBeDefined()
    expect(adar?.photoFit).toBe('cover')
    expect(adar?.photoObjectPosition).toBe('center 28%')
    // Photo URL is unchanged (no source image edit).
    expect(adar?.photoFile).toBe('/family-contacts/adar.jpeg')
  })

  it('every OTHER scaffold person inherits the default (no photoFit override)', () => {
    const persons = FAMILY_QUICK_FACES.filter((f) => f.type === 'person') as Extract<FamilyQuickFace, { type: 'person' }>[]
    for (const p of persons) {
      if (p.id === 'adar') continue
      expect(p.photoFit, `id=${p.id}`).toBeUndefined()
      expect(p.photoObjectPosition, `id=${p.id}`).toBeUndefined()
    }
  })

  it('BubbleAvatar resolves photoFit/photoObjectPosition with safe defaults', () => {
    expect(facesSrc.includes("photoFit ?? 'contain'")).toBe(true)
    expect(facesSrc.includes("photoObjectPosition ?? 'center'")).toBe(true)
    // Image element reads the resolved values, not hardcoded literals.
    expect(/objectFit:\s*resolvedFit/.test(facesSrc)).toBe(true)
    expect(/objectPosition:\s*resolvedPosition/.test(facesSrc)).toBe(true)
  })

  it('BubbleTile threads photoFit + photoObjectPosition into BubbleAvatar', () => {
    expect(facesSrc.includes('photoFit?: \'contain\' | \'cover\' | undefined')).toBe(true)
    expect(facesSrc.includes('photoObjectPosition?: string | undefined')).toBe(true)
    expect(/<BubbleAvatar[\s\S]{0,400}photoFit=\{photoFit\}[\s\S]{0,200}photoObjectPosition=\{photoObjectPosition\}/.test(facesSrc)).toBe(true)
  })

  it('FamilyQuickFaces grid forwards p.photoFit / p.photoObjectPosition for both group + person tiles', () => {
    expect(/<BubbleTile[\s\S]{0,800}kind="group"[\s\S]{0,400}photoFit=\{group\.photoFit\}/.test(facesSrc)).toBe(true)
    expect(/<BubbleTile[\s\S]{0,800}kind="person"[\s\S]{0,400}photoFit=\{p\.photoFit\}/.test(facesSrc)).toBe(true)
  })

  it("mergeFacesWithLocal preserves scaffold photoFit + photoObjectPosition when scaffold's own photo wins", () => {
    const ari: Extract<FamilyQuickFace, { type: 'person' }> = {
      type: 'person', id: 'adar', displayName: 'אדר',
      phoneE164: '', enabled: false,
      photoFile: '/family-contacts/adar.jpeg',
      photoFit: 'cover', photoObjectPosition: 'center 28%',
    }
    const merged = mergeFacesWithLocal([ari], [])
    const m = merged[0] as Extract<FamilyQuickFace, { type: 'person' }>
    expect(m.photoFit).toBe('cover')
    expect(m.photoObjectPosition).toBe('center 28%')
  })

  it('mergeFacesWithLocal drops the scaffold crop when an OPERATOR photo override wins (unknown aspect ratio)', () => {
    const adarScaffold: Extract<FamilyQuickFace, { type: 'person' }> = {
      type: 'person', id: 'adar', displayName: 'אדר',
      phoneE164: '', enabled: false,
      photoFile: '/family-contacts/adar.jpeg',
      photoFit: 'cover', photoObjectPosition: 'center 28%',
    }
    const local: LocalFamilyContact[] = [
      { id: 'adar', enabled: true, phoneE164: '+972500000001', photoFile: '/operator/adar-square.jpg' },
    ]
    const merged = mergeFacesWithLocal([adarScaffold], local)
    const m = merged[0] as Extract<FamilyQuickFace, { type: 'person' }>
    expect(m.photoFile).toBe('/operator/adar-square.jpg')
    // Operator-supplied photos default to contain/center — we don't
    // know their aspect ratio, so we don't carry over the cover crop.
    expect(m.photoFit).toBeUndefined()
    expect(m.photoObjectPosition).toBeUndefined()
  })

  it('source image files are unchanged (no edit to public/family-contacts/adar.jpeg)', () => {
    // Stat-based regression guard: the file still exists at its original
    // path. Per privacy/architecture rules we do not edit committed
    // image files.
    const p = path.join(PROJECT_ROOT, 'public/family-contacts/adar.jpeg')
    expect(fs.existsSync(p)).toBe(true)
    expect(fs.statSync(p).size).toBeGreaterThan(0)
  })
})

// ─── Cross-bug regression guard ────────────────────────────────────────────

describe('Existing AbuWhatsApp invariants intact', () => {
  it('localStorage key is unchanged', () => {
    const storageSrc = read('src/screens/AbuWhatsApp/familyContactsStorage.ts')
    expect(storageSrc.includes("'abubank.familyContacts.v1'")).toBe(true)
  })

  it('circular Action Hub components remain present', () => {
    expect(facesSrc.includes('function PersonActionHub')).toBe(true)
    expect(facesSrc.includes('function GroupActionHub')).toBe(true)
  })

  it('Family-photo gallery + helper still exported', () => {
    expect(facesSrc.includes('export function getFamilyGalleryPhotos')).toBe(true)
  })

  it('Ari / Anabel cute toast still present', () => {
    expect(facesSrc.includes('הן עדיין קטנות 👧✨')).toBe(true)
  })
})

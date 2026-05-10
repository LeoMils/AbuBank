/*
 * Wordmark + icon-bar polish — source-contract tests.
 *
 * The AbuWhatsApp page wordmark must read "Abu WhatsApp" with the
 * AbuBank teal gradient on "Abu" and the authentic WhatsApp green on
 * "WhatsApp". Every icon-bar across the app (ScreenHeader on AI /
 * Calendar / Games + the AbuWhatsApp custom header) gets a subtle,
 * cute, premium animation: a slow gradient sheen on the title and a
 * breathing 1-px glow line at the bottom of the bar. All animations
 * are respected by the reduced-motion media query.
 *
 * vitest runs in node env (no DOM rendering), so each test is a static
 * grep against the relevant source files.
 */

import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'

const PROJECT_ROOT = path.resolve(__dirname, '../../..')
function read(rel: string): string {
  return fs.readFileSync(path.join(PROJECT_ROOT, rel), 'utf8')
}

const indexSrc = read('src/screens/AbuWhatsApp/index.tsx')
const screenHeaderSrc = read('src/components/ScreenHeader/index.tsx')
const animationsSrc = read('src/design/animations.ts')

describe('AbuWhatsApp page wordmark — "Abu" (AbuBank teal) + "WhatsApp" (WA green)', () => {
  it('wordmark renders "Abu WhatsApp" — Hebrew "הודעות" is gone from the wordmark + InfoButton title', () => {
    expect(indexSrc.includes('>Abu</span>')).toBe(true)
    expect(indexSrc.includes('>WhatsApp</span>')).toBe(true)
    // Wordmark scope: assert no Hebrew "הודעות" string sits inside the
    // wordmark element. (The natural-language phrase "כתיבת הודעות" inside
    // the InfoButton lines is unrelated marketing copy and stays.)
    const wordmark = indexSrc.match(/data-testid="abuwhatsapp-wordmark"[\s\S]*?<\/div>/)
    expect(wordmark).not.toBeNull()
    expect((wordmark as RegExpMatchArray)[0].includes('הודעות')).toBe(false)
    // InfoButton title is "Abu WhatsApp" too:
    expect(indexSrc.includes('title="Abu WhatsApp"')).toBe(true)
    expect(indexSrc.includes('title="Abu הודעות"')).toBe(false)
  })

  it('wordmark has stable testids for the two halves', () => {
    expect(indexSrc.includes('data-testid="abuwhatsapp-wordmark"')).toBe(true)
    expect(indexSrc.includes('data-testid="abuwhatsapp-wordmark-abu"')).toBe(true)
    expect(indexSrc.includes('data-testid="abuwhatsapp-wordmark-whatsapp"')).toBe(true)
  })

  it('"Abu" half uses the AbuBank teal gradient (GRADIENT_TEAL)', () => {
    const ms = indexSrc.match(/data-testid="abuwhatsapp-wordmark-abu"[\s\S]{0,800}/)
    expect(ms).not.toBeNull()
    const block = (ms as RegExpMatchArray)[0]
    expect(block.includes('GRADIENT_TEAL')).toBe(true)
  })

  it('"WhatsApp" half uses an authentic WhatsApp green palette (#25D366 in the gradient)', () => {
    const ms = indexSrc.match(/data-testid="abuwhatsapp-wordmark-whatsapp"[\s\S]{0,1000}/)
    expect(ms).not.toBeNull()
    const block = (ms as RegExpMatchArray)[0]
    expect(block.includes('#25D366')).toBe(true)
    expect(block.includes('#128C7E')).toBe(true)
    expect(block.includes('#86EFAC')).toBe(true)
  })

  it('both halves carry the abuTitleSheen animation for an alive feel', () => {
    const abuSlice = indexSrc.match(/data-testid="abuwhatsapp-wordmark-abu"[\s\S]{0,800}/)
    const waSlice = indexSrc.match(/data-testid="abuwhatsapp-wordmark-whatsapp"[\s\S]{0,1200}/)
    expect((abuSlice as RegExpMatchArray)[0].includes('abuTitleSheen')).toBe(true)
    expect((waSlice as RegExpMatchArray)[0].includes('abuTitleSheen')).toBe(true)
  })

  it('"WhatsApp" half also gets the soft abuWaGlow drop-shadow halo', () => {
    const waSlice = indexSrc.match(/data-testid="abuwhatsapp-wordmark-whatsapp"[\s\S]{0,1200}/)
    expect((waSlice as RegExpMatchArray)[0].includes('abuWaGlow')).toBe(true)
  })

  it('AbuWhatsApp injects shared keyframes at mount', () => {
    expect(indexSrc.includes("import { injectSharedKeyframes } from '../../design/animations'")).toBe(true)
    expect(/useEffect\(\(\) => \{ injectSharedKeyframes\(\) \}, \[\]\)/.test(indexSrc)).toBe(true)
  })
})

describe('Shared ScreenHeader — icon-bar polish (AI / Calendar / Games)', () => {
  it('title carries the abuTitleSheen animation + 200%+ background-size', () => {
    expect(screenHeaderSrc.includes("animation: 'abuTitleSheen 8s ease-in-out infinite'")).toBe(true)
    expect(/backgroundSize:\s*'\d{3}%/.test(screenHeaderSrc)).toBe(true)
  })

  it('bottom glow line breathes via abuBarBreath keyframes', () => {
    expect(screenHeaderSrc.includes("animation: 'abuBarBreath 6s ease-in-out infinite'")).toBe(true)
    expect(screenHeaderSrc.includes('data-testid="screen-header-glow"')).toBe(true)
  })

  it('ScreenHeader injects shared keyframes at mount', () => {
    expect(screenHeaderSrc.includes("import { injectSharedKeyframes }")).toBe(true)
    expect(/useEffect\(\(\) => \{ injectSharedKeyframes\(\) \}, \[\]\)/.test(screenHeaderSrc)).toBe(true)
  })

  it('header element + title have stable testids for QA tooling', () => {
    expect(screenHeaderSrc.includes('data-testid="screen-header"')).toBe(true)
    expect(screenHeaderSrc.includes('data-testid="screen-header-title"')).toBe(true)
  })
})

describe('AbuWhatsApp custom header bar — same breathing glow line', () => {
  it('custom header has its own breathing glow with the abuBarBreath keyframes', () => {
    expect(indexSrc.includes('data-testid="abuwhatsapp-screen-header"')).toBe(true)
    expect(indexSrc.includes('data-testid="abuwhatsapp-screen-header-glow"')).toBe(true)
    expect(/abuwhatsapp-screen-header-glow"[\s\S]{0,800}abuBarBreath/.test(indexSrc)).toBe(true)
  })

  it('glow line uses authentic WhatsApp-green tint (rgba 37,211,102)', () => {
    const m = indexSrc.match(/abuwhatsapp-screen-header-glow"[\s\S]{0,1000}/)
    const block = (m as RegExpMatchArray)[0]
    expect(block.includes('rgba(37,211,102')).toBe(true)
  })
})

describe('Shared keyframes — definitions + reduced-motion safety', () => {
  it('animations module exports the new keyframes (abuTitleSheen, abuBarBreath, abuWaGlow)', () => {
    expect(animationsSrc.includes('@keyframes abuTitleSheen')).toBe(true)
    expect(animationsSrc.includes('@keyframes abuBarBreath')).toBe(true)
    expect(animationsSrc.includes('@keyframes abuWaGlow')).toBe(true)
  })

  it('every new keyframe has a prefers-reduced-motion override that disables motion', () => {
    const reducedBlock = animationsSrc.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\s*\}\n`/)
    expect(reducedBlock).not.toBeNull()
    const inside = (reducedBlock as RegExpMatchArray)[1] ?? ''
    expect(inside.includes('@keyframes abuTitleSheen')).toBe(true)
    expect(inside.includes('@keyframes abuBarBreath')).toBe(true)
    expect(inside.includes('@keyframes abuWaGlow')).toBe(true)
  })

  it('injectSharedKeyframes is idempotent (guards on the SHARED_KEYFRAMES_ID element)', () => {
    expect(animationsSrc.includes('document.getElementById(SHARED_KEYFRAMES_ID)')).toBe(true)
  })
})

describe('Existing AbuWhatsApp invariants intact', () => {
  it('Family-photo gallery still wired to header portrait', () => {
    expect(indexSrc.includes('data-testid="abuwhatsapp-header-portrait"')).toBe(true)
    expect(indexSrc.includes('aria-label="פתיחת גלריית המשפחה"')).toBe(true)
    expect(indexSrc.includes('<FamilyPhotoGallery')).toBe(true)
  })

  it('PR #15 circular Action Hub components remain present in source', () => {
    const facesSrc = read('src/screens/AbuWhatsApp/familyQuickFaces.tsx')
    expect(facesSrc.includes('function PersonActionHub')).toBe(true)
    expect(facesSrc.includes('function GroupActionHub')).toBe(true)
  })

  it('localStorage key is still abubank.familyContacts.v1', () => {
    const storageSrc = read('src/screens/AbuWhatsApp/familyContactsStorage.ts')
    expect(storageSrc.includes("'abubank.familyContacts.v1'")).toBe(true)
  })
})

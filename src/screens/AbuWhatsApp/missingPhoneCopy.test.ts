import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import {
  ARI_ANABEL_NO_PHONE_TOAST,
  GENERIC_MISSING_PHONE_TOAST,
  getMissingPhoneMessage,
  isPersonActionable,
} from './familyQuickFaces'
import { FAMILY_QUICK_FACES, type FamilyQuickFace } from './familyContacts.private'

const PROJECT_ROOT = path.resolve(__dirname, '../../..')
const TEST_FAKE_PHONE = '+972501234567'

describe('getMissingPhoneMessage — Ari / Anabel cute copy exception', () => {
  it('Ari (no phone) gets the cute family-friendly message', () => {
    const msg = getMissingPhoneMessage('ari')
    expect(msg).toBe(ARI_ANABEL_NO_PHONE_TOAST)
    expect(msg.includes('הן עדיין קטנות')).toBe(true)
    expect(msg.includes('עדיין אין להן טלפון משלהן')).toBe(true)
    expect(msg.includes('👧')).toBe(true)
  })

  it('Anabel (no phone) gets the cute family-friendly message', () => {
    expect(getMissingPhoneMessage('anabel')).toBe(ARI_ANABEL_NO_PHONE_TOAST)
  })

  it('the cute copy is multi-line (two lines)', () => {
    expect(ARI_ANABEL_NO_PHONE_TOAST.includes('\n')).toBe(true)
    const lines = ARI_ANABEL_NO_PHONE_TOAST.split('\n')
    expect(lines.length).toBe(2)
    expect(lines[0]).toBe('הן עדיין קטנות 👧✨')
    expect(lines[1]).toBe('עדיין אין להן טלפון משלהן')
  })

  it('every OTHER scaffold person falls back to the generic toast', () => {
    const otherIds = ['mor', 'leo', 'yael', 'raphi', 'ofir', 'ayalon',
      'eili', 'adar', 'adi', 'noam', 'yarden', 'gilad']
    for (const id of otherIds) {
      expect(getMissingPhoneMessage(id), `id ${id}`).toBe(GENERIC_MISSING_PHONE_TOAST)
    }
  })

  it('an unknown id also falls back to the generic toast', () => {
    expect(getMissingPhoneMessage('unknown-future-id')).toBe(GENERIC_MISSING_PHONE_TOAST)
  })

  it('GENERIC_MISSING_PHONE_TOAST text is preserved verbatim', () => {
    expect(GENERIC_MISSING_PHONE_TOAST).toBe('המספר עדיין לא הוגדר')
  })
})

describe('Ari / Anabel still become actionable when a phone is saved', () => {
  it('Ari with a valid local phone + enabled is actionable', () => {
    const ari: Extract<FamilyQuickFace, { type: 'person' }> = {
      type: 'person', id: 'ari', displayName: 'ארי',
      phoneE164: TEST_FAKE_PHONE, enabled: true,
    }
    expect(isPersonActionable(ari)).toBe(true)
    // helper is still defined for the id but the call site (handleTapPerson)
    // only consults it when isPersonActionable is false.
    expect(getMissingPhoneMessage(ari.id)).toBe(ARI_ANABEL_NO_PHONE_TOAST)
  })

  it('Anabel with a valid local phone + enabled is actionable', () => {
    const anabel: Extract<FamilyQuickFace, { type: 'person' }> = {
      type: 'person', id: 'anabel', displayName: 'אנאבל',
      phoneE164: TEST_FAKE_PHONE, enabled: true,
    }
    expect(isPersonActionable(anabel)).toBe(true)
  })
})

describe('handleTapPerson source contract — uses getMissingPhoneMessage', () => {
  const facesSrc = fs.readFileSync(
    path.join(PROJECT_ROOT, 'src/screens/AbuWhatsApp/familyQuickFaces.tsx'),
    'utf8',
  )

  it('handleTapPerson calls getMissingPhoneMessage(face.id), not the literal toast', () => {
    expect(facesSrc.includes('showToast(getMissingPhoneMessage(face.id))')).toBe(true)
    // The literal generic toast text appears ONLY inside the constant
    // declaration and any aria/source-contract use — never as a hardcoded
    // showToast argument.
    const showToastCalls = facesSrc.match(/showToast\(\s*['"`][^'"`]+['"`]\s*\)/g) ?? []
    for (const call of showToastCalls) {
      expect(call.includes('המספר עדיין לא הוגדר'), `unexpected hardcoded toast: ${call}`).toBe(false)
      expect(call.includes('הן עדיין קטנות'), `unexpected hardcoded ari/anabel toast: ${call}`).toBe(false)
    }
  })

  it('the toast container respects multi-line copy (whiteSpace: pre-line)', () => {
    expect(facesSrc.includes("whiteSpace: 'pre-line'")).toBe(true)
  })

  it('Ari and Anabel are present in the scaffold and are NOT actionable by default', () => {
    const ari = FAMILY_QUICK_FACES.find((f) => f.type === 'person' && f.id === 'ari')
    const anabel = FAMILY_QUICK_FACES.find((f) => f.type === 'person' && f.id === 'anabel')
    expect(ari).toBeDefined()
    expect(anabel).toBeDefined()
    expect(isPersonActionable(ari as Extract<FamilyQuickFace, { type: 'person' }>)).toBe(false)
    expect(isPersonActionable(anabel as Extract<FamilyQuickFace, { type: 'person' }>)).toBe(false)
  })
})

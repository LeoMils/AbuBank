import { describe, it, expect } from 'vitest'
import { importContactsJSON } from './familyContactsStorage'
import { getDisplayablePersons, isPersonActionable } from './familyQuickFaces'

// The home communication board (FamilyQuickFaces) must reflect imported
// contacts: a scaffold person whose phone was just imported becomes actionable
// (Call / WhatsApp), and an imported photo (photoDataUrl) is rendered. This is
// the merge contract that makes "after a successful import, the family screen
// shows the members" true — the same-tab refresh event is what triggers it at
// runtime; here we prove the data path the board renders from.
describe('family board reflects imported contacts', () => {
  it('an imported, enabled scaffold contact becomes actionable on the board', () => {
    const r = importContactsJSON('[{ "id": "mor", "enabled": true, "phoneE164": "+972500000001" }]')
    expect(r.ok, r.errors.join(' | ')).toBe(true)

    const persons = getDisplayablePersons(r.contacts)
    const mor = persons.find((p) => p.id === 'mor')
    expect(mor, 'mor must render on the board').toBeTruthy()
    expect(isPersonActionable(mor!)).toBe(true) // Call + WhatsApp now available
    expect(mor!.phoneE164).toBe('+972500000001')
  })

  it('an imported photo is merged onto the board tile', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgo='
    const r = importContactsJSON(
      `[{ "id": "mor", "enabled": true, "phoneE164": "+972500000001", "photoDataUrl": "${dataUrl}" }]`,
    )
    expect(r.ok, r.errors.join(' | ')).toBe(true)
    const mor = getDisplayablePersons(r.contacts).find((p) => p.id === 'mor')
    expect(mor!.photoFile).toBe(dataUrl)
  })

  it('a local number (05…) imports, normalizes, and is actionable', () => {
    const r = importContactsJSON('[{ "id": "yael", "enabled": true, "phoneE164": "0501234567" }]')
    expect(r.ok, r.errors.join(' | ')).toBe(true)
    const yael = getDisplayablePersons(r.contacts).find((p) => p.id === 'yael')
    expect(yael!.phoneE164).toBe('+972501234567')
    expect(isPersonActionable(yael!)).toBe(true)
  })
})

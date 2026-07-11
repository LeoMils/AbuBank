import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { FamilyPhones } from './index'

const pageSrc = fs.readFileSync(path.join(__dirname, 'index.tsx'), 'utf8')

describe('Family Phones page — required Hebrew controls', () => {
  it('renders the page with file, paste, and the always-visible actions', () => {
    const html = renderToString(React.createElement(FamilyPhones, { onClose: () => {} }))
    expect(html).toContain('מספרי טלפון משפחתיים')     // title
    expect(html).toContain('בחירת קובץ JSON')            // file button
    expect(html).toContain('בדיקה לפני שמירה')           // check button
    expect(html).toContain('מחיקת כל המספרים')           // delete button
    expect(html).toContain('family-phones-file')          // file input present
    expect(html).toContain('paste-json')                  // textarea present
  })

  it('defines the confirm-save + export controls (shown after a valid check)', () => {
    // These render after a preview exists; assert they are wired in the source.
    expect(pageSrc).toContain('אישור ושמירת המספרים')
    expect(pageSrc).toContain('ייצוא גיבוי')
    expect(pageSrc).toContain('confirm-save')
    expect(pageSrc).toContain("savedMessage(savedCount)") // exact success line source
  })

  it('the preview is masked (never renders a raw phoneE164 field)', () => {
    // The page only ever renders row.masked, not the raw number.
    expect(pageSrc).toContain('row.masked')
    expect(pageSrc).not.toMatch(/\{row\.phoneE164\}|\{c\.phoneE164\}/)
  })
})

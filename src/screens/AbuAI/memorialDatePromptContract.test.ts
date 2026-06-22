/*
 * Emotional-correctness contract: the live AbuAI SYSTEM_PROMPT must NEVER state a
 * Pepe/Papi memorial date that differs from the single source of truth
 * (knowledge/family_data.json → deceased.memorial_date). A wrong memorial date in
 * the conversational path is an emotional hard-fail.
 *
 * The prompt previously hardcoded "26 בדצמבר" (Dec 26) while the data + calendar
 * use 01-01. This test fails if any conflicting hardcoded date returns, and proves
 * the prompt defers the date to the deterministic memorial tool.
 */
import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import { SYSTEM_PROMPT } from './service'
import { getMemorialFor } from './tools'

const familyData = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../knowledge/family_data.json'), 'utf8'),
) as { family: { deceased: { memorial_date: string } } }

describe('SYSTEM_PROMPT memorial-date integrity', () => {
  it('contains NO hardcoded Dec-26 / 12-26 memorial date (the old wrong value)', () => {
    const WRONG = ['26 בדצמבר', 'Dec 26', 'December 26', '12-26', '26-12', '26/12', '26.12', 'דצמבר 26']
    for (const w of WRONG) expect(SYSTEM_PROMPT.includes(w)).toBe(false)
  })

  it('defers the memorial date to the get_memorial_for tool instead of stating it', () => {
    expect(SYSTEM_PROMPT.includes('get_memorial_for')).toBe(true)
  })

  it('does not hardcode the data memorial-date string either (single source = the data/tool)', () => {
    // Even the CORRECT date must not be hand-typed into the prompt — drift-proofing.
    // memorial_date is "MM-DD"; assert neither the raw nor a Hebrew-month spelling is asserted as a fact line.
    const md = familyData.family.deceased.memorial_date // e.g. "01-01"
    expect(SYSTEM_PROMPT.includes(md)).toBe(false)
  })

  it('the deterministic memorial tool answers from family_data (01-01 → January)', () => {
    const out = getMemorialFor('פפי')
    expect(out.found).toBe(true)
    // 01-01 must surface as 1 January in Hebrew; the runtime answer is data-sourced.
    expect(out.summary).toContain('1 בינואר')
    // And must never surface the old wrong month.
    expect(out.summary.includes('דצמבר')).toBe(false)
  })
})

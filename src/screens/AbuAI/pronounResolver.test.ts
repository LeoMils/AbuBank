/*
 * Cross-turn pronoun resolution tests.
 */

import { describe, it, expect } from 'vitest'
import { resolvePronouns, findLastMentionedPerson } from './pronounResolver'

const msgs = (texts: string[]) => texts.map(content => ({ content }))

describe('findLastMentionedPerson', () => {
  it('finds נועם in recent messages', () => {
    const result = findLastMentionedPerson(msgs([
      'דיברתי עם נועם',
      'מה שלומו?',
    ]))
    expect(result).toBe('נועם')
  })

  it('finds מור (female) when filtering by gender', () => {
    const result = findLastMentionedPerson(msgs([
      'דיברתי עם מור',
      'מה שלומה?',
    ]), 'female')
    expect(result).toBe('מור')
  })

  it('returns most recent mention (last message first)', () => {
    const result = findLastMentionedPerson(msgs([
      'שלום לנועם',
      'ואח כך דיברתי עם אופיר',
    ]))
    expect(result).toBe('אופיר')
  })

  it('returns null when no family member mentioned', () => {
    const result = findLastMentionedPerson(msgs([
      'שלום',
      'מה שלומך',
    ]))
    expect(result).toBeNull()
  })
})

describe('resolvePronouns', () => {
  it('"להתקשר אליו" after נועם → "להתקשר לנועם"', () => {
    const { resolved, personName } = resolvePronouns(
      'תזכירי לי להתקשר אליו',
      msgs(['דיברתי עם נועם']),
    )
    expect(resolved).toContain('לנועם')
    expect(personName).toBe('נועם')
  })

  it('"יום ההולדת שלה" after מור → "יום ההולדת של מור"', () => {
    const { resolved, personName } = resolvePronouns(
      'מתי יום ההולדת שלה',
      msgs(['איך מור?']),
    )
    expect(resolved).toContain('של מור')
    expect(personName).toBe('מור')
  })

  it('"להתקשר אליה" after מור → "להתקשר למור"', () => {
    const { resolved } = resolvePronouns(
      'תזכירי לי להתקשר אליה',
      msgs(['שוחחתי עם מור']),
    )
    expect(resolved).toContain('למור')
  })

  it('no pronoun → returns original text', () => {
    const { resolved, personName } = resolvePronouns(
      'תזכירי לי לקחת כדור',
      msgs(['דיברתי עם נועם']),
    )
    expect(resolved).toBe('תזכירי לי לקחת כדור')
    expect(personName).toBeNull()
  })

  it('pronoun but no person in history → returns original', () => {
    const { resolved, personName } = resolvePronouns(
      'תזכירי לי להתקשר אליו',
      msgs(['שלום', 'מה שלומך']),
    )
    expect(resolved).toBe('תזכירי לי להתקשר אליו')
    expect(personName).toBeNull()
  })

  it('gender mismatch → no resolution (אליו but only female mentioned)', () => {
    const { resolved, personName } = resolvePronouns(
      'תזכירי לי להתקשר אליו',
      msgs(['דיברתי עם מור']), // Mor is female, אליו is male
    )
    // Mor is female, pronoun is male → no match
    expect(personName).toBeNull()
  })
})

describe('AbuAI index wiring', () => {
  it('pronounResolver is imported and used in handleSend', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.resolve(__dirname, 'index.tsx'), 'utf8')
    expect(src.includes("import { resolvePronouns }")).toBe(true)
    expect(src.includes("resolvePronouns(msgText, messages)")).toBe(true)
  })

  it('voice path uses effectiveText for routing', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.resolve(__dirname, 'index.tsx'), 'utf8')
    expect(src.includes("resolvePronouns(text, messagesRef.current)")).toBe(true)
    expect(src.includes("isCreateIntent(effectiveText)")).toBe(true)
  })
})

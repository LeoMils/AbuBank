import { describe, it, expect } from 'vitest'
import { shouldShowConfirmationReadback } from './voiceReadbackGuard'

describe('shouldShowConfirmationReadback — incomplete drafts must return false', () => {
  it('title-only => false', () => {
    expect(shouldShowConfirmationReadback('parsed', { title: 'פגישה עם הרופא', date: null, time: null })).toBe(false)
  })

  it('date-only => false', () => {
    expect(shouldShowConfirmationReadback('parsed', { title: '', date: '2026-05-22', time: null })).toBe(false)
  })

  it('time-only => false', () => {
    expect(shouldShowConfirmationReadback('parsed', { title: '', date: null, time: '14:00' })).toBe(false)
  })

  it('title+date only => false', () => {
    expect(shouldShowConfirmationReadback('parsed', { title: 'רופא', date: '2026-05-22', time: null })).toBe(false)
  })

  it('title+time only => false', () => {
    expect(shouldShowConfirmationReadback('parsed', { title: 'רופא', date: null, time: '14:00' })).toBe(false)
  })

  it('date+time only => false', () => {
    expect(shouldShowConfirmationReadback('parsed', { title: '', date: '2026-05-22', time: '14:00' })).toBe(false)
  })
})

describe('shouldShowConfirmationReadback — complete draft', () => {
  it('title+date+time => true', () => {
    expect(shouldShowConfirmationReadback('parsed', { title: 'רופא שיניים', date: '2026-05-22', time: '10:00' })).toBe(true)
  })

  it('complete draft during recording state (correction flow) => true', () => {
    expect(shouldShowConfirmationReadback('recording', { title: 'פגישה', date: '2026-05-22', time: '14:00' })).toBe(true)
  })
})

describe('shouldShowConfirmationReadback — error state always false', () => {
  it('voiceState error + complete draft => false', () => {
    expect(shouldShowConfirmationReadback('error', { title: 'פגישה', date: '2026-05-22', time: '14:00' })).toBe(false)
  })

  it('voiceState error + empty draft => false', () => {
    expect(shouldShowConfirmationReadback('error', { title: '', date: null, time: null })).toBe(false)
  })
})

describe('shouldShowConfirmationReadback — edge cases', () => {
  it('parsed is null => false', () => {
    expect(shouldShowConfirmationReadback('parsed', null)).toBe(false)
  })

  it('empty draft in parsed state => false', () => {
    expect(shouldShowConfirmationReadback('parsed', { title: '', date: null, time: null })).toBe(false)
  })

  it('whitespace-only title => false', () => {
    expect(shouldShowConfirmationReadback('parsed', { title: '   ', date: '2026-05-22', time: '10:00' })).toBe(false)
  })
})


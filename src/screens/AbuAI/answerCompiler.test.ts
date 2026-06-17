import { describe, it, expect } from 'vitest'
import { compileHumanAnswer } from './answerCompiler'
import {
  makeOpenEvidence,
  makeNoEvidence,
  makeToolErrorEvidence,
  makeCalendarEvidence,
  makeFamilyEvidence,
  makeOnlineEvidence,
  makeWeatherEvidence,
} from './evidencePacket'
import type { ContentWorldChoice } from './contentWorldEngine'

describe('compileHumanAnswer — tool failure', () => {
  it('Hebrew tool error returns "אני לא מצליחה לבדוק כרגע."', () => {
    const r = compileHumanAnswer('q', makeToolErrorEvidence('cal', 'err'), { lang: 'he' })
    expect(r.text).toBe('אני לא מצליחה לבדוק כרגע.')
    expect(r.isFailureCopy).toBe(true)
  })
  it('Spanish tool error returns "No puedo comprobarlo ahora mismo."', () => {
    const r = compileHumanAnswer('q', makeToolErrorEvidence('cal', 'err'), { lang: 'es' })
    expect(r.text).toBe('No puedo comprobarlo ahora mismo.')
  })
  it('English tool error returns "I cannot check right now."', () => {
    const r = compileHumanAnswer('q', makeToolErrorEvidence('cal', 'err'), { lang: 'en' })
    expect(r.text).toBe('I cannot check right now.')
  })
})

describe('compileHumanAnswer — no evidence on personal/current request', () => {
  it('Hebrew not-found for empty calendar evidence', () => {
    const r = compileHumanAnswer('q', makeCalendarEvidence([]), { lang: 'he' })
    expect(r.text).toBe('אין לי מידע על זה.')
    expect(r.isFailureCopy).toBe(true)
  })
  it('Spanish "No encontré nada." for empty family evidence', () => {
    const r = compileHumanAnswer('q', makeFamilyEvidence([]), { lang: 'es' })
    expect(r.text).toBe('No encontré nada.')
  })
  it('online with empty facts → "I did not find anything." (en)', () => {
    const r = compileHumanAnswer('q', makeOnlineEvidence([]), { lang: 'en' })
    expect(r.text).toBe('I did not find anything.')
  })
})

describe('compileHumanAnswer — never invents beyond evidence', () => {
  it('calendar uses facts verbatim, joined with newlines', () => {
    const r = compileHumanAnswer('q', makeCalendarEvidence(['10:00 רופא', '17:00 קונצרט']), { lang: 'he' })
    expect(r.text).toBe('10:00 רופא\n17:00 קונצרט')
    expect(r.isFailureCopy).toBe(false)
  })
  it('family uses facts verbatim', () => {
    const r = compileHumanAnswer('q', makeFamilyEvidence(['Leo — הבן שלך']), { lang: 'he' })
    expect(r.text).toContain('Leo')
  })
  it('online prepends "just checked" frame in es', () => {
    const r = compileHumanAnswer('q', makeOnlineEvidence(['Hace 21°C en Kfar Saba.']), { lang: 'es' })
    expect(r.text.startsWith('Lo miré recién: ')).toBe(true)
    expect(r.text.includes('21°C')).toBe(true)
  })
  it('online passes through sources for the renderer', () => {
    const r = compileHumanAnswer('q', makeOnlineEvidence(['x'], [{ title: 'meteo.com', url: 'https://x' }]), { lang: 'es' })
    expect(r.sources.length).toBe(1)
    expect(r.sources[0]?.url).toBe('https://x')
  })
  it('weather works the same as online', () => {
    const r = compileHumanAnswer('q', makeWeatherEvidence(['Hace 21°C en Kfar Saba.']), { lang: 'es' })
    expect(r.text.startsWith('Lo miré recién: ')).toBe(true)
  })
})

describe('compileHumanAnswer — open conversation', () => {
  it('uses content world opening when available', () => {
    const cw: ContentWorldChoice = {
      contentMode: 'open_chat',
      needsRealtime: false,
      needsSources: false,
      suggestedOpening: 'Acá estoy. ¿Querés un cuento corto?',
      gentleOptions: ['Cuento corto', 'Podcast', 'Idea para la tarde'],
      language: 'es',
      reason: 'open',
    }
    const r = compileHumanAnswer('hola', makeOpenEvidence(), { lang: 'es', allowFollowUp: true }, cw)
    expect(r.text.includes('Acá estoy')).toBe(true)
    expect(r.text.includes('Cuento corto')).toBe(true)
    expect(r.isFailureCopy).toBe(false)
  })
  it('falls back to a gentle prompt when no content world supplied', () => {
    const r = compileHumanAnswer('hola', makeOpenEvidence(), { lang: 'es' })
    expect(r.text.toLowerCase().includes('acá estoy')).toBe(true)
  })
})

describe('compileHumanAnswer — none / unknown', () => {
  it('makeNoEvidence with no content world → not-found copy', () => {
    const r = compileHumanAnswer('q', makeNoEvidence('local'), { lang: 'he' })
    expect(r.text).toBe('אין לי מידע על זה.')
  })
})

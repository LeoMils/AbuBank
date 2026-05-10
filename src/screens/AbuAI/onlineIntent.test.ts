/*
 * AbuAI B2 — onlineIntent.ts tests
 *
 * Pins detection of current/live questions in HE / ES / EN, and the
 * personal-block guard that prevents calendar / family / contacts from
 * leaking into the online path.
 */

import { describe, it, expect } from 'vitest'
import {
  isOnlineCurrentInfoQuery,
  getOnlineQueryKind,
  shouldBlockOnlineForPersonal,
} from './onlineIntent'

describe('getOnlineQueryKind — Spanish', () => {
  it('"¿Qué películas hay ahora en el cine?" → movies', () => {
    expect(getOnlineQueryKind('¿Qué películas hay ahora en el cine?')).toBe('movies')
  })
  it('"Películas nuevas esta semana" → movies', () => {
    expect(getOnlineQueryKind('Películas nuevas esta semana')).toBe('movies')
  })
  it('"¿Cómo está el clima hoy?" → weather', () => {
    expect(getOnlineQueryKind('¿Cómo está el clima hoy?')).toBe('weather')
  })
  it('"Tiempo ahora" → weather', () => {
    expect(getOnlineQueryKind('Tiempo ahora')).toBe('weather')
  })
  it('"Últimas noticias" → news', () => {
    expect(getOnlineQueryKind('Últimas noticias')).toBe('news')
  })
  it('"¿Qué está pasando ahora?" → news', () => {
    expect(getOnlineQueryKind('¿Qué está pasando ahora?')).toBe('news')
  })
  it('"¿Qué está abierto ahora?" → open_now', () => {
    expect(getOnlineQueryKind('¿Qué está abierto ahora?')).toBe('open_now')
  })
})

describe('getOnlineQueryKind — Hebrew', () => {
  it('"איזה סרטים יש עכשיו בקולנוע?" → movies', () => {
    expect(getOnlineQueryKind('איזה סרטים יש עכשיו בקולנוע?')).toBe('movies')
  })
  it('"סרטים חדשים השבוע" → movies', () => {
    expect(getOnlineQueryKind('סרטים חדשים השבוע')).toBe('movies')
  })
  it('"מזג האוויר היום" → weather', () => {
    expect(getOnlineQueryKind('מזג האוויר היום')).toBe('weather')
  })
  it('"מה מזג האוויר עכשיו?" → weather', () => {
    expect(getOnlineQueryKind('מה מזג האוויר עכשיו?')).toBe('weather')
  })
  it('"חדשות היום" → news', () => {
    expect(getOnlineQueryKind('חדשות היום')).toBe('news')
  })
  it('"מה פתוח עכשיו" → open_now', () => {
    expect(getOnlineQueryKind('מה פתוח עכשיו')).toBe('open_now')
  })
})

describe('getOnlineQueryKind — English', () => {
  it('"What movies are playing now?" → movies', () => {
    expect(getOnlineQueryKind('What movies are playing now?')).toBe('movies')
  })
  it('"new movies this week" → movies', () => {
    expect(getOnlineQueryKind('new movies this week')).toBe('movies')
  })
  it('"weather today" → weather', () => {
    expect(getOnlineQueryKind('weather today')).toBe('weather')
  })
  it('"latest news today" → news', () => {
    expect(getOnlineQueryKind('latest news today')).toBe('news')
  })
  it('"what is open now" → open_now', () => {
    expect(getOnlineQueryKind("what's open now")).toBe('open_now')
  })
})

describe('isOnlineCurrentInfoQuery — non-current queries return false', () => {
  it('"Recomendame un podcast" → false (open culture, not live)', () => {
    expect(isOnlineCurrentInfoQuery('Recomendame un podcast')).toBe(false)
  })
  it('"Tell me about Italy" → false', () => {
    expect(isOnlineCurrentInfoQuery('Tell me about Italy')).toBe(false)
  })
  it('"Háblame de Leo" → false (personal — also blocked separately)', () => {
    expect(isOnlineCurrentInfoQuery('Háblame de Leo')).toBe(false)
  })
  it('"מה יש לי היום" → false (personal calendar — handled by grounded path)', () => {
    expect(isOnlineCurrentInfoQuery('מה יש לי היום')).toBe(false)
  })
  it('empty → false', () => {
    expect(isOnlineCurrentInfoQuery('')).toBe(false)
  })
})

describe('shouldBlockOnlineForPersonal — second guard', () => {
  it('"¿Qué tengo hoy?" is personal → blocked', () => {
    expect(shouldBlockOnlineForPersonal('¿Qué tengo hoy?')).toBe(true)
  })
  it('"מה יש לי היום?" is personal → blocked', () => {
    expect(shouldBlockOnlineForPersonal('מה יש לי היום?')).toBe(true)
  })
  it('"Háblame de Leo" is personal → blocked', () => {
    expect(shouldBlockOnlineForPersonal('Háblame de Leo')).toBe(true)
  })
  it('"Tell me about my doctor" is personal → blocked', () => {
    expect(shouldBlockOnlineForPersonal('Tell me about my doctor')).toBe(true)
  })
  it('"Películas nuevas" is NOT personal → allowed', () => {
    expect(shouldBlockOnlineForPersonal('Películas nuevas')).toBe(false)
  })
  it('"weather today" is NOT personal → allowed', () => {
    expect(shouldBlockOnlineForPersonal('weather today')).toBe(false)
  })
})

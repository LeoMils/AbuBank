/*
 * AbuAI B2.3 — content-companion runtime wiring source contract
 *
 * Pins the order in src/screens/AbuAI/index.tsx so the B2.2 modules are
 * really wired (not just imported), the Truth Contract still wins for
 * personal/calendar/family/contacts, and the online + open-LLM paths are
 * untouched for current-info / named content cues.
 *
 * vitest runs in node env (no DOM render). Each assertion is a static
 * source grep + a pure helper invocation, so the contract is verifiable
 * without booting React.
 */

import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import { chooseContentWorld } from './contentWorldEngine'
import { isOnlineCurrentInfoQuery, shouldBlockOnlineForPersonal } from './onlineIntent'
import { isPersonalQuery } from './service'

const ROOT = path.resolve(__dirname, '../../..')
const INDEX = fs.readFileSync(path.join(ROOT, 'src/screens/AbuAI/index.tsx'), 'utf8')

describe('B2.3 — content world is wired into the AbuAI text path', () => {
  it('index.tsx imports chooseContentWorld + compileHumanAnswer + makeOpenEvidence', () => {
    expect(INDEX.includes("import { chooseContentWorld } from './contentWorldEngine'")).toBe(true)
    expect(INDEX.includes("import { compileHumanAnswer } from './answerCompiler'")).toBe(true)
    expect(INDEX.includes("import { makeOpenEvidence } from './evidencePacket'")).toBe(true)
  })

  it('text-path block consults chooseContentWorld AFTER proactive AND BEFORE online', () => {
    // Slice from the "Existing grounded answer path" comment to the
    // first call to isPersonalQuery — that's the section we own.
    const start = INDEX.indexOf('// ─── Existing grounded answer path')
    const end = INDEX.indexOf('if (isPersonalQuery(msgText)) {')
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const block = INDEX.slice(start, end)

    const groundedIdx = block.indexOf('tryGroundedAnswer(msgText)')
    const proactiveIdx = block.indexOf('getProactiveSeed(msgText')
    const worldIdx = block.indexOf('chooseContentWorld(msgText)')
    // B2.3 joint-opt: the online call now takes a locationHint option;
    // match the call by its function-name prefix.
    const onlineIdx = block.indexOf('answerOnlineCurrentInfo(msgText')
    expect(groundedIdx).toBeGreaterThan(-1)
    expect(proactiveIdx).toBeGreaterThan(groundedIdx)
    expect(worldIdx).toBeGreaterThan(proactiveIdx)
    expect(onlineIdx).toBeGreaterThan(worldIdx)
  })

  it('text-path content-world step is gated to NON-personal + NON-current inputs', () => {
    expect(/if \(!isOnlineCurrentInfoQuery\(msgText\) \|\| shouldBlockOnlineForPersonal\(msgText\)\) \{[\s\S]{0,200}chooseContentWorld\(msgText\)/.test(INDEX)).toBe(true)
  })

  it('text-path content-world step only fires for open_chat WITH gentle options', () => {
    expect(/world\.contentMode === 'open_chat' && world\.suggestedOpening && world\.gentleOptions\.length > 0/.test(INDEX)).toBe(true)
  })
})

describe('B2.3 — content world is wired into the AbuAI voice path', () => {
  it('voice-path block consults chooseContentWorld AFTER proactive AND BEFORE online', () => {
    const voiceStart = INDEX.indexOf('const voiceGrounded = tryGroundedAnswer(text)')
    expect(voiceStart).toBeGreaterThan(-1)
    const voiceEnd = INDEX.indexOf('clearTimeout(watchdog)', voiceStart)
    const block = INDEX.slice(voiceStart, voiceEnd > voiceStart ? voiceEnd : voiceStart + 4000)

    const proactiveIdx = block.indexOf('getProactiveSeed(text')
    const worldIdx = block.indexOf('chooseContentWorld(text)')
    // B2.3 joint-opt: the online call now takes a locationHint option.
    const onlineIdx = block.indexOf('answerOnlineCurrentInfo(text')
    expect(proactiveIdx).toBeGreaterThan(-1)
    expect(worldIdx).toBeGreaterThan(proactiveIdx)
    expect(onlineIdx).toBeGreaterThan(worldIdx)
  })

  it('voice-path content world is rendered with allowFollowUp:false (no bullet list spoken)', () => {
    // Slice the voice short-circuit so the assertion is scoped to it.
    const voiceStart = INDEX.indexOf('const voiceWorld = (')
    expect(voiceStart).toBeGreaterThan(-1)
    const voiceBlock = INDEX.slice(voiceStart, voiceStart + 2500)
    expect(/compileHumanAnswer\([\s\S]{0,200}allowFollowUp:\s*false/.test(voiceBlock)).toBe(true)
  })
})

describe('B2.3 — runtime classification still routes correctly (Truth Contract wins)', () => {
  it('personal calendar query → isPersonalQuery true (grounded path)', () => {
    expect(isPersonalQuery('¿Qué tengo hoy?')).toBe(true)
    expect(isPersonalQuery('מה יש לי היום')).toBe(true)
    // Content world is NOT consulted for these at runtime: they hit
    // tryGroundedAnswer first.
  })

  it('personal family query → isPersonalQuery true (grounded path)', () => {
    expect(isPersonalQuery('Háblame de Leo')).toBe(true)
    expect(isPersonalQuery('מי זה אופיר')).toBe(true)
  })

  it('current films → online current-info query', () => {
    expect(isOnlineCurrentInfoQuery('¿Qué películas hay ahora en el cine?')).toBe(true)
    expect(shouldBlockOnlineForPersonal('¿Qué películas hay ahora en el cine?')).toBe(false)
  })

  it('open story / cooking / facts are NOT current-info (do not force web)', () => {
    expect(isOnlineCurrentInfoQuery('Contame una historia corta')).toBe(false)
    expect(isOnlineCurrentInfoQuery('Receta de empanadas')).toBe(false)
    expect(isOnlineCurrentInfoQuery('Contame algo interesante')).toBe(false)
  })

  it('"hola" / "no sé" / "שלום" → open_chat content world with gentle options', () => {
    for (const t of ['hola', 'no sé', 'שלום', 'hi']) {
      const w = chooseContentWorld(t)
      expect(w.contentMode, t).toBe('open_chat')
      expect(w.gentleOptions.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('"Estoy aburrida" → STILL handled by proactive (B1) BEFORE the content world', () => {
    // Proactive matches first. The content world also returns open_chat,
    // but the wired runtime checks proactive earlier so the deterministic
    // rotation contract from B1 stays intact.
    const t = 'Estoy aburrida'
    expect(isPersonalQuery(t)).toBe(false)
    expect(isOnlineCurrentInfoQuery(t)).toBe(false)
    // (Wiring source-grep above already proves order
    //  grounded → proactive → world → online.)
  })
})

describe('B2.3 — hard rules preserved on this branch', () => {
  it('useRealtime stays false', () => {
    expect(INDEX.includes('const useRealtime = false')).toBe(true)
  })

  it('no AbuAI production source reads VITE_OPENAI_API_KEY', () => {
    const dir = path.join(ROOT, 'src/screens/AbuAI')
    const files = fs.readdirSync(dir)
      .filter((f) => (f.endsWith('.ts') || f.endsWith('.tsx'))
        && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'))
    for (const f of files) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8')
      expect(src.includes('VITE_OPENAI_API_KEY'), `${f} reads VITE_OPENAI_API_KEY`).toBe(false)
    }
  })

  it('no new env vars introduced (Tavily/Exa/Perplexity/Brave/OpenRouter/AI-Gateway)', () => {
    const dir = path.join(ROOT, 'src/screens/AbuAI')
    const files = fs.readdirSync(dir)
      .filter((f) => (f.endsWith('.ts') || f.endsWith('.tsx'))
        && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'))
    const FORBIDDEN = [
      'TAVILY_API_KEY', 'VITE_TAVILY_API_KEY',
      'EXA_API_KEY', 'VITE_EXA_API_KEY',
      'PERPLEXITY_API_KEY', 'VITE_PERPLEXITY_API_KEY',
      'BRAVE_API_KEY', 'VITE_BRAVE_API_KEY',
      'OPENROUTER_API_KEY', 'VITE_OPENROUTER_API_KEY',
      'VERCEL_AI_GATEWAY_KEY',
    ]
    for (const f of files) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8')
      for (const v of FORBIDDEN) {
        expect(src.includes(v), `${f} references ${v}`).toBe(false)
      }
    }
  })

  it('AbuWhatsApp / AbuCalendar / AbuGames not touched on this branch (no new files added under them)', () => {
    // Sanity: the B2.3 wiring touches AbuAI files only. This test
    // checks no content-world file accidentally landed elsewhere.
    const newAbuAIfiles = ['contentWorldEngine', 'sourceRouter', 'evidencePacket', 'answerCompiler',
      'realtimeCheapSourceRouter', 'martitaPersona', 'dailyContentPack',
      'instantAcknowledgement', 'humanFollowUp', 'aiSpendGuard']
    for (const dir of ['AbuWhatsApp', 'AbuCalendar', 'AbuGames']) {
      const list = fs.readdirSync(path.join(ROOT, `src/screens/${dir}`))
      for (const f of newAbuAIfiles) {
        expect(list.includes(`${f}.ts`), `${dir} accidentally has ${f}.ts`).toBe(false)
      }
    }
  })
})

describe('B2.3 — answer compiler still prevents unsupported claims', () => {
  // Pure compiler tests already pin the contract; this re-asserts the
  // most important guarantees so the integration story is complete.
  it('makes the compiler available and pure', async () => {
    const { compileHumanAnswer } = await import('./answerCompiler')
    const { makeToolErrorEvidence, makeCalendarEvidence } = await import('./evidencePacket')
    const err = compileHumanAnswer('q', makeToolErrorEvidence('cal', 'x'), { lang: 'es' })
    expect(err.text).toBe('No puedo comprobarlo ahora mismo.')
    const empty = compileHumanAnswer('q', makeCalendarEvidence([]), { lang: 'he' })
    expect(empty.text).toBe('לא מצאתי.')
    const ok = compileHumanAnswer('q', makeCalendarEvidence(['10:00 רופא']), { lang: 'he' })
    expect(ok.text).toBe('10:00 רופא')
  })
})

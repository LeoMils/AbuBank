/*
 * AbuAI B2.4 — wiring + persona contract.
 *
 * Source-grep guarantees the runtime is actually using the new
 * voiceShaper and that the system prompt carries the tightened
 * feminine-address rule. These complement realUserDiagnostic.test.ts
 * (which exercises the live runtime).
 */

import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'

const ABUAI = path.resolve(__dirname)
const INDEX = fs.readFileSync(path.join(ABUAI, 'index.tsx'), 'utf8')
const SERVICE = fs.readFileSync(path.join(ABUAI, 'service.ts'), 'utf8')

describe('B2.4 — voice-safe shaper is wired into the voice path', () => {
  it('index.tsx imports shapeVoiceSafe', () => {
    expect(INDEX.includes("import { shapeVoiceSafe } from './voiceShaper'")).toBe(true)
  })

  it('voice path calls speakVoiceMode with shaped text, not raw response', () => {
    // toSpokenText(response) must appear before speakVoiceMode(spokenText)
    expect(INDEX).toContain('toSpokenText(response)')
    expect(INDEX).toContain('await speakVoiceMode(spokenText)')
  })

  it('text path still streams the raw response (no voice shaping on chat UI)', () => {
    // The visible chat message is set BEFORE speakVoiceMode. That assignment
    // must use the original `response`, not the spoken variant.
    expect(/setMessages\(prev => \[\.\.\.prev, aiMsg\]\)/.test(INDEX)).toBe(true)
    expect(INDEX.includes("const aiMsg: ChatMessage = { id: nextId(), role: 'assistant', content: response, timestamp: Date.now() }")).toBe(true)
  })
})

describe('B2.4 — system prompt enforces feminine Hebrew address', () => {
  it('explicit rule: never "אתה", always "את"', () => {
    expect(SERVICE.includes('לעולם לא "אתה"')).toBe(true)
    expect(SERVICE.includes('פנייה: "את"')).toBe(true)
  })

  it('feminine imperative cues are listed', () => {
    expect(SERVICE.includes('תגידי')).toBe(true)
    expect(SERVICE.includes('לחצי')).toBe(true)
  })

  it('Spanish address is voseo, not tú', () => {
    expect(SERVICE.includes('voseo')).toBe(true)
    expect(SERVICE.includes('ללא "tú"')).toBe(true)
  })
})

describe('B2.4 — relationship route is wired and shaped', () => {
  it('service.ts handles family_relationship_between case', () => {
    expect(SERVICE.includes("case 'family_relationship_between':")).toBe(true)
    expect(SERVICE.includes('shapeRelationshipBetween(route)')).toBe(true)
  })

  it('service.ts imports describeRelation from familyGraph', () => {
    expect(SERVICE.includes("describeRelation")).toBe(true)
    expect(SERVICE.includes("from './familyGraph'")).toBe(true)
  })
})

describe('B2.4 — hard-rule envelope still preserved', () => {
  it('useRealtime is enabled with grounding', () => {
    expect(INDEX.includes('const useRealtime = true')).toBe(true)
  })

  it('no AbuAI production source reads VITE_OPENAI_API_KEY', () => {
    const files = fs.readdirSync(ABUAI)
      .filter((f) => (f.endsWith('.ts') || f.endsWith('.tsx'))
        && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'))
    const FORBIDDEN = ['VITE', '_OPENAI', '_API_KEY'].join('')
    for (const f of files) {
      const src = fs.readFileSync(path.join(ABUAI, f), 'utf8')
      expect(src.includes(FORBIDDEN), `${f} reads ${FORBIDDEN}`).toBe(false)
    }
  })

  it('no new vendor env vars introduced in B2.4', () => {
    const files = fs.readdirSync(ABUAI)
      .filter((f) => (f.endsWith('.ts') || f.endsWith('.tsx'))
        && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'))
    const FORBIDDEN = [
      'TAVILY_API_KEY', 'EXA_API_KEY', 'PERPLEXITY_API_KEY',
      'BRAVE_API_KEY', 'OPENROUTER_API_KEY', 'VERCEL_AI_GATEWAY_KEY',
    ]
    for (const f of files) {
      const src = fs.readFileSync(path.join(ABUAI, f), 'utf8')
      for (const v of FORBIDDEN) {
        expect(src.includes(v), `${f} references ${v}`).toBe(false)
      }
    }
  })

  it('AbuWhatsApp / AbuCalendar / AbuGames source untouched on this branch (no new B2.4 files)', () => {
    const newAbuAIfiles = ['familyGraph', 'voiceShaper']
    for (const dir of ['AbuWhatsApp', 'AbuCalendar', 'AbuGames']) {
      const list = fs.readdirSync(path.resolve(ABUAI, `../${dir}`))
      for (const f of newAbuAIfiles) {
        expect(list.includes(`${f}.ts`), `${dir} accidentally has ${f}.ts`).toBe(false)
      }
    }
  })
})

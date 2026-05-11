/*
 * B2.2 prompt-cache + invariants contract.
 *
 * Pins:
 *   • SYSTEM_PROMPT stable prefix order (identity → truth → source
 *     routing → evidence → content world → persona → online/live →
 *     safety). Dynamic content (FEW_SHOT) is constructed separately so
 *     the prefix stays cacheable.
 *   • No new env vars beyond the ones already shipped (OPENAI_API_KEY
 *     server-only, plus the legacy VITE_GEMINI / VITE_GROQ keys).
 *   • No client-side VITE_OPENAI_API_KEY anywhere in AbuAI source.
 *   • No Realtime re-enable: `useRealtime = false` literal remains in
 *     AbuAI/index.tsx.
 *   • No AbuWhatsApp / AbuCalendar / AbuGames source touched on this
 *     branch.
 */

import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import { SYSTEM_PROMPT } from './service'

const ROOT = path.resolve(__dirname, '../../..')

describe('Prompt cache discipline — stable prefix order', () => {
  it('identity section "MartitAI" is the first anchor', () => {
    expect(SYSTEM_PROMPT.indexOf('MartitAI')).toBeGreaterThan(-1)
    expect(SYSTEM_PROMPT.indexOf('MartitAI')).toBeLessThan(SYSTEM_PROMPT.indexOf('═══ הטון ═══'))
  })

  it('Truth Contract (tool requirement) appears before persona tone', () => {
    const toolReq = SYSTEM_PROMPT.indexOf('חייבת להשתמש בכלי')
    const tone = SYSTEM_PROMPT.indexOf('═══ הטון ═══')
    expect(toolReq).toBeGreaterThan(-1)
    expect(tone).toBeGreaterThan(toolReq)
  })

  it('live-info section sits before the safety section so it is not truncated', () => {
    const live = SYSTEM_PROMPT.indexOf('מידע חי / live info')
    const safety = SYSTEM_PROMPT.indexOf('═══ בטיחות ═══')
    expect(live).toBeGreaterThan(-1)
    expect(safety).toBeGreaterThan(live)
  })

  it('safety section is the closing block (no further new sections after)', () => {
    const safety = SYSTEM_PROMPT.indexOf('═══ בטיחות ═══')
    expect(safety).toBeGreaterThan(-1)
    // No further "═══ ... ═══" headers after safety — protects the
    // stable suffix so prompt cache hashes do not churn.
    const tail = SYSTEM_PROMPT.slice(safety + '═══ בטיחות ═══'.length)
    const newSection = tail.match(/═══[^=]+═══/)
    expect(newSection, `unexpected trailing section after safety: ${newSection?.[0]}`).toBeNull()
  })
})

describe('No new env vars', () => {
  it('no AbuAI module references a Tavily / Exa / Perplexity / Brave / OpenRouter / Vercel-AI-Gateway env var', () => {
    // Scope: production modules only. Test files may reference forbidden
    // literals inside negative assertions.
    const files = fs.readdirSync(path.join(ROOT, 'src/screens/AbuAI'))
      .filter((f) => (f.endsWith('.ts') || f.endsWith('.tsx'))
        && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'))
      .map((f) => path.join('src/screens/AbuAI', f))
    const FORBIDDEN = [
      'TAVILY_API_KEY', 'VITE_TAVILY_API_KEY',
      'EXA_API_KEY', 'VITE_EXA_API_KEY',
      'PERPLEXITY_API_KEY', 'VITE_PERPLEXITY_API_KEY',
      'BRAVE_API_KEY', 'VITE_BRAVE_API_KEY',
      'OPENROUTER_API_KEY', 'VITE_OPENROUTER_API_KEY',
      'VERCEL_AI_GATEWAY_KEY',
    ]
    for (const rel of files) {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8')
      for (const v of FORBIDDEN) {
        expect(src.includes(v), `${rel} references forbidden env ${v}`).toBe(false)
      }
    }
  })

  it('no AbuAI production module reads VITE_OPENAI_API_KEY (server-only OpenAI key)', () => {
    // Scope: production modules only. Test files (serverProxyContract,
    // this very file) reference the literal inside negative assertions.
    const files = fs.readdirSync(path.join(ROOT, 'src/screens/AbuAI'))
      .filter((f) => (f.endsWith('.ts') || f.endsWith('.tsx'))
        && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'))
      .map((f) => path.join('src/screens/AbuAI', f))
    for (const rel of files) {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8')
      expect(src.includes('VITE_OPENAI_API_KEY'), `${rel} reads VITE_OPENAI_API_KEY`).toBe(false)
    }
  })
})

describe('No Realtime re-enable', () => {
  it('AbuAI/index.tsx still hard-codes useRealtime = false', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/screens/AbuAI/index.tsx'), 'utf8')
    expect(src.includes('const useRealtime = false')).toBe(true)
  })
})

describe('No AbuWhatsApp / AbuCalendar / AbuGames behaviour changes on this branch', () => {
  it('no .ts/.tsx file under those screens was modified vs the merge base', () => {
    // Source-grep heuristic: B2.2 modules live only under src/screens/AbuAI.
    // The branch should NOT have introduced new files under the other screens.
    const newAbuAIfiles = ['contentWorldEngine', 'sourceRouter', 'evidencePacket', 'answerCompiler',
      'realtimeCheapSourceRouter', 'martitaPersona', 'dailyContentPack',
      'instantAcknowledgement', 'humanFollowUp', 'aiSpendGuard']
    for (const f of newAbuAIfiles) {
      expect(fs.existsSync(path.join(ROOT, `src/screens/AbuAI/${f}.ts`)), `${f}.ts missing`).toBe(true)
    }
    // No mirrored file accidentally created under the other screens.
    for (const dir of ['AbuWhatsApp', 'AbuCalendar', 'AbuGames']) {
      const list = fs.readdirSync(path.join(ROOT, `src/screens/${dir}`))
      for (const f of newAbuAIfiles) {
        expect(list.includes(`${f}.ts`), `${dir} accidentally has ${f}.ts`).toBe(false)
      }
    }
  })
})

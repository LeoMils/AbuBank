import { describe, it, expect } from 'vitest'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildSessionUpdate } from './liveSession'

/*
 * Tool + guard: asserts the assembled live session config is well-formed AND (when DUMP_SESSION=1)
 * writes it to docs/eval/SESSION_CONFIG_SNAPSHOT.json so the .mjs realtime probes drive the real
 * model with exactly what ships (instructions + tools). Vitest is used because buildLiveInstructions
 * pulls knowledge via Vite `?raw` imports that plain tsx/node cannot resolve.
 */
describe('live session config snapshot', () => {
  it('assembles instructions + tools and (optionally) dumps them', () => {
    const payload = buildSessionUpdate(Date.parse('2026-08-16T09:00:00Z')) as {
      session: { instructions: string; tools: Array<{ name?: string }> }
    }
    const s = payload.session
    expect(typeof s.instructions).toBe('string')
    expect(s.instructions.length).toBeGreaterThan(500)
    expect(Array.isArray(s.tools)).toBe(true)
    expect(s.tools.length).toBeGreaterThan(0)
    if (process.env.DUMP_SESSION === '1') {
      const out = resolve(process.cwd(), 'docs', 'eval', 'SESSION_CONFIG_SNAPSHOT.json')
      writeFileSync(out, JSON.stringify(s, null, 2))
    }
  })
})

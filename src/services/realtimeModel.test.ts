import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { REALTIME_MODEL, REALTIME_MODEL_CANDIDATES, assertNoModelDrift, isKnownRealtimeModel } from './realtimeModel'

const ROOT = path.resolve(__dirname, '../..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

describe('Realtime model — ONE shared source (Defect 3)', () => {
  it('exposes a model alias and known candidates newest-first', () => {
    expect(typeof REALTIME_MODEL).toBe('string')
    expect(REALTIME_MODEL_CANDIDATES[0]).toBe('gpt-realtime-2.1') // newest known snapshot first
    expect(isKnownRealtimeModel(REALTIME_MODEL)).toBe(true)
  })
  it('rejects model drift between mint and SDP', () => {
    expect(() => assertNoModelDrift('gpt-realtime', 'gpt-realtime-2.1')).toThrow(/drift/)
    expect(() => assertNoModelDrift(REALTIME_MODEL, REALTIME_MODEL)).not.toThrow()
  })
  it('client, token minter, and health all import the shared constant (no independent literals)', () => {
    for (const rel of ['src/services/realtimeVoice.ts', 'api/realtime-token.ts', 'api/health.ts']) {
      const src = read(rel)
      expect(src).toMatch(/from ['"][^'"]*realtimeModel['"]/) // imports the shared module (any relative path)
    }
    // the only place that defines the literal is realtimeModel.ts itself
    expect(read('src/services/realtimeModel.ts')).toContain("'gpt-realtime'")
    expect(read('api/realtime-token.ts')).not.toMatch(/const REALTIME_MODEL = 'gpt-realtime'/)
  })
})

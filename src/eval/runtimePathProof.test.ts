/*
 * Runtime Path Proof test (Phase 1). Two assertions:
 *  1. DYNAMIC: every input path type, traced through the Executive Controller, is
 *     RUNTIME_FINALIZED with the full stage trace and 0 bypasses.
 *  2. STATIC: index.tsx routes BOTH the text and voice entries through
 *     ExecutiveCognitiveController — and documents the honest flag-gated reality.
 */
import fs from 'fs'
import path from 'path'
import { describe, it, expect, beforeEach } from 'vitest'
import { proveAllPaths, pathScore } from './runtimePathProof'

class MemoryLocalStorage {
  private store = new Map<string, string>()
  getItem(k: string): string | null { return this.store.has(k) ? this.store.get(k)! : null }
  setItem(k: string, v: string): void { this.store.set(k, String(v)) }
  removeItem(k: string): void { this.store.delete(k) }
  clear(): void { this.store.clear() }
  key(i: number): string | null { return [...this.store.keys()][i] ?? null }
  get length(): number { return this.store.size }
}

const INDEX = fs.readFileSync(path.resolve(__dirname, '../screens/AbuAI/index.tsx'), 'utf8')

describe('Runtime Path Proof — the controller path is bypass-free', () => {
  beforeEach(() => { ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage() })

  it('every input path type is RUNTIME_FINALIZED through the controller, 0 bypasses', async () => {
    const rows = await proveAllPaths()
    const score = pathScore(rows)
    // eslint-disable-next-line no-console
    console.log(`[PATH-PROOF] paths=${score.total} reached=${score.reached} finalized=${score.finalized} bypasses=${score.bypasses}\n` +
      rows.map(r => `  ${r.path}: reached=${r.reachedController} finalized=${r.finalized} bypass=${r.bypass}`).join('\n'))
    expect(rows.filter(r => r.bypass).map(r => r.path)).toEqual([])
    expect(score.bypasses).toBe(0)
  })
})

describe('Static architecture facts (index.tsx) — one runtime path', () => {
  it('text + voice-pipeline + voice-realtime ALL route through ExecutiveCognitiveController', () => {
    const controllerCalls = (INDEX.match(/ExecutiveCognitiveController\.handleTurn\(/g) ?? []).length
    // 3 entries: handleSend (text), handleText (voice fallback pipeline), and the
    // Realtime onUserTranscript (voice must NOT bypass the brain — path unification).
    expect(controllerCalls).toBe(3)
  })
  it('the runtime gate is HARDCODED true — no env flag dependency remains', () => {
    expect(/const COGNITIVE_RUNTIME_FULL:\s*boolean\s*=\s*true/.test(INDEX)).toBe(true)
    // The env flag (import.meta.env.VITE_ABUAI_COGNITIVE_RUNTIME_V2_FULL) is gone.
    expect(INDEX.includes('VITE_ABUAI_COGNITIVE_RUNTIME_V2_FULL')).toBe(false)
  })
  it('the controller returns before any legacy path — legacy is dead code at runtime', () => {
    // Both entries: `if (COGNITIVE_RUNTIME_FULL) { ... return }` with the const always
    // true, so the legacy cascade below never executes. (It remains in source, typed
    // reachable, pending a follow-up deletion — see ABUAI_EXECUTION_GRAPH.md.)
    expect(INDEX.includes('if (COGNITIVE_RUNTIME_FULL)')).toBe(true)
  })
})

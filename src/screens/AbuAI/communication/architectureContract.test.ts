import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'

/*
 * Architecture-contract tests — these FAIL if a competing Communication owner
 * or a second action-response generator reappears. They enforce the single-owner
 * cutover at the dependency-boundary level, where runtime tests cannot.
 */
const ROOT = path.resolve(__dirname, '../../../..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const cognitive = read('src/screens/AbuAI/cognitiveRuntime.ts')
const voiceCompose = read('src/screens/AbuWhatsApp/VoiceCompose.tsx')
const capability = read('src/screens/AbuAI/communication/capability.ts')
const engine = read('src/screens/AbuAI/communication/engine.ts')

describe('single Communication owner — cognitiveRuntime delegates to the engine', () => {
  it('imports and calls reduceGoal', () => {
    expect(/import\s*\{[^}]*\breduceGoal\b/.test(cognitive)).toBe(true)
    expect(cognitive.includes('reduceGoal(')).toBe(true)
  })
  it('no longer owns communication arbitration itself (no detectWhatsAppTurn / applyFollowUp)', () => {
    expect(cognitive.includes('detectWhatsAppTurn(')).toBe(false)
    expect(cognitive.includes('applyFollowUp(')).toBe(false)
  })
  it('has exactly ONE reduceGoal arbitration call site', () => {
    const n = (cognitive.match(/reduceGoal\(/g) ?? []).length
    expect(n).toBe(1)
  })
})

describe('single Communication owner — VoiceCompose does not own arbitration', () => {
  it('delegates corrections to reduceGoal', () => {
    expect(voiceCompose.includes('reduceGoal(')).toBe(true)
  })
  it('no longer imports the arbitration primitives applyFollowUp / isFollowUpCorrection', () => {
    expect(voiceCompose.includes('applyFollowUp')).toBe(false)
    expect(voiceCompose.includes('isFollowUpCorrection')).toBe(false)
  })
})

describe('single response-truth source', () => {
  it('capability.communicationLead is produced by the engine renderResponse policy', () => {
    expect(capability.includes('renderResponse(')).toBe(true)
    // No hand-rolled action wording left in the lead.
    expect(capability.includes('פותחת שיחה')).toBe(false)
    expect(capability.includes('פותחת הודעה')).toBe(false)
  })
  it('the response-truth policy + anti-contradiction gate live in ONE module', () => {
    expect(engine.includes('export function renderResponse')).toBe(true)
    expect(engine.includes('export function validateResponse')).toBe(true)
  })
})

describe('active-goal state has a single authority', () => {
  it('cognitiveRuntime stores the engine ActiveGoal in pendingCommunication (one canonical field)', () => {
    expect(/pendingCommunication\??:\s*ActiveGoal\s*\|\s*null/.test(cognitive)).toBe(true)
  })
  it('the engine is the only module that defines reduceGoal', () => {
    // A second decision engine would export its own reduceGoal.
    const files = [cognitive, voiceCompose, capability]
    for (const f of files) expect(f.includes('export function reduceGoal')).toBe(false)
    expect(engine.includes('export function reduceGoal')).toBe(true)
  })
})

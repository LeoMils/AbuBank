/*
 * Full Cognitive Runtime Replay (Phase 12)
 * ════════════════════════════════════════
 * The complete Leo-failure replay, driven through the SAME runtime the app uses.
 * Composes the thinking gauntlet (transcript + smart-calendar batch) and adds the
 * DIRECTIONAL family pairs, topic memory ("what did we talk about"), and an
 * explicit broken-Hebrew guard. Pass criteria (mission): actual question answered,
 * 0 hallucinated calendar/family facts, 0 wrong cancels, 0 clarification loops,
 * 0 broken Hebrew, 0 direct legacy bypass in the checked flows.
 */
import { runFullThinkingGauntlet, gauntletScore, type GauntletRow } from './fullThinkingRuntimeGauntlet'
import { runCognitiveTurn, finalizeExternalAnswer, IDLE_RUNTIME, verifyAnswer } from '../screens/AbuAI/cognitiveRuntime'
import { relationOf } from '../screens/AbuAI/familyRelationEngine'

const ctx = (now: Date) => ({ messages: [] as Array<{ role: string; content: string }>, now })

export function runFullCognitiveReplay(opts: { now: Date; resetStore?: boolean }): GauntletRow[] {
  const base = runFullThinkingGauntlet({ now: opts.now, ...(opts.resetStore !== undefined ? { resetStore: opts.resetStore } : {}) })
  const rows: GauntletRow[] = [...base.all]
  const add = (id: string, kind: string, input: string, pass: boolean, detail: string) => rows.push({ id, kind, input, pass, detail })

  // ── Directional family pairs (graph kinship engine) ──
  const fam: Array<[string, string, string]> = [
    ['לאו', 'אופיר', 'uncle_aunt'],
    ['אופיר', 'לאו', 'nephew_niece'],
    ['לאו', 'אנאבל', 'great_uncle_aunt'],
    ['ירדן', 'אנאבל', 'uncle_aunt_in_law'],
    ['רפי', 'לאו', 'ex_sibling_in_law'],
    ['רפי', 'מרטיטה', 'ex_child_in_law'],
    ['אופיר', 'מרטיטה', 'grandchild'],
    ['מור', 'לאו', 'sibling'],
  ]
  for (const [a, b, expected] of fam) {
    const r = relationOf(a, b)
    add(`FAM:${a}->${b}`, 'family_directional', `מה ${a} עבור ${b}`,
      r.kind === expected && r.known && !/אחות של מור.*לאו|לאו.*אחות/.test(r.sentence),
      `kind=${r.kind} expected=${expected} say="${r.sentence}"`)
  }

  // ── Topic memory: after an answer, "על מה דיברנו" recalls the topic ──
  {
    const g = runCognitiveTurn(IDLE_RUNTIME, 'ספרי לי על המהפכה הצרפתית', ctx(opts.now))
    const seeded = finalizeExternalAnswer(g.state, 'המהפכה הצרפתית פרצה ב-1789. היא שינתה את צרפת.', { intent: 'general', topic: 'המהפכה הצרפתית' })
    const recall = runCognitiveTurn(seeded.state, 'על מה דיברנו', ctx(opts.now))
    add('MEM1', 'memory', 'על מה דיברנו',
      recall.handled && /המהפכה הצרפתית/.test(recall.display ?? ''),
      `intent=${recall.intent} say="${recall.display}"`)
  }

  // ── Explicit broken-Hebrew guard (verifier rejects the known-bad forms) ──
  const badHebrew = ['אני תבדוק את היומן', 'הפגישה באצלי בבית', 'com]( cbsnews']
  for (const bad of badHebrew) {
    const v = verifyAnswer(bad, { intent: 'general', dataAvailable: true })
    add(`HEB:${bad.slice(0, 8)}`, 'hebrew_guard', bad, v.ok === false, `violations=${v.violations.join(',')}`)
  }

  return rows
}

export { gauntletScore }

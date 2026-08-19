/*
 * scripts/eval/bundleShrinkReport.ts — M5 bundle decomposition report (model-free).
 * Writes docs/eval/BUNDLE_SHRINK_PLAN.md: full size, always-on core, each intent block,
 * and the projected per-turn payload. Nothing here changes what the live session sends;
 * flipping to per-intent injection is a device gate (warmth/parity off vs on).
 *   npx vite-node scripts/eval/bundleShrinkReport.ts
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseSections, classifySections, measureBundlePlan } from '../../src/services/intentInstructions'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const plan = measureBundlePlan()
const d = classifySections()
const L: string[] = []
L.push('# M5 BUNDLE SHRINK PLAN — measured decomposition')
L.push('')
L.push('Model-free. Decomposes the SHIPPED always-on instructions into a core carried every')
L.push('turn + intent blocks injected only when relevant. The full assembly is UNCHANGED until')
L.push('the per-intent ON-path is wired behind a flag AND proven on a device (warmth/parity off vs on).')
L.push('')
L.push(`- full always-on bundle: **${plan.full}** chars`)
L.push(`- always-on CORE (safety/persona/boundaries/language/tone/length/audio): **${plan.core}** chars`)
L.push(`- target: ${plan.target} · core under target: **${plan.coreUnderTarget}**`)
L.push('')
L.push('## Intent blocks (injected only on their turn)')
for (const k of ['family', 'profile', 'tools'] as const)
  L.push(`- ${k}: ${plan.intentSizes[k]} chars — [${d.intents[k].map((s) => s.header).join(' · ')}]`)
L.push('')
L.push('## Projected per-turn payload (core + the single relevant block)')
L.push(`- chit-chat (core only): **${plan.perTurn.chitchat}** chars`)
L.push(`- personal/profile turn: **${plan.perTurn.profile}** chars`)
L.push(`- family turn: **${plan.perTurn.family}** chars`)
L.push(`- tool/calendar/message turn: **${plan.perTurn.tools}** chars`)
L.push('')
L.push('## Honest limit')
L.push(`The core floor is ~${plan.core} chars: SAFETY (~1.3k, must ship every turn) and the persona`)
L.push('(~2.2k) dominate. Reaching <5,000 ALSO requires condensing the persona — that trades warmth')
L.push('and is device-measured off/on, NOT deleted here. Even so, a typical turn drops from')
L.push(`${plan.full} to ~${plan.perTurn.chitchat}-${plan.perTurn.family} chars once injection is enabled.`)
L.push('')
L.push('## Always-on core sections')
for (const s of d.core) L.push(`- ${s.length} — ${s.header}`)
const out = L.join('\n') + '\n'
writeFileSync(join(ROOT, 'docs', 'eval', 'BUNDLE_SHRINK_PLAN.md'), out)
console.log(out)
console.log('written: docs/eval/BUNDLE_SHRINK_PLAN.md')

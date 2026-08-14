/*
 * intentInstructions.ts — M5 per-intent instruction decomposition (deterministic core).
 * ════════════════════════════════════════════════════════════════════════════
 * THE PROBLEM (BRIEF_AUDIT A4, LEDGER M5). The always-on session instructions are
 * 13,221 chars; the target is under 5,000. Deletion is exhausted — the remaining
 * weight is real (safety, persona, tool discipline), not dead text. The only path
 * under 5,000 is STRUCTURAL: carry a small ALWAYS-ON core every turn and INJECT the
 * intent-specific guidance (family rules, tool/calendar discipline, pronunciation,
 * Martita's profile) only on the turns that need it.
 *
 * THIS MODULE decomposes the SHIPPED instructions (buildLiveInstructions — untouched,
 * byte-identical) into a core + intent blocks by section header, and MEASURES the
 * projected per-turn payload. It is derivation + measurement only: nothing here changes
 * what the live session sends until the ON-path is wired behind a flag AND proven on a
 * device (warmth/parity off vs on) — the flip is a device gate, not a code claim.
 *
 * HONEST FINDING (measured below, not asserted): moving family + pronunciation + tools
 * + action-cards + profile out of always-on leaves a core of ~5.9k — the SAFETY section
 * (1.3k) and persona (2.2k) dominate and must stay every turn. Reaching < 5,000 also
 * needs condensing the persona itself, which trades warmth and is device-measured, not
 * deleted here. Typical turns still drop from 13.2k to ~5.9k (chit-chat) / ~7.9k (family).
 */
import { buildLiveInstructions } from './liveInstructions'

export type Intent = 'family' | 'profile' | 'tools'

/** A parsed instruction section: its `# …` header line and its full text (header + body). */
export interface Section { header: string; text: string; length: number }

/** Split the assembled instructions into top-level `# `-headed sections (deterministic). */
export function parseSections(instructions: string = buildLiveInstructions()): Section[] {
  return instructions.split(/\n(?=# )/).map((text) => {
    const t = text.trim()
    return { header: t.split('\n', 1)[0]!.trim(), text: t, length: t.length }
  })
}

/*
 * Section → classification. A header is matched by a STABLE substring (the sections mix
 * Hebrew and English headers). `core` ships every turn; an Intent ships only on its turn.
 * - SAFETY, boundaries, role, persona, language, "how you talk", length, unclear-audio → core
 * - Family and People + Pronunciation → 'family' (names surface with people)
 * - Martita's own profile → 'profile' (personal turns)
 * - Tools and Actions + Action Cards → 'tools' (a tool/calendar/message/call turn)
 * If a NEW section is added to buildLiveInstructions, classifySections THROWS on the
 * unclassified header — the decomposition can never silently drop a rule.
 */
const CLASSIFY: ReadonlyArray<{ match: string; as: 'core' | Intent }> = [
  { match: 'Role and Objective', as: 'core' },
  { match: 'במצוקה', as: 'core' }, // SAFETY — always, overrides everything
  { match: 'גבולות', as: 'core' }, // boundaries
  { match: 'Personality and Tone', as: 'core' },
  { match: '# אבו', as: 'core' }, // persona
  { match: 'Language', as: 'core' },
  { match: 'Family and People', as: 'family' },
  { match: 'עוד על מרתה עצמה', as: 'profile' },
  { match: 'איך את מדברת', as: 'core' }, // how you talk to her — tone, always
  { match: 'How to Say Names', as: 'family' }, // pronunciation
  { match: 'Tools and Actions', as: 'tools' },
  { match: 'Action Cards', as: 'tools' },
  { match: 'Length', as: 'core' },
  { match: 'Unclear Audio', as: 'core' },
]

function classifyOne(header: string): 'core' | Intent {
  const hit = CLASSIFY.find((c) => header.includes(c.match))
  if (!hit) throw new Error(`[intentInstructions] unclassified instruction section "${header}" — add it to CLASSIFY (core or an Intent) so the decomposition never silently drops a rule`)
  return hit.as
}

export interface Decomposition {
  core: Section[]
  intents: Record<Intent, Section[]>
}

/** Classify every section into the always-on core and the per-intent blocks. */
export function classifySections(instructions: string = buildLiveInstructions()): Decomposition {
  const sections = parseSections(instructions)
  const core: Section[] = []
  const intents: Record<Intent, Section[]> = { family: [], profile: [], tools: [] }
  for (const s of sections) {
    const cls = classifyOne(s.header)
    if (cls === 'core') core.push(s)
    else intents[cls].push(s)
  }
  return { core, intents }
}

/** The always-on core string (safety/persona/boundaries/language/tone/length/audio). */
export function buildCoreInstructions(instructions: string = buildLiveInstructions()): string {
  return classifySections(instructions).core.map((s) => s.text).join('\n\n')
}

/** The guidance block to inject on a turn of this intent (empty if the intent has none). */
export function intentGuidance(intent: Intent, instructions: string = buildLiveInstructions()): string {
  return classifySections(instructions).intents[intent].map((s) => s.text).join('\n\n')
}

export interface BundlePlan {
  full: number
  core: number
  intentSizes: Record<Intent, number>
  /** core + one intent block — what a turn of that intent would actually carry. */
  perTurn: Record<'chitchat' | Intent, number>
  target: number
  coreUnderTarget: boolean
}

/** Measure the decomposition: full size, core size, each intent block, and the projected
 *  per-turn payload (core + the single relevant block). Pure — used by the test + report. */
export function measureBundlePlan(instructions: string = buildLiveInstructions()): BundlePlan {
  const d = classifySections(instructions)
  const core = d.core.map((s) => s.text).join('\n\n').length
  const intentSizes: Record<Intent, number> = {
    family: d.intents.family.map((s) => s.text).join('\n\n').length,
    profile: d.intents.profile.map((s) => s.text).join('\n\n').length,
    tools: d.intents.tools.map((s) => s.text).join('\n\n').length,
  }
  const target = 5_000
  return {
    full: instructions.length,
    core,
    intentSizes,
    perTurn: {
      chitchat: core,
      family: core + intentSizes.family,
      profile: core + intentSizes.profile,
      tools: core + intentSizes.tools,
    },
    target,
    coreUnderTarget: core <= target,
  }
}

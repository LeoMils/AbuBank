/*
 * textHarness/session.ts — the harness's session, taken VERBATIM from the live path.
 * ════════════════════════════════════════════════════════════════════════════
 * This is the anti-divergence seam. The harness does NOT re-author instructions or
 * a tool list — it reads them straight out of buildSessionUpdate(now), the exact
 * payload liveSession.ts sends over the data channel. If the voice path changes its
 * instructions or tools, the harness changes with it automatically, and
 * sharedConstruction.test.ts fails loudly if these two ever drift apart.
 */
import { buildSessionUpdate } from '../liveSession'
import type { HarnessSession } from './types'

/** Pull instructions + tools + tool_choice out of the live session.update payload.
 *  `now` seeds the same runtime "# Today" line the voice path appends. */
export function buildHarnessSession(now: number): HarnessSession {
  const update = buildSessionUpdate(now) as {
    session: { instructions: string; tools: unknown[]; tool_choice: unknown }
  }
  return {
    instructions: update.session.instructions,
    tools: update.session.tools,
    toolChoice: update.session.tool_choice,
  }
}

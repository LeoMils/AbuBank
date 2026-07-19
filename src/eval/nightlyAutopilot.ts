/*
 * NIGHTLY AUTOPILOT (Constitution §3/§4) — the invisible maintenance chain.
 * ════════════════════════════════════════════════════════════════════════
 * One scheduled run does three things and reports to LEO ONLY (never Martita):
 *   (a) the duel/guard corpus  (src/eval/duel — parity + marathon + flight-recorder + mirrors),
 *   (b) the flight-recorder analyzer  (src/truth/weaknessMap — reality → archetypes),
 *   (c) the ledger curator  (src/truth/ledgerCurator — dedupe/supersede/reorder, never delete).
 * Produces ONE Hebrew status line for Leo, and — when items exist — a ready-made fix-the-queue
 * prompt for Claude Code. Reuses the existing engines; no parallel path.
 *
 * The full corpus (a) needs the family/calendar engines' browser-ish env (localStorage), so it
 * runs in the test/CI harness (stubs provided). The server cron endpoint runs the server-safe
 * part (curator + notification) — see api/cron/nightly.ts and the honest note in the report.
 */
import { runWeeklyDuel } from './duel'
import { mineTranscript, summarize, type TurnObs } from '../truth/weaknessMap'
import { LedgerService, localLedgerStore } from '../truth/ledgerService'

export interface NightlyReport {
  ok: boolean
  itemsFound: number
  hebrewLine: string
  duel: { promotable: boolean; regressions: number; summaryHe: string }
  weakness: { total: number; byArchetype: Record<string, number> }
  curation: { actions: number; lines: string[] }
  fixPrompt: string | null
}

export interface NightlyOpts { transcript?: TurnObs[]; runCorpus?: boolean }

/** Run the nightly chain. `date` is injected (deterministic). `runCorpus` gates the heavy
 *  duel (default on; the server cron passes false and runs only the server-safe curator). */
export async function runNightly(date: string, opts: NightlyOpts = {}): Promise<NightlyReport> {
  const runCorpus = opts.runCorpus !== false
  const duelR = runCorpus ? (await runWeeklyDuel(date)).result : { promotable: true, regressions: [], summaryHe: 'דולג' }

  const hits = mineTranscript(opts.transcript ?? [])
  const weakness = summarize(hits)

  const cur = new LedgerService(localLedgerStore()).curate()

  const itemsFound = duelR.regressions.length + weakness.total + cur.actions.length
  const ok = itemsFound === 0 && duelR.promotable
  const hebrewLine = ok ? '🟢 הכל תקין' : `🟠 נמצאו ${itemsFound} דברים לתיקון`
  const fixPrompt = ok ? null : buildFixPrompt(date, { regressions: duelR.regressions.length, summaryHe: duelR.summaryHe }, weakness, cur.actions.map((a) => a.line))

  return {
    ok, itemsFound, hebrewLine,
    duel: { promotable: duelR.promotable, regressions: duelR.regressions.length, summaryHe: duelR.summaryHe },
    weakness: { total: weakness.total, byArchetype: weakness.byArchetype },
    curation: { actions: cur.actions.length, lines: cur.actions.map((a) => a.line) },
    fixPrompt,
  }
}

/** The ready-made Claude Code prompt embedded in Leo's notification when items exist. */
function buildFixPrompt(date: string, duel: { regressions: number; summaryHe: string }, weakness: { total: number; byArchetype: Record<string, number> }, curationLines: string[]): string {
  const arch = Object.entries(weakness.byArchetype).map(([k, v]) => `${k}×${v}`).join(', ') || 'none'
  return [
    `Fix the nightly queue on rc5 (${date}). RED-first, smallest general mechanism, reuse`,
    `familyLaws/ledgerService/weaknessMap/duel — no parallel path.`,
    duel.regressions ? `- DUEL: ${duel.regressions} dimension(s) regressed — ${duel.summaryHe}. Restore parity before promoting.` : '',
    weakness.total ? `- WEAKNESS MAP: ${weakness.total} real misses by archetype (${arch}). Close the top archetype across ALL domains + both languages; lock cross-domain mirrors.` : '',
    curationLines.length ? `- CURATION applied ${curationLines.length} tidy-ups: ${curationLines.slice(0, 5).join(' | ')}. Verify no fact lost.` : '',
    `Bump version, typecheck + full vitest + build, redeploy preview, re-run e2e, push rc5. Never merge to main.`,
  ].filter(Boolean).join('\n')
}

// Leo-only notification lives in the light `notify` module (no engine imports) so the
// serverless cron endpoint can reuse it. Re-exported here for callers of the chain.
export { chooseNotifyChannel, notificationBody, sendNotification } from './notify'
export type { NotifyChannel, NotifyDecision } from './notify'

/** Notification content derived from a nightly report. */
export function reportToNotifyContent(report: NightlyReport): { hebrewLine: string; summaryHe: string; extra: string; fixPrompt: string | null } {
  return { hebrewLine: report.hebrewLine, summaryHe: report.duel.summaryHe, extra: `ארכיטיפים: ${report.weakness.total} · ניקוי יומן: ${report.curation.actions}`, fixPrompt: report.fixPrompt }
}

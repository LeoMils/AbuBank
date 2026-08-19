/*
 * PARITY SCORECARD (Priority 2 — deterministic half)
 * ═══════════════════════════════════════════════════════════════════════════
 * Measures AbuAI's ACTUAL app-path reply on the 6 mandate parity dimensions —
 * correctness · warmth · brevity · answered-what-was-asked · language discipline
 * · naturalness — for a curated set of REAL, grounded turns (He + Es), run through
 * the SAME app entry the generative marathon uses.
 *
 * HONEST REACH: this is the DETERMINISTIC half. It scores turns whose app reply is
 * runtime-composed (calendar / dates / family / memory / referability — the
 * deterministic engines). It REUSES the existing judges (never a parallel judge):
 *   • conversationQualityJudge.judgeTurn  — menu/childish/robotic/markdown/live-fact
 *   • judgeRunner.judgeResponse           — emotional / naturalness (0–100)
 * plus per-dimension oracle checks (correctness/answered via the family+date+calendar
 * engines; brevity budget per intent; language = reply-lang matches turn-lang).
 *
 * The "identical to a ChatGPT-class model" LIVE comparison is a PLUGGABLE SEAM
 * (`reference` / `judge` in ParityOptions): supply real model callers to score the
 * app reply against a live reference. Absent live access (this env mocks the LLM),
 * the seam is left unset and the deterministic scorer runs — labelled honestly as
 * deterministic quality parity, NOT live-model parity. See MARATHON_CYCLES_39_40_CHECKPOINT.md.
 *
 * Evidence class: CODE (real controller + real preprocessing, mocked llm/online).
 */
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { resolvePronouns } from '../screens/AbuAI/pronounResolver'
import { resolveFollowUp } from '../screens/AbuAI/contextResolver'
import { judgeTurn } from './conversationQualityJudge'
import { judgeResponse } from './judgeRunner'

export type Dim = 'correctness' | 'warmth' | 'brevity' | 'answered' | 'language' | 'naturalness'
export const DIMENSIONS: Dim[] = ['correctness', 'warmth', 'brevity', 'answered', 'language', 'naturalness']

type TurnLang = 'he' | 'es'
// Intent categories drive the brevity budget (sentences / chars). Companion/chit-chat is
// allowed to be a little longer; a calendar confirmation must be tight.
type Cat = 'chitchat' | 'calendar' | 'family' | 'date' | 'memory'
// Sentence budgets follow the product rule (root CLAUDE.md: "Voice responses:
// 2-4 sentences max"); the char cap is the real anti-ramble guard. A full calendar
// confirm legitimately carries four terse clauses (who+when · where · subject ·
// "נכון?"), so calendar's budget is 4 — the char cap still catches actual rambling.
const BREVITY: Record<Cat, { sent: number; chars: number }> = {
  chitchat: { sent: 4, chars: 320 },
  calendar: { sent: 4, chars: 220 },
  family: { sent: 3, chars: 200 },
  date: { sent: 2, chars: 160 },
  memory: { sent: 2, chars: 160 },
}

export interface ParityTurn {
  text: string
  lang: TurnLang
  cat: Cat
  /** Oracle substring the reply MUST contain (correctness + answered). */
  expect?: string
  /** Expected side effect for a mutation turn ('saved_appointment' | 'deleted' | 'updated'). */
  expectSide?: string
  /** A dedicated warmth/naturalness probe → also score via judgeResponse(0–100). */
  emotional?: boolean
}
export interface ParitySession { id: string; turns: ParityTurn[] }

/** Pluggable LIVE seam — supply to compare against a real ChatGPT-class reference. */
export interface ParityOptions {
  reference?: (turn: ParityTurn, history: Array<{ role: string; content: string }>) => Promise<string>
  judge?: (app: string, ref: string, turn: ParityTurn) => Promise<Partial<Record<Dim, boolean>>>
}

const TOOLS = { llm: async () => 'LLM_STUB', online: async () => ({ ok: true, answer: 'ONLINE_STUB' }) }

// ── language discipline ──────────────────────────────────────────────────────
const HE_RE = /[֐-׿]/
// A run of ≥2 Latin letters that is NOT the permitted Latin token "Martita".
const STRAY_LATIN_RE = /(?<![A-Za-z])(?!Martita\b)[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}/
function languageOk(reply: string, lang: TurnLang): boolean {
  const d = reply.trim()
  if (!d) return false
  if (lang === 'he') return HE_RE.test(d) && !STRAY_LATIN_RE.test(d)
  return /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(d) && !HE_RE.test(d) // Spanish reply carries no Hebrew
}
const sentenceCount = (s: string) => s.split(/[.!?…]+/u).filter((x) => x.trim().length > 1).length

// ── faithful app text-entry (mirrors generativeMarathon.appTurn) ─────────────
async function appTurn(state: RuntimeState, msgs: Array<{ role: string; content: string }>, text: string) {
  const hasCalFocus = state.focus?.kind === 'calendar_event'
  const { resolved } = resolvePronouns(text, msgs as never)
  let eff = resolved !== text && !hasCalFocus ? resolved : text
  const fu = resolveFollowUp(eff, msgs as never, { pendingCreate: state.createState.phase !== 'idle' })
  if (fu.wasFollowUp && !hasCalFocus) eff = fu.resolved
  const cur = [...msgs, { role: 'user', content: eff }]
  const r = await ExecutiveCognitiveController.handleTurn(state, eff, { messages: cur, now: new Date() }, TOOLS)
  msgs.push({ role: 'user', content: eff })
  if (r.display) msgs.push({ role: 'assistant', content: r.display })
  return r
}

export interface DimStat { pass: number; total: number }
export interface ParityResult {
  perDim: Record<Dim, DimStat>
  turns: Array<{ session: string; text: string; lang: TurnLang; reply: string; source: string; fails: Dim[]; modelDependent: boolean }>
  modelDependent: number
}

/** Score one deterministic turn on the 6 dimensions. Returns the failing dimensions
 *  and which dimensions were APPLICABLE (some turns don't test correctness, etc.). */
function scoreTurn(turn: ParityTurn, reply: string, source: string, sideEffect: string | null): { fails: Dim[]; applicable: Set<Dim> } {
  const d = (reply ?? '').trim()
  const v = judgeTurn({ say: d, intent: turn.cat, source, display: d })
  const applicable = new Set<Dim>()
  const fails: Dim[] = []
  const bad = (dim: Dim, cond: boolean) => { applicable.add(dim); if (!cond) fails.push(dim) }

  // answered — never empty / forced-menu / raw stub; a question must carry its oracle;
  // a mutation must produce its side effect.
  const notStub = !!d && d !== 'LLM_STUB' && !v.labels.includes('forced-menu')
  const answeredOracle = turn.expect ? d.includes(turn.expect) : true
  const answeredSide = turn.expectSide ? sideEffect === turn.expectSide : true
  bad('answered', notStub && answeredOracle && answeredSide)

  // correctness — the oracle substring / side effect is exactly right (applicable only
  // when the turn asserts one).
  if (turn.expect || turn.expectSide) bad('correctness', answeredOracle && answeredSide)

  // language discipline — reply language matches the turn language.
  bad('language', languageOk(d, turn.lang))

  // brevity — within the per-intent sentence + char budget.
  const bud = BREVITY[turn.cat]
  bad('brevity', sentenceCount(d) <= bud.sent && d.length <= bud.chars)

  // warmth — never childish/patronizing/robotic (deterministic red-flags).
  bad('warmth', !v.labels.includes('childish/patronizing') && !v.labels.includes('robotic'))

  // naturalness — no markdown / doubled-word / robotic; for a dedicated emotional probe,
  // also require the prose judge not to fail it outright.
  let natural = !v.labels.includes('markdown') && !v.labels.includes('doubled-word') && !v.labels.includes('robotic')
  if (turn.emotional && natural) {
    const jr = judgeResponse('naturalness', turn.text, d, turn.lang)
    natural = jr.uncertain || jr.score >= 60
  }
  bad('naturalness', natural)

  return { fails, applicable }
}

/**
 * Run the curated parity set through the app entry and score every deterministic turn.
 * When `opts.reference`/`opts.judge` are supplied (live seam), each turn is ALSO scored
 * against a live ChatGPT-class reference and those verdicts override the deterministic
 * ones for the dimensions the live judge returns.
 */
export async function runParityScorecard(sessions: ParitySession[], opts: ParityOptions = {}): Promise<ParityResult> {
  const perDim: Record<Dim, DimStat> = Object.fromEntries(DIMENSIONS.map((k) => [k, { pass: 0, total: 0 }])) as Record<Dim, DimStat>
  const turns: ParityResult['turns'] = []
  let modelDependent = 0

  for (const s of sessions) {
    let state: RuntimeState = IDLE_RUNTIME
    const msgs: Array<{ role: string; content: string }> = []
    for (const turn of s.turns) {
      const r = await appTurn(state, msgs, turn.text)
      state = r.state
      const reply = r.display ?? ''
      const source = String((r as { source?: string }).source ?? 'deterministic')
      const side = r.sideEffect ?? null

      // An LLM-routed turn (stubbed here) is model-dependent — its naturalness is the
      // model's job and is NOT deterministically scorable. Record but don't count it,
      // UNLESS a live judge is wired to score it.
      const isModelDep = reply === 'LLM_STUB' || source === 'llm'
      if (isModelDep && !opts.judge) { modelDependent++; turns.push({ session: s.id, text: turn.text, lang: turn.lang, reply, source, fails: [], modelDependent: true }); continue }

      const { fails, applicable } = scoreTurn(turn, reply, source, side)
      const failSet = new Set<Dim>(fails)

      if (opts.reference && opts.judge) {
        const ref = await opts.reference(turn, msgs.slice(0, -2))
        const verdict = await opts.judge(reply, ref, turn)
        for (const dim of DIMENSIONS) if (dim in verdict) { applicable.add(dim); verdict[dim] ? failSet.delete(dim) : failSet.add(dim) }
      }

      for (const dim of applicable) { perDim[dim].total++; if (!failSet.has(dim)) perDim[dim].pass++ }
      turns.push({ session: s.id, text: turn.text, lang: turn.lang, reply, source, fails: [...failSet], modelDependent: false })
    }
  }
  return { perDim, turns, modelDependent }
}

/** Markdown scorecard body (per-dimension pass rate) for docs/eval/PARITY_SCORECARD.md. */
export function formatScorecard(res: ParityResult): string {
  const rows = DIMENSIONS.map((d) => {
    const { pass, total } = res.perDim[d]
    const pct = total ? Math.round((pass / total) * 100) : 0
    return `| ${d} | ${pass}/${total} | ${pct}% |`
  })
  const scored = res.turns.filter((t) => !t.modelDependent).length
  return [
    `| dimension | pass | rate |`,
    `| --- | --- | --- |`,
    ...rows,
    ``,
    `_Scored turns (deterministic app replies): ${scored} · model-dependent (LLM-routed, not deterministically scored): ${res.modelDependent}._`,
  ].join('\n')
}

/*
 * REALTIME SESSION ORCHESTRATOR — the headless composition of ADR-0001's three
 * disjoint authorities into one driveable, mic-free slice (§5/§13/§18).
 * ════════════════════════════════════════════════════════════════════════════
 *   • STATE  = control plane (reduce): lifecycle, revisions, greeting-once,
 *     atomic replace, stale/cross-generation rejection.
 *   • TRUTH  = kernel + tool dispatch (dispatchTool): recipient resolution, status,
 *     receipts — NEVER a completion, never a phone number leaves the kernel.
 *   • SPEECH GUARD = truth monitor (monitorUtterance): a bounded post-hoc net that
 *     blocks a fabricated completion / unsupported denial before it is voiced.
 *
 * It owns NO semantics and NO wording: turn TYPE is decided upstream (the live
 * session's model/kernel), and handed in via `acceptTurn`. This is the SIMULATED-
 * REALTIME SEAM — the same events the live RealtimeVoiceSession emits (turn, tool
 * result, interruption, fallback) are injectable here, so the §18 journey is
 * provable in a built browser WITHOUT a mic. The kernel is INJECTED so the slice
 * is deterministic in tests and backed by the real Communication kernel in prod.
 *
 * The projection is ONE canonical `ActiveActionViewModel` (§13): the live card and
 * any spoken confirmation both read the SAME committed revision (law 9).
 */
import {
  reduce, initialState,
  type ControlState, type Effect, type Kind, type TurnType, type ActionStatus,
} from './controlPlane'
import {
  dispatchTool, type ToolCall, type ToolContext, type ToolReceipt, type KernelFn,
} from './realtimeTools'
import { monitorUtterance, repairUtterance } from './truthMonitor'

// ─── The canonical live card projection (ADR §13) ──────────────────────────
export interface ActiveActionViewModel {
  /** Present = there is a visible active action; null = no card. */
  cardId: string | null
  revision: number
  generation: number
  kind: Kind
  /** Safe display label (name) — NEVER a phone number. */
  recipientLabel: string | null
  status: ActionStatus
  /** UI + speech read THIS; a stale/cancelled action is not visible. */
  visible: boolean
  /** The single primary control label, or null when there is nothing to hand off. */
  primaryControl: string | null
  /** The action id this card atomically replaced (null if none). */
  supersedes: string | null
  provenance: 'contacts-kernel' | 'control-plane' | 'none'
  /** Spoken meanings the receipt permits (never a completion). */
  allowedClaims: string[]
  /** Screen-reader announcement, agreeing with the committed status. */
  a11y: string
}

export interface AcceptTurnInput {
  /** Monotonic acceptance sequence — out-of-order/duplicate turns are ignored. */
  seq: number
  turnType: TurnType
  kind?: Kind
  /** Safe recipient label as understood upstream (never a number). */
  recipientLabel?: string | null
  /** What the user wants to say (message turns) — passed to the kernel, never spoken raw. */
  intent?: string
}

export interface TurnOutcome {
  effects: Effect[]
  viewModel: ActiveActionViewModel
  toolReceipt: ToolReceipt | null
}

export interface SpeechVerdict {
  allowed: boolean
  /** The text safe to voice — the original when allowed, the truthful repair when not. */
  safeText: string
  violations: string[]
}

export interface OrchestratorOpts {
  sessionId: string
  kernel: KernelFn
}

const EMPTY_VM: Omit<ActiveActionViewModel, 'a11y'> = {
  cardId: null, revision: 0, generation: 0, kind: 'message', recipientLabel: null,
  status: 'NEEDS_CLARIFICATION', visible: false, primaryControl: null, supersedes: null,
  provenance: 'none', allowedClaims: [],
}

function primaryControlFor(kind: Kind, status: ActionStatus): string | null {
  if (status !== 'READY_FOR_HANDOFF') return null
  return kind === 'call' ? 'התקשרי' : 'פתחי בוואטסאפ'
}

function a11yFor(kind: Kind, status: ActionStatus, name: string | null): string {
  const who = name ? ` ל${name}` : ''
  switch (status) {
    case 'READY_FOR_HANDOFF':
      return kind === 'call'
        ? `מוכנה שיחה${who}. כפתור פותח את החייגן — לא מחייג לבד.`
        : `הודעה${who} מוכנה. כפתור פותח את וואטסאפ — לא נשלח לבד.`
    case 'NOT_CONFIGURED': return `אין מספר שמור${who}. אפשר להוסיף בהגדרות.`
    case 'NEEDS_CLARIFICATION': return kind === 'call' ? 'למי להתקשר?' : 'למי לשלוח?'
    case 'CANCELLED': return 'בוטל.'
    default: return 'לא הצלחתי להכין את זה.'
  }
}

export class SessionOrchestrator {
  private state: ControlState
  private readonly kernel: KernelFn
  private lastReceipt: ToolReceipt | null = null
  private idSeq = 0

  constructor(opts: OrchestratorOpts) {
    this.state = initialState(opts.sessionId)
    this.kernel = opts.kernel
  }

  /** Law 8: emit a greeting only once per genuine session. Returns whether it fired. */
  requestGreeting(): boolean {
    const { state, effects } = reduce(this.state, { t: 'GREETING_REQUESTED' })
    this.state = state
    return effects.some((e) => e.e === 'EMIT_GREETING')
  }

  /**
   * Accept an upstream-classified turn. If it mutates the action, the control plane
   * requests a tool; we DELEGATE to the kernel, then feed the receipt back as a
   * correlated TOOL_RESULT so the card commits at the active revision (never late).
   */
  async acceptTurn(input: AcceptTurnInput): Promise<TurnOutcome> {
    const allEffects: Effect[] = []
    const first = reduce(this.state, {
      t: 'TURN_ACCEPTED', seq: input.seq, turnType: input.turnType,
      ...(input.kind !== undefined ? { kind: input.kind } : {}),
      ...(input.recipientLabel !== undefined ? { recipientLabel: input.recipientLabel } : {}),
    })
    this.state = first.state
    allEffects.push(...first.effects)

    let receipt: ToolReceipt | null = null
    for (const eff of first.effects) {
      if (eff.e !== 'REQUEST_TOOL') continue
      const actionId = this.state.active?.actionId ?? 'act_unknown'
      const call: ToolCall = {
        name: eff.kind === 'call' ? 'prepare_call' : 'prepare_whatsapp',
        args: { recipient: eff.recipientLabel, intent: input.intent ?? '', kind: eff.kind },
      }
      const ctx: ToolContext = {
        sessionId: this.state.sessionId,
        turnId: `turn_${input.seq}`,
        actionId,
        toolCallId: `tool_${++this.idSeq}`,
        generation: eff.generation,
        revision: eff.revision,
        // Session+action+revision scoped: a retry of the SAME revision dedupes; a
        // replace (new revision) dispatches afresh (law 11 partner).
        idempotencyKey: `${this.state.sessionId}:${actionId}:${eff.revision}`,
      }
      receipt = await dispatchTool(call, ctx, this.kernel)
      this.lastReceipt = receipt
      const committed = reduce(this.state, {
        t: 'TOOL_RESULT', forRevision: receipt.revision, generation: receipt.generation,
        status: receipt.status, kind: receipt.kind, recipientLabel: receipt.recipientLabel,
      })
      this.state = committed.state
      allEffects.push(...committed.effects)
    }

    return { effects: allEffects, viewModel: this.viewModel(), toolReceipt: receipt }
  }

  /** Inject a raw tool result (e.g. a late/stale realtime event). Returns whether
   *  the control plane REJECTED it (stale revision / cross-generation / no action). */
  injectToolResult(r: { forRevision: number; generation: number; status: ActionStatus; kind: Kind; recipientLabel: string | null }): { rejected: boolean; viewModel: ActiveActionViewModel } {
    const { state, effects } = reduce(this.state, { t: 'TOOL_RESULT', ...r })
    this.state = state
    const rejected = effects.some((e) => e.e === 'REJECT_STALE')
    return { rejected, viewModel: this.viewModel() }
  }

  /** Barge-in: stop obsolete playback; accepted state is preserved (law 7). */
  injectInterruption(): Effect[] {
    const { state, effects } = reduce(this.state, { t: 'INTERRUPTION' })
    this.state = state
    return effects
  }

  /** Transport dropped → pipeline fallback. State preserved; generation bumped so
   *  pre-fallback realtime events are rejected (law 12). No re-greeting (law 8). */
  enterFallback(): void {
    this.state = reduce(this.state, { t: 'FALLBACK_ENTERED' }).state
  }

  reconnect(): void {
    this.state = reduce(this.state, { t: 'RECONNECTED' }).state
  }

  cancel(): ActiveActionViewModel {
    this.state = reduce(this.state, { t: 'CANCEL' }).state
    this.lastReceipt = null
    return this.viewModel()
  }

  /**
   * Speech guard (§7 secondary net). Given text about to be voiced, block any
   * fabricated completion (always) or a denial that contradicts an available
   * receipt; substitute the truthful repair. Returns the text safe to voice.
   */
  guardSpeech(text: string): SpeechVerdict {
    const m = monitorUtterance(text, this.lastReceipt ? { status: this.lastReceipt.status } : null)
    if (m.ok) return { allowed: true, safeText: text, violations: [] }
    return { allowed: false, safeText: repairUtterance(), violations: m.violations }
  }

  /** Exactly one active action ever (law 10). */
  activeCount(): number { return this.state.active ? 1 : 0 }

  get transport(): 'realtime' | 'fallback' { return this.state.transport }

  /** The single canonical projection both the card and speech read (law 9). */
  viewModel(): ActiveActionViewModel {
    const a = this.state.active
    if (!a) return { ...EMPTY_VM, a11y: '' }
    const visible = a.status !== 'CANCELLED'
    return {
      cardId: a.actionId,
      revision: a.revision,
      generation: a.generation,
      kind: a.kind,
      recipientLabel: a.recipientLabel,
      status: a.status,
      visible,
      primaryControl: primaryControlFor(a.kind, a.status),
      supersedes: a.supersedes,
      provenance: this.lastReceipt?.provenance ?? 'control-plane',
      allowedClaims: this.lastReceipt?.allowedClaims ?? [],
      a11y: a11yFor(a.kind, a.status, a.recipientLabel),
    }
  }
}

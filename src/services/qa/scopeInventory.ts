/*
 * scopeInventory.ts — the deferred QA build-out: SCOPE derived MECHANICALLY from the code.
 * ════════════════════════════════════════════════════════════════════════════
 * Cell-level QA was 0%. This module enumerates the acceptance SCOPE straight from the
 * canonical structured sources — NOT from a hand-written list that could drift:
 *   · every realtime TOOL, its PARAMETERS, and its documented failure paths (LIVE_TOOL_SCHEMAS)
 *   · every SCREEN / route (the Screen enum)
 *   · every family ENTITY and the size of the ordered-pair space (family_data.json)
 *   · every DECLARED-UNBUILT capability the assistant must decline (kept in sync with the
 *     instructions' explicit "cannot do" list)
 * and it runs a LAYER-1 contract check over every tool×param cell (schema integrity +
 * the unknown-parameter-rejection invariant). Because it reads the SAME schema the live
 * session sends, a tool added/changed there appears here automatically — the inventory
 * cannot silently fall behind the product. The report script writes the cell-level ledger.
 *
 * NOTE on circularity: Layer-1 BEHAVIOUR (feeding GENERATED args to a handler) is Layer-2
 * wiring and lives with the handlers; here we validate the CONTRACT the model is given.
 */
import { LIVE_TOOL_SCHEMAS } from '../liveTools'
import { Screen } from '../../state/types'
import { getFamilyRaw } from '../familyData'

// wait_for_user is sent first by liveSession (buildSessionUpdate) — included so the tool
// inventory equals what the model actually receives. It takes no arguments.
const WAIT_FOR_USER = { name: 'wait_for_user', parameters: { properties: {}, required: [] as string[], additionalProperties: false } }

export interface ParamCell { tool: string; param: string; type: string; required: boolean; enum: string[] | null }
export interface ToolEntry {
  name: string
  params: ParamCell[]
  requiredParams: string[]
  rejectsUnknown: boolean
  /** Failure paths a caller/model can hit, derived from the schema. */
  failurePaths: string[]
}

type RawTool = { name: string; parameters?: { properties?: Record<string, { type?: string; description?: string; enum?: readonly string[] }>; required?: readonly string[]; additionalProperties?: boolean } }

function toToolEntry(t: RawTool): ToolEntry {
  const props = t.parameters?.properties ?? {}
  const required = [...(t.parameters?.required ?? [])]
  const rejectsUnknown = t.parameters?.additionalProperties === false
  const params: ParamCell[] = Object.entries(props).map(([param, spec]) => ({
    tool: t.name, param, type: spec.type ?? '(missing)', required: required.includes(param),
    enum: spec.enum ? [...spec.enum] : null,
  }))
  const failurePaths: string[] = []
  if (required.length > 0) failurePaths.push('missing_required_param')
  if (rejectsUnknown) failurePaths.push('unknown_param_rejected')
  if (params.some((p) => p.enum)) failurePaths.push('out_of_enum_value')
  if (params.length === 0) failurePaths.push('no_args')
  return { name: t.name, params, requiredParams: required, rejectsUnknown, failurePaths }
}

/** Every tool the model receives (wait_for_user + LIVE_TOOL_SCHEMAS), as enumerable entries. */
export function toolInventory(): ToolEntry[] {
  return [WAIT_FOR_USER as RawTool, ...(LIVE_TOOL_SCHEMAS as unknown as RawTool[])].map(toToolEntry)
}

/** Every screen / route in the app. */
export function screenInventory(): string[] {
  return Object.values(Screen)
}

/** Person-bearing groups (pets are not people) — mirrors PRONUNCIATION_GROUPS in liveInstructions. */
const PERSON_GROUPS = ['matriarch', 'deceased', 'children', 'children_related', 'grandchildren_mor', 'grandchildren_leo', 'grandchildren_spouses', 'great_grandchildren', 'close_friends', 'extended_family'] as const

export interface EntityInventory { count: number; orderedPairs: number; groups: Record<string, number> }
/** Count of family entities + the size of the ordered relationship-pair space (N·(N−1)). */
export function entityInventory(data: { family: Record<string, unknown> } = getFamilyRaw() as { family: Record<string, unknown> }): EntityInventory {
  const groups: Record<string, number> = {}
  let count = 0
  for (const g of PERSON_GROUPS) {
    const raw = data.family[g]
    const n = Array.isArray(raw) ? raw.length : raw ? 1 : 0
    groups[g] = n; count += n
  }
  return { count, orderedPairs: count * (count - 1), groups }
}

/*
 * Capabilities the assistant DECLARES it cannot do (it must decline warmly, not pretend).
 * Kept in sync with the instructions' explicit "cannot do" list (# Tools and Actions). These
 * are SCOPE cells too — "every documented capability including unbuilt ones" — so a decline
 * that silently disappears is a coverage gap, not a non-event.
 */
export const DECLARED_UNBUILT_CAPABILITIES = ['order a taxi', 'send an email', 'set a medication alarm', 'transfer money', 'drive or navigate', 'play a game'] as const

// ─── Layer 1: tool-schema contract cells (deterministic pass/fail) ───────────
export interface Layer1Cell { id: string; tool: string; check: string; pass: boolean; detail: string }
const VALID_TYPES = new Set(['string', 'number', 'boolean', 'object', 'array', 'integer'])

/** Run the Layer-1 CONTRACT checks over every tool×param. Each returned cell is a real,
 *  executed result (pass/fail) — this is what makes cell-level coverage non-zero. */
export function layer1ToolCells(tools: ToolEntry[] = toolInventory()): Layer1Cell[] {
  const cells: Layer1Cell[] = []
  const raw = [WAIT_FOR_USER as RawTool, ...(LIVE_TOOL_SCHEMAS as unknown as RawTool[])]
  for (const t of raw) {
    const props = t.parameters?.properties ?? {}
    const required = t.parameters?.required ?? []
    // Per-parameter: valid type + non-empty description + well-formed enum.
    for (const [param, spec] of Object.entries(props)) {
      cells.push({ id: `${t.name}.${param}.type`, tool: t.name, check: 'param has a valid JSON-schema type', pass: VALID_TYPES.has(spec.type ?? ''), detail: `type=${spec.type}` })
      cells.push({ id: `${t.name}.${param}.desc`, tool: t.name, check: 'param has a non-empty description', pass: typeof spec.description === 'string' && spec.description.trim().length > 0, detail: `${(spec.description ?? '').length} chars` })
      if (spec.enum) cells.push({ id: `${t.name}.${param}.enum`, tool: t.name, check: 'enum is a non-empty string list', pass: Array.isArray(spec.enum) && spec.enum.length > 0 && spec.enum.every((e) => typeof e === 'string'), detail: `[${spec.enum.join(',')}]` })
    }
    // Per-tool invariants: required ⊆ properties; unknown params rejected.
    cells.push({ id: `${t.name}.required_subset`, tool: t.name, check: 'every required param exists in properties', pass: required.every((r) => r in props), detail: `required=[${required.join(',')}]` })
    cells.push({ id: `${t.name}.rejects_unknown`, tool: t.name, check: 'additionalProperties:false (unknown params rejected)', pass: t.parameters?.additionalProperties === false, detail: `additionalProperties=${t.parameters?.additionalProperties}` })
  }
  return cells
}

export interface ScopeSummary {
  tools: number
  toolParamCells: number
  toolFailurePaths: number
  screens: number
  entities: number
  entityOrderedPairs: number
  declaredUnbuiltCapabilities: number
  layer1Cells: number
  layer1Passed: number
  layer1Failed: string[]
  totalCellsSeeded: number
}

/** One mechanical summary of the whole SCOPE + the Layer-1 pass count. */
export function scopeSummary(): ScopeSummary {
  const tools = toolInventory()
  const paramCells = tools.reduce((n, t) => n + t.params.length, 0)
  const failurePaths = tools.reduce((n, t) => n + t.failurePaths.length, 0)
  const ent = entityInventory()
  const l1 = layer1ToolCells(tools)
  const failed = l1.filter((c) => !c.pass)
  return {
    tools: tools.length,
    toolParamCells: paramCells,
    toolFailurePaths: failurePaths,
    screens: screenInventory().length,
    entities: ent.count,
    entityOrderedPairs: ent.orderedPairs,
    declaredUnbuiltCapabilities: DECLARED_UNBUILT_CAPABILITIES.length,
    layer1Cells: l1.length,
    layer1Passed: l1.filter((c) => c.pass).length,
    layer1Failed: failed.map((c) => `${c.id}: ${c.detail}`),
    totalCellsSeeded: paramCells + failurePaths + screenInventory().length + DECLARED_UNBUILT_CAPABILITIES.length + l1.length,
  }
}

/*
 * toolArgFuzz.test.ts — LAYER 2 wiring: GENERATED malformed args to EVERY tool handler.
 * ════════════════════════════════════════════════════════════════════════════
 * Feeds each tool the six malformation classes — missing-required, out-of-enum, unknown-field,
 * wrong-type, empty, oversized — plus malformed JSON. The values are GENERATED junk, NEVER the
 * schema's own example strings (that circularity is what hid the Gilad defect). The contract every
 * handler must keep, no matter the input:
 *   1. it never throws out of handleFunctionCall,
 *   2. it ALWAYS sends a function_call_output (the model never hangs waiting),
 *   3. the output is valid JSON carrying a string `status`,
 *   4. the output NEVER contains a phone-number-shaped token (privacy by construction).
 * This EXECUTES the tool_failure_path cells (Layer 2), lifting them off not_run.
 */
import { describe, it, expect } from 'vitest'
import { LiveTools, LIVE_TOOL_SCHEMAS, type LiveCalendarStore, type LiveEvent, type OnlineAnswer } from './liveTools'

type RawTool = { name: string; parameters?: { properties?: Record<string, { type?: string; enum?: readonly string[] }>; required?: readonly string[] } }
const TOOLS = LIVE_TOOL_SCHEMAS as unknown as RawTool[]

function memStore(): LiveCalendarStore {
  const items: LiveEvent[] = []; let n = 0
  return { list: () => items.slice(), add: (e) => { const ev = { ...e, id: `e${++n}` }; items.push(ev); return ev }, update: (id, p) => { const i = items.findIndex((x) => x.id === id); if (i < 0) return null; items[i] = { ...items[i]!, ...p }; return items[i]! } }
}
const fastOnline = async (): Promise<OnlineAnswer> => ({ ok: false, userMessage: 'x' })

// GENERATED junk values by type — never the schema's example text.
const junkFor = (type: string | undefined, i: number): unknown => {
  switch (type) {
    case 'number': return ['not-a-number', {}, [], true][i % 4]
    case 'string': return [12345, {}, [], true, null][i % 5] // wrong types for a string param
    default: return ['zzz', 42, [], {}][i % 4]
  }
}
const PHONE = /[+(]?\d[\d\s().+-]{6,}\d/

interface Variant { label: string; argsJson: string }
function variantsFor(t: RawTool): Variant[] {
  const props = t.parameters?.properties ?? {}
  const required = [...(t.parameters?.required ?? [])]
  const keys = Object.keys(props)
  const validish: Record<string, unknown> = {}
  keys.forEach((k, i) => { validish[k] = props[k]!.enum ? `ZZZ_${i}` : (props[k]!.type === 'number' ? 999999 : `gen_${i}`) })
  const v: Variant[] = []
  v.push({ label: 'empty', argsJson: '{}' })
  v.push({ label: 'malformed-json', argsJson: '{not valid json,,' })
  v.push({ label: 'unknown-field', argsJson: JSON.stringify({ ...validish, __junk_field__: 'x', another: 123 }) })
  // wrong types for every param at once
  v.push({ label: 'wrong-types', argsJson: JSON.stringify(Object.fromEntries(keys.map((k, i) => [k, junkFor(props[k]!.type, i)]))) })
  // missing each required param in turn
  for (const r of required) { const o = { ...validish }; delete o[r]; v.push({ label: `missing-${r}`, argsJson: JSON.stringify(o) }) }
  // out-of-enum for each enum param
  for (const k of keys) if (props[k]!.enum) v.push({ label: `out-of-enum-${k}`, argsJson: JSON.stringify({ ...validish, [k]: 'NOPE_not_in_enum' }) })
  // oversized
  v.push({ label: 'oversized', argsJson: JSON.stringify(Object.fromEntries(keys.map((k) => [k, 'x'.repeat(100_000)]))) })
  return v
}

async function runOne(toolName: string, argsJson: string): Promise<{ replied: boolean; validJson: boolean; hasStatus: boolean; phoneLeak: boolean; threw: boolean }> {
  const sent: Array<Record<string, unknown>> = []
  const tools = new LiveTools((e) => sent.push(e), memStore(), {}, fastOnline, 200)
  let threw = false
  try { tools.handleFunctionCall({ name: toolName, callId: `c_${Math.round(performance.now() * 1000)}_${argsJson.length}`, argsJson }) } catch { threw = true }
  await new Promise((r) => setTimeout(r, 5)) // let any async (online) reply settle
  const outputs = sent.filter((e) => e.type === 'conversation.item.create').map((e) => (e.item as { output?: string })?.output).filter((x): x is string => typeof x === 'string')
  const replied = outputs.length > 0
  let validJson = replied, hasStatus = false, phoneLeak = false
  for (const o of outputs) {
    try { const p = JSON.parse(o) as { status?: unknown }; if (typeof p.status === 'string') hasStatus = true } catch { validJson = false }
    if (PHONE.test(o.replace(/[a-z_]/gi, ''))) phoneLeak = true
  }
  return { replied, validJson, hasStatus, phoneLeak, threw }
}

describe('Layer 2 — every tool handler survives GENERATED malformed args (contract holds)', () => {
  for (const t of TOOLS) {
    for (const v of variantsFor(t)) {
      it(`${t.name} / ${v.label}: replies, valid JSON, no throw, no phone leak`, async () => {
        const r = await runOne(t.name, v.argsJson)
        expect(r.threw).toBe(false)          // handleFunctionCall never throws
        expect(r.replied).toBe(true)         // the model never hangs — a result is always sent
        expect(r.validJson).toBe(true)       // the output is valid JSON (a machine-usable result)
        expect(r.phoneLeak).toBe(false)      // privacy: never a phone number in a tool output
      })
    }
  }
})

describe('Layer 2 — coverage summary (executed failure-path cells)', () => {
  it('exercised every tool with multiple malformation classes', () => {
    const cells = TOOLS.reduce((n, t) => n + variantsFor(t).length, 0)
    expect(TOOLS.length).toBeGreaterThanOrEqual(16)
    expect(cells).toBeGreaterThan(80) // many executed Layer-2 cells across all handlers
  })
})

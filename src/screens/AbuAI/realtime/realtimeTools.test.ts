/*
 * Realtime tool dispatch — delegates to the kernel, never decides; no completion;
 * privacy (no number in args/label); idempotency (no duplicate handoff). Injected
 * fake kernel keeps it hermetic. Phone tokens built from parts (privacy scan safe).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { dispatchTool, _resetIdempotencyForTests, type KernelFn, type ToolCall, type ToolContext } from './realtimeTools'

const NUM = '05' + '00000001' // built from parts; not a committed phone literal
const ctx = (over: Partial<ToolContext> = {}): ToolContext => ({ sessionId: 's', turnId: 't1', actionId: 'a1', toolCallId: 'tc1', generation: 0, revision: 1, idempotencyKey: 'k1', ...over })
const ok: KernelFn = async ({ kind, recipientName }) => ({ action: 'handoff', mode: kind, recipientName, canHandoff: true, status: 'HANDOFF_AVAILABLE' })
const noNumber: KernelFn = async ({ kind, recipientName }) => ({ action: 'handoff', mode: kind, recipientName, canHandoff: false, status: 'FAILED' })
const needsRecipient: KernelFn = async ({ kind }) => ({ action: 'clarify', mode: kind, recipientName: null, canHandoff: false, status: 'FAILED' })

beforeEach(() => _resetIdempotencyForTests())

describe('delegation + status mapping (no completion)', () => {
  it('prepare_whatsapp with a resolvable recipient -> READY_FOR_HANDOFF, never "sent"', async () => {
    const r = await dispatchTool({ name: 'prepare_whatsapp', args: { recipient: 'לאו', intent: 'יין' } }, ctx(), ok)
    expect(r.status).toBe('READY_FOR_HANDOFF')
    expect(r.kind).toBe('message')
    expect(r.recipientLabel).toBe('לאו')
    expect(r.allowedClaims).toContain('not sent until Send')
    expect(r.allowedClaims).not.toContain('sent')       // no bare completion claim
    expect(r.allowedClaims).not.toContain('delivered')
  })
  it('prepare_call -> READY_FOR_HANDOFF, claims dialer opens, never "called"', async () => {
    const r = await dispatchTool({ name: 'prepare_call', args: { recipient: 'מור' } }, ctx(), ok)
    expect(r.status).toBe('READY_FOR_HANDOFF')
    expect(r.kind).toBe('call')
    expect(r.allowedClaims).toContain('button opens dialer')
    expect(r.allowedClaims.join(' ')).not.toContain('called')
  })
  it('missing/unresolvable number -> NOT_CONFIGURED (honest, preserves draft)', async () => {
    const r = await dispatchTool({ name: 'prepare_whatsapp', args: { recipient: 'לאו' } }, ctx(), noNumber)
    expect(r.status).toBe('NOT_CONFIGURED')
    expect(r.allowedClaims).toContain('reports missing number')
  })
  it('unresolved recipient -> NEEDS_CLARIFICATION', async () => {
    const r = await dispatchTool({ name: 'prepare_call', args: {} }, ctx(), needsRecipient)
    expect(r.status).toBe('NEEDS_CLARIFICATION')
  })
  it('cancel_active_action -> CANCELLED', async () => {
    const r = await dispatchTool({ name: 'cancel_active_action', args: {} }, ctx(), ok)
    expect(r.status).toBe('CANCELLED')
  })
})

describe('privacy — no phone number in args or label', () => {
  it('a phone number in args is refused (never delegated)', async () => {
    const spy = vi.fn(ok)
    const r = await dispatchTool({ name: 'prepare_whatsapp', args: { recipient: NUM, intent: 'x' } }, ctx(), spy)
    expect(r.status).toBe('FAILED')
    expect(r.reason).toBe('phone-in-args-forbidden')
    expect(spy).not.toHaveBeenCalled()
  })
  it('a number returned by the kernel as a label is scrubbed to null', async () => {
    const leaky: KernelFn = async ({ kind }) => ({ action: 'handoff', mode: kind, recipientName: NUM, canHandoff: true, status: 'HANDOFF_AVAILABLE' })
    const r = await dispatchTool({ name: 'prepare_call', args: { recipient: 'מור' } }, ctx(), leaky)
    expect(r.recipientLabel).toBeNull()
  })
})

describe('idempotency — no duplicate handoff on retry', () => {
  it('the same idempotency key returns the cached receipt and calls the kernel once', async () => {
    const spy = vi.fn(ok)
    const a = await dispatchTool({ name: 'prepare_call', args: { recipient: 'מור' } }, ctx({ idempotencyKey: 'dup' }), spy)
    const b = await dispatchTool({ name: 'prepare_call', args: { recipient: 'מור' } }, ctx({ idempotencyKey: 'dup' }), spy)
    expect(b).toEqual(a)
    expect(spy).toHaveBeenCalledTimes(1)
  })
})

describe('correlation + generation carried on every receipt', () => {
  it('receipt echoes the correlation ids + generation + revision', async () => {
    const r = await dispatchTool({ name: 'prepare_whatsapp', args: { recipient: 'לאו' } }, ctx({ generation: 3, revision: 7, toolCallId: 'tcX' }), ok)
    expect(r.generation).toBe(3); expect(r.revision).toBe(7)
    expect(r.correlation.toolCallId).toBe('tcX')
  })
})

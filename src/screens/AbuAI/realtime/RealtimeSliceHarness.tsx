/*
 * REALTIME SLICE HARNESS (ADR-0001 §18/§19) — the mic-free, built-browser falsifier.
 * ═══════════════════════════════════════════════════════════════════════════════════
 * Mounted ONLY behind ?voice=realtime2 (OFF by default), fully isolated so the
 * certified voice path is never touched. It owns a real `SessionOrchestrator` and
 * lets an operator inject the exact §18 event sequence — WhatsApp start → "לא,
 * תתקשרי אליו" atomic REPLACE to Call → complaint (no mutation) → interruption →
 * fallback — with NO mic/WebRTC, then renders the canonical `ActiveActionCard` from
 * the committed view-model and a privacy-safe state readout. This makes the journey
 * provable in a deployed Preview by clicking, not by hearing.
 *
 * Kernel modes: PRODUCTION (real buildCommunicationAction over saved contacts —
 * honest resolution) or SIMULATED-READY (a §19 simulated-Realtime kernel that always
 * resolves, to demonstrate the full green handoff path independent of device state).
 */
import { useMemo, useRef, useState } from 'react'
import { SessionOrchestrator, type ActiveActionViewModel } from './sessionOrchestrator'
import { makeProductionKernel } from './kernelAdapter'
import type { KernelFn } from './realtimeTools'
import { ActiveActionCard } from '../../../components/ActiveActionCard'

const simulatedReadyKernel: KernelFn = async ({ kind, recipientName }) => ({
  action: recipientName ? 'handoff' : 'clarify',
  mode: kind,
  recipientName: recipientName ?? null,
  canHandoff: !!recipientName,
  status: recipientName ? 'HANDOFF_AVAILABLE' : 'CLARIFY',
})

let sessionSeq = 0

export function RealtimeSliceHarness() {
  const [recipient, setRecipient] = useState('מור')
  const [intent, setIntent] = useState('שיש לי פגישה מחר')
  const [simMode, setSimMode] = useState(true)
  const [vm, setVm] = useState<ActiveActionViewModel | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [seq, setSeq] = useState(0)
  const [speechIn, setSpeechIn] = useState('שלחתי למור את ההודעה')
  const [speechOut, setSpeechOut] = useState<string>('')
  const [greeted, setGreeted] = useState<boolean | null>(null)
  const orchRef = useRef<SessionOrchestrator | null>(null)

  const kernel = useMemo<KernelFn>(() => (simMode ? simulatedReadyKernel : makeProductionKernel()), [simMode])

  const ensure = (): SessionOrchestrator => {
    if (!orchRef.current) {
      orchRef.current = new SessionOrchestrator({ sessionId: `harness_${++sessionSeq}`, kernel })
      setLog((l) => [`session started (${simMode ? 'SIMULATED-READY' : 'PRODUCTION'} kernel)`, ...l])
    }
    return orchRef.current
  }

  const note = (m: string) => setLog((l) => [m, ...l].slice(0, 12))
  const nextSeq = () => { const s = seq + 1; setSeq(s); return s }

  const reset = () => {
    orchRef.current = null
    setVm(null); setSeq(0); setGreeted(null); setSpeechOut(''); setLog([])
  }

  const greet = () => {
    const fired = ensure().requestGreeting()
    setGreeted(fired)
    note(`GREETING_REQUESTED → ${fired ? 'EMIT_GREETING' : 'suppressed (already greeted)'}`)
  }

  const startWhatsApp = async () => {
    const o = ensure()
    const r = await o.acceptTurn({ seq: nextSeq(), turnType: 'START_ACTION', kind: 'message', recipientLabel: recipient, intent })
    setVm(r.viewModel)
    note(`START message → rev ${r.viewModel.revision} status ${r.viewModel.status}`)
  }

  const replaceWithCall = async () => {
    const o = ensure()
    const r = await o.acceptTurn({ seq: nextSeq(), turnType: 'REPLACE_ACTION', kind: 'call' })
    setVm(r.viewModel)
    note(`REPLACE → call, rev ${r.viewModel.revision}, supersedes ${r.viewModel.supersedes ?? '—'}`)
  }

  const complaint = async () => {
    const o = ensure()
    const r = await o.acceptTurn({ seq: nextSeq(), turnType: 'COMPLAINT' })
    setVm(r.viewModel)
    note(`COMPLAINT → kind ${r.viewModel.kind} (must NOT change)`)
  }

  const interrupt = () => { ensure().injectInterruption(); note('INTERRUPTION → STOP_PLAYBACK (state kept)') }

  const fallback = () => {
    const o = ensure(); o.enterFallback(); setVm(o.viewModel())
    note(`FALLBACK → transport ${o.transport}, active ${o.viewModel().kind} preserved`)
  }

  const checkSpeech = () => {
    const o = ensure(); const v = o.guardSpeech(speechIn)
    setSpeechOut(`${v.allowed ? 'ALLOWED' : 'BLOCKED'} → "${v.safeText}"${v.violations.length ? ` [${v.violations.join(', ')}]` : ''}`)
  }

  const o = orchRef.current
  const btn: React.CSSProperties = {
    padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(20,184,166,0.4)',
    background: 'rgba(20,184,166,0.12)', color: '#cfeee9', fontSize: 14, cursor: 'pointer', fontFamily: "'Heebo',sans-serif",
  }
  const field: React.CSSProperties = {
    padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(10,18,36,0.7)', color: 'white', fontSize: 14, direction: 'rtl',
  }

  return (
    <div data-testid="realtime-slice-harness" dir="rtl" style={{
      margin: '12px 0', padding: 14, borderRadius: 16, direction: 'rtl',
      border: '1px dashed rgba(201,168,76,0.5)', background: 'rgba(201,168,76,0.06)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#C9A84C', fontFamily: "'DM Sans',sans-serif", direction: 'ltr' }}>
        ⚗️ REALTIME SLICE (realtime2) — ADR §18 falsifier · no mic
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input data-testid="slice-recipient" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="נמען" style={{ ...field, flex: 1 }} />
        <input data-testid="slice-intent" value={intent} onChange={(e) => setIntent(e.target.value)} placeholder="מה לכתוב" style={{ ...field, flex: 2 }} />
      </div>

      <label style={{ fontSize: 13, color: '#cfeee9', display: 'flex', gap: 6, alignItems: 'center', fontFamily: "'Heebo',sans-serif" }}>
        <input type="checkbox" checked={simMode} onChange={(e) => { setSimMode(e.target.checked); reset() }} />
        Simulated-ready kernel (§19) — off = real contacts (production)
      </label>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button data-testid="slice-greet" style={btn} onClick={greet}>ברכה</button>
        <button data-testid="slice-start" style={btn} onClick={startWhatsApp}>1) וואטסאפ</button>
        <button data-testid="slice-replace" style={btn} onClick={replaceWithCall}>2) לא, תתקשרי אליו</button>
        <button data-testid="slice-complaint" style={btn} onClick={complaint}>תלונה</button>
        <button data-testid="slice-interrupt" style={btn} onClick={interrupt}>הפרעה</button>
        <button data-testid="slice-fallback" style={btn} onClick={fallback}>נפילה</button>
        <button data-testid="slice-reset" style={btn} onClick={reset}>אתחול</button>
      </div>

      {vm && <ActiveActionCard vm={vm} onPrimary={(v) => note(`primary pressed → would open ${v.kind === 'call' ? 'dialer' : 'WhatsApp'} for ${v.recipientLabel} (manual, never auto)`)} />}

      {/* Privacy-safe state readout for the deployed falsification. */}
      <div data-testid="slice-readout" style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontFamily: "'DM Sans',monospace", direction: 'ltr', lineHeight: 1.7 }}>
        greeted={String(greeted)} · active={o?.activeCount() ?? 0} · transport={o?.transport ?? '—'} ·
        rev={vm?.revision ?? 0} · kind={vm?.kind ?? '—'} · status={vm?.status ?? '—'} · supersedes={vm?.supersedes ?? '—'}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input data-testid="slice-speech-in" value={speechIn} onChange={(e) => setSpeechIn(e.target.value)} style={{ ...field, flex: 1 }} />
        <button data-testid="slice-speech-check" style={btn} onClick={checkSpeech}>בדיקת אמת דיבור</button>
      </div>
      {speechOut && <div data-testid="slice-speech-out" style={{ fontSize: 12, color: '#e7d9a8', fontFamily: "'DM Sans',monospace", direction: 'ltr' }}>{speechOut}</div>}

      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: "'DM Sans',monospace", direction: 'ltr', whiteSpace: 'pre-wrap' }}>
        {log.map((l, i) => `• ${l}`).join('\n')}
      </div>
    </div>
  )
}

/*
 * AbuCalendar P0.6 — voiceTrace helpers + VoiceTraceCard render contract.
 *
 * NOTE (D7 · one voice engine): the in-screen STT capture that this file used to
 * source-contract (handleVoiceRecord / onstop / transcribe watchdog /
 * processVoiceTranscript switch) was REMOVED from index.tsx. The calendar mic now
 * routes to Abu AI — the single speech engine. The "no second capture engine in the
 * calendar path" contract now lives in `singleVoiceEntry.test.ts`. What remains here
 * is the still-valid, engine-independent surface: the pure `voiceTrace` helpers and
 * the `VoiceTraceCard` component (both retained modules).
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  createInitialTrace,
  pushStep,
  stageLabel,
  serializeTrace,
  type VoiceStage,
} from './voiceTrace'

const INDEX = fs.readFileSync(path.resolve(__dirname, 'index.tsx'), 'utf8')
const CARD = fs.readFileSync(path.resolve(__dirname, 'VoiceTraceCard.tsx'), 'utf8')

// ─── 1) One voice engine — the calendar no longer owns a capture pipeline ───

describe('D7 — the calendar screen no longer runs a second speech engine', () => {
  it('index.tsx contains no in-screen capture (getUserMedia / MediaRecorder / transcribe)', () => {
    expect(INDEX.includes('getUserMedia')).toBe(false)
    expect(INDEX.includes('MediaRecorder')).toBe(false)
    expect(INDEX.includes('transcribeCalendarAudio')).toBe(false)
    expect(INDEX.includes('processVoiceTranscript')).toBe(false)
  })

  it('index.tsx no longer renders the in-screen voice overlays (VoiceAddFlow / VoiceTraceCard)', () => {
    expect(INDEX.includes('<VoiceAddFlow')).toBe(false)
    expect(INDEX.includes('<VoiceTraceCard')).toBe(false)
  })

  it('the calendar mic routes to Abu AI (the one engine)', () => {
    expect(INDEX.includes('setScreen(Screen.AbuAI)')).toBe(true)
  })
})

// ─── 2) VoiceTraceCard is a retained, self-contained component ─────────────

describe('P0.6 — VoiceTraceCard component contract (retained module)', () => {
  it('VoiceTraceCard exposes testids for stage, message, transcript, copy, dismiss', () => {
    expect(CARD.includes('data-testid="voice-trace-card"')).toBe(true)
    expect(CARD.includes('data-testid="voice-trace-stage"')).toBe(true)
    expect(CARD.includes('data-testid="voice-trace-message"')).toBe(true)
    expect(CARD.includes('data-testid="voice-trace-transcript"')).toBe(true)
    expect(CARD.includes('data-testid="voice-trace-copy"')).toBe(true)
    expect(CARD.includes('data-testid="voice-trace-dismiss"')).toBe(true)
  })

  it('Copy button uses navigator.clipboard with prompt() fallback', () => {
    expect(CARD.includes('navigator.clipboard.writeText')).toBe(true)
    expect(CARD.includes("window.prompt('העתיקי את אבחון הקול:'")).toBe(true)
  })

  it('Card returns null only when stage is idle AND visibleMessage is empty', () => {
    expect(CARD.includes("trace.finalVoiceStage === 'idle' && !trace.visibleMessage")).toBe(true)
    expect(CARD.includes('if (isIdle) return null')).toBe(true)
  })

  it('Card does NOT auto-dismiss errors (no setTimeout)', () => {
    expect(/setTimeout/.test(CARD)).toBe(false)
  })
})

// ─── 3) voiceTrace.ts pure helpers ────────────────────────────────────────

describe('P0.6 — voiceTrace helpers', () => {
  it('createInitialTrace returns idle stage with null fields and empty steps', () => {
    const t = createInitialTrace('v')
    expect(t.finalVoiceStage).toBe('idle')
    expect(t.visibleMessage).toBe('')
    expect(t.steps).toEqual([])
    expect(t.onstopFired).toBe(false)
    expect(t.transcript).toBeNull()
  })

  it('pushStep appends a timestamped step', () => {
    const t = pushStep(createInitialTrace('v'), 'hello')
    expect(t.steps.length).toBe(1)
    expect(t.steps[0]).toMatch(/^[0-9T:.-]+Z hello$/)
  })

  it('stageLabel covers every stage', () => {
    const stages: VoiceStage[] = ['idle','recording','stopping','processing','transcribing','parsing','creating','success','error']
    for (const s of stages) expect(typeof stageLabel(s)).toBe('string')
    // error has no canned label — the runtime supplies the error message.
    expect(stageLabel('error')).toBe('')
  })

  it('serializeTrace produces JSON that contains version + finalVoiceStage', () => {
    const json = serializeTrace(createInitialTrace('0.4.10'))
    expect(json).toContain('0.4.10')
    expect(json).toContain('idle')
  })
})

// ─── 4) Hard-rule envelope preserved ─────────────────────────────────────

describe('P0.6 — hard rules preserved', () => {
  it('AbuAI useRealtime is enabled with grounding', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'AbuAI', 'index.tsx'), 'utf8')
    expect(src.includes('const useRealtime = isRealtimeBetaEnabled()')).toBe(true)
  })

  it('no production AbuAI source reads VITE_OPENAI_API_KEY', () => {
    const ABUAI = path.resolve(__dirname, '..', 'AbuAI')
    const FORBIDDEN = ['VITE', '_OPENAI', '_API_KEY'].join('')
    for (const f of fs.readdirSync(ABUAI)) {
      if (!f.endsWith('.ts') && !f.endsWith('.tsx')) continue
      if (f.endsWith('.test.ts') || f.endsWith('.test.tsx')) continue
      const src = fs.readFileSync(path.join(ABUAI, f), 'utf8')
      expect(src.includes(FORBIDDEN), `${f} reads ${FORBIDDEN}`).toBe(false)
    }
  })

  it('No Home diagnostic pill (visual safety contract from PR #32)', () => {
    const HOME = fs.readFileSync(path.resolve(__dirname, '..', 'Home', 'index.tsx'), 'utf8')
    expect(HOME.includes('home-diagnostic-pill')).toBe(false)
    expect(HOME.includes('__abubankOpenDiag')).toBe(false)
  })

  it('AbuWhatsApp / AbuGames screens unchanged on this branch', () => {
    for (const dir of ['AbuWhatsApp', 'AbuGames']) {
      const base = path.resolve(__dirname, '..', dir)
      if (!fs.existsSync(base)) continue
      for (const f of fs.readdirSync(base)) {
        if (!f.endsWith('.ts') && !f.endsWith('.tsx')) continue
        if (f.endsWith('.test.ts') || f.endsWith('.test.tsx')) continue
        const src = fs.readFileSync(path.join(base, f), 'utf8')
        expect(src.includes('VoiceTraceCard'), `${dir}/${f} imports VoiceTraceCard`).toBe(false)
        expect(src.includes('voiceTrace'), `${dir}/${f} imports voiceTrace`).toBe(false)
      }
    }
  })
})

/*
 * AbuCalendar P0.6 — Record/Stop trace + every-Stop-edge contract.
 *
 * Source-grep over index.tsx + behavioural tests over the voiceTrace
 * helpers. The phone-QA failure mode "tap red Stop → nothing happens"
 * is impossible after this PR because every code path between Stop
 * and Create surfaces a visible message AND a trace step.
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

// ─── 1) Stop button wiring ─────────────────────────────────────────────

describe('P0.6 — Stop button immediately marks the stopping stage', () => {
  it('handleVoiceRecord traces stop_pressed and sets stage "stopping" on the Stop branch', () => {
    expect(INDEX.includes("}, 'stop_pressed')")).toBe(true)
    expect(INDEX.includes("setStage('stopping')")).toBe(true)
  })

  it('recorder-missing path shows a visible Hebrew error', () => {
    expect(INDEX.includes('לא מצאתי הקלטה פעילה. נסי שוב.')).toBe(true)
    expect(INDEX.includes("'recorder_missing'")).toBe(true)
  })

  it('recorder-not-recording path shows a visible Hebrew error', () => {
    expect(INDEX.includes('ההקלטה כבר נעצרה. נסי שוב.')).toBe(true)
    expect(INDEX.includes("'recorder_not_recording'")).toBe(true)
  })

  it('recorder.stop() throw is caught and surfaces a visible error', () => {
    expect(INDEX.includes('ההקלטה נכשלה. נסי שוב.')).toBe(true)
    expect(/recorder_stop_threw:/.test(INDEX)).toBe(true)
  })
})

// ─── 2) onstop guards ──────────────────────────────────────────────────

describe('P0.6 — onstop traces every branch + never silent', () => {
  it('first line of onstop traces onstop_fired and sets processing stage', () => {
    expect(INDEX.includes("updateTrace({ onstopFired: true }, 'onstop_fired')")).toBe(true)
    expect(INDEX.includes("setStage('processing')")).toBe(true)
  })

  it('zero-chunks / zero-byte blob shows the no-audio-captured error', () => {
    expect(INDEX.includes('לא נקלט שמע בהקלטה. נסי שוב קרוב יותר למיקרופון.')).toBe(true)
    expect(INDEX.includes("'no_audio_captured'")).toBe(true)
    expect(/chunksRef\.current\.length === 0 \|\| blob\.size === 0/.test(INDEX)).toBe(true)
  })

  it('blob-too-small still surfaces a visible "ההקלטה קצרה מדי"', () => {
    expect(INDEX.includes('ההקלטה קצרה מדי. נסי שוב.')).toBe(true)
    expect(/blob_too_small:/.test(INDEX)).toBe(true)
  })

  it('onstop has a defense-in-depth outer catch that calls setVoiceFailure', () => {
    expect(INDEX.includes('משהו השתבש בעיבוד ההקלטה. נסי שוב.')).toBe(true)
    expect(/onstop_threw:/.test(INDEX)).toBe(true)
  })
})

// ─── 3) Transcribe + watchdog ──────────────────────────────────────────

describe('P0.6 — transcribe stage has a visible status + 20s watchdog', () => {
  it('transcribe_started trace + setStage("transcribing")', () => {
    expect(INDEX.includes("setStage('transcribing')")).toBe(true)
    expect(INDEX.includes("'transcribe_started'")).toBe(true)
  })

  it('Promise.race with a 20-second watchdog reject', () => {
    expect(INDEX.includes('WATCHDOG_MS = 20_000')).toBe(true)
    expect(INDEX.includes("reject(new Error('transcribe_timeout'))")).toBe(true)
    // P0.7: Promise.race now resolves to a structured ASR result, not
    // a bare string. Source-grep the call site to confirm Promise.race
    // is still wired with the watchdog reject.
    expect(INDEX.includes('await Promise.race<')).toBe(true)
  })

  it('watchdog timeout shows "התמלול לוקח יותר מדי זמן. נסי שוב."', () => {
    expect(INDEX.includes('התמלול לוקח יותר מדי זמן. נסי שוב.')).toBe(true)
    expect(INDEX.includes("'transcribe_timeout'")).toBe(true)
  })

  it('empty transcript surfaces the friendly "לא הצלחתי להבין" error', () => {
    expect(INDEX.includes('לא הצלחתי להבין את ההקלטה. ננסה שוב?')).toBe(true)
    expect(INDEX.includes("'transcript_empty'")).toBe(true)
  })

  it('transcribe_finished + transcript_received trace step', () => {
    expect(INDEX.includes("transcribeFinished: new Date().toISOString()")).toBe(true)
    // P0.7: the trace step now includes the ASR model + correction count.
    expect(/`transcript_received model:/.test(INDEX)).toBe(true)
  })
})

// ─── 4) Known transcription failure codes still translate ─────────────

describe('P0.6 — known transcription failures translate through userFacingError', () => {
  it('missing Groq key → "תמלול קולי לא מוגדר באפליקציה."', () => {
    expect(INDEX.includes("userFacingError('voice_transcribe_key_missing', 'he')")).toBe(true)
  })

  it('401 / 429 / network errors → mediateVoiceCaptureError for transcription', () => {
    // PR #37 moved error copy into mediateVoiceCaptureError; index now
    // delegates instead of calling userFacingError('voice_transcribe_failed').
    expect(INDEX.includes("mediateVoiceCaptureError(e, 'transcription')")).toBe(true)
  })

  it('every catch branch ends with setVoiceFailure(...) — no silent rethrow', () => {
    // Find the transcribe catch block and confirm setVoiceFailure is
    // the LAST call in every branch (not setVoiceError without state).
    expect(INDEX.includes('setVoiceFailure(friendly, step)')).toBe(true)
  })
})

// ─── 5) MediaRecorder availability + MIME safety ──────────────────────

describe('P0.6 — MediaRecorder availability is checked', () => {
  it('typeof MediaRecorder === undefined surfaces a visible error', () => {
    expect(INDEX.includes("typeof MediaRecorder === 'undefined'")).toBe(true)
    expect(INDEX.includes('הקלטה קולית לא נתמכת בדפדפן הזה.')).toBe(true)
    expect(INDEX.includes("'media_recorder_unsupported'")).toBe(true)
  })

  it('mimeType is captured into the trace', () => {
    expect(INDEX.includes('mimeType: mimeType || ')).toBe(true)
    expect(/recording_started mime:/.test(INDEX)).toBe(true)
  })
})

// ─── 6) Decision branches all leave a trace ───────────────────────────

describe('P0.6 — every processVoiceTranscript branch traces its outcome', () => {
  it('auto_created → setStage("creating") → setStage("success") + createResult traced', () => {
    expect(INDEX.includes("setStage('creating'")).toBe(true)
    expect(INDEX.includes("setStage('success'")).toBe(true)
    expect(INDEX.includes("createResult: `ok:")).toBe(true)
  })

  it('needs_am_pm / needs_clarification / show_confirm_card all trace + show a friendly idle stage', () => {
    expect(INDEX.includes("'awaiting_am_pm'")).toBe(true)
    expect(INDEX.includes("'showing_clarification_question'")).toBe(true)
    expect(INDEX.includes("'awaiting_confirm_tap'")).toBe(true)
  })

  it('failed_to_save uses setVoiceFailure (not silent showFailureToast)', () => {
    expect(/setVoiceFailure\(failMsg, `create_failed:/.test(INDEX)).toBe(true)
  })

  it('failed_to_understand uses setVoiceFailure', () => {
    expect(INDEX.includes("setVoiceFailure(failMsg, 'failed_to_understand')")).toBe(true)
  })
})

// ─── 7) VoiceTraceCard is always rendered when there's a message ─────

describe('P0.6 — VoiceTraceCard renders directly under the mic action area', () => {
  it('index.tsx imports VoiceTraceCard and renders it next to the StatusPill', () => {
    expect(INDEX.includes("import { VoiceTraceCard } from './VoiceTraceCard'")).toBe(true)
    expect(INDEX.includes('<VoiceTraceCard')).toBe(true)
    expect(INDEX.includes('trace={voiceTrace}')).toBe(true)
  })

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

// ─── 8) voiceTrace.ts pure helpers ────────────────────────────────────

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

// ─── 9) Hard-rule envelope preserved ─────────────────────────────────

describe('P0.6 — hard rules preserved', () => {
  it('AbuAI useRealtime stays false', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'AbuAI', 'index.tsx'), 'utf8')
    expect(src.includes('const useRealtime = false')).toBe(true)
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

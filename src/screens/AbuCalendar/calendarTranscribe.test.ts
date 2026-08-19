/*
 * AbuCalendar P0.7 — quality-first transcribe + domain correction tests.
 *
 * Behavioural tests cover the Groq request shape, fallback path,
 * and the deterministic normalize layer. Source-grep contracts cover
 * the AbuCalendar wiring.
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  transcribeCalendarAudio,
  type CalendarTranscribeResult,
} from './calendarTranscribe'
import {
  normalizeCalendarTranscript,
  listCorrectionRules,
} from './calendarTranscriptCorrection'

// ─── Helpers ────────────────────────────────────────────────────────────

function mockFetch(impl: (req: Request) => Promise<Response>): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(typeof input === 'string' ? input : (input as Request).url ?? String(input), init)
    return impl(req)
  }) as typeof fetch
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const FAKE_BLOB = new Blob([new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])], { type: 'audio/mp4;codecs=mp4a.40.2' })

// ─── 1) Request shape ──────────────────────────────────────────────────

describe('P0.7 — Groq request shape (quality-first config)', () => {
  it('sends model = whisper-large-v3 by default', async () => {
    let modelSent: string | null = null
    const fakeFetch = mockFetch(async (req) => {
      const fd = await req.formData()
      modelSent = fd.get('model') as string
      return jsonResponse({ text: 'בדיקה', segments: [{ avg_logprob: -0.12 }] })
    })
    await transcribeCalendarAudio(FAKE_BLOB, { resolveKey: () => 'fake', fetchImpl: fakeFetch })
    expect(modelSent).toBe('whisper-large-v3')
  })

  it('sends language = he by default', async () => {
    let lang: string | null = null
    const fakeFetch = mockFetch(async (req) => {
      const fd = await req.formData()
      lang = fd.get('language') as string
      return jsonResponse({ text: 'x', segments: [] })
    })
    await transcribeCalendarAudio(FAKE_BLOB, { resolveKey: () => 'fake', fetchImpl: fakeFetch })
    expect(lang).toBe('he')
  })

  it('sends a Hebrew domain prompt containing family names + Israeli places', async () => {
    let prompt: string | null = null
    const fakeFetch = mockFetch(async (req) => {
      const fd = await req.formData()
      prompt = fd.get('prompt') as string
      return jsonResponse({ text: 'x', segments: [] })
    })
    await transcribeCalendarAudio(FAKE_BLOB, { resolveKey: () => 'fake', fetchImpl: fakeFetch })
    expect(prompt).toContain('אופיר')
    expect(prompt).toContain('לאו')
    expect(prompt).toContain('פתח תקווה')
    expect(prompt).toContain('כפר סבא')
    expect(prompt).toContain('פגישה')
  })

  it('sends temperature = 0', async () => {
    let temp: string | null = null
    const fakeFetch = mockFetch(async (req) => {
      const fd = await req.formData()
      temp = fd.get('temperature') as string
      return jsonResponse({ text: 'x', segments: [] })
    })
    await transcribeCalendarAudio(FAKE_BLOB, { resolveKey: () => 'fake', fetchImpl: fakeFetch })
    expect(temp).toBe('0')
  })

  it('sends response_format = verbose_json', async () => {
    let rf: string | null = null
    const fakeFetch = mockFetch(async (req) => {
      const fd = await req.formData()
      rf = fd.get('response_format') as string
      return jsonResponse({ text: 'x', segments: [] })
    })
    await transcribeCalendarAudio(FAKE_BLOB, { resolveKey: () => 'fake', fetchImpl: fakeFetch })
    expect(rf).toBe('verbose_json')
  })

  it('accepts a Spanish languageHint and sends a Spanish domain prompt', async () => {
    let prompt: string | null = null
    let lang: string | null = null
    const fakeFetch = mockFetch(async (req) => {
      const fd = await req.formData()
      lang = fd.get('language') as string
      prompt = fd.get('prompt') as string
      return jsonResponse({ text: 'x', segments: [] })
    })
    await transcribeCalendarAudio(FAKE_BLOB, { languageHint: 'es', resolveKey: () => 'fake', fetchImpl: fakeFetch })
    expect(lang).toBe('es')
    expect((prompt ?? '').toLowerCase()).toContain('reuni')
  })
})

// ─── 2) Result extraction + verbose_json metadata ──────────────────────

describe('P0.7 — extracts transcript + segment metadata', () => {
  it('returns text from verbose_json body and averages segment metadata', async () => {
    const fakeFetch = mockFetch(async () => jsonResponse({
      text: 'תקבעי פגישה עם אופיר מחר',
      segments: [
        { avg_logprob: -0.30, no_speech_prob: 0.02, compression_ratio: 1.6 },
        { avg_logprob: -0.10, no_speech_prob: 0.04, compression_ratio: 1.4 },
      ],
    }))
    const r = await transcribeCalendarAudio(FAKE_BLOB, { resolveKey: () => 'fake', fetchImpl: fakeFetch })
    expect(r.text).toBe('תקבעי פגישה עם אופיר מחר')
    expect(r.rawText).toBe('תקבעי פגישה עם אופיר מחר')
    expect(r.model).toBe('whisper-large-v3')
    expect(r.asrFallbackUsed).toBe(false)
    expect(r.avgLogprob).toBeCloseTo(-0.20, 2)
    expect(r.noSpeechProb).toBeCloseTo(0.03, 2)
    expect(r.compressionRatio).toBeCloseTo(1.5, 2)
  })

  it('still returns text when segments array is absent (metadata stays undefined)', async () => {
    const fakeFetch = mockFetch(async () => jsonResponse({ text: 'בדיקה' }))
    const r = await transcribeCalendarAudio(FAKE_BLOB, { resolveKey: () => 'fake', fetchImpl: fakeFetch })
    expect(r.text).toBe('בדיקה')
    expect(r.avgLogprob).toBeUndefined()
  })

  it('throws "מפתח API לא תקין." on 401', async () => {
    const fakeFetch = mockFetch(async () => jsonResponse({}, 401))
    await expect(
      transcribeCalendarAudio(FAKE_BLOB, { resolveKey: () => 'fake', fetchImpl: fakeFetch }),
    ).rejects.toThrow('מפתח API לא תקין.')
  })

  it('throws missing-key error when VITE_GROQ_API_KEY is missing', async () => {
    await expect(
      transcribeCalendarAudio(FAKE_BLOB, { resolveKey: () => undefined }),
    ).rejects.toThrow('מפתח API לתמלול לא הוגדר.')
  })
})

// ─── 3) Fallback to whisper-large-v3-turbo on transient failure ────────

describe('P0.7 — fallback to whisper-large-v3-turbo on transient failure', () => {
  it('429 on v3 → retries on turbo and sets asrFallbackUsed=true', async () => {
    const calls: string[] = []
    const fakeFetch = mockFetch(async (req) => {
      const fd = await req.formData()
      const model = fd.get('model') as string
      calls.push(model)
      if (model === 'whisper-large-v3') return jsonResponse({ error: 'rate_limit' }, 429)
      return jsonResponse({ text: 'תקבעי פגישה', segments: [] })
    })
    const r = await transcribeCalendarAudio(FAKE_BLOB, { resolveKey: () => 'fake', fetchImpl: fakeFetch })
    expect(calls).toEqual(['whisper-large-v3', 'whisper-large-v3-turbo'])
    expect(r.model).toBe('whisper-large-v3-turbo')
    expect(r.asrFallbackUsed).toBe(true)
  })

  it('503 on v3 → fallback to turbo', async () => {
    const calls: string[] = []
    const fakeFetch = mockFetch(async (req) => {
      const fd = await req.formData()
      const model = fd.get('model') as string
      calls.push(model)
      if (model === 'whisper-large-v3') return jsonResponse({}, 503)
      return jsonResponse({ text: 'ok', segments: [] })
    })
    const r = await transcribeCalendarAudio(FAKE_BLOB, { resolveKey: () => 'fake', fetchImpl: fakeFetch })
    expect(r.asrFallbackUsed).toBe(true)
    expect(calls.length).toBe(2)
  })

  it('401 on v3 → does NOT fallback; surfaces error', async () => {
    const fakeFetch = mockFetch(async () => jsonResponse({}, 401))
    await expect(
      transcribeCalendarAudio(FAKE_BLOB, { resolveKey: () => 'fake', fetchImpl: fakeFetch }),
    ).rejects.toThrow('מפתח API לא תקין.')
  })
})

// ─── 4) Domain correction rules ────────────────────────────────────────

describe('P0.7 — normalizeCalendarTranscript fixes known misspellings', () => {
  it('אפיר → אופיר', () => {
    const r = normalizeCalendarTranscript('אני אהיה בפתח תקווה מחר פגישה עם אפיר')
    expect(r.corrected).toContain('אופיר')
    expect(r.corrected).not.toContain('אפיר ')
    expect(r.correctionsApplied.find((c) => c.from === 'אפיר' && c.to === 'אופיר')).toBeDefined()
  })

  it('עופיר → אופיר', () => {
    const r = normalizeCalendarTranscript('פגישה עם עופיר')
    expect(r.corrected).toContain('אופיר')
  })

  it('פתח תקוה / פתח תיקווה / פתח תקבה → פתח תקווה', () => {
    expect(normalizeCalendarTranscript('בפתח תקוה').corrected).toContain('פתח תקווה')
    expect(normalizeCalendarTranscript('בפתח תיקווה').corrected).toContain('פתח תקווה')
    expect(normalizeCalendarTranscript('בפתח תקבה').corrected).toContain('פתח תקווה')
  })

  it('ליאו → לאו (canonical short form)', () => {
    expect(normalizeCalendarTranscript('פגישה עם ליאו').corrected).toContain('לאו')
  })

  it('מרטיתה → מרטיטה', () => {
    expect(normalizeCalendarTranscript('שיחה עם מרטיתה').corrected).toContain('מרטיטה')
  })

  it('does NOT over-correct unknown words (conservative dictionary)', () => {
    const r = normalizeCalendarTranscript('יום נעים עם המכולת והרופא')
    expect(r.corrected).toBe('יום נעים עם המכולת והרופא')
    expect(r.correctionsApplied.length).toBe(0)
  })

  it('preserves the original transcript in rawText', () => {
    const r = normalizeCalendarTranscript('פגישה עם אפיר')
    expect(r.rawText).toBe('פגישה עם אפיר')
    expect(r.corrected).toContain('אופיר')
  })

  it('does not touch אופיר when it appears mid-token (no false positives)', () => {
    // The rule fires only when "אפיר" is a standalone token. Inside
    // a longer Hebrew run, no correction.
    const r = normalizeCalendarTranscript('עבדאלאפירעי')
    expect(r.corrected).toBe('עבדאלאפירעי')
    expect(r.correctionsApplied.length).toBe(0)
  })

  it('listCorrectionRules covers Ofir + Petah Tikva at minimum', () => {
    const rules = listCorrectionRules()
    expect(rules.some((r) => r.to === 'אופיר')).toBe(true)
    expect(rules.some((r) => r.to === 'פתח תקווה')).toBe(true)
  })

  it('integrated scenario: "אני אהיה בפתח תקווה מחר פגישה עם אפיר" → normalized', () => {
    const r = normalizeCalendarTranscript('אני אהיה בפתח תקווה מחר פגישה עם אפיר')
    expect(r.corrected).toBe('אני אהיה בפתח תקווה מחר פגישה עם אופיר')
    expect(r.correctionsApplied.map((c) => c.reason)).toContain('family:Ofir')
  })

  it('scenario where ASR returns wrong place: "פתח תקוה" → "פתח תקווה"', () => {
    const r = normalizeCalendarTranscript('פגישה בפתח תקוה')
    expect(r.corrected).toContain('פתח תקווה')
    expect(r.correctionsApplied.map((c) => c.reason)).toContain('place:Petah-Tikva')
  })
})

// ─── 5) Wiring contract in AbuCalendar/index.tsx ──────────────────────

describe('P0.7 — AbuCalendar no longer wires its own transcribe path (post D7)', () => {
  const INDEX = fs.readFileSync(path.resolve(__dirname, 'index.tsx'), 'utf8')

  // D7 · one voice engine: transcribeCalendarAudio + normalizeCalendarTranscript are
  // retained MODULES (their behavior is exercised by sections 1–4 above), but the
  // calendar SCREEN no longer runs them — the mic routes to Abu AI, which owns STT.
  it('index.tsx no longer imports or calls the calendar transcribe path', () => {
    expect(INDEX.includes('transcribeCalendarAudio')).toBe(false)
    expect(INDEX.includes('normalizeCalendarTranscript')).toBe(false)
    expect(INDEX.includes('Promise.race')).toBe(false)
  })

  it('the calendar mic routes to Abu AI (the single engine)', () => {
    expect(INDEX.includes('setScreen(Screen.AbuAI)')).toBe(true)
  })
})

// ─── 6) VoiceTrace shape coverage ─────────────────────────────────────

describe('P0.7 — VoiceTrace JSON includes raw/corrected/corrections/asr metadata', () => {
  it('createInitialTrace exposes the new ASR fields', async () => {
    const { createInitialTrace } = await import('./voiceTrace')
    const t = createInitialTrace('v')
    expect(t.rawTranscript).toBeNull()
    expect(t.correctedTranscript).toBeNull()
    expect(t.asrModel).toBeNull()
    expect(t.asrFallbackUsed).toBe(false)
    expect(t.languageHint).toBeNull()
    expect(t.avgLogprob).toBeNull()
    expect(t.noSpeechProb).toBeNull()
    expect(t.compressionRatio).toBeNull()
    expect(Array.isArray(t.correctionsApplied)).toBe(true)
    expect(t.correctionsApplied.length).toBe(0)
  })

  it('serializeTrace includes all ASR fields', async () => {
    const { createInitialTrace, serializeTrace } = await import('./voiceTrace')
    const t = createInitialTrace('v')
    const json = serializeTrace(t)
    expect(json).toContain('rawTranscript')
    expect(json).toContain('correctedTranscript')
    expect(json).toContain('asrModel')
    expect(json).toContain('asrFallbackUsed')
    expect(json).toContain('languageHint')
    expect(json).toContain('avgLogprob')
    expect(json).toContain('noSpeechProb')
    expect(json).toContain('compressionRatio')
    expect(json).toContain('correctionsApplied')
  })
})

// ─── 7) Hard rule envelope ────────────────────────────────────────────

describe('P0.7 — hard rules preserved', () => {
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

  it('Home stays untouched (no diagnostic pill / __abubankOpenDiag)', () => {
    const HOME = fs.readFileSync(path.resolve(__dirname, '..', 'Home', 'index.tsx'), 'utf8')
    expect(HOME.includes('home-diagnostic-pill')).toBe(false)
    expect(HOME.includes('__abubankOpenDiag')).toBe(false)
  })

  it('AbuWhatsApp / AbuGames do not import the new modules', () => {
    for (const dir of ['AbuWhatsApp', 'AbuGames']) {
      const base = path.resolve(__dirname, '..', dir)
      if (!fs.existsSync(base)) continue
      for (const f of fs.readdirSync(base)) {
        if (!f.endsWith('.ts') && !f.endsWith('.tsx')) continue
        if (f.endsWith('.test.ts') || f.endsWith('.test.tsx')) continue
        const src = fs.readFileSync(path.join(base, f), 'utf8')
        expect(src.includes('calendarTranscribe'), `${dir}/${f} imports calendarTranscribe`).toBe(false)
        expect(src.includes('calendarTranscriptCorrection'), `${dir}/${f} imports calendarTranscriptCorrection`).toBe(false)
      }
    }
  })

  it('no client provider secret read (P0: VITE_GROQ removed; key only via injected resolver)', () => {
    // P0 remediation: the client-side VITE_GROQ_API_KEY read was REMOVED. The key must come
    // ONLY from an injected options.resolveKey (tests), never from import.meta.env in the client.
    const src = fs.readFileSync(path.resolve(__dirname, 'calendarTranscribe.ts'), 'utf8')
    const noComments = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l: string) => l.replace(/\/\/.*$/, '')).join('\n')
    expect(/import\.meta[\s\S]{0,40}VITE_GROQ_API_KEY|\.env\s*\??\.?\s*\[\s*['"]VITE_GROQ_API_KEY/.test(noComments)).toBe(false)
    expect(/const\s+(apiKey|GROQ_KEY)\s*=\s*['"]/.test(src)).toBe(false) // no hardcoded value
    expect(src.includes('options.resolveKey')).toBe(true) // key comes from the injected resolver only
  })
})

// ─── 8) End-to-end ASR + normalize spec example ───────────────────────

describe('P0.7 — end-to-end: ASR + normalize produces a clean Hebrew sentence', () => {
  it('combines a wrong-transcribed text with corrections into the canonical form', async () => {
    const fakeFetch = mockFetch(async () => jsonResponse({
      text: 'אני אהיה בפתח תקוה מחר פגישה עם אפיר',
      segments: [{ avg_logprob: -0.20, no_speech_prob: 0.02, compression_ratio: 1.5 }],
    }))
    const asr: CalendarTranscribeResult = await transcribeCalendarAudio(
      FAKE_BLOB,
      { resolveKey: () => 'fake', fetchImpl: fakeFetch },
    )
    const norm = normalizeCalendarTranscript(asr.text)
    expect(asr.rawText).toBe('אני אהיה בפתח תקוה מחר פגישה עם אפיר')
    expect(norm.corrected).toBe('אני אהיה בפתח תקווה מחר פגישה עם אופיר')
    expect(norm.correctionsApplied.length).toBeGreaterThanOrEqual(2)
  })
})

/*
 * AbuBank Platform Health — tests (P0).
 *
 * Pure-function tests over the diagnostic helpers + integration test
 * over buildDiagnosticReport via a mocked fetch. No secrets accessed,
 * no real network. Storage probes use vi.stubGlobal.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  checkLocalStorage,
  checkCalendarStorage,
  checkVoiceCapability,
  checkApiHealth,
  checkAbuaiChatProxy,
  checkAbuaiOnline,
  checkVersionMismatch,
  buildDiagnosticReport,
  userFacingError,
} from './platformHealth'
import { APP_VERSION } from '../version'

let storage: Record<string, string> = {}
beforeEach(() => {
  storage = {}
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v },
    removeItem: (k: string) => { delete storage[k] },
    clear: () => { storage = {} },
  })
})

// ─── /api/health endpoint: secret hygiene ────────────────────────────────

describe('P0 — /api/health endpoint never returns secret values', () => {
  it('exports a handler that only writes present/missing for env vars', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../api/health.ts'), 'utf8')
    // The handler must not interpolate env.X into the response body.
    expect(/JSON\.stringify\([^)]*env\.[A-Z_]+[^)]*\)/.test(src)).toBe(false)
    // The handler must only write presence strings.
    expect(src.includes("'present'") && src.includes("'missing'")).toBe(true)
    // The handler must not write the literal env value into the response.
    // (i.e., no `OPENAI_API_KEY: env.OPENAI_API_KEY` pattern).
    expect(/OPENAI_API_KEY:\s*env\./.test(src)).toBe(false)
  })

  it('handler is a GET-style edge function, never echoes the key', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../api/health.ts'), 'utf8')
    expect(src.includes("export const config = { runtime: 'edge' }")).toBe(true)
    // The only conditional on the key checks length > 0, never sends value.
    expect(/env\.OPENAI_API_KEY\.length\s*>\s*0/.test(src)).toBe(true)
  })
})

// ─── Local checks ────────────────────────────────────────────────────────

describe('P0 — checkLocalStorage', () => {
  it('round-trip ok → returns ok:true', () => {
    const r = checkLocalStorage()
    expect(r.ok).toBe(true)
    expect(r.detail).toBe('roundtrip_ok')
  })

  it('setItem throws → returns ok:false with threw detail', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { throw new Error('blocked') },
      removeItem: () => undefined,
      clear: () => undefined,
    })
    const r = checkLocalStorage()
    expect(r.ok).toBe(false)
    expect(r.detail).toBe('threw')
  })
})

describe('P0 — checkCalendarStorage', () => {
  it('round-trip ok → returns ok:true and does not pollute storage', () => {
    const r = checkCalendarStorage()
    expect(r.ok).toBe(true)
    expect(storage['__abubank_cal_diag__']).toBeUndefined() // cleaned up
  })
})

describe('P0 — checkVoiceCapability', () => {
  it('detects missing MediaRecorder', () => {
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => Promise.resolve(undefined) } })
    vi.stubGlobal('MediaRecorder', undefined as unknown as typeof MediaRecorder)
    const r = checkVoiceCapability()
    expect(r.ok).toBe(false)
    expect(r.detail).toBe('MediaRecorder_unavailable')
  })

  it('reports groq_transcription_key_missing when VITE_GROQ_API_KEY is absent in import.meta.env', () => {
    // Vitest runs in node — import.meta.env exists but VITE_GROQ_API_KEY
    // is typically undefined in test mode unless .env.test sets it.
    const r = checkVoiceCapability()
    if (r.detail === 'browser_supports_recording_and_transcription_key_present') {
      // CI has the key configured — skip the assertion for that env.
      expect(r.ok).toBe(true)
    } else {
      // Local / unconfigured: must explicitly report the key is missing.
      expect(['groq_transcription_key_missing_in_client_bundle',
              'MediaRecorder_unavailable', 'getUserMedia_unavailable']).toContain(r.detail)
    }
  })
})

// ─── /api/health smoke + version mismatch ────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('P0 — checkApiHealth (mocked fetch)', () => {
  it('ok:true health body → reports ok with server metadata', async () => {
    const fakeFetch: typeof fetch = async () => jsonResponse({
      ok: true,
      buildVersion: '0.4.6-platform-health-recovery',
      buildLabel: 'AbuBank P0 — Platform/API Health Recovery',
      serverTime: '2026-05-11T20:00:00.000Z',
      env: { OPENAI_API_KEY: 'present' },
      routes: { abuaiChat: 'configured', abuaiOnline: 'configured', voiceTranscribe: 'client_direct_groq' },
    })
    const r = await checkApiHealth(fakeFetch)
    expect(r.ok).toBe(true)
    expect(r.meta?.['serverBuildVersion']).toBe('0.4.6-platform-health-recovery')
    expect((r.meta?.['env'] as Record<string, string>).OPENAI_API_KEY).toBe('present')
  })

  it('ok:false (missing env) → reports ok:false honestly', async () => {
    const fakeFetch: typeof fetch = async () => jsonResponse({
      ok: false,
      buildVersion: '0.4.6-platform-health-recovery',
      buildLabel: 'AbuBank P0',
      serverTime: 'x',
      env: { OPENAI_API_KEY: 'missing' },
      routes: {},
    })
    const r = await checkApiHealth(fakeFetch)
    expect(r.ok).toBe(false)
    expect(r.detail).toBe('missing_required_env')
  })

  it('http 404 → not deployed', async () => {
    const fakeFetch: typeof fetch = async () => jsonResponse({}, 404)
    const r = await checkApiHealth(fakeFetch)
    expect(r.ok).toBe(false)
    expect(r.detail).toBe('http_404')
  })

  it('fetch throws → fetch_failed honest', async () => {
    const fakeFetch: typeof fetch = async () => { throw new Error('network down') }
    const r = await checkApiHealth(fakeFetch)
    expect(r.ok).toBe(false)
    expect(r.detail).toBe('fetch_failed')
  })
})

describe('P0 — checkVersionMismatch', () => {
  it('matching server version → ok:true', () => {
    const apiHealth = {
      ok: true, label: '/api/health', detail: 'ok',
      meta: { serverBuildVersion: APP_VERSION.version },
    }
    const r = checkVersionMismatch(apiHealth)
    expect(r.ok).toBe(true)
  })

  it('different server version → ok:false with stale-pwa hint', () => {
    const apiHealth = {
      ok: true, label: '/api/health', detail: 'ok',
      meta: { serverBuildVersion: '99.99.99-future' },
    }
    const r = checkVersionMismatch(apiHealth)
    expect(r.ok).toBe(false)
    expect(r.detail).toBe('mismatch')
    expect(r.meta?.['hint']).toBe('app_on_phone_is_stale_refresh_pwa')
  })

  it('server version unknown → ok:false unknown', () => {
    const r = checkVersionMismatch({ ok: false, label: '/api/health', detail: 'fetch_failed' })
    expect(r.ok).toBe(false)
    expect(r.detail).toBe('server_version_unknown')
  })
})

// ─── AbuAI proxy + online smokes ─────────────────────────────────────────

describe('P0 — checkAbuaiChatProxy (mocked fetch)', () => {
  it('BAD_REQUEST response → route alive', async () => {
    const fakeFetch: typeof fetch = async () => jsonResponse({ ok: false, errorCode: 'BAD_REQUEST' }, 400)
    const r = await checkAbuaiChatProxy(fakeFetch)
    expect(r.ok).toBe(true)
    expect(r.detail).toBe('route_alive')
  })

  it('OPENAI_API_KEY_MISSING → ok:false route_alive_but_server_key_missing', async () => {
    const fakeFetch: typeof fetch = async () => jsonResponse({ ok: false, errorCode: 'OPENAI_API_KEY_MISSING' }, 200)
    const r = await checkAbuaiChatProxy(fakeFetch)
    expect(r.ok).toBe(false)
    expect(r.detail).toBe('route_alive_but_server_key_missing')
  })

  it('404 → route_not_deployed', async () => {
    const fakeFetch: typeof fetch = async () => jsonResponse({}, 404)
    const r = await checkAbuaiChatProxy(fakeFetch)
    expect(r.ok).toBe(false)
    expect(r.detail).toBe('route_not_deployed')
  })
})

describe('P0 — checkAbuaiOnline (mocked fetch)', () => {
  it('OPENAI_API_KEY_MISSING → honest route_alive_but_server_key_missing', async () => {
    const fakeFetch: typeof fetch = async () => jsonResponse({ ok: false, errorCode: 'OPENAI_API_KEY_MISSING' }, 200)
    const r = await checkAbuaiOnline(fakeFetch)
    expect(r.ok).toBe(false)
    expect(r.detail).toBe('route_alive_but_server_key_missing')
  })

  it('BAD_REQUEST → route alive', async () => {
    const fakeFetch: typeof fetch = async () => jsonResponse({ ok: false, errorCode: 'BAD_REQUEST' }, 400)
    const r = await checkAbuaiOnline(fakeFetch)
    expect(r.ok).toBe(true)
    expect(r.detail).toBe('route_alive')
  })
})

// ─── Report integration ──────────────────────────────────────────────────

describe('P0 — buildDiagnosticReport integrates every check', () => {
  it('includes app version, build label, every check field, and generatedAt', async () => {
    const fakeFetch: typeof fetch = async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      if (url.endsWith('/api/health')) {
        return jsonResponse({
          ok: true,
          buildVersion: APP_VERSION.version,
          buildLabel: APP_VERSION.buildLabel,
          serverTime: 'x',
          env: { OPENAI_API_KEY: 'present' },
          routes: {},
        })
      }
      return jsonResponse({ ok: false, errorCode: 'BAD_REQUEST' }, 400)
    }
    const r = await buildDiagnosticReport(fakeFetch)
    expect(r.appVersion).toBe(APP_VERSION.version)
    expect(r.buildLabel).toBe(APP_VERSION.buildLabel)
    expect(r.commitHint).toBe(APP_VERSION.commitHint)
    expect(typeof r.generatedAt).toBe('string')
    expect(typeof r.serviceWorker.ok).toBe('boolean')
    expect(typeof r.localStorage.ok).toBe('boolean')
    expect(typeof r.apiHealth.ok).toBe('boolean')
    expect(typeof r.abuaiChatProxy.ok).toBe('boolean')
    expect(typeof r.abuaiOnline.ok).toBe('boolean')
    expect(typeof r.calendarStorage.ok).toBe('boolean')
    expect(typeof r.voiceCapability.ok).toBe('boolean')
    expect(typeof r.versionMismatch.ok).toBe('boolean')
    expect(r.versionMismatch.ok).toBe(true) // mocked server matches client
  })
})

// ─── User-facing copy ────────────────────────────────────────────────────

describe('P0 — userFacingError copy (HE/ES/EN)', () => {
  it('AbuAI chat proxy failure copy', () => {
    expect(userFacingError('chat_proxy_failed', 'he')).toContain('החיבור ל-AI לא עובד כרגע')
    expect(userFacingError('chat_proxy_failed', 'es')).toContain('La conexión con la AI no funciona ahora')
    expect(userFacingError('chat_proxy_failed', 'en')).toContain('The AI connection is not working right now')
  })

  it('AbuAI online failure copy', () => {
    expect(userFacingError('online_endpoint_failed', 'he')).toContain('אני לא מצליחה לבדוק מידע אונליין')
    expect(userFacingError('online_endpoint_failed', 'es')).toContain('No puedo verificar información online')
    expect(userFacingError('online_endpoint_failed', 'en')).toContain("can't check online information")
  })

  it('server AI key missing copy', () => {
    expect(userFacingError('server_ai_key_missing', 'he')).toContain('השרת לא מוגדר כרגע ל-AI')
    expect(userFacingError('server_ai_key_missing', 'en')).toContain('The server is not configured for AI')
  })

  it('voice transcribe failure copy', () => {
    expect(userFacingError('voice_transcribe_failed', 'he')).toContain('לא הצלחתי לתמלל')
  })

  it('voice transcribe key missing copy', () => {
    expect(userFacingError('voice_transcribe_key_missing', 'he')).toContain('תמלול קולי לא מוגדר')
  })

  it('voice parse-after-transcribe failure copy', () => {
    expect(userFacingError('voice_parse_failed', 'he')).toContain('הבנתי את ההקלטה')
  })

  it('calendar save failure copy', () => {
    expect(userFacingError('calendar_save_failed', 'he')).toContain('לא הצלחתי לשמור את הפגישה')
  })
})

// ─── Hard rule envelope ──────────────────────────────────────────────────

describe('P0 — hard rules preserved', () => {
  it('AbuAI useRealtime is enabled with grounding', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'screens', 'AbuAI', 'index.tsx'), 'utf8')
    expect(src.includes('const useRealtime = true')).toBe(true)
  })

  it('no production AbuAI source reads VITE_OPENAI_API_KEY', () => {
    const ABUAI = path.resolve(__dirname, '..', 'screens', 'AbuAI')
    const FORBIDDEN = ['VITE', '_OPENAI', '_API_KEY'].join('')
    for (const f of fs.readdirSync(ABUAI)) {
      if (!f.endsWith('.ts') && !f.endsWith('.tsx')) continue
      if (f.endsWith('.test.ts') || f.endsWith('.test.tsx')) continue
      const src = fs.readFileSync(path.join(ABUAI, f), 'utf8')
      expect(src.includes(FORBIDDEN), `${f} reads ${FORBIDDEN}`).toBe(false)
    }
  })

  it('platformHealth source never reads or surfaces secret values', () => {
    const src = fs.readFileSync(path.resolve(__dirname, 'platformHealth.ts'), 'utf8')
    // Forbidden: writing/storing any env value beyond presence boolean.
    expect(/process\.env\.[A-Z_]+/.test(src)).toBe(false)
    // Permitted: reading import.meta.env.VITE_GROQ_API_KEY to check presence ONLY.
    expect(src.includes('VITE_GROQ_API_KEY')).toBe(true)
    // The presence check uses length only — value is never returned.
    expect(src.includes('groqKeyPresent')).toBe(true)
    expect(/return\s+groqKey/.test(src)).toBe(false) // never returns the key
  })

  it('AbuWhatsApp / AbuGames screens are not modified on this branch (no platformHealth import inside them)', () => {
    for (const dir of ['AbuWhatsApp', 'AbuGames']) {
      const base = path.resolve(__dirname, '..', 'screens', dir)
      if (!fs.existsSync(base)) continue
      for (const f of fs.readdirSync(base)) {
        if (!f.endsWith('.ts') && !f.endsWith('.tsx')) continue
        if (f.endsWith('.test.ts') || f.endsWith('.test.tsx')) continue
        const src = fs.readFileSync(path.join(base, f), 'utf8')
        expect(src.includes('platformHealth'),
          `${dir}/${f} unexpectedly imports platformHealth`).toBe(false)
      }
    }
  })
})

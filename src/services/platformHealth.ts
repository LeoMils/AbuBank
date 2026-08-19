/*
 * AbuBank Platform Health — client-side diagnostic helpers (P0).
 *
 * Every helper returns a structured result so the diagnostic panel can
 * render pass/fail + reason without inventing status. No secrets are
 * read or surfaced.
 *
 * Truth Contract:
 *  • A check returns ok:true only if the real underlying operation
 *    succeeded.
 *  • Storage tests never pollute user data — they use a private key
 *    prefix and clean up after themselves.
 *  • API smoke tests use a hard timeout so a hung network does not
 *    freeze the panel.
 *
 * Pure module (no React, no global state mutation).
 */

import { APP_VERSION } from '../version'

const SMOKE_TIMEOUT_MS = 8000

export interface HealthCheckResult {
  ok: boolean
  label: string
  detail: string
  meta?: Record<string, unknown>
}

export interface DiagnosticReport {
  appVersion: string
  buildLabel: string
  buildDate: string
  commitHint: string
  branchHint: string
  generatedAt: string
  serviceWorker: HealthCheckResult
  localStorage: HealthCheckResult
  apiHealth: HealthCheckResult
  abuaiChatProxy: HealthCheckResult
  abuaiOnline: HealthCheckResult
  calendarStorage: HealthCheckResult
  voiceCapability: HealthCheckResult
  versionMismatch: HealthCheckResult
}

// ─── 1) Service worker presence + control ─────────────────────────────────

export async function checkServiceWorker(): Promise<HealthCheckResult> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return { ok: false, label: 'Service Worker', detail: 'not_supported_in_this_browser' }
  }
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return { ok: false, label: 'Service Worker', detail: 'no_registration' }
    const state = reg.active?.state ?? 'unknown'
    return {
      ok: state === 'activated',
      label: 'Service Worker',
      detail: state,
      meta: { scope: reg.scope, waitingPresent: !!reg.waiting, installingPresent: !!reg.installing },
    }
  } catch (err) {
    return { ok: false, label: 'Service Worker', detail: 'getRegistration_threw', meta: { error: errMsg(err) } }
  }
}

// ─── 2) localStorage read/write probe ─────────────────────────────────────

const DIAG_LS_KEY = '__abubank_health_diag__'

export function checkLocalStorage(): HealthCheckResult {
  if (typeof localStorage === 'undefined') {
    return { ok: false, label: 'localStorage', detail: 'not_available' }
  }
  try {
    const probe = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem(DIAG_LS_KEY, probe)
    const read = localStorage.getItem(DIAG_LS_KEY)
    localStorage.removeItem(DIAG_LS_KEY)
    if (read !== probe) {
      return { ok: false, label: 'localStorage', detail: 'roundtrip_mismatch' }
    }
    return { ok: true, label: 'localStorage', detail: 'roundtrip_ok' }
  } catch (err) {
    return { ok: false, label: 'localStorage', detail: 'threw', meta: { error: errMsg(err) } }
  }
}

// ─── 3) /api/health smoke + version-mismatch detector ─────────────────────

interface HealthApiBody {
  ok: boolean
  buildVersion: string
  buildLabel: string
  serverTime: string
  env: Record<string, 'present' | 'missing'>
  routes: Record<string, string>
}

export async function checkApiHealth(fetchImpl?: typeof fetch): Promise<HealthCheckResult> {
  const f = fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : null)
  if (!f) return { ok: false, label: '/api/health', detail: 'no_fetch_in_runtime' }
  try {
    const res = await withTimeout(f('/api/health', { method: 'GET', cache: 'no-store' }), SMOKE_TIMEOUT_MS)
    if (!res.ok) return { ok: false, label: '/api/health', detail: `http_${res.status}` }
    const body = (await res.json()) as HealthApiBody
    return {
      ok: body.ok,
      label: '/api/health',
      detail: body.ok ? 'all_required_env_present' : 'missing_required_env',
      meta: {
        serverBuildVersion: body.buildVersion,
        serverBuildLabel: body.buildLabel,
        env: body.env,
        routes: body.routes,
      },
    }
  } catch (err) {
    return { ok: false, label: '/api/health', detail: 'fetch_failed', meta: { error: errMsg(err) } }
  }
}

export function checkVersionMismatch(apiHealth: HealthCheckResult): HealthCheckResult {
  const serverVersion = apiHealth.meta && typeof apiHealth.meta['serverBuildVersion'] === 'string'
    ? (apiHealth.meta['serverBuildVersion'] as string)
    : null
  if (!serverVersion) {
    return { ok: false, label: 'Version Match', detail: 'server_version_unknown' }
  }
  const clientVersion = APP_VERSION.version
  if (clientVersion === serverVersion) {
    return { ok: true, label: 'Version Match', detail: 'client_and_server_match', meta: { clientVersion, serverVersion } }
  }
  return {
    ok: false,
    label: 'Version Match',
    detail: 'mismatch',
    meta: { clientVersion, serverVersion, hint: 'app_on_phone_is_stale_refresh_pwa' },
  }
}

// ─── 4) AbuAI chat proxy smoke ────────────────────────────────────────────

export async function checkAbuaiChatProxy(fetchImpl?: typeof fetch): Promise<HealthCheckResult> {
  const f = fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : null)
  if (!f) return { ok: false, label: 'AbuAI Chat Proxy', detail: 'no_fetch_in_runtime' }
  try {
    // Minimal POST with BAD_REQUEST-triggering body. The endpoint validates
    // the `body` field is an object; we send an empty payload that the
    // server rejects with 400 BAD_REQUEST. That proves the route exists
    // AND the proxy code is running, without burning OpenAI tokens.
    const res = await withTimeout(
      f('/api/abuai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        cache: 'no-store',
      }),
      SMOKE_TIMEOUT_MS,
    )
    // 400 BAD_REQUEST or 200 with the OPENAI_API_KEY_MISSING shape both
    // prove the proxy itself is alive. 404 / 500 / network fail = bad.
    if (res.status === 404) return { ok: false, label: 'AbuAI Chat Proxy', detail: 'route_not_deployed' }
    if (res.status === 405) return { ok: false, label: 'AbuAI Chat Proxy', detail: 'method_not_allowed' }
    let json: { ok?: boolean; errorCode?: string } = {}
    try { json = (await res.json()) as typeof json } catch { /* non-json */ }
    if (json.errorCode === 'OPENAI_API_KEY_MISSING') {
      return { ok: false, label: 'AbuAI Chat Proxy', detail: 'route_alive_but_server_key_missing' }
    }
    if (json.errorCode === 'BAD_REQUEST') {
      return { ok: true, label: 'AbuAI Chat Proxy', detail: 'route_alive' }
    }
    return { ok: res.status === 200, label: 'AbuAI Chat Proxy', detail: `http_${res.status}` }
  } catch (err) {
    return { ok: false, label: 'AbuAI Chat Proxy', detail: 'fetch_failed', meta: { error: errMsg(err) } }
  }
}

// ─── 5) AbuAI online endpoint smoke ───────────────────────────────────────

export async function checkAbuaiOnline(fetchImpl?: typeof fetch): Promise<HealthCheckResult> {
  const f = fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : null)
  if (!f) return { ok: false, label: 'AbuAI Online', detail: 'no_fetch_in_runtime' }
  try {
    // Same trick — send an empty payload to trigger BAD_REQUEST without
    // hitting the upstream OpenAI search.
    const res = await withTimeout(
      f('/api/abuai-online', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        cache: 'no-store',
      }),
      SMOKE_TIMEOUT_MS,
    )
    if (res.status === 404) return { ok: false, label: 'AbuAI Online', detail: 'route_not_deployed' }
    let json: { ok?: boolean; errorCode?: string } = {}
    try { json = (await res.json()) as typeof json } catch { /* non-json */ }
    if (json.errorCode === 'OPENAI_API_KEY_MISSING') {
      return { ok: false, label: 'AbuAI Online', detail: 'route_alive_but_server_key_missing' }
    }
    if (json.errorCode === 'BAD_REQUEST') {
      return { ok: true, label: 'AbuAI Online', detail: 'route_alive' }
    }
    return { ok: res.status === 200, label: 'AbuAI Online', detail: `http_${res.status}` }
  } catch (err) {
    return { ok: false, label: 'AbuAI Online', detail: 'fetch_failed', meta: { error: errMsg(err) } }
  }
}

// ─── 6) Calendar storage smoke (write/read/delete diagnostic key) ────────

const CAL_DIAG_KEY = '__abubank_cal_diag__'

export function checkCalendarStorage(): HealthCheckResult {
  if (typeof localStorage === 'undefined') {
    return { ok: false, label: 'Calendar Storage', detail: 'localStorage_unavailable' }
  }
  try {
    const fake = JSON.stringify([{ id: `diag-${Date.now()}`, title: 'diagnostic', date: '2000-01-01', time: '00:00', emoji: '📅' }])
    localStorage.setItem(CAL_DIAG_KEY, fake)
    const read = localStorage.getItem(CAL_DIAG_KEY)
    localStorage.removeItem(CAL_DIAG_KEY)
    if (read !== fake) return { ok: false, label: 'Calendar Storage', detail: 'roundtrip_mismatch' }
    return { ok: true, label: 'Calendar Storage', detail: 'write_read_delete_ok' }
  } catch (err) {
    return { ok: false, label: 'Calendar Storage', detail: 'threw', meta: { error: errMsg(err) } }
  }
}

// ─── 7) Voice / transcription capability ─────────────────────────────────

export function checkVoiceCapability(): HealthCheckResult {
  const hasMediaDevices = typeof navigator !== 'undefined' && !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia
  const hasMediaRecorder = typeof MediaRecorder !== 'undefined'
  // STT is now SERVER-SIDE (/api/abuai-stt, OPENAI_API_KEY server-only) — there is NO client
  // provider key. Capability depends only on the browser being able to record; STT-provider
  // availability is covered by checkApiHealth (server OPENAI_API_KEY). (P0: zero client secrets.)
  const ok = hasMediaDevices && hasMediaRecorder
  let detail: string
  if (!hasMediaDevices) detail = 'getUserMedia_unavailable'
  else if (!hasMediaRecorder) detail = 'MediaRecorder_unavailable'
  else detail = 'browser_supports_recording; STT via server proxy (/api/abuai-stt)'
  return { ok, label: 'Voice Capability', detail, meta: { hasMediaDevices, hasMediaRecorder } }
}

// ─── Report builder ──────────────────────────────────────────────────────

export async function buildDiagnosticReport(fetchImpl?: typeof fetch): Promise<DiagnosticReport> {
  const apiHealth = await checkApiHealth(fetchImpl)
  const [serviceWorker, abuaiChatProxy, abuaiOnline] = await Promise.all([
    checkServiceWorker(),
    checkAbuaiChatProxy(fetchImpl),
    checkAbuaiOnline(fetchImpl),
  ])
  return {
    appVersion: APP_VERSION.version,
    buildLabel: APP_VERSION.buildLabel,
    buildDate: APP_VERSION.buildDate,
    commitHint: APP_VERSION.commitHint,
    branchHint: APP_VERSION.branchHint,
    generatedAt: new Date().toISOString(),
    serviceWorker,
    localStorage: checkLocalStorage(),
    apiHealth,
    abuaiChatProxy,
    abuaiOnline,
    calendarStorage: checkCalendarStorage(),
    voiceCapability: checkVoiceCapability(),
    versionMismatch: checkVersionMismatch(apiHealth),
  }
}

// ─── Service-worker force-refresh helper ─────────────────────────────────

export async function forceRefreshServiceWorker(): Promise<HealthCheckResult> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return { ok: false, label: 'Force Refresh', detail: 'no_sw_support' }
  }
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (reg) await reg.unregister()
    if (typeof caches !== 'undefined') {
      const names = await caches.keys()
      await Promise.all(names.map((n) => caches.delete(n)))
    }
    return { ok: true, label: 'Force Refresh', detail: 'sw_unregistered_caches_cleared' }
  } catch (err) {
    return { ok: false, label: 'Force Refresh', detail: 'threw', meta: { error: errMsg(err) } }
  }
}

// ─── User-facing error copy (Phase 5) ────────────────────────────────────

export type ErrorCode =
  | 'chat_proxy_failed'
  | 'online_endpoint_failed'
  | 'server_ai_key_missing'
  | 'voice_transcribe_failed'
  | 'voice_transcribe_key_missing'
  | 'voice_parse_failed'
  | 'calendar_save_failed'

export function userFacingError(code: ErrorCode, lang: 'he' | 'es' | 'en' = 'he'): string {
  if (lang === 'es') {
    switch (code) {
      case 'chat_proxy_failed':             return 'La conexión con la AI no funciona ahora. Hay que revisar el servidor.'
      case 'online_endpoint_failed':        return 'No puedo verificar información online ahora.'
      case 'server_ai_key_missing':         return 'El servidor no está configurado para AI.'
      case 'voice_transcribe_failed':       return 'No pude transcribir la grabación ahora.'
      case 'voice_transcribe_key_missing':  return 'La transcripción de voz no está configurada en esta app.'
      case 'voice_parse_failed':            return 'Entendí la grabación, pero me falta un dato.'
      case 'calendar_save_failed':          return 'No pude guardar la reunión ahora.'
    }
  }
  if (lang === 'en') {
    switch (code) {
      case 'chat_proxy_failed':             return 'The AI connection is not working right now. The server needs to be checked.'
      case 'online_endpoint_failed':        return "I can't check online information right now."
      case 'server_ai_key_missing':         return 'The server is not configured for AI right now.'
      case 'voice_transcribe_failed':       return "I couldn't transcribe the recording right now."
      case 'voice_transcribe_key_missing':  return 'Voice transcription is not configured in this app.'
      case 'voice_parse_failed':            return "I understood the recording, but I'm missing a detail."
      case 'calendar_save_failed':          return "I couldn't save the meeting right now."
    }
  }
  switch (code) {
    case 'chat_proxy_failed':             return 'החיבור ל-AI לא עובד כרגע. צריך לבדוק את השרת.'
    case 'online_endpoint_failed':        return 'אני לא מצליחה לבדוק מידע אונליין כרגע.'
    case 'server_ai_key_missing':         return 'השרת לא מוגדר כרגע ל-AI.'
    case 'voice_transcribe_failed':       return 'לא הצלחתי לתמלל את ההקלטה כרגע.'
    case 'voice_transcribe_key_missing':  return 'תמלול קולי לא מוגדר באפליקציה.'
    case 'voice_parse_failed':            return 'הבנתי את ההקלטה, אבל חסר לי פרט.'
    case 'calendar_save_failed':          return 'לא הצלחתי לשמור את הפגישה כרגע.'
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    p.then((v) => { clearTimeout(t); resolve(v) }).catch((e) => { clearTimeout(t); reject(e instanceof Error ? e : new Error(String(e))) })
  })
}

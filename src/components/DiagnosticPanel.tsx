/*
 * AbuBank diagnostic panel (P0.3 — always-visible).
 *
 * Renders the title, version, build label, commit hint, and three-row
 * summary IMMEDIATELY — before any async health check completes. The
 * copy and force-refresh buttons always work even if /api/health is
 * unreachable.
 *
 * No secrets are read or rendered. Only presence flags and route
 * status. The "force refresh" button is gated behind a confirmation.
 */

import { useEffect, useState } from 'react'
import {
  buildDiagnosticReport,
  forceRefreshServiceWorker,
  checkLocalStorage,
  type DiagnosticReport,
  type HealthCheckResult,
} from '../services/platformHealth'
import { APP_VERSION } from '../version'

const PASS = '#34D399'
const FAIL = '#FB7185'
const PENDING = '#9CA3AF'
const NEUTRAL = 'rgba(255,255,255,0.55)'

function Row({ result, pending }: { result: HealthCheckResult; pending?: boolean }) {
  const color = pending ? PENDING : result.ok ? PASS : FAIL
  return (
    <div
      data-testid={`diag-row-${slug(result.label)}`}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, padding: '10px 0',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        fontFamily: "'Heebo','DM Sans',sans-serif",
      }}
    >
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>{result.label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: NEUTRAL, direction: 'ltr' }}>{pending ? 'בודק…' : result.detail}</span>
        <span style={{
          minWidth: 12, height: 12, borderRadius: 6, background: color, flexShrink: 0,
        }} />
      </div>
    </div>
  )
}

function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function safeUserAgent(): string {
  try { return (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '' } catch { return '' }
}
function safeUrl(): string {
  try { return (typeof window !== 'undefined' ? window.location.href : '') || '' } catch { return '' }
}

/** Build a minimal report shape for the copy button when the full
 *  async report is not yet available. No secrets, only context. */
function partialReportJson(report: DiagnosticReport | null, fetchError: string | null): string {
  const ls = checkLocalStorage()
  const obj = {
    appVersion: APP_VERSION.version,
    buildLabel: APP_VERSION.buildLabel,
    buildDate: APP_VERSION.buildDate,
    commitHint: APP_VERSION.commitHint,
    branchHint: APP_VERSION.branchHint,
    capturedAt: new Date().toISOString(),
    url: safeUrl(),
    userAgent: safeUserAgent(),
    serviceWorkerSupported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    localStorage: ls,
    apiHealthFetchError: fetchError,
    fullReport: report,
  }
  return JSON.stringify(obj, null, 2)
}

export function DiagnosticPanel() {
  const [report, setReport] = useState<DiagnosticReport | null>(null)
  const [running, setRunning] = useState(true)
  const [copied, setCopied] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  async function runAll() {
    setRunning(true)
    setCopied(false)
    setFetchError(null)
    try {
      const r = await buildDiagnosticReport()
      setReport(r)
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
    }
  }

  useEffect(() => { void runAll() }, [])

  async function copyReport() {
    const json = partialReportJson(report, fetchError)
    let ok = false
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(json)
        ok = true
      }
    } catch { /* clipboard unavailable */ }
    if (!ok && typeof window !== 'undefined') {
      // Fallback — open a prompt the user can copy from.
      try { window.prompt('העתיקי את האבחון:', json) } catch { /* nothing */ }
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2200)
  }

  async function handleForceRefresh() {
    const okConfirm = typeof window !== 'undefined' ? window.confirm('לרענן את האפליקציה? זה ימחק קאש מקומי ויטען מחדש.') : true
    if (!okConfirm) return
    let result: HealthCheckResult
    try {
      result = await forceRefreshServiceWorker()
    } catch (err) {
      result = { ok: false, label: 'Force Refresh', detail: 'threw_in_caller', meta: { error: err instanceof Error ? err.message : String(err) } }
    }
    setRefreshMsg(result.ok ? 'הקאש נוקה. רענני את הדף.' : `שגיאה: ${result.detail}. מרענן בכל זאת…`)
    // Even if SW unregister failed, force a reload — that's the user's intent.
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        try { window.location.reload() } catch { /* nothing */ }
      }, result.ok ? 1500 : 2500)
    }
  }

  // ── Always-visible header summary ────────────────────────────────────
  const summary = {
    server: report?.apiHealth.ok ?? null,
    voice: report?.voiceCapability.ok ?? null,
    calendar: report?.calendarStorage.ok ?? null,
  }
  function summaryText(ok: boolean | null): string {
    if (ok === null) return 'בודק…'
    return ok ? 'תקין' : 'בעיה'
  }
  function summaryColor(ok: boolean | null): string {
    if (ok === null) return PENDING
    return ok ? PASS : FAIL
  }

  return (
    <div data-testid="diagnostic-panel" dir="rtl" style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      fontFamily: "'Heebo','DM Sans',sans-serif",
    }}>
      {/* Title + identity always visible */}
      <div data-testid="diag-title" style={{ fontSize: 18, fontWeight: 800, color: 'white' }}>
        אבחון מערכת
      </div>
      <div data-testid="diag-version-line" style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)' }}>
        גרסה: <span style={{ direction: 'ltr', display: 'inline-block' }}>{APP_VERSION.version}</span>
      </div>
      <div style={{ fontSize: 12, color: NEUTRAL }}>
        {APP_VERSION.buildLabel}
      </div>
      <div style={{ fontSize: 11, color: NEUTRAL, direction: 'ltr' }}>
        commit {APP_VERSION.commitHint} · {APP_VERSION.buildDate}
      </div>

      {/* Quick 3-row summary — renders immediately with "בודק…" placeholders */}
      <div data-testid="diag-summary" style={{
        marginTop: 8, padding: '8px 10px', borderRadius: 10,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {([
          ['שרת',   summary.server],
          ['קול',    summary.voice],
          ['קלנדר', summary.calendar],
        ] as Array<[string, boolean | null]>).map(([label, ok]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>{label}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: NEUTRAL }}>{summaryText(ok)}</span>
              <span style={{ width: 10, height: 10, borderRadius: 5, background: summaryColor(ok) }} />
            </span>
          </div>
        ))}
      </div>

      {/* Pending indicator while async checks resolve */}
      {running && !report && (
        <div style={{ fontSize: 12, color: NEUTRAL, marginTop: 4 }}>מריץ בדיקות…</div>
      )}

      {/* If /api/health fetch threw, surface that explicitly */}
      {fetchError && !report && (
        <div data-testid="diag-fetch-error" style={{
          marginTop: 6, padding: '8px 10px', borderRadius: 10,
          background: 'rgba(251,113,133,0.08)',
          border: '1px solid rgba(251,113,133,0.30)',
          color: '#FECDD3', fontSize: 12, lineHeight: 1.6, direction: 'ltr',
        }}>
          /api/health fetch failed: {fetchError}
        </div>
      )}

      {/* Detailed rows — once the async report resolves */}
      {report && (
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
          <Row result={{ ok: true, label: 'App Version', detail: report.appVersion }} />
          <Row result={{ ok: true, label: 'Build Label', detail: report.buildLabel }} />
          <Row result={{ ok: true, label: 'Commit', detail: report.commitHint }} />
          <Row result={report.serviceWorker} />
          <Row result={report.localStorage} />
          <Row result={report.apiHealth} />
          <Row result={report.abuaiChatProxy} />
          <Row result={report.abuaiOnline} />
          <Row result={report.calendarStorage} />
          <Row result={report.voiceCapability} />
          <Row result={report.versionMismatch} />
        </div>
      )}

      {report && !report.versionMismatch.ok && (
        <div style={{
          marginTop: 6, padding: '10px 12px', borderRadius: 12,
          background: 'rgba(251,113,133,0.08)',
          border: '1px solid rgba(251,113,133,0.30)',
          color: '#FECDD3', fontSize: 13, lineHeight: 1.6,
        }}>
          האפליקציה בטלפון לא מעודכנת. צריך לרענן/להתקין מחדש.
        </div>
      )}

      {/* Actions — always visible, always functional */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          data-testid="diag-rerun"
          onClick={() => void runAll()}
          disabled={running}
          style={{
            flex: 1, minWidth: 120, minHeight: 48, padding: '10px 14px', borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(255,255,255,0.06)',
            color: 'white', fontSize: 14, fontWeight: 600,
            cursor: running ? 'wait' : 'pointer',
            fontFamily: "'Heebo','DM Sans',sans-serif",
          }}
        >{running ? 'מריצה…' : 'הרצה מחדש'}</button>
        <button
          type="button"
          data-testid="diag-copy"
          onClick={() => void copyReport()}
          style={{
            flex: 1, minWidth: 120, minHeight: 48, padding: '10px 14px', borderRadius: 10,
            border: '1px solid rgba(201,168,76,0.32)',
            background: 'rgba(201,168,76,0.10)',
            color: '#E8C76A', fontSize: 14, fontWeight: 700,
            cursor: 'pointer',
            fontFamily: "'Heebo','DM Sans',sans-serif",
          }}
        >{copied ? 'האבחון הועתק' : 'העתק אבחון'}</button>
        <button
          type="button"
          data-testid="diag-force-refresh"
          onClick={() => void handleForceRefresh()}
          style={{
            flex: 1, minWidth: 120, minHeight: 48, padding: '10px 14px', borderRadius: 10,
            border: '1px solid rgba(251,113,133,0.32)',
            background: 'rgba(251,113,133,0.08)',
            color: '#FECDD3', fontSize: 14, fontWeight: 600,
            cursor: 'pointer',
            fontFamily: "'Heebo','DM Sans',sans-serif",
          }}
        >רענון אפליקציה</button>
      </div>

      {refreshMsg && (
        <div style={{
          marginTop: 6, fontSize: 12, color: NEUTRAL, textAlign: 'center',
        }}>{refreshMsg}</div>
      )}
    </div>
  )
}

/*
 * AbuBank diagnostic panel (P0).
 *
 * Self-contained component that runs the platformHealth checks live
 * and renders a pass/fail row per check plus a "copy diagnostic JSON"
 * button. Used from Settings → About.
 *
 * No secrets are read or rendered. Only presence flags and route
 * status. The "force refresh" button is gated behind a confirmation.
 */

import { useEffect, useState } from 'react'
import {
  buildDiagnosticReport,
  forceRefreshServiceWorker,
  type DiagnosticReport,
  type HealthCheckResult,
} from '../services/platformHealth'

const PASS = '#34D399'
const FAIL = '#FB7185'
const NEUTRAL = 'rgba(255,255,255,0.55)'

function Row({ result }: { result: HealthCheckResult }) {
  const color = result.ok ? PASS : FAIL
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
        <span style={{ fontSize: 12, color: NEUTRAL, direction: 'ltr' }}>{result.detail}</span>
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

export function DiagnosticPanel() {
  const [report, setReport] = useState<DiagnosticReport | null>(null)
  const [running, setRunning] = useState(false)
  const [copied, setCopied] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null)

  async function runAll() {
    setRunning(true)
    setCopied(false)
    try {
      const r = await buildDiagnosticReport()
      setReport(r)
    } finally {
      setRunning(false)
    }
  }

  useEffect(() => { void runAll() }, [])

  async function copyReport() {
    if (!report) return
    const json = JSON.stringify(report, null, 2)
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(json)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch { /* clipboard unavailable */ }
  }

  async function handleForceRefresh() {
    const ok = confirm('לרענן את האפליקציה? זה ימחק קאש מקומי ויטען מחדש.')
    if (!ok) return
    const result = await forceRefreshServiceWorker()
    setRefreshMsg(result.ok ? 'הקאש נוקה. רענני את הדף.' : `שגיאה: ${result.detail}`)
    if (result.ok && typeof window !== 'undefined') {
      setTimeout(() => window.location.reload(), 1500)
    }
  }

  return (
    <div data-testid="diagnostic-panel" dir="rtl" style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      fontFamily: "'Heebo','DM Sans',sans-serif",
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>אבחון מערכת</div>
      <div style={{ fontSize: 13, color: NEUTRAL }}>
        {report
          ? `נוצר ${new Date(report.generatedAt).toLocaleTimeString('he-IL')}`
          : 'מריצה בדיקות…'}
      </div>

      {report && (
        <div style={{
          display: 'flex', flexDirection: 'column',
          marginTop: 8, padding: '4px 0',
        }}>
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

      {!report?.versionMismatch.ok && report && (
        <div style={{
          marginTop: 6, padding: '10px 12px', borderRadius: 12,
          background: 'rgba(251,113,133,0.08)',
          border: '1px solid rgba(251,113,133,0.30)',
          color: '#FECDD3', fontSize: 13, lineHeight: 1.6,
        }}>
          האפליקציה בטלפון לא מעודכנת. צריך לרענן/להתקין מחדש.
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          data-testid="diag-rerun"
          onClick={() => void runAll()}
          disabled={running}
          style={{
            flex: 1, minHeight: 44, padding: '10px 14px', borderRadius: 10,
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
          disabled={!report}
          style={{
            flex: 1, minHeight: 44, padding: '10px 14px', borderRadius: 10,
            border: '1px solid rgba(201,168,76,0.32)',
            background: 'rgba(201,168,76,0.10)',
            color: '#E8C76A', fontSize: 14, fontWeight: 700,
            cursor: 'pointer',
            fontFamily: "'Heebo','DM Sans',sans-serif",
          }}
        >{copied ? 'הועתק ✓' : 'העתק אבחון'}</button>
        <button
          type="button"
          data-testid="diag-force-refresh"
          onClick={() => void handleForceRefresh()}
          style={{
            flex: 1, minHeight: 44, padding: '10px 14px', borderRadius: 10,
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

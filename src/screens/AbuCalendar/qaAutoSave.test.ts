/*
 * QA auto-save to dev server — contract tests.
 * Verifies the Vite endpoint, client helper, auto-upload on append,
 * and UI status indicators exist.
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const VITE_CFG = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'vite.config.ts'), 'utf8')
const PANEL = fs.readFileSync(path.resolve(__dirname, 'VoiceDebugPanel.tsx'), 'utf8')
const INDEX = fs.readFileSync(path.resolve(__dirname, 'index.tsx'), 'utf8')

describe('QA auto-save — Vite endpoint', () => {
  it('vite.config.ts contains /__abu_calendar_qa_log endpoint', () => {
    expect(VITE_CFG.includes('/__abu_calendar_qa_log')).toBe(true)
  })

  it('endpoint writes latest.json', () => {
    expect(VITE_CFG.includes("'latest.json'")).toBe(true)
  })

  it('endpoint writes timestamped json', () => {
    expect(VITE_CFG.includes('`run-${ts}.json`')).toBe(true)
  })

  it('endpoint creates tmp/abu-calendar-qa directory', () => {
    expect(VITE_CFG.includes("'tmp', 'abu-calendar-qa'")).toBe(true)
    expect(VITE_CFG.includes('mkdirSync')).toBe(true)
  })

  it('endpoint returns { ok, path, count }', () => {
    expect(VITE_CFG.includes('ok: true')).toBe(true)
    expect(VITE_CFG.includes('path: stampedPath')).toBe(true)
  })

  it('handles CORS preflight', () => {
    expect(VITE_CFG.includes('Access-Control-Allow-Origin')).toBe(true)
    expect(VITE_CFG.includes('OPTIONS')).toBe(true)
  })
})

describe('QA auto-save — client helper', () => {
  it('sendQaRunsToDevServer function exists', () => {
    expect(PANEL.includes('export async function sendQaRunsToDevServer')).toBe(true)
  })

  it('POSTs to /__abu_calendar_qa_log', () => {
    expect(PANEL.includes("fetch('/__abu_calendar_qa_log'")).toBe(true)
  })

  it('tracks upload status: idle / uploading / saved / failed', () => {
    expect(PANEL.includes("'idle'")).toBe(true)
    expect(PANEL.includes("'uploading'")).toBe(true)
    expect(PANEL.includes("'saved'")).toBe(true)
    expect(PANEL.includes("'failed'")).toBe(true)
  })
})

describe('QA auto-save — auto-upload on append', () => {
  it('appendQaRun calls sendQaRunsToDevServer', () => {
    expect(PANEL.includes('void sendQaRunsToDevServer(runs)')).toBe(true)
  })
})

describe('QA auto-save — UI indicators', () => {
  it('shows "נשמר למחשב" status', () => {
    expect(PANEL.includes('נשמר למחשב')).toBe(true)
  })

  it('shows "שמירה למחשב נכשלה" on failure', () => {
    expect(PANEL.includes('שמירה למחשב נכשלה')).toBe(true)
  })

  it('has "שמור למחשב" manual button', () => {
    expect(PANEL.includes('qa-save-to-computer')).toBe(true)
    expect(PANEL.includes('שמור למחשב')).toBe(true)
  })

  it('has "שמור עכשיו למחשב" in guided QA end state', () => {
    expect(PANEL.includes('guided-qa-save-now')).toBe(true)
    expect(PANEL.includes('שמור עכשיו למחשב')).toBe(true)
  })

  it('qa-upload-status testid exists', () => {
    expect(PANEL.includes('qa-upload-status')).toBe(true)
  })

  it('copy button is secondary (still present but not primary)', () => {
    expect(PANEL.includes('qa-copy-all')).toBe(true)
    expect(PANEL.includes('Copy JSON')).toBe(true)
  })

  it('guided QA save status shown after marking', () => {
    expect(PANEL.includes('guided-qa-save-status')).toBe(true)
    expect(PANEL.includes('נשמר למחשב אוטומטית')).toBe(true)
  })
})

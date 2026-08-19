/*
 * Private Family Phones — import page (/settings/family-phones)
 * ════════════════════════════════════════════════════════════
 * A protected, mobile-friendly page to import the family phone numbers from a
 * .json file OR a pasted JSON array of { id, enabled, phoneE164 }. Numbers are
 * normalized to E.164, validated, matched to family members by stable id, PREVIEWED
 * MASKED, and — only after explicit confirmation — stored in device-local IndexedDB.
 *
 * PRIVACY: real numbers never leave the device (no Git/logs/diagnostics/Evolution/
 * prompts/SW-cache). The preview is masked; export downloads the user's own data
 * locally. Tests use fake numbers only.
 */
import React, { useMemo, useRef, useState } from 'react'
import {
  importContactsJSON, getLocalContacts, clearLocalContacts, exportContactsJSON,
  buildMaskedPreview, savedMessage, replaceAllContacts, mergeContacts,
  type ImportResult, type MaskedRow,
} from './familyPhonesImport'

const BG = '#050A18'
const GOLD = '#C9A84C'
const GREEN = '#25D366'
const RED = '#ef4444'
const TEXT = '#F5F0E8'

const btn = (bg: string, fg: string): React.CSSProperties => ({
  width: '100%', minHeight: 56, padding: '14px 18px', borderRadius: 14, border: 'none',
  background: bg, color: fg, fontSize: 18, fontWeight: 700, fontFamily: "'Heebo','DM Sans',sans-serif",
  cursor: 'pointer', WebkitAppearance: 'none',
})

export function FamilyPhones({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [savedCount, setSavedCount] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const existingCount = useMemo(() => { try { return getLocalContacts().length } catch { return 0 } }, [savedCount])
  const preview: MaskedRow[] = result?.contacts ? buildMaskedPreview(result.contacts) : []

  function reset() { setResult(null); setConfirming(false); setSavedCount(null); setNotice(null) }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFileName(f.name)
    const reader = new FileReader()
    reader.onload = () => { setText(String(reader.result ?? '')); reset() }
    reader.onerror = () => setNotice('לא הצלחתי לקרוא את הקובץ. נסי קובץ אחר.')
    reader.readAsText(f)
  }

  function onCheck() {
    reset()
    const r = importContactsJSON(text)
    setResult(r)
    if (!r.ok && r.errors.length) setNotice('יש בעיה בחלק מהרשומות — ראי למטה. אפשר לתקן ולבדוק שוב.')
  }

  function doSave(mode: 'replace' | 'merge') {
    if (!result || result.contacts.length === 0) return
    const n = mode === 'replace' ? replaceAllContacts(result.contacts) : mergeContacts(result.contacts)
    setSavedCount(n)
    setConfirming(false)
    setNotice(null)
  }

  function onDeleteAll() {
    if (!window.confirm('למחוק את כל מספרי הטלפון מהמכשיר הזה?')) return
    clearLocalContacts()
    setSavedCount(0); setResult(null); setConfirming(false)
    setNotice('כל המספרים נמחקו מהמכשיר הזה.')
  }

  function onExport() {
    try {
      const json = exportContactsJSON(getLocalContacts())
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'family-phones.json'
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice('קובץ הגיבוי ירד למכשיר.')
    } catch { setNotice('לא הצלחתי לייצא כרגע.') }
  }

  return (
    <div dir="rtl" style={{
      position: 'fixed', inset: 0, zIndex: 60, background: BG, color: TEXT,
      overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      fontFamily: "'Heebo','DM Sans',sans-serif", padding: '18px 16px 40px',
    }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button onClick={onClose} aria-label="חזרה" style={{ ...btn('rgba(255,255,255,0.08)', TEXT), width: 'auto', minWidth: 56, minHeight: 48, fontSize: 22 }}>‹</button>
        <div style={{ fontSize: 22, fontWeight: 800 }}>מספרי טלפון משפחתיים</div>
      </header>

      <p style={{ fontSize: 16, lineHeight: 1.7, color: 'rgba(245,240,232,0.75)', marginTop: 0 }}>
        בחרי קובץ JSON או הדביקי את הרשימה. המספרים נשמרים <b>רק במכשיר הזה</b> ומעולם לא נשלחים לשום מקום.
      </p>

      {/* File selection */}
      <input ref={fileRef} type="file" accept="application/json,.json" onChange={onPickFile} style={{ display: 'none' }} data-testid="family-phones-file" />
      <button data-testid="pick-json" onClick={() => fileRef.current?.click()} style={{ ...btn('rgba(201,168,76,0.14)', '#FFE9B3'), marginBottom: 8 }}>בחירת קובץ JSON</button>
      {fileName && <div style={{ fontSize: 14, color: 'rgba(245,240,232,0.6)', marginBottom: 10 }}>נבחר: {fileName}</div>}

      {/* Paste area */}
      <textarea
        data-testid="paste-json"
        value={text}
        onChange={e => { setText(e.target.value); reset() }}
        placeholder='או הדביקי כאן את ה-JSON:&#10;[{ "id": "mor", "enabled": true, "phoneE164": "+972XXXXXXXXX" }]'
        rows={7}
        style={{
          width: '100%', resize: 'vertical', padding: 14, borderRadius: 14,
          border: '1px solid rgba(20,184,166,0.30)', background: 'rgba(255,250,240,0.05)',
          color: TEXT, fontSize: 15, fontFamily: 'monospace', direction: 'ltr', minHeight: 140, boxSizing: 'border-box',
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
        <button data-testid="check-before-save" onClick={onCheck} disabled={!text.trim()} style={{ ...btn(GOLD, '#0b1020'), opacity: text.trim() ? 1 : 0.5 }}>בדיקה לפני שמירה</button>
      </div>

      {notice && <div style={{ marginTop: 12, fontSize: 15, color: '#FFE9B3' }}>{notice}</div>}

      {/* Validation errors */}
      {result && result.errors.length > 0 && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'rgba(239,68,68,0.10)', border: `1px solid ${RED}` }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>בעיות שנמצאו:</div>
          <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 14, lineHeight: 1.6 }}>
            {result.errors.slice(0, 12).map((e, i) => <li key={i} style={{ direction: 'ltr', textAlign: 'right' }}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* Masked preview */}
      {preview.length > 0 && (
        <div data-testid="masked-preview" style={{ marginTop: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>תצוגה מקדימה ({preview.length}) — מספרים מוסתרים:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {preview.map(row => (
              <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)' }}>
                <span style={{ fontWeight: 700 }}>{row.id}{row.known ? '' : ' ⚠️'}</span>
                <span style={{ direction: 'ltr', fontFamily: 'monospace', color: 'rgba(245,240,232,0.85)' }}>{row.masked}</span>
                <span style={{ fontSize: 13, color: row.enabled ? GREEN : 'rgba(245,240,232,0.5)' }}>{row.enabled ? 'פעיל' : 'כבוי'}</span>
              </div>
            ))}
          </div>

          {savedCount === null && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
              {!confirming ? (
                <button data-testid="confirm-save" onClick={() => setConfirming(true)} disabled={result?.contacts.length === 0} style={{ ...btn(GREEN, '#04210f'), opacity: result && result.contacts.length ? 1 : 0.5 }}>אישור ושמירת המספרים</button>
              ) : (
                <>
                  <div style={{ fontSize: 15, color: '#FFE9B3' }}>לשמור {preview.length} מספרים במכשיר הזה?</div>
                  <button data-testid="confirm-replace" onClick={() => doSave('replace')} style={btn(GREEN, '#04210f')}>כן — החליפי את הכל</button>
                  <button data-testid="confirm-merge" onClick={() => doSave('merge')} style={btn('rgba(37,211,102,0.16)', '#bff5d3')}>מיזוג עם הקיימים</button>
                  <button onClick={() => setConfirming(false)} style={btn('rgba(255,255,255,0.08)', TEXT)}>ביטול</button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Success */}
      {savedCount !== null && savedCount > 0 && (
        <div data-testid="saved-message" style={{ marginTop: 16, padding: 14, borderRadius: 12, background: 'rgba(37,211,102,0.12)', border: `1px solid ${GREEN}`, fontSize: 18, fontWeight: 700, textAlign: 'center' }}>
          {savedMessage(savedCount)}
        </div>
      )}

      {/* Export / delete controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 26, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 18 }}>
        <div style={{ fontSize: 14, color: 'rgba(245,240,232,0.6)' }}>שמורים כרגע במכשיר: {existingCount}</div>
        <button data-testid="export-json" onClick={onExport} style={btn('rgba(255,255,255,0.08)', TEXT)}>ייצוא גיבוי (JSON)</button>
        <button data-testid="delete-all" onClick={onDeleteAll} style={btn('rgba(239,68,68,0.14)', '#ffb4b4')}>מחיקת כל המספרים</button>
      </div>
    </div>
  )
}

export default FamilyPhones

import { useMemo, useState } from 'react'
import {
  clearLocalContacts,
  exportContactsJSON,
  getLocalContacts,
  importContactsJSON,
  maskPhonePreview,
  setLocalContacts,
  type LocalFamilyContact,
} from './familyContactsStorage'

const TEAL = '#14b8a6'
const GOLD = '#C9A84C'
const RED = '#ef4444'

interface FamilyContactsSetupProps {
  onClose: () => void
}

type Banner =
  | { kind: 'idle' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; messages: string[] }

export function FamilyContactsSetup({ onClose }: FamilyContactsSetupProps) {
  const [stored, setStored] = useState<LocalFamilyContact[]>(() => getLocalContacts())
  const [draft, setDraft] = useState<string>('')
  const [banner, setBanner] = useState<Banner>({ kind: 'idle' })
  const [confirmClear, setConfirmClear] = useState(false)

  const previews = useMemo(
    () => stored.map((c) => ({
      id: c.id,
      enabled: c.enabled,
      phonePreview: maskPhonePreview(c.phoneE164),
      hasWhatsapp: !!(c.whatsappE164 && c.whatsappE164.length > 0),
      hasPhoto: !!(c.photoDataUrl || c.photoFile),
    })),
    [stored],
  )

  function handleImport() {
    const result = importContactsJSON(draft)
    if (!result.ok) { setBanner({ kind: 'error', messages: result.errors }); return }
    setLocalContacts(result.contacts)
    setStored(result.contacts)
    setDraft('')
    setBanner({ kind: 'success', message: `נשמרו ${result.contacts.length} אנשי קשר מקומיים` })
  }

  function handleClear() {
    clearLocalContacts()
    setStored([])
    setDraft('')
    setConfirmClear(false)
    setBanner({ kind: 'success', message: 'אנשי הקשר המקומיים נוקו' })
  }

  function handleExport() {
    const json = exportContactsJSON(stored)
    setDraft(json)
    setBanner({ kind: 'success', message: 'יוצא לחלון. אל תשתפי בלוגים.' })
  }

  return (
    <div
      data-testid="family-contacts-setup"
      style={{
        width: '100%', maxWidth: 460,
        display: 'flex', flexDirection: 'column', gap: 14,
        direction: 'rtl',
        color: 'rgba(255,255,255,0.92)',
        fontFamily: "'Heebo',sans-serif",
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>הגדרת אנשי קשר מקומיים</h2>
        <button
          type="button"
          data-testid="setup-close"
          onClick={onClose}
          aria-label="סגירת הגדרות"
          style={{
            minHeight: 44, minWidth: 44, padding: '8px 14px', borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.10)',
            background: 'rgba(255,255,255,0.04)',
            color: 'rgba(255,255,255,0.55)',
            fontSize: 15, fontFamily: "'Heebo',sans-serif",
            cursor: 'pointer',
          }}
        >סגרי</button>
      </header>

      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,0.55)' }}>
        מצב מפעיל בלבד. הנתונים נשמרים רק במכשיר הזה — לא נשלחים לשרת ולא נכנסים לקוד.
      </p>

      <section
        data-testid="setup-current-list"
        style={{
          padding: 14, borderRadius: 16,
          background: 'rgba(8,16,28,0.65)',
          border: '1px solid rgba(20,184,166,0.20)',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>אנשי קשר מקומיים כעת ({stored.length})</div>
        {stored.length === 0 ? (
          <div data-testid="setup-empty" style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>
            אין נתונים מקומיים. הדביקי JSON תקין כדי להוסיף.
          </div>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {previews.map((p) => (
              <li
                key={p.id}
                data-testid={`setup-row-${p.id}`}
                style={{
                  display: 'flex', justifyContent: 'space-between', gap: 10,
                  fontSize: 14, padding: '6px 8px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.03)',
                }}
              >
                <span>
                  <span style={{ fontWeight: 600 }}>{p.id}</span>
                  {p.enabled ? '' : ' · כבוי'}
                  {p.hasWhatsapp ? ' · WA' : ''}
                  {p.hasPhoto ? ' · 📷' : ''}
                </span>
                <span data-testid={`setup-mask-${p.id}`} style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {p.phonePreview}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {banner.kind === 'success' && (
        <div
          data-testid="setup-banner-success"
          style={{
            padding: '10px 14px', borderRadius: 14,
            background: 'rgba(20,184,166,0.10)',
            border: `1px solid ${TEAL}55`,
            fontSize: 14,
          }}
        >✅ {banner.message}</div>
      )}

      {banner.kind === 'error' && (
        <div
          data-testid="setup-banner-error"
          style={{
            padding: '10px 14px', borderRadius: 14,
            background: 'rgba(239,68,68,0.10)',
            border: `1px solid ${RED}66`,
            fontSize: 14, lineHeight: 1.6,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>⚠️ הייבוא נכשל</div>
          <ul style={{ margin: 0, paddingInlineStart: 18 }}>
            {banner.messages.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>
      )}

      <label htmlFor="setup-json" style={{ fontSize: 14, fontWeight: 600 }}>הדביקי JSON של אנשי קשר</label>
      <textarea
        id="setup-json"
        data-testid="setup-json-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        spellCheck={false}
        rows={10}
        placeholder={'[ { "id": "mor", "enabled": true, "phoneE164": "+972XXXXXXXXX" } ]'}
        style={{
          width: '100%', minHeight: 180,
          padding: '12px 14px',
          borderRadius: 14,
          border: '1px solid rgba(20,184,166,0.30)',
          background: 'rgba(5,12,20,0.80)',
          color: 'rgba(255,255,255,0.92)',
          fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, Monaco, Consolas, monospace",
          fontSize: 13, lineHeight: 1.55,
          direction: 'ltr', textAlign: 'left',
          resize: 'vertical',
        }}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          type="button"
          data-testid="setup-import"
          onClick={handleImport}
          disabled={draft.trim().length === 0}
          style={{
            minHeight: 48, padding: '0 18px', borderRadius: 14,
            border: `1.5px solid ${TEAL}66`,
            background: draft.trim().length === 0 ? 'rgba(20,184,166,0.06)' : `linear-gradient(145deg, ${TEAL}, #0d9488)`,
            color: draft.trim().length === 0 ? 'rgba(255,255,255,0.35)' : 'white',
            fontFamily: "'Heebo',sans-serif",
            fontSize: 16, fontWeight: 600,
            cursor: draft.trim().length === 0 ? 'default' : 'pointer',
          }}
        >ייבאי ושמרי</button>

        <button
          type="button"
          data-testid="setup-export"
          onClick={handleExport}
          disabled={stored.length === 0}
          style={{
            minHeight: 48, padding: '0 16px', borderRadius: 14,
            border: `1px solid ${GOLD}55`,
            background: stored.length === 0 ? 'rgba(201,168,76,0.05)' : 'rgba(201,168,76,0.10)',
            color: stored.length === 0 ? 'rgba(255,255,255,0.35)' : GOLD,
            fontFamily: "'Heebo',sans-serif",
            fontSize: 15, fontWeight: 600,
            cursor: stored.length === 0 ? 'default' : 'pointer',
          }}
        >ייצאי לחלון</button>

        {!confirmClear ? (
          <button
            type="button"
            data-testid="setup-clear"
            onClick={() => setConfirmClear(true)}
            disabled={stored.length === 0}
            style={{
              minHeight: 48, padding: '0 16px', borderRadius: 14,
              border: `1px solid ${RED}55`,
              background: stored.length === 0 ? 'rgba(239,68,68,0.05)' : 'rgba(239,68,68,0.10)',
              color: stored.length === 0 ? 'rgba(255,255,255,0.35)' : RED,
              fontFamily: "'Heebo',sans-serif",
              fontSize: 15, fontWeight: 600,
              cursor: stored.length === 0 ? 'default' : 'pointer',
            }}
          >נקי הכל</button>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              data-testid="setup-clear-confirm"
              onClick={handleClear}
              style={{
                minHeight: 48, padding: '0 14px', borderRadius: 14,
                border: `1.5px solid ${RED}88`,
                background: `${RED}26`,
                color: 'white',
                fontFamily: "'Heebo',sans-serif",
                fontSize: 15, fontWeight: 700,
                cursor: 'pointer',
              }}
            >בטוחה? נקי</button>
            <button
              type="button"
              data-testid="setup-clear-cancel"
              onClick={() => setConfirmClear(false)}
              style={{
                minHeight: 48, padding: '0 14px', borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.65)',
                fontFamily: "'Heebo',sans-serif",
                fontSize: 15, fontWeight: 500,
                cursor: 'pointer',
              }}
            >בטלי</button>
          </div>
        )}
      </div>
    </div>
  )
}

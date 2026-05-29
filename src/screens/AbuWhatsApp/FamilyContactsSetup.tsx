/*
 * AbuWhatsApp operator setup — per-contact form.
 *
 * Operator-only screen: each scaffold person gets a row with a phone input,
 * enabled toggle, save button, and clear button. JSON import/export is kept
 * available but collapsed under "מתקדם" so it never blocks normal operator
 * work. Phone numbers stay in localStorage only — they are never written to
 * source, memory/*, knowledge/*, or any AbuAI prompt.
 */

import { useEffect, useMemo, useState } from 'react'
import { FAMILY_QUICK_FACES, type FamilyQuickFace } from './familyContacts.private'
import {
  clearLocalContacts,
  exportContactsJSON,
  getLocalContacts,
  importContactsJSON,
  maskPhonePreview,
  removeLocalContact,
  setLocalContacts,
  upsertLocalContact,
  type LocalFamilyContact,
} from './familyContactsStorage'
import { computeInitials, isValidPhoneE164 } from './familyQuickFaces'
import { APP_VERSION } from '../../version'

const TEAL = '#14b8a6'
const GOLD = '#C9A84C'
const RED = '#ef4444'

interface FamilyContactsSetupProps {
  onClose: () => void
}

interface RowDraft {
  phoneE164: string
  enabled: boolean
  feedback: { kind: 'idle' } | { kind: 'saved' } | { kind: 'cleared' } | { kind: 'error'; message: string }
}

const PERSON_SCAFFOLD: ReadonlyArray<Extract<FamilyQuickFace, { type: 'person' }>> =
  FAMILY_QUICK_FACES.filter((f) => f.type === 'person') as ReadonlyArray<Extract<FamilyQuickFace, { type: 'person' }>>

function blankDraft(): RowDraft {
  return { phoneE164: '', enabled: false, feedback: { kind: 'idle' } }
}

function initialDrafts(stored: LocalFamilyContact[]): Record<string, RowDraft> {
  const out: Record<string, RowDraft> = {}
  for (const p of PERSON_SCAFFOLD) {
    const s = stored.find((c) => c.id === p.id)
    out[p.id] = s
      ? { phoneE164: s.phoneE164, enabled: s.enabled, feedback: { kind: 'idle' } }
      : blankDraft()
  }
  return out
}

export function FamilyContactsSetup({ onClose }: FamilyContactsSetupProps) {
  const [stored, setStored] = useState<LocalFamilyContact[]>(() => getLocalContacts())
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>(() => initialDrafts(stored))
  const [confirmClearAll, setConfirmClearAll] = useState(false)

  useEffect(() => {
    setDrafts(initialDrafts(stored))
  }, [stored])

  const storedById = useMemo(() => {
    const m = new Map<string, LocalFamilyContact>()
    for (const c of stored) m.set(c.id, c)
    return m
  }, [stored])

  function patchDraft(id: string, patch: Partial<RowDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? blankDraft()), ...patch, feedback: patch.feedback ?? { kind: 'idle' } },
    }))
  }

  function handleSaveOne(person: Extract<FamilyQuickFace, { type: 'person' }>) {
    const draft = drafts[person.id] ?? blankDraft()
    const trimmed = draft.phoneE164.trim()
    if (draft.enabled && !isValidPhoneE164(trimmed)) {
      patchDraft(person.id, { feedback: { kind: 'error', message: 'מספר לא תקין. דוגמה: +972XXXXXXXXX' } })
      return
    }
    const contact: LocalFamilyContact = {
      id: person.id,
      enabled: draft.enabled,
      phoneE164: trimmed,
    }
    const result = upsertLocalContact(contact)
    if (!result.ok) {
      patchDraft(person.id, { feedback: { kind: 'error', message: result.errors.join(' · ') || 'שמירה נכשלה' } })
      return
    }
    setStored(getLocalContacts())
    patchDraft(person.id, { feedback: { kind: 'saved' } })
  }

  function handleClearOne(person: Extract<FamilyQuickFace, { type: 'person' }>) {
    removeLocalContact(person.id)
    setStored(getLocalContacts())
    setDrafts((prev) => ({
      ...prev,
      [person.id]: { phoneE164: '', enabled: false, feedback: { kind: 'cleared' } },
    }))
  }

  function handleAdvancedImport(jsonText: string): { ok: boolean; messages: string[] } {
    const r = importContactsJSON(jsonText)
    if (!r.ok) {
      return { ok: false, messages: ['הייבוא נכשל. בדקי את השורות הבאות:', ...r.errors] }
    }
    setLocalContacts(r.contacts)
    setStored(getLocalContacts())
    return { ok: true, messages: [`נשמרו ${r.contacts.length} אנשי קשר`] }
  }

  function handleClearAll() {
    clearLocalContacts()
    setStored([])
    setConfirmClearAll(false)
  }

  return (
    <div
      data-testid="family-contacts-setup"
      style={{
        width: '100%', maxWidth: 480,
        display: 'flex', flexDirection: 'column', gap: 14,
        direction: 'rtl',
        color: 'rgba(255,255,255,0.92)',
        fontFamily: "'Heebo',sans-serif",
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>הגדרת אנשי קשר</h2>
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

      <div
        data-testid="setup-build-version"
        style={{
          fontSize: 11, color: 'rgba(255,255,255,0.45)',
          fontFamily: "'DM Sans',monospace", direction: 'ltr',
        }}
      >
        v{APP_VERSION.version} · {APP_VERSION.buildLabel}
      </div>

      {(() => {
        // Local diagnostic line: counts the contacts that this device would
        // actually surface as actionable (enabled AND phoneE164 OR
        // whatsappE164 passes the E.164 validator). Helps Leo confirm on
        // the real phone whether localStorage holds the expected data.
        const activeCount = stored.filter((c) => {
          if (!c.enabled) return false
          if (isValidPhoneE164(c.phoneE164)) return true
          if (c.whatsappE164 && isValidPhoneE164(c.whatsappE164)) return true
          return false
        }).length
        const msg = activeCount > 0
          ? `נשמרו ${activeCount} אנשי קשר פעילים במכשיר הזה`
          : 'לא נשמרו עדיין אנשי קשר במכשיר הזה'
        return (
          <div
            data-testid="setup-active-count"
            data-active-count={activeCount}
            style={{
              fontSize: 13, lineHeight: 1.55,
              padding: '8px 10px',
              borderRadius: 10,
              background: activeCount > 0 ? 'rgba(20,184,166,0.10)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${activeCount > 0 ? 'rgba(20,184,166,0.40)' : 'rgba(255,255,255,0.08)'}`,
              color: activeCount > 0 ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.62)',
              fontFamily: "'Heebo',sans-serif",
            }}
          >
            {msg}
          </div>
        )
      })()}

      <p
        data-testid="setup-helper-copy"
        style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,0.55)' }}
      >
        המספרים נשמרים רק במכשיר הזה.
        <br />
        הם לא נכנסים לקוד ולא נשלחים לשרת.
        <br />
        אחרי שמירת מספר, יופיעו כפתורי וואטסאפ ושיחה.
      </p>

      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {PERSON_SCAFFOLD.map((person) => {
          const draft = drafts[person.id] ?? blankDraft()
          const saved = storedById.get(person.id)
          return (
            <li
              key={person.id}
              data-testid={`setup-row-${person.id}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '52px 1fr',
                columnGap: 12, rowGap: 6,
                padding: '12px 14px',
                borderRadius: 16,
                background: 'rgba(8,16,28,0.65)',
                border: '1px solid rgba(20,184,166,0.18)',
              }}
            >
              <div
                aria-hidden
                style={{
                  gridRow: '1 / span 4',
                  width: 52, height: 52, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `2px solid ${TEAL}55`,
                  background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.10), rgba(20,184,166,0.18) 45%, rgba(8,16,28,0.95) 100%)`,
                  fontFamily: "'Cormorant Garamond',Georgia,serif",
                  fontSize: 22, fontWeight: 600,
                  color: TEAL, lineHeight: 1, userSelect: 'none',
                }}
              >
                {computeInitials(person.displayName)}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 17, fontWeight: 600 }}>{person.displayName}</span>
                {person.relationshipHebrew && (
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{person.relationshipHebrew}</span>
                )}
              </div>
              <input
                type="tel"
                inputMode="tel"
                data-testid={`setup-phone-${person.id}`}
                value={draft.phoneE164}
                onChange={(e) => patchDraft(person.id, { phoneE164: e.target.value })}
                placeholder="+972XXXXXXXXX"
                spellCheck={false}
                autoComplete="off"
                style={{
                  width: '100%', minHeight: 44, padding: '6px 12px',
                  borderRadius: 12,
                  border: '1px solid rgba(20,184,166,0.30)',
                  background: 'rgba(5,12,20,0.80)',
                  color: 'rgba(255,255,255,0.92)',
                  fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, Monaco, monospace",
                  fontSize: 15, lineHeight: 1.4,
                  direction: 'ltr', textAlign: 'left',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <label
                  title="הבועה תמיד מוצגת לאישה. סימון כאן רק מאפשר את לחיצת ה-WhatsApp / שיחה."
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'rgba(255,255,255,0.65)' }}
                >
                  <input
                    type="checkbox"
                    data-testid={`setup-enabled-${person.id}`}
                    checked={draft.enabled}
                    onChange={(e) => patchDraft(person.id, { enabled: e.target.checked })}
                  />
                  מספר פעיל
                </label>
                {saved && (
                  <span data-testid={`setup-mask-${person.id}`} style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', fontFamily: "'DM Sans',monospace", direction: 'ltr' }}>
                    {maskPhonePreview(saved.phoneE164)}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  data-testid={`setup-save-${person.id}`}
                  onClick={() => handleSaveOne(person)}
                  style={{
                    minHeight: 44, padding: '0 16px', borderRadius: 12,
                    border: `1.5px solid ${TEAL}66`,
                    background: `linear-gradient(145deg, ${TEAL}, #0d9488)`,
                    color: 'white',
                    fontFamily: "'Heebo',sans-serif",
                    fontSize: 15, fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >שמרי</button>
                <button
                  type="button"
                  data-testid={`setup-clear-${person.id}`}
                  onClick={() => handleClearOne(person)}
                  disabled={!saved}
                  style={{
                    minHeight: 44, padding: '0 14px', borderRadius: 12,
                    border: `1px solid ${RED}55`,
                    background: saved ? 'rgba(239,68,68,0.10)' : 'rgba(239,68,68,0.04)',
                    color: saved ? RED : 'rgba(239,68,68,0.40)',
                    fontFamily: "'Heebo',sans-serif",
                    fontSize: 14, fontWeight: 600,
                    cursor: saved ? 'pointer' : 'default',
                  }}
                >נקי</button>
                {draft.feedback.kind === 'saved' && (
                  <span data-testid={`setup-feedback-${person.id}`} style={{ fontSize: 13, color: TEAL, alignSelf: 'center' }}>נשמר ✓</span>
                )}
                {draft.feedback.kind === 'cleared' && (
                  <span data-testid={`setup-feedback-${person.id}`} style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', alignSelf: 'center' }}>נוקה</span>
                )}
                {draft.feedback.kind === 'error' && (
                  <span data-testid={`setup-feedback-${person.id}`} style={{ fontSize: 13, color: RED, alignSelf: 'center' }}>{draft.feedback.message}</span>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <details
        data-testid="setup-advanced"
        style={{
          marginTop: 4,
          padding: '8px 12px',
          borderRadius: 12,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <summary style={{ cursor: 'pointer', fontSize: 14, color: 'rgba(255,255,255,0.55)' }}>מתקדם</summary>
        <AdvancedJsonPanel
          stored={stored}
          onImport={handleAdvancedImport}
          onClearAll={handleClearAll}
          confirmClearAll={confirmClearAll}
          setConfirmClearAll={setConfirmClearAll}
        />
      </details>
    </div>
  )
}

function AdvancedJsonPanel({
  stored, onImport, onClearAll, confirmClearAll, setConfirmClearAll,
}: {
  stored: LocalFamilyContact[]
  onImport: (jsonText: string) => { ok: boolean; messages: string[] }
  onClearAll: () => void
  confirmClearAll: boolean
  setConfirmClearAll: (v: boolean) => void
}) {
  const [draft, setDraft] = useState<string>('')
  const [banner, setBanner] = useState<{ ok: boolean; messages: string[] } | null>(null)

  function handleExport() {
    setDraft(exportContactsJSON(stored))
    setBanner({ ok: true, messages: ['יוצא לחלון. אל תשתפי בלוגים.'] })
  }
  function handleImport() {
    const r = onImport(draft)
    setBanner(r)
    if (r.ok) setDraft('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
      {banner && (
        <div
          data-testid={banner.ok ? 'setup-adv-banner-ok' : 'setup-adv-banner-err'}
          style={{
            fontSize: 13, lineHeight: 1.55, padding: '8px 10px', borderRadius: 10,
            background: banner.ok ? 'rgba(20,184,166,0.10)' : 'rgba(239,68,68,0.10)',
            border: `1px solid ${banner.ok ? `${TEAL}55` : `${RED}55`}`,
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          {banner.messages.map((m, i) => <div key={i}>{m}</div>)}
        </div>
      )}
      <textarea
        data-testid="setup-adv-json"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={8}
        spellCheck={false}
        placeholder={'[ { "id": "mor", "enabled": true, "phoneE164": "+972XXXXXXXXX" } ]'}
        style={{
          width: '100%', minHeight: 140,
          padding: '10px 12px', borderRadius: 12,
          border: '1px solid rgba(20,184,166,0.30)',
          background: 'rgba(5,12,20,0.80)',
          color: 'rgba(255,255,255,0.92)',
          fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, Monaco, monospace",
          fontSize: 12, lineHeight: 1.55,
          direction: 'ltr', textAlign: 'left', resize: 'vertical',
        }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <button
          type="button"
          data-testid="setup-adv-import"
          onClick={handleImport}
          disabled={draft.trim().length === 0}
          style={{
            minHeight: 40, padding: '0 14px', borderRadius: 10,
            border: `1px solid ${TEAL}55`,
            background: draft.trim().length === 0 ? 'rgba(20,184,166,0.06)' : 'rgba(20,184,166,0.16)',
            color: draft.trim().length === 0 ? 'rgba(255,255,255,0.30)' : TEAL,
            fontFamily: "'Heebo',sans-serif", fontSize: 13, fontWeight: 600,
            cursor: draft.trim().length === 0 ? 'default' : 'pointer',
          }}
        >ייבוא אנשי קשר</button>
        <button
          type="button"
          data-testid="setup-adv-export"
          onClick={handleExport}
          disabled={stored.length === 0}
          style={{
            minHeight: 40, padding: '0 14px', borderRadius: 10,
            border: `1px solid ${GOLD}55`,
            background: stored.length === 0 ? 'rgba(201,168,76,0.05)' : 'rgba(201,168,76,0.10)',
            color: stored.length === 0 ? 'rgba(255,255,255,0.30)' : GOLD,
            fontFamily: "'Heebo',sans-serif", fontSize: 13, fontWeight: 600,
            cursor: stored.length === 0 ? 'default' : 'pointer',
          }}
        >ייצוא לגיבוי</button>
        {!confirmClearAll ? (
          <button
            type="button"
            data-testid="setup-adv-clear-all"
            onClick={() => setConfirmClearAll(true)}
            disabled={stored.length === 0}
            style={{
              minHeight: 40, padding: '0 14px', borderRadius: 10,
              border: `1px solid ${RED}55`,
              background: stored.length === 0 ? 'rgba(239,68,68,0.05)' : 'rgba(239,68,68,0.10)',
              color: stored.length === 0 ? 'rgba(255,255,255,0.30)' : RED,
              fontFamily: "'Heebo',sans-serif", fontSize: 13, fontWeight: 600,
              cursor: stored.length === 0 ? 'default' : 'pointer',
            }}
          >נקי הכל</button>
        ) : (
          <>
            <button
              type="button"
              data-testid="setup-adv-clear-all-confirm"
              onClick={onClearAll}
              style={{
                minHeight: 40, padding: '0 12px', borderRadius: 10,
                border: `1.5px solid ${RED}88`,
                background: `${RED}26`,
                color: 'white',
                fontFamily: "'Heebo',sans-serif", fontSize: 13, fontWeight: 700,
                cursor: 'pointer',
              }}
            >בטוחה? נקי</button>
            <button
              type="button"
              data-testid="setup-adv-clear-all-cancel"
              onClick={() => setConfirmClearAll(false)}
              style={{
                minHeight: 40, padding: '0 12px', borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.65)',
                fontFamily: "'Heebo',sans-serif", fontSize: 13,
                cursor: 'pointer',
              }}
            >בטלי</button>
          </>
        )}
      </div>
    </div>
  )
}

/*
 * Settings → Contact Management.
 *
 * Two safe workflows over the SAME device-local family contact store the board
 * reads (`abubank.familyContacts.v1`, persisted via durableStore, refreshed via
 * CONTACTS_UPDATED_EVENT). Numbers never leave the device.
 *
 *  - SIMPLE FORM (default): add / edit / disable / delete one contact, with
 *    per-field validation and specific Hebrew errors. No raw JSON.
 *  - ADVANCED JSON: edit-as-JSON with Validate → Preview (added/updated/
 *    unchanged/invalid/duplicate) → Merge-Save (default) or Replace-All (strong
 *    confirm + removal count + automatic backup first). Export + backup + restore.
 *
 * The contact universe is Martita's known family (KNOWN_CONTACT_IDS); an unknown
 * id cannot render on the board, so it is a specific explained error.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { FAMILY_QUICK_FACES, type FamilyQuickFace } from './familyContacts.private'
import {
  CONTACTS_UPDATED_EVENT,
  exportContactsJSON,
  getLocalContacts,
  previewImportContacts,
  removeLocalContact,
  setLocalContacts,
  upsertLocalContact,
  validateContactFields,
  type ContactFieldErrors,
  type ContactImportPreview,
  type LocalFamilyContact,
} from './familyContactsStorage'
import { validateImageFile, resizeImageToDataUrl } from '../../services/imageResize'

const TEAL = '#14b8a6'
const GOLD = '#C9A84C'
const RED = '#ef4444'
const GREEN = '#25D366'

const PERSONS: ReadonlyArray<Extract<FamilyQuickFace, { type: 'person' }>> =
  FAMILY_QUICK_FACES.filter((f) => f.type === 'person') as never

function personMeta(id: string) { return PERSONS.find((p) => p.id === id) }

const input: React.CSSProperties = {
  width: '100%', minHeight: 44, padding: '8px 12px', borderRadius: 10,
  border: '1px solid rgba(20,184,166,0.30)', background: 'rgba(5,12,20,0.80)',
  color: 'rgba(255,255,255,0.92)', fontSize: 15, fontFamily: "'Heebo',sans-serif",
  boxSizing: 'border-box', outline: 'none',
}
const ltrInput: React.CSSProperties = { ...input, direction: 'ltr', textAlign: 'left', fontFamily: 'ui-monospace,Menlo,monospace' }
const label: React.CSSProperties = { fontSize: 13, color: 'rgba(255,255,255,0.60)', fontFamily: "'Heebo',sans-serif", marginBottom: 4 }
const err: React.CSSProperties = { fontSize: 12, color: '#ffb4b4', fontFamily: "'Heebo',sans-serif", marginTop: 3 }

function btn(color: string, filled = false): React.CSSProperties {
  const h = color.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return {
    minHeight: 44, padding: '0 16px', borderRadius: 12, cursor: 'pointer',
    border: `1px solid rgba(${r},${g},${b},${filled ? 0.7 : 0.35})`,
    background: filled ? `linear-gradient(145deg, ${color}, ${color}cc)` : `rgba(${r},${g},${b},0.12)`,
    color: filled ? 'white' : `rgba(${r},${g},${b},1)`,
    fontSize: 14, fontWeight: 700, fontFamily: "'Heebo',sans-serif",
  }
}

// ─── Simple form ────────────────────────────────────────────────────────────

function ContactEditForm({
  initial, isNew, onSaved, onCancel,
}: {
  initial?: LocalFamilyContact
  isNew: boolean
  onSaved: () => void
  onCancel: () => void
}) {
  const [id, setId] = useState(initial?.id ?? '')
  const [displayName, setDisplayName] = useState(initial?.displayName ?? '')
  const [relationshipHebrew, setRel] = useState(initial?.relationshipHebrew ?? '')
  const [phoneE164, setPhone] = useState(initial?.phoneE164 ?? '')
  const [whatsappE164, setWa] = useState(initial?.whatsappE164 ?? '')
  const [enabled, setEnabled] = useState(initial?.enabled ?? true)
  // Uploaded (device-local) photo AND bundled photo are tracked separately so
  // editing a seeded contact never silently drops its bundled photo, and an
  // uploaded photo always wins at render.
  const [photoDataUrl, setPhotoDataUrl] = useState(initial?.photoDataUrl ?? '')
  const [photoFile, setPhotoFile] = useState(initial?.photoFile ?? '')
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [errors, setErrors] = useState<ContactFieldErrors>({})
  const photoInputRef = useRef<HTMLInputElement>(null)
  const meta = personMeta(id)
  const previewPhoto = photoDataUrl || photoFile

  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    setPhotoError('')
    const v = validateImageFile(file)
    if (!v.ok) { setPhotoError(v.error); return }
    setPhotoBusy(true)
    // Resize/compress ON DEVICE (orientation-normalized). Never uploaded anywhere.
    resizeImageToDataUrl(file as File)
      .then((dataUrl) => { setPhotoDataUrl(dataUrl); setPhotoBusy(false) })
      .catch((err: unknown) => { setPhotoError(err instanceof Error ? err.message : 'עיבוד התמונה נכשל'); setPhotoBusy(false) })
  }

  function removePhoto() {
    setPhotoDataUrl(''); setPhotoFile(''); setPhotoError('')
  }

  function save() {
    const errs = validateContactFields({ id, displayName: displayName || undefined, phoneE164, whatsappE164: whatsappE164 || undefined, enabled })
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    const contact: LocalFamilyContact = { id, enabled, phoneE164: phoneE164.trim() }
    if (whatsappE164.trim()) contact.whatsappE164 = whatsappE164.trim()
    if (photoDataUrl) contact.photoDataUrl = photoDataUrl
    if (photoFile) contact.photoFile = photoFile // preserve the bundled photo on edit
    if (displayName.trim()) contact.displayName = displayName.trim()
    if (relationshipHebrew.trim()) contact.relationshipHebrew = relationshipHebrew.trim()
    const r = upsertLocalContact(contact)
    if (!r.ok) { setErrors({ id: r.errors.join(' · ') }); return }
    onSaved()
  }

  return (
    <div data-testid="cm-edit-form" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 0' }}>
      <div>
        <div style={label}>מזהה (id) — אנגלית קטנה/ספרות/מקף</div>
        {isNew ? (
          <>
            <input
              data-testid="cm-field-id" value={id} list="cm-id-suggestions" dir="ltr"
              onChange={(e) => {
                const next = e.target.value.toLowerCase().replace(/\s+/g, '-')
                setId(next)
                // Convenience: picking a known-family id pre-fills its name.
                const m = personMeta(next)
                if (m && displayName.trim() === '') setDisplayName(m.displayName)
              }}
              placeholder="לדוגמה: mor, dr-cohen, saba" style={ltrInput}
            />
            <datalist id="cm-id-suggestions">
              {PERSONS.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
            </datalist>
          </>
        ) : (
          <div data-testid="cm-field-id" style={{ ...ltrInput, display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.6)' }}>{id}</div>
        )}
        {errors.id && <div data-testid="cm-err-id" style={err}>{errors.id}</div>}
      </div>
      <div>
        <div style={label}>שם תצוגה {meta && <span style={{ opacity: 0.5 }}>({meta.displayName})</span>}</div>
        <input data-testid="cm-field-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={meta?.displayName ?? 'שם'} dir="rtl" style={input} />
        {errors.displayName && <div data-testid="cm-err-name" style={err}>{errors.displayName}</div>}
      </div>
      <div>
        <div style={label}>קשר</div>
        <input data-testid="cm-field-rel" value={relationshipHebrew} onChange={(e) => setRel(e.target.value)} placeholder={meta?.relationshipHebrew ?? 'בת, נכד, חבר...'} dir="rtl" style={input} />
      </div>
      <div>
        <div style={label}>טלפון (phoneE164)</div>
        <input data-testid="cm-field-phone" value={phoneE164} onChange={(e) => setPhone(e.target.value)} placeholder="+9725XXXXXXXX או 05XXXXXXXX" dir="ltr" inputMode="tel" style={ltrInput} />
        {errors.phoneE164 && <div data-testid="cm-err-phone" style={err}>{errors.phoneE164}</div>}
      </div>
      <div>
        <div style={label}>וואטסאפ (whatsappE164) — לא חובה</div>
        <input data-testid="cm-field-wa" value={whatsappE164} onChange={(e) => setWa(e.target.value)} placeholder="+9725XXXXXXXX" dir="ltr" inputMode="tel" style={ltrInput} />
        {errors.whatsappE164 && <div data-testid="cm-err-wa" style={err}>{errors.whatsappE164}</div>}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, color: 'rgba(255,255,255,0.85)', fontFamily: "'Heebo',sans-serif", minHeight: 44 }}>
        <input data-testid="cm-field-enabled" type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ width: 22, height: 22 }} />
        פעיל (מציג כפתורי שיחה / וואטסאפ בלוח)
      </label>
      {errors.enabled && <div data-testid="cm-err-enabled" style={err}>{errors.enabled}</div>}
      <div>
        <div style={label}>תמונה — לא חובה (נשמרת במכשיר בלבד)</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Current photo preview, or an initials fallback preview. */}
          {previewPhoto ? (
            <img data-testid="cm-photo-preview" src={previewPhoto} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `2px solid ${TEAL}55` }} />
          ) : (
            <div data-testid="cm-photo-fallback" style={{ width: 56, height: 56, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${TEAL}55`, background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.10), rgba(20,184,166,0.18) 45%, rgba(8,16,28,0.95))`, color: TEAL, fontFamily: "'Cormorant Garamond',serif", fontSize: 24 }}>
              {Array.from((displayName || id || '?').trim())[0] ?? '?'}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            <button type="button" data-testid="cm-photo-choose" onClick={() => photoInputRef.current?.click()} disabled={photoBusy} style={{ ...btn(TEAL), minHeight: 40, opacity: photoBusy ? 0.5 : 1 }}>
              {photoBusy ? 'מעבדת…' : (previewPhoto ? '🖼️ החלפת תמונה' : '🖼️ בחרי תמונה מהמכשיר')}
            </button>
            {previewPhoto && (
              <button type="button" data-testid="cm-photo-remove" onClick={removePhoto} disabled={photoBusy} style={{ ...btn(RED), minHeight: 36 }}>הסרת תמונה</button>
            )}
          </div>
          <input ref={photoInputRef} data-testid="cm-field-photo" type="file" accept="image/*" onChange={onPhoto} style={{ display: 'none' }} />
        </div>
        {photoError && <div data-testid="cm-photo-error" style={err}>{photoError}</div>}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button type="button" data-testid="cm-save" onClick={save} style={{ ...btn(TEAL, true), flex: 1 }}>שמירה ✓</button>
        <button type="button" data-testid="cm-cancel" onClick={onCancel} style={{ ...btn('#ffffff'), flex: 1 }}>ביטול</button>
      </div>
    </div>
  )
}

function SimpleWorkflow({ contacts, refresh }: { contacts: LocalFamilyContact[]; refresh: () => void }) {
  const [editing, setEditing] = useState<string | null>(null) // id | '__NEW__' | null
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  function disable(c: LocalFamilyContact) {
    upsertLocalContact({ ...c, enabled: false }); refresh()
  }
  function del(id: string) { removeLocalContact(id); setConfirmDelete(null); refresh() }

  return (
    <div data-testid="cm-simple" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {contacts.length === 0 && editing !== '__NEW__' && (
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', fontFamily: "'Heebo',sans-serif", textAlign: 'center', padding: '8px 0' }}>
          עדיין לא הוגדרו אנשי קשר במכשיר הזה.
        </div>
      )}
      {contacts.map((c) => {
        const name = c.displayName || personMeta(c.id)?.displayName || c.id
        const rel = c.relationshipHebrew || personMeta(c.id)?.relationshipHebrew || ''
        if (editing === c.id) {
          return <div key={c.id} data-testid={`cm-row-${c.id}`} style={rowBox}><ContactEditForm initial={c} isNew={false} onSaved={() => { setEditing(null); refresh() }} onCancel={() => setEditing(null)} /></div>
        }
        if (confirmDelete === c.id) {
          return (
            <div key={c.id} data-testid={`cm-row-${c.id}`} style={{ ...rowBox, border: `1px solid ${RED}55` }}>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', fontFamily: "'Heebo',sans-serif", marginBottom: 8 }}>למחוק את <strong>{name}</strong> מהמכשיר?</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" data-testid={`cm-delete-confirm-${c.id}`} onClick={() => del(c.id)} style={{ ...btn(RED, true), flex: 1 }}>מחיקה</button>
                <button type="button" onClick={() => setConfirmDelete(null)} style={{ ...btn('#ffffff'), flex: 1 }}>ביטול</button>
              </div>
            </div>
          )
        }
        return (
          <div key={c.id} data-testid={`cm-row-${c.id}`} style={{ ...rowBox, display: 'flex', alignItems: 'center', gap: 10 }}>
            {c.photoDataUrl || c.photoFile
              ? <img src={c.photoDataUrl || c.photoFile} alt="" style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              : <div style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.10), rgba(20,184,166,0.18) 45%, rgba(8,16,28,0.95))`, border: `1.5px solid ${TEAL}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEAL, fontFamily: "'Cormorant Garamond',serif", fontSize: 18 }}>{Array.from(name)[0]}</div>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.92)', fontFamily: "'Heebo',sans-serif" }}>{name} {!c.enabled && <span style={{ fontSize: 12, color: '#ffb4b4' }}>(כבוי)</span>}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: "'Heebo',sans-serif", direction: 'ltr', textAlign: 'right' }}>{rel ? rel + ' · ' : ''}{c.phoneE164 || '—'}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button type="button" data-testid={`cm-edit-${c.id}`} onClick={() => { setEditing(c.id); setConfirmDelete(null) }} style={iconBtn(GOLD)} title="עריכה">✏️</button>
              {c.enabled && <button type="button" data-testid={`cm-disable-${c.id}`} onClick={() => disable(c)} style={iconBtn('#94a3b8')} title="כיבוי">🚫</button>}
              <button type="button" data-testid={`cm-delete-${c.id}`} onClick={() => { setConfirmDelete(c.id); setEditing(null) }} style={iconBtn(RED)} title="מחיקה">🗑️</button>
            </div>
          </div>
        )
      })}

      {editing === '__NEW__' ? (
        <div style={rowBox}><ContactEditForm isNew onSaved={() => { setEditing(null); refresh() }} onCancel={() => setEditing(null)} /></div>
      ) : (
        <button type="button" data-testid="cm-add" onClick={() => { setEditing('__NEW__'); setConfirmDelete(null) }} style={{ ...btn(TEAL), minHeight: 48 }}>➕ הוסיפי איש קשר</button>
      )}
    </div>
  )
}

// ─── Advanced JSON ──────────────────────────────────────────────────────────

/** Honest warning about whether an export/backup embeds private device photos. */
function exportPhotoWarning(all: LocalFamilyContact[]): string {
  const n = all.filter((c) => c.photoDataUrl && c.photoDataUrl.length > 0).length
  return n > 0
    ? `⚠️ הגיבוי כולל ${n} תמונות פרטיות מוטמעות — קובץ רגיש. שמרי אותו במקום בטוח ואל תשתפי בציבור.`
    : 'הגיבוי אינו כולל תמונות פרטיות מוטמעות (רק הפניות לתמונות מובנות).'
}

function downloadJSON(filename: string, text: string) {
  try {
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch { /* best-effort */ }
}

function AdvancedWorkflow({ contacts, refresh }: { contacts: LocalFamilyContact[]; refresh: () => void }) {
  const [draft, setDraft] = useState<string>(() => exportContactsJSON(contacts))
  const [preview, setPreview] = useState<ContactImportPreview | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [confirmReplace, setConfirmReplace] = useState(false)
  const loadFileRef = useRef<HTMLInputElement>(null)

  function validate() {
    setBanner(null); setConfirmReplace(false)
    setPreview(previewImportContacts(draft, contacts))
  }
  function saveMerge() {
    const p = preview ?? previewImportContacts(draft, contacts)
    if (p.parseError) { setPreview(p); return }
    for (const c of p.toSave) upsertLocalContact(c)
    refresh()
    setBanner(`נשמר (מיזוג): ${p.added.length} נוספו, ${p.updated.length} עודכנו, ${p.unchanged.length} ללא שינוי`)
    setPreview(null)
  }
  function replaceAll() {
    const p = preview ?? previewImportContacts(draft, contacts)
    if (p.parseError) { setPreview(p); return }
    // Automatic backup FIRST — the current store, before it is overwritten.
    downloadJSON('abu-contacts-backup-before-replace.json', exportContactsJSON(contacts))
    const next = [...p.added, ...p.updated, ...p.unchanged]
    setLocalContacts(next)
    refresh()
    setBanner(`הוחלף הכל: ${next.length} אנשי קשר נשמרו, ${p.replaceAllRemoves} הוסרו (גובו אוטומטית)`)
    setPreview(null); setConfirmReplace(false)
  }
  // DEFAULT import path: pick a JSON file from the device, read it with
  // FileReader into the box, then auto-validate + preview. No copy-paste needed.
  function onLoadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      setDraft(text)
      setConfirmReplace(false)
      setPreview(previewImportContacts(text, contacts)) // Validate + Preview immediately
      setBanner(`קובץ "${file.name}" נטען — בדקי את התצוגה המקדימה, ואז שמרי`)
    }
    reader.onerror = () => setBanner('לא הצלחתי לקרוא את הקובץ. נסי שוב או הדביקי ידנית.')
    reader.readAsText(file)
  }

  const hasParseError = !!preview?.parseError

  return (
    <div data-testid="cm-advanced" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', fontFamily: "'Heebo',sans-serif", lineHeight: 1.6 }}>
        הדרך המומלצת: טעני קובץ JSON מהמכשיר. מיזוג (Merge) הוא ברירת המחדל: id קיים → עדכון, id חדש → הוספה, id חסר → נשמר.
      </div>

      {/* DEFAULT: load a JSON file from the device (FileReader → box → preview). */}
      <button type="button" data-testid="cm-load-file" onClick={() => loadFileRef.current?.click()} style={{ ...btn(TEAL, true), minHeight: 52 }}>
        📂 טעני קובץ JSON מהמכשיר
      </button>
      <input ref={loadFileRef} data-testid="cm-file-input" type="file" accept=".json,application/json" onChange={onLoadFile} style={{ display: 'none' }} />

      {/* Alternative: manual paste. */}
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: "'Heebo',sans-serif" }}>או הדביקי JSON ידנית:</div>
      <textarea
        data-testid="cm-json"
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setPreview(null) }}
        rows={10}
        spellCheck={false} autoCorrect="off" autoCapitalize="none" autoComplete="off"
        style={{ ...ltrInput, minHeight: 180, resize: 'vertical', fontSize: 12, lineHeight: 1.5, padding: '10px 12px' }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" data-testid="cm-validate" onClick={validate} style={btn(TEAL)}>🔎 בדיקה + תצוגה מקדימה</button>
        <button type="button" data-testid="cm-merge-save" onClick={saveMerge} disabled={!preview || hasParseError} style={{ ...btn(GREEN, true), opacity: (!preview || hasParseError) ? 0.4 : 1 }}>מיזוג ושמירה</button>
        <button type="button" data-testid="cm-export" onClick={() => { const all = getLocalContacts(); setDraft(exportContactsJSON(all)); setBanner(exportPhotoWarning(all)) }} style={btn(GOLD)}>ייצוא JSON</button>
        <button type="button" data-testid="cm-backup" onClick={() => { const all = getLocalContacts(); downloadJSON('abu-contacts-backup.json', exportContactsJSON(all)); setBanner(exportPhotoWarning(all)) }} style={btn(GOLD)}>💾 הורדת גיבוי</button>
      </div>

      {/* Replace-All — strong confirmation, removal count, auto-backup. */}
      {!confirmReplace ? (
        <button type="button" data-testid="cm-replace-all" onClick={() => { const p = preview ?? previewImportContacts(draft, contacts); setPreview(p); if (!p.parseError) setConfirmReplace(true) }} style={{ ...btn(RED), alignSelf: 'flex-start' }}>החלפת הכל (Replace All)</button>
      ) : (
        <div data-testid="cm-replace-confirm" style={{ ...rowBox, border: `1px solid ${RED}66` }}>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.88)', fontFamily: "'Heebo',sans-serif", lineHeight: 1.6, marginBottom: 8 }}>
            פעולה בלתי הפיכה. יישמרו {(preview?.added.length ?? 0) + (preview?.updated.length ?? 0) + (preview?.unchanged.length ?? 0)} אנשי קשר, ו-<strong style={{ color: '#ffb4b4' }}>{preview?.replaceAllRemoves ?? 0}</strong> יוסרו. גיבוי אוטומטי יורד לפני ההחלפה.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" data-testid="cm-replace-confirm-yes" onClick={replaceAll} style={{ ...btn(RED, true), flex: 1 }}>כן, החליפי הכל</button>
            <button type="button" onClick={() => setConfirmReplace(false)} style={{ ...btn('#ffffff'), flex: 1 }}>ביטול</button>
          </div>
        </div>
      )}

      {banner && <div data-testid="cm-banner" style={{ ...rowBox, border: `1px solid ${TEAL}55`, fontSize: 14, color: 'rgba(255,255,255,0.88)', fontFamily: "'Heebo',sans-serif" }}>{banner}</div>}

      {preview && <PreviewPanel p={preview} />}
    </div>
  )
}

function PreviewPanel({ p }: { p: ContactImportPreview }) {
  if (p.parseError) {
    return (
      <div data-testid="cm-preview-error" style={{ ...rowBox, border: `1px solid ${RED}66`, direction: 'ltr', textAlign: 'left' }}>
        <div style={{ fontSize: 14, color: '#ffb4b4', fontFamily: "'Heebo',sans-serif", direction: 'rtl', marginBottom: 6, fontWeight: 700 }}>
          ה-JSON לא תקין — לא נשמר כלום, הרשימה הקיימת לא נגעה בה.
        </div>
        <div style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 12, color: 'rgba(255,255,255,0.8)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {p.parseError}
          {p.parseErrorLine !== null ? `\nline ${p.parseErrorLine} column ${p.parseErrorColumn}` : ''}
          {p.parseErrorOffset !== null ? `\noffset ${p.parseErrorOffset}` : ''}
        </div>
      </div>
    )
  }
  const Row = ({ tag, color, items }: { tag: string; color: string; items: string[] }) => (
    <div style={{ fontSize: 13, fontFamily: "'Heebo',sans-serif", color: 'rgba(255,255,255,0.85)' }}>
      <span style={{ color, fontWeight: 700 }}>{tag}: {items.length}</span>
      {items.length > 0 && <span style={{ color: 'rgba(255,255,255,0.55)' }}> — {items.join(', ')}</span>}
    </div>
  )
  return (
    <div data-testid="cm-preview" style={{ ...rowBox, display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.9)', fontFamily: "'Heebo',sans-serif", marginBottom: 2 }}>תצוגה מקדימה (לפני שמירה):</div>
      <Row tag="נוספים" color={GREEN} items={p.added.map((c) => c.id)} />
      <Row tag="מתעדכנים" color={GOLD} items={p.updated.map((c) => c.id)} />
      <Row tag="ללא שינוי" color="#94a3b8" items={p.unchanged.map((c) => c.id)} />
      <Row tag="כפולים" color="#fb923c" items={p.duplicate.map((d) => d.id)} />
      <div data-testid="cm-preview-invalid" style={{ fontSize: 13, fontFamily: "'Heebo',sans-serif", color: '#ffb4b4' }}>
        לא תקינים: {p.invalid.length}
        {p.invalid.map((iv, i) => <div key={i} style={{ fontSize: 12, color: 'rgba(255,180,180,0.85)' }}>• פריט {iv.index}{iv.id ? ` (${iv.id})` : ''}: {iv.reason}</div>)}
      </div>
    </div>
  )
}

// ─── Root ───────────────────────────────────────────────────────────────────

export function ContactManagement() {
  const [contacts, setContacts] = useState<LocalFamilyContact[]>(() => getLocalContacts())
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple')
  const refresh = () => setContacts(getLocalContacts())

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onUpd = () => setContacts(getLocalContacts())
    window.addEventListener(CONTACTS_UPDATED_EVENT, onUpd)
    return () => window.removeEventListener(CONTACTS_UPDATED_EVENT, onUpd)
  }, [])

  return (
    <div data-testid="contact-management" style={{ display: 'flex', flexDirection: 'column', gap: 12, direction: 'rtl' }}>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: "'Heebo',sans-serif", lineHeight: 1.6 }}>
        המספרים נשמרים במכשיר הזה בלבד. אפשר להוסיף, לערוך או למחוק כל איש קשר — הלוח מתעדכן מיד.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" data-testid="cm-tab-simple" onClick={() => setMode('simple')} style={{ ...btn(TEAL, mode === 'simple'), flex: 1 }}>טופס פשוט</button>
        <button type="button" data-testid="cm-tab-advanced" onClick={() => setMode('advanced')} style={{ ...btn(GOLD, mode === 'advanced'), flex: 1 }}>מתקדם — JSON</button>
      </div>
      {mode === 'simple'
        ? <SimpleWorkflow contacts={contacts} refresh={refresh} />
        : <AdvancedWorkflow contacts={contacts} refresh={refresh} />}
    </div>
  )
}

const rowBox: React.CSSProperties = {
  borderRadius: 12, padding: '12px 14px',
  background: 'rgba(8,16,28,0.6)', border: '1px solid rgba(20,184,166,0.18)',
}

function iconBtn(color: string): React.CSSProperties {
  const h = color.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return {
    width: 44, height: 44, borderRadius: 11, flexShrink: 0, cursor: 'pointer',
    background: `rgba(${r},${g},${b},0.12)`, border: `1px solid rgba(${r},${g},${b},0.28)`,
    fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
}

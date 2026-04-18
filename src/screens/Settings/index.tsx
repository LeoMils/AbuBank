import { useMemo, useState, useEffect, useRef } from 'react'
import { useAppStore } from '../../state/store'
import { Screen } from '../../state/types'
import { BackButton } from '../../components/BackButton'
import { getRandomMartitaPhoto, handleMartitaImgError } from '../../services/martitaPhotos'

const TEAL = '#14b8a6'
const GOLD = '#C9A84C'

// ─── WhatsApp ──────────────────────────────────────────────────
const WA_GROUP = 'https://chat.whatsapp.com/JqqGpPKTCq3L0JnitU5y5f'

// Martita's REAL voice — verbatim from actual WhatsApp family chat
const MARTITA_MESSAGES = [
  'הי משפחה אהובה שלי רוצה להזמין את כולם לארוחה ביום שישי אצלי.רק תגידו לי מי באה ו מה מביאים.אוהבת אתכם מאוד.אבו ❤️',
  'שבת שלום לכל היקרים שלי 💛',
  'משפחה האהובה שלי. אתם מוזמנים לבוא ביום שישי שנאכל ביחד. תביאו יין ו משהו טעים.אבו ❤️',
  'איזא יופי!!!! יפים שלנו!!!!!! ❤️💚',
  'ישששששש!! חמודותתת שלנו!!!!',
  'Jajaja אוהבת אתכם מאוד מאוד 💋💚❤',
  'משפחה אהובה שלי.אני מזמינה אותכם לארוחה ביום ששי בבית שלי.וגם להביא יין.תבואו בשעה 7',
  'חמודים שלנו!! מתי באים לבקר? 😍❤️',
  'מאכלת לכולם הרבה בריאות ו שמחות ו רק דברים טובים.אוהבת!!!!אבו',
  'יפים שלנו!!!!!! אוהבת אתכם מאוד מאוד מאוד ❤💚💜',
]

// ─── Contacts (localStorage) ──────────────────────────────────
type Contact = {
  id: string
  name: string
  phone: string
  relation: string
}

const EMERGENCY: Contact[] = [
  { id: 'e1', name: 'מד״א',      phone: '101',   relation: 'חירום' },
  { id: 'e2', name: 'משטרה',     phone: '100',   relation: 'חירום' },
  { id: 'e3', name: 'כיבוי אש', phone: '102',   relation: 'חירום' },
  { id: 'e4', name: 'רופא תורן', phone: '*3066', relation: 'חירום' },
]

const EMERGENCY_ICONS: Record<string, string> = {
  e1: '🚑', e2: '🚔', e3: '🚒', e4: '👨‍⚕️',
}

const STORAGE_KEY = 'martita-contacts-v1'
export const LOC_CONTACTS_KEY = 'martita-loc-contacts-v1'

export type LocContact = { id: string; name: string; phone: string }

export function loadLocContacts(): LocContact[] {
  try {
    const raw = localStorage.getItem(LOC_CONTACTS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as LocContact[]
  } catch { return [] }
}

function saveLocContacts(cs: LocContact[]) {
  localStorage.setItem(LOC_CONTACTS_KEY, JSON.stringify(cs))
}

function loadContacts(): Contact[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Contact[]
  } catch {
    return []
  }
}

function saveContacts(contacts: Contact[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts))
}

// ─── Helpers ──────────────────────────────────────────────────
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  return `${parseInt(h.substring(0,2),16)},${parseInt(h.substring(2,4),16)},${parseInt(h.substring(4,6),16)}`
}

function openLink(url: string) { window.location.href = url }

function waLink(phone: string, msg: string): string {
  const clean = phone.replace(/\D/g, '')
  const intl = clean.startsWith('0') ? '972' + clean.slice(1) : clean
  return `https://wa.me/${intl}?text=${encodeURIComponent(msg)}`
}

function randomMsg(): string {
  const idx = Math.floor(Math.random() * MARTITA_MESSAGES.length)
  return MARTITA_MESSAGES[idx] ?? MARTITA_MESSAGES[0] ?? 'שלומ! 💕'
}

// ─── Sub-components ──────────────────────────────────────────

// Contact form (add/edit)
function ContactForm({
  initial, onSave, onCancel,
}: {
  initial?: Partial<Contact>
  onSave: (c: Omit<Contact, 'id'>) => void
  onCancel: () => void
}) {
  const [name, setName]     = useState(initial?.name ?? '')
  const [phone, setPhone]   = useState(initial?.phone ?? '')
  const [relation, setRelation] = useState(initial?.relation ?? '')
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => { nameRef.current?.focus() }, [])

  function submit() {
    if (!name.trim() || !phone.trim()) return
    onSave({ name: name.trim(), phone: phone.trim(), relation: relation.trim() })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0 0' }}>
      <input
        ref={nameRef}
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="שם"
        dir="rtl"
        style={inputStyle}
      />
      <input
        value={phone}
        onChange={e => setPhone(e.target.value)}
        placeholder="מספר טלפון"
        type="tel"
        dir="ltr"
        style={inputStyle}
      />
      <input
        value={relation}
        onChange={e => setRelation(e.target.value)}
        placeholder="קשר (בן, בת, נכד...)"
        dir="rtl"
        style={inputStyle}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={submit} disabled={!name.trim() || !phone.trim()} style={{
          flex: 1, padding: '12px 0', borderRadius: 12, border: 'none',
          background: name.trim() && phone.trim() ? TEAL : 'rgba(20,184,166,0.3)',
          color: 'white', fontSize: 15, fontFamily: "'Heebo',sans-serif",
          fontWeight: 600, cursor: name.trim() && phone.trim() ? 'pointer' : 'default',
        }}>
          שמירה ✓
        </button>
        <button onClick={onCancel} style={{
          flex: 1, padding: '12px 0', borderRadius: 12,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
          color: 'rgba(255,255,255,0.7)', fontSize: 15, fontFamily: "'Heebo',sans-serif",
          cursor: 'pointer',
        }}>
          ביטול
        </button>
      </div>
    </div>
  )
}

// ─── Main Settings screen ─────────────────────────────────────
export function Settings() {
  const setScreen      = useAppStore(s => s.setScreen)
  const appVersion     = useAppStore(s => s.appVersion)
  const martitaPhoto   = useMemo(() => getRandomMartitaPhoto(), [])

  // Section accordion
  const [openSection, setOpenSection] = useState<string | null>(null)
  function toggle(id: string) { setOpenSection(p => p === id ? null : id) }

  // WhatsApp state
  const [selectedMsg, setSelectedMsg] = useState(() => randomMsg())
  const [msgCopied, setMsgCopied]     = useState(false)

  function copyMsg() {
    navigator.clipboard.writeText(selectedMsg).then(() => {
      setMsgCopied(true)
      setTimeout(() => setMsgCopied(false), 2500)
    })
  }

  function newMsg() {
    setSelectedMsg(randomMsg())
    setMsgCopied(false)
  }

  // Contacts state
  const [contacts, setContacts]   = useState<Contact[]>(loadContacts)
  const [addingContact, setAdding] = useState(false)
  const [editingId, setEditingId]  = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  function saveContact(data: Omit<Contact, 'id'>) {
    if (editingId) {
      const updated = contacts.map(c => c.id === editingId ? { ...c, ...data } : c)
      setContacts(updated)
      saveContacts(updated)
      setEditingId(null)
    } else {
      const newC: Contact = { ...data, id: `c${Date.now()}` }
      const updated = [...contacts, newC]
      setContacts(updated)
      saveContacts(updated)
      setAdding(false)
    }
  }

  function deleteContact(id: string) {
    const updated = contacts.filter(c => c.id !== id)
    setContacts(updated)
    saveContacts(updated)
    setConfirmDelete(null)
  }

  // Location contacts
  const [locContacts, setLocContacts] = useState<LocContact[]>(loadLocContacts)
  const [addingLoc, setAddingLoc]     = useState(false)
  const [locName, setLocName]         = useState('')
  const [locPhone, setLocPhone]       = useState('')

  function saveNewLocContact() {
    if (!locName.trim() || !locPhone.trim()) return
    const updated = [...locContacts, { id: `lc${Date.now()}`, name: locName.trim(), phone: locPhone.trim() }].slice(0, 3)
    setLocContacts(updated); saveLocContacts(updated)
    setLocName(''); setLocPhone(''); setAddingLoc(false)
  }
  function deleteLocContact(id: string) {
    const updated = locContacts.filter(c => c.id !== id)
    setLocContacts(updated); saveLocContacts(updated)
  }

  // Location map
  const [locStatus, setLocStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  function openMyLocation() {
    setLocStatus('loading')
    if (!navigator.geolocation) {
      setLocStatus('done')
      openLink('https://maps.google.com/maps?q=my+location')
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocStatus('done')
        // Open Google Maps zoomed in on exact GPS coordinates
        openLink(`https://maps.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}&z=17`)
      },
      () => {
        // Permission denied or timeout — let Google Maps find location on its own
        setLocStatus('done')
        openLink('https://maps.google.com/maps?q=my+location')
      },
      { timeout: 6000, maximumAge: 300000, enableHighAccuracy: false },
    )
  }

  // ─── Render helpers ──────────────────────────────────────────

  const sectionsData = [
    // ── 1. WhatsApp ──────────────────────────────────────────
    {
      id: 'whatsapp',
      icon: '💬',
      color: '#25D366',
      label: 'WhatsApp משפחה',
      desc: 'שליחת הודעה ופתיחת הקבוצה',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Message preview */}
          <div style={{
            borderRadius: 12, padding: '12px 14px',
            background: 'rgba(37,211,102,0.07)',
            border: '1px solid rgba(37,211,102,0.22)',
            direction: 'rtl', lineHeight: 1.7,
            fontSize: 15, color: 'rgba(255,255,255,0.88)',
            fontFamily: "'Heebo',sans-serif",
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {selectedMsg}
          </div>

          {/* Message actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={newMsg} style={{
              flex: 1, padding: '10px 0', borderRadius: 10,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.75)', fontSize: 13,
              fontFamily: "'Heebo',sans-serif", cursor: 'pointer',
            }}>
              🔄 הודעה אחרת
            </button>
            <button onClick={copyMsg} style={{
              flex: 1, padding: '10px 0', borderRadius: 10,
              background: msgCopied ? 'rgba(37,211,102,0.25)' : 'rgba(37,211,102,0.12)',
              border: '1px solid rgba(37,211,102,0.30)',
              color: msgCopied ? '#25D366' : 'rgba(255,255,255,0.80)', fontSize: 13,
              fontFamily: "'Heebo',sans-serif", cursor: 'pointer',
              fontWeight: msgCopied ? 700 : 400,
            }}>
              {msgCopied ? '✅ הועתק!' : '📋 העתקי'}
            </button>
          </div>

          {/* Send — opens WhatsApp APP with message pre-filled */}
          <button onClick={() => {
            openLink(`whatsapp://send?text=${encodeURIComponent(selectedMsg)}`)
          }} style={{ ...btnStyle('#25D366'), background: 'rgba(37,211,102,0.18)', border: '1px solid rgba(37,211,102,0.45)', fontWeight: 600 }}>
            <span>📲</span> שלחי למשפחה ב WhatsApp
          </button>

          {/* Tip */}
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', textAlign: 'right', direction: 'rtl', lineHeight: 1.5 }}>
            💡 WhatsApp ייפתח עם ההודעה מוכנה — בחרי את קבוצת המשפחה ושלחי
          </div>
        </div>
      ),
    },

    // ── 2. Contacts ──────────────────────────────────────────
    {
      id: 'contacts',
      icon: '👥',
      color: '#a855f7',
      label: 'אנשי קשר',
      desc: 'חברים, משפחה ושירותי חירום',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

          {/* Personal contacts */}
          {contacts.length > 0 && (
            <>
              <div style={sectionLabel}>אנשי קשר שלי</div>
              {contacts.map(c => (
                <div key={c.id}>
                  {editingId === c.id ? (
                    <div style={{ borderRadius: 12, padding: '12px', background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.22)' }}>
                      <ContactForm
                        initial={c}
                        onSave={saveContact}
                        onCancel={() => setEditingId(null)}
                      />
                    </div>
                  ) : confirmDelete === c.id ? (
                    <div style={{ borderRadius: 12, padding: '12px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.80)', textAlign: 'right', direction: 'rtl' }}>
                        למחוק את <strong>{c.name}</strong>?
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => deleteContact(c.id)} style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', background: '#ef4444', color: 'white', fontSize: 14, fontFamily: "'Heebo',sans-serif", cursor: 'pointer', fontWeight: 600 }}>מחיקה</button>
                        <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: '9px 0', borderRadius: 9, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: "'Heebo',sans-serif", cursor: 'pointer' }}>ביטול</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ borderRadius: 12, padding: '10px 14px', background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.18)', display: 'flex', alignItems: 'center', gap: 10, direction: 'rtl' }}>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.92)', fontFamily: "'Heebo',sans-serif" }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontFamily: "'Heebo',sans-serif" }}>{c.relation} · {c.phone}</div>
                      </div>
                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {/* Call */}
                        <button onClick={() => openLink(`tel:${c.phone}`)} style={iconBtn('#22c55e')} title="התקשרי">
                          📞
                        </button>
                        {/* WhatsApp — with Martita message pre-filled */}
                        <button onClick={() => openLink(waLink(c.phone, `שלומ ${c.name}! 💕 `))} style={iconBtn('#25D366')} title="WhatsApp">
                          💬
                        </button>
                        {/* Edit */}
                        <button onClick={() => { setEditingId(c.id); setAdding(false); setConfirmDelete(null) }} style={iconBtn('#f59e0b')} title="עריכה">
                          ✏️
                        </button>
                        {/* Delete */}
                        <button onClick={() => { setConfirmDelete(c.id); setEditingId(null) }} style={iconBtn('#ef4444')} title="מחיקה">
                          🗑️
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {/* Add contact form */}
          {addingContact ? (
            <div style={{ borderRadius: 12, padding: '12px', background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.30)', marginTop: 4 }}>
              <div style={sectionLabel}>איש קשר חדש</div>
              <ContactForm onSave={saveContact} onCancel={() => setAdding(false)} />
            </div>
          ) : (
            <button onClick={() => { setAdding(true); setEditingId(null); setConfirmDelete(null) }} style={{
              ...btnStyle('#a855f7'),
              marginTop: contacts.length > 0 ? 4 : 0,
            }}>
              <span>➕</span> הוסיפי איש קשר חדש
            </button>
          )}

          {/* Emergency numbers — always visible, non-editable */}
          <div style={{ ...sectionLabel, marginTop: 8 }}>מספרי חירום</div>
          {EMERGENCY.map(e => (
            <button key={e.id} onClick={() => openLink(`tel:${e.phone}`)} style={{ ...btnStyle('#ef4444'), justifyContent: 'flex-start' }}>
              <span>{EMERGENCY_ICONS[e.id]}</span>
              <span style={{ fontWeight: 600 }}>{e.name}</span>
              <span style={{ marginRight: 'auto', fontSize: 17, fontWeight: 700, letterSpacing: 1, fontFamily: 'monospace' }}>{e.phone}</span>
            </button>
          ))}
        </div>
      ),
    },

    // ── 3. Location ──────────────────────────────────────────
    {
      id: 'location',
      icon: '📍',
      color: '#3b82f6',
      label: 'מיקום וניווט',
      desc: 'Google Maps ו-Waze',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* ── Location contacts — who gets the location ── */}
          <div style={sectionLabel}>לאן לשלוח את המיקום? (עד 3)</div>

          {locContacts.map(c => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, direction: 'rtl',
              borderRadius: 12, padding: '10px 14px',
              background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.18)',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.92)', fontFamily: "'Heebo',sans-serif" }}>{c.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)', fontFamily: "'Heebo',sans-serif" }}>{c.phone}</div>
              </div>
              <button onClick={() => deleteLocContact(c.id)} style={iconBtn('#ef4444')} title="הסירי">🗑️</button>
            </div>
          ))}

          {locContacts.length < 3 && (
            addingLoc ? (
              <div style={{ borderRadius: 12, padding: 12, background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.28)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input value={locName} onChange={e => setLocName(e.target.value)}
                  placeholder="שם (למשל: מור)" dir="rtl" style={inputStyle} />
                <input value={locPhone} onChange={e => setLocPhone(e.target.value)}
                  placeholder="מספר טלפון" type="tel" dir="ltr" style={inputStyle} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={saveNewLocContact} disabled={!locName.trim() || !locPhone.trim()}
                    style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: 'none',
                      background: locName.trim() && locPhone.trim() ? '#3b82f6' : 'rgba(59,130,246,0.3)',
                      color: 'white', fontSize: 15, fontFamily: "'Heebo',sans-serif", fontWeight: 600, cursor: 'pointer' }}>
                    שמירה ✓
                  </button>
                  <button onClick={() => { setAddingLoc(false); setLocName(''); setLocPhone('') }}
                    style={{ flex: 1, padding: '11px 0', borderRadius: 10,
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                      color: 'rgba(255,255,255,0.7)', fontSize: 15, fontFamily: "'Heebo',sans-serif", cursor: 'pointer' }}>
                    ביטול
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingLoc(true)} style={btnStyle('#3b82f6')}>
                <span>➕</span> הוסיפי איש קשר למיקום
              </button>
            )
          )}

          {locContacts.length > 0 && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', textAlign: 'right', direction: 'rtl', lineHeight: 1.6 }}>
              💡 כשתלחצי על כפתור המיקום — WhatsApp ייפתח ישירות לאיש הקשר עם המיקום המדויק. רק לחצי שלח.
            </div>
          )}

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '2px 0' }}/>

          {/* ── Navigation buttons ── */}
          <button onClick={openMyLocation} style={btnStyle('#3b82f6')} disabled={locStatus === 'loading'}>
            <span>{locStatus === 'loading' ? '⏳' : '🗺️'}</span>
            {locStatus === 'loading' ? 'מאתרת מיקום...' : 'פתחי ב Google Maps'}
          </button>
          <button onClick={() => openLink('https://waze.com')} style={btnStyle('#33ccff')}>
            <span>🚗</span> Waze ניווט
          </button>
        </div>
      ),
    },

    // ── 4. Services ───────────────────────────────────────────
    {
      id: 'services',
      icon: '🔗',
      color: TEAL,
      label: 'שירותים מהירים',
      desc: 'גישה ישירה לכל השירותים',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { label: 'מזרחי טפחות',      url: 'https://www.mizrahi-tefahot.co.il', color: '#0ea5e9' },
            { label: 'דואר ישראל',        url: 'https://www.israelpost.co.il',      color: '#e11d48' },
            { label: 'MAX',               url: 'https://www.max.co.il',             color: '#2563eb' },
            { label: 'חברת החשמל',        url: 'https://www.iec.co.il',             color: '#f59e0b' },
            { label: 'מפעל המים',         url: 'https://www.mekorot.co.il',         color: '#06b6d4' },
            { label: 'ארנונה כפר סבא',    url: 'https://www.kfar-saba.muni.il',     color: '#84cc16' },
            { label: 'HOT mobile',        url: 'https://www.hot.net.il',            color: '#f97316' },
            { label: 'פרטנר',             url: 'https://www.partner.co.il',         color: '#1a1a2e' },
            { label: 'yes',               url: 'https://www.yes.co.il',             color: '#7c3aed' },
          ].map(s => (
            <button key={s.label} onClick={() => openLink(s.url)} style={{ ...btnStyle(s.color), justifyContent: 'flex-start' }}>
              <span style={{ flex: 1, textAlign: 'right', direction: 'rtl' }}>{s.label}</span>
              <span style={{ fontSize: 12, opacity: 0.5 }}>↗</span>
            </button>
          ))}
        </div>
      ),
    },

    // ── 5. About ──────────────────────────────────────────────
    {
      id: 'about',
      icon: '⭐',
      color: GOLD,
      label: 'אודות AbuBank',
      desc: 'הפורטל האישי של Martita',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', textAlign: 'center' }}>
          <div style={{ fontSize: 46 }}>👑</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'white', fontFamily: "'DM Sans',sans-serif" }}>AbuBank</div>
          <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.60)', lineHeight: 1.8, direction: 'rtl', fontFamily: "'Heebo',sans-serif" }}>
            הפורטל הפרטי של Martita.{'\n'}
            עם אהבה — גישה קלה לכל השירותים.
          </div>
          <div style={{ fontSize: 12, color: `rgba(${hexToRgb(GOLD)},0.55)`, marginTop: 2 }}>
            v{appVersion || '1.0.0'} · {new Date().getFullYear()}
          </div>
        </div>
      ),
    },
  ]

  return (
    <div dir="rtl" style={{
      height: '100%', width: '100%', overflowY: 'auto', overflowX: 'hidden',
      background: '#050A18',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'DM Sans','Heebo',sans-serif",
    }}>

      {/* ─── HEADER ─── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 72, flexShrink: 0, padding: '0 16px', position: 'relative',
        background: 'linear-gradient(180deg, rgba(14,22,44,1) 0%, rgba(5,10,24,1) 100%)',
        borderBottom: '1px solid rgba(201,168,76,0.18)',
      }}>
        <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
          <BackButton />
        </div>

        <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 3, direction: 'ltr' }}>
          <span style={{
            fontFamily: "'Cormorant Garamond',Georgia,serif",
            fontSize: 28, fontWeight: 600, letterSpacing: '2px',
            background: 'linear-gradient(135deg, #5EEAD4 0%, #2DD4BF 20%, #0D9488 45%, #5EEAD4 80%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            filter: 'drop-shadow(0 0 10px rgba(94,234,212,0.35))',
          } as React.CSSProperties}>Abu</span>
          <span style={{
            fontFamily: "'DM Sans',sans-serif",
            fontSize: 26, fontWeight: 500, letterSpacing: '1px',
            background: 'linear-gradient(135deg, #F8FAFC 0%, #CBD5E1 30%, #F1F5F9 60%, #94A3B8 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          } as React.CSSProperties}>הגדרות</span>
        </div>

        <div style={{
          position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
          width: 46, height: 46, borderRadius: '50%',
          border: '2px solid rgba(201,168,76,0.50)',
          boxShadow: '0 0 14px rgba(201,168,76,0.18)',
          overflow: 'hidden',
        }}>
          <img src={martitaPhoto} alt="Martita" loading="eager"
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%', display: 'block' }}
            onError={handleMartitaImgError}
          />
        </div>
      </header>

      {/* ─── SECTIONS ─── */}
      <div style={{ padding: '14px 14px 40px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sectionsData.map(section => {
          const isOpen = openSection === section.id
          const rgb = hexToRgb(section.color)
          return (
            <div key={section.id} style={{
              borderRadius: 16, overflow: 'hidden',
              border: `1px solid rgba(${rgb},${isOpen ? 0.35 : 0.18})`,
              background: isOpen
                ? `linear-gradient(135deg, rgba(${rgb},0.09), rgba(${rgb},0.03))`
                : 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
              boxShadow: isOpen
                ? `0 4px 20px rgba(${rgb},0.12), 0 2px 6px rgba(0,0,0,0.25)`
                : '0 2px 8px rgba(0,0,0,0.18)',
              transition: 'all 0.22s ease',
            }}>
              <button
                type="button"
                onClick={() => toggle(section.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                  padding: '15px 18px', background: 'none', border: 'none', cursor: 'pointer',
                  textAlign: 'right',
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  background: `linear-gradient(135deg, rgba(${rgb},0.20), rgba(${rgb},0.07))`,
                  border: `1.5px solid rgba(${rgb},0.28)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20,
                }}>
                  {section.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                  <div style={{ fontSize: 17, fontWeight: 600, color: 'rgba(255,255,255,0.94)', fontFamily: "'Heebo',sans-serif", lineHeight: 1.3 }}>
                    {section.label}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontFamily: "'Heebo',sans-serif", marginTop: 2 }}>
                    {section.desc}
                  </div>
                </div>
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none"
                  stroke={`rgba(${rgb},0.65)`} strokeWidth="2.5" strokeLinecap="round"
                  style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.20s ease', flexShrink: 0 }}>
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>

              {isOpen && (
                <div style={{ padding: '0 18px 18px' }}>
                  <div style={{ height: 1, background: `rgba(${rgb},0.16)`, marginBottom: 14 }}/>
                  {section.content}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ position: 'fixed', bottom: 8, left: 12, fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', color: 'rgba(201,168,76,0.30)', fontFamily: "'DM Sans',monospace", pointerEvents: 'none', zIndex: 1 }}>v15.0</div>
    </div>
  )
}

// ─── Shared styles ─────────────────────────────────────────────
function btnStyle(color: string): React.CSSProperties {
  const h = color.replace('#', '')
  const r = parseInt(h.substring(0,2),16)
  const g = parseInt(h.substring(2,4),16)
  const b = parseInt(h.substring(4,6),16)
  return {
    display: 'flex', alignItems: 'center', gap: 10,
    width: '100%', padding: '13px 16px', borderRadius: 12,
    background: `rgba(${r},${g},${b},0.10)`,
    border: `1px solid rgba(${r},${g},${b},0.22)`,
    color: 'rgba(255,255,255,0.90)', fontSize: 15,
    fontFamily: "'Heebo',sans-serif", fontWeight: 500,
    cursor: 'pointer', textAlign: 'right',
    boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
  }
}

function iconBtn(color: string): React.CSSProperties {
  const h = color.replace('#', '')
  const r = parseInt(h.substring(0,2),16)
  const g = parseInt(h.substring(2,4),16)
  const b = parseInt(h.substring(4,6),16)
  return {
    width: 48, height: 48, borderRadius: 12, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: `rgba(${r},${g},${b},0.12)`,
    border: `1px solid rgba(${r},${g},${b},0.22)`,
    fontSize: 16, cursor: 'pointer',
  }
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
  color: 'rgba(255,255,255,0.88)', fontSize: 15,
  fontFamily: "'Heebo',sans-serif", outline: 'none',
  boxSizing: 'border-box',
}

const sectionLabel: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.38)',
  letterSpacing: '0.8px', textAlign: 'right', direction: 'rtl',
  fontFamily: "'Heebo',sans-serif", textTransform: 'uppercase',
  padding: '2px 0',
}

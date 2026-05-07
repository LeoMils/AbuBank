import { useEffect, useRef, useState } from 'react'
import { FAMILY_QUICK_FACES, type FamilyQuickFace } from './familyContacts.private'
import { getLocalContacts, type LocalFamilyContact } from './familyContactsStorage'
import { APP_VERSION } from '../../version'

const WA_GREEN = '#25D366'
const TEAL = '#14b8a6'
const GOLD = '#C9A84C'

// ─── Phone & URL helpers (unchanged contracts; existing tests pin them) ────

export function sanitizePhoneE164(raw: string): string {
  if (typeof raw !== 'string') return ''
  return raw.replace(/[^\d]/g, '')
}

export function isValidPhoneE164(raw: string): boolean {
  if (typeof raw !== 'string') return false
  if (!raw.startsWith('+')) return false
  const digits = sanitizePhoneE164(raw)
  return digits.length >= 8 && digits.length <= 15
}

export function buildWhatsAppPersonUrl(face: Extract<FamilyQuickFace, { type: 'person' }>): string {
  const target = face.whatsappE164 && face.whatsappE164.length > 0 ? face.whatsappE164 : face.phoneE164
  return `https://wa.me/${sanitizePhoneE164(target)}`
}

export function buildTelUrl(face: Extract<FamilyQuickFace, { type: 'person' }>): string {
  return `tel:+${sanitizePhoneE164(face.phoneE164)}`
}

// ─── Visibility & merge ─────────────────────────────────────────────────────

/**
 * Filter to only entries that should appear in the unified bubble grid.
 * Group: needs an enabled flag and a non-empty whatsappUrl.
 * Person: needs an enabled flag and a valid E.164 phone (so WhatsApp/tel
 * links work). Persons without a phone are intentionally NOT shown — the
 * operator must configure a phone first.
 */
export function getVisibleFaces(faces: ReadonlyArray<FamilyQuickFace> = FAMILY_QUICK_FACES): FamilyQuickFace[] {
  return faces.filter(f => {
    if (!f.enabled) return false
    if (f.type === 'group') return typeof f.whatsappUrl === 'string' && f.whatsappUrl.length > 0
    return isValidPhoneE164(f.phoneE164)
  })
}

/**
 * Merge static scaffold (names + relationships + group URL, no real numbers)
 * with localStorage-only per-person overrides (phone/whatsapp/photo/enabled).
 */
export function mergeFacesWithLocal(
  scaffold: ReadonlyArray<FamilyQuickFace> = FAMILY_QUICK_FACES,
  local: ReadonlyArray<LocalFamilyContact> = [],
): FamilyQuickFace[] {
  const byId = new Map<string, LocalFamilyContact>()
  for (const c of local) byId.set(c.id, c)
  return scaffold.map((f) => {
    if (f.type !== 'person') return { ...f }
    const override = byId.get(f.id)
    if (!override) return { ...f }
    const merged: Extract<FamilyQuickFace, { type: 'person' }> = {
      type: 'person',
      id: f.id,
      displayName: f.displayName,
      phoneE164: override.phoneE164 || '',
      enabled: override.enabled === true,
    }
    if (f.relationshipHebrew !== undefined) merged.relationshipHebrew = f.relationshipHebrew
    if (override.whatsappE164 && override.whatsappE164.length > 0) merged.whatsappE164 = override.whatsappE164
    if (override.photoDataUrl && override.photoDataUrl.length > 0) merged.photoFile = override.photoDataUrl
    else if (override.photoFile && override.photoFile.length > 0) merged.photoFile = override.photoFile
    return merged
  })
}

export function computeInitials(displayName: string): string {
  const trimmed = (displayName || '').trim()
  if (!trimmed) return '?'
  const first = Array.from(trimmed)[0]
  return first || '?'
}

// ─── Unified bubble grid ───────────────────────────────────────────────────
//
// Same component renders both group and person tiles. Same circle size,
// same label style, same spacing, same gradient. The only difference is
// the photo/initials content and the tap action.

const BUBBLE_SIZE = 96     // px — single canonical size for every tile
const BUBBLE_LABEL_FONT = 16

interface FamilyQuickFacesProps {
  /** Tap a target with a chosen action. type='url' → open URL same-tab. */
  onOpenWhatsApp: (url: string) => void
  onOpenTel: (url: string) => void
  /** Operator-only setup hand-off (long-press the screen title). */
  onOperatorSetup?: () => void
  /** Test/Storybook hook. Defaults to localStorage at mount. */
  localContacts?: ReadonlyArray<LocalFamilyContact>
}

type ActionKind = 'whatsapp' | 'call'

interface ActionSheetState {
  face: Extract<FamilyQuickFace, { type: 'person' }>
}

export function FamilyQuickFaces({ onOpenWhatsApp, onOpenTel, onOperatorSetup, localContacts }: FamilyQuickFacesProps) {
  const [contacts, setContacts] = useState<ReadonlyArray<LocalFamilyContact>>(localContacts ?? [])
  useEffect(() => {
    if (localContacts !== undefined) { setContacts(localContacts); return }
    setContacts(getLocalContacts())
  }, [localContacts])

  const merged = mergeFacesWithLocal(FAMILY_QUICK_FACES, contacts)
  const visible = getVisibleFaces(merged)

  // Persons with no valid phone yet — kept for the friendly "המספר עדיין לא הוגדר"
  // path so Martita sees a tile and gets a soft message instead of nothing.
  // We render tiles for *every scaffold person*, valid or not. Group always
  // first if enabled.
  const allPersons = merged.filter((f) => f.type === 'person') as Extract<FamilyQuickFace, { type: 'person' }>[]
  const group = merged.find((f) => f.type === 'group' && f.enabled) as Extract<FamilyQuickFace, { type: 'group' }> | undefined

  // The visible-set rule above is preserved for tests, but the grid below
  // also surfaces persons without a phone so they get the friendly message.
  // Anabel/Ari and other scaffold-only entries with no override remain hidden
  // until a local override exists — that gates by .enabled, not by phone.
  const personsForGrid = allPersons.filter((p) => {
    // Hide pure scaffold (no override at all) so the grid stays clean.
    return contacts.some((c) => c.id === p.id)
  })

  const [actionSheet, setActionSheet] = useState<ActionSheetState | null>(null)
  const [toast, setToast] = useState<string>('')
  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast((cur) => (cur === msg ? '' : cur)), 2400)
  }

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handlePressStart = () => {
    if (!onOperatorSetup) return
    longPressTimer.current = setTimeout(() => { onOperatorSetup() }, 1500)
  }
  const handlePressEnd = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
  }

  function handleTapGroup() {
    if (!group || !group.whatsappUrl) {
      showToast('קבוצת המשפחה עדיין לא הוגדרה')
      return
    }
    onOpenWhatsApp(group.whatsappUrl)
  }

  function handleTapPerson(face: Extract<FamilyQuickFace, { type: 'person' }>) {
    if (!isValidPhoneE164(face.phoneE164)) {
      showToast('המספר עדיין לא הוגדר')
      return
    }
    setActionSheet({ face })
  }

  function handleActionChoice(kind: ActionKind) {
    if (!actionSheet) return
    const face = actionSheet.face
    setActionSheet(null)
    if (kind === 'whatsapp') onOpenWhatsApp(buildWhatsAppPersonUrl(face))
    else if (kind === 'call') onOpenTel(buildTelUrl(face))
  }

  return (
    <div
      data-testid="family-quick-faces"
      style={{
        width: '100%', maxWidth: 460,
        display: 'flex', flexDirection: 'column', alignItems: 'stretch',
        gap: 16,
        direction: 'rtl',
      }}
    >
      <header
        data-testid="abuwhatsapp-header"
        onPointerDown={handlePressStart}
        onPointerUp={handlePressEnd}
        onPointerLeave={handlePressEnd}
        onPointerCancel={handlePressEnd}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, userSelect: 'none' }}
      >
        <h2
          data-testid="abuwhatsapp-title"
          style={{
            margin: 0,
            fontFamily: "'Heebo',sans-serif",
            fontSize: 26, fontWeight: 700,
            color: 'rgba(255,255,255,0.94)',
            letterSpacing: '0.4px',
          }}
        >
          אבו וואטסאפ
        </h2>
        <div style={{
          fontFamily: "'Heebo',sans-serif",
          fontSize: 15,
          color: 'rgba(255,255,255,0.55)',
        }}>
          למי לשלוח הודעה?
        </div>
        <div
          data-testid="abuwhatsapp-build-version"
          style={{
            fontFamily: "'DM Sans',monospace",
            fontSize: 11,
            color: `rgba(${hexToRgb(GOLD)},0.55)`,
            direction: 'ltr',
            marginTop: 2,
          }}
        >
          v{APP_VERSION.version}
        </div>
      </header>

      <div
        data-testid="family-bubble-grid"
        style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 18,
          padding: '8px 4px',
        }}
      >
        {group && (
          <BubbleTile
            key="family-group"
            id="family-group"
            kind="group"
            label={group.label}
            photoFile={group.photoFile}
            initials={computeInitials(group.label)}
            onTap={handleTapGroup}
          />
        )}
        {personsForGrid.map((p) => (
          <BubbleTile
            key={p.id}
            id={p.id}
            kind="person"
            label={p.displayName}
            photoFile={p.photoFile}
            initials={computeInitials(p.displayName)}
            onTap={() => handleTapPerson(p)}
          />
        ))}
      </div>

      {!group && personsForGrid.length === 0 && (
        <div
          data-testid="family-empty-hint"
          style={{
            fontFamily: "'Heebo',sans-serif",
            fontSize: 15, lineHeight: 1.7,
            color: 'rgba(255,255,255,0.45)',
            textAlign: 'center',
            maxWidth: 320, margin: '0 auto', padding: '8px 12px',
          }}
        >
          אין עדיין אנשי קשר משפחתיים מוגדרים
        </div>
      )}

      {actionSheet && (
        <ActionSheet
          face={actionSheet.face}
          onChoose={handleActionChoice}
          onCancel={() => setActionSheet(null)}
        />
      )}

      {toast && (
        <div
          data-testid="family-toast"
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 'calc(120px + env(safe-area-inset-bottom, 0px))',
            left: '50%', transform: 'translateX(-50%)',
            padding: '12px 22px', borderRadius: 18,
            background: 'rgba(8,16,28,0.92)',
            border: `1px solid ${TEAL}55`,
            color: 'rgba(255,255,255,0.92)',
            fontFamily: "'Heebo',sans-serif",
            fontSize: 15,
            boxShadow: '0 10px 28px rgba(0,0,0,0.42)',
            zIndex: 30, direction: 'rtl',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}

interface BubbleTileProps {
  id: string
  kind: 'group' | 'person'
  label: string
  photoFile?: string | undefined
  initials: string
  onTap: () => void
}

export function BubbleTile({ id, kind, label, photoFile, initials, onTap }: BubbleTileProps) {
  return (
    <button
      type="button"
      data-testid={kind === 'group' ? `bubble-group-${id}` : `bubble-person-${id}`}
      data-bubble-kind={kind}
      onClick={onTap}
      aria-label={label}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 8,
        padding: '6px 4px',
        background: 'transparent',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <BubbleAvatar
        photoFile={photoFile}
        initials={initials}
        size={BUBBLE_SIZE}
        accent={kind === 'group' ? WA_GREEN : TEAL}
        accentSoft={kind === 'group' ? 'rgba(37,211,102,0.55)' : 'rgba(20,184,166,0.55)'}
      />
      <div style={{
        fontFamily: "'Heebo',sans-serif",
        fontSize: BUBBLE_LABEL_FONT, fontWeight: 600,
        color: 'rgba(255,255,255,0.92)',
        textAlign: 'center', lineHeight: 1.25,
        maxWidth: BUBBLE_SIZE + 12,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {label}
      </div>
    </button>
  )
}

function BubbleAvatar({
  photoFile, initials, size, accent, accentSoft,
}: {
  photoFile: string | undefined
  initials: string
  size: number
  accent: string
  accentSoft: string
}) {
  const fontSize = Math.round(size * 0.42)
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `2.5px solid ${accentSoft}`,
      background: photoFile
        ? 'linear-gradient(145deg, #0b2220, #050A18)'
        : `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.10), rgba(20,184,166,0.18) 45%, rgba(8,16,28,0.95) 100%)`,
      boxShadow: `0 0 0 3px rgba(0,0,0,0.25), 0 0 22px ${accentSoft}, 0 6px 16px rgba(0,0,0,0.40)`,
      overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {photoFile ? (
        <img
          src={photoFile}
          alt=""
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        />
      ) : (
        <span style={{
          fontFamily: "'Cormorant Garamond',Georgia,serif",
          fontSize, fontWeight: 600,
          color: accent,
          textShadow: `0 2px 12px ${accentSoft}`,
          lineHeight: 1, userSelect: 'none',
        }}>{initials}</span>
      )}
    </div>
  )
}

function ActionSheet({
  face, onChoose, onCancel,
}: {
  face: Extract<FamilyQuickFace, { type: 'person' }>
  onChoose: (k: ActionKind) => void
  onCancel: () => void
}) {
  return (
    <div
      data-testid="family-action-sheet"
      role="dialog"
      aria-modal="true"
      aria-label={`פעולות עבור ${face.displayName}`}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(5,10,24,0.72)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        zIndex: 40, direction: 'rtl',
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 460,
          padding: '18px 18px calc(22px + env(safe-area-inset-bottom, 0px))',
          background: 'rgba(8,16,28,0.96)',
          borderTop: `1.5px solid ${TEAL}66`,
          borderRadius: '20px 20px 0 0',
          display: 'flex', flexDirection: 'column', gap: 10,
          fontFamily: "'Heebo',sans-serif",
        }}
      >
        <div style={{
          fontSize: 18, fontWeight: 700,
          color: 'rgba(255,255,255,0.92)', textAlign: 'center',
          marginBottom: 4,
        }}>
          {face.displayName}
        </div>
        <button
          type="button"
          data-testid={`action-whatsapp-${face.id}`}
          onClick={() => onChoose('whatsapp')}
          style={{
            width: '100%', height: 56, borderRadius: 16,
            border: `1.5px solid ${WA_GREEN}55`,
            background: `linear-gradient(145deg, ${WA_GREEN}, #128C7E)`,
            color: 'white',
            fontFamily: "'Heebo',sans-serif",
            fontSize: 17, fontWeight: 700,
            cursor: 'pointer',
          }}
        >WhatsApp</button>
        <button
          type="button"
          data-testid={`action-call-${face.id}`}
          onClick={() => onChoose('call')}
          style={{
            width: '100%', height: 56, borderRadius: 16,
            border: `1.5px solid ${TEAL}55`,
            background: 'rgba(20,184,166,0.10)',
            color: TEAL,
            fontFamily: "'Heebo',sans-serif",
            fontSize: 17, fontWeight: 700,
            cursor: 'pointer',
          }}
        >שיחה</button>
        <button
          type="button"
          data-testid={`action-cancel-${face.id}`}
          onClick={onCancel}
          style={{
            width: '100%', height: 48, borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.10)',
            background: 'transparent',
            color: 'rgba(255,255,255,0.62)',
            fontFamily: "'Heebo',sans-serif",
            fontSize: 15, fontWeight: 500,
            cursor: 'pointer',
          }}
        >ביטול</button>
      </div>
    </div>
  )
}

function hexToRgb(hex: string): string {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return '255,255,255'
  return `${parseInt(m[1] as string, 16)},${parseInt(m[2] as string, 16)},${parseInt(m[3] as string, 16)}`
}

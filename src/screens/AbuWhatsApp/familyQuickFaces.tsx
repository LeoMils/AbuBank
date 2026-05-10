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
 * v0.3.0 visibility filter — kept for the storage / merge unit tests that
 * still use this shape. New rendering uses the visible-by-default path
 * (`getDisplayablePersons` + `isPersonActionable`) below.
 */
export function getVisibleFaces(faces: ReadonlyArray<FamilyQuickFace> = FAMILY_QUICK_FACES): FamilyQuickFace[] {
  return faces.filter(f => {
    if (!f.enabled) return false
    if (f.type === 'group') return typeof f.whatsappUrl === 'string' && f.whatsappUrl.length > 0
    return isValidPhoneE164(f.phoneE164)
  })
}

/**
 * Returns every scaffold person — visible by default in the family grid.
 * Local override (if any) is merged for phone/photo/enabled so the tile can
 * render the correct photo and the tap handler can decide what to do, but
 * MISSING PHONE IS NOT A REASON TO HIDE A FAMILY MEMBER. Per Leo's product
 * direction: family members appear on screen first; configuration follows.
 */
export function getDisplayablePersons(
  scaffold: ReadonlyArray<FamilyQuickFace> = FAMILY_QUICK_FACES,
  local: ReadonlyArray<LocalFamilyContact> = [],
): Extract<FamilyQuickFace, { type: 'person' }>[] {
  const merged = mergeFacesWithLocal(scaffold, local)
  return merged.filter((f) => f.type === 'person') as Extract<FamilyQuickFace, { type: 'person' }>[]
}

/**
 * A person tile is "actionable" (flip card opens to action side) only when
 * the local override marks them enabled AND the phone passes E.164
 * validation. Disabled or missing/invalid phone → still rendered, but tap
 * shows a friendly Hebrew toast instead of flipping.
 */
export function isPersonActionable(face: Extract<FamilyQuickFace, { type: 'person' }>): boolean {
  if (face.enabled !== true) return false
  return isValidPhoneE164(face.phoneE164)
}

/**
 * Group is "actionable" when it has a non-empty whatsappUrl. The group is
 * always rendered (matches the visual rule "no hero / no special area"),
 * but a tap on a group with no URL shows "קבוצת המשפחה עדיין לא הוגדרה".
 */
export function isGroupActionable(face: Extract<FamilyQuickFace, { type: 'group' }>): boolean {
  return typeof face.whatsappUrl === 'string' && face.whatsappUrl.length > 0
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
    else if (f.photoFile && f.photoFile.length > 0) merged.photoFile = f.photoFile
    return merged
  })
}

/**
 * Toast text shown when a person is tapped but has no valid phone yet.
 *
 * Default copy is the generic Hebrew line "המספר עדיין לא הוגדר", but Ari and
 * Anabel are still little — they don't have their own phones yet. For them
 * we show a gentle, family-friendly two-line message instead. Once an
 * operator saves a phone for either of them, this helper is no longer
 * consulted (the tile becomes actionable and tapping flips the card to the
 * action side).
 */
export const GENERIC_MISSING_PHONE_TOAST = 'המספר עדיין לא הוגדר'
export const ARI_ANABEL_NO_PHONE_TOAST = 'הן עדיין קטנות 👧✨\nעדיין אין להן טלפון משלהן'

export function getMissingPhoneMessage(contactId: string): string {
  if (contactId === 'ari' || contactId === 'anabel') return ARI_ANABEL_NO_PHONE_TOAST
  return GENERIC_MISSING_PHONE_TOAST
}

export function computeInitials(displayName: string): string {
  const trimmed = (displayName || '').trim()
  if (!trimmed) return '?'
  const first = Array.from(trimmed)[0]
  return first || '?'
}

// ─── Unified bubble grid with 180° flip-card interaction ───────────────────
//
// Default state: every tile is a small circle showing photo + name. Tapping
// an actionable tile flips it 180° to a back face that holds either two
// stacked pill buttons (person: WhatsApp + Call) or one (group: WhatsApp).
// Only one card may be flipped at a time. Tapping the back-face background
// (anywhere not on a button) flips the card back; tapping the page
// background (the grid wrapper) closes the active card; tapping any other
// tile closes the current and opens the new one.

// Visual rules — match AbuBank Home launcher's bubble system.
const BUBBLE_SIZE = 80           // px — the circle on the front face
const BUBBLE_LABEL_FONT = 14
const GRID_GAP = 12              // px — calmer vertical rhythm on iPhone
const FLIPPED_CARD_W = 132       // px — back-face footprint (lifts above grid)
const FLIPPED_CARD_H = 132       // px — back-face footprint
const FLIP_DURATION_MS = 320     // 260–380ms band, picked for "satisfying flip"
const FLIP_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)'

// Deterministic family-group photo. Sourced from the existing committed
// public/family/* asset set used by FamilyGallery; no per-person photo
// mapping exists today so individual person bubbles fall back to initials.
const FAMILY_GROUP_PHOTO = '/family/FAmilly%206.JPG'

interface FamilyQuickFacesProps {
  /** Tap a target with a chosen action. type='url' → open URL same-tab. */
  onOpenWhatsApp: (url: string) => void
  onOpenTel: (url: string) => void
  /** Operator-only setup hand-off (long-press the screen title). */
  onOperatorSetup?: () => void
  /** Test/Storybook hook. Defaults to localStorage at mount. */
  localContacts?: ReadonlyArray<LocalFamilyContact>
}

/**
 * Hook that subscribes to the (prefers-reduced-motion: reduce) media query
 * and re-renders if the user toggles it. Returns false on SSR / when
 * matchMedia isn't available.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mql.matches)
    update()
    mql.addEventListener?.('change', update)
    return () => mql.removeEventListener?.('change', update)
  }, [])
  return reduced
}

export function FamilyQuickFaces({ onOpenWhatsApp, onOpenTel, onOperatorSetup, localContacts }: FamilyQuickFacesProps) {
  const [contacts, setContacts] = useState<ReadonlyArray<LocalFamilyContact>>(localContacts ?? [])
  useEffect(() => {
    if (localContacts !== undefined) { setContacts(localContacts); return }
    setContacts(getLocalContacts())
  }, [localContacts])

  const merged = mergeFacesWithLocal(FAMILY_QUICK_FACES, contacts)
  const group = merged.find((f) => f.type === 'group') as Extract<FamilyQuickFace, { type: 'group' }> | undefined
  // Visible-by-default: every scaffold person renders, even without phone.
  const personsForGrid = getDisplayablePersons(FAMILY_QUICK_FACES, contacts)

  // Single source of truth for which card is flipped to its action side.
  // Family group uses id 'family-group'; persons use their stable id.
  const [activeFlippedId, setActiveFlippedId] = useState<string | null>(null)
  const [toast, setToast] = useState<string>('')
  const reducedMotion = usePrefersReducedMotion()

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

  function closeFlip() {
    setActiveFlippedId(null)
  }

  function handleTapGroup() {
    if (!group || !isGroupActionable(group)) {
      showToast('קבוצת המשפחה עדיין לא הוגדרה')
      return
    }
    setActiveFlippedId((prev) => (prev === 'family-group' ? null : 'family-group'))
  }

  function handleTapPerson(face: Extract<FamilyQuickFace, { type: 'person' }>) {
    if (!isPersonActionable(face)) {
      showToast(getMissingPhoneMessage(face.id))
      return
    }
    // Toggle this card; opening a new card auto-closes any other.
    setActiveFlippedId((prev) => (prev === face.id ? null : face.id))
  }

  function fireGroupWhatsApp() {
    if (!group) return
    onOpenWhatsApp(group.whatsappUrl)
    setActiveFlippedId(null)
  }
  function firePersonWhatsApp(p: Extract<FamilyQuickFace, { type: 'person' }>) {
    onOpenWhatsApp(buildWhatsAppPersonUrl(p))
    setActiveFlippedId(null)
  }
  function firePersonCall(p: Extract<FamilyQuickFace, { type: 'person' }>) {
    onOpenTel(buildTelUrl(p))
    setActiveFlippedId(null)
  }

  // Tapping outside any card (the grid wrapper background) closes the open
  // card. Tile clicks call setActiveFlippedId directly so we only act when
  // the click target is the wrapper itself.
  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) closeFlip()
  }

  return (
    <div
      data-testid="family-quick-faces"
      onClick={handleBackdropClick}
      style={{
        width: '100%', maxWidth: 460,
        display: 'flex', flexDirection: 'column', alignItems: 'stretch',
        gap: 10,
        direction: 'rtl',
      }}
    >
      <header
        data-testid="abuwhatsapp-header"
        onPointerDown={handlePressStart}
        onPointerUp={handlePressEnd}
        onPointerLeave={handlePressEnd}
        onPointerCancel={handlePressEnd}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, userSelect: 'none' }}
      >
        <h2
          data-testid="abuwhatsapp-title"
          style={{
            margin: 0,
            fontFamily: "'Heebo',sans-serif",
            fontSize: 22, fontWeight: 700,
            color: 'rgba(255,255,255,0.94)',
            letterSpacing: '0.3px',
          }}
        >
          אבו וואטסאפ
        </h2>
        <div style={{
          fontFamily: "'Heebo',sans-serif",
          fontSize: 13,
          color: 'rgba(255,255,255,0.50)',
        }}>
          למי לשלוח הודעה?
        </div>
        <div
          data-testid="abuwhatsapp-build-version"
          style={{
            fontFamily: "'DM Sans',monospace",
            fontSize: 9,
            color: `rgba(${hexToRgb(GOLD)},0.45)`,
            direction: 'ltr',
            marginTop: 1, letterSpacing: '0.3px',
          }}
        >
          v{APP_VERSION.version}
        </div>
      </header>

      <div
        data-testid="family-bubble-grid"
        onClick={handleBackdropClick}
        style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          rowGap: GRID_GAP, columnGap: GRID_GAP,
          padding: '4px 2px',
          justifyItems: 'center',
        }}
      >
        {group && (
          <BubbleTile
            key="family-group"
            id="family-group"
            kind="group"
            label={group.label}
            photoFile={group.photoFile ?? FAMILY_GROUP_PHOTO}
            initials={computeInitials(group.label)}
            flipped={activeFlippedId === 'family-group'}
            reducedMotion={reducedMotion}
            onTap={handleTapGroup}
            onFlipBack={closeFlip}
            {...(isGroupActionable(group) ? {
              groupAction: {
                onWhatsApp: () => fireGroupWhatsApp(),
              },
            } : {})}
          />
        )}
        {personsForGrid.map((p) => {
          const actionable = isPersonActionable(p)
          return (
            <BubbleTile
              key={p.id}
              id={p.id}
              kind="person"
              label={p.displayName}
              photoFile={p.photoFile}
              initials={computeInitials(p.displayName)}
              flipped={activeFlippedId === p.id}
              reducedMotion={reducedMotion}
              onTap={() => handleTapPerson(p)}
              onFlipBack={closeFlip}
              {...(actionable ? {
                actions: {
                  onWhatsApp: () => firePersonWhatsApp(p),
                  onCall:     () => firePersonCall(p),
                },
              } : {})}
            />
          )
        })}
      </div>

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
            lineHeight: 1.45,
            whiteSpace: 'pre-line',
            textAlign: 'center',
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
  /** True when this tile is the currently flipped/active card. */
  flipped: boolean
  /** Called when the back-face background is tapped (not an action button). */
  onFlipBack: () => void
  /** Drives reduced-motion fallback (no rotateY, opacity-only swap). */
  reducedMotion: boolean
  /**
   * Person back-face actions. Provide BOTH handlers when the person is
   * actionable; non-actionable persons (no phone, or Ari/Anabel) receive
   * NO `actions` and NO back face is rendered.
   */
  actions?: { onWhatsApp: () => void; onCall: () => void }
  /**
   * Group back-face action. Group is WhatsApp-only — never tel/call. Persons
   * never receive `groupAction`.
   */
  groupAction?: { onWhatsApp: () => void }
}

export function BubbleTile({
  id, kind, label, photoFile, initials,
  onTap, flipped, onFlipBack, reducedMotion,
  actions, groupAction,
}: BubbleTileProps) {
  const hasBack = Boolean(actions || groupAction)

  // Cell footprint stays constant so the grid layout never shifts. The
  // flip-stage is absolutely positioned inside the cell and grows outward
  // (and elevates via z-index) when this tile is the active flipped one.
  const cellW = BUBBLE_SIZE
  const cellH = BUBBLE_SIZE + 22 // reserve label baseline

  const stageW = flipped ? FLIPPED_CARD_W : cellW
  const stageH = flipped ? FLIPPED_CARD_H : cellH
  // Center the grown stage on the cell's centre.
  const stageOffsetX = flipped ? -(FLIPPED_CARD_W - cellW) / 2 : 0
  const stageOffsetY = flipped ? -(FLIPPED_CARD_H - cellH) / 2 : 0

  // For reduced motion, skip the rotateY transform; toggle face visibility
  // via opacity/pointerEvents instead.
  const innerTransform = !reducedMotion && flipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
  const transitionAll = reducedMotion ? 'none' : `all ${FLIP_DURATION_MS}ms ${FLIP_EASING}`
  const transitionTransform = reducedMotion ? 'none' : `transform ${FLIP_DURATION_MS}ms ${FLIP_EASING}`

  return (
    <div
      data-testid={kind === 'group' ? `bubble-group-${id}` : `bubble-person-${id}`}
      data-bubble-kind={kind}
      data-flipped={flipped ? 'true' : 'false'}
      style={{
        position: 'relative',
        width: cellW,
        height: cellH,
        // Reserve a small margin so the grown stage's shadow/glow doesn't
        // visually clip into neighbours.
        overflow: 'visible',
      }}
    >
      <div
        data-testid={`bubble-flip-stage-${id}`}
        style={{
          position: 'absolute',
          top: stageOffsetY,
          left: stageOffsetX,
          width: stageW,
          height: stageH,
          perspective: 1000,
          zIndex: flipped ? 10 : 1,
          transition: transitionAll,
        }}
      >
        <div
          data-testid={`bubble-flip-inner-${id}`}
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            transformStyle: 'preserve-3d',
            transition: transitionTransform,
            transform: innerTransform,
          }}
        >
          {/* FRONT FACE — photo + name, the only thing visible by default */}
          <button
            type="button"
            data-testid={kind === 'group' ? `bubble-group-tap-${id}` : `bubble-person-tap-${id}`}
            data-face="front"
            onClick={(e) => { e.stopPropagation(); onTap() }}
            aria-label={label}
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              // Reduced-motion path: hide the front face when flipped via
              // opacity, since rotateY isn't applied.
              opacity: reducedMotion && flipped ? 0 : 1,
              pointerEvents: reducedMotion && flipped ? 'none' : 'auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 6,
              padding: 0, margin: 0,
              background: 'transparent',
              border: 'none',
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
              textAlign: 'center', lineHeight: 1.2,
              maxWidth: BUBBLE_SIZE + 12,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {label}
            </div>
          </button>

          {/* BACK FACE — present only for actionable tiles. Tapping the */}
          {/* background (anywhere not a button) flips the card back. */}
          {hasBack && (
            <div
              data-testid={`bubble-back-${id}`}
              data-face="back"
              role="group"
              aria-label={`פעולות עבור ${label}`}
              onClick={(e) => { e.stopPropagation(); onFlipBack() }}
              style={{
                position: 'absolute',
                inset: 0,
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                // Reduced-motion path: show back via opacity when flipped.
                opacity: reducedMotion ? (flipped ? 1 : 0) : 1,
                pointerEvents: reducedMotion && !flipped ? 'none' : 'auto',
                borderRadius: 24,
                background: 'linear-gradient(160deg, rgba(8,16,28,0.96), rgba(5,10,24,0.98))',
                border: `1.5px solid ${TEAL}40`,
                boxShadow: `0 14px 32px rgba(0,0,0,0.50), 0 0 28px ${TEAL}24`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                justifyContent: 'center',
                padding: '14px 12px',
                gap: 10,
                cursor: 'pointer',
                direction: 'rtl',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {actions && (
                <>
                  <ActionChip
                    kind="whatsapp"
                    label="וואטסאפ"
                    ariaLabel={`שליחת וואטסאפ אל ${label}`}
                    testId={`chip-whatsapp-${id}`}
                    onClick={(e) => { e.stopPropagation(); actions.onWhatsApp() }}
                  />
                  <ActionChip
                    kind="call"
                    label="שיחה"
                    ariaLabel={`שיחה אל ${label}`}
                    testId={`chip-call-${id}`}
                    onClick={(e) => { e.stopPropagation(); actions.onCall() }}
                  />
                </>
              )}
              {groupAction && (
                <ActionChip
                  kind="whatsapp"
                  label="וואטסאפ"
                  ariaLabel={`שליחת וואטסאפ ל${label}`}
                  testId={`chip-whatsapp-${id}`}
                  onClick={(e) => { e.stopPropagation(); groupAction.onWhatsApp() }}
                  emphasis="primary"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ActionChip({
  kind, label, ariaLabel, testId, onClick, emphasis = 'normal',
}: {
  kind: 'whatsapp' | 'call'
  label: string
  ariaLabel: string
  testId: string
  onClick: (e: React.MouseEvent) => void
  emphasis?: 'normal' | 'primary'
}) {
  const accent = kind === 'whatsapp' ? WA_GREEN : TEAL
  const bg = kind === 'whatsapp'
    ? `linear-gradient(145deg, ${WA_GREEN}, #128C7E)`
    : 'rgba(20,184,166,0.16)'
  const color = kind === 'whatsapp' ? 'white' : TEAL
  const border = kind === 'whatsapp' ? `1.5px solid ${WA_GREEN}66` : `1.5px solid ${TEAL}66`
  // emphasis "primary" is used for the family-group single WhatsApp pill —
  // we can give it a touch more height so it visually anchors the card.
  return (
    <button
      type="button"
      data-testid={testId}
      data-chip-kind={kind}
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        minHeight: emphasis === 'primary' ? 56 : 48,
        padding: '0 14px',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: 8,
        borderRadius: 14,
        border,
        background: bg,
        color,
        fontFamily: "'Heebo',sans-serif",
        fontSize: 15, fontWeight: 700,
        cursor: 'pointer',
        boxShadow: kind === 'whatsapp'
          ? '0 4px 12px rgba(37,211,102,0.26)'
          : '0 4px 12px rgba(20,184,166,0.20)',
        WebkitTapHighlightColor: 'transparent',
        letterSpacing: '0.2px',
      }}
    >
      <ActionChipIcon kind={kind} color={color} accent={accent} />
      <span>{label}</span>
    </button>
  )
}

function ActionChipIcon({ kind, color, accent }: { kind: 'whatsapp' | 'call'; color: string; accent: string }) {
  if (kind === 'whatsapp') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12a9 9 0 0 1-13.5 7.8L3 21l1.3-4.4A9 9 0 1 1 21 12z" />
        <path d="M8.5 9.5c0 4 3 7 7 7" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8 10a16 16 0 0 0 6 6l1.36-1.36a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
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
  // Forced circle: explicit width=height, aspect-ratio:1/1, fixed flex
  // basis. Defends against parent flex/grid stretching the avatar into
  // an oval on narrow phone viewports.
  return (
    <div
      data-bubble-avatar
      style={{
        width: size, height: size,
        minWidth: size, minHeight: size,
        maxWidth: size, maxHeight: size,
        aspectRatio: '1 / 1',
        flex: '0 0 auto',
        boxSizing: 'border-box',
        borderRadius: '50%',
        border: `2px solid ${accentSoft}`,
        background: photoFile
          ? 'linear-gradient(145deg, #0b2220, #050A18)'
          : `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.10), rgba(20,184,166,0.18) 45%, rgba(8,16,28,0.95) 100%)`,
        boxShadow: `0 0 0 2px rgba(0,0,0,0.20), 0 0 16px ${accentSoft}, 0 4px 10px rgba(0,0,0,0.32)`,
        overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {photoFile ? (
        <img
          src={photoFile}
          alt=""
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', display: 'block', borderRadius: '50%' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        />
      ) : (
        <span style={{
          fontFamily: "'Cormorant Garamond',Georgia,serif",
          fontSize, fontWeight: 600,
          color: accent,
          textShadow: `0 2px 10px ${accentSoft}`,
          lineHeight: 1, userSelect: 'none',
        }}>{initials}</span>
      )}
    </div>
  )
}

function hexToRgb(hex: string): string {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return '255,255,255'
  return `${parseInt(m[1] as string, 16)},${parseInt(m[2] as string, 16)},${parseInt(m[3] as string, 16)}`
}

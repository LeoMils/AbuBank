import { useEffect, useRef, useState } from 'react'
import { FAMILY_QUICK_FACES, type FamilyQuickFace } from './familyContacts.private'
import { getLocalContacts, CONTACTS_UPDATED_EVENT, type LocalFamilyContact } from './familyContactsStorage'
import { matchTargetName } from '../AbuAI/whatsappCompose'
import { loadFamilyData } from '../../services/familyLoader'

const WA_GREEN = '#25D366'
const TEAL = '#14b8a6'
// Call wedge — rich, warm red, NOT alarming. Tasteful gradient pair.
const CALL_RED = '#D83A3A'
const CALL_RED_DEEP = '#A81F1F'
// Center identity circle — soft cream that reads as warm, premium, neutral.
const CENTER_CREAM = '#F5EBD2'
const CENTER_INK = '#0c1f33'

// ─── Phone & URL helpers (unchanged contracts; existing tests pin them) ────

export function sanitizePhoneE164(raw: string): string {
  if (typeof raw !== 'string') return ''
  return raw.replace(/[^\d]/g, '')
}

/**
 * Normalize an Israeli local phone number to E.164 format.
 * Local "0NN-NNNNNNN" (10 digits) → "+972NN-NNNNNNN" (drop the leading 0).
 * Already-E.164 "+972…" → passed through unchanged.
 * Non-Israeli / unrecognized → returned as-is.
 * (Examples use N placeholders on purpose — no phone-shaped literals in source.)
 */
export function normalizeIsraeliPhone(raw: string): string {
  if (typeof raw !== 'string') return ''
  const trimmed = raw.trim().replace(/[\s\-()]/g, '')
  // Already E.164
  if (trimmed.startsWith('+')) return trimmed
  // Israeli local: 05X, 07X, 02, 03, 04, 08, 09 (mobile starts with 05)
  if (trimmed.startsWith('0') && trimmed.length === 10) {
    return '+972' + trimmed.slice(1)
  }
  return trimmed
}

export function isValidPhoneE164(raw: string): boolean {
  if (typeof raw !== 'string') return false
  if (!raw.startsWith('+')) return false
  const digits = sanitizePhoneE164(raw)
  return digits.length >= 8 && digits.length <= 15
}

export function buildWhatsAppPersonUrl(
  face: Extract<FamilyQuickFace, { type: 'person' }>,
  text?: string,
): string {
  const target = face.whatsappE164 && face.whatsappE164.length > 0 ? face.whatsappE164 : face.phoneE164
  const base = `https://wa.me/${sanitizePhoneE164(target)}`
  // With text → pre-FILL the chat (WhatsApp still requires a manual send tap;
  // there is no auto-send). Without text the URL stays byte-identical to the
  // original contract that existing tests pin.
  if (typeof text === 'string' && text.trim().length > 0) {
    return `${base}?text=${encodeURIComponent(text)}`
  }
  return base
}

export function buildTelUrl(face: Extract<FamilyQuickFace, { type: 'person' }>): string {
  return `tel:+${sanitizePhoneE164(face.phoneE164)}`
}

export interface ResolvedContact {
  face: Extract<FamilyQuickFace, { type: 'person' }>
  /** true when the contact has a valid, enabled phone (chat can be opened). */
  actionable: boolean
}

// ─── RecipientEntityResolver (channel adapter half) ─────────────────────────
//
// Resolve a spoken/typed family name to phone-bearing CONTACT candidates. The
// join key is the Hebrew display name — the AbuAI family graph and this
// scaffold do NOT share ids — enriched with aliases from family_data. Fuzzy
// scoring tolerates STT misspellings and partial names, and SURFACES ambiguity
// (two similar names) instead of silently guessing.

export type RecipientEvidence = 'exact' | 'alias' | 'prefix' | 'fuzzy'

export interface RecipientCandidate {
  face: Extract<FamilyQuickFace, { type: 'person' }>
  /** 0..1 match confidence. */
  confidence: number
  evidence: RecipientEvidence
  actionable: boolean
}

/** Levenshtein edit distance (small strings). */
function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i]![0] = i
  for (let j = 0; j <= n; j++) dp[0]![j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost)
    }
  }
  return dp[m]![n]!
}

function scoreName(query: string, name: string): { score: number; evidence: RecipientEvidence } {
  const q = query.toLowerCase(), n = name.toLowerCase()
  if (!q || !n) return { score: 0, evidence: 'fuzzy' }
  if (q === n) return { score: 1, evidence: 'exact' }
  const short = q.length <= n.length ? q : n
  const long = q.length <= n.length ? n : q
  if (short.length >= 3 && long.startsWith(short)) return { score: 0.78, evidence: 'prefix' }
  const d = editDistance(q, n)
  if (d === 1 && Math.max(q.length, n.length) >= 3) return { score: 0.7, evidence: 'fuzzy' }
  if (d === 2 && Math.max(q.length, n.length) >= 5) return { score: 0.55, evidence: 'fuzzy' }
  return { score: 0, evidence: 'fuzzy' }
}

/** Build the set of names a scaffold person answers to (display + aliases). */
function namesForPerson(displayName: string): string[] {
  const out = new Set<string>([displayName])
  try {
    const member = loadFamilyData().find(m => m.hebrew === displayName)
    if (member) {
      out.add(member.canonicalName)
      for (const a of member.aliases ?? []) out.add(a)
    }
  } catch { /* family data optional */ }
  return [...out].filter(Boolean)
}

/**
 * The default family identity (names + relationship + photos, no numbers). The
 * name RESOLVER knows the family even before the operator saves any number — so
 * "call adar" resolves who Adar is, then reports "no number yet" if unconfigured.
 * This is resolution knowledge ONLY; the family board renders purely from the
 * stored contacts (getDisplayablePersons).
 */
const SEED_PERSON_FACES: ReadonlyArray<Extract<FamilyQuickFace, { type: 'person' }>> =
  FAMILY_QUICK_FACES.filter((f): f is Extract<FamilyQuickFace, { type: 'person' }> => f.type === 'person')

/**
 * Faces the resolver matches against: the seed family overlaid with the store's
 * per-contact data (a saved number makes the seed member actionable), PLUS any
 * store-only contacts that are not part of the seed (new, dynamic contacts).
 */
function resolutionFaces(local: ReadonlyArray<LocalFamilyContact>): Extract<FamilyQuickFace, { type: 'person' }>[] {
  const byId = new Map<string, LocalFamilyContact>()
  for (const c of local) byId.set(c.id, c)
  const seedIds = new Set(SEED_PERSON_FACES.map((f) => f.id))
  const merged: LocalFamilyContact[] = SEED_PERSON_FACES.map((seed) => {
    const o = byId.get(seed.id)
    const c: LocalFamilyContact = {
      id: seed.id,
      enabled: o?.enabled === true,
      phoneE164: o?.phoneE164 || '',
      displayName: (o?.displayName && o.displayName.trim()) || seed.displayName,
    }
    const rel = (o?.relationshipHebrew && o.relationshipHebrew.trim()) || seed.relationshipHebrew
    if (rel) c.relationshipHebrew = rel
    if (o?.whatsappE164) c.whatsappE164 = o.whatsappE164
    const photo = o?.photoDataUrl || o?.photoFile || seed.photoFile
    if (photo) c.photoFile = photo
    return c
  })
  const extra = local.filter((c) => !seedIds.has(c.id))
  return contactsToPersonFaces([...merged, ...extra])
}

/**
 * Return ranked recipient candidates for a spoken/typed name. Empty when no
 * family member plausibly matches. Callers decide ambiguity policy via
 * `isRecipientAmbiguous`.
 */
export function resolveContactCandidates(
  name: string,
  local: ReadonlyArray<LocalFamilyContact> = getLocalContacts(),
): RecipientCandidate[] {
  const cleaned = (name ?? '').trim()
  if (!cleaned) return []
  // Canonicalize a prefixed token / exact alias up-front (e.g. "לאדר" → "אדר").
  const canon = matchTargetName(cleaned)?.hebrew ?? cleaned
  const queries = [...new Set([cleaned.toLowerCase(), canon.toLowerCase()])]
  const persons = resolutionFaces(local)
  const out: RecipientCandidate[] = []
  for (const face of persons) {
    let best = { score: 0, evidence: 'fuzzy' as RecipientEvidence }
    for (const nm of namesForPerson(face.displayName)) {
      for (const q of queries) {
        const s = scoreName(q, nm)
        if (s.score > best.score) best = s
      }
    }
    if (best.score > 0) out.push({ face, confidence: best.score, evidence: best.evidence, actionable: isPersonActionable(face) })
  }
  return out.sort((a, b) => b.confidence - a.confidence)
}

/**
 * Ambiguity policy: a resolution is UNAMBIGUOUS only when there is a clear top
 * candidate (high confidence) that is meaningfully ahead of the runner-up.
 * Otherwise the UI must ask Martita to choose — never silently pick.
 */
export function isRecipientAmbiguous(candidates: RecipientCandidate[]): boolean {
  if (candidates.length === 0) return false // "no match" is not "ambiguous"
  const top = candidates[0]!
  if (top.confidence < 0.85) return true
  const second = candidates[1]
  if (second && top.confidence - second.confidence < 0.2) return true
  return false
}

/**
 * Back-compat single-result resolver: returns the confident top candidate, or
 * null when there is no match OR the match is ambiguous (caller should prompt).
 */
export function resolveContactForName(
  name: string,
  local: ReadonlyArray<LocalFamilyContact> = getLocalContacts(),
): ResolvedContact | null {
  const candidates = resolveContactCandidates(name, local)
  if (candidates.length === 0) return null
  if (isRecipientAmbiguous(candidates)) return null
  const top = candidates[0]!
  return { face: top.face, actionable: top.actionable }
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
 * The family group face (a fixed WhatsApp invite link — NOT a phone contact, so
 * it is not part of the dynamic contact store). Rendered alongside the contacts.
 */
export const FAMILY_GROUP_FACE = FAMILY_QUICK_FACES.find((f) => f.type === 'group') as Extract<FamilyQuickFace, { type: 'group' }>

/**
 * Default-photo registry (id → bundled photo + crop), for the LAST-RESORT render
 * fallback: a known-family contact whose stored record has no photo still shows
 * the bundled photo instead of initials. This is self-healing — it does NOT
 * depend on the one-time migration having run, and survives a store overwrite.
 * It is NOT a board source: the board still renders exactly the stored contacts;
 * this only supplies a default IMAGE for a contact already being rendered.
 */
const DEFAULT_PHOTO_BY_ID = new Map(SEED_PERSON_FACES.map((s) => [s.id, s]))

/**
 * Render person faces DIRECTLY from the stored contacts — the single source of
 * truth. Photo priority per contact: valid photoDataUrl > valid photoFile >
 * bundled default (known family, by id) > initials. No scaffold, no known-id
 * gate on WHICH contacts render: whatever is in the store, in store order.
 */
export function contactsToPersonFaces(
  contacts: ReadonlyArray<LocalFamilyContact>,
): Extract<FamilyQuickFace, { type: 'person' }>[] {
  return contacts.map((c) => {
    const face: Extract<FamilyQuickFace, { type: 'person' }> = {
      type: 'person',
      id: c.id,
      displayName: (c.displayName && c.displayName.trim()) || c.id,
      phoneE164: c.phoneE164 || '',
      enabled: c.enabled === true,
    }
    if (c.relationshipHebrew && c.relationshipHebrew.trim()) face.relationshipHebrew = c.relationshipHebrew.trim()
    if (c.whatsappE164 && c.whatsappE164.length > 0) face.whatsappE164 = c.whatsappE164
    // Photo priority: uploaded → bundled-on-contact → known default → initials.
    let photo: string | undefined
    let fit = c.photoFit
    let pos = c.photoObjectPosition
    if (c.photoDataUrl && c.photoDataUrl.length > 0) {
      photo = c.photoDataUrl
    } else if (c.photoFile && c.photoFile.length > 0) {
      photo = c.photoFile
    } else {
      const def = DEFAULT_PHOTO_BY_ID.get(c.id)
      if (def?.photoFile) {
        photo = def.photoFile
        if (fit === undefined) fit = def.photoFit
        if (pos === undefined) pos = def.photoObjectPosition
      }
    }
    if (photo) face.photoFile = photo
    if (fit) face.photoFit = fit
    if (pos) face.photoObjectPosition = pos
    return face
  })
}

/**
 * Every displayable person = every stored contact, in store order. MISSING PHONE
 * IS NOT A REASON TO HIDE: a contact still renders (as a non-actionable tile)
 * until a number is added. Defaults to reading the live store.
 */
export function getDisplayablePersons(
  contacts: ReadonlyArray<LocalFamilyContact> = getLocalContacts(),
): Extract<FamilyQuickFace, { type: 'person' }>[] {
  return contactsToPersonFaces(contacts)
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
 * Public family photo gallery item — derived from the same scaffold +
 * localStorage data that drives the bubble grid. New contacts (or new
 * photo overrides) appear automatically: there is no separate hand-rolled
 * gallery list. Phone numbers / enabled / privacy fields are NEVER part of
 * this shape.
 */
export interface FamilyGalleryPhoto {
  id: string
  label: string
  photoUrl: string
}

/**
 * Build the family-photo album from the displayable family faces.
 *
 * Order: family group first (when a photo exists), then every scaffold
 * person in canonical scaffold order. Entries with no photoUrl are
 * skipped so the gallery never renders broken tiles.
 *
 * `extras` lets callers add extra photos that aren't part of the contact
 * scaffold (e.g. the Abu / Martita header portrait). Extras are
 * de-duplicated by photoUrl and sorted to the front so the tap target
 * the user just pressed feels visually anchored at the top of the album.
 */
export function getFamilyGalleryPhotos(
  contacts: ReadonlyArray<LocalFamilyContact> = getLocalContacts(),
  extras: ReadonlyArray<FamilyGalleryPhoto> = [],
): FamilyGalleryPhoto[] {
  const items: FamilyGalleryPhoto[] = []
  // Family group first (when the group face carries a photo).
  if (FAMILY_GROUP_FACE?.photoFile && FAMILY_GROUP_FACE.photoFile.length > 0) {
    items.push({ id: FAMILY_GROUP_FACE.id, label: FAMILY_GROUP_FACE.label, photoUrl: FAMILY_GROUP_FACE.photoFile })
  }
  // Every stored contact with a photo (dataUrl wins over file), in store order.
  for (const f of contactsToPersonFaces(contacts)) {
    if (typeof f.photoFile !== 'string' || f.photoFile.length === 0) continue
    items.push({ id: f.id, label: f.displayName, photoUrl: f.photoFile })
  }
  // De-dup by photoUrl: extras win and float to the top.
  const out: FamilyGalleryPhoto[] = []
  const seen = new Set<string>()
  for (const e of extras) {
    if (!e.photoUrl || seen.has(e.photoUrl)) continue
    seen.add(e.photoUrl)
    out.push(e)
  }
  for (const item of items) {
    if (seen.has(item.photoUrl)) continue
    seen.add(item.photoUrl)
    out.push(item)
  }
  return out
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
const FLIPPED_CARD_W = 144       // px — back-face footprint (lifts above grid)
const FLIPPED_CARD_H = 144       // px — back-face footprint
const HUB_CENTER_SIZE = 64       // px — center identity circle on the back face
const HUB_WEDGE_GAP = 4          // px — visible split between the two halves
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

  // Re-read localStorage on mount AND whenever the page becomes visible / a
  // 'storage' event fires (covers cross-tab + subtle remount races where the
  // operator save commits after the Faces screen has already rendered an
  // empty grid). Test-injected `localContacts` short-circuits all of this.
  useEffect(() => {
    if (localContacts !== undefined) { setContacts(localContacts); return }
    const refresh = () => setContacts(getLocalContacts())
    refresh()
    if (typeof window === 'undefined') return
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === 'abubank.familyContacts.v1') refresh()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', refresh)
    // Same-tab signal: the operator setup writes contacts in THIS tab, where the
    // 'storage' event never fires. This is what makes an import show up on the
    // board immediately without a reload.
    window.addEventListener(CONTACTS_UPDATED_EVENT, refresh)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', refresh)
      window.removeEventListener(CONTACTS_UPDATED_EVENT, refresh)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [localContacts])

  // The family group is a fixed invite link; persons render from the store.
  const group: Extract<FamilyQuickFace, { type: 'group' }> | undefined = FAMILY_GROUP_FACE
  const personsForGrid = getDisplayablePersons(contacts)

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
            fontFamily: "'Cormorant Garamond',Georgia,serif",
            fontSize: 26, fontWeight: 600,
            color: 'rgba(255,255,255,0.94)',
            letterSpacing: '1px',
            direction: 'ltr',
          }}
        >
          Abu WhatsApp
        </h2>
        <div
          data-testid="abuwhatsapp-subtitle"
          style={{
            fontFamily: "'Heebo',sans-serif",
            fontSize: 13,
            color: 'rgba(255,255,255,0.50)',
          }}
        >
          למי לשלוח הודעה?
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
            photoFit={group.photoFit}
            photoObjectPosition={group.photoObjectPosition}
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
              photoFit={p.photoFit}
              photoObjectPosition={p.photoObjectPosition}
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
  /** Optional per-contact crop override forwarded to BubbleAvatar. */
  photoFit?: 'contain' | 'cover' | undefined
  photoObjectPosition?: string | undefined
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
  id, kind, label, photoFile, photoFit, photoObjectPosition, initials,
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
              photoFit={photoFit}
              photoObjectPosition={photoObjectPosition}
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

          {/* BACK FACE — circular action hub. Person hubs split into a */}
          {/* WhatsApp-green left wedge + a Call-red right wedge with a */}
          {/* center identity circle. Group hubs are a single full-circle */}
          {/* WhatsApp action with a small "המשפחה" badge. Tapping a wedge */}
          {/* fires the action (and stops propagation) so the back-face */}
          {/* background's onFlipBack does NOT fire first. */}
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
                borderRadius: '50%',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                direction: 'rtl',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {actions && (
                <PersonActionHub
                  id={id}
                  label={label}
                  onWhatsApp={actions.onWhatsApp}
                  onCall={actions.onCall}
                  onCenter={onFlipBack}
                />
              )}
              {groupAction && (
                <GroupActionHub
                  id={id}
                  label={label}
                  onWhatsApp={groupAction.onWhatsApp}
                  onCenter={onFlipBack}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Circular action hub — back face for actionable persons ────────────────
//
// Visual model: a 144 px disc split into two semi-circular wedges with a
// small visual gap between them, and a soft-cream centre identity circle
// floating on top. Tapping a wedge fires its action; tapping the centre
// (or the back-face background outside the disc) flips the card back.

function PersonActionHub({
  id, label, onWhatsApp, onCall, onCenter,
}: {
  id: string
  label: string
  onWhatsApp: () => void
  onCall: () => void
  onCenter: () => void
}) {
  const half = (FLIPPED_CARD_W - HUB_WEDGE_GAP) / 2
  return (
    <div
      data-testid={`bubble-hub-person-${id}`}
      data-hub-kind="person"
      style={{
        position: 'relative',
        width: FLIPPED_CARD_W,
        height: FLIPPED_CARD_H,
        borderRadius: '50%',
        boxShadow: '0 16px 36px rgba(0,0,0,0.55), 0 0 22px rgba(37,211,102,0.18)',
        direction: 'rtl',
        background: 'transparent',
      }}
    >
      {/* Left wedge — WhatsApp green (visually-left of the disc) */}
      <button
        type="button"
        data-testid={`chip-whatsapp-${id}`}
        data-chip-kind="whatsapp"
        data-hub-wedge="whatsapp"
        onClick={(e) => { e.stopPropagation(); onWhatsApp() }}
        aria-label={`שליחת וואטסאפ אל ${label}`}
        style={{
          position: 'absolute',
          left: 0, top: 0,
          width: half, height: FLIPPED_CARD_H,
          borderTopLeftRadius: FLIPPED_CARD_H,
          borderBottomLeftRadius: FLIPPED_CARD_H,
          borderTopRightRadius: 0,
          borderBottomRightRadius: 0,
          border: 'none',
          background: `linear-gradient(135deg, ${WA_GREEN} 0%, #1FB755 60%, #128C7E 100%)`,
          color: 'white',
          cursor: 'pointer',
          minHeight: 44,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 4,
          paddingRight: 18,
          fontFamily: "'Heebo',sans-serif",
          fontSize: 13, fontWeight: 700,
          letterSpacing: '0.2px',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <HubWhatsAppIcon size={26} />
        <span>וואטסאפ</span>
      </button>

      {/* Right wedge — rich Call red (visually-right of the disc) */}
      <button
        type="button"
        data-testid={`chip-call-${id}`}
        data-chip-kind="call"
        data-hub-wedge="call"
        onClick={(e) => { e.stopPropagation(); onCall() }}
        aria-label={`שיחה אל ${label}`}
        style={{
          position: 'absolute',
          right: 0, top: 0,
          width: half, height: FLIPPED_CARD_H,
          borderTopRightRadius: FLIPPED_CARD_H,
          borderBottomRightRadius: FLIPPED_CARD_H,
          borderTopLeftRadius: 0,
          borderBottomLeftRadius: 0,
          border: 'none',
          background: `linear-gradient(135deg, ${CALL_RED} 0%, #C92A2A 60%, ${CALL_RED_DEEP} 100%)`,
          color: 'white',
          cursor: 'pointer',
          minHeight: 44,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 4,
          paddingLeft: 18,
          fontFamily: "'Heebo',sans-serif",
          fontSize: 13, fontWeight: 700,
          letterSpacing: '0.2px',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <HubCallIcon size={26} />
        <span>שיחה</span>
      </button>

      {/* Center identity — name + small heart. Tapping flips the card back. */}
      <button
        type="button"
        data-testid={`bubble-hub-center-${id}`}
        data-hub-center={id}
        onClick={(e) => { e.stopPropagation(); onCenter() }}
        aria-label={`סגירת פעולות עבור ${label}`}
        style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: HUB_CENTER_SIZE, height: HUB_CENTER_SIZE,
          borderRadius: '50%',
          border: '2px solid rgba(20,184,166,0.45)',
          background: `radial-gradient(circle at 32% 28%, #FFFFFF 0%, ${CENTER_CREAM} 60%, #E2D6B6 100%)`,
          color: CENTER_INK,
          cursor: 'pointer',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 2,
          padding: '4px 6px',
          fontFamily: "'Heebo',sans-serif",
          fontSize: 13, fontWeight: 700,
          lineHeight: 1.05,
          letterSpacing: '0.1px',
          boxShadow: '0 6px 16px rgba(0,0,0,0.45), 0 0 0 4px rgba(8,16,28,0.55)',
          zIndex: 5,
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span style={{
          maxWidth: HUB_CENTER_SIZE - 14,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{label}</span>
        <HubHeartIcon size={9} />
      </button>
    </div>
  )
}

function GroupActionHub({
  id, label, onWhatsApp, onCenter,
}: {
  id: string
  label: string
  onWhatsApp: () => void
  onCenter: () => void
}) {
  return (
    <div
      data-testid={`bubble-hub-group-${id}`}
      data-hub-kind="group"
      style={{
        position: 'relative',
        width: FLIPPED_CARD_W,
        height: FLIPPED_CARD_H,
        borderRadius: '50%',
        boxShadow: '0 16px 36px rgba(0,0,0,0.55), 0 0 28px rgba(37,211,102,0.30)',
        direction: 'rtl',
      }}
    >
      {/* Single full-circle WhatsApp action — the entire ring is the */}
      {/* WhatsApp tap target. No call wedge ever appears for the group. */}
      <button
        type="button"
        data-testid={`chip-whatsapp-${id}`}
        data-chip-kind="whatsapp"
        data-hub-wedge="whatsapp"
        onClick={(e) => { e.stopPropagation(); onWhatsApp() }}
        aria-label={`שליחת וואטסאפ ל${label}`}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%', height: '100%',
          borderRadius: '50%',
          border: 'none',
          background: `radial-gradient(circle at 32% 28%, #34E07A 0%, ${WA_GREEN} 50%, #128C7E 100%)`,
          color: 'white',
          cursor: 'pointer',
          minHeight: 44,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 4,
          fontFamily: "'Heebo',sans-serif",
          fontSize: 14, fontWeight: 700,
          letterSpacing: '0.2px',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.20)',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <HubWhatsAppIcon size={32} />
        <span>וואטסאפ</span>
      </button>

      {/* Identity badge — small dark "המשפחה" pill at the top. Tapping it */}
      {/* flips the card back so the user can see the family photo again. */}
      <button
        type="button"
        data-testid={`bubble-hub-center-${id}`}
        data-hub-center={id}
        onClick={(e) => { e.stopPropagation(); onCenter() }}
        aria-label={`סגירת פעולות ${label}`}
        style={{
          position: 'absolute',
          top: 8, left: '50%',
          transform: 'translateX(-50%)',
          padding: '4px 12px',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.55)',
          background: 'rgba(8,16,28,0.78)',
          color: 'rgba(255,255,255,0.96)',
          fontFamily: "'Heebo',sans-serif",
          fontSize: 11, fontWeight: 700,
          letterSpacing: '0.2px',
          cursor: 'pointer',
          zIndex: 5,
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {label}
      </button>
    </div>
  )
}

function HubWhatsAppIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 0 1-13.5 7.8L3 21l1.3-4.4A9 9 0 1 1 21 12z" />
      <path d="M8.5 9.5c0 4 3 7 7 7" />
    </svg>
  )
}

function HubCallIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="white" stroke="white" strokeWidth="0.5" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8 10a16 16 0 0 0 6 6l1.36-1.36a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function HubHeartIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="#C92A2A" stroke="#C92A2A" strokeWidth="1" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function BubbleAvatar({
  photoFile, photoFit, photoObjectPosition, initials, size, accent, accentSoft,
}: {
  photoFile: string | undefined
  photoFit?: 'contain' | 'cover' | undefined
  photoObjectPosition?: string | undefined
  initials: string
  size: number
  accent: string
  accentSoft: string
}) {
  const fontSize = Math.round(size * 0.42)
  // Default to non-cropping `contain` so faces stay intact. Per-contact
  // `photoFit: 'cover'` is opt-in (e.g. Adar's tall portrait).
  const resolvedFit: 'contain' | 'cover' = photoFit ?? 'contain'
  const resolvedPosition: string = photoObjectPosition ?? 'center'
  // If a real photo fails to load, fall back to initials (never a broken-image
  // icon). Reset the error whenever the photo changes (e.g. after a replace).
  const [errored, setErrored] = useState(false)
  useEffect(() => { setErrored(false) }, [photoFile])
  const showPhoto = Boolean(photoFile) && !errored
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
        background: showPhoto
          ? 'linear-gradient(145deg, #0b2220, #050A18)'
          : `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.10), rgba(20,184,166,0.18) 45%, rgba(8,16,28,0.95) 100%)`,
        boxShadow: `0 0 0 2px rgba(0,0,0,0.20), 0 0 16px ${accentSoft}, 0 4px 10px rgba(0,0,0,0.32)`,
        overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {showPhoto ? (
        <img
          key={photoFile}
          src={photoFile}
          alt=""
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: resolvedFit, objectPosition: resolvedPosition, display: 'block', borderRadius: '50%' }}
          onError={() => setErrored(true)}
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


import { FAMILY_QUICK_FACES, type FamilyQuickFace } from './familyContacts.private'

const WA_GREEN = '#25D366'
const TEAL = '#14b8a6'

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

export function getVisibleFaces(faces: ReadonlyArray<FamilyQuickFace> = FAMILY_QUICK_FACES): FamilyQuickFace[] {
  return faces.filter(f => {
    if (!f.enabled) return false
    if (f.type === 'group') return typeof f.whatsappUrl === 'string' && f.whatsappUrl.length > 0
    return isValidPhoneE164(f.phoneE164)
  })
}

export function computeInitials(displayName: string): string {
  const trimmed = (displayName || '').trim()
  if (!trimmed) return '?'
  const first = Array.from(trimmed)[0]
  return first || '?'
}

interface FamilyQuickFacesProps {
  onOpenWhatsApp: (url: string) => void
  onOpenTel: (url: string) => void
}

export function FamilyQuickFaces({ onOpenWhatsApp, onOpenTel }: FamilyQuickFacesProps) {
  const visible = getVisibleFaces()
  const group = visible.find(f => f.type === 'group') as Extract<FamilyQuickFace, { type: 'group' }> | undefined
  const people = visible.filter(f => f.type === 'person') as Extract<FamilyQuickFace, { type: 'person' }>[]

  return (
    <div
      data-testid="family-quick-faces"
      style={{
        width: '100%', maxWidth: 420,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 22,
        direction: 'rtl',
      }}
    >
      <h2 style={{
        margin: 0,
        fontFamily: "'Heebo',sans-serif",
        fontSize: 24, fontWeight: 600,
        color: 'rgba(255,255,255,0.92)',
        letterSpacing: '0.4px',
      }}>
        המשפחה שלי
      </h2>

      {group && (
        <FamilyGroupHeroBubble
          face={group}
          onOpenWhatsApp={onOpenWhatsApp}
        />
      )}

      {people.length > 0 && (
        <div
          data-testid="family-people-grid"
          style={{
            width: '100%',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 16,
          }}
        >
          {people.map(p => (
            <PersonBubbleCard
              key={p.id}
              face={p}
              onOpenWhatsApp={onOpenWhatsApp}
              onOpenTel={onOpenTel}
            />
          ))}
        </div>
      )}

      {people.length === 0 && (
        <div
          data-testid="family-empty-hint"
          style={{
            fontFamily: "'Heebo',sans-serif",
            fontSize: 15, lineHeight: 1.7,
            color: 'rgba(255,255,255,0.45)',
            textAlign: 'center',
            maxWidth: 320,
            padding: '8px 12px',
          }}
        >
          לחצי על הבועה הגדולה לפתיחת קבוצת המשפחה
        </div>
      )}
    </div>
  )
}

function FamilyGroupHeroBubble({
  face,
  onOpenWhatsApp,
}: {
  face: Extract<FamilyQuickFace, { type: 'group' }>
  onOpenWhatsApp: (url: string) => void
}) {
  return (
    <div
      data-testid="family-group-hero"
      style={{
        width: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 14,
        padding: '22px 18px 20px',
        borderRadius: 26,
        background: 'linear-gradient(160deg, rgba(37,211,102,0.08), rgba(20,184,166,0.05) 60%, rgba(201,168,76,0.04))',
        border: '1.5px solid rgba(37,211,102,0.32)',
        boxShadow: [
          '0 10px 40px rgba(0,0,0,0.32)',
          '0 0 30px rgba(37,211,102,0.10)',
          'inset 0 1px 0 rgba(255,255,255,0.06)',
        ].join(', '),
      }}
    >
      <BubbleAvatar
        photoFile={face.photoFile}
        initials={computeInitials(face.label)}
        size={132}
        accent={WA_GREEN}
        accentSoft="rgba(37,211,102,0.55)"
      />
      <div style={{
        fontFamily: "'Heebo',sans-serif",
        fontSize: 22, fontWeight: 600,
        color: 'rgba(255,255,255,0.92)',
      }}>
        {face.label}
      </div>
      <button
        type="button"
        data-testid="family-group-whatsapp-button"
        onClick={() => onOpenWhatsApp(face.whatsappUrl)}
        aria-label="WhatsApp לקבוצה"
        style={{
          width: '100%', maxWidth: 320,
          height: 60, borderRadius: 22,
          border: '1.5px solid rgba(37,211,102,0.35)',
          background: `linear-gradient(145deg, #2ee67a, ${WA_GREEN}, #128C7E)`,
          color: 'white',
          fontSize: 18, fontWeight: 700,
          fontFamily: "'Heebo',sans-serif",
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(37,211,102,0.28), inset 0 1px 0 rgba(255,255,255,0.14)',
          letterSpacing: '0.3px',
        }}
      >
        WhatsApp לקבוצה
      </button>
    </div>
  )
}

function PersonBubbleCard({
  face,
  onOpenWhatsApp,
  onOpenTel,
}: {
  face: Extract<FamilyQuickFace, { type: 'person' }>
  onOpenWhatsApp: (url: string) => void
  onOpenTel: (url: string) => void
}) {
  return (
    <div
      data-testid={`family-person-${face.id}`}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 10,
        padding: '16px 12px 14px',
        borderRadius: 22,
        background: 'linear-gradient(160deg, rgba(20,184,166,0.07), rgba(8,16,28,0.55))',
        border: '1px solid rgba(20,184,166,0.20)',
        boxShadow: '0 6px 22px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      <BubbleAvatar
        photoFile={face.photoFile}
        initials={computeInitials(face.displayName)}
        size={88}
        accent={TEAL}
        accentSoft="rgba(20,184,166,0.55)"
      />
      <div style={{
        fontFamily: "'Heebo',sans-serif",
        fontSize: 18, fontWeight: 600,
        color: 'rgba(255,255,255,0.92)',
        textAlign: 'center',
      }}>
        {face.displayName}
      </div>
      {face.relationshipHebrew && (
        <div style={{
          fontFamily: "'Heebo',sans-serif",
          fontSize: 13, fontWeight: 400,
          color: 'rgba(255,255,255,0.50)',
          textAlign: 'center',
          minHeight: 16,
        }}>
          {face.relationshipHebrew}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', marginTop: 2 }}>
        <button
          type="button"
          data-testid={`person-whatsapp-${face.id}`}
          onClick={() => onOpenWhatsApp(buildWhatsAppPersonUrl(face))}
          aria-label={`WhatsApp ל${face.displayName}`}
          style={{
            width: '100%', height: 48, borderRadius: 16,
            border: '1.5px solid rgba(37,211,102,0.32)',
            background: `linear-gradient(145deg, ${WA_GREEN}, #128C7E)`,
            color: 'white',
            fontSize: 15, fontWeight: 700,
            fontFamily: "'Heebo',sans-serif",
            cursor: 'pointer',
            boxShadow: '0 3px 12px rgba(37,211,102,0.22)',
            letterSpacing: '0.2px',
          }}
        >
          WhatsApp
        </button>
        <button
          type="button"
          data-testid={`person-tel-${face.id}`}
          onClick={() => onOpenTel(buildTelUrl(face))}
          aria-label={`שיחה ל${face.displayName}`}
          style={{
            width: '100%', height: 48, borderRadius: 16,
            border: '1.5px solid rgba(20,184,166,0.40)',
            background: 'rgba(20,184,166,0.10)',
            color: TEAL,
            fontSize: 15, fontWeight: 700,
            fontFamily: "'Heebo',sans-serif",
            cursor: 'pointer',
            boxShadow: '0 3px 12px rgba(20,184,166,0.18)',
            letterSpacing: '0.2px',
          }}
        >
          שיחה
        </button>
      </div>
    </div>
  )
}

function BubbleAvatar({
  photoFile,
  initials,
  size,
  accent,
  accentSoft,
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
      boxShadow: `0 0 0 3px rgba(0,0,0,0.25), 0 0 24px ${accentSoft}, 0 6px 18px rgba(0,0,0,0.45)`,
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
          onError={(e) => {
            // Hide broken image so the gradient + initials fallback shows through.
            (e.currentTarget as HTMLImageElement).style.display = 'none'
          }}
        />
      ) : (
        <span style={{
          fontFamily: "'Cormorant Garamond',Georgia,serif",
          fontSize, fontWeight: 600,
          color: accent,
          textShadow: `0 2px 12px ${accentSoft}`,
          lineHeight: 1,
          userSelect: 'none',
        }}>
          {initials}
        </span>
      )}
    </div>
  )
}

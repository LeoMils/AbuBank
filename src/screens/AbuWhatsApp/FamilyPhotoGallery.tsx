/*
 * FamilyPhotoGallery — premium, senior-friendly album modal.
 *
 * Triggered by tapping the Abu/Martita portrait in the AbuWhatsApp header.
 * Lists every photo we already display in the bubble grid, derived from
 * `getFamilyGalleryPhotos()` so any photo added to the contact data
 * source (scaffold or localStorage override) appears automatically — no
 * separate hand-rolled gallery list to maintain.
 *
 * Privacy: phone numbers are never read or shown by this component.
 * Storage / phone data is not even in scope here; the gallery only uses
 * `id`, `label`, `photoUrl` triples from `FamilyGalleryPhoto`.
 */

import { useEffect } from 'react'
import { getFamilyGalleryPhotos, type FamilyGalleryPhoto } from './familyQuickFaces'
import { getLocalContacts } from './familyContactsStorage'

const TEAL = '#14b8a6'
const WA_GREEN = '#25D366'

interface FamilyPhotoGalleryProps {
  open: boolean
  onClose: () => void
  /** Optional extras (e.g. the Abu/Martita header portrait) prepended. */
  extras?: ReadonlyArray<FamilyGalleryPhoto>
  /** Test/Storybook hook — bypass localStorage. */
  photosOverride?: ReadonlyArray<FamilyGalleryPhoto>
}

export function FamilyPhotoGallery({ open, onClose, extras, photosOverride }: FamilyPhotoGalleryProps) {
  // Escape closes on desktop. We also lock body scroll while open so the
  // family grid behind doesn't jitter when the user scrolls inside the
  // modal panel.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  const photos: ReadonlyArray<FamilyGalleryPhoto> = photosOverride
    ?? getFamilyGalleryPhotos(getLocalContacts(), extras ?? [])

  return (
    <div
      data-testid="family-photo-gallery-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="תמונות המשפחה"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(3,7,18,0.78)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        direction: 'rtl',
        padding: '24px 14px calc(24px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div
        data-testid="family-photo-gallery-panel"
        style={{
          width: '100%',
          maxWidth: 460,
          maxHeight: 'calc(100vh - 48px)',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(180deg, rgba(8,16,28,0.98) 0%, rgba(5,10,24,0.98) 100%)',
          border: `1.5px solid ${TEAL}40`,
          borderRadius: 22,
          boxShadow: `0 22px 60px rgba(0,0,0,0.65), 0 0 32px ${TEAL}28`,
          overflow: 'hidden',
        }}
      >
        <header style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'linear-gradient(180deg, rgba(8,16,28,0.96), rgba(8,16,28,0.40))',
        }}>
          <div
            data-testid="family-photo-gallery-title"
            style={{
              fontFamily: "'Heebo',sans-serif",
              fontSize: 18, fontWeight: 700,
              color: 'rgba(255,255,255,0.94)',
              letterSpacing: '0.3px',
            }}
          >
            תמונות המשפחה
          </div>
          <button
            type="button"
            data-testid="family-photo-gallery-close"
            onClick={onClose}
            aria-label="סגירה"
            style={{
              minHeight: 44, minWidth: 44, padding: '8px 16px',
              borderRadius: 14,
              border: `1px solid ${WA_GREEN}55`,
              background: 'rgba(37,211,102,0.10)',
              color: 'rgba(255,255,255,0.92)',
              fontFamily: "'Heebo',sans-serif",
              fontSize: 15, fontWeight: 600,
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            סגירה
          </button>
        </header>

        {photos.length === 0 ? (
          <div
            data-testid="family-photo-gallery-empty"
            style={{
              padding: '40px 18px',
              textAlign: 'center',
              fontFamily: "'Heebo',sans-serif",
              fontSize: 14,
              color: 'rgba(255,255,255,0.55)',
            }}
          >
            עדיין אין תמונות משפחה במכשיר הזה
          </div>
        ) : (
          <div
            data-testid="family-photo-gallery-grid"
            style={{
              flex: '1 1 auto',
              minHeight: 0,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              padding: '14px 12px 18px',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 12,
              alignContent: 'start',
              direction: 'rtl',
            }}
          >
            {photos.map((p) => (
              <figure
                key={`${p.id}:${p.photoUrl}`}
                data-testid={`family-photo-gallery-item-${p.id}`}
                data-photo-id={p.id}
                style={{
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '1 / 1',
                    borderRadius: 18,
                    overflow: 'hidden',
                    border: `1.5px solid ${TEAL}40`,
                    background: 'linear-gradient(145deg, #0b2220, #050A18)',
                    boxShadow: '0 6px 18px rgba(0,0,0,0.45)',
                  }}
                >
                  <img
                    src={p.photoUrl}
                    alt={p.label}
                    loading="lazy"
                    style={{
                      width: '100%', height: '100%',
                      objectFit: 'cover', objectPosition: 'center',
                      display: 'block',
                    }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
                <figcaption
                  style={{
                    fontFamily: "'Heebo',sans-serif",
                    fontSize: 13, fontWeight: 600,
                    color: 'rgba(255,255,255,0.88)',
                    textAlign: 'center',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.label}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

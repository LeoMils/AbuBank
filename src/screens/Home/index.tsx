import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAppStore } from '../../state/store';
import { Screen } from '../../state/types';
import { SERVICES, getGreeting } from './data';
import type { Service } from './data';
import { ICONS } from './icons';
import { getRandomMartitaPhoto, handleMartitaImgError } from '../../services/martitaPhotos';
import { loadLocContacts } from '../Settings';

// Module-level navigation guard
let isNavigating = false;
let navTimer: ReturnType<typeof setTimeout> | null = null;

function handleTap(url: string): void {
  if (isNavigating) return;
  isNavigating = true;
  if (navTimer) clearTimeout(navTimer);
  navTimer = setTimeout(() => { isNavigating = false; }, 800);
  window.location.href = url;
}

const DARK_BG = ['#1a1a2e', '#0a4a45'];
function isDarkService(svc: Service): boolean {
  return DARK_BG.includes(svc.bgColor.toLowerCase());
}

function ServiceLogo({ svc }: { svc: Service }) {
  const [imgFailed, setImgFailed] = useState(false);

  if (imgFailed || !svc.logo) {
    const iconFn = ICONS[svc.id];
    return iconFn ? (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '70%', height: '70%', opacity: 0.95,
        position: 'relative', zIndex: 1,
      }}>
        {iconFn(svc.color)}
      </div>
    ) : null;
  }

  return (
    <img
      src={svc.logo}
      alt={svc.label}
      loading="eager"
      decoding="async"
      style={{
        width: svc.id === 'partner' ? '72%' : svc.id === 'mizrahi' ? '88%' : svc.id === 'iec' ? '80%' : svc.id === 'water' ? '90%' : svc.id === 'arnona' ? '78%' : '84%',
        height: svc.id === 'partner' ? '72%' : svc.id === 'mizrahi' ? '88%' : svc.id === 'iec' ? '80%' : svc.id === 'water' ? '90%' : svc.id === 'arnona' ? '78%' : '84%',
        objectFit: 'contain',
        marginTop: svc.id === 'mizrahi' ? '4%' : undefined,
        position: 'relative', zIndex: 1,
      }}
      onError={() => setImgFailed(true)}
    />
  );
}

const GOLD = '#C9A84C';
const TEAL = '#14b8a6';

export function Home() {
  const [pressed, setPressed] = useState<string | null>(null);
  const [loaded,  setLoaded]  = useState(false);
  const setScreen = useAppStore(s => s.setScreen);
  const greeting = useMemo(() => getGreeting(), []);
  const martitaPhoto = useMemo(() => getRandomMartitaPhoto(), []);

  // Location picker — shown when location button tapped and contacts are configured
  const [locPicker, setLocPicker] = useState(false);
  const [locCoords, setLocCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locToast,  setLocToast]  = useState(false);

  const sendLocationTo = useCallback((phone: string, lat?: number, lng?: number) => {
    const link = lat && lng
      ? `https://maps.google.com/maps?q=${lat},${lng}`
      : 'https://maps.google.com'
    const clean = phone.replace(/\D/g, '')
    const intl  = clean.startsWith('0') ? '972' + clean.slice(1) : clean
    const msg   = `📍 המיקום שלי:\n${link}`
    window.location.href = `whatsapp://send?phone=${intl}&text=${encodeURIComponent(msg)}`
  }, []);

  const handleLocationTap = useCallback(() => {
    const contacts = loadLocContacts()
    const getCoords = (cb: (lat?: number, lng?: number) => void) => {
      if (!navigator.geolocation) { cb(); return }
      navigator.geolocation.getCurrentPosition(
        p => cb(p.coords.latitude, p.coords.longitude),
        ()  => cb(),
        { timeout: 6000, maximumAge: 300000, enableHighAccuracy: false }
      )
    }
    if (contacts.length === 0) {
      // No contacts — copy location to clipboard then open the family WhatsApp group
      getCoords(async (lat, lng) => {
        const link = lat && lng ? `https://maps.google.com/maps?q=${lat},${lng}` : 'https://maps.google.com'
        const msg  = `📍 המיקום שלי:\n${link}`
        try { await navigator.clipboard.writeText(msg) } catch { /* ignore */ }
        setLocToast(true)
        setTimeout(() => setLocToast(false), 4500)
        setTimeout(() => {
          window.location.href = 'https://chat.whatsapp.com/JqqGpPKTCq3L0JnitU5y5f'
        }, 600)
      })
      return
    }
    if (contacts.length === 1) {
      // Single contact — send directly, no picker needed
      getCoords((lat, lng) => sendLocationTo(contacts[0]!.phone, lat, lng))
      return
    }
    // Multiple contacts — get GPS first, then show picker
    getCoords((lat, lng) => {
      setLocCoords(lat && lng ? { lat, lng } : null)
      setLocPicker(true)
    })
  }, [sendLocationTo]);

  const tapTimestamps = useRef<number[]>([]);
  function handleWordmarkTap() {
    const now = Date.now();
    tapTimestamps.current = [...tapTimestamps.current, now].filter(t => now - t < 1500);
    if (tapTimestamps.current.length >= 3) {
      tapTimestamps.current = [];
      setScreen(Screen.Admin);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 60);
    const onVisibility = () => { if (!document.hidden) isNavigating = false; };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(t);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <div
      dir="rtl"
      style={{
        height: '100%', width: '100%', overflow: 'hidden',
        background: 'linear-gradient(180deg, #070D1E 0%, #050A18 40%, #050A18 100%)',
        display: 'flex', flexDirection: 'column',
        fontFamily: "'DM Sans','Heebo',sans-serif",
        userSelect: 'none', WebkitUserSelect: 'none',
      }}
    >
      {/* ─── HERO HEADER ─── */}
      <header style={{
        display: 'flex', alignItems: 'center',
        direction: 'ltr',
        flexShrink: 0,
        padding: '14px 8px 10px 8px',
        gap: 8,
        position: 'relative',
      }}>
        {/* Ambient glow */}
        <div aria-hidden="true" style={{
          position: 'absolute', top: '30%', left: '55%',
          transform: 'translate(-50%, -50%)',
          width: '90%', height: '200%',
          background: 'radial-gradient(ellipse at center, rgba(201,168,76,0.06) 0%, rgba(20,184,166,0.03) 35%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        {/* Martita portrait */}
        <div style={{
          width: 74, height: 74, borderRadius: '50%',
          overflow: 'hidden', position: 'relative', flexShrink: 0,
          marginLeft: 32,
          border: '2.5px solid rgba(201,168,76,0.60)',
          boxShadow: [
            '0 0 0 3px rgba(201,168,76,0.07)',
            '0 0 24px rgba(201,168,76,0.20)',
            '0 4px 14px rgba(0,0,0,0.45)',
          ].join(', '),
          background: 'linear-gradient(145deg, #0c2228, #050A18)',
        }}>
          <img
            src={martitaPhoto} alt="Martita" loading="eager" decoding="async"
            fetchPriority="high"
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'center 15%',
              display: 'block',
            }}
            onError={handleMartitaImgError}
          />
        </div>

        {/* Brand zone — wordmark + greeting */}
        <div
          onClick={handleWordmarkTap}
          role="presentation"
          style={{
            flex: 1, minWidth: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 4,
            cursor: 'default',
          }}
        >
          {/* AbuBank — luxury metallic wordmark */}
          <div style={{
            display: 'flex', alignItems: 'baseline',
            direction: 'ltr', gap: 3,
            position: 'relative',
          }}>
            {/* Aura glow */}
            <div aria-hidden="true" style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '130%', height: '260%',
              background: 'radial-gradient(ellipse at center, rgba(94,234,212,0.12) 0%, rgba(245,158,11,0.06) 40%, transparent 68%)',
              pointerEvents: 'none', filter: 'blur(10px)',
            }} />
            <span style={{
              fontFamily: "'Cormorant Garamond',Georgia,serif",
              fontSize: 46, fontWeight: 600,
              letterSpacing: '2.5px',
              background: 'linear-gradient(135deg, #5EEAD4 0%, #2DD4BF 14%, #0D9488 28%, #5EEAD4 42%, #14B8A6 58%, #0F766E 74%, #5EEAD4 88%, #2DD4BF 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 14px rgba(94,234,212,0.40)) drop-shadow(0 0 35px rgba(20,184,166,0.18)) drop-shadow(0 2px 3px rgba(0,0,0,0.65))',
              position: 'relative',
            } as React.CSSProperties}>Abu</span>
            <span style={{
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 42, fontWeight: 500,
              letterSpacing: '1.5px',
              background: 'linear-gradient(135deg, #FDE68A 0%, #F59E0B 12%, #D97706 26%, #FBBF24 40%, #B45309 55%, #D4A843 68%, #F59E0B 80%, #FDE68A 92%, #EAB308 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 12px rgba(245,158,11,0.35)) drop-shadow(0 0 28px rgba(201,168,76,0.18)) drop-shadow(0 2px 3px rgba(0,0,0,0.60))',
              position: 'relative',
            } as React.CSSProperties}>Bank</span>
          </div>

          {/* Greeting — luxury metallic matching Abu family logos */}
          <div style={{
            direction: 'rtl', textAlign: 'center',
            maxWidth: '100%', marginTop: 2,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
          }}>
            {/* Main greeting line */}
            <div style={{
              fontFamily: "'Heebo','DM Sans',sans-serif",
              fontSize: 23, fontWeight: 700,
              lineHeight: 1.3,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              maxWidth: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <span style={{ fontSize: 24, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5)) drop-shadow(0 0 14px rgba(94,234,212,0.35))' }}>{greeting.emoji}</span>
              <span style={{
                background: 'linear-gradient(135deg, #5EEAD4 0%, #2DD4BF 15%, #0D9488 30%, #5EEAD4 48%, #14B8A6 65%, #0F766E 80%, #5EEAD4 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 0 14px rgba(94,234,212,0.40)) drop-shadow(0 0 30px rgba(20,184,166,0.18)) drop-shadow(0 2px 4px rgba(0,0,0,0.60))',
              } as React.CSSProperties}>{greeting.text},</span>
              <span style={{
                fontFamily: "'Cormorant Garamond',Georgia,serif",
                fontWeight: 700,
                fontStyle: 'italic',
                fontSize: 26,
                letterSpacing: '1.5px',
                background: 'linear-gradient(135deg, #FDE68A 0%, #F59E0B 12%, #D97706 26%, #FBBF24 40%, #B45309 55%, #D4A843 68%, #F59E0B 80%, #FDE68A 92%, #EAB308 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 0 16px rgba(245,158,11,0.45)) drop-shadow(0 0 32px rgba(201,168,76,0.22)) drop-shadow(0 2px 3px rgba(0,0,0,0.55))',
              } as React.CSSProperties}>Martita</span>
            </div>

          </div>
        </div>
      </header>

      {/* ─── SERVICE GRID ─── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'stretch',
        overflowY: 'hidden', overflowX: 'hidden', padding: '4px 16px 4px',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
          gridTemplateRows: 'repeat(3,1fr)',
          height: '100%', width: '100%',
          alignItems: 'center', justifyItems: 'center',
        }}>
          {SERVICES.map((svc, i) => {
            const rgb = hexToRgb(svc.color);
            const dark = isDarkService(svc);
            return (
              <div
                key={svc.id}
                className="bubble-focus"
                role="button"
                aria-label={`פתח ${svc.label}`}
                tabIndex={0}
                onClick={() => handleTap(svc.url)}
                onPointerDown={() => setPressed(svc.id)}
                onPointerUp={() => setPressed(null)}
                onPointerLeave={() => setPressed(null)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTap(svc.url); } }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                  cursor: 'pointer', width: '100%',
                  opacity: loaded ? 1 : 0,
                  transform: loaded ? 'scale(1)' : 'scale(0.75)',
                  transition: `opacity 0.35s ease-out ${0.05 + i * 0.04}s, transform 0.3s ease-out ${0.05 + i * 0.04}s`,
                }}
              >
                {/* 3D Water-drop — per-service volumetric gradient, glass caustics on top */}
                <div style={{
                  width: 68, height: 68, borderRadius: '50%',
                  position: 'relative', overflow: 'hidden',
                  background: (() => {
                    const g: Record<string, string> = {
                      mizrahi: 'radial-gradient(circle at 38% 32%, rgba(255,220,180,0.95) 0%, #f97316 42%, #92380a 72%, #1e0800 100%)',
                      postal:  'radial-gradient(circle at 38% 32%, rgba(180,210,255,0.95) 0%, #3b82f6 42%, #1240a0 72%, #040f2a 100%)',
                      max:     'radial-gradient(circle at 38% 32%, rgba(220,180,255,0.95) 0%, #a855f7 42%, #5b1fa8 72%, #110520 100%)',
                      water:   'radial-gradient(circle at 38% 32%, rgba(180,248,255,0.95) 0%, #06b6d4 42%, #036b7e 72%, #001519 100%)',
                      iec:     'radial-gradient(circle at 38% 32%, rgba(255,248,160,0.95) 0%, #eab308 42%, #8a6200 72%, #1a1000 100%)',
                      arnona:  'radial-gradient(circle at 38% 32%, rgba(180,255,200,0.95) 0%, #22c55e 42%, #0d6b30 72%, #011508 100%)',
                      hot:     'radial-gradient(circle at 38% 32%, rgba(255,180,180,0.95) 0%, #ef4444 42%, #8a0f0f 72%, #1a0000 100%)',
                      partner: 'radial-gradient(circle at 38% 32%, rgba(210,185,255,0.95) 0%, #8b5cf6 42%, #4a1fa0 72%, #0c0420 100%)',
                      yes:     'radial-gradient(circle at 38% 32%, rgba(175,225,255,0.95) 0%, #0ea5e9 42%, #065d88 72%, #010e1a 100%)',
                    };
                    return g[svc.id] ?? `radial-gradient(circle at 38% 32%, rgba(255,255,255,0.90) 0%, ${svc.color} 42%, #111 100%)`;
                  })(),
                  boxShadow: pressed === svc.id
                    ? `0 1px 4px rgba(0,0,0,0.6)`
                    : [
                        `0 0 22px rgba(${rgb},0.62)`,
                        `0 0 8px rgba(${rgb},0.28)`,
                        `0 10px 24px rgba(0,0,0,0.55)`,
                      ].join(', '),
                  transform: pressed === svc.id ? 'scale(0.92)' : 'scale(1)',
                  transition: 'transform 0.12s ease-out, box-shadow 0.12s ease-out',
                }}>
                  {/* Logo — fills entire sphere */}
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', zIndex: 1,
                  }}>
                    <ServiceLogo svc={svc} />
                  </div>
                  {/* Primary specular — large soft highlight top-left */}
                  <div aria-hidden="true" style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    background: 'radial-gradient(ellipse at 28% 22%, rgba(255,255,255,0.90) 0%, rgba(255,255,255,0.35) 22%, transparent 55%)',
                    zIndex: 2, pointerEvents: 'none',
                  }}/>
                  {/* Secondary caustic — small bright ellipse center-top */}
                  <div aria-hidden="true" style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    background: 'radial-gradient(ellipse at 55% 12%, rgba(255,255,255,0.60) 0%, transparent 30%)',
                    zIndex: 3, pointerEvents: 'none',
                  }}/>
                  {/* Tight sparkle dot — the "wet" point */}
                  <div aria-hidden="true" style={{
                    position: 'absolute',
                    top: '14%', left: '22%',
                    width: '13%', height: '9%',
                    background: 'radial-gradient(ellipse, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 80%)',
                    borderRadius: '50%', pointerEvents: 'none', zIndex: 4,
                  }} />
                  {/* Deep bottom shadow — volume and depth */}
                  <div aria-hidden="true" style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    boxShadow: 'inset 0 -14px 28px rgba(0,0,0,0.55), inset 0 6px 12px rgba(255,255,255,0.12)',
                    pointerEvents: 'none', zIndex: 5,
                  }}/>
                  {/* Sphere rim — thin elegant border */}
                  <div aria-hidden="true" style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    border: '1px solid rgba(255,255,255,0.18)',
                    pointerEvents: 'none', zIndex: 6,
                  }}/>
                </div>
                <span style={{
                  fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.95)',
                  fontFamily: "'Heebo',sans-serif", textAlign: 'center',
                  lineHeight: 1.25, direction: 'rtl',
                  maxWidth: 110, wordBreak: 'break-word',
                  textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                }}>
                  {svc.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── LOCATION PICKER OVERLAY ─── */}
      {locPicker && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          background: 'rgba(5,10,24,0.82)',
          backdropFilter: 'blur(6px)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 14, padding: '0 24px',
        }}
          onClick={() => setLocPicker(false)}
        >
          <div style={{
            width: '100%', maxWidth: 340,
            background: 'linear-gradient(135deg, rgba(14,22,44,0.98), rgba(5,10,24,0.98))',
            border: '1px solid rgba(56,189,248,0.30)',
            borderRadius: 20, padding: '22px 18px',
            display: 'flex', flexDirection: 'column', gap: 12,
            boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
          }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.92)',
              textAlign: 'center', fontFamily: "'Heebo',sans-serif", direction: 'rtl' }}>
              📍 שלחי מיקום ל:
            </div>
            {loadLocContacts().map(c => (
              <button key={c.id}
                onClick={() => {
                  setLocPicker(false)
                  sendLocationTo(c.phone, locCoords?.lat, locCoords?.lng)
                }}
                style={{
                  width: '100%', padding: '15px 18px', borderRadius: 14,
                  background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.30)',
                  color: 'white', fontSize: 17, fontWeight: 600,
                  fontFamily: "'Heebo',sans-serif", cursor: 'pointer', direction: 'rtl',
                  textAlign: 'right',
                }}>
                {c.name} <span style={{ fontSize: 13, opacity: 0.5, fontWeight: 400 }}>{c.phone}</span>
              </button>
            ))}
            <button onClick={() => setLocPicker(false)} style={{
              marginTop: 2, padding: '11px', borderRadius: 12, border: 'none',
              background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)',
              fontSize: 14, fontFamily: "'Heebo',sans-serif", cursor: 'pointer',
            }}>
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* ─── LOCATION COPIED TOAST ─── */}
      {locToast && (
        <div style={{
          position: 'absolute', bottom: 110, left: '50%', transform: 'translateX(-50%)',
          zIndex: 60, pointerEvents: 'none',
          background: 'rgba(20,184,166,0.18)',
          border: '1px solid rgba(20,184,166,0.45)',
          backdropFilter: 'blur(8px)',
          borderRadius: 16, padding: '12px 22px',
          color: 'rgba(255,255,255,0.95)', fontSize: 15, fontWeight: 600,
          fontFamily: "'Heebo',sans-serif", direction: 'rtl',
          whiteSpace: 'nowrap', textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        }}>
          📋 מיקום הועתק — הדבקי ב קבוצה ושלחי
        </div>
      )}


      {/* ─── ABU FAMILY FOOTER ─── */}
      <footer style={{
        position: 'relative',
        display: 'flex', justifyContent: 'space-evenly', alignItems: 'flex-start',
        paddingTop: 10, paddingLeft: 4, paddingRight: 4,
        paddingBottom: 'calc(8px + env(safe-area-inset-bottom,0px))',
        flexShrink: 0,
        borderTop: '1px solid transparent',
        backgroundImage: [
          'linear-gradient(180deg, rgba(7,13,30,0.98), rgba(3,5,18,1.0))',
          'linear-gradient(90deg, transparent 0%, rgba(201,168,76,0.28) 25%, rgba(201,168,76,0.42) 50%, rgba(201,168,76,0.28) 75%, transparent 100%)',
        ].join(', '),
        backgroundOrigin: 'padding-box, border-box',
        backgroundClip: 'padding-box, border-box',
        borderImage: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.40) 30%, rgba(201,168,76,0.55) 50%, rgba(201,168,76,0.40) 70%, transparent) 1',
      }}>
        {/* Settings — gear icon, top-right corner */}
        <button
          type="button"
          className="btn-focus"
          onClick={() => setScreen(Screen.Settings)}
          aria-label="הגדרות"
          style={{
            position: 'absolute', top: 4, right: 8,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            padding: '6px 8px', cursor: 'pointer', background: 'none', border: 'none',
            minWidth: 44, minHeight: 52,
          }}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none"
            stroke="rgba(255,255,255,0.78)" strokeWidth="1.7"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.72)',
            fontFamily: "'Heebo',sans-serif", lineHeight: 1 }}>הגדרות</span>
        </button>
        {/* Version indicator */}
        <div style={{
          position: 'absolute', top: 7, left: 10,
          fontSize: 10, fontWeight: 700, letterSpacing: '0.8px',
          color: 'rgba(201,168,76,0.65)',
          fontFamily: "'DM Sans',monospace",
          userSelect: 'none',
          pointerEvents: 'none',
        }}>v13.0</div>
        {/* 4 main icons — evenly spaced */}
        {footerItems.map(item => (
          <button
            key={item.id}
            type="button"
            className="btn-focus"
            onClick={item.id === 'calendar'  ? () => setScreen(Screen.AbuCalendar)
              : item.id === 'ai'       ? () => setScreen(Screen.AbuAI)
              : item.id === 'games'    ? () => setScreen(Screen.AbuGames)
              : item.id === 'weather'  ? () => setScreen(Screen.AbuWeather)
              : item.id === 'whatsapp' ? () => setScreen(Screen.AbuWhatsApp)
              : undefined}
            aria-label={item.hebrewLabel}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '4px 2px', minWidth: 52, minHeight: 56,
              cursor: 'pointer', background: 'none', border: 'none',
            }}
          >
            <svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true"
              style={{
                filter: `drop-shadow(0 3px 8px rgba(0,0,0,0.45)) drop-shadow(0 0 12px rgba(${item.rgb},0.35))`,
              }}>
              <defs><linearGradient id={item.gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={item.gradStart}/><stop offset="100%" stopColor={item.gradEnd}/>
              </linearGradient></defs>
              {item.svgContent}
            </svg>
            <span style={{
              fontSize: 14, fontWeight: 700,
              fontFamily: "'Heebo',sans-serif",
              lineHeight: 1.2, textAlign: 'center', whiteSpace: 'nowrap',
              color: item.labelColor, opacity: 0.95,
              textShadow: `0 1px 3px rgba(0,0,0,0.5), 0 0 8px rgba(${item.rgb},0.20)`,
            }}>
              {item.hebrewLabel}
            </span>
          </button>
        ))}
      </footer>
    </div>
  );
}

const footerItems: {
  id: string; hebrewLabel: string; labelColor: string;
  rgb: string; rgbDark: string; gradId: string;
  gradStart: string; gradEnd: string; svgContent: React.ReactNode;
}[] = [
  {
    id: 'weather',
    hebrewLabel: 'Abu מזג אוויר',
    labelColor: '#93c5fd',
    rgb: '147,197,253',
    rgbDark: '37,99,235',
    gradId: 'wxG',
    gradStart: '#bae6fd',
    gradEnd: '#1d4ed8',
    svgContent: (
      <>
        {/* Sun + cloud — photorealistic 3D weather icon */}
        <defs>
          <radialGradient id="wx_sun" cx="38%" cy="32%" r="58%">
            <stop offset="0%" stopColor="#FDE68A"/>
            <stop offset="40%" stopColor="#F59E0B"/>
            <stop offset="100%" stopColor="#B45309"/>
          </radialGradient>
          <radialGradient id="wx_sunhi" cx="30%" cy="25%" r="45%">
            <stop offset="0%" stopColor="rgba(255,250,210,0.90)"/>
            <stop offset="100%" stopColor="rgba(255,250,210,0)"/>
          </radialGradient>
          <radialGradient id="wx_cld" cx="35%" cy="28%" r="65%">
            <stop offset="0%" stopColor="#E0F2FE"/>
            <stop offset="40%" stopColor="#BAE6FD"/>
            <stop offset="80%" stopColor="#7DD3FC"/>
            <stop offset="100%" stopColor="#38BDF8"/>
          </radialGradient>
          <radialGradient id="wx_cldhi" cx="28%" cy="22%" r="40%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.85)"/>
            <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
          </radialGradient>
          <filter id="wx_blur"><feGaussianBlur stdDeviation="0.4"/></filter>
        </defs>
        {/* Sun body */}
        <circle cx="8.5" cy="8.5" r="5.2" fill="url(#wx_sun)"/>
        <circle cx="8.5" cy="8.5" r="5.2" fill="url(#wx_sunhi)"/>
        {/* Sun rays */}
        {[0,45,90,135,180,225,270,315].map((deg, i) => {
          const rad = (deg * Math.PI) / 180
          const x1 = 8.5 + 6.2 * Math.cos(rad)
          const y1 = 8.5 + 6.2 * Math.sin(rad)
          const x2 = 8.5 + 7.4 * Math.cos(rad)
          const y2 = 8.5 + 7.4 * Math.sin(rad)
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#FCD34D" strokeWidth="1.2" strokeLinecap="round" opacity="0.80"/>
        })}
        {/* Cloud shadow */}
        <ellipse cx="14" cy="16.5" rx="6.8" ry="2" fill="rgba(0,0,0,0.18)" filter="url(#wx_blur)"/>
        {/* Cloud body — rounded puffs */}
        <rect x="7.5" y="12.5" width="13" height="6.5" rx="3.25" fill="url(#wx_cld)"/>
        <circle cx="11"  cy="13.2" r="3.2"  fill="url(#wx_cld)"/>
        <circle cx="15"  cy="12.5" r="3.8"  fill="url(#wx_cld)"/>
        <circle cx="18"  cy="13.5" r="2.8"  fill="url(#wx_cld)"/>
        {/* Cloud highlight */}
        <ellipse cx="13" cy="12.0" rx="4" ry="1.4" fill="url(#wx_cldhi)" opacity="0.80"/>
      </>
    ),
  },
  {
    id: 'calendar',
    hebrewLabel: 'Abu יומן',
    labelColor: '#c4b5fd',
    rgb: '196,181,253',
    rgbDark: '109,40,217',
    gradId: 'calG',
    gradStart: '#c4b5fd',
    gradEnd: '#7c3aed',
    svgContent: (
      <>
        {/* Premium calendar icon — rounded body, dark top bar, ring pegs, colorful dots */}
        <defs>
          <linearGradient id="cal_body" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1e1b4b"/>
            <stop offset="100%" stopColor="#0f0a2e"/>
          </linearGradient>
          <linearGradient id="cal_bar" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c4b5fd"/>
            <stop offset="100%" stopColor="#7c3aed"/>
          </linearGradient>
        </defs>
        {/* Calendar body */}
        <rect x="2" y="4" width="20" height="18" rx="3" fill="url(#cal_body)" stroke="rgba(196,181,253,0.30)" strokeWidth="0.5"/>
        {/* Top bar (month header) */}
        <rect x="2" y="4" width="20" height="6" rx="3" fill="url(#cal_bar)"/>
        {/* Mask bottom corners of bar */}
        <rect x="2" y="7.5" width="20" height="2.5" fill="url(#cal_bar)"/>
        {/* Ring pegs */}
        <rect x="7.5" y="2" width="2" height="4.5" rx="1" fill="#c4b5fd"/>
        <rect x="14.5" y="2" width="2" height="4.5" rx="1" fill="#c4b5fd"/>
        {/* Colorful dots — 3×2 grid */}
        {/* Row 1 */}
        <circle cx="7"  cy="15" r="1.6" fill="#FF6B9D"/>
        <circle cx="12" cy="15" r="1.6" fill="#FFE66D"/>
        <circle cx="17" cy="15" r="1.6" fill="#4ECDC4"/>
        {/* Row 2 */}
        <circle cx="7"  cy="19" r="1.6" fill="#A78BFA"/>
        <circle cx="12" cy="19" r="1.6" fill="#FB923C"/>
        <circle cx="17" cy="19" r="1.6" fill="#60A5FA"/>
      </>
    ),
  },
  {
    id: 'ai',
    hebrewLabel: 'Abu AI',
    labelColor: '#fcd34d',
    rgb: '251,191,36',
    rgbDark: '180,83,9',
    gradId: 'aiG',
    gradStart: '#fcd34d',
    gradEnd: '#b45309',
    svgContent: (
      <>
        {/* OIL PAINTING — Cosmic crystal orb, deep space violet with golden stardust */}
        <defs>
          <filter id="aPaint" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="4" result="n"/>
            <feDisplacementMap in="SourceGraphic" in2="n" scale="0.7" xChannelSelector="R" yChannelSelector="G"/>
          </filter>
          <radialGradient id="a_bg" cx="40%" cy="38%" r="58%">
            <stop offset="0%" stopColor="#4c1d95"/><stop offset="20%" stopColor="#3b0764"/>
            <stop offset="50%" stopColor="#1e0a45"/><stop offset="80%" stopColor="#0c0525"/>
            <stop offset="100%" stopColor="#050210"/>
          </radialGradient>
          <radialGradient id="a_neb1" cx="35%" cy="40%" r="40%">
            <stop offset="0%" stopColor="rgba(139,92,246,0.30)"/>
            <stop offset="100%" stopColor="rgba(139,92,246,0)"/>
          </radialGradient>
          <radialGradient id="a_neb2" cx="65%" cy="55%" r="35%">
            <stop offset="0%" stopColor="rgba(236,72,153,0.18)"/>
            <stop offset="100%" stopColor="rgba(236,72,153,0)"/>
          </radialGradient>
          <radialGradient id="a_core" cx="50%" cy="46%" r="25%">
            <stop offset="0%" stopColor="rgba(253,224,71,0.65)"/>
            <stop offset="40%" stopColor="rgba(251,191,36,0.25)"/>
            <stop offset="100%" stopColor="rgba(251,191,36,0)"/>
          </radialGradient>
          <radialGradient id="a_hi" cx="32%" cy="26%" r="40%">
            <stop offset="0%" stopColor="rgba(230,220,255,0.70)"/>
            <stop offset="40%" stopColor="rgba(200,180,255,0.18)"/>
            <stop offset="100%" stopColor="rgba(200,180,255,0)"/>
          </radialGradient>
        </defs>
        {/* Deep cosmic base — painted */}
        <circle cx="12" cy="12" r="11.3" fill="url(#a_bg)" filter="url(#aPaint)"/>
        <circle cx="12" cy="12" r="11.3" fill="url(#a_bg)"/>
        {/* Nebula color clouds — oil-paint layered */}
        <circle cx="9" cy="10" r="6" fill="url(#a_neb1)"/>
        <circle cx="15" cy="14" r="5" fill="url(#a_neb2)"/>
        <ellipse cx="7" cy="15" rx="3" ry="2" fill="rgba(59,130,246,0.10)" transform="rotate(-20 7 15)"/>
        <ellipse cx="17" cy="8" rx="2.5" ry="1.5" fill="rgba(168,85,247,0.08)" transform="rotate(15 17 8)"/>
        {/* Golden core glow */}
        <circle cx="12" cy="12" r="5" fill="url(#a_core)"/>
        {/* ── GOLDEN STARBURST — main sparkle ── */}
        <path d="M12 5l1.5 4.5L19 12l-5.5 2.5L12 19l-1.5-4.5L5 12l5.5-2.5z"
          fill="rgba(253,224,71,0.85)" stroke="rgba(254,243,199,0.5)" strokeWidth="0.2"/>
        {/* Inner diagonal sparkle */}
        <path d="M12 7.5l1 3L16.5 9.5l-2 2.5 2 2.5L13 13.5l-1 3-1-3L7.5 14.5l2-2.5-2-2.5L11 10.5z"
          fill="rgba(253,224,71,0.35)" stroke="rgba(254,243,199,0.2)" strokeWidth="0.1"/>
        {/* Bright white core */}
        <circle cx="12" cy="12" r="2" fill="rgba(253,224,71,0.55)"/>
        <circle cx="12" cy="12" r="1" fill="rgba(255,250,220,0.75)"/>
        <circle cx="12" cy="12" r="0.4" fill="rgba(255,255,255,0.95)"/>
        {/* Core specular */}
        <ellipse cx="11.4" cy="11.3" rx="0.5" ry="0.25" fill="rgba(255,255,255,0.6)" transform="rotate(-25 11.4 11.3)"/>
        {/* Orbiting sparkle satellites */}
        <path d="M18 5.5l.4 1.2 1.2.4-1.2.4-.4 1.2-.4-1.2-1.2-.4 1.2-.4z" fill="#fcd34d" opacity="0.75"/>
        <circle cx="18" cy="6.7" r="0.3" fill="rgba(255,255,255,0.65)"/>
        <path d="M5 17l.35 1 1 .35-1 .35-.35 1-.35-1-1-.35 1-.35z" fill="#fbbf24" opacity="0.60"/>
        <path d="M4.5 6l.25.7.7.25-.7.25-.25.7-.25-.7-.7-.25.7-.25z" fill="#fcd34d" opacity="0.50"/>
        <path d="M19 16l.2.55.55.2-.55.2-.2.55-.2-.55-.55-.2.55-.2z" fill="#f59e0b" opacity="0.45"/>
        {/* Constellation threads */}
        <line x1="12" y1="12" x2="18" y2="6.7" stroke="rgba(253,224,71,0.18)" strokeWidth="0.2"/>
        <line x1="12" y1="12" x2="5" y2="17.7" stroke="rgba(253,224,71,0.14)" strokeWidth="0.2"/>
        <line x1="12" y1="12" x2="4.5" y2="6.5" stroke="rgba(253,224,71,0.10)" strokeWidth="0.15"/>
        <line x1="12" y1="12" x2="19" y2="16.5" stroke="rgba(253,224,71,0.10)" strokeWidth="0.15"/>
        <line x1="18" y1="6.7" x2="4.5" y2="6.5" stroke="rgba(253,224,71,0.06)" strokeWidth="0.1"/>
        {/* Tiny background stars */}
        <circle cx="3.5" cy="4" r="0.2" fill="rgba(255,255,255,0.4)"/>
        <circle cx="20" cy="4" r="0.15" fill="rgba(255,255,255,0.3)"/>
        <circle cx="20.5" cy="19" r="0.2" fill="rgba(255,255,255,0.25)"/>
        <circle cx="3" cy="19.5" r="0.15" fill="rgba(255,255,255,0.2)"/>
        <circle cx="15.5" cy="3" r="0.15" fill="rgba(255,255,255,0.25)"/>
        <circle cx="8" cy="20" r="0.15" fill="rgba(255,255,255,0.2)"/>
        <circle cx="2.5" cy="11" r="0.12" fill="rgba(255,255,255,0.2)"/>
        <circle cx="21" cy="12" r="0.12" fill="rgba(255,255,255,0.18)"/>
        {/* Oil paint specular */}
        <circle cx="12" cy="12" r="11" fill="url(#a_hi)"/>
        <ellipse cx="7.5" cy="5.5" rx="4.5" ry="3" fill="rgba(255,255,255,0.16)" transform="rotate(-28 7.5 5.5)"/>
        <ellipse cx="7" cy="4.8" rx="2" ry="0.9" fill="rgba(255,255,255,0.38)" transform="rotate(-28 7 4.8)"/>
        {/* Violet rim glow */}
        <circle cx="12" cy="12" r="11.3" fill="none" stroke="rgba(139,92,246,0.22)" strokeWidth="0.5"/>
      </>
    ),
  },
  {
    id: 'games',
    hebrewLabel: 'Abu Games',
    labelColor: '#fca5a5',
    rgb: '220,50,50',
    rgbDark: '140,20,20',
    gradId: 'gameG',
    gradStart: '#fca5a5',
    gradEnd: '#991b1b',
    svgContent: (
      <>
        {/* OIL PAINTING — Fanned royal playing cards on rich emerald velvet */}
        <defs>
          <filter id="gPaint" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="4" result="n"/>
            <feDisplacementMap in="SourceGraphic" in2="n" scale="0.7" xChannelSelector="R" yChannelSelector="G"/>
          </filter>
          <radialGradient id="g_bg" cx="40%" cy="38%" r="58%">
            <stop offset="0%" stopColor="#166534"/><stop offset="25%" stopColor="#14532d"/>
            <stop offset="55%" stopColor="#0a3a1a"/><stop offset="80%" stopColor="#052e12"/>
            <stop offset="100%" stopColor="#021a08"/>
          </radialGradient>
          <linearGradient id="g_card" x1="30%" y1="0%" x2="70%" y2="100%">
            <stop offset="0%" stopColor="#fffef5"/><stop offset="40%" stopColor="#fef8e0"/>
            <stop offset="100%" stopColor="#f0e6c8"/>
          </linearGradient>
          <linearGradient id="g_back" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e40af"/><stop offset="30%" stopColor="#1e3a8a"/>
            <stop offset="70%" stopColor="#172554"/><stop offset="100%" stopColor="#0f172a"/>
          </linearGradient>
          <radialGradient id="g_hi" cx="32%" cy="26%" r="40%">
            <stop offset="0%" stopColor="rgba(200,255,200,0.55)"/>
            <stop offset="40%" stopColor="rgba(150,230,150,0.15)"/>
            <stop offset="100%" stopColor="rgba(150,230,150,0)"/>
          </radialGradient>
        </defs>
        {/* Deep emerald velvet table — painted texture */}
        <circle cx="12" cy="12" r="11.3" fill="url(#g_bg)" filter="url(#gPaint)"/>
        <circle cx="12" cy="12" r="11.3" fill="url(#g_bg)"/>
        {/* Velvet texture patches */}
        <ellipse cx="8" cy="8" rx="4" ry="3" fill="rgba(22,101,52,0.15)" transform="rotate(-10 8 8)"/>
        <ellipse cx="16" cy="16" rx="3" ry="2" fill="rgba(20,83,45,0.12)" transform="rotate(15 16 16)"/>
        {/* ── FANNED PLAYING CARDS ── */}
        {/* Card 3 (back card) — royal blue back, tilted left */}
        <g transform="rotate(-22 12 14)">
          <rect x="5" y="3.5" width="9" height="13" rx="0.8" fill="url(#g_back)" stroke="rgba(255,255,255,0.25)" strokeWidth="0.3"/>
          {/* Ornate back pattern */}
          <rect x="6" y="4.5" width="7" height="11" rx="0.4" fill="none" stroke="rgba(201,168,76,0.35)" strokeWidth="0.25"/>
          <rect x="6.8" y="5.3" width="5.4" height="9.4" rx="0.3" fill="none" stroke="rgba(201,168,76,0.20)" strokeWidth="0.2"/>
          {/* Gold diamond center on back */}
          <path d="M9.5 8 L10.5 10 L9.5 12 L8.5 10 Z" fill="rgba(201,168,76,0.30)" stroke="rgba(201,168,76,0.20)" strokeWidth="0.15"/>
        </g>
        {/* Card 2 (middle) — white face, tilted slightly left */}
        <g transform="rotate(-8 12 14)">
          <rect x="6" y="3" width="9" height="13" rx="0.8" fill="url(#g_card)" stroke="rgba(200,190,170,0.5)" strokeWidth="0.3"/>
          {/* Red diamond suit — large center */}
          <path d="M10.5 7 L12.5 10 L10.5 13 L8.5 10 Z" fill="#e11d48" stroke="rgba(225,29,72,0.4)" strokeWidth="0.15"/>
          {/* Corner marks */}
          <text x="7.2" y="5.5" fill="#e11d48" fontSize="2.2" fontWeight="bold" fontFamily="serif">K</text>
          <path d="M7.5 6.2 L8.2 7 L7.5 7.8 L6.8 7 Z" fill="#e11d48" opacity="0.7" transform="scale(0.5) translate(8.5 10)"/>
        </g>
        {/* Card 1 (front card) — white face, tilted right */}
        <g transform="rotate(12 12 14)">
          <rect x="7" y="2.5" width="9" height="13" rx="0.8" fill="url(#g_card)" stroke="rgba(200,190,170,0.55)" strokeWidth="0.3"/>
          {/* Black spade suit — large center */}
          <path d="M11.5 6.5c-1.5 2-3.2 3.5-3.2 5.5 0 1.4 1.1 2.1 2.3 1.8 0 0-.5 1.2-1 1.5h3.8c-.5-.3-1-1.5-1-1.5 1.2.3 2.3-.4 2.3-1.8 0-2-1.7-3.5-3.2-5.5z"
            fill="#1a1a2e" stroke="rgba(0,0,0,0.3)" strokeWidth="0.15"/>
          {/* Corner — A of spades */}
          <text x="8.2" y="5" fill="#1a1a2e" fontSize="2.2" fontWeight="bold" fontFamily="serif">A</text>
          {/* Small spade below A */}
          <path d="M8.8 5.3c-.3.4-.6.7-.6 1 0 .3.2.4.4.3 0 0-.1.2-.2.3h.7c-.1-.1-.2-.3-.2-.3.2.1.4-.1.4-.3 0-.3-.3-.6-.5-1z"
            fill="#1a1a2e" opacity="0.7"/>
        </g>
        {/* Card edge highlights — painted light catching edges */}
        <line x1="15" y1="3" x2="16.5" y2="4" stroke="rgba(255,255,255,0.20)" strokeWidth="0.3" strokeLinecap="round"/>
        {/* Scattered gold dust / felt sparkle */}
        <circle cx="4" cy="18" r="0.3" fill="rgba(201,168,76,0.35)"/>
        <circle cx="19" cy="6" r="0.25" fill="rgba(201,168,76,0.30)"/>
        <circle cx="17" cy="20" r="0.2" fill="rgba(201,168,76,0.25)"/>
        <circle cx="5" cy="5" r="0.2" fill="rgba(201,168,76,0.20)"/>
        {/* Oil paint specular */}
        <circle cx="12" cy="12" r="11" fill="url(#g_hi)"/>
        <ellipse cx="7.5" cy="5.5" rx="4.5" ry="3" fill="rgba(255,255,255,0.14)" transform="rotate(-28 7.5 5.5)"/>
        <ellipse cx="7" cy="4.8" rx="2" ry="0.9" fill="rgba(255,255,255,0.32)" transform="rotate(-28 7 4.8)"/>
        {/* Emerald rim */}
        <circle cx="12" cy="12" r="11.3" fill="none" stroke="rgba(34,197,94,0.18)" strokeWidth="0.4"/>
      </>
    ),
  },
  {
    id: 'whatsapp',
    hebrewLabel: 'הודעות',
    labelColor: '#4ade80',
    rgb: '74,222,128',
    rgbDark: '21,128,61',
    gradId: 'waG',
    gradStart: '#4ade80',
    gradEnd: '#15803d',
    svgContent: (
      <>
        <defs>
          <radialGradient id="wa_bg" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#4ade80"/>
            <stop offset="45%" stopColor="#16a34a"/>
            <stop offset="100%" stopColor="#052e16"/>
          </radialGradient>
          <radialGradient id="wa_hi" cx="32%" cy="26%" r="42%">
            <stop offset="0%" stopColor="rgba(240,255,248,0.65)"/>
            <stop offset="100%" stopColor="rgba(240,255,248,0)"/>
          </radialGradient>
        </defs>
        {/* Green circle base */}
        <circle cx="12" cy="12" r="11" fill="url(#wa_bg)"/>
        {/* WhatsApp speech bubble path */}
        <path d="M12 3.5C7.31 3.5 3.5 7.31 3.5 12c0 1.52.41 2.94 1.12 4.17L3.5 20.5l4.43-1.16A8.46 8.46 0 0 0 12 20.5c4.69 0 8.5-3.81 8.5-8.5S16.69 3.5 12 3.5z"
          fill="white" opacity="0.92"/>
        {/* Inner bubble fill */}
        <path d="M12 5C8.14 5 5 8.14 5 12c0 1.32.36 2.56.99 3.62L4.5 19.5l3.97-1.04A7 7 0 0 0 12 19c3.86 0 7-3.14 7-7s-3.14-7-7-7z"
          fill="url(#wa_bg)"/>
        {/* 3 chat dots */}
        <circle cx="9"  cy="12" r="1.1" fill="white" opacity="0.90"/>
        <circle cx="12" cy="12" r="1.1" fill="white" opacity="0.90"/>
        <circle cx="15" cy="12" r="1.1" fill="white" opacity="0.90"/>
        {/* Specular highlight */}
        <circle cx="12" cy="12" r="11" fill="url(#wa_hi)"/>
        <ellipse cx="7.5" cy="5.5" rx="4" ry="2.5" fill="rgba(255,255,255,0.18)" transform="rotate(-28 7.5 5.5)"/>
        {/* Rim */}
        <circle cx="12" cy="12" r="11" fill="none" stroke="rgba(74,222,128,0.22)" strokeWidth="0.5"/>
      </>
    ),
  },
];

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r},${g},${b}`;
}

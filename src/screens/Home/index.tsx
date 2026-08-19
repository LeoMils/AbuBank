import { useState, useEffect, useMemo, useRef } from 'react';
import { useAppStore } from '../../state/store';
import { Screen } from '../../state/types';
import { getGreeting } from './data';
import { HUB_APPS, openLiveAbu, type HubApp, type HubAction } from './hub';
import { getRandomMartitaPhoto, handleMartitaImgError } from '../../services/martitaPhotos';
import { injectSharedKeyframes } from '../../design/animations';
import { AbuLogo, type AbuAppId } from '../../design/logos/AbuLogo';
import { t } from '../../design/theme';

/** Turn an rgba/hex-ish accent into an "r,g,b" triple for glow shadows. */
function accentRgb(hex: string): string {
  const h = hex.replace('#', '');
  return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`;
}

// Premium visual system (shared with the black-luxury entry): a warm graphite/
// black base and one restrained champagne accent, instead of the old blue nebula
// + multi-colour wordmark. Feature icons keep their own colour for recognition.
const WARM_BG = 'radial-gradient(125% 90% at 50% -8%, #17140f 0%, #100d0a 44%, #070605 100%)';
const CHAMPAGNE_TEXT = 'linear-gradient(135deg,#F7F0E1 0%,#ECDBB7 52%,#E1C793 100%)';

export function Home() {
  const [pressed, setPressed] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const setScreen = useAppStore(s => s.setScreen);
  const appVersion = useAppStore(s => s.appVersion);
  const greeting = useMemo(() => getGreeting(), []);
  const martitaPhoto = useMemo(() => getRandomMartitaPhoto(), []);

  // Dispatch a hub tile: Abu AI opens the LIVE path (the cutover — never the legacy
  // screen); every other app is a normal screen switch. Kept in one place so the
  // routing matches hub.ts exactly (locked by hub.test.ts).
  const runAction = (a: HubAction) => { if (a.kind === 'live') openLiveAbu(); else setScreen(a.screen); };

  // 5-tap the wordmark → Admin (unchanged operator gesture).
  const tapTimestamps = useRef<number[]>([]);
  function handleWordmarkTap() {
    const now = Date.now();
    tapTimestamps.current = [...tapTimestamps.current, now].filter(t => now - t < 2000);
    if (tapTimestamps.current.length >= 5) { tapTimestamps.current = []; setScreen(Screen.Admin); }
  }

  useEffect(() => {
    injectSharedKeyframes();
    const t = setTimeout(() => setLoaded(true), 60);
    const onVisibility = () => { /* keep for parity with app-wide nav resets */ void document.hidden; };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { clearTimeout(t); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);

  const aiApp = HUB_APPS[0]!;          // Abu AI — the flagship, a wide hero tile
  const gridApps = HUB_APPS.slice(1);  // Bank, יומן, WhatsApp, Games, מזג אוויר, News

  return (
    <div dir="rtl" style={{
      height: '100%', width: '100%', overflow: 'hidden',
      background: WARM_BG,
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Heebo','DM Sans',sans-serif", userSelect: 'none', WebkitUserSelect: 'none',
    }}>
      {/* ─── HERO HEADER — the Abu-ela brand identity (kept) ─── */}
      <header style={{ display: 'flex', alignItems: 'center', direction: 'ltr', flexShrink: 0, padding: '14px 8px 8px', gap: 8, position: 'relative' }}>
        <div aria-hidden="true" style={{ position: 'absolute', top: '30%', left: '55%', transform: 'translate(-50%,-50%)', width: '90%', height: '200%', background: 'radial-gradient(ellipse at center, rgba(212,184,122,0.05) 0%, transparent 62%)', pointerEvents: 'none' }} />

        {/* Martita portrait → family gallery */}
        <div
          role="button" aria-label="אלבום תמונות משפחתי"
          onClick={() => setScreen(Screen.FamilyGallery)}
          style={{
            width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', position: 'relative', flexShrink: 0, marginLeft: 30,
            border: '2.5px solid rgba(201,168,76,0.60)',
            boxShadow: '0 0 0 3px rgba(201,168,76,0.07), 0 0 24px rgba(201,168,76,0.20), 0 4px 14px rgba(0,0,0,0.45)',
            background: 'linear-gradient(145deg,#0c2228,#050A18)', cursor: 'pointer',
          }}
        >
          <img src={martitaPhoto} alt="Martita" loading="eager" decoding="async" fetchPriority="high"
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%', display: 'block' }}
            onError={handleMartitaImgError} />
        </div>

        {/* Wordmark + greeting */}
        <div onClick={handleWordmarkTap} role="presentation" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'default' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', direction: 'ltr', gap: 3, position: 'relative' }}>
            <span style={{
              fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 44, fontWeight: 600, letterSpacing: '2.5px',
              background: CHAMPAGNE_TEXT,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              filter: 'drop-shadow(0 0 12px rgba(226,205,159,0.22)) drop-shadow(0 2px 3px rgba(0,0,0,0.65))',
            } as React.CSSProperties}>Abu</span>
            <span aria-hidden="true" style={{ alignSelf: 'center', transform: 'translateY(-4px)', width: 22, height: 1.5, borderRadius: 1, marginInline: 6, background: 'linear-gradient(90deg, rgba(226,205,159,0) 0%, rgba(226,205,159,0.85) 50%, rgba(226,205,159,0) 100%)', display: 'inline-block', flexShrink: 0 }} />
            <span style={{
              fontFamily: "'Cormorant Garamond',Georgia,serif", fontStyle: 'italic', fontSize: 45, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'lowercase', paddingRight: 3,
              background: CHAMPAGNE_TEXT,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              filter: 'drop-shadow(0 0 12px rgba(226,205,159,0.22)) drop-shadow(0 2px 3px rgba(0,0,0,0.60))',
            } as React.CSSProperties}>ela</span>
          </div>
          <div aria-hidden="true" style={{ width: '72%', height: 1, background: 'linear-gradient(90deg, transparent 0%, rgba(212,184,122,0.45) 50%, transparent 100%)', marginTop: 4, borderRadius: 1 }} />
          <div style={{ direction: 'rtl', textAlign: 'center', maxWidth: '100%', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 21, fontWeight: 700, whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: 22 }}>{greeting.emoji}</span>
            <span style={{ color: 'rgba(245,240,232,0.90)' }}>{greeting.text},</span>
            <span style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontWeight: 700, fontStyle: 'italic', fontSize: 24, letterSpacing: '1.5px', background: CHAMPAGNE_TEXT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' } as React.CSSProperties}>Martita</span>
          </div>
        </div>

        {/* Settings (three dots) */}
        <button type="button" onClick={() => setScreen(Screen.Settings)} aria-label="הגדרות"
          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="rgba(255,255,255,0.65)" aria-hidden="true">
            <circle cx="12" cy="5" r="2.2" /><circle cx="12" cy="12" r="2.2" /><circle cx="12" cy="19" r="2.2" />
          </svg>
        </button>
      </header>

      {/* QA build marker — DEV-ONLY. Martita must never see a "QA: v…" badge on her home
          screen in a production build; the running build stays confirmable in production via
          Settings → About and the operator diagnostic panel. Gated on import.meta.env.DEV so it
          is present in the source (asserted by version.test.ts / version.visibility.test.ts) but
          renders only in development. */}
      {import.meta.env.DEV && (
        <div data-testid="home-qa-version" style={{ position: 'absolute', top: 6, left: 10, zIndex: 5, fontSize: 12, fontWeight: 700, letterSpacing: '0.6px', color: 'rgba(201,168,76,0.65)', fontFamily: "'DM Sans',monospace", pointerEvents: 'none', background: 'rgba(201,168,76,0.08)', padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(201,168,76,0.18)' }}>QA: v{appVersion}</div>
      )}

      {/* ─── THE HUB — the Abu family of apps, and nothing else ─── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, padding: '6px 16px calc(14px + env(safe-area-inset-bottom,0px))', overflow: 'hidden' }}>
        {/* Abu AI — wide hero tile → the LIVE path */}
        <HubTile app={aiApp} hero pressed={pressed} setPressed={setPressed} loaded={loaded} index={0} onOpen={runAction} />

        {/* The other six, 2×3, no scroll */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gridTemplateRows: 'repeat(3,1fr)', gap: 12 }}>
          {gridApps.map((app, i) => (
            <HubTile key={app.id} app={app} pressed={pressed} setPressed={setPressed} loaded={loaded} index={i + 1} onOpen={runAction} />
          ))}
        </div>
      </main>
    </div>
  );
}

function HubTile({ app, hero = false, pressed, setPressed, loaded, index, onOpen }: {
  app: HubApp; hero?: boolean; pressed: string | null;
  setPressed: (id: string | null) => void; loaded: boolean; index: number;
  onOpen: (a: HubAction) => void;
}) {
  const rgb = accentRgb(app.accent);
  const isPressed = pressed === app.id;
  return (
    <button
      type="button"
      aria-label={`פתח ${app.hebrewLabel}`}
      onClick={() => onOpen(app.action)}
      onPointerDown={() => setPressed(app.id)}
      onPointerUp={() => setPressed(null)}
      onPointerLeave={() => setPressed(null)}
      style={{
        display: 'flex', flexDirection: hero ? 'row' : 'column', alignItems: 'center',
        justifyContent: 'center', gap: hero ? 16 : 10,
        minHeight: hero ? 92 : 56, width: '100%', height: '100%',
        padding: hero ? '0 24px' : '10px', borderRadius: 22, cursor: 'pointer',
        // Calm, unified graphite glass + a restrained champagne hairline. The
        // per-app accent colour survives ONLY in the icon (recognition) and as a
        // whisper of glow on press — no six-colour competition at rest.
        background: hero
          ? 'linear-gradient(150deg, rgba(226,205,159,0.06) 0%, rgba(255,255,255,0.022) 62%)'
          : 'linear-gradient(150deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.018) 62%)',
        border: `1px solid rgba(216,196,150,${isPressed ? 0.5 : hero ? 0.24 : 0.14})`,
        boxShadow: isPressed
          ? `0 0 0 1px rgba(${rgb},0.32) inset, 0 0 18px rgba(${rgb},0.14)`
          : `0 10px 30px rgba(0,0,0,0.5)`,
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        transform: isPressed ? 'scale(0.97)' : (loaded ? 'scale(1)' : 'scale(0.9)'),
        opacity: loaded ? 1 : 0,
        transition: `opacity 0.35s ease ${0.04 * index}s, transform 0.2s ease`,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* the per-app Abu logo mark (one family) */}
      <AbuLogo app={app.id as AbuAppId} size={hero ? 62 : 54} style={{ flexShrink: 0 }} />
      <span style={{
        fontSize: hero ? 26 : 18, fontWeight: 800, color: t.textStrong,
        fontFamily: "'Heebo',sans-serif", letterSpacing: '0.2px', textAlign: 'center',
        lineHeight: 1.2,
      }}>{app.hebrewLabel}</span>
    </button>
  );
}

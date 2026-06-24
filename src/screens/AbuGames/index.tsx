import { useEffect, useMemo, useState } from 'react'
import { BackButton } from '../../components/BackButton'
import { getRandomMartitaPhoto, handleMartitaImgError } from '../../services/martitaPhotos'
import { soundTap } from '../../services/sounds'

// ═══════════════════════════════════════════════════════════════════════════════
// ABU GAMES — redesigned from zero (v31)
// Design language: calm spatial depth — VisionOS ambient light + Apple Arcade
// cover tiles + Switch library clarity + Duolingo legibility. Premium and quiet,
// never flashy. Built for Martita (80+): big covers, high contrast, calm motion.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Palette ──────────────────────────────────────────────────────────────────
const INK = '#F3EFE7'          // warm off-white text
const INK_SOFT = 'rgba(243,239,231,0.62)'
const INK_FAINT = 'rgba(243,239,231,0.34)'
const GOLD = '#D8B670'
const TEAL = '#2DD4BF'

// ─── Games ────────────────────────────────────────────────────────────────────
interface Game {
  id: string
  label: string        // Latin / source name
  labelHe: string      // Hebrew name (primary)
  url: string
  accent: string       // single calm accent for ring + cover wash
  gradient: string     // cover gradient
  category: 'featured' | 'solitaire' | 'mahjong'
  emoji: string
  mood: string         // one-line Hebrew descriptor
  desc?: string        // featured only
}

const GAMES: Game[] = [
  { id: 'wow', label: 'Words of Wonders', labelHe: 'אבו וואו', url: 'https://www.crazygames.com/game/words-of-wonders', accent: '#F2B45A', gradient: 'linear-gradient(150deg, #C9762E 0%, #E59A4A 50%, #F2C078 100%)', category: 'featured', emoji: '🔤', mood: 'חידת המילים שלך', desc: 'בונים מילים, מתקדמים בשלבים — נעים ומרגיע.' },

  { id: 'klondike', label: 'Clásico', labelHe: 'סוליטר קלאסי', accent: '#34D399', gradient: 'linear-gradient(150deg, #0E6B53 0%, #2BAE84 100%)', category: 'solitaire', emoji: '🃏', url: 'https://www.arkadium.com/games/klondike-solitaire/', mood: 'הקלאסיקה' },
  { id: 'spider', label: 'Spider', labelHe: 'עכביש', accent: '#A78BFA', gradient: 'linear-gradient(150deg, #4C3A8C 0%, #8B72E0 100%)', category: 'solitaire', emoji: '🕷️', url: 'https://www.arkadium.com/games/spider-solitaire/', mood: 'אסטרטגיה' },
  { id: 'freecell', label: 'FreeCell', labelHe: 'פריסל', accent: '#60A5FA', gradient: 'linear-gradient(150deg, #234E8C 0%, #4C8FE0 100%)', category: 'solitaire', emoji: '💎', url: 'https://www.arkadium.com/games/freecell/', mood: 'כל משחק פתיר' },
  { id: 'pyramid', label: 'Pirámide', labelHe: 'פירמידה', accent: '#FBBF24', gradient: 'linear-gradient(150deg, #9A6512 0%, #E0A52E 100%)', category: 'solitaire', emoji: '🔺', url: 'https://games.aarp.org/games/pyramid-solitaire', mood: 'חשבון מהנה' },
  { id: 'tripeaks', label: 'Tri Peaks', labelHe: 'שלוש פסגות', accent: '#2DD4BF', gradient: 'linear-gradient(150deg, #0C6B61 0%, #25B3A3 100%)', category: 'solitaire', emoji: '⛰️', url: 'https://www.arkadium.com/games/tripeaks-solitaire-free/', mood: 'מהיר ומשמח' },
  { id: 'hearts', label: 'Corazones', labelHe: 'לבבות', accent: '#FB7185', gradient: 'linear-gradient(150deg, #9A2942 0%, #E0596E 100%)', category: 'solitaire', emoji: '❤️', url: 'https://cardgames.io/hearts/', mood: 'משחק חברתי' },
  { id: 'canfield', label: 'Canfield', labelHe: 'קאנפילד', accent: '#22D3EE', gradient: 'linear-gradient(150deg, #0C5F73 0%, #1FAecb 100%)', category: 'solitaire', emoji: '🎴', url: 'https://solitaired.com/canfield', mood: 'אתגר גבוה' },
  { id: 'golf', label: 'Golf', labelHe: 'גולף', accent: '#4ADE80', gradient: 'linear-gradient(150deg, #166534 0%, #34B45F 100%)', category: 'solitaire', emoji: '⛳', url: 'https://www.solitaire-play.com/golf/', mood: 'פשוט ומרגיע' },
  { id: 'yukon', label: 'Yukon', labelHe: 'יוקון', accent: '#38BDF8', gradient: 'linear-gradient(150deg, #1E5E8C 0%, #2F9DD8 100%)', category: 'solitaire', emoji: '🌊', url: 'https://solitaired.com/yukon', mood: 'טוויסט מפתיע' },
  { id: 'spider2', label: 'Spider ×2', labelHe: 'עכביש ×2', accent: '#FB923C', gradient: 'linear-gradient(150deg, #9A4413 0%, #E0742E 100%)', category: 'solitaire', emoji: '🕸️', url: 'https://www.arkadium.com/games/spider-solitaire-2-suits/', mood: 'למנוסות' },
  { id: 'forty', label: '40 Ladrones', labelHe: '40 ליסטים', accent: '#C084FC', gradient: 'linear-gradient(150deg, #5B2E8C 0%, #9D5FE0 100%)', category: 'solitaire', emoji: '⚔️', url: 'https://solitaired.com/forty-thieves', mood: 'לאמיצות' },

  { id: 'mahjong', label: 'Clásico', labelHe: "מהג'ונג קלאסי", accent: '#F87171', gradient: 'linear-gradient(150deg, #8C2424 0%, #D85151 100%)', category: 'mahjong', emoji: '🀄', url: 'https://www.arkadium.com/games/mahjongg-solitaire/', mood: 'שלווה קלאסית' },
  { id: 'mahjong-connect', label: 'Connect', labelHe: 'חיבור', accent: '#FB923C', gradient: 'linear-gradient(150deg, #9A4413 0%, #E0742E 100%)', category: 'mahjong', emoji: '🔗', url: 'https://www.arkadium.com/games/mahjong-connect/', mood: 'מצאי זוגות' },
  { id: 'mahjong-3d', label: 'Dimensiones', labelHe: 'תלת-מימד', accent: '#A78BFA', gradient: 'linear-gradient(150deg, #4C3A8C 0%, #8B72E0 100%)', category: 'mahjong', emoji: '🧊', url: 'https://www.arkadium.com/games/mahjongg-dimensions/', mood: 'אריחים מסתובבים' },
  { id: 'mahjong-candy', label: 'Candy', labelHe: 'ממתקים', accent: '#F472B6', gradient: 'linear-gradient(150deg, #8C2F66 0%, #D858A0 100%)', category: 'mahjong', emoji: '🍬', url: 'https://www.arkadium.com/games/mahjongg-candy/', mood: 'צבעוני ומתוק' },
  { id: 'mahjong-dark', label: 'Dark', labelHe: "מהג'ונג לילה", accent: '#818CF8', gradient: 'linear-gradient(150deg, #2E348C 0%, #5F69E0 100%)', category: 'mahjong', emoji: '🌙', url: 'https://www.mahjong.com/games/dark-mahjong/', mood: 'שקט מסתורי' },
  { id: 'mahjong-garden', label: 'Garden', labelHe: 'גן פורח', accent: '#4ADE80', gradient: 'linear-gradient(150deg, #166534 0%, #34B45F 100%)', category: 'mahjong', emoji: '🌸', url: 'https://www.arkadium.com/games/garden-tales/', mood: 'טבע ושלווה' },
]

// ─── Navigation (same-tab, guarded) ───────────────────────────────────────────
let isNavigating = false
let navTimer: ReturnType<typeof setTimeout> | null = null
function handleTap(url: string): void {
  if (isNavigating) return
  isNavigating = true
  if (navTimer) clearTimeout(navTimer)
  navTimer = setTimeout(() => { isNavigating = false }, 800)
  soundTap()
  window.location.href = url
}

function getTimeGreeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'לילה טוב'
  if (h < 12) return 'בוקר טוב'
  if (h < 17) return 'צהריים טובים'
  if (h < 21) return 'ערב טוב'
  return 'לילה טוב'
}

// ─── Motion / surface CSS (calm, spatial) ─────────────────────────────────────
const CSS = `
  @keyframes ag-rise { from { opacity:0; transform:translateY(18px) } to { opacity:1; transform:translateY(0) } }
  @keyframes ag-aurora { 0%,100% { transform:translate(0,0) scale(1); opacity:.55 } 50% { transform:translate(3%, 4%) scale(1.12); opacity:.8 } }
  @keyframes ag-sheen { 0% { transform:translateX(-160%) } 100% { transform:translateX(260%) } }

  .ag-tile, .ag-hero {
    transition: transform .26s cubic-bezier(.2,.7,.2,1), box-shadow .26s ease, border-color .26s ease;
    will-change: transform;
  }
  .ag-tile:hover { transform:translateY(-3px); border-color:var(--ring,rgba(255,255,255,.18)) !important; }
  .ag-tile:active { transform:scale(.97); }
  .ag-hero:hover { transform:translateY(-2px); }
  .ag-hero:active { transform:scale(.985); }

  .ag-tile:focus-visible, .ag-hero:focus-visible {
    outline:none; box-shadow:0 0 0 3px rgba(45,212,191,.55), 0 14px 36px rgba(0,0,0,.4) !important;
  }
  .ag-scroll::-webkit-scrollbar { width:0; height:0; }
  .ag-scroll { scrollbar-width:none; }

  @media (prefers-reduced-motion: reduce) {
    [data-ag] { animation:none !important; }
    .ag-tile, .ag-hero { transition:none !important; }
    .ag-sheen { display:none !important; }
  }
`

// ─── Game cover tile (library card) ───────────────────────────────────────────
function GameTile({ g, index }: { g: Game; index: number }) {
  return (
    <div
      role="button" tabIndex={0} aria-label={g.labelHe}
      onClick={() => handleTap(g.url)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTap(g.url) } }}
      className="ag-tile"
      data-ag
      style={{
        '--ring': `${g.accent}66`,
        display: 'flex', flexDirection: 'column',
        borderRadius: 24, overflow: 'hidden', cursor: 'pointer',
        background: 'rgba(255,255,255,0.045)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 10px 26px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.07)',
        WebkitTapHighlightColor: 'transparent',
        animation: `ag-rise .5s ${(0.12 + index * 0.035).toFixed(2)}s cubic-bezier(.2,.7,.2,1) both`,
        opacity: 0,
      } as React.CSSProperties}
    >
      {/* Cover — the game's identity, like an Arcade cover */}
      <div style={{
        position: 'relative', height: 96,
        background: g.gradient,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: 'inset 0 -18px 30px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.18)',
      }}>
        {/* soft spatial light from top */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,0.22), transparent 60%)',
        }} />
        <span style={{ fontSize: 42, lineHeight: 1, filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.28))' }}>{g.emoji}</span>
      </div>

      {/* Info row */}
      <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: INK, lineHeight: 1.2 }}>{g.labelHe}</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: INK_SOFT, lineHeight: 1.25 }}>{g.mood}</span>
      </div>
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ title, count, accent, delay }: { title: string; count: number; accent: string; delay: number }) {
  return (
    <div data-ag style={{
      display: 'flex', alignItems: 'baseline', gap: 10, padding: '0 20px 2px',
      animation: `ag-rise .5s ${delay}s cubic-bezier(.2,.7,.2,1) both`, opacity: 0,
    } as React.CSSProperties}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: accent, boxShadow: `0 0 12px ${accent}` }} />
      <h2 style={{ fontSize: 20, fontWeight: 800, color: INK, margin: 0, lineHeight: 1 }}>{title}</h2>
      <span style={{ fontSize: 14, fontWeight: 500, color: INK_FAINT }}>{count} משחקים</span>
    </div>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export function AbuGames() {
  const martitaPhoto = useMemo(() => getRandomMartitaPhoto(), [])
  const featured = GAMES.find(g => g.category === 'featured')!
  const solitaire = GAMES.filter(g => g.category === 'solitaire')
  const mahjong = GAMES.filter(g => g.category === 'mahjong')

  useEffect(() => {
    const onVis = () => { if (!document.hidden) isNavigating = false }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const grid: React.CSSProperties = {
    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, padding: '12px 16px 4px',
  }

  return (
    <>
      <style>{CSS}</style>

      <div className="ag-scroll" dir="rtl" style={{
        minHeight: '100dvh', overflowY: 'auto', overflowX: 'hidden',
        fontFamily: "'Heebo','DM Sans',sans-serif",
        // Deep spatial background — light pooled from above, settling to near-black
        background: 'radial-gradient(125% 80% at 50% -8%, #16223f 0%, #0a1430 34%, #060b1c 70%, #04060f 100%)',
        position: 'relative',
      }}>
        {/* Ambient aurora glows — subtle depth, slow drift */}
        <div aria-hidden data-ag style={{
          position: 'fixed', top: '-8%', right: '-12%', width: 320, height: 320, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(45,212,191,0.16), transparent 65%)',
          filter: 'blur(40px)', animation: 'ag-aurora 16s ease-in-out infinite', pointerEvents: 'none', zIndex: 0,
        }} />
        <div aria-hidden data-ag style={{
          position: 'fixed', bottom: '4%', left: '-14%', width: 340, height: 340, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(216,182,112,0.12), transparent 65%)',
          filter: 'blur(48px)', animation: 'ag-aurora 22s 3s ease-in-out infinite', pointerEvents: 'none', zIndex: 0,
        }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', paddingBottom: 40 }}>

          {/* ── Top bar ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 0' }}>
            <BackButton />
            <div style={{ width: 40 }} />
          </div>

          {/* ── Title row: greeting + portrait ── */}
          <header data-ag style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 14, padding: '14px 20px 18px',
            animation: 'ag-rise .55s .05s cubic-bezier(.2,.7,.2,1) both', opacity: 0,
          } as React.CSSProperties}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: GOLD, letterSpacing: '.01em' }}>
                {getTimeGreeting()}, Martita
              </div>
              <h1 style={{
                fontSize: 32, fontWeight: 800, color: INK, margin: '6px 0 0', lineHeight: 1.05,
              }}>
                המשחקים שלך
              </h1>
              <div style={{ fontSize: 14, fontWeight: 500, color: INK_SOFT, marginTop: 6 }}>
                בחרי משחק ושבי בנחת ✨
              </div>
            </div>

            {/* Calm portrait — single soft ring, no clutter */}
            <div style={{
              width: 66, height: 66, borderRadius: '50%', flexShrink: 0,
              padding: 2, background: `conic-gradient(from 210deg, ${TEAL}, ${GOLD}, ${TEAL})`,
              boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
            }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(6,11,28,0.9)' }}>
                <img
                  src={martitaPhoto} alt="Martita" loading="eager"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 18%', display: 'block' }}
                  onError={handleMartitaImgError}
                />
              </div>
            </div>
          </header>

          {/* ── Featured hero (WOW) ── */}
          <div
            role="button" tabIndex={0}
            aria-label={`${featured.labelHe} — מומלץ`}
            onClick={() => handleTap(featured.url)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTap(featured.url) } }}
            className="ag-hero" data-ag
            style={{
              margin: '0 16px 8px', borderRadius: 30, overflow: 'hidden', cursor: 'pointer',
              position: 'relative', WebkitTapHighlightColor: 'transparent',
              background: 'rgba(255,255,255,0.045)',
              border: `1px solid ${featured.accent}3a`,
              boxShadow: '0 18px 44px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
              animation: 'ag-rise .6s .12s cubic-bezier(.2,.7,.2,1) both', opacity: 0,
            } as React.CSSProperties}
          >
            {/* Cover */}
            <div style={{
              position: 'relative', height: 150, background: featured.gradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              boxShadow: 'inset 0 -26px 44px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}>
              <div aria-hidden style={{
                position: 'absolute', inset: 0,
                background: 'radial-gradient(120% 90% at 50% 0%, rgba(255,255,255,0.25), transparent 58%)',
              }} />
              {/* slow specular sheen */}
              <div aria-hidden className="ag-sheen" style={{
                position: 'absolute', top: 0, bottom: 0, width: '34%',
                background: 'linear-gradient(100deg, transparent, rgba(255,255,255,0.28), transparent)',
                animation: 'ag-sheen 6s 1.4s ease-in-out infinite', pointerEvents: 'none',
              }} />
              {/* recommended pill */}
              <div style={{
                position: 'absolute', top: 14, insetInlineStart: 14,
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 13px', borderRadius: 20,
                background: 'rgba(6,11,28,0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.22)',
                fontSize: 13, fontWeight: 700, color: INK,
              }}>★ מומלץ בשבילך</div>
              <span style={{ fontSize: 64, lineHeight: 1, filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.3))' }}>{featured.emoji}</span>
            </div>

            {/* Body */}
            <div style={{ padding: '16px 18px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: INK, lineHeight: 1.1 }}>{featured.labelHe}</div>
                {featured.desc && (
                  <div style={{ fontSize: 14, fontWeight: 500, color: INK_SOFT, marginTop: 5, lineHeight: 1.45 }}>{featured.desc}</div>
                )}
              </div>
              <div style={{
                flexShrink: 0, padding: '13px 22px', borderRadius: 16,
                background: `linear-gradient(135deg, ${featured.accent}, ${GOLD})`,
                color: '#2A1A06', fontSize: 17, fontWeight: 800,
                boxShadow: `0 8px 22px ${featured.accent}44, inset 0 1px 0 rgba(255,255,255,0.3)`,
                whiteSpace: 'nowrap',
              }}>להתחיל ›</div>
            </div>
          </div>

          {/* ── Solitaire library ── */}
          <section style={{ marginTop: 18 }}>
            <SectionHeader title="סוליטר" count={solitaire.length} accent={TEAL} delay={0.2} />
            <div style={grid}>
              {solitaire.map((g, i) => <GameTile key={g.id} g={g} index={i} />)}
            </div>
          </section>

          {/* ── Mahjong library ── */}
          <section style={{ marginTop: 22 }}>
            <SectionHeader title="מהג'ונג" count={mahjong.length} accent={GOLD} delay={0.28} />
            <div style={grid}>
              {mahjong.map((g, i) => <GameTile key={g.id} g={g} index={i} />)}
            </div>
          </section>

          {/* ── Footer hint ── */}
          <footer data-ag style={{
            textAlign: 'center', padding: '26px 24px 0',
            animation: 'ag-rise .5s .4s cubic-bezier(.2,.7,.2,1) both', opacity: 0,
          } as React.CSSProperties}>
            <div style={{ fontSize: 13, fontWeight: 500, color: INK_FAINT, lineHeight: 1.6 }}>
              כל משחק נפתח בדפדפן. לחצי על החץ למעלה כדי לחזור.
            </div>
          </footer>
        </div>
      </div>
    </>
  )
}

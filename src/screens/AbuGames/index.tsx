import { useEffect, useMemo, useState } from 'react'
import { BackButton } from '../../components/BackButton'
import { getRandomMartitaPhoto, handleMartitaImgError } from '../../services/martitaPhotos'
import { soundTap } from '../../services/sounds'

// ═══════════════════════════════════════════════════════════════════════════════
// ABU GAMES — bubble redesign (v32)
// Matches the Abu Bank home screen: each game is a glossy 3D "water-drop" orb,
// the exact volumetric-sphere recipe used on Home, made even more polished.
// Premium English wordmark on top, warm time greeting, WOW as the favorite,
// then every game as a round bubble in a vertical-scroll grid. No cards.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Brand palette (Abu Bank identity) ───────────────────────────────────────
const GOLD = '#C9A84C'
const TEAL = '#14b8a6'
const INK = 'rgba(255,255,255,0.95)'
const INK_SOFT = 'rgba(255,255,255,0.62)'

// ─── Games ────────────────────────────────────────────────────────────────────
interface Game {
  id: string
  label: string        // Latin / source name (for a11y context)
  labelHe: string      // Hebrew name shown under the bubble
  url: string
  accent: string       // single brand color → drives the volumetric sphere
  category: 'featured' | 'solitaire' | 'mahjong'
  emoji: string
}

const GAMES: Game[] = [
  { id: 'wow', label: 'Words of Wonders', labelHe: 'אבו וואו', url: 'https://www.crazygames.com/game/words-of-wonders', accent: '#F2A93B', category: 'featured', emoji: '🔤' },

  { id: 'klondike', label: 'Clásico', labelHe: 'סוליטר קלאסי', accent: '#34D399', category: 'solitaire', emoji: '🃏', url: 'https://www.arkadium.com/games/klondike-solitaire/' },
  { id: 'spider', label: 'Spider', labelHe: 'עכביש', accent: '#A78BFA', category: 'solitaire', emoji: '🕷️', url: 'https://www.arkadium.com/games/spider-solitaire/' },
  { id: 'freecell', label: 'FreeCell', labelHe: 'פריסל', accent: '#60A5FA', category: 'solitaire', emoji: '💎', url: 'https://www.arkadium.com/games/freecell/' },
  { id: 'pyramid', label: 'Pirámide', labelHe: 'פירמידה', accent: '#FBBF24', category: 'solitaire', emoji: '🔺', url: 'https://games.aarp.org/games/pyramid-solitaire' },
  { id: 'tripeaks', label: 'Tri Peaks', labelHe: 'שלוש פסגות', accent: '#2DD4BF', category: 'solitaire', emoji: '⛰️', url: 'https://www.arkadium.com/games/tripeaks-solitaire-free/' },
  { id: 'hearts', label: 'Corazones', labelHe: 'לבבות', accent: '#FB7185', category: 'solitaire', emoji: '❤️', url: 'https://cardgames.io/hearts/' },
  { id: 'canfield', label: 'Canfield', labelHe: 'קאנפילד', accent: '#22D3EE', category: 'solitaire', emoji: '🎴', url: 'https://solitaired.com/canfield' },
  { id: 'golf', label: 'Golf', labelHe: 'גולף', accent: '#4ADE80', category: 'solitaire', emoji: '⛳', url: 'https://www.solitaire-play.com/golf/' },
  { id: 'yukon', label: 'Yukon', labelHe: 'יוקון', accent: '#38BDF8', category: 'solitaire', emoji: '🌊', url: 'https://solitaired.com/yukon' },
  { id: 'spider2', label: 'Spider ×2', labelHe: 'עכביש ×2', accent: '#FB923C', category: 'solitaire', emoji: '🕸️', url: 'https://www.arkadium.com/games/spider-solitaire-2-suits/' },
  { id: 'forty', label: '40 Ladrones', labelHe: '40 ליסטים', accent: '#C084FC', category: 'solitaire', emoji: '⚔️', url: 'https://solitaired.com/forty-thieves' },

  { id: 'mahjong', label: 'Clásico', labelHe: "מהג'ונג קלאסי", accent: '#F87171', category: 'mahjong', emoji: '🀄', url: 'https://www.arkadium.com/games/mahjongg-solitaire/' },
  { id: 'mahjong-connect', label: 'Connect', labelHe: 'חיבור', accent: '#FB923C', category: 'mahjong', emoji: '🔗', url: 'https://www.arkadium.com/games/mahjong-connect/' },
  { id: 'mahjong-3d', label: 'Dimensiones', labelHe: 'תלת-מימד', accent: '#A78BFA', category: 'mahjong', emoji: '🧊', url: 'https://www.arkadium.com/games/mahjongg-dimensions/' },
  { id: 'mahjong-candy', label: 'Candy', labelHe: 'ממתקים', accent: '#F472B6', category: 'mahjong', emoji: '🍬', url: 'https://www.arkadium.com/games/mahjongg-candy/' },
  { id: 'mahjong-dark', label: 'Dark', labelHe: "מהג'ונג לילה", accent: '#818CF8', category: 'mahjong', emoji: '🌙', url: 'https://www.mahjong.com/games/dark-mahjong/' },
  { id: 'mahjong-garden', label: 'Garden', labelHe: 'גן פורח', accent: '#4ADE80', category: 'mahjong', emoji: '🌸', url: 'https://www.arkadium.com/games/garden-tales/' },
]

// ─── Navigation (same-tab, guarded) — identical logic to Home ─────────────────
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

// ─── Color helpers — build a volumetric sphere from a single accent ───────────
function hexToRgbArr(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function mix(hex: string, target: [number, number, number], t: number): string {
  const [r, g, b] = hexToRgbArr(hex)
  const r2 = Math.round(r + (target[0] - r) * t)
  const g2 = Math.round(g + (target[1] - g) * t)
  const b2 = Math.round(b + (target[2] - b) * t)
  return `rgb(${r2},${g2},${b2})`
}
const WHITE: [number, number, number] = [255, 255, 255]
const BLACK: [number, number, number] = [10, 8, 4]

// Same 4-stop volumetric recipe Home uses (light → accent → deep → near-black),
// generated per game from its accent so every orb has real spherical depth.
function sphereGradient(accent: string): string {
  const light = mix(accent, WHITE, 0.78)
  const deep = mix(accent, BLACK, 0.55)
  const darkest = mix(accent, BLACK, 0.86)
  return `radial-gradient(circle at 38% 32%, ${light} 0%, ${accent} 42%, ${deep} 72%, ${darkest} 100%)`
}

const CSS = `
  @keyframes ag-rise { from { opacity:0; transform:translateY(16px) scale(.9) } to { opacity:1; transform:translateY(0) scale(1) } }
  @keyframes ag-glow { 0%,100% { opacity:.5 } 50% { opacity:.8 } }
  @keyframes ag-shine { 0% { background-position:0% 50% } 100% { background-position:200% 50% } }
  .ag-scroll::-webkit-scrollbar { width:0; height:0 }
  .ag-scroll { scrollbar-width:none }
  @media (prefers-reduced-motion: reduce) {
    [data-ag] { animation:none !important }
    .ag-bubble { transition:none !important }
  }
`

// ─── Game bubble — the glossy water-drop orb (matches Home, more polished) ─────
function GameBubble({ g, size, index, caption }: { g: Game; size: number; index: number; caption?: string }) {
  const [pressed, setPressed] = useState(false)
  const rgb = hexToRgbArr(g.accent).join(',')
  const emojiSize = Math.round(size * 0.42)

  return (
    <div
      role="button" tabIndex={0} aria-label={g.labelHe}
      onClick={() => handleTap(g.url)}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTap(g.url) } }}
      data-ag
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
        animation: `ag-rise .5s ${(0.06 + index * 0.03).toFixed(2)}s cubic-bezier(.22,1,.36,1) both`,
        opacity: 0,
      }}
    >
      {/* Volumetric sphere */}
      <div className="ag-bubble" style={{
        width: size, height: size, borderRadius: '50%',
        position: 'relative', overflow: 'hidden',
        background: sphereGradient(g.accent),
        boxShadow: pressed
          ? `0 0 18px rgba(201,168,76,0.35), 0 0 6px rgba(201,168,76,0.20), 0 2px 8px rgba(0,0,0,0.5)`
          : `0 0 24px rgba(${rgb},0.60), 0 0 9px rgba(${rgb},0.28), 0 22px 44px rgba(0,0,0,0.50), inset 0 2px 10px rgba(255,255,255,0.10)`,
        transform: pressed ? 'scale(0.93)' : 'scale(1)',
        transition: 'transform 0.15s ease-in-out, box-shadow 0.15s ease-in-out',
      }}>
        {/* Emoji — the game's identity, centered in the sphere */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: emojiSize, lineHeight: 1, filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.35))' }}>{g.emoji}</span>
        </div>
        {/* Primary specular — large soft highlight top-left */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0, borderRadius: '50%', zIndex: 2, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 28% 22%, rgba(255,255,255,0.90) 0%, rgba(255,255,255,0.30) 22%, transparent 55%)',
        }} />
        {/* Secondary caustic */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0, borderRadius: '50%', zIndex: 3, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 55% 12%, rgba(255,255,255,0.55) 0%, transparent 30%)',
        }} />
        {/* Tight sparkle — the "wet" point */}
        <div aria-hidden style={{
          position: 'absolute', top: '14%', left: '22%', width: '13%', height: '9%', zIndex: 4,
          background: 'radial-gradient(ellipse, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 80%)',
          borderRadius: '50%', pointerEvents: 'none',
        }} />
        {/* Deep bottom shadow — volume */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0, borderRadius: '50%', zIndex: 5, pointerEvents: 'none',
          boxShadow: 'inset 0 -14px 28px rgba(0,0,0,0.55), inset 0 6px 12px rgba(255,255,255,0.12)',
        }} />
        {/* Elegant rim */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0, borderRadius: '50%', zIndex: 6, pointerEvents: 'none',
          border: '1px solid rgba(255,255,255,0.18)',
        }} />
      </div>

      {/* Label */}
      <span style={{
        fontSize: 17, fontWeight: 700, color: INK, fontFamily: "'Heebo',sans-serif",
        textAlign: 'center', lineHeight: 1.25, direction: 'rtl', maxWidth: size + 28,
        textShadow: '0 1px 4px rgba(0,0,0,0.6)',
      }}>{g.labelHe}</span>
      {caption && (
        <span style={{ fontSize: 12, fontWeight: 600, color: GOLD, marginTop: -3, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>{caption}</span>
      )}
    </div>
  )
}

// ─── Subtle group label (visible, not a hidden section) ───────────────────────
function GroupLabel({ text, delay }: { text: string; delay: number }) {
  return (
    <div data-ag style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '0 22px',
      animation: `ag-rise .45s ${delay}s cubic-bezier(.22,1,.36,1) both`, opacity: 0,
    }}>
      <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12))' }} />
      <span style={{ fontSize: 14, fontWeight: 700, color: INK_SOFT, letterSpacing: '0.04em' }}>{text}</span>
      <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(255,255,255,0.12), transparent)' }} />
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
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '22px 6px', padding: '18px 14px 4px', justifyItems: 'center',
  }

  return (
    <>
      <style>{CSS}</style>

      <div className="ag-scroll" dir="rtl" style={{
        minHeight: '100dvh', overflowY: 'auto', overflowX: 'hidden',
        // Identical background to the Abu Bank home screen
        background: 'linear-gradient(180deg, #070D1E 0%, #050A18 40%, #050A18 100%)',
        fontFamily: "'DM Sans','Heebo',sans-serif",
        position: 'relative',
      }}>
        {/* Ambient brand glow — same gold/teal wash as Home */}
        <div aria-hidden data-ag style={{
          position: 'fixed', top: '-6%', left: '50%', transform: 'translateX(-50%)',
          width: '120%', height: 360,
          background: 'radial-gradient(ellipse at center, rgba(201,168,76,0.10) 0%, rgba(20,184,166,0.05) 38%, transparent 68%)',
          pointerEvents: 'none', zIndex: 0, animation: 'ag-glow 7s ease-in-out infinite',
        }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', paddingBottom: 44 }}>

          {/* Top bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 0' }}>
            <BackButton />
            <div style={{ width: 40 }} />
          </div>

          {/* ── Premium brand block ── */}
          <header style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 20px 6px' }}>
            {/* Abu Bank identity eyebrow */}
            <div data-ag style={{
              direction: 'ltr', fontSize: 12, fontWeight: 700, letterSpacing: '0.42em',
              color: TEAL, marginInlineStart: '0.42em', opacity: 0,
              animation: 'ag-rise .5s .02s cubic-bezier(.22,1,.36,1) both',
            }}>ABU BANK</div>

            {/* Large premium English wordmark */}
            <h1 data-ag style={{
              direction: 'ltr', margin: '6px 0 0', fontWeight: 800, fontSize: 46,
              letterSpacing: '-0.02em', lineHeight: 1.02,
              fontFamily: "'DM Sans',sans-serif",
              background: 'linear-gradient(135deg, #FBF1CE 0%, #E9CB76 20%, #C9A84C 44%, #9C7B2E 60%, #E9CB76 80%, #FBF1CE 100%)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 3px 16px rgba(201,168,76,0.28))',
              animation: 'ag-rise .55s .06s cubic-bezier(.22,1,.36,1) both, ag-shine 9s linear infinite',
              opacity: 0,
            }}>Abu Games</h1>

            {/* Time greeting — warm, elegant */}
            <div data-ag style={{
              display: 'flex', alignItems: 'center', gap: 12, marginTop: 14,
              animation: 'ag-rise .5s .12s cubic-bezier(.22,1,.36,1) both', opacity: 0,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                border: `2px solid ${GOLD}`, boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
              }}>
                <img src={martitaPhoto} alt="Martita" loading="eager"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 18%', display: 'block' }}
                  onError={handleMartitaImgError} />
              </div>
              <div style={{ fontSize: 19, fontWeight: 600, color: INK }}>
                {getTimeGreeting()} <span style={{ direction: 'ltr' }}>Martita</span> 💛
              </div>
            </div>
          </header>

          {/* ── WOW — the favorite, a large hero bubble ── */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0 6px' }}>
            <GameBubble g={featured} size={132} index={0} caption="האהוב שלך ⭐" />
          </div>

          {/* ── Solitaire bubbles ── */}
          <GroupLabel text="סוליטר" delay={0.18} />
          <div style={grid}>
            {solitaire.map((g, i) => <GameBubble key={g.id} g={g} size={92} index={i + 1} />)}
          </div>

          {/* ── Mahjong bubbles ── */}
          <div style={{ marginTop: 18 }}>
            <GroupLabel text="מהג'ונג" delay={0.28} />
          </div>
          <div style={grid}>
            {mahjong.map((g, i) => <GameBubble key={g.id} g={g} size={92} index={i + 1} />)}
          </div>

          {/* Footer identity */}
          <footer data-ag style={{
            textAlign: 'center', padding: '24px 24px 0',
            animation: 'ag-rise .5s .4s cubic-bezier(.22,1,.36,1) both', opacity: 0,
          }}>
            <div style={{ direction: 'ltr', fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(201,168,76,0.7)' }}>
              ABU BANK · ABU GAMES
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.32)', marginTop: 6 }}>
              כל משחק נפתח בדפדפן. לחצי על החץ למעלה כדי לחזור.
            </div>
          </footer>
        </div>
      </div>
    </>
  )
}

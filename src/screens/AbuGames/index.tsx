import { useEffect, useMemo } from 'react'
import { useAppStore } from '../../state/store'
import { Screen } from '../../state/types'
import { BackButton } from '../../components/BackButton'
import { getRandomMartitaPhoto, handleMartitaImgError } from '../../services/martitaPhotos'
import { soundTap } from '../../services/sounds'

// ─── GAMES DATA ─────────────────────────────────────────────────────────────

interface Game {
  id: string
  label: string
  labelHe: string
  url: string
  accent: string
  category: 'featured' | 'solitaire' | 'mahjong'
  emoji: string
  desc?: string
}

const GAMES: Game[] = [
  // Featured
  { id: 'wow', label: 'Abu WOW', labelHe: 'אבו וואו', url: 'https://www.crazygames.com/game/words-of-wonders', accent: '#C9A84C', category: 'featured', emoji: '🔤', desc: 'בונים מילים ← מתקדמים בשלבים' },
  // Solitaire
  { id: 'klondike', label: 'Solitario', labelHe: 'סוליטר קלאסי', accent: '#22c55e', category: 'solitaire', emoji: '🃏', url: 'https://www.arkadium.com/games/klondike-solitaire/' },
  { id: 'spider', label: 'Spider', labelHe: 'עכביש', accent: '#a78bfa', category: 'solitaire', emoji: '🕷️', url: 'https://www.arkadium.com/games/spider-solitaire/' },
  { id: 'freecell', label: 'FreeCell', labelHe: 'פריסל', accent: '#3b82f6', category: 'solitaire', emoji: '🔵', url: 'https://www.arkadium.com/games/freecell/' },
  { id: 'pyramid', label: 'Pirámide', labelHe: 'פירמידה', accent: '#f59e0b', category: 'solitaire', emoji: '🔺', url: 'https://games.aarp.org/games/pyramid-solitaire' },
  { id: 'tripeaks', label: 'Tri Peaks', labelHe: 'שלושה פסגות', accent: '#14b8a6', category: 'solitaire', emoji: '⛰️', url: 'https://www.arkadium.com/games/tripeaks-solitaire-free/' },
  { id: 'hearts', label: 'Corazones', labelHe: 'לבבות', accent: '#f43f5e', category: 'solitaire', emoji: '❤️', url: 'https://cardgames.io/hearts/' },
  { id: 'canfield', label: 'Canfield', labelHe: 'קאנפילד', accent: '#06b6d4', category: 'solitaire', emoji: '💠', url: 'https://solitaired.com/canfield' },
  { id: 'golf', label: 'Golf', labelHe: 'גולף', accent: '#16a34a', category: 'solitaire', emoji: '⛳', url: 'https://www.solitaire-play.com/golf/' },
  { id: 'yukon', label: 'Yukon', labelHe: 'יוקון', accent: '#0ea5e9', category: 'solitaire', emoji: '🌊', url: 'https://solitaired.com/yukon' },
  { id: 'spider2', label: 'Spider ×2', labelHe: 'עכביש ×2', accent: '#f97316', category: 'solitaire', emoji: '🕸️', url: 'https://www.arkadium.com/games/spider-solitaire-2-suits/' },
  { id: 'forty', label: '40 Ladrones', labelHe: '40 ליסטים', accent: '#818cf8', category: 'solitaire', emoji: '🗡️', url: 'https://solitaired.com/forty-thieves' },
  // Mahjong
  { id: 'mahjong', label: 'Mahjong', labelHe: "מהג'ונג", accent: '#ef4444', category: 'mahjong', emoji: '🀄', url: 'https://www.arkadium.com/games/mahjongg-solitaire/' },
  { id: 'mahjong-connect', label: 'Connect', labelHe: 'חיבור', accent: '#f97316', category: 'mahjong', emoji: '🔗', url: 'https://www.arkadium.com/games/mahjong-connect/' },
  { id: 'mahjong-3d', label: 'Dimensiones', labelHe: 'תלת-מימד', accent: '#8b5cf6', category: 'mahjong', emoji: '🧊', url: 'https://www.arkadium.com/games/mahjongg-dimensions/' },
]

// ─── NAVIGATION GUARD ───────────────────────────────────────────────────────

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

// ─── ATMOSPHERE: Stars + Particles ──────────────────────────────────────────

const STARS = Array.from({ length: 24 }, (_, i) => ({
  left: `${(i * 4.2 + (i % 3) * 7.1 + 2) % 96}%`,
  top: `${(i * 3.8 + (i % 5) * 6.3 + 1) % 95}%`,
  size: 1.5 + (i % 4) * 0.8,
  delay: `${(i * 0.13).toFixed(2)}s`,
  duration: `${2.2 + (i % 4) * 0.4}s`,
  isGold: i % 5 === 0,
}))

const FLOATING_EMOJIS = [
  { emoji: '✨', left: '8%', top: '12%', size: 18, delay: '0s', duration: '7s' },
  { emoji: '🎯', left: '85%', top: '20%', size: 16, delay: '0.4s', duration: '8s' },
  { emoji: '⭐', left: '72%', top: '8%', size: 14, delay: '1.2s', duration: '6s' },
  { emoji: '💫', left: '20%', top: '25%', size: 15, delay: '0.8s', duration: '9s' },
  { emoji: '🎲', left: '55%', top: '15%', size: 16, delay: '1.5s', duration: '7.5s' },
  { emoji: '🌟', left: '40%', top: '5%', size: 14, delay: '0.3s', duration: '8.5s' },
]

// ─── GREETING ───────────────────────────────────────────────────────────────

function getTimeGreeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'לילה טוב'
  if (h < 12) return 'בוקר טוב'
  if (h < 17) return 'צהריים טובים'
  if (h < 21) return 'ערב טוב'
  return 'לילה טוב'
}

// ─── CSS KEYFRAMES ──────────────────────────────────────────────────────────

const STYLES = `
  @keyframes gFloat    { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-12px) rotate(6deg)} }
  @keyframes gFadeUp   { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
  @keyframes gStar     { 0%,100%{opacity:0.2;transform:scale(0.7)} 50%{opacity:1;transform:scale(1.3)} }
  @keyframes gPulse    { 0%,100%{box-shadow:0 0 30px rgba(201,168,76,0.08)} 50%{box-shadow:0 0 50px rgba(201,168,76,0.18)} }
  @keyframes gBreathe  { 0%,100%{opacity:0.03} 50%{opacity:0.07} }
  @keyframes gShimmer  { 0%{background-position:200% 50%} 100%{background-position:-200% 50%} }
  @keyframes gHeroIcon { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-8px) scale(1.04)} }

  .games-strip::-webkit-scrollbar { display:none }
  .games-strip { scrollbar-width:none; }

  @media (prefers-reduced-motion: reduce) {
    [data-g-animate] { animation: none !important; }
  }
`

// ─── FEATURED HERO CARD ─────────────────────────────────────────────────────

function FeaturedHero({ game, onTap }: { game: Game; onTap: () => void }) {
  return (
    <div
      role="button" tabIndex={0} aria-label={game.labelHe}
      onClick={onTap}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap() } }}
      data-g-animate
      style={{
        position: 'relative', zIndex: 3,
        margin: '0 20px', borderRadius: 24, overflow: 'hidden',
        background: 'linear-gradient(160deg, rgba(201,168,76,0.14) 0%, rgba(255,250,240,0.07) 40%, rgba(201,168,76,0.06) 100%)',
        border: '1.5px solid rgba(201,168,76,0.32)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.45), 0 0 60px rgba(201,168,76,0.08), inset 0 1px 0 rgba(255,250,240,0.08)',
        padding: '24px 22px 20px',
        direction: 'rtl', cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        animation: 'gFadeUp 0.5s ease both, gPulse 4s 1s ease-in-out infinite',
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* Radiant glow overlay */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 24, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 10%, rgba(201,168,76,0.12) 0%, transparent 50%)',
      }} />
      {/* Shimmer stripe */}
      <div data-g-animate style={{
        position: 'absolute', inset: 0, borderRadius: 24, pointerEvents: 'none',
        background: 'linear-gradient(105deg, transparent 35%, rgba(255,250,240,0.05) 45%, rgba(255,250,240,0.10) 50%, rgba(255,250,240,0.05) 55%, transparent 65%)',
        backgroundSize: '300% 100%',
        animation: 'gShimmer 6s 2s ease-in-out infinite',
      }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 18 }}>
        {/* Game emoji orb */}
        <div style={{
          width: 80, height: 80, borderRadius: 22,
          background: 'radial-gradient(circle at 40% 35%, rgba(201,168,76,0.25), rgba(201,168,76,0.06) 70%)',
          border: '1.5px solid rgba(201,168,76,0.28)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.30), 0 0 30px rgba(201,168,76,0.10), inset 0 1px 0 rgba(255,250,240,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ fontSize: 44, lineHeight: 1, filter: 'drop-shadow(0 2px 8px rgba(201,168,76,0.30))' }}>{game.emoji}</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'rgba(255,255,255,0.97)', fontFamily: "'Heebo',sans-serif", lineHeight: 1.2, marginBottom: 3 }}>
            {game.labelHe}
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'rgba(201,168,76,0.75)', fontFamily: "'Heebo',sans-serif", lineHeight: 1.4 }}>
            משחק המילים של Martita
          </div>
          {game.desc && (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.42)', fontFamily: "'Heebo',sans-serif", marginTop: 4 }}>
              {game.desc}
            </div>
          )}
        </div>
      </div>

      {/* CTA button */}
      <div style={{
        position: 'relative', zIndex: 1, marginTop: 18,
        background: 'linear-gradient(135deg, rgba(201,168,76,0.22), rgba(201,168,76,0.08))',
        border: '1px solid rgba(201,168,76,0.30)', borderRadius: 14,
        padding: '14px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: 'rgba(201,168,76,0.85)', fontFamily: "'Heebo',sans-serif" }}>
          שחקי עכשיו
        </span>
        <span style={{ fontSize: 14, color: 'rgba(201,168,76,0.55)', transform: 'scaleX(-1)', display: 'inline-block' }}>▶</span>
      </div>
    </div>
  )
}

// ─── GAME BUBBLE (strip card) ───────────────────────────────────────────────

function GameBubble({ game, onTap, delay }: { game: Game; onTap: () => void; delay: number }) {
  return (
    <div
      role="button" tabIndex={0} aria-label={game.labelHe}
      onClick={onTap}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap() } }}
      data-g-animate
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        padding: '18px 16px 16px', borderRadius: 20, minWidth: 104, flexShrink: 0,
        background: 'linear-gradient(160deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.05) 100%)',
        border: `1.5px solid ${game.accent}30`,
        backdropFilter: 'blur(8px)',
        boxShadow: `0 4px 16px rgba(0,0,0,0.28), 0 0 14px ${game.accent}10`,
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        animation: `gFadeUp 0.45s ${delay}s ease both`,
        opacity: 0,
      } as React.CSSProperties}
    >
      <span style={{ fontSize: 36, lineHeight: 1, userSelect: 'none', filter: `drop-shadow(0 2px 6px ${game.accent}30)` }}>{game.emoji}</span>
      <span style={{
        fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.90)',
        fontFamily: "'Heebo',sans-serif", textAlign: 'center', lineHeight: 1.2,
      }}>{game.labelHe}</span>
      <span style={{
        fontSize: 11, color: game.accent, fontWeight: 600,
        fontFamily: "'Heebo',sans-serif", opacity: 0.75,
      }}>{game.label}</span>
    </div>
  )
}

// ─── MAIN SCREEN ────────────────────────────────────────────────────────────

export function AbuGames() {
  const setScreen = useAppStore(s => s.setScreen)
  const martitaPhoto = useMemo(() => getRandomMartitaPhoto(), [])

  const featured = GAMES.find(g => g.category === 'featured')!
  const solitaire = GAMES.filter(g => g.category === 'solitaire')
  const mahjong = GAMES.filter(g => g.category === 'mahjong')

  useEffect(() => {
    const onVis = () => { if (!document.hidden) isNavigating = false }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  return (
    <>
      <style>{STYLES}</style>

      <div style={{
        display: 'flex', flexDirection: 'column', minHeight: '100dvh',
        overflowY: 'auto', overflowX: 'hidden',
        background: '#050A18', direction: 'rtl',
        fontFamily: "'Heebo', sans-serif",
      }}>

        {/* ═══ HERO SECTION ═══════════════════════════════════════════════ */}
        <div style={{
          position: 'relative', minHeight: 340,
          background: 'linear-gradient(180deg, #0f1e3d 0%, #0a1630 30%, #050A18 100%)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', overflow: 'hidden',
          paddingBottom: 28,
        }}>

          {/* ─── Atmosphere: Stars ──── */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            {STARS.map((s, i) => (
              <div key={i} data-g-animate style={{
                position: 'absolute', left: s.left, top: s.top,
                width: s.size, height: s.size, borderRadius: '50%',
                background: s.isGold ? 'rgba(201,168,76,0.90)' : 'rgba(255,255,255,0.85)',
                animation: `gStar ${s.duration} ${s.delay} ease-in-out infinite`,
              }} />
            ))}
          </div>

          {/* ─── Atmosphere: Floating emojis ──── */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 1 }}>
            {FLOATING_EMOJIS.map((p, i) => (
              <div key={i} data-g-animate style={{
                position: 'absolute', left: p.left, top: p.top,
                fontSize: p.size, opacity: 0.15,
                animation: `gFloat ${p.duration} ${p.delay} ease-in-out infinite`,
                userSelect: 'none',
              }}>{p.emoji}</div>
            ))}
          </div>

          {/* ─── Warm radial glow ──── */}
          <div data-g-animate style={{
            position: 'absolute', top: '25%', left: '50%',
            width: '120%', height: '70%',
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(ellipse, rgba(201,168,76,0.05) 0%, transparent 55%)',
            animation: 'gBreathe 6s ease-in-out infinite',
            pointerEvents: 'none',
          }} />

          {/* ─── Header bar ──── */}
          <div style={{
            position: 'relative', zIndex: 4, width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 16px 8px', gap: 8,
          }}>
            <BackButton />
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              border: '2px solid rgba(201,168,76,0.30)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.40)',
              overflow: 'hidden', background: 'rgba(0,0,0,0.3)', flexShrink: 0,
            }}>
              <img src={martitaPhoto} alt="Martita" loading="eager"
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%', display: 'block' }}
                onError={handleMartitaImgError} />
            </div>
          </div>

          {/* ─── Greeting ──── */}
          <div data-g-animate style={{
            position: 'relative', zIndex: 3, textAlign: 'center',
            marginTop: 12, animation: 'gFadeUp 0.4s ease both',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.05em', color: 'rgba(201,168,76,0.80)' }}>
              {getTimeGreeting()}, Martita ✨
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', letterSpacing: '0.12em', marginTop: 3, textTransform: 'uppercase' }}>
              Abu Games
            </div>
          </div>

          {/* ─── Hero game icon ──── */}
          <div data-g-animate style={{
            position: 'relative', zIndex: 3, marginTop: 18,
            fontSize: 90, lineHeight: 1,
            filter: 'drop-shadow(0px 0px 35px rgba(201,168,76,0.40))',
            animation: 'gHeroIcon 4s ease-in-out infinite',
            userSelect: 'none',
          }}>
            🎮
          </div>

          {/* ─── Title ──── */}
          <div data-g-animate style={{
            position: 'relative', zIndex: 3, marginTop: 10, textAlign: 'center',
            animation: 'gFadeUp 0.55s ease both',
          }}>
            <div style={{
              fontSize: 34, fontWeight: 800, lineHeight: 1.1,
              color: 'rgba(255,255,255,0.97)',
              letterSpacing: '-0.02em',
              textShadow: '0 4px 24px rgba(0,0,0,0.40), 0 0 50px rgba(201,168,76,0.22)',
            }}>
              בואי נשחק!
            </div>
            <div style={{
              fontSize: 16, fontWeight: 500, color: 'rgba(201,168,76,0.65)',
              marginTop: 6,
            }}>
              המשחקים האהובים של Martita
            </div>
          </div>
        </div>

        {/* ═══ CONTENT SECTION ═══════════════════════════════════════════ */}
        <div style={{ background: '#050A18', paddingTop: 4, paddingBottom: 44, position: 'relative' }}>

          {/* Ambient glow behind content */}
          <div data-g-animate style={{
            position: 'absolute', top: '20%', left: '50%',
            width: '100%', height: '40%',
            transform: 'translate(-50%, 0)',
            background: 'radial-gradient(ellipse, rgba(201,168,76,0.03) 0%, transparent 60%)',
            animation: 'gBreathe 8s 3s ease-in-out infinite',
            pointerEvents: 'none',
          }} />

          {/* ─── Featured game ──── */}
          <div style={{ marginBottom: 28 }}>
            <FeaturedHero game={featured} onTap={() => handleTap(featured.url)} />
          </div>

          {/* ─── Solitaire strip ──── */}
          <div data-g-animate style={{
            padding: '0 22px 10px', fontSize: 12, fontWeight: 800,
            color: 'rgba(255,255,255,0.35)', letterSpacing: '0.10em', textTransform: 'uppercase',
            animation: 'gFadeUp 0.5s 0.15s ease both', opacity: 0,
          } as React.CSSProperties}>
            🃏 סוליטר · {solitaire.length} משחקים
          </div>
          <div className="games-strip" style={{
            display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none',
            padding: '0 20px 20px',
          }}>
            {solitaire.map((g, i) => (
              <GameBubble key={g.id} game={g} onTap={() => handleTap(g.url)} delay={0.2 + i * 0.04} />
            ))}
          </div>

          {/* ─── Mahjong strip ──── */}
          <div data-g-animate style={{
            padding: '4px 22px 10px', fontSize: 12, fontWeight: 800,
            color: 'rgba(255,255,255,0.35)', letterSpacing: '0.10em', textTransform: 'uppercase',
            animation: 'gFadeUp 0.5s 0.5s ease both', opacity: 0,
          } as React.CSSProperties}>
            🀄 מהג'ונג · {mahjong.length} משחקים
          </div>
          <div className="games-strip" style={{
            display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none',
            padding: '0 20px 20px',
          }}>
            {mahjong.map((g, i) => (
              <GameBubble key={g.id} game={g} onTap={() => handleTap(g.url)} delay={0.55 + i * 0.04} />
            ))}
          </div>

          {/* ─── MartitAI tip ──── */}
          <div data-g-animate style={{
            margin: '8px 20px 0', padding: '18px 20px', borderRadius: 22,
            background: 'linear-gradient(160deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)',
            border: '1.5px solid rgba(201,168,76,0.20)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 6px 28px rgba(0,0,0,0.30), 0 0 20px rgba(201,168,76,0.05)',
            animation: 'gFadeUp 0.5s 0.7s ease both', opacity: 0,
          } as React.CSSProperties}>
            <div style={{
              fontSize: 11, fontWeight: 800, color: 'rgba(201,168,76,0.70)',
              letterSpacing: '0.10em', marginBottom: 10, textTransform: 'uppercase',
            }}>
              ✨ MartitAI אומרת:
            </div>
            <div style={{ fontSize: 16, lineHeight: 1.7, color: 'rgba(255,255,255,0.88)', fontWeight: 500 }}>
              המשחקים טובים לראש! סוליטר לריכוז, מילים לזיכרון.
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.50)', marginTop: 4 }}>
              כל משחק נפתח בדפדפן — לחצי חזרה לחזור לכאן.
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

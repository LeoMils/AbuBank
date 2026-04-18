import { useState, useEffect, useMemo } from 'react'
import { useAppStore } from '../../state/store'
import { Screen } from '../../state/types'
import { BackButton } from '../../components/BackButton'
import { getRandomMartitaPhoto, handleMartitaImgError } from '../../services/martitaPhotos'
import { soundTap } from '../../services/sounds'
import { InfoButton } from '../../components/InfoButton'
import { injectSharedKeyframes } from '../../design/animations'

/* ─── GAMES DATA ─── */
interface Game {
  id: string
  label: string
  labelHe: string
  url: string
  accent: string
  category: 'solitaire' | 'mahjong'
  emoji: string
}

const GAMES: Game[] = [
  // ── Solitaire ──────────────────────────────────────────────────────────────
  { id: 'klondike',        label: 'Solitario',   labelHe: 'סוליטר קלאסי',  accent: '#22c55e', category: 'solitaire', emoji: '🃏', url: 'https://www.arkadium.com/games/klondike-solitaire/' },
  { id: 'spider',          label: 'Spider',       labelHe: 'עכביש',          accent: '#a78bfa', category: 'solitaire', emoji: '🕷️', url: 'https://www.arkadium.com/games/spider-solitaire/' },
  { id: 'freecell',        label: 'FreeCell',     labelHe: 'פריסל',          accent: '#3b82f6', category: 'solitaire', emoji: '🔵', url: 'https://www.arkadium.com/games/freecell/' },
  { id: 'pyramid',         label: 'Pirámide',     labelHe: 'פירמידה',        accent: '#f59e0b', category: 'solitaire', emoji: '🔺', url: 'https://games.aarp.org/games/pyramid-solitaire' },
  { id: 'tripeaks',        label: 'Tri Peaks',    labelHe: 'שלושה פסגות',    accent: '#14b8a6', category: 'solitaire', emoji: '⛰️', url: 'https://www.arkadium.com/games/tripeaks-solitaire-free/' },
  { id: 'hearts',          label: 'Corazones',    labelHe: 'לבבות',          accent: '#f43f5e', category: 'solitaire', emoji: '❤️', url: 'https://cardgames.io/hearts/' },
  { id: 'canfield',        label: 'Canfield',     labelHe: 'קאנפילד',        accent: '#06b6d4', category: 'solitaire', emoji: '💠', url: 'https://solitaired.com/canfield' },
  { id: 'golf',            label: 'Golf',         labelHe: 'גולף',           accent: '#16a34a', category: 'solitaire', emoji: '⛳', url: 'https://www.solitaire-play.com/golf/' },
  { id: 'yukon',           label: 'Yukon',        labelHe: 'יוקון',          accent: '#0ea5e9', category: 'solitaire', emoji: '🌊', url: 'https://solitaired.com/yukon' },
  { id: 'spider2',         label: 'Spider ×2',    labelHe: 'עכביש ×2',       accent: '#f97316', category: 'solitaire', emoji: '🕸️', url: 'https://www.arkadium.com/games/spider-solitaire-2-suits/' },
  { id: 'forty',           label: '40 Ladrones',  labelHe: '40 ליסטים',      accent: '#818cf8', category: 'solitaire', emoji: '🗡️', url: 'https://solitaired.com/forty-thieves' },
  // ── Mahjong ────────────────────────────────────────────────────────────────
  { id: 'mahjong',         label: 'Mahjong',      labelHe: "מהג'ונג",        accent: '#ef4444', category: 'mahjong',   emoji: '🀄', url: 'https://www.arkadium.com/games/mahjongg-solitaire/' },
  { id: 'mahjong-connect', label: 'Connect',      labelHe: 'חיבור',          accent: '#f97316', category: 'mahjong',   emoji: '🔗', url: 'https://www.arkadium.com/games/mahjong-connect/' },
  { id: 'mahjong-3d',      label: 'Dimensiones',  labelHe: 'תלת-מימד',       accent: '#8b5cf6', category: 'mahjong',   emoji: '🧊', url: 'https://www.arkadium.com/games/mahjongg-dimensions/' },
]

/* ─── FEATURED GAME ─── */
const WOW_GAME: Game = {
  id: 'wow-solitaire',
  label: 'WOW Solitaire',
  labelHe: 'WOW סוליטר',
  url: 'https://worldofsolitaire.com/',
  accent: '#C9A84C',
  category: 'solitaire',
  emoji: '👑',
}

const SOLITAIRE_GAMES = GAMES.filter(g => g.category === 'solitaire')
const MAHJONG_GAMES   = GAMES.filter(g => g.category === 'mahjong')

/* ─── Navigation guard ─── */
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

/* ─── Game Card (160×200) ─── */
function GameCard({
  game, pressKey, onPress, onRelease, delay, categoryAccent,
}: {
  game: Game
  pressKey: string | null
  onPress: (k: string) => void
  onRelease: () => void
  delay: number
  categoryAccent: string
}) {
  const isP = pressKey === game.id

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={game.labelHe}
      onClick={() => handleTap(game.url)}
      onPointerDown={() => onPress(game.id)}
      onPointerUp={onRelease}
      onPointerLeave={onRelease}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTap(game.url) } }}
      style={{
        width: 160,
        height: 200,
        borderRadius: 16,
        background: isP
          ? 'rgba(255,255,255,0.10)'
          : 'rgba(255,255,255,0.06)',
        border: isP
          ? `1.5px solid rgba(201,168,76,0.70)`
          : '1px solid rgba(255,255,255,0.09)',
        boxShadow: isP
          ? `0 2px 12px rgba(201,168,76,0.18), inset 0 0 0 1px rgba(201,168,76,0.12)`
          : `0 4px 18px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.05)`,
        transform: isP ? 'scale(0.96)' : 'scale(1)',
        transition: 'transform 0.12s ease-out, box-shadow 0.12s ease-out, border-color 0.12s, background 0.12s',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        overflow: 'hidden',
        position: 'relative',
        WebkitTapHighlightColor: 'transparent',
        animation: `cardIn 0.40s cubic-bezier(0.34,1.20,0.64,1) ${delay}s both`,
        paddingTop: 32,
        paddingBottom: 0,
      }}
    >
      {/* Top glass shimmer */}
      <div aria-hidden="true" style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 60,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.045) 0%, transparent 100%)',
        borderRadius: '16px 16px 0 0',
        pointerEvents: 'none',
      }} />

      {/* Game icon (emoji, 56px) */}
      <div style={{
        fontSize: 56,
        lineHeight: 1,
        filter: isP ? 'brightness(1.15)' : 'none',
        transition: 'filter 0.12s',
        userSelect: 'none',
      }}>
        {game.emoji}
      </div>

      {/* Game name in Hebrew */}
      <div style={{
        fontSize: 18,
        fontWeight: 700,
        color: 'rgba(255,255,255,0.90)',
        fontFamily: "'Heebo','DM Sans',sans-serif",
        textAlign: 'center',
        direction: 'rtl',
        lineHeight: 1.25,
        paddingLeft: 10,
        paddingRight: 10,
        flexShrink: 0,
      }}>
        {game.labelHe}
      </div>

      {/* Category color accent bar at bottom */}
      <div style={{
        width: '100%',
        height: 5,
        background: `linear-gradient(90deg, transparent 0%, ${categoryAccent} 40%, ${categoryAccent} 60%, transparent 100%)`,
        opacity: isP ? 1 : 0.55,
        transition: 'opacity 0.12s',
        flexShrink: 0,
        borderRadius: '0 0 14px 14px',
      }} />
    </div>
  )
}

/* ─── Featured Game Card (full-width hero) ─── */
function FeaturedGameCard({
  game, pressKey, onPress, onRelease,
}: {
  game: Game
  pressKey: string | null
  onPress: (k: string) => void
  onRelease: () => void
}) {
  const isP = pressKey === game.id

  return (
    <div style={{
      display: 'flex', justifyContent: 'center',
      animation: 'cardIn 0.45s cubic-bezier(0.34,1.20,0.64,1) 0s both',
    }}>
      <div
        role="button"
        tabIndex={0}
        aria-label={game.labelHe}
        onClick={() => handleTap(game.url)}
        onPointerDown={() => onPress(game.id)}
        onPointerUp={onRelease}
        onPointerLeave={onRelease}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTap(game.url) } }}
        style={{
          width: '100%',
          maxWidth: 336,
          height: 220,
          borderRadius: 20,
          background: isP
            ? 'linear-gradient(145deg, rgba(201,168,76,0.18) 0%, rgba(255,255,255,0.10) 100%)'
            : 'linear-gradient(145deg, rgba(201,168,76,0.10) 0%, rgba(255,255,255,0.06) 100%)',
          border: isP
            ? '2px solid rgba(201,168,76,0.75)'
            : '1.5px solid rgba(201,168,76,0.30)',
          boxShadow: isP
            ? '0 4px 24px rgba(201,168,76,0.28), inset 0 0 0 1px rgba(201,168,76,0.15)'
            : '0 8px 32px rgba(0,0,0,0.50), 0 0 0 1px rgba(201,168,76,0.08), inset 0 1px 0 rgba(255,255,255,0.06)',
          transform: isP ? 'scale(0.97)' : 'scale(1)',
          transition: 'transform 0.12s ease-out, box-shadow 0.12s ease-out, border-color 0.12s, background 0.12s',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          overflow: 'hidden',
          position: 'relative',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {/* Top glass shimmer */}
        <div aria-hidden="true" style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 80,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 100%)',
          borderRadius: '20px 20px 0 0',
          pointerEvents: 'none',
        }} />

        {/* Corner gold accents */}
        <div aria-hidden="true" style={{
          position: 'absolute', top: 12, right: 16,
          fontSize: 18, opacity: 0.15, userSelect: 'none',
        }}>♠ ♥ ♦ ♣</div>
        <div aria-hidden="true" style={{
          position: 'absolute', bottom: 16, left: 16,
          fontSize: 18, opacity: 0.15, userSelect: 'none',
        }}>♣ ♦ ♥ ♠</div>

        {/* Large emoji icon */}
        <div style={{
          fontSize: 72,
          lineHeight: 1,
          filter: isP ? 'brightness(1.15)' : 'drop-shadow(0 4px 12px rgba(201,168,76,0.3))',
          transition: 'filter 0.12s',
          userSelect: 'none',
        }}>
          {game.emoji}
        </div>

        {/* WOW title */}
        <div style={{
          fontSize: 28,
          fontWeight: 800,
          fontFamily: "'Heebo','DM Sans',sans-serif",
          background: 'linear-gradient(135deg, #FDE68A 0%, #F59E0B 25%, #D97706 50%, #C9A84C 75%, #FDE68A 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          letterSpacing: '1.5px',
          textAlign: 'center',
          direction: 'rtl',
          filter: 'drop-shadow(0 0 10px rgba(201,168,76,0.35))',
        } as React.CSSProperties}>
          {game.labelHe}
        </div>

        {/* Subtitle */}
        <div style={{
          fontSize: 14,
          color: 'rgba(255,255,255,0.45)',
          fontFamily: "'Heebo',sans-serif",
          letterSpacing: '0.5px',
          direction: 'rtl',
        }}>
          עולם הסוליטר
        </div>

        {/* Bottom gold accent bar */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 6,
          background: 'linear-gradient(90deg, transparent 0%, #C9A84C 30%, #FDE68A 50%, #C9A84C 70%, transparent 100%)',
          opacity: isP ? 1 : 0.6,
          transition: 'opacity 0.12s',
          borderRadius: '0 0 18px 18px',
        }} />
      </div>
    </div>
  )
}

/* ─── Category Section ─── */
function CategorySection({
  emoji, titleHe, accent, games, pressKey, onPress, onRelease, baseDelay,
}: {
  emoji: string
  titleHe: string
  accent: string
  games: Game[]
  pressKey: string | null
  onPress: (k: string) => void
  onRelease: () => void
  baseDelay: number
}) {
  return (
    <div>
      {/* Category separator: gold gradient line + emoji + label */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 24,
        direction: 'rtl',
      }}>
        {/* Right gradient line */}
        <div style={{
          flex: 1,
          height: 1.5,
          background: `linear-gradient(90deg, transparent, rgba(201,168,76,0.55))`,
          borderRadius: 1,
        }} />

        {/* Label pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px',
          borderRadius: 20,
          background: `linear-gradient(135deg, rgba(201,168,76,0.12), rgba(201,168,76,0.04))`,
          border: '1px solid rgba(201,168,76,0.22)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}>
          <span style={{ fontSize: 22, lineHeight: 1, userSelect: 'none' }}>{emoji}</span>
          <span style={{
            fontSize: 18,
            fontWeight: 800,
            fontFamily: "'Heebo','DM Sans',sans-serif",
            background: 'linear-gradient(135deg, #FDE68A 0%, #F59E0B 35%, #C9A84C 65%, #FDE68A 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '0.3px',
          } as React.CSSProperties}>
            {titleHe}
          </span>
        </div>

        {/* Left gradient line */}
        <div style={{
          flex: 1,
          height: 1.5,
          background: `linear-gradient(90deg, rgba(201,168,76,0.55), transparent)`,
          borderRadius: 1,
        }} />
      </div>

      {/* 2-column card grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 160px)',
        gap: '16px',
        justifyContent: 'center',
      }}>
        {games.map((game, idx) => (
          <GameCard
            key={game.id}
            game={game}
            pressKey={pressKey}
            onPress={onPress}
            onRelease={onRelease}
            delay={baseDelay + idx * 0.045}
            categoryAccent={accent}
          />
        ))}
      </div>
    </div>
  )
}

/* ─── Main Screen ─── */
export function AbuGames() {
  const setScreen = useAppStore(s => s.setScreen)
  const [pressed, setPressed] = useState<string | null>(null)
  const martitaPhoto = useMemo(() => getRandomMartitaPhoto(), [])

  useEffect(() => {
    injectSharedKeyframes()
    if (!document.getElementById('abu-games-redesign-anim')) {
      const style = document.createElement('style')
      style.id = 'abu-games-redesign-anim'
      style.textContent = `
        @keyframes cardIn {
          from { opacity: 0; transform: scale(0.82) translateY(22px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
        @keyframes floatParticle {
          0%,100% { transform: translateY(0px)   rotate(var(--rot,0deg)); opacity: var(--op, 0.05); }
          50%     { transform: translateY(-16px) rotate(var(--rot,0deg)); opacity: calc(var(--op, 0.05) * 1.6); }
        }
        @keyframes headerSlideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0);     }
        }
        .abu-games-scroll      { scrollbar-width: none; -ms-overflow-style: none; }
        .abu-games-scroll::-webkit-scrollbar { display: none; }
      `
      document.head.appendChild(style)
    }

    const onVis = () => { if (!document.hidden) isNavigating = false }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      document.getElementById('abu-games-redesign-anim')?.remove()
    }
  }, [])

  return (
    <div
      className="abu-games-scroll"
      style={{
        height: '100%',
        width: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        background: '#050A18',
        fontFamily: "'Heebo','DM Sans',sans-serif",
        userSelect: 'none',
        WebkitUserSelect: 'none',
        position: 'relative',
      }}
    >

      {/* ── Ambient background glow blobs — with live color shift ── */}
      <div aria-hidden="true" style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: [
          'radial-gradient(ellipse 55% 30% at 12% 8%,  rgba(201,168,76,0.14) 0%, transparent 60%)',
          'radial-gradient(ellipse 45% 35% at 90% 85%, rgba(239,68,68,0.09) 0%,  transparent 60%)',
          'radial-gradient(ellipse 40% 25% at 50% 45%, rgba(139,92,246,0.05) 0%, transparent 65%)',
        ].join(', '),
        animation: 'ambientColorShift 25s ease-in-out infinite',
      }} />

      {/* ── Floating game particles (♠ ♣ 🀄 etc.) ── */}
      {[
        { ch: '♠', top: '6%',  left: '7%',  size: 54, op: 0.05, delay: '0s',   dur: '7s',   rot: '-12deg' },
        { ch: '♣', top: '12%', left: '83%', size: 46, op: 0.04, delay: '1.4s', dur: '8.5s', rot: '8deg'  },
        { ch: '中', top: '38%', left: '88%', size: 44, op: 0.05, delay: '0.7s', dur: '6.2s', rot: '15deg' },
        { ch: '♥', top: '56%', left: '4%',  size: 66, op: 0.04, delay: '2.2s', dur: '9s',   rot: '-7deg' },
        { ch: '🀄', top: '74%', left: '82%', size: 50, op: 0.04, delay: '0.5s', dur: '6.8s', rot: '10deg' },
        { ch: '♦', top: '88%', left: '48%', size: 56, op: 0.04, delay: '1.9s', dur: '7.5s', rot: '-18deg'},
        { ch: '發', top: '28%', left: '2%',  size: 40, op: 0.04, delay: '3s',   dur: '8s',   rot: '5deg'  },
      ].map((f, i) => (
        <div key={i} aria-hidden="true" style={{
          position: 'absolute', top: f.top, left: f.left,
          fontSize: f.size, color: 'white',
          pointerEvents: 'none', zIndex: 0, lineHeight: 1,
          animation: `floatParticle ${f.dur} ease-in-out ${f.delay} infinite`,
          ['--op' as string]: f.op,
          ['--rot' as string]: f.rot,
          opacity: f.op,
        } as React.CSSProperties}>{f.ch}</div>
      ))}

      {/* ════ STICKY HEADER ════ */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'linear-gradient(180deg, rgba(5,10,24,0.99) 0%, rgba(8,12,28,0.97) 100%)',
        borderBottom: '1px solid rgba(201,168,76,0.18)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        animation: 'headerSlideDown 0.38s ease both',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 72,
          position: 'relative',
          padding: '0 16px',
        }}>

          {/* Gold accent glow behind wordmark */}
          <div aria-hidden="true" style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            width: '60%', height: '200%',
            background: 'radial-gradient(ellipse at center, rgba(201,168,76,0.10) 0%, transparent 65%)',
            pointerEvents: 'none', filter: 'blur(10px)',
          }} />

          {/* Martita portrait — left */}
          <div style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            width: 58, height: 58, borderRadius: '50%',
            border: '2px solid rgba(201,168,76,0.50)',
            boxShadow: '0 0 0 2px rgba(201,168,76,0.07), 0 2px 12px rgba(0,0,0,0.40)',
            overflow: 'hidden',
            background: 'linear-gradient(145deg, #1a1a2e, #050A18)',
            flexShrink: 0,
          }}>
            <img
              src={martitaPhoto}
              alt="Martita"
              loading="eager"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%', display: 'block' }}
              onError={handleMartitaImgError}
            />
          </div>

          {/* Wordmark: Abu Games 🎮 */}
          <div style={{
            display: 'inline-flex', alignItems: 'baseline', gap: 6,
            direction: 'ltr', position: 'relative',
          }}>
            <span style={{
              fontFamily: "'Cormorant Garamond',Georgia,serif",
              fontSize: 30, fontWeight: 600, letterSpacing: '2px',
              background: 'linear-gradient(135deg, #5EEAD4 0%, #2DD4BF 22%, #0D9488 48%, #5EEAD4 72%, #14B8A6 92%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 8px rgba(94,234,212,0.28))',
            } as React.CSSProperties}>Abu</span>
            <span style={{
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 27, fontWeight: 600, letterSpacing: '1.2px',
              background: 'linear-gradient(135deg, #FDE68A 0%, #F59E0B 25%, #D97706 50%, #C9A84C 75%, #F59E0B 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 8px rgba(201,168,76,0.30))',
            } as React.CSSProperties}>Games</span>
            <span style={{ fontSize: 24, lineHeight: 1, position: 'relative', top: 1, userSelect: 'none' }}>🎮</span>
          </div>

          {/* Back button */}
          <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
            <BackButton />
          </div>

          <InfoButton
            title="Abu Games"
            lines={['משחקי קלפים וסוליטר — 15 משחקים שונים.', "סוליטר, עכביש, מהג'ונג ועוד."]}
            howTo={['לחצי על כרטיס המשחק הרצוי', 'המשחק נפתח בדפדפן', 'לחצי חזרה לחזור לתפריט']}
            positionStyle={{ left: 80, top: 6 }}
          />
        </div>
      </header>

      <InfoButton
        title="Abu Games"
        lines={['Words of Wonders — המשחק הראשי!', 'משחקי קלפים וסוליטר — 14 משחקים נוספים.', "סוליטר, עכביש, מהג'ונג ועוד."]}
        howTo={['לחצי על WOW לשחק במשחק המילים', 'או בחרי משחק קלפים מהרשימה', 'המשחק נפתח בדפדפן', 'לחצי חזרה לחזור לתפריט']}
        position="top-left"
      />

      {/* ════ SCROLLABLE CONTENT ════ */}
      <div style={{
        position: 'relative', zIndex: 2,
        padding: '32px 16px',
        display: 'flex', flexDirection: 'column', gap: 48,
        paddingBottom: 'calc(40px + env(safe-area-inset-bottom, 0px))',
      }}>

        {/* ═══════ WOW HERO CARD ═══════ */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Words of Wonders — המשחק הראשי"
          onClick={() => handleTap('https://www.crazygames.com/game/words-of-wonders')}
          onPointerDown={() => setPressed('wow-hero')}
          onPointerUp={() => setPressed(null)}
          onPointerLeave={() => setPressed(null)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTap('https://www.crazygames.com/game/words-of-wonders') } }}
          style={{
            position: 'relative',
            width: '100%',
            borderRadius: 20,
            overflow: 'hidden',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
            transform: pressed === 'wow-hero' ? 'scale(0.98)' : 'scale(1)',
            transition: 'transform 0.12s ease-out, box-shadow 0.12s',
            background: 'linear-gradient(145deg, rgba(201,168,76,0.15) 0%, rgba(201,168,76,0.04) 40%, rgba(139,92,246,0.08) 100%)',
            border: pressed === 'wow-hero'
              ? '1.5px solid rgba(201,168,76,0.65)'
              : '1px solid rgba(201,168,76,0.25)',
            boxShadow: pressed === 'wow-hero'
              ? '0 4px 24px rgba(201,168,76,0.22), inset 0 0 0 1px rgba(201,168,76,0.10)'
              : '0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)',
            animation: 'cardIn 0.45s cubic-bezier(0.34,1.20,0.64,1) 0s both',
            padding: '28px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}
        >
          {/* Top shimmer */}
          <div aria-hidden="true" style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 80,
            background: 'linear-gradient(180deg, rgba(201,168,76,0.08) 0%, transparent 100%)',
            pointerEvents: 'none',
          }} />

          {/* Crown + WOW title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, direction: 'ltr' }}>
            <span style={{ fontSize: 38, lineHeight: 1, userSelect: 'none' }}>👑</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{
                fontFamily: "'Cormorant Garamond',Georgia,serif",
                fontSize: 32, fontWeight: 700, letterSpacing: '3px',
                background: 'linear-gradient(135deg, #FDE68A 0%, #F59E0B 30%, #C9A84C 60%, #FDE68A 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 0 12px rgba(201,168,76,0.35))',
              } as React.CSSProperties}>WOW</span>
              <span style={{
                fontSize: 13, fontWeight: 600, letterSpacing: '1.5px',
                color: 'rgba(255,255,255,0.50)',
                fontFamily: "'DM Sans',sans-serif",
                marginTop: -2,
              }}>WORDS OF WONDERS</span>
            </div>
            <span style={{ fontSize: 38, lineHeight: 1, userSelect: 'none' }}>🌍</span>
          </div>

          {/* Hebrew subtitle */}
          <div style={{
            fontSize: 17, fontWeight: 600,
            color: 'rgba(255,255,255,0.75)',
            fontFamily: "'Heebo',sans-serif",
            direction: 'rtl',
            textAlign: 'center',
            lineHeight: 1.5,
          }}>
            משחק המילים המפורסם בעולם
          </div>

          {/* Letter tiles decoration */}
          <div style={{
            display: 'flex', gap: 6, marginTop: 4,
          }}>
            {['W','O','R','D','S'].map((letter, i) => (
              <div key={i} style={{
                width: 38, height: 38,
                borderRadius: 8,
                background: 'linear-gradient(145deg, rgba(201,168,76,0.25), rgba(201,168,76,0.10))',
                border: '1px solid rgba(201,168,76,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 800,
                color: '#FDE68A',
                fontFamily: "'DM Sans',sans-serif",
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                animation: `cardIn 0.35s cubic-bezier(0.34,1.20,0.64,1) ${0.15 + i * 0.06}s both`,
              }}>{letter}</div>
            ))}
          </div>

          {/* Play button */}
          <div style={{
            marginTop: 4,
            padding: '10px 36px',
            borderRadius: 24,
            background: 'linear-gradient(135deg, #C9A84C 0%, #F59E0B 50%, #C9A84C 100%)',
            boxShadow: '0 4px 16px rgba(201,168,76,0.30)',
            fontSize: 18, fontWeight: 800,
            color: '#050A18',
            fontFamily: "'Heebo',sans-serif",
            letterSpacing: '0.5px',
          }}>
            🎮 שחקי עכשיו
          </div>

          {/* "Main game" badge */}
          <div style={{
            position: 'absolute', top: 12, right: 14,
            padding: '4px 10px', borderRadius: 10,
            background: 'rgba(201,168,76,0.18)',
            border: '1px solid rgba(201,168,76,0.30)',
            fontSize: 11, fontWeight: 700,
            color: 'rgba(253,230,138,0.85)',
            fontFamily: "'Heebo',sans-serif",
          }}>
            ⭐ המשחק הראשי
          </div>
        </div>

        {/* ── SOLITAIRE SECTION ── */}
        <CategorySection
          emoji="🃏"
          titleHe="סוליטר"
          accent="#C9A84C"
          games={SOLITAIRE_GAMES}
          pressKey={pressed}
          onPress={setPressed}
          onRelease={() => setPressed(null)}
          baseDelay={0.06}
        />

        {/* ── Mahjong divider ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            flex: 1, height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.28))',
          }} />
          <span style={{ fontSize: 22, opacity: 0.45, userSelect: 'none' }}>🀄</span>
          <div style={{
            flex: 1, height: 1,
            background: 'linear-gradient(90deg, rgba(239,68,68,0.28), transparent)',
          }} />
        </div>

        {/* ── MAHJONG SECTION ── */}
        <CategorySection
          emoji="🀄"
          titleHe="מהג'ונג"
          accent="#ef4444"
          games={MAHJONG_GAMES}
          pressKey={pressed}
          onPress={setPressed}
          onRelease={() => setPressed(null)}
          baseDelay={0.55}
        />
      </div>
      <div style={{ position: 'fixed', bottom: 8, left: 12, fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', color: 'rgba(201,168,76,0.30)', fontFamily: "'DM Sans',monospace", pointerEvents: 'none', zIndex: 1 }}>v15.0</div>
    </div>
  )
}

import { useState, useEffect, useMemo } from 'react'
import { useAppStore } from '../../state/store'
import { Screen } from '../../state/types'
import { BackButton } from '../../components/BackButton'
import { PageShell } from '../../components/PageShell'
import { ScreenHeader } from '../../components/ScreenHeader'
import { getRandomMartitaPhoto, handleMartitaImgError } from '../../services/martitaPhotos'
import { soundTap } from '../../services/sounds'
import { InfoButton } from '../../components/InfoButton'
import { injectSharedKeyframes } from '../../design/animations'
import { GLASS_SURFACE, GLASS_ELEVATED } from '../../design/glass'
import {
  GOLD, GOLD_BORDER, GOLD_BORDER_HOVER,
  TEXT_STRONG, TEXT_MEDIUM, TEXT_MUTED, TEXT_FAINT,
  GOLD_MEDIUM, GOLD_MUTED,
} from '../../design/colors'
import { FONT_BODY, FONT_LABEL } from '../../design/typography'

/* ─── GAMES DATA ─── */
interface Game {
  id: string
  label: string
  labelHe: string
  url: string
  accent: string
  category: 'solitaire' | 'mahjong' | 'word'
  emoji: string
}

const GAMES: Game[] = [
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
  { id: 'mahjong',         label: 'Mahjong',      labelHe: "מהג'ונג",        accent: '#ef4444', category: 'mahjong',   emoji: '🀄', url: 'https://www.arkadium.com/games/mahjongg-solitaire/' },
  { id: 'mahjong-connect', label: 'Connect',      labelHe: 'חיבור',          accent: '#f97316', category: 'mahjong',   emoji: '🔗', url: 'https://www.arkadium.com/games/mahjong-connect/' },
  { id: 'mahjong-3d',      label: 'Dimensiones',  labelHe: 'תלת-מימד',       accent: '#8b5cf6', category: 'mahjong',   emoji: '🧊', url: 'https://www.arkadium.com/games/mahjongg-dimensions/' },
]

// WOW = Words of Wonders — the word-building game (letters → words → levels).
const WOW_GAME: Game = {
  id: 'wow',
  label: 'Abu WOW',
  labelHe: 'אבו וואו',
  url: 'https://www.crazygames.com/game/words-of-wonders',
  accent: '#C9A84C',
  category: 'word',
  emoji: '🔤',
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

/* ─── Category color themes ─── */
const CATEGORY_THEMES = {
  solitaire: { glow: 'rgba(34,197,94,0.06)', accent: '#22c55e', label: '🃏' },
  mahjong:   { glow: 'rgba(239,68,68,0.06)', accent: '#ef4444', label: '🀄' },
  word:      { glow: 'rgba(201,168,76,0.08)', accent: GOLD, label: '🔤' },
} as const

/* ─── Game Card ─── */
function GameCard({ game, pressKey, onPress, onRelease, delay }: {
  game: Game
  pressKey: string | null
  onPress: (k: string) => void
  onRelease: () => void
  delay: number
}) {
  const isP = pressKey === game.id
  const theme = CATEGORY_THEMES[game.category]

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
        width: '100%',
        minHeight: 96,
        borderRadius: 18,
        position: 'relative',
        overflow: 'hidden',
        padding: '18px 16px 18px 18px',
        direction: 'rtl',
        ...GLASS_SURFACE,
        background: isP
          ? 'rgba(255,250,240,0.07)'
          : `radial-gradient(ellipse at 80% 50%, ${theme.glow}, rgba(255,250,240,0.04) 70%)`,
        boxShadow: isP
          ? `0 4px 20px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,250,240,0.05)`
          : '0 2px 12px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,250,240,0.03)',
        border: isP ? `1.5px solid ${GOLD_BORDER_HOVER}` : GLASS_SURFACE.border,
        borderRight: `4px solid ${game.accent}`,
        transform: isP ? 'scale(0.97)' : 'scale(1)',
        transition: 'transform 0.08s ease-out, border-color 0.08s, background 0.12s ease-out, box-shadow 0.12s ease-out',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        animation: `fadeSlideUp 0.3s ease-out ${delay}s both`,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      } as React.CSSProperties}
    >
      {/* Emoji orb */}
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: `radial-gradient(circle, ${game.accent}18, ${game.accent}08)`,
        border: `1px solid ${game.accent}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 28, lineHeight: 1, userSelect: 'none',
        }}>{game.emoji}</span>
      </div>

      {/* Text content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 20, fontWeight: 700, color: TEXT_STRONG,
          fontFamily: FONT_BODY, lineHeight: 1.3,
        }}>{game.labelHe}</div>
        <div style={{
          fontSize: 13, fontWeight: 500, color: TEXT_MUTED,
          fontFamily: FONT_LABEL, marginTop: 3,
        }}>{game.label}</div>
      </div>

      {/* Play arrow */}
      <div style={{
        width: 32, height: 32, borderRadius: 10,
        background: `${game.accent}15`,
        border: `1px solid ${game.accent}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 14, color: game.accent, opacity: 0.7,
          transform: 'scaleX(-1)', display: 'block',
        }}>▶</span>
      </div>
    </div>
  )
}

/* ─── Featured Game Card ─── */
function FeaturedGameCard({ game, pressKey, onPress, onRelease }: {
  game: Game
  pressKey: string | null
  onPress: (k: string) => void
  onRelease: () => void
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
        width: '100%',
        maxWidth: 370,
        margin: '0 auto 28px',
        borderRadius: 22,
        overflow: 'hidden',
        position: 'relative',
        ...GLASS_ELEVATED,
        background: 'linear-gradient(160deg, rgba(201,168,76,0.10) 0%, rgba(255,250,240,0.06) 40%, rgba(201,168,76,0.05) 100%)',
        boxShadow: isP
          ? `0 4px 24px rgba(201,168,76,0.22), inset 0 1px 0 rgba(255,250,240,0.06)`
          : '0 8px 36px rgba(0,0,0,0.40), 0 0 40px rgba(201,168,76,0.04), inset 0 1px 0 rgba(255,250,240,0.06)',
        border: isP ? `1.5px solid ${GOLD_BORDER_HOVER}` : `1px solid rgba(201,168,76,0.24)`,
        borderTop: `3px solid ${GOLD}`,
        transform: isP ? 'scale(0.97)' : 'scale(1)',
        transition: 'transform 0.08s ease-out, border-color 0.08s, box-shadow 0.12s',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        animation: 'fadeSlideUp 0.3s ease-out both',
        padding: '28px 24px 24px',
        direction: 'rtl',
      } as React.CSSProperties}
    >
      {/* Warm radial glow behind content */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, borderRadius: 22,
        background: 'radial-gradient(ellipse at 50% 15%, rgba(201,168,76,0.10) 0%, transparent 55%)',
        pointerEvents: 'none',
      }} />

      {/* Content row */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', alignItems: 'center', gap: 20,
      }}>
        {/* Large emoji sphere */}
        <div style={{
          width: 80, height: 80, borderRadius: 22,
          background: 'radial-gradient(circle at 40% 35%, rgba(201,168,76,0.18), rgba(201,168,76,0.06) 70%)',
          border: '1px solid rgba(201,168,76,0.20)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,250,240,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 44, lineHeight: 1 }}>{game.emoji}</span>
        </div>

        {/* Text block */}
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 24, fontWeight: 700, color: TEXT_STRONG,
            fontFamily: FONT_BODY, lineHeight: 1.2, marginBottom: 4,
          }}>{game.labelHe}</div>
          <div style={{
            fontSize: 15, fontWeight: 500, color: GOLD_MEDIUM,
            fontFamily: FONT_BODY, lineHeight: 1.4,
          }}>משחק המילים של Martita</div>
          <div style={{
            fontSize: 13, color: TEXT_MUTED,
            fontFamily: FONT_BODY, marginTop: 6,
          }}>בונים מילים ← מתקדמים בשלבים</div>
        </div>
      </div>

      {/* Play button row */}
      <div style={{
        position: 'relative', zIndex: 1,
        marginTop: 20,
        background: 'linear-gradient(135deg, rgba(201,168,76,0.15), rgba(201,168,76,0.08))',
        border: '1px solid rgba(201,168,76,0.22)',
        borderRadius: 14,
        padding: '14px 0',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      }}>
        <span style={{
          fontSize: 18, fontWeight: 700, color: GOLD_MEDIUM,
          fontFamily: FONT_BODY,
        }}>שחקי עכשיו</span>
        <span style={{
          fontSize: 14, color: GOLD_MUTED,
          transform: 'scaleX(-1)', display: 'inline-block',
        }}>▶</span>
      </div>
    </div>
  )
}

/* ─── Category Section ─── */
function CategorySection({ emoji, titleHe, subtitle, games, pressKey, onPress, onRelease, baseDelay }: {
  emoji: string
  titleHe: string
  subtitle: string
  games: Game[]
  pressKey: string | null
  onPress: (k: string) => void
  onRelease: () => void
  baseDelay: number
}) {
  return (
    <div style={{ marginBottom: 36 }}>
      {/* Category header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        marginBottom: 20, direction: 'rtl',
      }}>
        <div style={{
          flex: 1, height: 1,
          background: `linear-gradient(270deg, rgba(201,168,76,0.45), transparent)`,
          borderRadius: 1,
        }} />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 16px',
          background: 'rgba(255,250,240,0.03)',
          borderRadius: 20,
          border: '1px solid rgba(201,168,76,0.10)',
        }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>{emoji}</span>
          <div>
            <span style={{
              fontSize: 18, fontWeight: 700, color: GOLD_MEDIUM,
              fontFamily: FONT_BODY, letterSpacing: '0.3px',
            }}>{titleHe}</span>
            <span style={{
              fontSize: 12, color: TEXT_FAINT,
              fontFamily: FONT_BODY, marginRight: 8,
            }}> · {subtitle}</span>
          </div>
        </div>
        <div style={{
          flex: 1, height: 1,
          background: `linear-gradient(90deg, rgba(201,168,76,0.45), transparent)`,
          borderRadius: 1,
        }} />
      </div>

      {/* Game grid */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {games.map((game, idx) => (
          <GameCard
            key={game.id}
            game={game}
            pressKey={pressKey}
            onPress={onPress}
            onRelease={onRelease}
            delay={baseDelay + idx * 0.04}
          />
        ))}
      </div>
    </div>
  )
}

/* ─── Greeting Banner ─── */
function GameHero() {
  return (
    <div style={{
      textAlign: 'center',
      direction: 'rtl',
      padding: '8px 0 20px',
      animation: 'fadeSlideUp 0.3s ease-out both',
    }}>
      <div style={{
        fontSize: 26, fontWeight: 700, color: TEXT_STRONG,
        fontFamily: FONT_BODY, lineHeight: 1.3,
        textShadow: '0 2px 8px rgba(0,0,0,0.35)',
      }}>
        בואי נשחק! 🎮
      </div>
      <div style={{
        fontSize: 15, color: TEXT_MUTED,
        fontFamily: FONT_BODY, marginTop: 4,
      }}>
        המשחקים האהובים של Martita
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
    if (!document.getElementById('abu-games-anim')) {
      const style = document.createElement('style')
      style.id = 'abu-games-anim'
      style.textContent = `
        .abu-games-scroll      { scrollbar-width: none; -ms-overflow-style: none; }
        .abu-games-scroll::-webkit-scrollbar { display: none; }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0s !important; }
        }
      `
      document.head.appendChild(style)
    }

    const onVis = () => { if (!document.hidden) isNavigating = false }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      document.getElementById('abu-games-anim')?.remove()
    }
  }, [])

  return (
    <PageShell scrollable className="abu-games-scroll">
      <ScreenHeader
        title="Abu Games"
        left={<BackButton />}
        right={<>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            border: `2px solid ${GOLD_BORDER_HOVER}`,
            boxShadow: `0 0 0 2px rgba(201,168,76,0.07), 0 2px 12px rgba(0,0,0,0.40)`,
            overflow: 'hidden', flexShrink: 0,
          }}>
            <img src={martitaPhoto} alt="Martita" loading="eager"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%', display: 'block' }}
              onError={handleMartitaImgError}
            />
          </div>
        </>}
      />

      <InfoButton
        title="Abu Games"
        lines={['Words of Wonders — המשחק הראשי!', 'בונים מילים מאותיות ומתקדמים בשלבים.', "ובנוסף: סוליטר, עכביש, מהג'ונג ועוד."]}
        howTo={['לחצי על WOW לשחק במשחק המילים', 'או בחרי משחק קלפים מהרשימה', 'המשחק נפתח בדפדפן', 'לחצי חזרה לחזור לתפריט']}
        position="top-left"
      />

      <div style={{
        position: 'relative', zIndex: 2,
        padding: '16px 16px',
        display: 'flex', flexDirection: 'column',
        paddingBottom: 'calc(40px + env(safe-area-inset-bottom, 0px))',
        background: 'radial-gradient(ellipse at 50% 3%, rgba(201,168,76,0.04) 0%, transparent 40%)',
      }}>
        <GameHero />

        <FeaturedGameCard
          game={WOW_GAME}
          pressKey={pressed}
          onPress={setPressed}
          onRelease={() => setPressed(null)}
        />

        <CategorySection
          emoji="🃏"
          titleHe="סוליטר"
          subtitle={`${SOLITAIRE_GAMES.length} משחקים`}
          games={SOLITAIRE_GAMES}
          pressKey={pressed}
          onPress={setPressed}
          onRelease={() => setPressed(null)}
          baseDelay={0.1}
        />

        <CategorySection
          emoji="🀄"
          titleHe="מהג'ונג"
          subtitle={`${MAHJONG_GAMES.length} משחקים`}
          games={MAHJONG_GAMES}
          pressKey={pressed}
          onPress={setPressed}
          onRelease={() => setPressed(null)}
          baseDelay={0.55}
        />
      </div>
    </PageShell>
  )
}

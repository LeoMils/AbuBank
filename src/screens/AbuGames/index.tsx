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
import { GOLD_BORDER, GOLD_BORDER_HOVER, TEXT_STRONG, TEXT_FAINT } from '../../design/colors'

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

/* ─── Game Card ─── */
function GameCard({ game, pressKey, onPress, onRelease, delay }: {
  game: Game
  pressKey: string | null
  onPress: (k: string) => void
  onRelease: () => void
  delay: number
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
        minHeight: 88,
        borderRadius: 16,
        position: 'relative',
        overflow: 'hidden',
        padding: '16px 14px 16px 16px',
        direction: 'rtl',
        ...GLASS_SURFACE,
        border: isP ? `1px solid ${GOLD_BORDER_HOVER}` : GLASS_SURFACE.border,
        borderRight: `4px solid ${game.accent}`,
        transform: isP ? 'scale(0.97)' : 'scale(1)',
        transition: 'transform 0.08s ease-out, border-color 0.08s, background 0.08s',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        animation: `fadeSlideUp 0.3s ease-out ${delay}s both`,
      } as React.CSSProperties}
    >
      <span style={{
        position: 'absolute', top: 14, left: 14,
        fontSize: 22, opacity: 0.55, lineHeight: 1, userSelect: 'none',
      }}>{game.emoji}</span>

      <div style={{
        fontSize: 17, fontWeight: 700, color: TEXT_STRONG,
        fontFamily: "'Heebo',sans-serif", lineHeight: 1.3,
      }}>{game.labelHe}</div>

      <div style={{
        fontSize: 13, fontWeight: 500, color: TEXT_FAINT,
        fontFamily: "'DM Sans',sans-serif", marginTop: 4,
      }}>{game.label}</div>
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
        height: 180,
        margin: '0 auto 24px',
        borderRadius: 20,
        background: 'rgba(255,250,240,0.08)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: isP
          ? `0 4px 24px rgba(201,168,76,0.20), inset 0 1px 0 rgba(255,250,240,0.06)`
          : '0 8px 32px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,250,240,0.06)',
        border: isP ? `1.5px solid ${GOLD_BORDER_HOVER}` : `1px solid rgba(201,168,76,0.22)`,
        borderTop: '3px solid #C9A84C',
        transform: isP ? 'scale(0.97)' : 'scale(1)',
        transition: 'transform 0.08s ease-out, border-color 0.08s',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        WebkitTapHighlightColor: 'transparent',
        animation: 'fadeSlideUp 0.3s ease-out both',
      } as React.CSSProperties}
    >
      <span style={{ fontSize: 36, lineHeight: 1 }}>{game.emoji}</span>
      <span style={{
        fontSize: 20, fontWeight: 700, color: TEXT_STRONG,
        fontFamily: "'Heebo',sans-serif", direction: 'rtl',
      }}>{game.labelHe}</span>
      <span style={{
        fontSize: 14, color: TEXT_FAINT,
        fontFamily: "'Heebo',sans-serif",
      }}>עולם הסוליטר</span>
    </div>
  )
}

/* ─── Category Section ─── */
function CategorySection({ emoji, titleHe, games, pressKey, onPress, onRelease, baseDelay }: {
  emoji: string
  titleHe: string
  games: Game[]
  pressKey: string | null
  onPress: (k: string) => void
  onRelease: () => void
  baseDelay: number
}) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 16, direction: 'rtl',
      }}>
        <div style={{
          flex: 1, height: 1.5,
          background: `linear-gradient(270deg, rgba(201,168,76,0.55), transparent)`,
          borderRadius: 1,
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 18 }}>{emoji}</span>
          <span style={{
            fontSize: 16, fontWeight: 700, color: 'rgba(201,168,76,0.75)',
            fontFamily: "'Heebo',sans-serif",
          }}>{titleHe}</span>
        </div>
        <div style={{
          flex: 1, height: 1.5,
          background: `linear-gradient(90deg, rgba(201,168,76,0.55), transparent)`,
          borderRadius: 1,
        }} />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '16px 12px',
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
        padding: '24px 16px',
        display: 'flex', flexDirection: 'column',
        paddingBottom: 'calc(40px + env(safe-area-inset-bottom, 0px))',
      }}>
        <FeaturedGameCard
          game={WOW_GAME}
          pressKey={pressed}
          onPress={setPressed}
          onRelease={() => setPressed(null)}
        />

        <CategorySection
          emoji="🃏"
          titleHe="סוליטר"
          games={SOLITAIRE_GAMES}
          pressKey={pressed}
          onPress={setPressed}
          onRelease={() => setPressed(null)}
          baseDelay={0.1}
        />

        <CategorySection
          emoji="🀄"
          titleHe="מהג'ונג"
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

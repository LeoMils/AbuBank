import { useEffect, useMemo, useState, useCallback } from 'react'
import { useAppStore } from '../../state/store'
import { Screen } from '../../state/types'
import { soundTap, soundGameTap, haptic } from '../../services/sounds'
import { AbuLogo } from '../../design/logos/AbuLogo'

// ═══════════════════════════════════════════════════════════════════════════════
// ABU GAMES — "Terrace" redesign (v40)
// A bright, airy, first-class 2026 games lobby matching the approved mockup:
// a sunlit terrace scene, a warm wooden podium, and three elegant glass cards —
// WOW Words · Solitaire · Mahjong. Solitaire and Mahjong open a dedicated
// category page (same scene) listing the top games of that family; every game
// opens and plays in the same tab. Design-locked in wowGame.test.ts.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Palette ──────────────────────────────────────────────────────────────────
const TEAL_DEEP = '#1C6E7C'
const TEAL = '#2A8FA0'
const PINK = '#E85C8A'
const GOLD = '#C9A84C'
const SLATE = '#5B6E77'
const WOOD_HI = '#E6C79A'
const WOOD = '#C79A63'
const WOOD_LO = '#9B6E3F'

// ─── Catalog ────────────────────────────────────────────────────────────────────
type Category = 'featured' | 'solitaire' | 'mahjong'
interface Game {
  id: string
  label: string        // Latin / source name (a11y context)
  labelHe: string      // Hebrew name shown on the tile
  url: string
  accent: string       // brand color for the tile chip
  category: Category
  emoji: string
}

const GAMES: Game[] = [
  { id: 'wow', label: 'Words of Wonders', labelHe: 'אבו וואו', url: 'https://www.crazygames.com/game/words-of-wonders', accent: '#2A8FA0', category: 'featured', emoji: '🔤' },

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

// ─── Same-tab navigation (guarded), identical rule to Home/services ───────────
let isNavigating = false
let navTimer: ReturnType<typeof setTimeout> | null = null
function openGame(url: string): void {
  if (isNavigating) return
  isNavigating = true
  if (navTimer) clearTimeout(navTimer)
  navTimer = setTimeout(() => { isNavigating = false }, 800)
  soundGameTap()
  window.location.href = url
}

// ═══ Animation + reduced-motion ════════════════════════════════════════════════
const CSS = `
  @keyframes ag-rise { from { opacity:0; transform:translateY(22px) scale(.96) } to { opacity:1; transform:translateY(0) scale(1) } }
  @keyframes ag-fade { from { opacity:0 } to { opacity:1 } }
  @keyframes ag-float { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-7px) } }
  @keyframes ag-sheen { 0% { transform:translateX(-140%) rotate(18deg) } 60%,100% { transform:translateX(240%) rotate(18deg) } }
  @keyframes ag-sway { 0%,100% { transform:rotate(-2.5deg) } 50% { transform:rotate(2.5deg) } }
  @keyframes ag-sun { 0%,100% { opacity:.75 } 50% { opacity:1 } }
  .ag-root::-webkit-scrollbar { width:0; height:0 }
  .ag-root { scrollbar-width:none }
  .ag-card { transition: transform .22s cubic-bezier(.22,1,.36,1), box-shadow .22s ease }
  .ag-card:active { transform: scale(.955) translateY(2px) }
  .ag-card:focus-visible { outline:3px solid ${TEAL}; outline-offset:4px }
  .ag-tile { transition: transform .18s cubic-bezier(.22,1,.36,1), box-shadow .18s ease }
  .ag-tile:active { transform: scale(.95) }
  .ag-tile:focus-visible { outline:3px solid ${TEAL}; outline-offset:3px }
  .ag-back:focus-visible { outline:3px solid ${TEAL}; outline-offset:3px }
  @media (prefers-reduced-motion: reduce) {
    [data-ag] { animation:none !important }
    .ag-float { animation:none !important }
    .ag-sheen { display:none !important }
  }
`

// ═══ Scene background — sunlit terrace (sky · light · horizon · florals · podium) ═
function FloralCluster({ side }: { side: 'left' | 'right' }) {
  const flip = side === 'right'
  return (
    <div aria-hidden data-ag style={{
      position: 'absolute', bottom: -6, [side]: -10, width: 190, height: 200,
      transform: flip ? 'scaleX(-1)' : 'none', transformOrigin: 'bottom center',
      pointerEvents: 'none', zIndex: 2,
      animation: 'ag-fade .9s .1s both',
    }}>
      <div style={{ position: 'absolute', inset: 0, transformOrigin: '50% 90%', animation: 'ag-sway 7s ease-in-out infinite' }}>
        <svg viewBox="0 0 190 200" width="190" height="200" fill="none">
          {/* stems + leaves */}
          <path d="M40 200 C30 150 34 110 60 84" stroke="#5E9A5B" strokeWidth="5" strokeLinecap="round" />
          <path d="M70 200 C78 158 96 132 120 118" stroke="#4E8C55" strokeWidth="5" strokeLinecap="round" />
          <path d="M20 200 C18 168 26 150 44 138" stroke="#6BA968" strokeWidth="4" strokeLinecap="round" />
          {([[52, 130, 26], [96, 150, 22], [30, 158, 20]] as Array<[number, number, number]>).map(([x, y, r], i) => (
            <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.5} fill="#5FA05C" opacity="0.9" transform={`rotate(${-30 + i * 22} ${x} ${y})`} />
          ))}
          {/* blossoms */}
          {[[60, 82, 1, '#F6A8C4', '#EC6E9C'], [122, 116, .82, '#FBC4D6', '#F48FB1'], [44, 138, .62, '#F19BB8', '#E8739E']].map(([cx, cy, s, p1, p2], i) => (
            <g key={i} transform={`translate(${cx} ${cy}) scale(${s})`}>
              {[0, 72, 144, 216, 288].map(a => (
                <ellipse key={a} cx="0" cy="-17" rx="11" ry="17" fill={p1 as string}
                  transform={`rotate(${a})`} />
              ))}
              {[36, 108, 180, 252, 324].map(a => (
                <ellipse key={a} cx="0" cy="-15" rx="8" ry="14" fill={p2 as string} opacity="0.85"
                  transform={`rotate(${a})`} />
              ))}
              <circle cx="0" cy="0" r="7" fill={GOLD} />
              <circle cx="0" cy="0" r="3.4" fill="#8A6A22" />
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}

function Scene({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative', minHeight: '100dvh', width: '100%', overflow: 'hidden' }}>
      {/* Sky → warm terrace wash */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: 'linear-gradient(180deg, #9FCDEA 0%, #C4E2F0 26%, #E4F1F1 54%, #F2E8D6 80%, #EAD9BE 100%)',
      }} />
      {/* Warm sun bloom, top-right */}
      <div aria-hidden data-ag style={{
        position: 'absolute', top: '-14%', right: '-10%', width: '75%', height: 420, zIndex: 1,
        background: 'radial-gradient(circle at 70% 30%, rgba(255,246,214,0.95) 0%, rgba(255,232,180,0.5) 30%, transparent 62%)',
        filter: 'blur(2px)', animation: 'ag-sun 8s ease-in-out infinite', pointerEvents: 'none',
      }} />
      {/* Soft cloud puffs */}
      <div aria-hidden style={{
        position: 'absolute', top: '9%', left: '-6%', width: '70%', height: 150, zIndex: 1, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 30% 50%, rgba(255,255,255,0.85) 0%, transparent 60%), radial-gradient(ellipse at 60% 40%, rgba(255,255,255,0.7) 0%, transparent 55%)',
      }} />
      {/* Distant city / sea horizon — faint, premium, not busy */}
      <svg aria-hidden viewBox="0 0 412 120" preserveAspectRatio="none" style={{
        position: 'absolute', top: '40%', left: 0, width: '100%', height: 120, zIndex: 1, opacity: 0.16, pointerEvents: 'none',
      }}>
        <g fill="#3E6E86">
          {[18, 44, 70, 300, 330, 360, 388].map((x, i) => (
            <rect key={i} x={x} y={40 - (i % 3) * 16} width="18" height={80 + (i % 3) * 16} rx="2" />
          ))}
          <rect x="96" y="64" width="10" height="56" rx="2" />
          <rect x="278" y="58" width="12" height="62" rx="2" />
        </g>
        <rect x="0" y="104" width="412" height="16" fill="#78A9C4" opacity="0.6" />
      </svg>

      {/* Wooden podium */}
      <div aria-hidden data-ag style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 200, zIndex: 1, animation: 'ag-fade .8s both' }}>
        {/* platform top ellipse */}
        <div style={{
          position: 'absolute', left: '50%', bottom: 92, transform: 'translateX(-50%)',
          width: '108%', height: 120, borderRadius: '50%',
          background: `radial-gradient(ellipse at 50% 30%, ${WOOD_HI} 0%, ${WOOD} 48%, ${WOOD_LO} 100%)`,
          boxShadow: '0 -2px 0 rgba(255,255,255,0.35) inset, 0 30px 60px rgba(120,80,40,0.35)',
        }} />
        {/* platform rim / body */}
        <div style={{
          position: 'absolute', left: '50%', bottom: 44, transform: 'translateX(-50%)',
          width: '96%', height: 66, borderRadius: '0 0 40% 40% / 0 0 100% 100%',
          background: `linear-gradient(180deg, ${WOOD_LO} 0%, #7C5630 100%)`,
          boxShadow: '0 24px 40px rgba(90,60,30,0.4)',
        }} />
        {/* wood grain sheen */}
        <div style={{
          position: 'absolute', left: '50%', bottom: 96, transform: 'translateX(-50%)',
          width: '90%', height: 90, borderRadius: '50%',
          background: 'radial-gradient(ellipse at 40% 20%, rgba(255,255,255,0.28) 0%, transparent 45%)',
          pointerEvents: 'none',
        }} />
      </div>

      <FloralCluster side="left" />
      <FloralCluster side="right" />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 3, minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}

// ═══ Brand header ═══════════════════════════════════════════════════════════════
function BrandHeader({ subtitle }: { subtitle: string }) {
  return (
    <header style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 20px 0', textAlign: 'center' }}>
      {/* Shared Abu-family emblem (M4 logo system) — the one badge every app carries,
          so this bright terrace still reads as part of one product. The dark emblem
          disc + games accent reads as a crest above the wordmark; the terrace scene,
          palette and locked layout are untouched. */}
      <AbuLogo app="games" size={46} style={{ marginBottom: 4, filter: 'drop-shadow(0 4px 10px rgba(40,70,80,0.28))', animation: 'ag-rise .6s both' }} />
      <h1 data-ag style={{
        margin: 0, direction: 'ltr', fontFamily: "'Cormorant Garamond',Georgia,serif",
        fontWeight: 700, fontSize: 52, lineHeight: 1.02, letterSpacing: '-0.01em',
        background: `linear-gradient(180deg, ${TEAL} 0%, ${TEAL_DEEP} 100%)`,
        WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
        filter: 'drop-shadow(0 2px 10px rgba(28,110,124,0.22))',
        animation: 'ag-rise .6s .02s cubic-bezier(.22,1,.36,1) both', opacity: 0,
      }}>AbuGames</h1>

      <div data-ag style={{
        direction: 'ltr', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8,
        animation: 'ag-rise .6s .1s cubic-bezier(.22,1,.36,1) both', opacity: 0,
      }}>
        <span style={{
          fontFamily: "'Dancing Script','Snell Roundhand','Segoe Script',cursive",
          fontWeight: 700, fontSize: 34, color: PINK, lineHeight: 1,
          filter: 'drop-shadow(0 2px 6px rgba(232,92,138,0.28))',
        }}>Martita,</span>
        <svg width="26" height="24" viewBox="0 0 26 24" aria-hidden style={{ filter: 'drop-shadow(0 2px 4px rgba(232,92,138,0.3))' }}>
          <path d="M13 22C13 22 2 15 2 8.2 2 4.8 4.7 2.5 7.7 2.5c2 0 3.8 1.1 5.3 3 1.5-1.9 3.3-3 5.3-3C21.3 2.5 24 4.8 24 8.2 24 15 13 22 13 22z"
            fill="none" stroke={PINK} strokeWidth="2.2" strokeLinejoin="round" />
        </svg>
      </div>

      <div data-ag dir="rtl" style={{
        marginTop: 8, display: 'flex', alignItems: 'center', gap: 10,
        fontFamily: "'Heebo',sans-serif", fontSize: 17, fontWeight: 500, color: SLATE,
        animation: 'ag-rise .6s .18s cubic-bezier(.22,1,.36,1) both', opacity: 0,
      }}>
        <span style={{ color: GOLD, opacity: 0.7 }}>❧</span>
        {subtitle}
        <span style={{ color: GOLD, opacity: 0.7, transform: 'scaleX(-1)' }}>❧</span>
      </div>
    </header>
  )
}

// ═══ Landing marks (the three hero icons) ═══════════════════════════════════════
function WowMark() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ display: 'flex', gap: 5, color: GOLD, fontSize: 15, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))' }}>
        <span style={{ transform: 'translateY(2px)' }}>★</span><span style={{ transform: 'translateY(-2px)' }}>★</span><span style={{ transform: 'translateY(2px)' }}>★</span>
      </div>
      <div style={{
        direction: 'ltr', fontFamily: "'DM Sans',sans-serif", fontWeight: 800, fontSize: 34, letterSpacing: '0.02em',
        background: 'linear-gradient(180deg, #FBEFC5 0%, #E9C86E 45%, #C9A343 100%)',
        WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
        filter: 'drop-shadow(0 2px 1px rgba(120,84,20,0.55))',
      }}>WOW</div>
      <div style={{
        direction: 'ltr', padding: '2px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.9)',
        color: TEAL_DEEP, fontWeight: 800, fontSize: 12, letterSpacing: '0.14em',
        fontFamily: "'DM Sans',sans-serif", boxShadow: '0 2px 6px rgba(0,0,0,0.14)',
      }}>WORDS</div>
    </div>
  )
}

function PlayingCard({ rank, suit, red, rotate, dx }: { rank: string; suit: string; red: boolean; rotate: number; dx: number }) {
  return (
    <div style={{
      position: 'absolute', left: `calc(50% + ${dx}px)`, top: '50%',
      transform: `translate(-50%,-50%) rotate(${rotate}deg)`,
      width: 42, height: 58, borderRadius: 7, background: 'linear-gradient(160deg,#ffffff,#eef3f7)',
      boxShadow: '0 6px 12px rgba(30,50,70,0.28)', border: '1px solid rgba(0,0,0,0.06)',
      color: red ? '#D6335A' : '#25303B', fontFamily: "'DM Sans',serif", fontWeight: 700,
    }}>
      <span style={{ position: 'absolute', top: 3, left: 5, fontSize: 13, lineHeight: 1 }}>{rank}</span>
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{suit}</span>
    </div>
  )
}
function SolitaireMark() {
  return (
    <div style={{ position: 'relative', width: 108, height: 70 }}>
      <PlayingCard rank="A" suit="♦" red rotate={-16} dx={-26} />
      <PlayingCard rank="A" suit="♦" red rotate={-1} dx={0} />
      <PlayingCard rank="A" suit="♠" red={false} rotate={15} dx={26} />
    </div>
  )
}

function MahjongMark() {
  return (
    <div style={{
      position: 'relative', width: 60, height: 78, borderRadius: 12,
      background: 'linear-gradient(150deg,#FFFFFF 0%,#F1F4F2 60%,#E2E8E4 100%)',
      boxShadow: '0 8px 16px rgba(40,60,50,0.28), inset 0 2px 0 rgba(255,255,255,0.9), inset 0 -6px 10px rgba(120,140,130,0.25)',
      border: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{
        fontSize: 40, fontWeight: 700, color: '#C0392B', lineHeight: 1,
        textShadow: '0 1px 1px rgba(0,0,0,0.15)', fontFamily: "'Heebo',sans-serif",
      }}>發</span>
      <span aria-hidden style={{ position: 'absolute', bottom: 8, width: 16, height: 3, borderRadius: 2, background: '#3E8E5A' }} />
    </div>
  )
}

// ═══ Hero pill card (landing) ═══════════════════════════════════════════════════
interface PillProps {
  label: string
  tintA: string
  tintB: string
  mark: React.ReactNode
  onActivate: () => void
  ariaLabel: string
  index: number
  hero?: boolean
}
function PillCard({ label, tintA, tintB, mark, onActivate, ariaLabel, index, hero }: PillProps) {
  const h = hero ? 236 : 214
  return (
    <div
      role="button" tabIndex={0} aria-label={ariaLabel}
      className="ag-card btn-focus"
      onClick={onActivate}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate() } }}
      data-ag
      style={{
        position: 'relative', flex: 1, maxWidth: 132, height: h, borderRadius: 30,
        marginBottom: hero ? 14 : 0, cursor: 'pointer', overflow: 'hidden',
        WebkitTapHighlightColor: 'transparent',
        background: `linear-gradient(165deg, ${tintA} 0%, ${tintB} 100%)`,
        boxShadow: `0 18px 34px rgba(40,70,80,0.28), 0 4px 10px rgba(40,70,80,0.16), inset 0 2px 3px rgba(255,255,255,0.7), inset 0 -10px 22px rgba(0,0,0,0.10)`,
        border: '1px solid rgba(255,255,255,0.6)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
        animation: `ag-rise .6s ${(0.24 + index * 0.1).toFixed(2)}s cubic-bezier(.22,1,.36,1) both`,
        opacity: 0,
      }}
    >
      {/* moving specular sheen */}
      <span aria-hidden className="ag-sheen" style={{
        position: 'absolute', top: -30, left: 0, width: '55%', height: '170%',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)',
        animation: `ag-sheen ${5.5 + index}s ${1 + index * 0.4}s ease-in-out infinite`, pointerEvents: 'none',
      }} />
      <div className="ag-float" style={{ animation: `ag-float ${4 + index * 0.5}s ${index * 0.3}s ease-in-out infinite`, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 84 }}>
        {mark}
      </div>
      <span style={{
        direction: 'ltr', fontFamily: "'Cormorant Garamond',Georgia,serif", fontWeight: 700,
        fontSize: hero ? 23 : 21, color: '#ffffff', letterSpacing: '0.01em',
        textShadow: '0 2px 6px rgba(0,0,0,0.28)',
      }}>{label}</span>
    </div>
  )
}

// ═══ Category tile ═══════════════════════════════════════════════════════════════
function GameTile({ g, index }: { g: Game; index: number }) {
  return (
    <div
      role="button" tabIndex={0} aria-label={g.labelHe}
      className="ag-tile btn-focus"
      onClick={() => openGame(g.url)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openGame(g.url) } }}
      data-ag
      style={{
        position: 'relative', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
        borderRadius: 22, cursor: 'pointer', WebkitTapHighlightColor: 'transparent', overflow: 'hidden',
        background: 'linear-gradient(160deg, rgba(255,255,255,0.94) 0%, rgba(244,249,250,0.9) 100%)',
        border: '1px solid rgba(255,255,255,0.8)',
        boxShadow: '0 10px 22px rgba(40,70,80,0.16), inset 0 1px 2px rgba(255,255,255,0.9)',
        animation: `ag-rise .5s ${(0.06 + index * 0.05).toFixed(2)}s cubic-bezier(.22,1,.36,1) both`, opacity: 0,
      }}
    >
      <div aria-hidden style={{
        width: 54, height: 54, borderRadius: 16, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 27,
        background: `linear-gradient(150deg, ${g.accent}33 0%, ${g.accent}18 100%)`,
        boxShadow: `inset 0 0 0 1px ${g.accent}44, 0 4px 10px ${g.accent}22`,
      }}>{g.emoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div dir="rtl" style={{ fontFamily: "'Heebo',sans-serif", fontWeight: 700, fontSize: 18, color: '#20343B', lineHeight: 1.2 }}>{g.labelHe}</div>
        <div dir="ltr" style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 500, fontSize: 12, color: SLATE, marginTop: 2 }}>{g.label}</div>
      </div>
      <span aria-hidden style={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `linear-gradient(150deg, ${TEAL} 0%, ${TEAL_DEEP} 100%)`, color: '#fff', fontSize: 15,
        boxShadow: '0 4px 10px rgba(28,110,124,0.35)',
      }}>▸</span>
    </div>
  )
}

// ═══ Back control ════════════════════════════════════════════════════════════════
function BackChevron({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <button
      className="ag-back" aria-label={label} onClick={() => { soundTap(); onBack() }}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        height: 42, padding: '0 16px 0 12px', borderRadius: 999, cursor: 'pointer',
        background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.85)', boxShadow: '0 6px 16px rgba(40,70,80,0.16)',
        color: TEAL_DEEP, fontFamily: "'Heebo',sans-serif", fontWeight: 700, fontSize: 15,
      }}>
      <span style={{ fontSize: 18, lineHeight: 1 }}>›</span>
      {label}
    </button>
  )
}

// ═══ Category page ═══════════════════════════════════════════════════════════════
function CategoryPage({ title, subtitle, games, onBack }: { title: string; subtitle: string; games: Game[]; onBack: () => void }) {
  return (
    <Scene>
      <div className="ag-root" dir="rtl" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '16px 16px 0' }}>
          <BackChevron onBack={onBack} label="חזרה" />
        </div>
        <header style={{ textAlign: 'center', padding: '4px 20px 2px' }}>
          <h1 data-ag style={{
            margin: 0, direction: 'ltr', fontFamily: "'Cormorant Garamond',Georgia,serif", fontWeight: 700, fontSize: 42,
            background: `linear-gradient(180deg, ${TEAL} 0%, ${TEAL_DEEP} 100%)`,
            WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
            animation: 'ag-rise .5s .02s cubic-bezier(.22,1,.36,1) both', opacity: 0,
          }}>{title}</h1>
          <div data-ag style={{
            marginTop: 4, fontFamily: "'Heebo',sans-serif", fontSize: 15, fontWeight: 500, color: SLATE,
            animation: 'ag-rise .5s .1s cubic-bezier(.22,1,.36,1) both', opacity: 0,
          }}>{subtitle}</div>
        </header>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12,
          padding: '16px 16px 40px', alignContent: 'start',
        }}>
          {games.map((g, i) => <GameTile key={g.id} g={g} index={i} />)}
        </div>
      </div>
    </Scene>
  )
}

// ═══ Landing page ════════════════════════════════════════════════════════════════
function Landing({ onCategory, onWow }: { onCategory: (c: 'solitaire' | 'mahjong') => void; onWow: () => void }) {
  return (
    <Scene>
      <div dir="rtl" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
        <div style={{ padding: '52px 0 6px' }}>
          <BrandHeader subtitle="מה בא לך לשחק?" />
        </div>

        {/* Cards on the podium */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 18px 78px' }}>
          <div style={{ direction: 'ltr', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 12, width: '100%', maxWidth: 440 }}>
            <PillCard
              index={0} label="WOW Words" ariaLabel="WOW Words — אבו וואו"
              tintA="#3AA9BC" tintB="#1C6E7C" mark={<WowMark />} onActivate={onWow}
            />
            <PillCard
              index={1} hero label="Solitaire" ariaLabel="Solitaire — סוליטר"
              tintA="#5FB4D6" tintB="#2E7FA8" mark={<SolitaireMark />} onActivate={() => onCategory('solitaire')}
            />
            <PillCard
              index={2} label="Mahjong" ariaLabel="Mahjong — מהג'ונג"
              tintA="#E7A6B4" tintB="#B15C74" mark={<MahjongMark />} onActivate={() => onCategory('mahjong')}
            />
          </div>
        </div>
      </div>
    </Scene>
  )
}

// ═══ Screen ══════════════════════════════════════════════════════════════════════
type View = 'home' | 'solitaire' | 'mahjong'

export function AbuGames() {
  const setScreen = useAppStore(s => s.setScreen)
  const [view, setView] = useState<View>('home')

  const solitaire = useMemo(() => GAMES.filter(g => g.category === 'solitaire'), [])
  const mahjong = useMemo(() => GAMES.filter(g => g.category === 'mahjong'), [])
  const wow = useMemo(() => GAMES.find(g => g.category === 'featured')!, [])

  useEffect(() => {
    const onVis = () => { if (!document.hidden) isNavigating = false }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const goHomeScreen = useCallback(() => { soundTap(); setScreen(Screen.Home) }, [setScreen])
  const backToLobby = useCallback(() => setView('home'), [])

  return (
    <>
      <style>{CSS}</style>
      {view === 'home' && (
        <div style={{ position: 'relative', minHeight: '100dvh' }}>
          {/* Home (app) back, floating on the scene */}
          <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 5 }}>
            <BackChevron onBack={goHomeScreen} label="לאבו בנק" />
          </div>
          <Landing
            onWow={() => openGame(wow.url)}
            onCategory={(c) => { soundTap(); haptic(); setView(c) }}
          />
        </div>
      )}
      {view === 'solitaire' && (
        <CategoryPage title="Solitaire" subtitle="המשחקים המובילים · בחרי משחק" games={solitaire} onBack={backToLobby} />
      )}
      {view === 'mahjong' && (
        <CategoryPage title="Mahjong" subtitle="המשחקים המובילים · בחרי משחק" games={mahjong} onBack={backToLobby} />
      )}
    </>
  )
}

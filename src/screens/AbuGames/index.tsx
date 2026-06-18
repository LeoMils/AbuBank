import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../../state/store'
import { BackButton } from '../../components/BackButton'
import { getRandomMartitaPhoto, handleMartitaImgError } from '../../services/martitaPhotos'
import { soundTap } from '../../services/sounds'

// ═══════════════════════════════════════════════════════════════════════════════
// MARTITA'S GAMES CARNIVAL — 2026 Premium Game App
// Apple Arcade × PlayStation Store level visual design
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GAMES DATA ──────────────────────────────────────────────────────────────

interface Game {
  id: string
  label: string
  labelHe: string
  url: string
  accent: string
  accentBg: string
  gradient: string
  category: 'featured' | 'solitaire' | 'mahjong'
  emoji: string
  desc?: string
  mood?: string
}

const GAMES: Game[] = [
  { id: 'wow', label: 'Abu WOW', labelHe: 'אבו וואו', url: 'https://www.crazygames.com/game/words-of-wonders', accent: '#FFD666', accentBg: '#FFF3D0', gradient: 'linear-gradient(135deg, #FF6B35, #FF8F5E, #FFB347, #FFD666)', category: 'featured', emoji: '🔤', desc: 'בונים מילים ← מתקדמים בשלבים', mood: 'חידת המילים של Martita' },

  { id: 'klondike', label: 'Clásico', labelHe: 'סוליטר קלאסי', accent: '#34D399', accentBg: '#D1FAE5', gradient: 'linear-gradient(135deg, #059669, #34D399)', category: 'solitaire', emoji: '🃏', url: 'https://www.arkadium.com/games/klondike-solitaire/', mood: 'הקלאסיקה' },
  { id: 'spider', label: 'Spider', labelHe: 'עכביש', accent: '#A78BFA', accentBg: '#EDE9FE', gradient: 'linear-gradient(135deg, #7C3AED, #A78BFA)', category: 'solitaire', emoji: '🕷️', url: 'https://www.arkadium.com/games/spider-solitaire/', mood: 'אסטרטגיה' },
  { id: 'freecell', label: 'FreeCell', labelHe: 'פריסל', accent: '#60A5FA', accentBg: '#DBEAFE', gradient: 'linear-gradient(135deg, #2563EB, #60A5FA)', category: 'solitaire', emoji: '💎', url: 'https://www.arkadium.com/games/freecell/', mood: 'כל משחק פתיר!' },
  { id: 'pyramid', label: 'Pirámide', labelHe: 'פירמידה', accent: '#FBBF24', accentBg: '#FEF3C7', gradient: 'linear-gradient(135deg, #D97706, #FBBF24)', category: 'solitaire', emoji: '🔺', url: 'https://games.aarp.org/games/pyramid-solitaire', mood: 'חשבון מהנה' },
  { id: 'tripeaks', label: 'Tri Peaks', labelHe: 'שלוש פסגות', accent: '#2DD4BF', accentBg: '#CCFBF1', gradient: 'linear-gradient(135deg, #0D9488, #2DD4BF)', category: 'solitaire', emoji: '⛰️', url: 'https://www.arkadium.com/games/tripeaks-solitaire-free/', mood: 'מהיר ומשמח' },
  { id: 'hearts', label: 'Corazones', labelHe: 'לבבות', accent: '#FB7185', accentBg: '#FFE4E6', gradient: 'linear-gradient(135deg, #E11D48, #FB7185)', category: 'solitaire', emoji: '❤️', url: 'https://cardgames.io/hearts/', mood: 'משחק חברתי' },
  { id: 'canfield', label: 'Canfield', labelHe: 'קאנפילד', accent: '#22D3EE', accentBg: '#CFFAFE', gradient: 'linear-gradient(135deg, #0891B2, #22D3EE)', category: 'solitaire', emoji: '🎴', url: 'https://solitaired.com/canfield', mood: 'אתגר גבוה' },
  { id: 'golf', label: 'Golf', labelHe: 'גולף', accent: '#4ADE80', accentBg: '#DCFCE7', gradient: 'linear-gradient(135deg, #16A34A, #4ADE80)', category: 'solitaire', emoji: '⛳', url: 'https://www.solitaire-play.com/golf/', mood: 'פשוט ומרגיע' },
  { id: 'yukon', label: 'Yukon', labelHe: 'יוקון', accent: '#38BDF8', accentBg: '#E0F2FE', gradient: 'linear-gradient(135deg, #0284C7, #38BDF8)', category: 'solitaire', emoji: '🌊', url: 'https://solitaired.com/yukon', mood: 'טוויסט מפתיע' },
  { id: 'spider2', label: 'Spider ×2', labelHe: 'עכביש ×2', accent: '#FB923C', accentBg: '#FED7AA', gradient: 'linear-gradient(135deg, #EA580C, #FB923C)', category: 'solitaire', emoji: '🕸️', url: 'https://www.arkadium.com/games/spider-solitaire-2-suits/', mood: 'למנוסות' },
  { id: 'forty', label: '40 Ladrones', labelHe: '40 ליסטים', accent: '#C084FC', accentBg: '#F3E8FF', gradient: 'linear-gradient(135deg, #9333EA, #C084FC)', category: 'solitaire', emoji: '⚔️', url: 'https://solitaired.com/forty-thieves', mood: 'לאמיצות!' },

  { id: 'mahjong', label: 'Clásico', labelHe: "מהג'ונג קלאסי", accent: '#F87171', accentBg: '#FEE2E2', gradient: 'linear-gradient(135deg, #DC2626, #F87171)', category: 'mahjong', emoji: '🀄', url: 'https://www.arkadium.com/games/mahjongg-solitaire/', mood: 'שלווה קלאסית' },
  { id: 'mahjong-connect', label: 'Connect', labelHe: 'חיבור', accent: '#FB923C', accentBg: '#FFEDD5', gradient: 'linear-gradient(135deg, #EA580C, #FB923C)', category: 'mahjong', emoji: '🔗', url: 'https://www.arkadium.com/games/mahjong-connect/', mood: 'מצאי זוגות' },
  { id: 'mahjong-3d', label: 'Dimensiones', labelHe: 'תלת-מימד', accent: '#A78BFA', accentBg: '#EDE9FE', gradient: 'linear-gradient(135deg, #7C3AED, #A78BFA)', category: 'mahjong', emoji: '🧊', url: 'https://www.arkadium.com/games/mahjongg-dimensions/', mood: 'אריחים מסתובבים!' },
  { id: 'mahjong-candy', label: 'Candy', labelHe: 'ממתקים', accent: '#F472B6', accentBg: '#FCE7F3', gradient: 'linear-gradient(135deg, #DB2777, #F472B6)', category: 'mahjong', emoji: '🍬', url: 'https://www.arkadium.com/games/mahjongg-candy/', mood: 'צבעוני ומתוק' },
  { id: 'mahjong-dark', label: 'Dark', labelHe: "מהג'ונג לילה", accent: '#818CF8', accentBg: '#E0E7FF', gradient: 'linear-gradient(135deg, #4F46E5, #818CF8)', category: 'mahjong', emoji: '🌙', url: 'https://www.mahjong.com/games/dark-mahjong/', mood: 'שקט מסתורי' },
  { id: 'mahjong-garden', label: 'Garden', labelHe: 'גן פורח', accent: '#4ADE80', accentBg: '#DCFCE7', gradient: 'linear-gradient(135deg, #16A34A, #4ADE80)', category: 'mahjong', emoji: '🌸', url: 'https://www.arkadium.com/games/garden-tales/', mood: 'טבע ושלווה' },
]

// ─── NAVIGATION ──────────────────────────────────────────────────────────────

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

// ─── UTILS ───────────────────────────────────────────────────────────────────

function getTimeGreeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'לילה טוב'
  if (h < 12) return 'בוקר טוב'
  if (h < 17) return 'צהריים טובים'
  if (h < 21) return 'ערב טוב'
  return 'לילה טוב'
}

function getTimeEmoji(): string {
  const h = new Date().getHours()
  if (h < 5) return '🌙'
  if (h < 12) return '☀️'
  if (h < 17) return '🌤️'
  if (h < 21) return '🌅'
  return '🌙'
}

// ─── PREMIUM CSS ENGINE ──────────────────────────────────────────────────────

const CSS = `
  /* ── Entrance animations ── */
  @keyframes cg-up { from { opacity:0; transform:translateY(28px) scale(.96) } to { opacity:1; transform:translateY(0) scale(1) } }
  @keyframes cg-pop { from { opacity:0; transform:scale(.7) } 50% { transform:scale(1.08) } to { opacity:1; transform:scale(1) } }
  @keyframes cg-slideR { from { opacity:0; transform:translateX(40px) } to { opacity:1; transform:translateX(0) } }

  /* ── Living animations ── */
  @keyframes cg-float { 0%,100%{transform:translateY(0) rotate(0deg)} 33%{transform:translateY(-12px) rotate(4deg)} 66%{transform:translateY(-5px) rotate(-3deg)} }
  @keyframes cg-glow { 0%,100%{box-shadow:0 0 30px var(--glow,rgba(255,214,102,.12)), 0 12px 40px rgba(0,0,0,.15)} 50%{box-shadow:0 0 70px var(--glow,rgba(255,214,102,.28)), 0 16px 50px rgba(0,0,0,.20)} }
  @keyframes cg-shimmer { 0%{left:-100%} 100%{left:200%} }
  @keyframes cg-shine { 0%{background-position:200% 50%} 100%{background-position:-200% 50%} }
  @keyframes cg-breathe { 0%,100%{opacity:.4;transform:scale(1)} 50%{opacity:.7;transform:scale(1.04)} }
  @keyframes cg-heroEmoji { 0%,100%{transform:scale(1) rotate(0)} 20%{transform:scale(1.1) rotate(-6deg)} 40%{transform:scale(1.15) rotate(4deg)} 60%{transform:scale(1.08) rotate(-3deg)} 80%{transform:scale(1.04) rotate(1deg)} }
  @keyframes cg-rainbow { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
  @keyframes cg-photoRing { 0%,100%{border-color:rgba(255,214,102,.7);box-shadow:0 0 24px rgba(255,214,102,.25)} 33%{border-color:rgba(255,143,171,.7);box-shadow:0 0 24px rgba(255,143,171,.25)} 66%{border-color:rgba(167,139,250,.7);box-shadow:0 0 24px rgba(167,139,250,.25)} }
  @keyframes cg-confetti { 0%{transform:translateY(0) rotate(0deg) scale(1);opacity:.6} 50%{opacity:1;transform:translateY(-15px) rotate(180deg) scale(1.2)} 100%{transform:translateY(25px) rotate(360deg) scale(.8);opacity:0} }
  @keyframes cg-orb { 0%,100%{transform:translate(-50%,-50%) scale(1);opacity:.5} 50%{transform:translate(-50%,-50%) scale(1.15);opacity:.8} }
  @keyframes cg-badgeBounce { 0%{transform:scale(0) rotate(-20deg)} 60%{transform:scale(1.2) rotate(5deg)} 100%{transform:scale(1) rotate(0deg)} }
  @keyframes cg-ctaPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.015)} }

  /* ── Scrollbar ── */
  .cg-strip::-webkit-scrollbar{display:none}
  .cg-strip{scrollbar-width:none;-ms-overflow-style:none}

  /* ── Cards — 3D spring hover ── */
  .cg-card{
    transition: transform .28s cubic-bezier(.34,1.56,.64,1), box-shadow .3s ease, border-color .25s ease;
    will-change: transform;
  }
  .cg-card:hover{
    transform:translateY(-8px) scale(1.05) !important;
    box-shadow:0 16px 32px rgba(0,0,0,.25), 0 0 0 2px var(--accent,#FFD666), 0 0 30px var(--accent-glow,rgba(255,214,102,.15)) !important;
    border-color:transparent !important;
    z-index:2;
  }
  .cg-card:active{transform:scale(.94) !important}

  /* ── Hero card ── */
  .cg-hero{transition:transform .3s cubic-bezier(.34,1.56,.64,1), box-shadow .35s ease}
  .cg-hero:hover{transform:translateY(-4px) scale(1.01);box-shadow:0 20px 60px rgba(255,107,53,.20), 0 0 80px rgba(255,214,102,.12) !important}
  .cg-hero:active{transform:scale(.98)}

  /* ── Reduced motion ── */
  @media(prefers-reduced-motion:reduce){
    [data-cg]{animation:none !important}
    .cg-card,.cg-hero{transition:none !important}
  }
`

// ─── CONFETTI SYSTEM ─────────────────────────────────────────────────────────

const CONFETTI_COLORS = ['#FFD666','#FF8FAB','#A78BFA','#67E8F9','#4ADE80','#FB923C','#F472B6','#60A5FA']
const CONFETTI = Array.from({ length: 20 }, (_, i) => ({
  left: `${(i * 5.1 + (i % 3) * 8.7 + 2) % 96}%`,
  top: `${(i * 4.5 + (i % 5) * 6.2 + 3) % 88}%`,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
  size: 5 + (i % 5) * 2,
  delay: `${(i * 0.28).toFixed(1)}s`,
  duration: `${2.5 + (i % 4) * 1.2}s`,
  radius: i % 3 === 0 ? '50%' : i % 3 === 1 ? '2px' : '1px',
  rotation: i * 25,
}))

// ─── GAME CARD COMPONENT ────────────────────────────────────────────────────

function GameCard({ g, delay }: { g: Game; delay: number }) {
  return (
    <div
      role="button" tabIndex={0} aria-label={g.labelHe}
      onClick={() => handleTap(g.url)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTap(g.url) } }}
      className="cg-card"
      data-cg
      style={{
        '--accent': g.accent,
        '--accent-glow': `${g.accent}30`,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 6, padding: '16px 8px 14px',
        borderRadius: 22, minWidth: 118, width: 118, flexShrink: 0,
        /* 3D elevated surface */
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.10)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.06)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        position: 'relative', overflow: 'hidden',
        animation: `cg-slideR .4s ${delay}s cubic-bezier(.22,1,.36,1) both`,
        opacity: 0,
      } as React.CSSProperties}
    >
      {/* Top gradient accent stripe */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: g.gradient, borderRadius: '22px 22px 0 0',
      }} />

      {/* Emoji with gradient backdrop */}
      <div style={{
        width: 56, height: 56, borderRadius: 18,
        background: g.gradient,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 30, lineHeight: 1,
        boxShadow: `0 4px 16px ${g.accent}35, inset 0 -2px 4px rgba(0,0,0,0.15)`,
        position: 'relative',
      }}>
        <span style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.25))' }}>{g.emoji}</span>
      </div>

      <span style={{
        fontSize: 14, fontWeight: 800, color: '#fff',
        fontFamily: "'Heebo',sans-serif", textAlign: 'center', lineHeight: 1.2,
        marginTop: 2,
      }}>{g.labelHe}</span>

      <span style={{
        fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,.40)',
        fontFamily: "'Heebo',sans-serif", letterSpacing: '.02em',
      }}>{g.label}</span>

      {g.mood && (
        <span style={{
          fontSize: 10, fontWeight: 600, color: g.accent,
          fontFamily: "'Heebo',sans-serif", textAlign: 'center',
          lineHeight: 1.3, maxWidth: 100,
          opacity: 0.85,
        }}>{g.mood}</span>
      )}
    </div>
  )
}

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────

export function AbuGames() {
  const martitaPhoto = useMemo(() => getRandomMartitaPhoto(), [])
  const featured = GAMES.find(g => g.category === 'featured')!
  const solitaire = GAMES.filter(g => g.category === 'solitaire')
  const mahjong = GAMES.filter(g => g.category === 'mahjong')

  const dailyTips = [
    'המשחקים טובים לראש! סוליטר לריכוז, מילים לזיכרון 🧠',
    'כל יום משחק קטן שומר על הראש חד ושמח 🌟',
    'הרגע הזה שלך — תהני מכל שלב! 💛',
  ]
  const [tip] = useState<string>(() => dailyTips[Math.floor(Math.random() * dailyTips.length)] ?? dailyTips[0]!)

  useEffect(() => {
    const onVis = () => { if (!document.hidden) isNavigating = false }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  return (
    <>
      <style>{CSS}</style>

      <div style={{
        display: 'flex', flexDirection: 'column', minHeight: '100dvh',
        overflowY: 'auto', overflowX: 'hidden',
        direction: 'rtl',
        fontFamily: "'Heebo',sans-serif",
        /* Premium dark with warm undertone — NOT cold blue-black */
        background: '#110A1F',
      }}>

        {/* ══════════════════════════════════════════════════════════════════
            HERO — Immersive, layered, cinematic
            ══════════════════════════════════════════════════════════════════ */}
        <header style={{
          position: 'relative', minHeight: 400,
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          paddingBottom: 40,
        }}>

          {/* BG: Multi-layer gradient mesh */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(160deg, #2D1566 0%, #3B1F7E 15%, #1E1040 45%, #150B30 70%, #110A1F 100%)',
          }} />

          {/* Orb 1: warm gold */}
          <div data-cg style={{
            position: 'absolute', top: '10%', left: '20%', width: 250, height: 250,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,179,71,0.25) 0%, transparent 65%)',
            filter: 'blur(50px)',
            animation: 'cg-orb 8s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
          {/* Orb 2: pink */}
          <div data-cg style={{
            position: 'absolute', top: '30%', right: '10%', width: 200, height: 200,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,143,171,0.20) 0%, transparent 60%)',
            filter: 'blur(45px)',
            animation: 'cg-orb 10s 2s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
          {/* Orb 3: purple */}
          <div data-cg style={{
            position: 'absolute', bottom: '15%', left: '50%', width: 300, height: 200,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(167,139,250,0.15) 0%, transparent 55%)',
            filter: 'blur(55px)',
            animation: 'cg-orb 12s 4s ease-in-out infinite',
            pointerEvents: 'none',
          }} />

          {/* Confetti */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            {CONFETTI.map((c, i) => (
              <div key={i} data-cg style={{
                position: 'absolute', left: c.left, top: c.top,
                width: c.size, height: c.size,
                borderRadius: c.radius, background: c.color,
                transform: `rotate(${c.rotation}deg)`,
                animation: `cg-confetti ${c.duration} ${c.delay} ease-in-out infinite`,
              }} />
            ))}
          </div>

          {/* Floating emojis */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 1 }}>
            {['🎪','✨','🎯','🌟','🎲','💫','🎭','🏆'].map((e, i) => (
              <div key={i} data-cg style={{
                position: 'absolute',
                left: `${6 + i * 12}%`, top: `${8 + (i % 4) * 20}%`,
                fontSize: 18 + (i % 3) * 8,
                opacity: 0.12 + (i % 3) * 0.05,
                animation: `cg-float ${5 + i * 0.8}s ${i * 0.5}s ease-in-out infinite`,
                userSelect: 'none',
              }}>{e}</div>
            ))}
          </div>

          {/* Nav bar */}
          <div style={{
            position: 'relative', zIndex: 10, width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px 0',
          }}>
            <BackButton />
            <div style={{ width: 36 }} />
          </div>

          {/* ── Martita portrait — large, glowing, alive ── */}
          <div data-cg style={{
            position: 'relative', zIndex: 5, marginTop: 14,
            animation: 'cg-pop .6s .1s cubic-bezier(.22,1,.36,1) both',
            opacity: 0,
          } as React.CSSProperties}>
            {/* Glow ring behind photo */}
            <div data-cg style={{
              position: 'absolute', inset: -6, borderRadius: '50%',
              background: 'conic-gradient(from 0deg, #FFD666, #FF8FAB, #A78BFA, #67E8F9, #4ADE80, #FFD666)',
              animation: 'cg-breathe 3s ease-in-out infinite',
              filter: 'blur(12px)',
              opacity: 0.5,
            }} />
            <div data-cg style={{
              width: 108, height: 108, borderRadius: '50%',
              border: '4px solid rgba(255,214,102,0.7)',
              animation: 'cg-photoRing 6s ease-in-out infinite',
              overflow: 'hidden', position: 'relative',
              boxShadow: '0 0 24px rgba(255,214,102,0.25), 0 8px 30px rgba(0,0,0,0.35)',
            }}>
              <img
                src={martitaPhoto} alt="Martita" loading="eager"
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%', display: 'block' }}
                onError={handleMartitaImgError}
              />
            </div>
            {/* Crown */}
            <div data-cg style={{
              position: 'absolute', top: -12, right: -8,
              fontSize: 32,
              animation: 'cg-badgeBounce .5s .7s cubic-bezier(.22,1,.36,1) both',
              opacity: 0,
              filter: 'drop-shadow(0 3px 6px rgba(0,0,0,.35))',
            } as React.CSSProperties}>👑</div>
          </div>

          {/* ── Title block ── */}
          <div data-cg style={{
            position: 'relative', zIndex: 5, textAlign: 'center', marginTop: 16,
            animation: 'cg-up .55s .25s cubic-bezier(.22,1,.36,1) both',
            opacity: 0,
          } as React.CSSProperties}>
            <div style={{
              fontSize: 14, fontWeight: 700, color: 'rgba(255,214,102,.92)',
              letterSpacing: '.02em',
            }}>
              {getTimeGreeting()}, Martita {getTimeEmoji()}
            </div>
            <div style={{
              fontSize: 36, fontWeight: 900, lineHeight: 1.1, marginTop: 8,
              background: 'linear-gradient(135deg, #FFD666 0%, #FF8FAB 35%, #A78BFA 65%, #67E8F9 100%)',
              backgroundSize: '300% 300%',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              animation: 'cg-rainbow 8s ease-in-out infinite',
              filter: 'drop-shadow(0 2px 10px rgba(255,214,102,.25))',
            } as React.CSSProperties}>
              🎪 הקרנבל של Martita
            </div>
            <div style={{
              fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,.60)', marginTop: 8,
            }}>
              עולם המשחקים הכי שמח שיש ✨
            </div>
          </div>

          {/* Bottom fade */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
            background: 'linear-gradient(to bottom, transparent, #110A1F)',
            pointerEvents: 'none', zIndex: 2,
          }} />
        </header>

        {/* ══════════════════════════════════════════════════════════════════
            CONTENT
            ══════════════════════════════════════════════════════════════════ */}
        <main style={{
          position: 'relative', paddingBottom: 52,
          display: 'flex', flexDirection: 'column', gap: 32,
        }}>

          {/* ★★★ WOW HERO CARD ★★★ */}
          <div
            role="button" tabIndex={0}
            aria-label={`${featured.labelHe} — המשחק האהוב של Martita`}
            onClick={() => handleTap(featured.url)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTap(featured.url) } }}
            className="cg-hero"
            data-cg
            style={{
              '--glow': 'rgba(255,107,53,.18)',
              position: 'relative', margin: '0 16px',
              borderRadius: 28, overflow: 'hidden',
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
              animation: 'cg-up .55s .35s cubic-bezier(.22,1,.36,1) both, cg-glow 4s 2s ease-in-out infinite',
              opacity: 0,
              /* Deep rich card — layered gradient */
              background: 'linear-gradient(155deg, #3B1A6E 0%, #2D1566 25%, #421F80 50%, #2D1566 75%, #1E0E4A 100%)',
              border: '2px solid rgba(255,214,102,.30)',
              boxShadow: '0 12px 50px rgba(255,107,53,.12), 0 0 60px rgba(167,139,250,.06)',
              padding: '24px 20px 20px',
            } as React.CSSProperties}
          >
            {/* Mesh gradient overlay */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'radial-gradient(circle at 25% 15%, rgba(255,179,71,.18) 0%, transparent 40%), radial-gradient(circle at 85% 80%, rgba(255,143,171,.10) 0%, transparent 40%), radial-gradient(circle at 50% 50%, rgba(167,139,250,.06) 0%, transparent 50%)',
            }} />

            {/* Moving shine */}
            <div data-cg style={{
              position: 'absolute', top: 0, width: '35%', height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.08), transparent)',
              animation: 'cg-shimmer 4s 1.5s ease-in-out infinite',
              pointerEvents: 'none',
            }} />

            {/* Badge */}
            <div data-cg style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', borderRadius: 24,
              background: 'linear-gradient(135deg, rgba(255,214,102,.22), rgba(255,143,171,.12))',
              border: '1.5px solid rgba(255,214,102,.40)',
              backdropFilter: 'blur(12px)',
              fontSize: 13, fontWeight: 800, color: '#FFD666',
              animation: 'cg-badgeBounce .5s .8s cubic-bezier(.22,1,.36,1) both',
              opacity: 0,
            } as React.CSSProperties}>
              ⭐ האהוב של Martita
            </div>

            {/* Content */}
            <div style={{
              position: 'relative', zIndex: 1,
              display: 'flex', alignItems: 'center', gap: 16, marginTop: 16,
            }}>
              {/* Big emoji orb */}
              <div data-cg style={{
                width: 100, height: 100, borderRadius: 30, flexShrink: 0,
                background: featured.gradient,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 8px 32px rgba(255,107,53,.30), inset 0 -3px 6px rgba(0,0,0,.20), inset 0 2px 0 rgba(255,255,255,.15)',
                animation: 'cg-heroEmoji 5s ease-in-out infinite',
              }}>
                <span style={{ fontSize: 56, lineHeight: 1, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,.30))' }}>
                  {featured.emoji}
                </span>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 30, fontWeight: 900, color: '#fff', lineHeight: 1.1,
                  textShadow: '0 2px 12px rgba(0,0,0,.3)',
                }}>
                  {featured.labelHe}
                </div>
                <div style={{
                  fontSize: 15, fontWeight: 700, color: '#FFD666',
                  marginTop: 6, lineHeight: 1.3,
                }}>
                  {featured.mood}
                </div>
                {featured.desc && (
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,.50)', marginTop: 6, lineHeight: 1.5 }}>
                    {featured.desc}
                  </div>
                )}
              </div>
            </div>

            {/* CTA — vivid, solid, alive */}
            <div data-cg style={{
              position: 'relative', zIndex: 1, marginTop: 18, overflow: 'hidden',
              background: 'linear-gradient(135deg, #FF6B35, #FFB347, #FFD666)',
              borderRadius: 18, padding: '17px 0',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 6px 24px rgba(255,107,53,.35), inset 0 -2px 4px rgba(0,0,0,.10), inset 0 2px 0 rgba(255,255,255,.20)',
              animation: 'cg-ctaPulse 3s 3s ease-in-out infinite',
            }}>
              {/* Shine sweep */}
              <div data-cg style={{
                position: 'absolute', top: 0, width: '30%', height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.40), transparent)',
                animation: 'cg-shimmer 3.5s 2s ease-in-out infinite',
                pointerEvents: 'none',
              }} />
              <span style={{ fontSize: 20, fontWeight: 900, color: '#1E1040' }}>
                🎮 יאללה Martita, נשחק!
              </span>
            </div>
          </div>

          {/* ♠ SOLITAIRE PALACE ──────────────────────────────────────── */}
          <section>
            <div data-cg style={{
              padding: '0 20px 10px',
              animation: 'cg-up .4s .5s cubic-bezier(.22,1,.36,1) both', opacity: 0,
            } as React.CSSProperties}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 16,
                  background: 'linear-gradient(135deg, #059669, #34D399)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 26,
                  boxShadow: '0 4px 16px rgba(52,211,153,.25)',
                }}>🃏</div>
                <div>
                  <div style={{ fontSize: 21, fontWeight: 900, color: '#fff' }}>ארמון הסוליטר</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(110,231,183,.80)', marginTop: 2 }}>
                    {solitaire.length} קלפים · שקט ושמחה 🎴
                  </div>
                </div>
              </div>
            </div>
            <div className="cg-strip" style={{
              display: 'flex', gap: 12, overflowX: 'auto', padding: '6px 16px 12px',
            }}>
              {solitaire.map((g, i) => <GameCard key={g.id} g={g} delay={0.55 + i * 0.04} />)}
            </div>
          </section>

          {/* 🌸 MAHJONG GARDEN ──────────────────────────────────────── */}
          <section>
            <div data-cg style={{
              padding: '0 20px 10px',
              animation: 'cg-up .4s .75s cubic-bezier(.22,1,.36,1) both', opacity: 0,
            } as React.CSSProperties}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 16,
                  background: 'linear-gradient(135deg, #DB2777, #F472B6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 26,
                  boxShadow: '0 4px 16px rgba(244,114,182,.25)',
                }}>🌸</div>
                <div>
                  <div style={{ fontSize: 21, fontWeight: 900, color: '#fff' }}>גן המהג'ונג</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(249,168,212,.80)', marginTop: 2 }}>
                    {mahjong.length} אריחים · שלווה ויופי 🧘
                  </div>
                </div>
              </div>
            </div>
            <div className="cg-strip" style={{
              display: 'flex', gap: 12, overflowX: 'auto', padding: '6px 16px 12px',
            }}>
              {mahjong.map((g, i) => <GameCard key={g.id} g={g} delay={0.8 + i * 0.04} />)}
            </div>
          </section>

          {/* ☀ DAILY JOY ─────────────────────────────────────────────── */}
          <section data-cg style={{
            margin: '0 16px',
            animation: 'cg-up .4s .95s cubic-bezier(.22,1,.36,1) both', opacity: 0,
          } as React.CSSProperties}>
            <div style={{
              borderRadius: 24, overflow: 'hidden',
              background: 'linear-gradient(145deg, rgba(255,214,102,.10) 0%, rgba(255,143,171,.06) 50%, rgba(167,139,250,.04) 100%)',
              border: '1.5px solid rgba(255,214,102,.18)',
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              padding: '20px 20px 18px',
              boxShadow: '0 4px 24px rgba(0,0,0,.15)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 24 }}>{getTimeEmoji()}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#FFD666' }}>שמחה יומית</span>
              </div>
              <div style={{ fontSize: 16, lineHeight: 1.75, color: 'rgba(255,255,255,.82)', fontWeight: 500 }}>
                {tip}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', marginTop: 10 }}>
                כל משחק נפתח בדפדפן — לחצי חזרה לחזור לכאן 💜
              </div>
            </div>
          </section>

          {/* FOOTER ──────────────────────────────────────────────────── */}
          <footer data-cg style={{
            textAlign: 'center', padding: '4px 24px 0',
            animation: 'cg-up .4s 1.05s cubic-bezier(.22,1,.36,1) both', opacity: 0,
          } as React.CSSProperties}>
            <div style={{
              fontSize: 15, fontWeight: 800,
              background: 'linear-gradient(135deg, #FFD666, #FF8FAB, #A78BFA)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            } as React.CSSProperties}>
              Martita's Games Carnival 🎪
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginTop: 4 }}>
              נבנה באהבה, במיוחד בשבילך 💛
            </div>
          </footer>
        </main>
      </div>
    </>
  )
}

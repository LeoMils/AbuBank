import { useState, useEffect } from 'react'
import { useAppStore } from '../../state/store'
import { Screen } from '../../state/types'

/* ─── GAMES DATA ─── */
interface Game {
  id: string
  label: string
  url: string
  accent: string
  gradient: string
  category: string
}

const GAMES: Game[] = [
  {
    id: 'klondike', label: 'Solitario', accent: '#22c55e',
    url: 'https://www.google.com/search?q=solitaire',
    gradient: 'linear-gradient(135deg, #052e16 0%, #14532d 50%, #166534 100%)',
    category: 'קלפים 🃏',
  },
  {
    id: 'spider', label: 'Spider', accent: '#a78bfa',
    url: 'https://www.arkadium.com/games/spider-solitaire/',
    gradient: 'linear-gradient(135deg, #2e1065 0%, #4c1d95 50%, #5b21b6 100%)',
    category: 'קלפים 🃏',
  },
  {
    id: 'freecell', label: 'FreeCell', accent: '#3b82f6',
    url: 'https://www.arkadium.com/games/freecell/',
    gradient: 'linear-gradient(135deg, #172554 0%, #1e3a8a 50%, #1d4ed8 100%)',
    category: 'קלפים 🃏',
  },
  {
    id: 'mahjong', label: 'Mahjong', accent: '#ef4444',
    url: 'https://www.arkadium.com/games/mahjongg-solitaire/',
    gradient: 'linear-gradient(135deg, #450a0a 0%, #7f1d1d 50%, #991b1b 100%)',
    category: 'אריחים 🀄',
  },
  {
    id: 'pyramid', label: 'Pirámide', accent: '#f59e0b',
    url: 'https://games.aarp.org/games/pyramid-solitaire',
    gradient: 'linear-gradient(135deg, #451a03 0%, #78350f 50%, #92400e 100%)',
    category: 'קלפים 🃏',
  },
  {
    id: 'tripeaks', label: 'Tri Peaks', accent: '#14b8a6',
    url: 'https://www.arkadium.com/games/tripeaks-solitaire-free/',
    gradient: 'linear-gradient(135deg, #042f2e 0%, #134e4a 50%, #115e59 100%)',
    category: 'קלפים 🃏',
  },
  {
    id: 'hearts', label: 'Corazones', accent: '#f43f5e',
    url: 'https://cardgames.io/hearts/',
    gradient: 'linear-gradient(135deg, #4c0519 0%, #881337 50%, #be123c 100%)',
    category: 'קלפים ♥',
  },
  {
    id: 'canfield', label: 'Canfield', accent: '#06b6d4',
    url: 'https://solitaired.com/canfield',
    gradient: 'linear-gradient(135deg, #083344 0%, #155e75 50%, #0e7490 100%)',
    category: 'קלפים 🃏',
  },
  {
    id: 'golf', label: 'Golf', accent: '#16a34a',
    url: 'https://www.solitaire-play.com/golf/',
    gradient: 'linear-gradient(135deg, #052e16 0%, #14532d 50%, #15803d 100%)',
    category: 'קלפים 🃏',
  },
  {
    id: 'yukon', label: 'Yukon', accent: '#0ea5e9',
    url: 'https://solitaired.com/yukon',
    gradient: 'linear-gradient(135deg, #0c1445 0%, #1e3a8a 50%, #0369a1 100%)',
    category: 'קלפים 🃏',
  },
  {
    id: 'spider2', label: 'Spider ×2', accent: '#f97316',
    url: 'https://www.arkadium.com/games/spider-solitaire-2-suits/',
    gradient: 'linear-gradient(135deg, #431407 0%, #7c2d12 50%, #9a3412 100%)',
    category: 'קלפים 🃏',
  },
  {
    id: 'forty', label: '40 Ladrones', accent: '#818cf8',
    url: 'https://solitaired.com/forty-thieves',
    gradient: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #3730a3 100%)',
    category: 'קלפים 🃏',
  },
]

/* ─── Navigation guard ─── */
let isNavigating = false
let navTimer: ReturnType<typeof setTimeout> | null = null
function handleTap(url: string): void {
  if (isNavigating) return
  isNavigating = true
  if (navTimer) clearTimeout(navTimer)
  navTimer = setTimeout(() => { isNavigating = false }, 800)
  window.location.href = url
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  return `${parseInt(h.substring(0, 2), 16)},${parseInt(h.substring(2, 4), 16)},${parseInt(h.substring(4, 6), 16)}`
}

/* ─── GAME ORBS ─── */
const GAME_ORBS: Record<string, string> = {
  klondike: 'radial-gradient(circle at 36% 30%, rgba(230,255,242,0.98) 0%, #6ee7b7 20%, #10b981 46%, #065f46 74%, #022c22 100%)',
  spider:   'radial-gradient(circle at 36% 30%, rgba(242,238,255,0.98) 0%, #c4b5fd 20%, #7c3aed 46%, #3b0764 74%, #180033 100%)',
  freecell: 'radial-gradient(circle at 36% 30%, rgba(232,242,255,0.98) 0%, #93c5fd 20%, #2563eb 46%, #1e3a8a 74%, #0d1f52 100%)',
  mahjong:  'radial-gradient(circle at 36% 30%, rgba(255,235,235,0.98) 0%, #fca5a5 20%, #dc2626 46%, #7f1d1d 74%, #3d0505 100%)',
  pyramid:  'radial-gradient(circle at 36% 30%, rgba(255,252,225,0.98) 0%, #fde68a 20%, #d97706 46%, #78350f 74%, #3a1505 100%)',
  tripeaks: 'radial-gradient(circle at 36% 30%, rgba(224,255,252,0.98) 0%, #5eead4 20%, #0d9488 46%, #134e4a 74%, #021f1e 100%)',
  hearts:   'radial-gradient(circle at 36% 30%, rgba(255,232,238,0.98) 0%, #fda4af 20%, #e11d48 46%, #881337 74%, #3d0219 100%)',
  canfield: 'radial-gradient(circle at 36% 30%, rgba(224,252,255,0.98) 0%, #67e8f9 20%, #0891b2 46%, #155e75 74%, #042030 100%)',
  golf:     'radial-gradient(circle at 36% 30%, rgba(225,255,235,0.98) 0%, #86efac 20%, #16a34a 46%, #14532d 74%, #042210 100%)',
  yukon:    'radial-gradient(circle at 36% 30%, rgba(224,244,255,0.98) 0%, #7dd3fc 20%, #0284c7 46%, #0c4a6e 74%, #041828 100%)',
  spider2:  'radial-gradient(circle at 36% 30%, rgba(255,242,228,0.98) 0%, #fdba74 20%, #ea580c 46%, #7c2d12 74%, #340c02 100%)',
  forty:    'radial-gradient(circle at 36% 30%, rgba(238,235,255,0.98) 0%, #a5b4fc 20%, #4f46e5 46%, #312e81 74%, #12103a 100%)',
}

/* ─────────────────────────────────────────────────────────────
   GAME ICONS — S=52
───────────────────────────────────────────────────────────── */
function GameIcon({ id, accent }: { id: string; accent: string }) {
  const S = 52

  switch (id) {

    /* ── Klondike / Solitario ── green felt + Ace of Spades ── */
    case 'klondike':
      return (
        <svg viewBox="0 0 48 48" width={S} height={S}>
          <ellipse cx="24" cy="26" rx="19" ry="13" fill="#16a34a" opacity="0.90"/>
          <ellipse cx="24" cy="26" rx="19" ry="13" fill="none" stroke="#15803d" strokeWidth="1"/>
          <rect x="10" y="8" width="17" height="23" rx="2.5" fill="#166534" opacity="0.6" transform="rotate(-10 18 19)"/>
          <rect x="12" y="6" width="17" height="23" rx="2.5" fill="#14532d" opacity="0.5" transform="rotate(-5 20 17)"/>
          <rect x="16" y="4" width="17" height="24" rx="2.5" fill="white" stroke="#d1d5db" strokeWidth="0.8"/>
          <text x="19.5" y="14" fill="#111827" fontSize="8.5" fontWeight="900" fontFamily="Georgia,serif">A</text>
          <text x="24" y="25" textAnchor="middle" fill="#111827" fontSize="14" fontFamily="serif">♠</text>
        </svg>
      )

    /* ── Spider ── purple web + stacked cards ── */
    case 'spider':
      return (
        <svg viewBox="0 0 48 48" width={S} height={S}>
          {[5, 4, 3, 2, 1, 0].map(i => (
            <rect key={i} x={8 + i * 2.2} y={6 + i * 1.5} width="20" height="28" rx="2"
              fill={i === 0 ? 'white' : '#ede9fe'}
              stroke={i === 0 ? '#c4b5fd' : '#a78bfa'}
              strokeWidth={i === 0 ? 1 : 0.4}
              opacity={i === 0 ? 1 : 0.5 + i * 0.08}
            />
          ))}
          <ellipse cx="19" cy="19" rx="3.5" ry="2.5" fill="#7c3aed"/>
          <ellipse cx="19" cy="24" rx="4" ry="3" fill="#6d28d9"/>
          <circle cx="19" cy="15.5" r="2.5" fill="#7c3aed"/>
          <circle cx="18" cy="14.8" r="0.7" fill="white"/>
          <circle cx="20" cy="14.8" r="0.7" fill="white"/>
          <path d="M15.5 19 Q12 17 10 15" stroke="#7c3aed" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
          <path d="M15.5 21 Q11.5 20 9.5 19" stroke="#7c3aed" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
          <path d="M15.5 23 Q11.5 23 9.5 24" stroke="#7c3aed" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
          <path d="M16 25 Q12 26 10.5 29" stroke="#7c3aed" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
          <path d="M22.5 19 Q26 17 28 15" stroke="#7c3aed" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
          <path d="M22.5 21 Q26.5 20 28.5 19" stroke="#7c3aed" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
          <path d="M22.5 23 Q26.5 23 28.5 24" stroke="#7c3aed" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
          <path d="M22 25 Q26 26 27.5 29" stroke="#7c3aed" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
          <path d="M19 13 L19 7" stroke="#a78bfa" strokeWidth="0.8" opacity="0.6" strokeDasharray="1.5,1"/>
          <text x="27" y="31.5" fill="#7c3aed" fontSize="7" fontFamily="serif">♠</text>
        </svg>
      )

    /* ── FreeCell ── 4 foundation slots + cards ── */
    case 'freecell':
      return (
        <svg viewBox="0 0 48 48" width={S} height={S}>
          {['♠', '♥', '♦', '♣'].map((s, i) => (
            <g key={i}>
              <rect x={3 + i * 11.5} y="3" width="10" height="13" rx="2"
                fill={s === '♥' || s === '♦' ? '#fee2e2' : '#eff6ff'}
                stroke={s === '♥' || s === '♦' ? '#ef4444' : '#3b82f6'}
                strokeWidth="1"/>
              <text x={8 + i * 11.5} y="13" textAnchor="middle"
                fill={s === '♥' || s === '♦' ? '#ef4444' : '#1e40af'}
                fontSize="9" fontFamily="serif">{s}</text>
            </g>
          ))}
          {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
            <g key={i}>
              <rect x={2 + i * 5.7} y="19" width="4.8" height="6" rx="1"
                fill="white" stroke="#bfdbfe" strokeWidth="0.6"/>
              <rect x={2 + i * 5.7} y="24" width="4.8" height="6" rx="1"
                fill="white" stroke="#bfdbfe" strokeWidth="0.6"/>
              <rect x={2 + i * 5.7} y="29" width="4.8" height="6" rx="1"
                fill="white" stroke="#93c5fd" strokeWidth="0.8"/>
              {i < 4 && (
                <text x={4.4 + i * 5.7} y="33.5" textAnchor="middle"
                  fill="#2563eb" fontSize="5" fontFamily="serif"
                  opacity={0.7 + i * 0.06}>
                  {['A', '2', '3', '4'][i]}
                </text>
              )}
            </g>
          ))}
          {[0, 1, 2, 3].map(i => (
            <rect key={i} x={3 + i * 11.5} y="37" width="10" height="9" rx="2"
              fill="#dbeafe" stroke="#3b82f6" strokeWidth="0.8" opacity="0.6"/>
          ))}
        </svg>
      )

    /* ── Mahjong ── red dragon tile ── */
    case 'mahjong':
      return (
        <svg viewBox="0 0 48 48" width={S} height={S}>
          <rect x="5" y="7" width="26" height="34" rx="4" fill="#dc2626" opacity="0.3" transform="rotate(-6 18 24)"/>
          <rect x="7" y="5" width="26" height="34" rx="4" fill="#dc2626" opacity="0.5" transform="rotate(-3 20 22)"/>
          <rect x="10" y="4" width="28" height="36" rx="4" fill="white" stroke="#dc2626" strokeWidth="1.5"/>
          <rect x="12" y="6" width="24" height="32" rx="3" fill="#fee2e2" stroke="#fca5a5" strokeWidth="0.5"/>
          <text x="24" y="28" textAnchor="middle" fill="#dc2626" fontSize="22" fontWeight="bold" fontFamily="serif">中</text>
          <circle cx="14" cy="10" r="1.5" fill="#dc2626" opacity="0.6"/>
          <circle cx="34" cy="10" r="1.5" fill="#dc2626" opacity="0.6"/>
          <circle cx="14" cy="34" r="1.5" fill="#dc2626" opacity="0.6"/>
          <circle cx="34" cy="34" r="1.5" fill="#dc2626" opacity="0.6"/>
        </svg>
      )

    /* ── Pyramid ── gold pyramid of cards ── */
    case 'pyramid':
      return (
        <svg viewBox="0 0 48 48" width={S} height={S}>
          {[0, 1, 2, 3].map(i => (
            <rect key={i} x={2 + i * 11.5} y="34" width="10" height="13" rx="1.5"
              fill={i % 2 === 0 ? '#fef3c7' : '#fbbf24'} stroke="#f59e0b" strokeWidth="0.8"/>
          ))}
          {[0, 1, 2].map(i => (
            <rect key={i} x={7.5 + i * 11.5} y="23" width="10" height="13" rx="1.5"
              fill={i % 2 === 1 ? '#fef3c7' : '#fbbf24'} stroke="#f59e0b" strokeWidth="0.8"/>
          ))}
          {[0, 1].map(i => (
            <rect key={i} x={13 + i * 11.5} y="12" width="10" height="13" rx="1.5"
              fill={i % 2 === 0 ? '#fef3c7' : '#fbbf24'} stroke="#d97706" strokeWidth="0.8"/>
          ))}
          <rect x="18.5" y="2" width="11" height="13" rx="1.5" fill="#f59e0b" stroke="#b45309" strokeWidth="1"/>
          <text x="24" y="11.5" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="serif">A</text>
        </svg>
      )

    /* ── Tri Peaks ── three teal card mountains ── */
    case 'tripeaks':
      return (
        <svg viewBox="0 0 48 48" width={S} height={S}>
          <rect x="1"  y="14" width="9"  height="12" rx="1.5" fill="#99f6e4" stroke="#14b8a6" strokeWidth="0.8"/>
          <rect x="6"  y="8"  width="9"  height="12" rx="1.5" fill="#2dd4bf" stroke="#0d9488" strokeWidth="0.8"/>
          <rect x="11" y="14" width="9"  height="12" rx="1.5" fill="#99f6e4" stroke="#14b8a6" strokeWidth="0.8"/>
          <rect x="11" y="14" width="9"  height="12" rx="1.5" fill="#ccfbf1" stroke="#14b8a6" strokeWidth="0.8"/>
          <rect x="16.5" y="5" width="10" height="13" rx="1.5" fill="#14b8a6" stroke="#0d9488" strokeWidth="1"/>
          <rect x="21"  y="14" width="9"  height="12" rx="1.5" fill="#ccfbf1" stroke="#14b8a6" strokeWidth="0.8"/>
          <rect x="27"  y="14" width="9"  height="12" rx="1.5" fill="#99f6e4" stroke="#14b8a6" strokeWidth="0.8"/>
          <rect x="32"  y="8"  width="9"  height="12" rx="1.5" fill="#2dd4bf" stroke="#0d9488" strokeWidth="0.8"/>
          <rect x="37"  y="14" width="9"  height="12" rx="1.5" fill="#99f6e4" stroke="#14b8a6" strokeWidth="0.8" opacity="0.6"/>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <rect key={i} x={1 + i * 7.8} y="29" width="7" height="10" rx="1.2"
              fill={i % 2 === 0 ? '#ccfbf1' : '#a5f3fc'} stroke="#14b8a6" strokeWidth="0.6"/>
          ))}
          <text x="21.5" y="14.5" textAnchor="middle" fill="white" fontSize="7" fontFamily="serif">♦</text>
        </svg>
      )

    /* ── Hearts ── big red heart + suits ── */
    case 'hearts':
      return (
        <svg viewBox="0 0 48 48" width={S} height={S}>
          <path d="M24 42 C24 42 4 28 4 17 C4 10 9 5 15 5 C18.5 5 21.5 7 24 10 C26.5 7 29.5 5 33 5 C39 5 44 10 44 17 C44 28 24 42 24 42Z"
            fill="#fca5a5" opacity="0.4" transform="translate(1,2)"/>
          <path d="M24 40 C24 40 4 26 4 15 C4 8.5 9 3.5 15 3.5 C18.5 3.5 21.5 5.5 24 8.5 C26.5 5.5 29.5 3.5 33 3.5 C39 3.5 44 8.5 44 15 C44 26 24 40 24 40Z"
            fill="#f43f5e"/>
          <path d="M14 9 C12 9 8 12 8 16" stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
          <text x="6" y="44" fill="#fb7185" fontSize="9" fontFamily="serif" opacity="0.7">♥</text>
          <text x="37" y="44" fill="#fb7185" fontSize="9" fontFamily="serif" opacity="0.7">♠</text>
        </svg>
      )

    /* ── Canfield ── fan spread of cyan cards ── */
    case 'canfield':
      return (
        <svg viewBox="0 0 48 48" width={S} height={S}>
          {[-3, -2, -1, 0, 1, 2, 3].map((offset, i) => {
            const angle = offset * 14
            const rad = angle * Math.PI / 180
            const tx = 24 + Math.sin(rad) * 10
            const ty = 42 - Math.cos(rad) * 10
            const colors = ['#cffafe', '#a5f3fc', '#67e8f9', '#22d3ee', '#06b6d4', '#0891b2', '#0e7490']
            return (
              <g key={i} transform={`translate(${tx},${ty}) rotate(${angle})`}>
                <rect x="-7" y="-22" width="14" height="22" rx="2"
                  fill={colors[i]}
                  stroke="#0891b2"
                  strokeWidth={i === 3 ? 1 : 0.5}
                  opacity={0.7 + i * 0.04}
                />
                {i === 3 && <text x="0" y="-7" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="serif">A</text>}
                {i === 3 && <text x="0" y="-1" textAnchor="middle" fill="white" fontSize="9" fontFamily="serif">♦</text>}
              </g>
            )
          })}
        </svg>
      )

    /* ── Golf ── green hill + flag + ball ── */
    case 'golf':
      return (
        <svg viewBox="0 0 48 48" width={S} height={S}>
          <rect x="0" y="0" width="48" height="48" rx="0" fill="#e0f2fe" opacity="0.4"/>
          <ellipse cx="24" cy="40" rx="24" ry="14" fill="#16a34a"/>
          <ellipse cx="24" cy="38" rx="24" ry="12" fill="#22c55e"/>
          <ellipse cx="32" cy="38" rx="3" ry="1.2" fill="#15803d"/>
          <line x1="32" y1="38" x2="32" y2="16" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round"/>
          <polygon points="32,16 32,24 42,20" fill="#ef4444"/>
          <rect x="8" y="24" width="9" height="12" rx="1.5" fill="white" stroke="#16a34a" strokeWidth="0.8"/>
          <text x="12.5" y="32" textAnchor="middle" fill="#16a34a" fontSize="8" fontFamily="serif">2</text>
          <circle cx="20" cy="37" r="3" fill="white" stroke="#d1d5db" strokeWidth="0.8"/>
          <circle cx="20" cy="37" r="1" fill="none" stroke="#9ca3af" strokeWidth="0.4" strokeDasharray="1,1"/>
        </svg>
      )

    /* ── Yukon ── snowflake + playing card ── */
    case 'yukon':
      return (
        <svg viewBox="0 0 48 48" width={S} height={S}>
          <rect x="6" y="4" width="28" height="38" rx="3" fill="white" stroke="#bae6fd" strokeWidth="1"/>
          {[0, 30, 60, 90, 120, 150].map(angle => {
            const r = angle * Math.PI / 180
            return (
              <g key={angle}>
                <line x1="20" y1="23" x2={20 + Math.cos(r) * 13} y2={23 + Math.sin(r) * 13}
                  stroke="#0ea5e9" strokeWidth="1.8" strokeLinecap="round"/>
                <line x1={20 + Math.cos(r) * 7} y1={23 + Math.sin(r) * 7}
                  x2={20 + Math.cos(r + Math.PI / 3) * 3 + Math.cos(r) * 7} y2={23 + Math.sin(r + Math.PI / 3) * 3 + Math.sin(r) * 7}
                  stroke="#38bdf8" strokeWidth="1" strokeLinecap="round"/>
                <line x1={20 + Math.cos(r) * 7} y1={23 + Math.sin(r) * 7}
                  x2={20 + Math.cos(r - Math.PI / 3) * 3 + Math.cos(r) * 7} y2={23 + Math.sin(r - Math.PI / 3) * 3 + Math.sin(r) * 7}
                  stroke="#38bdf8" strokeWidth="1" strokeLinecap="round"/>
              </g>
            )
          })}
          <circle cx="20" cy="23" r="2.5" fill="#0ea5e9"/>
          <text x="9" y="14" fill="#0ea5e9" fontSize="7.5" fontWeight="bold" fontFamily="sans-serif">Y</text>
          <text x="9" y="21" fill="#0ea5e9" fontSize="7" fontFamily="sans-serif">K</text>
          <rect x="32" y="10" width="11" height="15" rx="2" fill="#e0f2fe" stroke="#0ea5e9" strokeWidth="0.8"/>
          <rect x="33" y="18" width="11" height="15" rx="2" fill="#bae6fd" stroke="#0ea5e9" strokeWidth="0.8"/>
          <rect x="34" y="26" width="11" height="15" rx="2" fill="#7dd3fc" stroke="#0369a1" strokeWidth="0.8"/>
        </svg>
      )

    /* ── Spider ×2 — two orange overlapping spiders ── */
    case 'spider2':
      return (
        <svg viewBox="0 0 48 48" width={S} height={S}>
          <rect x="2"  y="4" width="22" height="30" rx="2.5" fill="#fed7aa" stroke="#f97316" strokeWidth="0.8" opacity="0.7"/>
          <rect x="24" y="4" width="22" height="30" rx="2.5" fill="#ffedd5" stroke="#f97316" strokeWidth="1"/>
          <ellipse cx="13" cy="14" rx="2.5" ry="1.8" fill="#ea580c" opacity="0.7"/>
          <ellipse cx="13" cy="18" rx="3" ry="2.2" fill="#c2410c" opacity="0.7"/>
          <path d="M10.5 14 Q8 12 6 11M10.5 16 Q7.5 15.5 6 15M10.5 18 Q8 18.5 6 20M10.5 20 Q8 21 7 23"
            stroke="#ea580c" strokeWidth="0.9" fill="none" strokeLinecap="round" opacity="0.7"/>
          <path d="M15.5 14 Q18 12 20 11M15.5 16 Q18.5 15.5 20 15M15.5 18 Q18 18.5 20 20M15.5 20 Q18 21 19 23"
            stroke="#ea580c" strokeWidth="0.9" fill="none" strokeLinecap="round" opacity="0.7"/>
          <ellipse cx="35" cy="14" rx="3" ry="2.2" fill="#f97316"/>
          <ellipse cx="35" cy="19" rx="3.5" ry="2.8" fill="#ea580c"/>
          <circle cx="35" cy="10" r="2.2" fill="#f97316"/>
          <circle cx="34" cy="9.3" r="0.6" fill="white"/>
          <circle cx="36" cy="9.3" r="0.6" fill="white"/>
          <path d="M32 14 Q29 12 27 11M32 16 Q28.5 15.5 27 15M32 18 Q29 18.5 27 20M32 21 Q29 22 28 24"
            stroke="#f97316" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
          <path d="M38 14 Q41 12 43 11M38 16 Q41.5 15.5 43 15M38 18 Q41 18.5 43 20M38 21 Q41 22 42 24"
            stroke="#f97316" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
          <rect x="16" y="32" width="16" height="12" rx="3" fill="#f97316"/>
          <text x="24" y="41.5" textAnchor="middle" fill="white" fontSize="8.5" fontWeight="900" fontFamily="sans-serif">×2</text>
        </svg>
      )

    /* ── 40 Ladrones ── tall stack of cards + badge ── */
    case 'forty':
    default:
      return (
        <svg viewBox="0 0 48 48" width={S} height={S}>
          {[0, 1, 2, 3, 4].map(i => {
            const colors = ['#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5']
            return (
              <g key={i}>
                <rect x={2 + i * 9.2} y="4" width="8" height="12" rx="1.5"
                  fill={colors[i]} stroke="#6366f1" strokeWidth="0.5"/>
                <rect x={2 + i * 9.2} y="17" width="8" height="12" rx="1.5"
                  fill={colors[i]} stroke="#6366f1" strokeWidth="0.5" opacity="0.85"/>
                <rect x={2 + i * 9.2} y="30" width="8" height="12" rx="1.5"
                  fill={colors[i]} stroke="#6366f1" strokeWidth="0.5" opacity="0.7"/>
              </g>
            )
          })}
          <rect x="12" y="15" width="24" height="18" rx="5" fill="#312e81" opacity="0.9"/>
          <text x="24" y="28" textAnchor="middle" fill="white" fontSize="14" fontWeight="900" fontFamily="sans-serif" letterSpacing="-0.5">40</text>
        </svg>
      )
  }
}

/* ─── Arrow chevron ─── */
function ChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
      stroke="rgba(255,255,255,0.65)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6"/>
    </svg>
  )
}

/* ─── floating suit data ─── */
const FLOAT_SUITS = [
  { symbol: '♠', top: '6%',  left: '8%',  size: 72, opacity: 0.05, delay: '0s',   dur: '6s',  rot: '-12deg' },
  { symbol: '♥', top: '12%', left: '78%', size: 88, opacity: 0.04, delay: '1.4s', dur: '7.5s', rot: '8deg'  },
  { symbol: '♦', top: '32%', left: '88%', size: 64, opacity: 0.06, delay: '0.8s', dur: '5.5s', rot: '20deg' },
  { symbol: '♣', top: '48%', left: '4%',  size: 80, opacity: 0.04, delay: '2.1s', dur: '8s',   rot: '-5deg' },
  { symbol: '♠', top: '65%', left: '82%', size: 56, opacity: 0.05, delay: '0.3s', dur: '6.8s', rot: '15deg' },
  { symbol: '♥', top: '76%', left: '14%', size: 96, opacity: 0.03, delay: '1.9s', dur: '7.2s', rot: '-18deg'},
  { symbol: '♦', top: '88%', left: '55%', size: 60, opacity: 0.05, delay: '1.1s', dur: '5.8s', rot: '6deg'  },
  { symbol: '♣', top: '22%', left: '46%', size: 70, opacity: 0.04, delay: '2.6s', dur: '9s',   rot: '-8deg' },
]

/* ─── category group helper ─── */
const HERO_ID = 'klondike'
const REST_GAMES = GAMES.filter(g => g.id !== HERO_ID)

function groupByCategory(games: Game[]): { label: string; games: Game[] }[] {
  const map = new Map<string, Game[]>()
  for (const g of games) {
    const arr = map.get(g.category) ?? []
    arr.push(g)
    map.set(g.category, arr)
  }
  return Array.from(map.entries()).map(([label, gs]) => ({ label, games: gs }))
}

/* ─── Main screen ─── */
export function AbuGames() {
  const setScreen = useAppStore(s => s.setScreen)
  const [pressed, setPressed] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const style = document.createElement('style')
    style.id = 'abu-games-anim'
    style.textContent = `
      @keyframes cardIn {
        from { opacity: 0; transform: translateY(28px) scale(0.88); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes suitFloat {
        0%, 100% { transform: translateY(0px) rotate(var(--rot, 0deg)); }
        50%       { transform: translateY(-18px) rotate(var(--rot, 0deg)); }
      }
      @keyframes shimmer {
        0%   { opacity: 0.08; }
        50%  { opacity: 0.18; }
        100% { opacity: 0.08; }
      }
    `
    document.head.appendChild(style)
    const t = setTimeout(() => setLoaded(true), 60)
    const onVis = () => { if (!document.hidden) isNavigating = false }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearTimeout(t)
      document.removeEventListener('visibilitychange', onVis)
      document.getElementById('abu-games-anim')?.remove()
    }
  }, [])

  const heroGame = GAMES.find(g => g.id === HERO_ID)!
  const heroPressed = pressed === HERO_ID
  const groups = groupByCategory(REST_GAMES)

  return (
    <div style={{
      height: '100%',
      width: '100%',
      overflowY: 'auto',
      overflowX: 'hidden',
      background: 'linear-gradient(160deg, #07091A 0%, #0D0B22 40%, #080B1E 100%)',
      fontFamily: "'Heebo','DM Sans',sans-serif",
      userSelect: 'none',
      WebkitUserSelect: 'none',
      position: 'relative',
    }}>

      {/* ── Ambient glow blobs ── */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: [
          'radial-gradient(ellipse 55% 35% at 8% 8%, rgba(201,168,76,0.10) 0%, transparent 60%)',
          'radial-gradient(ellipse 50% 40% at 90% 88%, rgba(20,184,166,0.09) 0%, transparent 60%)',
        ].join(', '),
      }}/>

      {/* ── Floating card suits ── */}
      {FLOAT_SUITS.map((s, i) => (
        <div
          key={i}
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: s.top,
            left: s.left,
            fontSize: s.size,
            color: 'white',
            opacity: s.opacity,
            pointerEvents: 'none',
            zIndex: 0,
            animation: `suitFloat ${s.dur} ease-in-out ${s.delay} infinite`,
            ['--rot' as string]: s.rot,
            lineHeight: 1,
          } as React.CSSProperties}
        >
          {s.symbol}
        </div>
      ))}

      {/* ── HEADER ── */}
      <header style={{
        position: 'relative',
        zIndex: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        height: 64,
        paddingTop: 'env(safe-area-inset-top, 44px)',
        background: 'linear-gradient(180deg, rgba(7,9,26,0.98) 0%, rgba(8,11,30,0.95) 100%)',
        borderBottom: '1px solid rgba(201,168,76,0.14)',
      }}>
        {/* Wordmark */}
        <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, direction: 'ltr' }}>
          <span style={{
            fontFamily: "'Cormorant Garamond',Georgia,serif",
            fontSize: 26, fontWeight: 600, letterSpacing: '2px',
            background: 'linear-gradient(135deg, #5EEAD4 0%, #2DD4BF 22%, #0D9488 48%, #5EEAD4 72%, #14B8A6 92%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            filter: 'drop-shadow(0 0 8px rgba(94,234,212,0.30))',
          } as React.CSSProperties}>Abu</span>
          <span style={{
            fontFamily: "'DM Sans',sans-serif",
            fontSize: 24, fontWeight: 500, letterSpacing: '1.5px',
            background: 'linear-gradient(135deg, #FDE68A 0%, #F59E0B 25%, #D97706 50%, #C9A84C 75%, #F59E0B 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            filter: 'drop-shadow(0 0 8px rgba(201,168,76,0.28))',
          } as React.CSSProperties}>Games</span>
        </div>
        {/* Subtitle */}
        <div style={{
          fontSize: 12,
          color: 'rgba(255,255,255,0.45)',
          marginTop: 1,
          direction: 'rtl',
          fontFamily: "'Heebo',sans-serif",
        }}>
          בחרי משחק ותהני 🎮
        </div>

        {/* Back button */}
        <button
          type="button"
          onClick={() => setScreen(Screen.Home)}
          aria-label="חזרה"
          style={{
            position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 12px',
            borderRadius: 20,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <ChevronLeft />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontFamily: "'Heebo',sans-serif" }}>חזרה</span>
        </button>
      </header>

      {/* ── CONTENT ── */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        padding: '16px 20px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}>

        {/* ── HERO FEATURED CARD ── */}
        <div
          role="button"
          aria-label={`פתח ${heroGame.label}`}
          tabIndex={0}
          onClick={() => handleTap(heroGame.url)}
          onPointerDown={() => setPressed(HERO_ID)}
          onPointerUp={() => setPressed(null)}
          onPointerLeave={() => setPressed(null)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTap(heroGame.url) } }}
          style={{
            position: 'relative',
            width: '100%',
            height: 150,
            borderRadius: 22,
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #052e16 0%, #14532d 25%, #16a34a 60%, #22c55e 80%, #4ade80 100%)',
            boxShadow: heroPressed
              ? '0 6px 20px rgba(34,197,94,0.45), 0 2px 8px rgba(0,0,0,0.7)'
              : '0 12px 40px rgba(34,197,94,0.35), 0 4px 12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15)',
            transform: heroPressed ? 'scale(0.97)' : 'scale(1)',
            transition: 'transform 0.12s ease-out, box-shadow 0.12s ease-out',
            cursor: 'pointer',
            opacity: loaded ? 1 : 0,
            animation: loaded ? 'cardIn 0.5s cubic-bezier(0.34,1.2,0.64,1) 0.05s both' : 'none',
          }}
        >
          {/* Card shine overlay */}
          <div aria-hidden="true" style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '45%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.13) 0%, transparent 100%)',
            borderRadius: 'inherit',
            pointerEvents: 'none',
            zIndex: 2,
          }}/>

          {/* Content layout: icon left, text right */}
          <div style={{
            position: 'relative', zIndex: 3,
            display: 'flex', alignItems: 'center',
            height: '100%', padding: '0 24px', gap: 20,
          }}>
            {/* Icon */}
            <div style={{
              flexShrink: 0,
              width: 72, height: 72,
              borderRadius: 16,
              background: 'rgba(0,0,0,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(255,255,255,0.15)',
              backdropFilter: 'blur(4px)',
            }}>
              <GameIcon id={heroGame.id} accent={heroGame.accent} />
            </div>

            {/* Text */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, direction: 'ltr' }}>
              <div style={{
                fontSize: 28, fontWeight: 700, color: 'white',
                textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                fontFamily: "'DM Sans','Heebo',sans-serif",
                letterSpacing: '-0.3px',
              }}>
                {heroGame.label}
              </div>
              {/* Category badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '3px 10px', borderRadius: 20,
                background: 'rgba(0,0,0,0.30)',
                border: '1px solid rgba(255,255,255,0.18)',
                fontSize: 11, color: 'rgba(255,255,255,0.80)',
                fontFamily: "'Heebo',sans-serif",
                direction: 'rtl',
                width: 'fit-content',
              }}>
                {heroGame.category}
              </div>
              {/* CTA */}
              <div style={{
                fontSize: 14, fontWeight: 600,
                color: '#4ade80',
                fontFamily: "'DM Sans',sans-serif",
                letterSpacing: '0.2px',
              }}>
                שחקי עכשיו →
              </div>
            </div>
          </div>
        </div>

        {/* ── GAME GROUPS ── */}
        {groups.map((group, gi) => {
          // global offset for stagger: hero is index 0, then group games follow
          const baseOffset = 1 + groups.slice(0, gi).reduce((acc, g) => acc + g.games.length, 0)

          return (
            <div key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Section label */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                direction: 'rtl',
              }}>
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  color: '#C9A84C',
                  fontFamily: "'Heebo',sans-serif",
                  letterSpacing: '0.5px',
                }}>
                  {group.label}
                </span>
                <div style={{
                  flex: 1, height: 1,
                  background: 'linear-gradient(90deg, rgba(201,168,76,0.35) 0%, transparent 100%)',
                }}/>
              </div>

              {/* 2-column grid */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
              }}>
                {group.games.map((game, idx) => {
                  const globalIdx = baseOffset + idx
                  const isP = pressed === game.id
                  const rgb = hexToRgb(game.accent)

                  return (
                    <div
                      key={game.id}
                      role="button"
                      aria-label={`פתח ${game.label}`}
                      tabIndex={0}
                      onClick={() => handleTap(game.url)}
                      onPointerDown={() => setPressed(game.id)}
                      onPointerUp={() => setPressed(null)}
                      onPointerLeave={() => setPressed(null)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTap(game.url) } }}
                      style={{
                        flex: '1 1 155px',
                        minWidth: 155,
                        height: 130,
                        borderRadius: 18,
                        position: 'relative',
                        overflow: 'hidden',
                        background: game.gradient,
                        boxShadow: isP
                          ? `0 4px 16px rgba(${rgb},0.55), 0 0 0 1px rgba(255,255,255,0.10), inset 0 1px 0 rgba(255,255,255,0.15)`
                          : `0 8px 24px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.12)`,
                        transform: isP ? 'scale(0.93)' : 'scale(1)',
                        transition: 'transform 0.12s ease-out, box-shadow 0.12s ease-out',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        opacity: loaded ? 1 : 0,
                        animation: loaded ? `cardIn 0.45s cubic-bezier(0.34,1.2,0.64,1) ${0.05 + globalIdx * 0.04}s both` : 'none',
                      }}
                    >
                      {/* Card shine overlay */}
                      <div aria-hidden="true" style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: '45%',
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.13) 0%, transparent 100%)',
                        borderRadius: 'inherit',
                        pointerEvents: 'none',
                        zIndex: 1,
                      }}/>

                      {/* Icon */}
                      <div style={{ position: 'relative', zIndex: 2 }}>
                        <GameIcon id={game.id} accent={game.accent} />
                      </div>

                      {/* Game name */}
                      <div style={{
                        position: 'relative', zIndex: 2,
                        fontSize: 17, fontWeight: 700,
                        color: 'white',
                        fontFamily: "'DM Sans','Heebo',sans-serif",
                        textShadow: '0 1px 6px rgba(0,0,0,0.55)',
                        letterSpacing: '-0.2px',
                        direction: 'ltr',
                        textAlign: 'center',
                      }}>
                        {game.label}
                      </div>

                      {/* Category badge */}
                      <div style={{
                        position: 'relative', zIndex: 2,
                        padding: '2px 8px', borderRadius: 12,
                        background: `rgba(${rgb},0.25)`,
                        border: `1px solid rgba(${rgb},0.40)`,
                        fontSize: 10, color: `rgba(255,255,255,0.75)`,
                        fontFamily: "'Heebo',sans-serif",
                        direction: 'rtl',
                      }}>
                        {game.category}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Bottom safe area padding */}
        <div style={{ height: 'env(safe-area-inset-bottom, 16px)' }}/>
      </div>
    </div>
  )
}

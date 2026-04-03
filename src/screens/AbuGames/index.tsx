import { useState, useEffect } from 'react'
import { useAppStore } from '../../state/store'
import { Screen } from '../../state/types'

/* ─── GAMES DATA ─── */
interface Game {
  id: string
  label: string
  labelHe: string
  url: string
  accent: string
  category: 'solitaire' | 'mahjong'
}

const GAMES: Game[] = [
  // ── Solitaire ──────────────────────────────────────────────────────────────
  { id: 'klondike',       label: 'Solitario',    labelHe: 'סוליטר קלאסי',  accent: '#22c55e', category: 'solitaire', url: 'https://www.arkadium.com/games/klondike-solitaire/' },
  { id: 'spider',         label: 'Spider',        labelHe: 'עכביש',          accent: '#a78bfa', category: 'solitaire', url: 'https://www.arkadium.com/games/spider-solitaire/' },
  { id: 'freecell',       label: 'FreeCell',      labelHe: 'פריסל',          accent: '#3b82f6', category: 'solitaire', url: 'https://www.arkadium.com/games/freecell/' },
  { id: 'pyramid',        label: 'Pirámide',      labelHe: 'פירמידה',        accent: '#f59e0b', category: 'solitaire', url: 'https://games.aarp.org/games/pyramid-solitaire' },
  { id: 'tripeaks',       label: 'Tri Peaks',     labelHe: 'שלושה פסגות',    accent: '#14b8a6', category: 'solitaire', url: 'https://www.arkadium.com/games/tripeaks-solitaire-free/' },
  { id: 'hearts',         label: 'Corazones',     labelHe: 'לבבות',          accent: '#f43f5e', category: 'solitaire', url: 'https://cardgames.io/hearts/' },
  { id: 'canfield',       label: 'Canfield',      labelHe: 'קאנפילד',        accent: '#06b6d4', category: 'solitaire', url: 'https://solitaired.com/canfield' },
  { id: 'golf',           label: 'Golf',          labelHe: 'גולף',           accent: '#16a34a', category: 'solitaire', url: 'https://www.solitaire-play.com/golf/' },
  { id: 'yukon',          label: 'Yukon',         labelHe: 'יוקון',          accent: '#0ea5e9', category: 'solitaire', url: 'https://solitaired.com/yukon' },
  { id: 'spider2',        label: 'Spider ×2',     labelHe: 'עכביש ×2',       accent: '#f97316', category: 'solitaire', url: 'https://www.arkadium.com/games/spider-solitaire-2-suits/' },
  { id: 'forty',          label: '40 Ladrones',   labelHe: '40 ליסטים',      accent: '#818cf8', category: 'solitaire', url: 'https://solitaired.com/forty-thieves' },
  // ── Mahjong ────────────────────────────────────────────────────────────────
  { id: 'mahjong',        label: 'Mahjong',       labelHe: 'מהג\'ונג',        accent: '#ef4444', category: 'mahjong',   url: 'https://www.arkadium.com/games/mahjongg-solitaire/' },
  { id: 'mahjong-connect',label: 'Connect',       labelHe: 'חיבור',          accent: '#f97316', category: 'mahjong',   url: 'https://www.arkadium.com/games/mahjong-connect/' },
  { id: 'mahjong-3d',     label: 'Dimensiones',   labelHe: 'תלת-מימד',       accent: '#8b5cf6', category: 'mahjong',   url: 'https://www.arkadium.com/games/mahjongg-dimensions/' },
]

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
  window.location.href = url
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  return `${parseInt(h.substring(0, 2), 16)},${parseInt(h.substring(2, 4), 16)},${parseInt(h.substring(4, 6), 16)}`
}

/* ─── 3D ORB GRADIENTS ─── */
const GAME_ORBS: Record<string, string> = {
  klondike:         'radial-gradient(circle at 35% 28%, #ffffff 0%, #86efac 14%, #22c55e 38%, #15803d 62%, #064e20 84%, #021a0b 100%)',
  spider:           'radial-gradient(circle at 35% 28%, #ffffff 0%, #ddd6fe 14%, #8b5cf6 38%, #5b21b6 62%, #2d0a72 84%, #12002e 100%)',
  freecell:         'radial-gradient(circle at 35% 28%, #ffffff 0%, #bfdbfe 14%, #3b82f6 38%, #1d4ed8 62%, #0d2e8a 84%, #050f38 100%)',
  mahjong:          'radial-gradient(circle at 35% 28%, #ffffff 0%, #fecaca 14%, #ef4444 38%, #b91c1c 62%, #6b0f0f 84%, #2a0303 100%)',
  pyramid:          'radial-gradient(circle at 35% 28%, #ffffff 0%, #fde68a 14%, #f59e0b 38%, #b45309 62%, #5c2a00 84%, #200e00 100%)',
  tripeaks:         'radial-gradient(circle at 35% 28%, #ffffff 0%, #99f6e4 14%, #14b8a6 38%, #0f766e 62%, #044640 84%, #01181a 100%)',
  hearts:           'radial-gradient(circle at 35% 28%, #ffffff 0%, #fecdd3 14%, #f43f5e 38%, #be123c 62%, #6d0520 84%, #270008 100%)',
  canfield:         'radial-gradient(circle at 35% 28%, #ffffff 0%, #a5f3fc 14%, #06b6d4 38%, #0e7490 62%, #083344 84%, #01101a 100%)',
  golf:             'radial-gradient(circle at 35% 28%, #ffffff 0%, #bbf7d0 14%, #16a34a 38%, #15803d 62%, #064e20 84%, #011f0a 100%)',
  yukon:            'radial-gradient(circle at 35% 28%, #ffffff 0%, #bae6fd 14%, #0ea5e9 38%, #0369a1 62%, #0a3858 84%, #010e1e 100%)',
  spider2:          'radial-gradient(circle at 35% 28%, #ffffff 0%, #fed7aa 14%, #f97316 38%, #c2410c 62%, #6b1c02 84%, #220800 100%)',
  forty:            'radial-gradient(circle at 35% 28%, #ffffff 0%, #c7d2fe 14%, #818cf8 38%, #4338ca 62%, #20165c 84%, #090520 100%)',
  'mahjong-connect':'radial-gradient(circle at 35% 28%, #ffffff 0%, #fed7aa 14%, #fb923c 38%, #ea580c 62%, #7c2d12 84%, #280800 100%)',
  'mahjong-3d':     'radial-gradient(circle at 35% 28%, #ffffff 0%, #ede9fe 14%, #8b5cf6 38%, #6d28d9 62%, #3b0764 84%, #14002a 100%)',
}

/* ─────────────────────────────────────────────────────────────
   GAME ICONS — S=52
───────────────────────────────────────────────────────────── */
function GameIcon({ id, accent, size = 52 }: { id: string; accent: string; size?: number }) {
  const S = size

  switch (id) {

    case 'klondike':
      return (
        <svg viewBox="0 0 48 48" width={S} height={S}>
          <ellipse cx="24" cy="26" rx="19" ry="13" fill="#16a34a" opacity="0.90"/>
          <rect x="10" y="8" width="17" height="23" rx="2.5" fill="#166534" opacity="0.5" transform="rotate(-10 18 19)"/>
          <rect x="12" y="6" width="17" height="23" rx="2.5" fill="#14532d" opacity="0.4" transform="rotate(-5 20 17)"/>
          <rect x="16" y="4" width="17" height="24" rx="2.5" fill="white" stroke="#d1d5db" strokeWidth="0.8"/>
          <text x="19.5" y="14" fill="#111827" fontSize="8.5" fontWeight="900" fontFamily="Georgia,serif">A</text>
          <text x="24" y="25" textAnchor="middle" fill="#111827" fontSize="14" fontFamily="serif">♠</text>
        </svg>
      )

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
          <path d="M15.5 19 Q12 17 10 15M15.5 21 Q11.5 20 9.5 19M15.5 23 Q11.5 23 9.5 24M16 25 Q12 26 10.5 29"
            stroke="#7c3aed" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
          <path d="M22.5 19 Q26 17 28 15M22.5 21 Q26.5 20 28.5 19M22.5 23 Q26.5 23 28.5 24M22 25 Q26 26 27.5 29"
            stroke="#7c3aed" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
        </svg>
      )

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
              <rect x={2 + i * 5.7} y="19" width="4.8" height="6" rx="1" fill="white" stroke="#bfdbfe" strokeWidth="0.6"/>
              <rect x={2 + i * 5.7} y="24" width="4.8" height="6" rx="1" fill="white" stroke="#bfdbfe" strokeWidth="0.6"/>
              <rect x={2 + i * 5.7} y="29" width="4.8" height="6" rx="1" fill="white" stroke="#93c5fd" strokeWidth="0.8"/>
            </g>
          ))}
          {[0, 1, 2, 3].map(i => (
            <rect key={i} x={3 + i * 11.5} y="37" width="10" height="9" rx="2"
              fill="#dbeafe" stroke="#3b82f6" strokeWidth="0.8" opacity="0.6"/>
          ))}
        </svg>
      )

    case 'mahjong':
      return (
        <svg viewBox="0 0 48 48" width={S} height={S}>
          <rect x="5" y="7" width="26" height="34" rx="4" fill="#dc2626" opacity="0.25" transform="rotate(-6 18 24)"/>
          <rect x="7" y="5" width="26" height="34" rx="4" fill="#dc2626" opacity="0.45" transform="rotate(-3 20 22)"/>
          <rect x="10" y="4" width="28" height="36" rx="4" fill="white" stroke="#dc2626" strokeWidth="1.5"/>
          <rect x="12" y="6" width="24" height="32" rx="3" fill="#fee2e2" stroke="#fca5a5" strokeWidth="0.5"/>
          <text x="24" y="28" textAnchor="middle" fill="#dc2626" fontSize="22" fontWeight="bold" fontFamily="serif">中</text>
          <circle cx="14" cy="10" r="1.5" fill="#dc2626" opacity="0.6"/>
          <circle cx="34" cy="10" r="1.5" fill="#dc2626" opacity="0.6"/>
          <circle cx="14" cy="34" r="1.5" fill="#dc2626" opacity="0.6"/>
          <circle cx="34" cy="34" r="1.5" fill="#dc2626" opacity="0.6"/>
        </svg>
      )

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

    case 'tripeaks':
      return (
        <svg viewBox="0 0 48 48" width={S} height={S}>
          <rect x="1"  y="14" width="9"  height="12" rx="1.5" fill="#99f6e4" stroke="#14b8a6" strokeWidth="0.8"/>
          <rect x="6"  y="8"  width="9"  height="12" rx="1.5" fill="#2dd4bf" stroke="#0d9488" strokeWidth="0.8"/>
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
        </svg>
      )

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
                  fill={colors[i]} stroke="#0891b2"
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

    case 'golf':
      return (
        <svg viewBox="0 0 48 48" width={S} height={S}>
          <ellipse cx="24" cy="40" rx="24" ry="14" fill="#16a34a"/>
          <ellipse cx="24" cy="38" rx="24" ry="12" fill="#22c55e"/>
          <line x1="32" y1="38" x2="32" y2="16" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round"/>
          <polygon points="32,16 32,24 42,20" fill="#ef4444"/>
          <rect x="8" y="24" width="9" height="12" rx="1.5" fill="white" stroke="#16a34a" strokeWidth="0.8"/>
          <text x="12.5" y="32" textAnchor="middle" fill="#16a34a" fontSize="8" fontFamily="serif">2</text>
          <circle cx="20" cy="37" r="3" fill="white" stroke="#d1d5db" strokeWidth="0.8"/>
        </svg>
      )

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
              </g>
            )
          })}
          <circle cx="20" cy="23" r="2.5" fill="#0ea5e9"/>
          <text x="9" y="14" fill="#0ea5e9" fontSize="7.5" fontWeight="bold" fontFamily="sans-serif">Y</text>
          <rect x="32" y="10" width="11" height="15" rx="2" fill="#e0f2fe" stroke="#0ea5e9" strokeWidth="0.8"/>
          <rect x="33" y="18" width="11" height="15" rx="2" fill="#bae6fd" stroke="#0ea5e9" strokeWidth="0.8"/>
          <rect x="34" y="26" width="11" height="15" rx="2" fill="#7dd3fc" stroke="#0369a1" strokeWidth="0.8"/>
        </svg>
      )

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
          <path d="M32 14 Q29 12 27 11M32 16 Q28.5 15.5 27 15M32 18 Q29 18.5 27 20M32 21 Q29 22 28 24"
            stroke="#f97316" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
          <path d="M38 14 Q41 12 43 11M38 16 Q41.5 15.5 43 15M38 18 Q41 18.5 43 20M38 21 Q41 22 42 24"
            stroke="#f97316" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
          <rect x="16" y="32" width="16" height="12" rx="3" fill="#f97316"/>
          <text x="24" y="41.5" textAnchor="middle" fill="white" fontSize="8.5" fontWeight="900" fontFamily="sans-serif">×2</text>
        </svg>
      )

    case 'forty':
      return (
        <svg viewBox="0 0 48 48" width={S} height={S}>
          {[0, 1, 2, 3, 4].map(i => {
            const colors = ['#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5']
            return (
              <g key={i}>
                <rect x={2 + i * 9.2} y="4" width="8" height="12" rx="1.5" fill={colors[i]} stroke="#6366f1" strokeWidth="0.5"/>
                <rect x={2 + i * 9.2} y="17" width="8" height="12" rx="1.5" fill={colors[i]} stroke="#6366f1" strokeWidth="0.5" opacity="0.85"/>
                <rect x={2 + i * 9.2} y="30" width="8" height="12" rx="1.5" fill={colors[i]} stroke="#6366f1" strokeWidth="0.5" opacity="0.7"/>
              </g>
            )
          })}
          <rect x="12" y="15" width="24" height="18" rx="5" fill="#312e81" opacity="0.9"/>
          <text x="24" y="28" textAnchor="middle" fill="white" fontSize="14" fontWeight="900" fontFamily="sans-serif" letterSpacing="-0.5">40</text>
        </svg>
      )

    case 'mahjong-connect':
      return (
        <svg viewBox="0 0 48 48" width={S} height={S}>
          {/* Left tile */}
          <rect x="2" y="12" width="17" height="24" rx="3" fill="white" stroke="#f97316" strokeWidth="1.5"/>
          <rect x="4" y="14" width="13" height="20" rx="2" fill="#fff7ed"/>
          <text x="10.5" y="28" textAnchor="middle" fill="#f97316" fontSize="14" fontFamily="serif" fontWeight="bold">發</text>
          {/* Right tile */}
          <rect x="29" y="12" width="17" height="24" rx="3" fill="white" stroke="#f97316" strokeWidth="1.5"/>
          <rect x="31" y="14" width="13" height="20" rx="2" fill="#fff7ed"/>
          <text x="37.5" y="28" textAnchor="middle" fill="#f97316" fontSize="14" fontFamily="serif" fontWeight="bold">發</text>
          {/* Connection line with glow */}
          <line x1="19" y1="24" x2="29" y2="24" stroke="#fed7aa" strokeWidth="4" strokeLinecap="round"/>
          <line x1="19" y1="24" x2="29" y2="24" stroke="#f97316" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="19" cy="24" r="3" fill="#f97316"/>
          <circle cx="29" cy="24" r="3" fill="#f97316"/>
          {/* Match sparkles */}
          <circle cx="24" cy="7"  r="1.5" fill="#fbbf24"/>
          <circle cx="24" cy="41" r="1.5" fill="#fbbf24"/>
        </svg>
      )

    case 'mahjong-3d':
    default:
      return (
        <svg viewBox="0 0 48 48" width={S} height={S}>
          {/* 3D cube — isometric tiles */}
          {/* Top face */}
          <polygon points="24,4 43,14 24,24 5,14" fill="#c4b5fd" stroke="#8b5cf6" strokeWidth="0.8"/>
          {/* Left face */}
          <polygon points="5,14 24,24 24,44 5,34" fill="#7c3aed" stroke="#5b21b6" strokeWidth="0.8"/>
          {/* Right face */}
          <polygon points="24,24 43,14 43,34 24,44" fill="#6d28d9" stroke="#4c1d95" strokeWidth="0.8"/>
          {/* Characters on faces */}
          <text x="24" y="17" textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize="9" fontFamily="serif" fontWeight="bold">發</text>
          <text x="15" y="35" textAnchor="middle" fill="rgba(255,255,255,0.75)" fontSize="9" fontFamily="serif">中</text>
          <text x="33" y="35" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="9" fontFamily="serif">白</text>
          {/* Shine on top */}
          <polygon points="24,4 35,9 24,14 13,9" fill="rgba(255,255,255,0.20)"/>
        </svg>
      )
  }
}

/* ─── Back arrow ─── */
function ChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
      stroke="rgba(255,255,255,0.65)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6"/>
    </svg>
  )
}

/* ─── Single 3D bubble + label ─── */
function GameBubble({
  game, pressKey, onPress, onRelease, delay,
}: {
  game: Game
  pressKey: string | null
  onPress: (k: string) => void
  onRelease: () => void
  delay: number
}) {
  const orbGrad = GAME_ORBS[game.id] ?? GAME_ORBS['klondike']
  const rgb = hexToRgb(game.accent)
  const isP = pressKey === game.id

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9,
      animation: `bubbleIn 0.45s cubic-bezier(0.34,1.20,0.64,1) ${delay}s both`,
    }}>
      {/* The orb */}
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
          width: 90, height: 90,
          borderRadius: '50%',
          background: orbGrad,
          boxShadow: isP
            ? `0 3px 10px rgba(${rgb},0.40), 0 1px 4px rgba(0,0,0,0.60)`
            : `0 8px 28px rgba(0,0,0,0.55), 0 2px 12px rgba(${rgb},0.40), inset 0 2px 0 rgba(255,255,255,0.28), inset 0 -1px 0 rgba(0,0,0,0.25)`,
          transform: isP ? 'scale(0.91) translateY(2px)' : 'scale(1)',
          transition: 'transform 0.12s ease-out, box-shadow 0.12s ease-out',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          WebkitTapHighlightColor: 'transparent',
          flexShrink: 0,
        }}
      >
        {/* Specular highlight — top-left bright spot */}
        <div aria-hidden="true" style={{
          position: 'absolute', top: 7, left: 10,
          width: 30, height: 20,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(255,255,255,0.60) 0%, transparent 70%)',
          pointerEvents: 'none',
          transform: 'rotate(-20deg)',
        }}/>
        {/* Bottom shadow-rim for depth */}
        <div aria-hidden="true" style={{
          position: 'absolute', bottom: 5, left: '20%', right: '20%',
          height: 8,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(0,0,0,0.30) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}/>
        <GameIcon id={game.id} accent={game.accent} size={50} />
      </div>

      {/* Label */}
      <span style={{
        fontSize: 12, fontWeight: 700,
        color: 'rgba(255,255,255,0.88)',
        fontFamily: "'Heebo',sans-serif",
        textAlign: 'center',
        lineHeight: 1.25,
        maxWidth: 90,
        direction: 'rtl',
        textShadow: `0 0 10px rgba(${rgb},0.35)`,
      }}>
        {game.labelHe}
      </span>
    </div>
  )
}

/* ─── Category section ─── */
function CategorySection({
  emoji, title, titleHe, accent, games, pressKey, onPress, onRelease, baseDelay,
}: {
  emoji: string; title: string; titleHe: string; accent: string
  games: Game[]; pressKey: string | null
  onPress: (k: string) => void; onRelease: () => void; baseDelay: number
}) {
  const rgb = hexToRgb(accent)
  return (
    <div>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 22, direction: 'rtl',
      }}>
        <span style={{ fontSize: 28, lineHeight: 1 }}>{emoji}</span>
        <div>
          <div style={{
            fontSize: 22, fontWeight: 800,
            background: `linear-gradient(135deg, white 0%, rgba(${rgb},0.85) 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            fontFamily: "'Heebo','DM Sans',sans-serif",
            letterSpacing: '0.3px',
            lineHeight: 1,
          } as React.CSSProperties}>{titleHe}</div>
          <div style={{
            fontSize: 12, color: `rgba(${rgb},0.70)`,
            fontFamily: "'DM Sans',sans-serif",
            letterSpacing: '1.2px', textTransform: 'uppercase',
            marginTop: 2,
          }}>{title}</div>
        </div>
        {/* Decorative rule */}
        <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, rgba(${rgb},0.35), transparent)` }}/>
      </div>

      {/* Bubble grid — 3 per row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '20px 10px',
        justifyItems: 'center',
      }}>
        {games.map((game, idx) => (
          <GameBubble
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

/* ─── Main screen ─── */
export function AbuGames() {
  const setScreen = useAppStore(s => s.setScreen)
  const [pressed, setPressed] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!document.getElementById('abu-games-anim')) {
      const style = document.createElement('style')
      style.id = 'abu-games-anim'
      style.textContent = `
        @keyframes bubbleIn {
          from { opacity: 0; transform: scale(0.55) translateY(30px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes floatTile {
          0%,100% { transform: translateY(0px) rotate(var(--tr,0deg)); }
          50%      { transform: translateY(-14px) rotate(var(--tr,0deg)); }
        }
        @keyframes headerSlide {
          from { opacity:0; transform:translateY(-12px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .abu-games-scroll { scrollbar-width:none; -ms-overflow-style:none; }
        .abu-games-scroll::-webkit-scrollbar { display:none; }
      `
      document.head.appendChild(style)
    }
    const t = setTimeout(() => setLoaded(true), 60)
    const onVis = () => { if (!document.hidden) isNavigating = false }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearTimeout(t)
      document.removeEventListener('visibilitychange', onVis)
      document.getElementById('abu-games-anim')?.remove()
    }
  }, [])

  // Suppress unused warning
  void loaded

  return (
    <div
      className="abu-games-scroll"
      style={{
        height: '100%', width: '100%',
        overflowY: 'auto', overflowX: 'hidden',
        background: 'linear-gradient(160deg, #07091A 0%, #0E0B24 45%, #080B1E 100%)',
        fontFamily: "'Heebo','DM Sans',sans-serif",
        userSelect: 'none', WebkitUserSelect: 'none',
        position: 'relative',
      }}
    >

      {/* ── Ambient blobs ── */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: [
          'radial-gradient(ellipse 60% 35% at 15% 5%, rgba(201,168,76,0.18) 0%, transparent 60%)',
          'radial-gradient(ellipse 50% 40% at 88% 88%, rgba(239,68,68,0.12) 0%, transparent 60%)',
          'radial-gradient(ellipse 45% 30% at 50% 50%, rgba(139,92,246,0.06) 0%, transparent 65%)',
        ].join(', '),
      }}/>

      {/* ── Floating background tiles ── */}
      {[
        { ch: '中', top: '5%',  left: '6%',  size: 52, op: 0.05, delay: '0s',   dur: '6.5s', rot: '-12deg' },
        { ch: '♠', top: '10%', left: '82%', size: 64, op: 0.04, delay: '1.2s', dur: '7.8s', rot: '8deg' },
        { ch: '發', top: '35%', left: '90%', size: 48, op: 0.05, delay: '0.6s', dur: '5.8s', rot: '18deg' },
        { ch: '♥', top: '55%', left: '3%',  size: 72, op: 0.04, delay: '2s',   dur: '8.2s', rot: '-6deg' },
        { ch: '🀄', top: '72%', left: '84%', size: 56, op: 0.04, delay: '0.4s', dur: '6.2s', rot: '10deg' },
        { ch: '♦', top: '88%', left: '50%', size: 60, op: 0.04, delay: '1.8s', dur: '7s',   rot: '-15deg' },
      ].map((f, i) => (
        <div key={i} aria-hidden="true" style={{
          position: 'absolute', top: f.top, left: f.left,
          fontSize: f.size, color: 'white', opacity: f.op,
          pointerEvents: 'none', zIndex: 0, lineHeight: 1,
          animation: `floatTile ${f.dur} ease-in-out ${f.delay} infinite`,
          ['--tr' as string]: f.rot,
        } as React.CSSProperties}>{f.ch}</div>
      ))}

      {/* ════ STICKY HEADER ════ */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'linear-gradient(180deg, rgba(7,9,26,0.98) 0%, rgba(8,11,30,0.95) 100%)',
        borderBottom: '1px solid rgba(201,168,76,0.16)',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        animation: 'headerSlide 0.4s ease both',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', height: 68, position: 'relative',
        }}>
          {/* Wordmark */}
          <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, direction: 'ltr' }}>
            <span style={{
              fontFamily: "'Cormorant Garamond',Georgia,serif",
              fontSize: 27, fontWeight: 600, letterSpacing: '2px',
              background: 'linear-gradient(135deg,#5EEAD4 0%,#2DD4BF 22%,#0D9488 48%,#5EEAD4 72%,#14B8A6 92%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              filter: 'drop-shadow(0 0 8px rgba(94,234,212,0.30))',
            } as React.CSSProperties}>Abu</span>
            <span style={{
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 25, fontWeight: 500, letterSpacing: '1.5px',
              background: 'linear-gradient(135deg,#FDE68A 0%,#F59E0B 25%,#D97706 50%,#C9A84C 75%,#F59E0B 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              filter: 'drop-shadow(0 0 8px rgba(201,168,76,0.28))',
            } as React.CSSProperties}>Games</span>
          </div>
          <div style={{
            fontSize: 13, color: 'rgba(255,255,255,0.50)',
            marginTop: 1, fontFamily: "'Heebo',sans-serif",
          }}>שחקי ותהני! 🎉</div>

          {/* Back */}
          <button type="button" onClick={() => setScreen(Screen.Home)} aria-label="חזרה"
            style={{
              position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
              display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
              borderRadius: 20, background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)', cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}>
            <ChevronLeft />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontFamily: "'Heebo',sans-serif" }}>חזרה</span>
          </button>
        </div>
      </header>

      {/* ════ SCROLLABLE CONTENT ════ */}
      <div style={{
        position: 'relative', zIndex: 2,
        padding: '28px 16px',
        display: 'flex', flexDirection: 'column', gap: 44,
        paddingBottom: 'calc(36px + env(safe-area-inset-bottom, 0px))',
      }}>

        {/* ── SOLITAIRE SECTION ── */}
        <CategorySection
          emoji="🃏" title="Solitaire" titleHe="סוליטר"
          accent="#C9A84C"
          games={SOLITAIRE_GAMES}
          pressKey={pressed}
          onPress={setPressed}
          onRelease={() => setPressed(null)}
          baseDelay={0.08}
        />

        {/* ── Divider ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.35))' }}/>
          <span style={{ fontSize: 20, opacity: 0.5 }}>🀄</span>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(239,68,68,0.35), transparent)' }}/>
        </div>

        {/* ── MAHJONG SECTION ── */}
        <CategorySection
          emoji="🀄" title="Mahjong" titleHe="מהג'ונג"
          accent="#ef4444"
          games={MAHJONG_GAMES}
          pressKey={pressed}
          onPress={setPressed}
          onRelease={() => setPressed(null)}
          baseDelay={0.50}
        />

      </div>
    </div>
  )
}

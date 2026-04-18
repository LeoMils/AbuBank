// Shared premium animations — injected once, used across all screens
export const SHARED_KEYFRAMES_ID = 'abu-premium-animations'

export const SHARED_KEYFRAMES = `
  @keyframes ambientColorShift {
    0%   { filter: hue-rotate(0deg); }
    33%  { filter: hue-rotate(8deg); }
    66%  { filter: hue-rotate(-5deg); }
    100% { filter: hue-rotate(0deg); }
  }

  @keyframes gentleFloat {
    0%, 100% { transform: translateY(0px); }
    50%      { transform: translateY(-6px); }
  }

  @keyframes subtleBreath {
    0%, 100% { opacity: 0.4; }
    50%      { opacity: 0.7; }
  }

  @keyframes softPulseRing {
    0%, 100% { box-shadow: 0 0 0 0px rgba(201,168,76,0.0); }
    50%      { box-shadow: 0 0 0 4px rgba(201,168,76,0.12); }
  }

  @keyframes weatherSway {
    0%, 100% { transform: rotate(0deg); }
    25%      { transform: rotate(-2deg); }
    75%      { transform: rotate(2deg); }
  }

  @keyframes calendarBounce {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-2px); }
  }

  @keyframes aiGlow {
    0%, 100% { filter: drop-shadow(0 3px 8px rgba(0,0,0,0.45)) drop-shadow(0 0 12px rgba(251,191,36,0.35)); }
    50%      { filter: drop-shadow(0 3px 8px rgba(0,0,0,0.45)) drop-shadow(0 0 20px rgba(251,191,36,0.60)); }
  }

  @keyframes gamesShuffle {
    0%, 100% { transform: rotate(0deg) scale(1); }
    50%      { transform: rotate(1.5deg) scale(1.02); }
  }

  @keyframes whatsappPulse {
    0%, 100% { transform: scale(1); }
    50%      { transform: scale(1.04); }
  }

  @media (prefers-reduced-motion: reduce) {
    @keyframes ambientColorShift { from, to { filter: none; } }
    @keyframes gentleFloat { from, to { transform: none; } }
    @keyframes subtleBreath { from, to { opacity: 0.5; } }
    @keyframes softPulseRing { from, to { box-shadow: none; } }
    @keyframes weatherSway { from, to { transform: none; } }
    @keyframes calendarBounce { from, to { transform: none; } }
    @keyframes aiGlow { from, to { filter: none; } }
    @keyframes gamesShuffle { from, to { transform: none; } }
    @keyframes whatsappPulse { from, to { transform: none; } }
  }
`

export function injectSharedKeyframes(): void {
  if (document.getElementById(SHARED_KEYFRAMES_ID)) return
  const style = document.createElement('style')
  style.id = SHARED_KEYFRAMES_ID
  style.textContent = SHARED_KEYFRAMES
  document.head.appendChild(style)
}

export const KEYFRAMES_SHARED = `
@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes pulse {
  0%, 100% { opacity: 0.7; }
  50%      { opacity: 1; }
}
@keyframes dotPulse {
  0%, 80%, 100% { opacity: 0.25; transform: scale(0.75); }
  40%           { opacity: 1; transform: scale(1.0); }
}
@keyframes waveBar {
  0%, 100% { transform: scaleY(0.25); }
  50%      { transform: scaleY(1.0); }
}
@keyframes glowBreath {
  0%, 100% { box-shadow: 0 0 16px rgba(201,168,76,0.10); }
  50%      { box-shadow: 0 0 24px rgba(201,168,76,0.25); }
}
`

export const ENTRY_DURATION = '0.3s'
export const ENTRY_EASING = 'ease-out'
export const ENTRY_STAGGER = 0.05

export const PRESS_SCALE = 'scale(0.95)'
export const PRESS_DURATION = '0.1s'

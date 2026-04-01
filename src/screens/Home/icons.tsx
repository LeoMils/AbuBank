// AbuBank — SVG icon functions for service bubbles

type IconFn = (color: string) => JSX.Element;

export const ICONS: Record<string, IconFn> = {

  mizrahi: (c) => (
    <svg viewBox="0 0 32 32" width="30" height="30" fill="none"
      stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M3 28h26"/>
      <path d="M16 4L3 14h26L16 4z"/>
      <rect x="6" y="14" width="5" height="14"/>
      <rect x="13.5" y="14" width="5" height="14"/>
      <rect x="21" y="14" width="5" height="14"/>
    </svg>
  ),

  postal: (c) => (
    <svg viewBox="0 0 32 32" width="30" height="30" fill="none"
      stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <rect x="3" y="8" width="26" height="18" rx="2"/>
      <polyline points="3,8 16,19 29,8"/>
    </svg>
  ),

  max: (c) => (
    <svg viewBox="0 0 32 32" width="30" height="30" fill="none"
      stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <rect x="3" y="8" width="26" height="18" rx="2"/>
      <line x1="3" y1="14" x2="29" y2="14"/>
      <line x1="7" y1="21" x2="13" y2="21"/>
      <line x1="7" y1="24" x2="11" y2="24"/>
    </svg>
  ),

  water: (c) => (
    <svg viewBox="0 0 32 32" width="30" height="30" fill="none"
      stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M16 4C16 4 5 18 5 23a11 11 0 0022 0C27 18 16 4 16 4z"/>
      <path d="M11 24a5 5 0 004 4" strokeOpacity="0.5"/>
    </svg>
  ),

  iec: (c) => (
    <svg viewBox="0 0 32 32" width="30" height="30" fill="none"
      stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <polyline points="18,3 9,17 16,17 14,29 23,15 16,15"/>
    </svg>
  ),

  arnona: (c) => (
    <svg viewBox="0 0 32 32" width="30" height="30" fill="none"
      stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <rect x="2" y="17" width="8" height="13"/>
      <rect x="12" y="11" width="8" height="19"/>
      <rect x="22" y="14" width="8" height="16"/>
      <line x1="2" y1="30" x2="30" y2="30"/>
    </svg>
  ),

  hot: (c) => (
    <svg viewBox="0 0 32 32" width="30" height="30" fill="none"
      stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <rect x="9" y="2" width="14" height="28" rx="2.5"/>
      <line x1="13" y1="26" x2="19" y2="26"/>
      <line x1="12" y1="6" x2="20" y2="6"/>
    </svg>
  ),

  partner: (c) => (
    <svg viewBox="0 0 32 32" width="30" height="30" fill="none"
      stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M3 11a18 18 0 0126 0"/>
      <path d="M7 16a12 12 0 0118 0"/>
      <path d="M11 21a6 6 0 0110 0"/>
      <circle cx="16" cy="27" r="1.5" fill={c} stroke="none"/>
    </svg>
  ),

  yes: (c) => (
    <svg viewBox="0 0 32 32" width="30" height="30" fill="none"
      stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <rect x="2" y="4" width="28" height="20" rx="2"/>
      <line x1="10" y1="28" x2="22" y2="28"/>
      <line x1="16" y1="24" x2="16" y2="28"/>
    </svg>
  ),
};

/*
 * AbuCharacterA — the shippable interim character (variant A "Warm Gold"), as a
 * React SVG split into the NAMED layer groups CHARACTER-ASSET-SPEC.md requires.
 * ════════════════════════════════════════════════════════════════════════════
 * D9 (Leo): ship variant A as-is and animate it now; a commissioned painterly
 * illustration is a LATER upgrade, not a blocker. The swap is deliberately cheap:
 * a future asset replaces the SVG markup in THIS file keeping the same group ids
 * and the same prop contract below — AbuPresence (the animation code) never changes.
 *
 * ── Prop contract (asset-agnostic — honour these and any asset animates) ──
 *   mouth      0 = closed smile … 1 = fully open   (cross-fades the 3 visemes)
 *   eyesClosed 0 = eyes open     … 1 = lids fully cover the eyes (a blink)
 *
 * Background is TRANSPARENT — the screen draws the Night-Garden starfield + the
 * stateful aura behind her. Source composition/palette: docs/design/abu-bust-A.svg.
 */
import type { CSSProperties } from 'react'

export interface AbuCharacterProps {
  /** 0 = closed smile, 1 = fully open. Drives the mouth viseme cross-fade. */
  mouth: number
  /** 0 = eyes open, 1 = lids fully lowered (blink). */
  eyesClosed: number
  /** Rendered box size in px (design canvas is 360×400; scales uniformly). */
  size?: number
  style?: CSSProperties
}

/** Clamp to [0,1]. */
const c01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)

/**
 * Cross-fade opacities for the three registered mouth shapes from one scalar.
 * 0…0.5 fades closed→mid, 0.5…1 fades mid→open, so at every amplitude exactly
 * the right shape dominates and there is never a jump between shapes.
 */
function mouthOpacities(mouthRaw: number): { closed: number; mid: number; open: number } {
  const m = c01(mouthRaw)
  if (m <= 0.5) {
    const k = m * 2 // 0..1
    return { closed: 1 - k, mid: k, open: 0 }
  }
  const k = (m - 0.5) * 2 // 0..1
  return { closed: 0, mid: 1 - k, open: k }
}

export function AbuCharacterA({ mouth, eyesClosed, size = 260, style }: AbuCharacterProps) {
  const mo = mouthOpacities(mouth)
  const lid = c01(eyesClosed)
  // Lids scale down from the TOP of their own box (transform-box: fill-box) so
  // scaleY(0)=open, scaleY(1)=shut. A short transition keeps a blink soft.
  const lidStyle = (originY: string): CSSProperties => ({
    transformBox: 'fill-box',
    transformOrigin: `center ${originY}`,
    transform: `scaleY(${lid})`,
    transition: 'transform 80ms ease-out',
  })

  return (
    <svg
      viewBox="0 0 360 400"
      width={size}
      height={(size * 400) / 360}
      role="img"
      aria-label="אבו"
      style={style}
    >
      <defs>
        <radialGradient id="AcSkin" cx="42%" cy="34%" r="72%">
          <stop offset="0%" stopColor="#FBDDB8" /><stop offset="52%" stopColor="#EEBE94" />
          <stop offset="82%" stopColor="#D89A70" /><stop offset="100%" stopColor="#B87A54" />
        </radialGradient>
        <linearGradient id="AcHair" x1="18%" y1="0%" x2="82%" y2="100%">
          <stop offset="0%" stopColor="#FFFBF2" /><stop offset="40%" stopColor="#E9E4DA" />
          <stop offset="72%" stopColor="#CFC7BE" /><stop offset="100%" stopColor="#AFA79E" />
        </linearGradient>
        <linearGradient id="AcShawl" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F0B87E" /><stop offset="48%" stopColor="#D98A55" /><stop offset="100%" stopColor="#9B5236" />
        </linearGradient>
        <radialGradient id="AcCheek" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E88C6E" stopOpacity="0.5" /><stop offset="100%" stopColor="#E88C6E" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="AcRim" x1="100%" y1="0%" x2="0%" y2="60%">
          <stop offset="0%" stopColor="#FFE6B0" stopOpacity="0.95" /><stop offset="45%" stopColor="#FFE6B0" stopOpacity="0.2" /><stop offset="100%" stopColor="#FFE6B0" stopOpacity="0" />
        </linearGradient>
        <filter id="AcSoft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2" /></filter>
        <filter id="AcSoft1" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="0.8" /></filter>
      </defs>

      {/* 1. hair-back — behind the head, soft edge */}
      <g id="hair-back">
        <path d="M106 150 Q102 90 152 64 Q180 50 208 64 Q258 90 254 150 Q264 212 224 246 L136 246 Q96 212 106 150 Z" fill="url(#AcHair)" filter="url(#AcSoft)" />
        <path d="M106 150 Q102 90 152 64 Q180 50 208 64 Q258 90 254 150 Q264 212 224 246 L136 246 Q96 212 106 150 Z" fill="url(#AcHair)" />
        <ellipse cx="240" cy="90" rx="23" ry="25" fill="url(#AcHair)" filter="url(#AcSoft1)" />
      </g>

      {/* 2. base — shawl, neck, face, form shading + rim (the static body) */}
      <g id="base">
        <path d="M66 400 Q74 298 130 274 Q160 262 180 262 Q200 262 230 274 Q286 298 294 400 Z" fill="url(#AcShawl)" />
        <path d="M128 300 Q180 286 232 300" fill="none" stroke="#7C3E28" strokeWidth="2.5" opacity="0.45" filter="url(#AcSoft1)" />
        <path d="M112 344 Q180 322 248 344" fill="none" stroke="#F6C79A" strokeWidth="2" opacity="0.4" filter="url(#AcSoft1)" />
        <path d="M150 274 Q160 320 150 384" fill="none" stroke="#7C3E28" strokeWidth="2" opacity="0.3" />
        <path d="M210 274 Q200 320 210 384" fill="none" stroke="#7C3E28" strokeWidth="2" opacity="0.3" />
        <path d="M158 260 Q160 286 180 290 Q200 286 202 260 L202 244 L158 244 Z" fill="url(#AcSkin)" />
        <path d="M158 256 Q180 272 202 256 Q196 268 180 270 Q164 268 158 256 Z" fill="#9E6B4C" opacity="0.35" filter="url(#AcSoft1)" />
        <path d="M132 150 Q130 102 180 96 Q230 102 228 150 Q230 198 196 224 Q180 234 164 224 Q130 198 132 150 Z" fill="url(#AcSkin)" />
        <path d="M180 96 Q214 104 226 148 Q214 128 196 118 Q188 104 180 96 Z" fill="#B87A54" opacity="0.28" filter="url(#AcSoft)" />
        <path d="M132 150 Q130 102 180 96 Q166 108 158 150 Q154 198 178 224 Q170 228 164 224 Q130 198 132 150 Z" fill="url(#AcRim)" opacity="0.7" />
      </g>

      {/* 3. cheeks — blush */}
      <g id="cheeks">
        <ellipse cx="152" cy="178" rx="16" ry="12" fill="url(#AcCheek)" />
        <ellipse cx="208" cy="178" rx="16" ry="12" fill="url(#AcCheek)" />
      </g>

      {/* 4. brows */}
      <g id="brows">
        <path d="M143 145 Q156 138 169 144" fill="none" stroke="#C9B79E" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M191 144 Q204 138 217 145" fill="none" stroke="#C9B79E" strokeWidth="2.4" strokeLinecap="round" />
      </g>

      {/* 5. eyes-open — eyeballs + irises + catchlights */}
      <g id="eyes-open">
        <path d="M144 159 Q156 149 170 158 Q157 168 144 159 Z" fill="#FCF3E7" />
        <path d="M190 158 Q204 149 216 159 Q203 168 190 158 Z" fill="#FCF3E7" />
        <circle cx="157" cy="159" r="4" fill="#7A5230" /><circle cx="203" cy="159" r="4" fill="#7A5230" />
        <circle cx="157" cy="159" r="1.7" fill="#3A2415" /><circle cx="203" cy="159" r="1.7" fill="#3A2415" />
        <circle cx="158.6" cy="157.2" r="1.2" fill="#FFFFFF" /><circle cx="204.6" cy="157.2" r="1.2" fill="#FFFFFF" />
        <path d="M144 159 Q156 149 170 158" fill="none" stroke="#6E4A2E" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M190 158 Q204 149 216 159" fill="none" stroke="#6E4A2E" strokeWidth="1.6" strokeLinecap="round" />
      </g>

      {/* 6. eyelids — skin shapes that lower to fully cover the eyes (blink). Never
             merged into base; must be able to hide eyes-open completely. */}
      <g id="eyelids">
        <path d="M142 149 Q157 145 172 149 Q172 162 157 163 Q142 162 142 149 Z" fill="url(#AcSkin)" style={lidStyle('top')} />
        <path d="M188 149 Q203 145 218 149 Q218 162 203 163 Q188 162 188 149 Z" fill="url(#AcSkin)" style={lidStyle('top')} />
      </g>

      {/* nose (part of the face, drawn above lids' resting position) */}
      <path d="M180 162 Q175 180 173 188 Q180 193 187 188" fill="none" stroke="#BC8A66" strokeWidth="1.8" strokeLinecap="round" />

      {/* 7. mouth — THREE registered visemes on one origin (~180,205). Amplitude
             cross-fades their opacity; positions are locked so nothing shifts. */}
      <g id="mouth">
        <g id="mouth-closed" style={{ opacity: mo.closed }}>
          <path d="M162 202 Q180 215 198 202" fill="none" stroke="#B85C52" strokeWidth="3" strokeLinecap="round" />
          <path d="M165 203 Q180 210 195 203" fill="#E8917A" opacity="0.5" />
        </g>
        <g id="mouth-mid" style={{ opacity: mo.mid }}>
          <path d="M164 202 Q180 208 196 202 Q180 213 164 202 Z" fill="#7A2E2A" />
          <path d="M164 202 Q180 206 196 202" fill="none" stroke="#B85C52" strokeWidth="2" strokeLinecap="round" />
        </g>
        <g id="mouth-open" style={{ opacity: mo.open }}>
          <ellipse cx="180" cy="205" rx="14" ry="9" fill="#5E2320" />
          <ellipse cx="180" cy="209" rx="9" ry="4" fill="#C56B5A" opacity="0.75" />
          <path d="M167 200 Q180 197 193 200" fill="none" stroke="#F3E5D8" strokeWidth="2.4" strokeLinecap="round" opacity="0.85" />
        </g>
      </g>

      {/* 8. hair-front — framing flyaways above the face edges */}
      <g id="hair-front">
        <path d="M132 150 Q120 108 158 96" fill="none" stroke="#EDE7DD" strokeWidth="2" opacity="0.7" filter="url(#AcSoft1)" />
        <path d="M228 150 Q240 108 202 94" fill="none" stroke="#EDE7DD" strokeWidth="2" opacity="0.6" filter="url(#AcSoft1)" />
        <path d="M136 176 Q126 190 132 206" fill="none" stroke="#DED7CD" strokeWidth="1.6" opacity="0.5" filter="url(#AcSoft1)" />
      </g>

      {/* 9. rim-light — soft warm light edge (kept subtle; the screen adds the aura) */}
      <g id="rim-light">
        <circle cx="140" cy="198" r="3" fill="#F0C070" /><circle cx="139" cy="197" r="1" fill="#FFF6DC" />
      </g>
    </svg>
  )
}

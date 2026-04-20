const STYLES = ['מקורי', 'בדיחה', 'חידה', 'טריק'] as const
type Style = typeof STYLES[number]

const STYLE_ACCENT: Record<Style, string> = {
  'מקורי': 'rgba(255,255,255,0.55)',
  'בדיחה': 'rgba(251,191,36,0.70)',
  'חידה': 'rgba(167,139,250,0.75)',
  'טריק': 'rgba(52,211,153,0.75)',
}

interface StyleSelectorProps {
  activeStyle: Style
  onSelect: (style: Style) => void
}

export function StyleSelector({ activeStyle, onSelect }: StyleSelectorProps) {
  return (
    <div style={{
      display: 'flex', gap: 8, flexWrap: 'wrap',
      justifyContent: 'center',
      width: '100%', maxWidth: 370,
    }}>
      {STYLES.map(style => (
        <button
          key={style}
          type="button"
          onClick={() => onSelect(style)}
          style={{
            height: 46, padding: '0 22px', borderRadius: 23,
            border: activeStyle === style
              ? '1.5px solid rgba(20,184,166,0.70)'
              : '1px solid rgba(255,255,255,0.13)',
            background: activeStyle === style
              ? `linear-gradient(135deg, #14b8a6 0%, #0d9488 60%, #0f766e 100%)`
              : 'rgba(255,255,255,0.04)',
            color: activeStyle === style ? 'white' : STYLE_ACCENT[style],
            fontSize: 16, fontWeight: activeStyle === style ? 700 : 500,
            fontFamily: "'Heebo',sans-serif",
            cursor: 'pointer',
            boxShadow: activeStyle === style
              ? '0 3px 16px rgba(20,184,166,0.30), 0 0 0 1px rgba(201,168,76,0.18), inset 0 1px 0 rgba(255,255,255,0.14)'
              : '0 1px 4px rgba(0,0,0,0.15)',
            transition: 'all 0.20s ease',
            whiteSpace: 'nowrap',
          }}
        >{style}</button>
      ))}
    </div>
  )
}

export { STYLES, type Style, STYLE_ACCENT }

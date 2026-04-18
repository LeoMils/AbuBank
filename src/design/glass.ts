import type React from 'react'

export const GLASS_SURFACE: React.CSSProperties = {
  background: 'rgba(255,250,240,0.04)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(201,168,76,0.14)',
  boxShadow: 'inset 0 1px 0 rgba(255,250,240,0.03)',
}

export const GLASS_ELEVATED: React.CSSProperties = {
  background: 'rgba(255,250,240,0.08)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(201,168,76,0.22)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.40)',
}

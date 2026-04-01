import { useState, useEffect } from 'react'

// Purpose: reactive UI state for Offline screen retry button.
// NOT a replacement for store.isOnline — that drives navigation logic.
// This hook drives local UI (button disabled state) only.
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(navigator.onLine)

  // Local UI subscription for online/offline events
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  return online
}

import { useState, useEffect } from 'react'

export function useSWUpdate(): { updateReady: boolean; applyUpdate: () => void } {
  const [updateReady, setUpdateReady] = useState(false)
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null)

  // Listen for SW update lifecycle events
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.getRegistration().then(reg => {
      if (!reg) return
      setRegistration(reg)
      if (reg.waiting) setUpdateReady(true)
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing
        if (!newSW) return
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateReady(true)
          }
        })
      })
    })
  }, [])

  return {
    updateReady,
    applyUpdate: () => {
      registration?.waiting?.postMessage({ type: 'SKIP_WAITING' })
      window.location.reload()
    },
  }
}

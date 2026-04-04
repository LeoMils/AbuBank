import { useState, useEffect } from 'react'

export function useSWUpdate(): { updateReady: boolean; applyUpdate: () => void } {
  const [updateReady, setUpdateReady] = useState(false)
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // ── Auto-reload on controllerchange ──────────────────────────────────────
    // When skipWaiting:true + clientsClaim:true, the new SW takes over
    // immediately (no waiting state). The browser fires controllerchange when
    // the new SW becomes the active controller for this page.
    // Reloading here picks up the new JS/CSS bundle immediately.
    let reloading = false
    const handleControllerChange = () => {
      if (reloading) return
      reloading = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

    // ── Fallback: waiting-state detection (manual skipWaiting flow) ───────────
    navigator.serviceWorker.getRegistration().then(reg => {
      if (!reg) return
      setRegistration(reg)
      // Already waiting (loaded after update installed)
      if (reg.waiting) { setUpdateReady(true); return }
      // New SW being installed right now
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

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
    }
  }, [])

  return {
    updateReady,
    applyUpdate: () => {
      registration?.waiting?.postMessage({ type: 'SKIP_WAITING' })
      window.location.reload()
    },
  }
}

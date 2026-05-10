import { useState, useEffect } from 'react'

export function useSWUpdate(): { updateReady: boolean; applyUpdate: () => void } {
  const [updateReady, setUpdateReady] = useState(false)
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // ── First-install guard ────────────────────────────────────────────────
    // When skipWaiting+clientsClaim are enabled, the brand-new SW takes
    // control of an uncontrolled page (no previous controller) and that
    // ALSO fires `controllerchange`. iOS Safari often defers SW activation
    // until the first user interaction (e.g. tapping AbuWhatsApp), so the
    // page reloads mid-navigation and the user sees their tap "bounce"
    // back to Home. We must auto-reload only on REAL updates — i.e. when
    // the page already had a controller at hook mount and a NEW controller
    // takes over later.
    const hadControllerAtMount = !!navigator.serviceWorker.controller

    // ── Auto-reload on controllerchange (real updates only) ───────────────
    let reloading = false
    const handleControllerChange = () => {
      if (!hadControllerAtMount) return // first-install: skip reload
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

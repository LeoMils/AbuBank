import { useState, useEffect } from 'react'

// Chrome/Android only — iOS Safari: beforeinstallprompt never fires.
// canInstall=false on iOS → InstallGuidance shows §15 manual instructions.
// canInstall=true on Android → InstallGuidance shows native install button.
// BeforeInstallPromptEvent declared in src/global.d.ts
export function useInstallPrompt(): { canInstall: boolean; triggerInstall: () => void } {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)

  // Progressive enhancement: listen for beforeinstallprompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  return {
    canInstall: deferredPrompt !== null,
    triggerInstall: () => {
      deferredPrompt?.prompt()
      setDeferredPrompt(null)
    },
  }
}

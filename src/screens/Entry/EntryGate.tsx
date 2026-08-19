import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  decideEntry,
  isSessionWarm,
  markSessionWarm,
  readAwayMs,
  readLockConfig,
  recordHidden,
  type EntryDecision,
} from '../../services/appLock'
import { IntroSplash } from './IntroSplash'
import { AuthGate } from './AuthGate'

type Phase = 'boot' | 'intro' | 'auth' | 'open'

/** Automation bypass: keep Playwright/e2e (and an explicit ?nointro=1) out of the gate. */
function shouldBypass(): boolean {
  try {
    if (typeof navigator !== 'undefined' && (navigator as { webdriver?: boolean }).webdriver) return true
    const p = new URL(window.location.href).searchParams
    return p.get('nointro') === '1' || p.get('e2e') === '1'
  } catch {
    return false
  }
}

/**
 * The premium entry gate. Wraps the whole app: on a cold launch it plays the
 * intro then (if protection is on) authenticates before revealing `children`.
 * On resume it never replays the intro and only re-locks after real inactivity.
 * Fail-OPEN: any error path resolves to showing the app, never a locked-out
 * blank screen.
 */
export function EntryGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('boot')
  const [authMode, setAuthMode] = useState<'unlock' | 'setup'>('unlock')
  const decisionRef = useRef<EntryDecision>({ showIntro: false, requireAuth: false, offerSetup: false })
  const phaseRef = useRef<Phase>('boot')
  phaseRef.current = phase

  const openApp = () => {
    markSessionWarm()
    setPhase('open')
  }

  // Decide once, on mount.
  useEffect(() => {
    if (shouldBypass()) {
      openApp()
      return
    }
    let decision: EntryDecision
    try {
      decision = decideEntry({
        coldLaunch: !isSessionWarm(),
        config: readLockConfig(),
        awayMs: readAwayMs(Date.now()),
      })
    } catch {
      decision = { showIntro: false, requireAuth: false, offerSetup: false }
    }
    decisionRef.current = decision

    if (decision.showIntro) {
      setPhase('intro')
    } else if (decision.requireAuth) {
      setAuthMode('unlock')
      setPhase('auth')
    } else {
      openApp()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onIntroDone = () => {
    const d = decisionRef.current
    if (d.requireAuth) {
      setAuthMode('unlock')
      setPhase('auth')
    } else if (d.offerSetup) {
      setAuthMode('setup')
      setPhase('auth')
    } else {
      openApp()
    }
  }

  // Re-lock on resume after real inactivity — no intro replay.
  useEffect(() => {
    const onVisibility = () => {
      try {
        if (document.hidden) {
          recordHidden(Date.now())
          return
        }
        if (phaseRef.current !== 'open') return
        const d = decideEntry({
          coldLaunch: false,
          config: readLockConfig(),
          awayMs: readAwayMs(Date.now()),
        })
        if (d.requireAuth) {
          setAuthMode('unlock')
          setPhase('auth')
        }
      } catch {
        /* never let the lock brick a resume */
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  if (phase === 'boot') return null // one black frame before we decide — on-brand, no flash of Home
  if (phase === 'intro') return <IntroSplash onDone={onIntroDone} />
  if (phase === 'auth') return <AuthGate mode={authMode} onAuthed={openApp} />
  return <>{children}</>
}

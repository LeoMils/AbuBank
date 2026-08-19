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

type Phase = 'boot' | 'intro' | 'setup' | 'auth' | 'open'

/**
 * DEV-ONLY bypass so local Playwright/visual runs can reach inner screens.
 * Deliberately compiled OUT of production builds (`import.meta.env.DEV` is
 * statically false there) — a shipped build has NO gate bypass whatsoever.
 */
function devBypass(): boolean {
  try {
    if (!(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) return false
    const p = new URL(window.location.href).searchParams
    return p.get('e2e') === '1' || p.get('nointro') === '1'
  } catch {
    return false
  }
}

/**
 * The premium entry gate. Wraps the whole app: a cold launch plays the intro
 * then presents a gate (`setup` on first run, `auth` when protected) before
 * revealing `children`. Resume never replays the intro and re-locks only after
 * real inactivity.
 *
 * FAIL-CLOSED: the app is only revealed via a real success path (completed
 * setup, biometric verified, or a valid PIN). Any error while DECIDING resolves
 * toward a gate (never a silent open): an unprotected device is sent to
 * mandatory setup, a protected one to auth.
 */
export function EntryGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('boot')
  const decisionRef = useRef<EntryDecision>({ showIntro: false, gate: 'none' })
  const phaseRef = useRef<Phase>('boot')
  phaseRef.current = phase

  const openApp = () => {
    markSessionWarm()
    setPhase('open')
  }

  const gateToPhase = (gate: EntryDecision['gate']): Phase =>
    gate === 'setup' ? 'setup' : gate === 'auth' ? 'auth' : 'open'

  // Decide once, on mount.
  useEffect(() => {
    if (devBypass()) {
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
      // Fail-closed: never silently open. Force a gate based on protection state.
      let isProtected = false
      try {
        isProtected = readLockConfig().protectionEnabled
      } catch {
        isProtected = false
      }
      decision = { showIntro: false, gate: isProtected ? 'auth' : 'setup' }
    }
    decisionRef.current = decision

    if (decision.showIntro) {
      setPhase('intro')
    } else if (decision.gate === 'none') {
      openApp()
    } else {
      setPhase(gateToPhase(decision.gate))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onIntroDone = () => {
    const d = decisionRef.current
    if (d.gate === 'none') openApp()
    else setPhase(gateToPhase(d.gate))
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
        if (d.gate !== 'none') setPhase(gateToPhase(d.gate))
      } catch {
        // On any resume-decision error, fail closed by requiring auth.
        if (phaseRef.current === 'open') setPhase('auth')
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  if (phase === 'boot') return null // one black frame before we decide — on-brand, no flash of Home
  if (phase === 'intro') return <IntroSplash onDone={onIntroDone} />
  if (phase === 'setup') return <AuthGate mode="setup" onAuthed={openApp} />
  if (phase === 'auth') return <AuthGate mode="unlock" onAuthed={openApp} />
  return <>{children}</>
}

import { useAppStore } from '../state/store'
import { Screen } from '../state/types'

// Module-level timers — NOT in Zustand
// _forceUnlock is module-internal — NOT exported, ever
let _navWatchdog: ReturnType<typeof setTimeout> | null = null
let _navDelayTimer: ReturnType<typeof setTimeout> | null = null
const _lastTapMap: Record<string, number> = {}

export function openService(id: string): void {
  const state = useAppStore.getState()

  // Offline check FIRST — before locking nav state
  if (!state.isOnline) {
    state.setActiveServiceId(id) // store id for retry
    state.setScreen(Screen.Offline)
    return
  }

  const service = state.services.find(s => s.id === id)
  if (!service || state.isNavigating) return

  // Per-tile 250ms debounce
  const now = Date.now()
  if (now - (_lastTapMap[id] ?? 0) < 250) return
  _lastTapMap[id] = now

  // URL validation — snapshot url at tap time (intentional closure)
  const url = service.url
  if (url.includes('replace-me.invalid') || !/^https:\/\/.+\..+/.test(url)) {
    state.setScreen(Screen.Error)
    return
  }

  // Lock
  state.setNavigating(true)
  state.setNavCancelled(false)
  state.setActiveServiceId(id)
  state.setScreen(Screen.Opening)

  // Watchdog — runs full 3000ms regardless of what happens.
  // NOT cleared after window.open fires.
  // Handles: popup-blocked, user who never leaves, iOS quirks.
  _navWatchdog = setTimeout(_forceUnlock, 3000)

  _navDelayTimer = setTimeout(() => {
    if (!useAppStore.getState().navCancelled) {
      window.open(url, '_blank', 'noopener,noreferrer')
      // url captured at tap time — intentional snapshot
    }
    _navDelayTimer = null
  }, 800)
}

// Used by Offline screen retry button.
// Reads activeServiceId from store — set by openService on offline path.
export function retryNavigation(): void {
  const { isOnline, activeServiceId } = useAppStore.getState()
  if (!isOnline || !activeServiceId) return
  openService(activeServiceId)
}

export function cancelNavigation(): void {
  // Called ONLY by lifecycle: visibilitychange, pagehide, freeze
  // NEVER by blur — see §3
  // NEVER calls lockAdmin() — that is called separately in App.tsx lifecycle
  // Guard: only update screen state if actually navigating.
  // Timers always cleared (defensive — they're null when not navigating).
  if (_navWatchdog) {
    clearTimeout(_navWatchdog)
    _navWatchdog = null
  }
  if (_navDelayTimer) {
    clearTimeout(_navDelayTimer)
    _navDelayTimer = null
  }
  const s = useAppStore.getState()
  if (s.isNavigating) {
    s.setNavigating(false)
    s.setNavCancelled(true)
    s.setActiveServiceId(null)
    s.setScreen(Screen.Home)
  }
}

function _forceUnlock(): void {
  // Watchdog ONLY — never exported, never called externally
  if (_navDelayTimer) {
    clearTimeout(_navDelayTimer)
    _navDelayTimer = null
  }
  _navWatchdog = null
  const s = useAppStore.getState()
  s.setNavigating(false)
  s.setNavCancelled(true)
  s.setActiveServiceId(null)
  s.setScreen(Screen.Home)
}
